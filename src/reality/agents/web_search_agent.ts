import { HfInference } from '@huggingface/inference';
import { SerperClient, SerperSearchResult } from '../services/serper_client';
import crypto from 'crypto';

export interface Variable {
    variable_id: string;
    symbol: string;
    name: string;
    description?: string;
    category: string;
    llm_context?: string;
}

export interface DiscoveredEvent {
    summary: string;
    impact_score: number;        // 0-100
    confidence: number;           // 0-1
    reasoning: string;
    keywords_found: string[];
    sources: string[];
    snapshot_id: string;          // Hash for deduplication
}

/**
 * Autonomous Web Search Agent
 * 
 * Uses Qwen2.5-7B LLM to:
 * 1. Generate contextual search queries
 * 2. Execute searches via Serper API
 * 3. Analyze results and extract events
 * 4. Calculate impact scores
 * 
 * Fully autonomous - no manual intervention needed
 */
export class WebSearchAgent {
    private hf: HfInference;
    private serper: SerperClient;
    private model: string;

    constructor() {
        this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
        this.serper = new SerperClient();
        this.model = process.env.AGENT_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
    }

    /**
     * Main entry point: Discover events for a variable
     * 
     * Pipeline:
     * 1. Generate 3 search queries (LLM)
     * 2. Execute searches (Serper API)
     * 3. Deduplicate by URL
     * 4. Analyze each result (LLM)
     * 5. Filter low-impact events
     */
    async discoverEventsForVariable(variable: Variable): Promise<DiscoveredEvent[]> {
        console.log(`\n[Agent] 🔍 Starting discovery for: ${variable.symbol} - ${variable.name}`);

        // Step 1: Generate search queries using LLM
        const queries = await this.generateSearchQueries(variable);
        console.log(`[Agent] 📝 Generated ${queries.length} queries:`, queries);

        // Step 2: Execute searches
        const allResults: SerperSearchResult[] = [];
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            try {
                const results = await this.serper.search(query, {
                    num: 10,
                    tbs: i === 0 ? 'qdr:d' : undefined  // First query: past day only
                });
                allResults.push(...results);
            } catch (error) {
                console.error(`[Agent] ❌ Search failed for "${query}":`, error);
            }
        }

        console.log(`[Agent] 📊 Collected ${allResults.length} total search results`);

        // Step 3: Deduplicate by URL
        const uniqueResults = this.deduplicateResults(allResults);
        console.log(`[Agent] 🔄 ${uniqueResults.length} unique results after dedup`);

        // Step 4: Analyze results with LLM
        const events = await this.analyzeResults(uniqueResults, variable);
        console.log(`[Agent] ✅ Extracted ${events.length} high-impact events\n`);

