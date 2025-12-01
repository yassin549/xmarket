/**
 * Process Snapshot Executor
 * 
 * Core Reality Engine logic:
 * 1. Fetch snapshot content from Blob storage
 * 2. Generate embeddings via Batcher
 * 3. Extract event data via LLM
 * 4. Store as candidate_event
 */

import { JobExecutor } from '../../infra/jobs/executors';
import { query } from '../../infra/db/pool';
import { EmbeddingBatcher } from '../embeddings/batcher';
import { HuggingFaceClient } from '../../infra/llm/hf_client';
import crypto from 'crypto';

export class ProcessSnapshotExecutor implements JobExecutor {
    private batcher: EmbeddingBatcher;
    private hfClient: HuggingFaceClient;

    constructor() {
        this.batcher = new EmbeddingBatcher();
        this.hfClient = new HuggingFaceClient();

        // Runtime check for query function
        if (!query) {
            console.error('FATAL: query is undefined in ProcessSnapshotExecutor');
            try {
                const poolModule = require('../../infra/db/pool');
                console.error('Pool Module keys:', Object.keys(poolModule));
            } catch (e) {
                console.error('Failed to require pool module:', e);
            }
        }
    }

    async execute(payload: any): Promise<any> {
        console.log('ProcessSnapshotExecutor.execute called');
        console.log('Query function type:', typeof query);

        const { snapshot_id, url, title } = payload;

        if (!snapshot_id) {
            throw new Error('snapshot_id is required');
        }

        console.log(`Processing snapshot: ${snapshot_id} (${url})`);

        // 1. Fetch Snapshot Metadata & Content Path
        const snapshotResult = await query(
            `SELECT object_store_path FROM snapshots WHERE snapshot_id = $1`,
            [snapshot_id]
        );

        if (snapshotResult.rows.length === 0) {
            throw new Error(`Snapshot not found: ${snapshot_id}`);
        }

        const objectStorePath = snapshotResult.rows[0].object_store_path;

        // In a real implementation, we would fetch the HTML content from Blob storage here.
        // For this phase, we'll simulate it or use the title/metadata as the "content" 
        // to avoid extra network calls if we don't have the blob read token handy/mocked.
        const contentText = `Title: ${title}\nURL: ${url}`;

        // 2. Generate Embeddings (Async Batch)
        console.log('Batcher:', this.batcher);
        console.log('Batcher.initialize:', this.batcher?.initialize);
        await this.batcher.initialize();
        await this.batcher.enqueue({
            text: contentText,
            metadata: {
                ingest_id: payload.ingest_id || 'unknown',
                snapshot_id,
                url,
                fetched_at: new Date().toISOString()
            }
        });

        // 3. Extract Event via LLM
        let extraction;
        try {
            extraction = await this.hfClient.generateStructured(
                `Extract the main event from this content:\n\n${contentText}`,
                [snapshot_id]
            );
        } catch (error) {
            console.error('LLM Extraction failed:', error);
            return { status: 'extraction_failed', error: String(error) };
        }


        // 4. Calculate Impact Score (LLM-based)
        let impactScore = 0;
        let impactConfidence = 0;
        let llmReasoning = '';
        let status = 'pending';  // Default status

        try {
            // Import scorer dynamically to avoid circular deps
            const { calculateImpactScore } = await import('../scorers/impact_scorer');

            const scoreResult = await calculateImpactScore(
                contentText,
                title || 'Unknown Variable',
                url  // Use URL as description for now
            );

            impactScore = scoreResult.score;
            impactConfidence = scoreResult.confidence;
            llmReasoning = scoreResult.reasoning;

            // Auto-approval logic
            const APPROVAL_CRITERIA = {
                MIN_SCORE: Number(process.env.APPROVAL_MIN_SCORE) || 65,
                MIN_CONFIDENCE: Number(process.env.APPROVAL_MIN_CONFIDENCE) || 0.80
            };

            if (impactScore >= APPROVAL_CRITERIA.MIN_SCORE &&
                impactConfidence >= APPROVAL_CRITERIA.MIN_CONFIDENCE) {
                status = 'approved';
                console.log(`Auto-approved: score=${impactScore}, confidence=${impactConfidence}`);
            } else {
                status = 'pending';
                console.log(`Pending review: score=${impactScore}, confidence=${impactConfidence}`);
            }

        } catch (scoringError) {
            console.error('Impact scoring failed:', scoringError);
            status = 'failed';
            llmReasoning = scoringError instanceof Error ? scoringError.message : 'Scoring failed';
        }

        // 5. Dedupe & Persist Candidate Event
        const dedupeHash = crypto
            .createHash('sha256')
            .update(extraction.summary + snapshot_id)
            .digest('hex');

        // Check if already exists
        const existing = await query(
            `SELECT candidate_id FROM candidate_events WHERE dedupe_hash = $1`,
            [dedupeHash]
        );

        if (existing.rows.length > 0) {
            console.log(`Duplicate candidate event skipped: ${dedupeHash}`);
            return { status: 'skipped_duplicate', candidate_id: existing.rows[0].candidate_id };
        }

        // Insert with all calculated data
        const insertResult = await query(
            `INSERT INTO candidate_events 
       (snapshot_id, summary, confidence, metadata, dedupe_hash, status, impact_score, llm_reasoning, variable_name, variable_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING candidate_id`,
            [
                snapshot_id,
                extraction.summary,
                extraction.confidence,
                JSON.stringify({
                    sources: extraction.sources,
                    llm_version: extraction.schema_version,
                    impact_confidence: impactConfidence
                }),
                dedupeHash,
                status,
                impactScore,
                llmReasoning,
                title || 'Unknown Variable',
                url
            ]
        );

        const candidateId = insertResult.rows[0].candidate_id;
        console.log(`Created candidate event: ${candidateId} [${status}]`);

        return {
            status: 'success',
            candidate_id: candidateId,
            summary: extraction.summary,
            impact_score: impactScore,
            auto_approved: status === 'approved'
        };
    }
}

export default ProcessSnapshotExecutor;
