/**
 * Finalizer Worker
 * 
 * Polls for approved candidate events and finalizes them into Markets.
 * Creates Market + Event records and triggers AMM for liquidity seeding.
 */

import { query, getClient } from '../../infra/db/pool';
import { seedMarket } from '../market_maker/amm';

interface CandidateEvent {
    candidate_id: string;
    snapshot_id: string;
    summary: string;
    confidence: number;
    variable_name: string;
    variable_description: string;
    impact_score: number;
    llm_reasoning: string;
    metadata: any;
}

const POLL_INTERVAL = 3000; // 3 seconds

/**
 * Main worker loop
 */
export async function runFinalizer() {
    console.log('🏁 [Finalizer] Starting worker...');

    while (true) {
        try {
            const events = await query<CandidateEvent>(`
                SELECT * FROM candidate_events 
                WHERE status = 'approved' 
                ORDER BY created_at ASC
                LIMIT 5
            `);

            if (events.rows.length > 0) {
                console.log(`[Finalizer] Processing ${events.rows.length} approved events`);

                for (const event of events.rows) {
                    try {
                        await finalizeEvent(event);
                    } catch (error) {
                        console.error(`[Finalizer] Failed to finalize event ${event.candidate_id}:`, error);
                        // Mark as failed but continue with others
                        await query(`
                            UPDATE candidate_events 
                            SET status = 'finalization_failed',
                                metadata = jsonb_set(metadata, '{finalization_error}', $1)
                            WHERE candidate_id = $2
                        `, [JSON.stringify(error instanceof Error ? error.message : 'Unknown error'), event.candidate_id]);
                    }
                }
            }

            await sleep(POLL_INTERVAL);
        } catch (error) {
            console.error('[Finalizer] Worker error:', error);
            await sleep(POLL_INTERVAL * 2);
        }
    }
}

/**
 * Finalize a single candidate event into a market
 */
async function finalizeEvent(candidate: CandidateEvent) {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // 1. Create Market with proper symbol
        const symbol = generateSymbol(candidate.variable_name);
        const marketResult = await client.query(`
            INSERT INTO markets (symbol, title, type, created_by, metadata)
            VALUES ($1, $2, 'real_world_index', 'system', $3)
            RETURNING market_id
        `, [
            symbol,
            candidate.variable_name,
            JSON.stringify({
                initial_impact_score: candidate.impact_score,
                variable_description: candidate.variable_description
            })
        ]);

        const marketId = marketResult.rows[0].market_id;

        // 2. Create Event record
        await client.query(`
            INSERT INTO events (market_id, summary, confidence, snapshot_ids, metadata)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            marketId,
            candidate.summary,
            candidate.confidence,
            [candidate.snapshot_id],
            {
                llm_reasoning: candidate.llm_reasoning,
                impact_score: candidate.impact_score
            }
        ]);

        // 3. Mark candidate as processed
        await client.query(`
            UPDATE candidate_events 
            SET status = 'processed', 
                processed_at = NOW(),
                market_id = $2
            WHERE candidate_id = $1
        `, [candidate.candidate_id, marketId]);

        await client.query('COMMIT');

        console.log(`[Finalizer] ✅ Created market ${symbol} (${marketId}) for candidate ${candidate.candidate_id}`);

        // 4. Seed Market with AMM (outside transaction to avoid blocking)
        try {
            await seedMarket(marketId, symbol, candidate.impact_score);
        } catch (ammError) {
            console.error(`[Finalizer] AMM seeding failed for ${marketId}:`, ammError);
            // Don't rollback - market is created, AMM can be retried
        }

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Generate trading symbol from variable name
 */
function generateSymbol(variableName: string): string {
    // Convert to uppercase, remove special chars, max 8 chars
    return variableName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 8) || 'UNKNOWN';
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start worker if run directly
if (require.main === module) {
    runFinalizer().catch(error => {
        console.error('Fatal finalizer error:', error);
        process.exit(1);
    });
}

export default runFinalizer;
