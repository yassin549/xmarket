/**
 * Ingest API
 * 
 * Entry point for submitting URLs for content ingestion.
 * Creates jobs that will be processed by the worker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';
import crypto from 'crypto';

/**
 * POST /api/v1/ingest
 * 
 * Submit URL for ingestion (idempotent)
 * 
 * Request:
 * {
 *   "url": "https://example.com",
 *   "metadata": { ... } (optional)
 * }
 * 
 * Response:
 * {
 *   "job_id": "uuid",
 *   "idempotency_key": "hash",
 *   "status": "pending"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, metadata = {} } = body;

        // Validation
        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'url is required and must be a string' },
                { status: 400 }
            );
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // Content size limit check (will be enforced during fetch)
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB

        // Generate idempotency key from URL (for deduplication)
        // Note: Same URL will create same key, so duplicate requests are idempotent
        const idempotency_key = crypto
            .createHash('sha256')
            .update(url)
            .digest('hex')
            .substring(0, 16);

        // Create ingest job
        const result = await query<{
            job_id: string;
            status: string;
            created_at: string;
        }>(
            `INSERT INTO jobs (job_type, idempotency_key, payload, max_attempts)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_type, idempotency_key)
       DO UPDATE SET updated_at = NOW()
       RETURNING job_id, status, created_at`,
            [
                'ingest_fetch',
                idempotency_key,
                JSON.stringify({ url, metadata, max_size: MAX_SIZE }),
                5,
            ]
        );

        if (result.rows.length === 0) {
            throw new Error('Failed to create ingest job');
        }

        const job = result.rows[0];

        return NextResponse.json(
            {
                job_id: job.job_id,
                idempotency_key,
                status: job.status,
                created_at: job.created_at,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Ingest error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/v1/ingest?url=...
 * 
 * Check if URL has been ingested (lookup by URL)
 */
export async function GET(request: NextRequest) {
    try {
        const url = request.nextUrl.searchParams.get('url');

        if (!url) {
            return NextResponse.json(
                { error: 'url query parameter is required' },
                { status: 400 }
            );
        }

        // Generate same idempotency key
        const idempotency_key = crypto
            .createHash('sha256')
            .update(url)
            .digest('hex')
            .substring(0, 16);

        // Look up job
        const result = await query(
            `SELECT job_id, status, created_at, updated_at, completed_at, result
       FROM jobs
       WHERE job_type = 'ingest_fetch' AND idempotency_key = $1`,
            [idempotency_key]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { exists: false, message: 'URL has not been ingested' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            exists: true,
            job: result.rows[0],
        });
    } catch (error) {
        console.error('Ingest lookup error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
