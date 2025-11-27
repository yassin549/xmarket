/**
 * Ingest Fetch Executor (Updated)
 * 
 * Fetches content from a URL using the Playwright runner service
 * and creates a snapshot with deterministic ID.
 */

import type { JobExecutor } from './index';

export class IngestFetchExecutor implements JobExecutor {
    private playwrightRunnerUrl: string;

    constructor() {
        this.playwrightRunnerUrl = process.env.PLAYWRIGHT_RUNNER_URL || 'http://localhost:3001';
    }

    async execute(payload: any): Promise<any> {
        const { url, metadata = {}, max_size = 10 * 1024 * 1024 } = payload;

        if (!url) {
            throw new Error('URL is required in payload');
        }

        console.log(`Calling Playwright runner for: ${url}`);

        // Call Playwright runner service
        const response = await fetch(`${this.playwrightRunnerUrl}/fetch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                idempotency_key: payload.idempotency_key || Math.random().toString(36),
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
            throw new Error(`Playwright runner failed: ${error.error || response.statusText}`);
        }

        const result = await response.json() as {
            snapshot_id: string;
            metadata: {
                title: string;
                url: string;
                final_url: string;
                status_code: number;
                fetched_at: string;
            };
        };

        // CHAINING: Create a 'process_snapshot' job to analyze this new snapshot
        if (result.snapshot_id) {
            try {
                // We use the same db pool from the module context if available.
                // Since we are in an executor, we can import the db pool.
                const db = require('../../db/pool').default;

                await db.query(
                    `INSERT INTO jobs (type, payload, idempotency_key)
           VALUES ($1, $2, $3)`,
                    [
                        'process_snapshot',
                        JSON.stringify({
                            snapshot_id: result.snapshot_id,
                            url: result.metadata.final_url || url,
                            title: result.metadata.title,
                            ingest_id: payload.idempotency_key // Track lineage
                        }),
                        `process-${result.snapshot_id}` // Idempotent per snapshot
                    ]
                );
                console.log(`Chained process_snapshot job for ${result.snapshot_id}`);
            } catch (chainError) {
                console.error('Failed to chain process_snapshot job:', chainError);
            }
        }

        // Result contains: { snapshot_id, metadata: { title, url, final_url, status_code, fetched_at } }
        return {
            snapshot_id: result.snapshot_id,
            url,
            final_url: result.metadata.final_url,
            title: result.metadata.title,
            status_code: result.metadata.status_code,
            fetched_at: result.metadata.fetched_at,
            metadata: result.metadata,
        };
    }
}

/**
 * Default export
 */
export default IngestFetchExecutor;
