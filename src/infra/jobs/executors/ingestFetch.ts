/**
 * Example Job Executor - Ingest Fetch
 * 
 * Fetches content from a URL and creates a snapshot.
 * This is a placeholder implementation for demonstration.
 */

import crypto from 'crypto';
import type { JobExecutor } from './index';

export class IngestFetchExecutor implements JobExecutor {
    async execute(payload: any): Promise<any> {
        const { url } = payload;

        if (!url) {
            throw new Error('URL is required in payload');
        }

        // Fetch content
        console.log(`Fetching URL: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const timestamp = new Date().toISOString();

        // Generate snapshot_id: sha256(url + "|" + timestamp)
        const snapshot_id = crypto
            .createHash('sha256')
            .update(`${url}|${timestamp}`)
            .digest('hex');

        // In production, would upload to object storage here
        // await uploadToObjectStorage(snapshot_id, html);

        return {
            snapshot_id,
            url,
            timestamp,
            size_bytes: html.length,
            content_type: response.headers.get('content-type'),
        };
    }
}

/**
 * Default export
 */
export default IngestFetchExecutor;
