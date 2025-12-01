/**
 * Impact Scorer - Production Grade LLM-Only Processing
 * 
 * Calculates the Reality Score (0-100) for real-world variables using LLM analysis.
 * NO HEURISTICS. NO FALLBACKS. LLM ONLY.
 */

import { HfInference } from '@huggingface/inference';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';

export interface ImpactResult {
    score: number;          // 0-100
    confidence: number;     // 0-1
    reasoning: string;
    keywords_found: string[];
    summary: string;
}

interface LLMAnalysis {
    impactScore: number;
    confidence: number;
    reasoning: string;
    keywords_found: string[];
    summary: string;
}

/**
 * Calculate impact score using LLM with retry logic
 */
export async function calculateImpactScore(
    content: string,
    variableName: string,
    variableDescription: string
): Promise<ImpactResult> {

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const result = await assessImpactWithLLM(
                content,
                variableName,
                variableDescription
            );

            // Validate LLM output
            validateLLMOutput(result);

            return {
                score: result.impactScore,
                confidence: result.confidence,
                reasoning: result.reasoning,
                keywords_found: result.keywords_found,
                summary: result.summary
            };

        } catch (error) {
            console.error(`[ImpactScorer] Attempt ${attempt + 1} failed:`, error);

            if (attempt < MAX_RETRIES - 1) {
                await sleep(RETRY_DELAY_MS * (attempt + 1));  // Exponential backoff
            } else {
                // Final failure - throw to mark for manual review
                throw new Error(`LLM scoring failed after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }

    // TypeScript requires a return, but we'll never reach here due to throw
    throw new Error('Unexpected code path');
}

/**
 * Call LLM for impact assessment
 */
async function assessImpactWithLLM(
    content: string,
    variableName: string,
    variableDescription: string
): Promise<LLMAnalysis> {

    const prompt = buildStructuredPrompt(content, variableName, variableDescription);

    const response = await hf.textGeneration({
        model: DEFAULT_MODEL,
        inputs: prompt,
        parameters: {
            max_new_tokens: 1000,
            temperature: 0.2,  // Very low for consistency
            top_p: 0.95,
            return_full_text: false,
            repetition_penalty: 1.1,
            stop: ['</analysis>']
        }
    });

    return parseAndValidateLLMResponse(response.generated_text);
}

/**
 * Build structured prompt for LLM
 */
function buildStructuredPrompt(
    content: string,
    variableName: string,
    variableDescription: string
): string {
    return `<s>[INST] You are a financial analyst for Xmarket, a Real-World Asset Exchange.
Your task is to analyze content and determine its impact on a tradeable variable.

IMPORTANT RULES:
1. Output MUST be valid JSON (no explanations before/after)
2. Score MUST be between 0-100 (absolute value, no negatives)
3. Confidence MUST be between 0.0-1.0
4. Reasoning MUST be 2-3 sentences explaining the score

VARIABLE BEING ANALYZED:
Name: "${variableName}"
Description: ${variableDescription}

CONTENT TO ANALYZE:
${content.substring(0, 6000)}${content.length > 6000 ? '...(truncated)' : ''}

SCORING SCALE:
- 0-20: Very Low (minimal/no relevance or impact)
- 21-40: Low (slight relevance, minor impact)
- 41-60: Medium (moderate relevance and impact)
- 61-80: High (strong relevance, significant impact)
- 81-100: Very High (extremely relevant, major impact)

CONFIDENCE SCALE:
- 0.0-0.3: Low confidence (ambiguous, unclear)
- 0.4-0.6: Medium confidence (some clarity)
- 0.7-0.9: High confidence (clear signals)
- 0.9-1.0: Very high confidence (unambiguous)

OUTPUT FORMAT (JSON ONLY):
{
  "impactScore": 0,
  "confidence": 0.0,
  "reasoning": "Brief explanation of the score",
  "keywords_found": ["keyword1", "keyword2"],
  "summary": "One-sentence summary of the content's relevance"
}
[/INST]

<analysis>
`;
}

/**
 * Parse and validate LLM response with strict checks
 */
function parseAndValidateLLMResponse(text: string): LLMAnalysis {
    // Extract JSON
    let jsonText = text.trim()
        .replace(/```json\s*/g, '')
        .replace(/```\s*$/g, '')
        .replace(/<\/analysis>.*$/s, '');

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No valid JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Strict validation
    if (typeof parsed.impactScore !== 'number' ||
        parsed.impactScore < 0 ||
        parsed.impactScore > 100) {
        throw new Error(`Invalid impactScore: ${parsed.impactScore} (must be 0-100)`);
    }

    if (typeof parsed.confidence !== 'number' ||
        parsed.confidence < 0 ||
        parsed.confidence > 1) {
        throw new Error(`Invalid confidence: ${parsed.confidence} (must be 0-1)`);
    }

    if (!parsed.reasoning || parsed.reasoning.length < 10) {
        throw new Error('Reasoning is too short or missing (min 10 chars)');
    }

    return {
        impactScore: parsed.impactScore,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        keywords_found: Array.isArray(parsed.keywords_found) ? parsed.keywords_found : [],
        summary: parsed.summary || 'No summary provided'
    };
}

/**
 * Validate LLM output structure (additional layer)
 */
function validateLLMOutput(result: LLMAnalysis): void {
    if (result.impactScore < 0 || result.impactScore > 100) {
        throw new Error(`Score out of range: ${result.impactScore}`);
    }

    if (result.confidence < 0 || result.confidence > 1) {
        throw new Error(`Confidence out of range: ${result.confidence}`);
    }

    if (!result.reasoning || result.reasoning.length < 10) {
        throw new Error('Invalid reasoning');
    }
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
