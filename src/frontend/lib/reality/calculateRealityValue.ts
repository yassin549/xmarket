/**
 * Reality Engine - Reality Value Calculator
 * 
 * Core logic for updating reality chart values based on scraped data and LLM analysis.
 * This is the heart of the reality engine.
 */

import { query } from '../infra/db/pool';
import { scrapeMultipleSources, type ScrapedContent } from './scraper';
import { analyzeMultipleSources, type ImpactAnalysis } from './llmAnalyzer';

interface Variable {
    variable_id: string;
    symbol: string;
    name: string;
    description: string;
    reality_sources: string[];
    impact_keywords: string[];
    llm_context?: string;
    reality_value: number | null;
    market_value: number | null;
    initial_value: number;
}

interface RealityUpdateResult {
    variableId: string;
    symbol: string;
    oldValue: number;
    newValue: number;
    change: number;
    changePercent: number;
    sourcesScraped: number;
    sourcesAnalyzed: number;
    aggregatedImpact: number;
    confidence: number;
    timestamp: Date;
}

/**
 * Update reality value for a single variable
 */
export async function updateRealityValue(
    variableId: string
): Promise<RealityUpdateResult> {
    console.log(`[Reality Engine] Updating ${variableId}...`);

    // 1. Get variable configuration
    const variable = await getVariable(variableId);

    if (!variable) {
        throw new Error(`Variable ${variableId} not found`);
    }

    if (!variable.reality_sources || variable.reality_sources.length === 0) {
        throw new Error(`Variable ${variable.symbol} has no reality sources configured`);
    }

    console.log(`[Reality Engine] Scraping ${variable.reality_sources.length} sources for ${variable.symbol}...`);

    // 2. Scrape all configured sources
    const scrapedData = await scrapeMultipleSources(variable.reality_sources);

    const successfulScrapes = scrapedData.filter(s => s.success);
    console.log(`[Reality Engine] Successfully scraped ${successfulScrapes.length}/${scrapedData.length} sources`);

    if (successfulScrapes.length === 0) {
        throw new Error(`Failed to scrape any sources for ${variable.symbol}`);
    }

    // 3. Save scraped data to database (for later analysis/audit)
    await saveScrapedData(variable.variable_id, scrapedData);

    // 4. Analyze impact with LLM
    console.log(`[Reality Engine] Analyzing impact with LLM...`);

    const { analyses, aggregatedScore, aggregatedConfidence } = await analyzeMultipleSources(
        successfulScrapes.map(s => ({ url: s.url, content: s.content })),
        variable.name,
        variable.description || '',
        variable.impact_keywords || [],
        variable.llm_context
    );

    console.log(`[Reality Engine] Aggregated Impact: ${aggregatedScore.toFixed(2)}, Confidence: ${aggregatedConfidence.toFixed(2)}`);

    // 5. Save LLM analysis results
    await saveLLMAnalyses(variable.variable_id, analyses, scrapedData);

    // 6. Calculate new reality value
    const currentValue = variable.reality_value || variable.initial_value;
    const newValue = calculateNewValue(currentValue, aggregatedScore);

    console.log(`[Reality Engine] Value change: ${currentValue.toFixed(2)} → ${newValue.toFixed(2)}`);

    // 7. Calculate trading value (blended)
    const marketValue = variable.market_value || variable.initial_value; // Fallback to initial if no market value
    const tradingValue = (newValue + marketValue) / 2;

    // 8. Update variable in database
    await updateVariableRealityValue(variable.variable_id, newValue, tradingValue);

    // 9. Save history snapshot
    await saveHistorySnapshot(variable.variable_id, newValue, marketValue, tradingValue);

    // 10. Return result
    const change = newValue - currentValue;
    const changePercent = (change / currentValue) * 100;

    return {
        variableId: variable.variable_id,
        symbol: variable.symbol,
        oldValue: currentValue,
        newValue,
        change,
        changePercent,
        sourcesScraped: scrapedData.length,
        sourcesAnalyzed: successfulScrapes.length,
        aggregatedImpact: aggregatedScore,
        confidence: aggregatedConfidence,
        timestamp: new Date()
    };
}

/**
 * Calculate new value based on current value and impact score
 * 
 * Formula: newValue = currentValue * (1 + impactScore / 100)
 */
function calculateNewValue(currentValue: number, impactScore: number): number {
    const multiplier = 1 + (impactScore / 100);
    const newValue = currentValue * multiplier;

    // Ensure value stays positive
    return Math.max(newValue, 0.01);
}

/**
 * Get variable from database
 */
