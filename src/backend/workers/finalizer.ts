/**
 * Finalizer Worker
 * 
 * Promotes APPROVED candidate_events to final events.
 * This is the last step in the pipeline, ensuring human-in-the-loop (or auto-approval)
 * has occurred before an event affects the market.
 */

import db from '../../infra/db/pool';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

const POLL_INTERVAL_MS = 5000;

async function runFinalizer() {
    console.log('🚀 Starting Finalizer Worker...');

    while (true) {
        try {
            // 1. Find APPROVED candidates that haven't been processed
            // We look for status='approved' (set by Admin/Human)
            // And we ensure we haven't already created an event for it (though status update should handle this)

            const result = await db.query(
                `SELECT * FROM candidate_events 
         WHERE status = 'approved' 
         ORDER BY created_at ASC 
         LIMIT 10 
         FOR UPDATE SKIP LOCKED`
            );

            if (result.rows.length === 0) {
                // Sleep and retry
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
                continue;
            }

            console.log(`Found ${result.rows.length} approved candidates to finalize`);

            for (const candidate of result.rows) {
                await finalizeEvent(candidate);
            }

        } catch (error) {
            console.error('Finalizer loop error:', error);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }
}

async function finalizeEvent(candidate: any) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        console.log(`Finalizing candidate: ${candidate.candidate_id}`);

        // 1. Create Final Event
        // We need a market_id. For now, we'll assign to a default "General" market 
        // or try to infer from metadata. 
        // In a real system, the approval process would link it to a market.
        // We'll check if metadata has market_id, else use a placeholder/generic one if exists,
        // or create a new market if needed (auto-market creation is advanced).
        // For Phase 6, let's assume we have a "General News" market or similar.

        // Hack: Get ANY market for now to satisfy FK, or specific one.
        // Ideally: const marketId = candidate.metadata.market_id;
        let marketId = candidate.metadata?.market_id;

        if (!marketId) {
            // Fallback: Find the first active market
            const marketRes = await client.query(`SELECT market_id FROM markets LIMIT 1`);
            if (marketRes.rows.length > 0) {
                marketId = marketRes.rows[0].market_id;
            } else {
                throw new Error('No markets available to link event to');
            }
        }

        const eventRes = await client.query(
            `INSERT INTO events 
       (market_id, summary, confidence, snapshot_ids, metadata, event_type)
       VALUES ($1, $2, $3, $4, $5, 'news')
       RETURNING event_id`,
            [
                marketId,
                candidate.summary,
                candidate.confidence,
                [candidate.snapshot_id], // Array
                candidate.metadata
            ]
        );

        const eventId = eventRes.rows[0].event_id;

        // 2. Create Audit Event (System Action)
        await client.query(
            `INSERT INTO audit_event 
       (action, actor_type, payload_hash, metadata)
       VALUES ($1, 'system', $2, $3)`,
            [
                'finalize_event',
                // Simple hash of event ID
                require('crypto').createHash('sha256').update(eventId).digest('hex'),
                JSON.stringify({ candidate_id: candidate.candidate_id, event_id: eventId })
            ]
        );

        // 3. Update Candidate Status
        await client.query(
            `UPDATE candidate_events 
       SET status = 'processed', updated_at = NOW() 
       WHERE candidate_id = $1`,
            [candidate.candidate_id]
        );

        await client.query('COMMIT');
        console.log(`✅ Finalized event ${eventId} from candidate ${candidate.candidate_id}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed to finalize candidate ${candidate.candidate_id}:`, error);
        // Optionally set status to 'error' or leave for retry
    } finally {
        client.release();
    }
}

if (require.main === module) {
    runFinalizer().catch(console.error);
}

export default runFinalizer;