        return events;
    }

    /**
     * Generate 3 contextual search queries using LLM
     * 
     * Strategy:
     * - Query 1: Breaking news (past 24h)
     * - Query 2: Major developments (past week)
     * - Query 3: General trends
     */
    private async generateSearchQueries(variable: Variable): Promise<string[]> {
        const systemPrompt = `You are a research assistant for a prediction market. Generate 3 highly specific search queries to find the LATEST news and events about "${variable.name}".`;

        const userPrompt = `Variable Context:
- Name: ${variable.name}
- Category: ${variable.category}
${variable.description ? `- Description: ${variable.description}` : ''}
${variable.llm_context ? `- Focus Areas: ${variable.llm_context}` : ''}

Requirements:
1. Query 1: Focus on breaking news from past 24 hours
2. Query 2: Focus on major developments from past week
3. Query 3: General recent trends and ongoing events

Output ONLY a JSON array of 3 strings, no explanations:
["query 1 here", "query 2 here", "query 3 here"]`;

        try {
            const response = await this.hf.chatCompletion({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 200,
                temperature: 0.3
            });

            // Extract JSON array
            const text = response.choices[0].message.content || '[]';
            const jsonMatch = text.match(/\[(.*?)\]/s);

            if (jsonMatch) {
                const queries = JSON.parse(`[${jsonMatch[1]}]`);
                return queries.slice(0, 3); // Ensure max 3 queries
            }

            // Fallback if extraction fails
            console.warn('[Agent] ⚠️  JSON extraction failed, using fallback');
            return this.getFallbackQueries(variable);

        } catch (error) {
            console.error('[Agent] ❌ Query generation failed:', error);
            return this.getFallbackQueries(variable);
        }
    }

    /**
     * Fallback queries if LLM fails
     */
    private getFallbackQueries(variable: Variable): string[] {
        return [
            `${variable.name} news today`,
            `${variable.name} latest developments`,
            `${variable.name} ${variable.category} updates`
        ];
    }

    /**
     * Deduplicate search results by URL
     */
    private deduplicateResults(results: SerperSearchResult[]): SerperSearchResult[] {
        const seen = new Set<string>();
        return results.filter(result => {
            if (seen.has(result.link)) return false;
            seen.add(result.link);
            return true;
        });
    }

    /**
     * Analyze search results and extract events
     * Process top 10 results to save time/tokens
     */
    private async analyzeResults(
        results: SerperSearchResult[],
        variable: Variable
    ): Promise<DiscoveredEvent[]> {
        const topResults = results.slice(0, 10);
        const events: DiscoveredEvent[] = [];

        for (const result of topResults) {
            try {
                const event = await this.extractEvent(result, variable);
                if (event && event.impact_score >= 20) {  // Filter low-impact
                    events.push(event);
                }
            } catch (error) {
                console.error(`[Agent] ❌ Failed to analyze: ${result.title.substring(0, 50)}...`, error);
            }
        }

        return events;
    }

    /**
     * Extract single event from search result using LLM
     * 
     * Returns null if:
     * - Not relevant
     * - Impact score < 20
     * - LLM fails to respond
     */
    private async extractEvent(
        result: SerperSearchResult,
        variable: Variable
    ): Promise<DiscoveredEvent | null> {
        const systemPrompt = `Analyze this news article and determine its impact on "${variable.name}".`;

        const userPrompt = `Article:
Title: ${result.title}
Snippet: ${result.snippet}
URL: ${result.link}
${result.date ? `Published: ${result.date}` : ''}

Variable Context:
- Name: ${variable.name}
- Category: ${variable.category}
${variable.description ? `- Description: ${variable.description}` : ''}

Task: Assess if this article has SIGNIFICANT impact on "${variable.name}".

Output JSON ONLY (no preamble):
{
  "is_relevant": true/false,
  "summary": "One clear sentence describing the event",
  "impact_score": 0-100 (how much this affects the variable),
  "confidence": 0.0-1.0 (your confidence in this assessment),
  "reasoning": "Explain why you gave this score",
  "keywords_found": ["keyword1", "keyword2", ...]
}`;

        try {
            const response = await this.hf.chatCompletion({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 300,
                temperature: 0.2
            });

            // Parse JSON response
            const text = response.choices[0].message.content || '{}';
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                console.warn('[Agent] ⚠️  No JSON in LLM response');
                return null;
            }

            const analysis = JSON.parse(jsonMatch[0]);

            // Validation: must be relevant and impactful
            if (!analysis.is_relevant || analysis.impact_score < 20) {
                return null;
            }

            // Create dedup hash
            const snapshot_id = crypto
                .createHash('sha256')
                .update(result.link + result.title)
                .digest('hex');

            return {
                summary: analysis.summary,
                impact_score: Math.min(100, Math.max(0, analysis.impact_score)),
                confidence: Math.min(1, Math.max(0, analysis.confidence)),
                reasoning: analysis.reasoning,
                keywords_found: analysis.keywords_found || [],
                sources: [result.link],
                snapshot_id
            };

        } catch (error) {
            console.error('[Agent] ❌ Event extraction failed:', error);
            return null;
        }
    }
}
