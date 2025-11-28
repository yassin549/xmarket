/**
 * Reality Engine - LLM Analyzer
 * 
 * Uses Hugging Face Inference API to analyze scraped content
 * and assess impact on real-world variables.
 */

import { HfInference } from '@huggingface/inference';

// Initialize Hugging Face client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Default model (free tier on Hugging Face)
// Mistral-7B-Instruct-v0.2: Fast inference, excellent instruction following, reliable JSON output
const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';

export interface ImpactAnalysis {
    summary: string;
    impactScore: number;    // -100 to +100
    confidence: number;     // 0 to 1
    reasoning: string;      // LLM's explanation
    keywords_found: string[]; // Which keywords were detected
}

/**
 * Assess impact of content on a variable using LLM
 */
export async function assessImpact(
    content: string,
    variableName: string,
    variableDescription: string,
    keywords: string[],
    llmContext?: string
): Promise<ImpactAnalysis> {
    const prompt = buildPrompt(
        content,
        variableName,
        variableDescription,
        keywords,
        llmContext
    );

    try {
        const response = await hf.textGeneration({
            model: DEFAULT_MODEL,
            inputs: prompt,
            parameters: {
                max_new_tokens: 800,
                temperature: 0.3,  // Lower temperature for more consistent analysis
                top_p: 0.9,
                return_full_text: false,
                stop: ['</analysis>'] // Stop at end marker
            }
        });

        // Parse JSON response
        const result = parseLLMResponse(response.generated_text);

        return result;

    } catch (error) {
        console.error('LLM analysis failed:', error);

        // Return neutral analysis on error
        return {
            summary: 'Analysis failed',
            impactScore: 0,
            confidence: 0,
            reasoning: error instanceof Error ? error.message : 'Unknown error',
            keywords_found: []
        };
    }
}

/**
 * Build the LLM prompt for impact analysis
 */
function buildPrompt(
    content: string,
    variableName: string,
    variableDescription: string,
    keywords: string[],
    llmContext?: string
): string {
    return `<s>[INST] You are an expert analyst evaluating the impact of real-world information on tradable variables.

VARIABLE: "${variableName}"
DESCRIPTION: ${variableDescription}

${llmContext ? `CONTEXT: ${llmContext}\n` : ''}

KEYWORDS TO FOCUS ON: ${keywords.join(', ')}

CONTENT TO ANALYZE:
${content.substring(0, 5000)} ${content.length > 5000 ? '...(truncated)' : ''}

TASK:
1. Analyze the content for relevance to "${variableName}"
2. Identify which keywords appear and their context
3. Determine the impact: positive (+) or negative (-)
4. Rate the impact strength from -100 (extremely negative) to +100 (extremely positive)
5. Assess your confidence from 0.0 (uncertain) to 1.0 (highly confident)
6. Provide a brief summary and reasoning

RATING SCALE:
- +100: Extremely positive impact (major breakthrough, huge success)
- +50: Moderately positive (good news, progress)
- 0: Neutral (no significant impact, or mixed signals)
- -50: Moderately negative (concerning news, setback)
- -100: Extremely negative (catastrophic failure, major crisis)

RESPOND ONLY IN THIS JSON FORMAT (no additional text):
{
  "summary": "One sentence summary of findings",
  "impactScore": 0,
  "confidence": 0.0,
  "reasoning": "Explanation of why this score was assigned",
  "keywords_found": ["keyword1", "keyword2"]
}
[/INST]

<analysis>
`;
}

/**
 * Parse LLM response and extract structured data
 */
function parseLLMResponse(text: string): ImpactAnalysis {
    try {
        // Extract JSON from response (handle markdown code blocks if present)
        let jsonText = text.trim();

        // Remove markdown code blocks if present
        jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

        // Remove </analysis> tag if present
        jsonText = jsonText.replace(/<\/analysis>.*$/s, '');

        // Find JSON object
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and clamp values
        return {
            summary: String(parsed.summary || 'No summary provided'),
            impactScore: clamp(Number(parsed.impactScore || 0), -100, 100),
            confidence: clamp(Number(parsed.confidence || 0), 0, 1),
            reasoning: String(parsed.reasoning || 'No reasoning provided'),
            keywords_found: Array.isArray(parsed.keywords_found) ? parsed.keywords_found : []
        };

    } catch (error) {
        console.error('Failed to parse LLM response:', error);
        console.error('Response text:', text);

        return {
            summary: 'Failed to parse LLM response',
            impactScore: 0,
            confidence: 0,
            reasoning: 'JSON parsing error',
            keywords_found: []
        };
    }
}

/**
 * Clamp a number between min and max
 */
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Analyze multiple content pieces and return weighted average
 */
export async function analyzeMultipleSources(
    contents: Array<{ url: string; content: string }>,
    variableName: string,
    variableDescription: string,
    keywords: string[],
    llmContext?: string
): Promise<{
    analyses: Array<ImpactAnalysis & { url: string }>;
    aggregatedScore: number;
    aggregatedConfidence: number;
}> {
    // Analyze each source
    const analyses = await Promise.all(
        contents.map(async ({ url, content }) => {
            const analysis = await assessImpact(
                content,
                variableName,
                variableDescription,
                keywords,
                llmContext
            );

            return { ...analysis, url };
        })
    );

    // Calculate weighted average (weight by confidence)
    const totalWeight = analyses.reduce((sum, a) => sum + a.confidence, 0);

    if (totalWeight === 0) {
        return {
            analyses,
            aggregatedScore: 0,
            aggregatedConfidence: 0
        };
    }

    const aggregatedScore = analyses.reduce(
        (sum, a) => sum + (a.impactScore * a.confidence),
        0
    ) / totalWeight;

    const aggregatedConfidence = totalWeight / analyses.length;

    return {
        analyses,
        aggregatedScore,
        aggregatedConfidence
    };
}
