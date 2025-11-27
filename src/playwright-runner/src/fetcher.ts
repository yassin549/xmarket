/**
 * Playwright Fetcher
 * 
 * Fetches URLs using headless Chrome and creates immutable snapshots.
 * Integrates with snapshot system and rate limiting.
 */

import { chromium, Browser, Page } from 'playwright';
import { RateLimiter } from './rateLimiter';

// Import snapshot utilities from parent ../infra
import crypto from 'crypto';

interface FetchResult {
    snapshot_id: string;
    metadata: {
        title: string;
        url: string;
        final_url: string;
        status_code: number;
        fetched_at: string;
    };
}

export class PlaywrightFetcher {
    private browser: Browser | null = null;
    private rateLimiter: RateLimiter;
    private concurrency: number;
    private activeFetches = 0;

    constructor(concurrency: number = 4) {
        this.concurrency = concurrency;
        this.rateLimiter = new RateLimiter({
            requestsPerSecond: 1,
            burstSize: 3,
        });
    }

    /**
     * Initialize Playwright browser
     */
    async initialize(): Promise<void> {
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });

        console.log('Playwright browser initialized');
    }

    /**
     * Fetch URL and create snapshot
     */
    async fetch(url: string, idempotency_key: string): Promise<FetchResult> {
        if (!this.browser) {
            throw new Error('Browser not initialized. Call initialize() first.');
        }

        // Check concurrency
        if (this.activeFetches >= this.concurrency) {
            throw new Error(`Concurrency limit reached (${this.concurrency})`);
        }

        this.activeFetches++;

        try {
            // Extract domain for rate limiting
            const domain = new URL(url).hostname;

            // Wait for rate limit
            await this.rateLimiter.acquire(domain);

            // Create page
            const page = await this.browser.newPage();

            try {
                console.log(`Fetching: ${url}`);

                // Navigate to URL
                const response = await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: 30000, // 30 seconds
                });

                if (!response) {
                    throw new Error('No response from page');
                }

                // Get HTML content
                const content = await page.content();
                const fetchedAt = new Date();

                // Generate snapshot_id
                const snapshot_id = this.generateSnapshotId(url, fetchedAt);

                // Store snapshot using Vercel Blob
                await this.storeSnapshot(snapshot_id, content, {
                    url,
                    fetched_at: fetchedAt.toISOString(),
                    content_type: response.headers()['content-type'] || 'text/html',
                    size_bytes: content.length,
                    status_code: response.status(),
                });

                // Extract metadata
                const title = await page.title();
                const finalUrl = page.url(); // After redirects

                return {
                    snapshot_id,
                    metadata: {
                        title,
                        url,
                        final_url: finalUrl,
                        status_code: response.status(),
                        fetched_at: fetchedAt.toISOString(),
                    },
                };
            } finally {
                await page.close();
            }
        } finally {
            this.activeFetches--;
        }
    }

    /**
     * Close browser
     */
    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            console.log('Playwright browser closed');
        }
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            activeFetches: this.activeFetches,
            maxConcurrency: this.concurrency,
        };
    }

    // Helper methods (duplicate from snapshot.ts for standalone service)
    private generateSnapshotId(url: string, fetchedAt: Date): string {
        const timestamp = fetchedAt.toISOString();
        const canonical = `${url}|${timestamp}`;

        return crypto
            .createHash('sha256')
            .update(canonical)
            .digest('hex');
    }

    private async storeSnapshot(
        snapshot_id: string,
        content: string,
        metadata: any
    ): Promise<void> {
        const { put } = await import('@vercel/blob');

        const token = process.env.BLOB_READ_WRITE_TOKEN;

        if (!token) {
            throw new Error('BLOB_READ_WRITE_TOKEN not configured');
        }

        await put(`snapshots/${snapshot_id}.html`, content, {
            access: 'public',
            token,
            addRandomSuffix: false,
            contentType: metadata.content_type || 'text/html',
        });

        console.log('Snapshot stored:', { snapshot_id, size: metadata.size_bytes });
    }
}

export default PlaywrightFetcher;
