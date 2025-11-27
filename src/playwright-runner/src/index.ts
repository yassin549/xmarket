/**
 * Playwright Runner - HTTP API Server
 * 
 * Provides /fetch endpoint for headless browser content fetching.
 * Runs as a separate microservice.
 */

import 'dotenv/config';
import express from 'express';
import { PlaywrightFetcher } from './fetcher';

const app = express();
app.use(express.json());

// Initialize fetcher
const fetcher = new PlaywrightFetcher(
    parseInt(process.env.PLAYWRIGHT_CONCURRENCY || '4')
);

/**
 * POST /fetch
 * 
 * Fetch URL using Playwright and create snapshot
 * 
 * Request:
 * {
 *   "url": "https://example.com",
 *   "idempotency_key": "unique-key",
 *   "callback_url": "https://api.example.com/callback" (optional)
 * }
 * 
 * Response:
 * {
 *   "snapshot_id": "64-char-hex",
 *   "metadata": {
 *     "title": "Page Title",
 *     "url": "https://example.com",
 *     "final_url": "https://example.com/redirected",
 *     "status_code": 200,
 *     "fetched_at": "2025-11-25T10:00:00Z"
 *   }
 * }
 */
app.post('/fetch', async (req, res) => {
    try {
        const { url, idempotency_key, callback_url } = req.body;

        // Validation
        if (!url || typeof url !== 'string') {
            return res.status(400).json({
                error: 'url is required and must be a string'
            });
        }

        if (!idempotency_key || typeof idempotency_key !== 'string') {
            return res.status(400).json({
                error: 'idempotency_key is required and must be a string'
            });
        }

        // Check concurrency limits
        const stats = fetcher.getStats();
        if (stats.activeFetches >= stats.maxConcurrency) {
            return res.status(503).json({
                error: 'Service at capacity',
                retry_after: 5,
            });
        }

        // Fetch and store snapshot
        const result = await fetcher.fetch(url, idempotency_key);

        // If callback URL provided, POST result
        if (callback_url) {
            fetch(callback_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotency_key,
                    snapshot_id: result.snapshot_id,
                    metadata: result.metadata,
                }),
            }).catch(error => {
                console.error('Callback error:', error);
                // Don't fail the request if callback fails
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Fetch error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Fetch failed'
        });
    }
});

/**
 * GET /health
 */
app.get('/health', (req, res) => {
    const stats = fetcher.getStats();
    res.json({
        status: 'healthy',
        service: 'playwright-runner',
        stats,
    });
});

/**
 * GET /stats
 */
app.get('/stats', (req, res) => {
    res.json(fetcher.getStats());
});

// Initialize and start
const PORT = process.env.PORT || 3001;

async function start() {
    await fetcher.initialize();

    app.listen(PORT, () => {
        console.log(`Playwright runner listening on port ${PORT}`);
        console.log(`Concurrency: ${process.env.PLAYWRIGHT_CONCURRENCY || '4'}`);
    });
}

start().catch(error => {
    console.error('Startup error:', error);
    process.exit(1);
});

// Graceful shutdown
async function shutdown(signal: string) {
    console.log(`\nReceived ${signal}, shutting down...`);
    await fetcher.close();
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