async function getVariable(variableId: string): Promise<Variable | null> {
    const result = await query<Variable>(
        `SELECT 
      variable_id,
      symbol,
      name,
      description,
      reality_sources,
      impact_keywords,
      llm_context,
      reality_value,
      market_value,
      initial_value
    FROM variables
    WHERE variable_id = $1 AND status = 'active' AND is_tradeable = true`,
        [variableId]
    );

    return result.rows[0] || null;
}

/**
 * Save scraped data to database
 */
async function saveScrapedData(
    variableId: string,
    scrapedData: ScrapedContent[]
): Promise<void> {
    for (const data of scrapedData) {
        await query(
            `INSERT INTO reality_data (
        variable_id,
        source_url,
        scraped_at,
        raw_content,
        content_hash,
        content_length,
        processing_status,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                variableId,
                data.url,
                data.scrapedAt,
                data.content,
                data.contentHash,
                data.contentLength,
                data.success ? 'pending' : 'failed',
                data.error || null
            ]
        );
    }
}

/**
 * Save LLM analysis results to database
 */
async function saveLLMAnalyses(
    variableId: string,
    analyses: Array<ImpactAnalysis & { url: string }>,
    scrapedData: ScrapedContent[]
): Promise<void> {
    for (const analysis of analyses) {
        // Find corresponding scraped data
        const scraped = scrapedData.find(s => s.url === analysis.url);
        if (!scraped) continue;

        await query(
            `UPDATE reality_data
      SET 
        llm_summary = $1,
        impact_score = $2,
        confidence = $3,
        llm_model = $4,
        processing_status = 'completed',
        processed_at = NOW()
      WHERE variable_id = $5 
        AND source_url = $6 
        AND content_hash = $7`,
            [
                analysis.summary,
                analysis.impactScore,
                analysis.confidence,
                'mistralai/Mistral-7B-Instruct-v0.2',
                variableId,
                analysis.url,
                scraped.contentHash
            ]
        );
    }
}

/**
 * Update variable's reality value in database
 */
async function updateVariableRealityValue(
    variableId: string,
    newValue: number,
    tradingValue: number
): Promise<void> {
    await query(
        `UPDATE variables
    SET 
      reality_value = $1,
      trading_value = $2,
      last_reality_update = NOW(),
      updated_at = NOW()
    WHERE variable_id = $3`,
        [newValue, tradingValue, variableId]
    );
}

/**
 * Save history snapshot for charts
 */
async function saveHistorySnapshot(
    variableId: string,
    realityValue: number,
    marketValue: number,
    tradingValue: number
): Promise<void> {
    await query(
        `INSERT INTO historical_values (
            variable_id,
            reality_value,
            market_value,
            trading_value,
            snapshot_type
        ) VALUES ($1, $2, $3, $4, 'scheduled')`,
        [variableId, realityValue, marketValue, tradingValue]
    );
}

/**
 * Update all active variables (called by cron)
 * Uses concurrency limit to avoid overwhelming resources
 */
export async function updateAllVariables(): Promise<RealityUpdateResult[]> {
    console.log('[Reality Engine] Starting update for all variables...');

    // Get all active tradeable variables
    const result = await query<{ variable_id: string; symbol: string }>(
        `SELECT variable_id, symbol
    FROM variables
    WHERE status = 'active' AND is_tradeable = true
    ORDER BY last_reality_update ASC NULLS FIRST`
    );

    const variables = result.rows;
    console.log(`[Reality Engine] Found ${variables.length} variables to update`);

    const CONCURRENCY_LIMIT = 5;

    // Helper for concurrency control
    const runWithLimit = async <T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> => {
        const results: T[] = [];
        const executing: Promise<void>[] = [];

        for (const task of tasks) {
            const p = task().then(result => {
                results.push(result);
            });

            executing.push(p);

            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }

        await Promise.all(executing);
        return results;
    };

    // Create safe tasks that won't crash the batch
    const safeTasks = variables.map(variable => async () => {
        try {
            return await updateRealityValue(variable.variable_id);
        } catch (error) {
            console.error(`[Reality Engine] Failed to update ${variable.symbol}:`, error);
            return null;
        }
    });

    // Execute with concurrency limit
    const rawResults = await runWithLimit(safeTasks, CONCURRENCY_LIMIT);

    // Filter out failures
    const successfulResults = rawResults.filter((r): r is RealityUpdateResult => r !== null);

    console.log(`[Reality Engine] Completed update for ${successfulResults.length}/${variables.length} variables`);

    return successfulResults;
}
