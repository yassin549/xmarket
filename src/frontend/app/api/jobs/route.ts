/**
 * Jobs API Route
 * 
 * Provides endpoints for creating and querying idempotent jobs.
 * Jobs are uniquely identified by (job_type, idempotency_key) composite.
 * 
 * Endpoints:
 * - POST /api/jobs - Create new job (idempotent)
 * - GET /api/jobs?job_type=X&idempotency_key=Y - Get job by keys
 * 
 * @route /api/jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

/**
 * Job response interface
 */
interface JobResponse {
    job_id: string;
    job_type: string;
    idempotency_key: string;
    status: string;
    payload: any;
    attempts: number;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    error_message?: string;
}

/**
 * POST /api/jobs
 * 
 * Create a new job (idempotent via unique constraint)
 * 
 * Request body:
 * {
 *   "job_type": "ingest_fetch",
 *   "idempotency_key": "url-hash-12345",
 *   "payload": { "url": "https://..." }
 * }
 * 
 * Returns: Job object with job_id
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const { job_type, idempotency_key, payload } = body;

        if (!job_type || typeof job_type !== 'string') {
            return NextResponse.json(
                { error: 'job_type is required and must be a string' },
                { status: 400 }
            );
        }

        if (!idempotency_key || typeof idempotency_key !== 'string') {
            return NextResponse.json(
                { error: 'idempotency_key is required and must be a string' },
                { status: 400 }
            );
        }

        if (!payload || typeof payload !== 'object') {
            return NextResponse.json(
                { error: 'payload is required and must be an object' },
                { status: 400 }
            );
        }

        // Insert job with ON CONFLICT to handle idempotency
        // If duplicate, return existing job (updated_at will be refreshed)
        const result = await query<JobResponse>(
            `INSERT INTO jobs (job_type, idempotency_key, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (job_type, idempotency_key)
       DO UPDATE SET updated_at = NOW()
       RETURNING 
         job_id,
         job_type,
         idempotency_key,
         status,
         payload,
         attempts,
         created_at,
         updated_at,
         completed_at,
         error_message`,
            [job_type, idempotency_key, JSON.stringify(payload)]
        );

        if (result.rows.length === 0) {
            throw new Error('Failed to create job');
        }

        const job = result.rows[0];

        return NextResponse.json(job, { status: 201 });
    } catch (error) {
        console.error('Error creating job:', error);

        // Check if it's a database error
        if (error && typeof error === 'object' && 'code' in error) {
            const dbError = error as { code: string; detail?: string };

            // Handle specific PostgreSQL errors
            if (dbError.code === '23505') {
                // Unique violation - this shouldn't happen with ON CONFLICT
                // but handle it gracefully
                return NextResponse.json(
                    { error: 'Job already exists with this type and key' },
                    { status: 409 }
                );
            }
        }

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
 * GET /api/jobs?job_type=X&idempotency_key=Y
 * 
 * Get job by job_type and idempotency_key
 * 
 * Query parameters:
 * - job_type: string (required)
 * - idempotency_key: string (required)
 * 
 * Returns: Job object or 404
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const job_type = searchParams.get('job_type');
        const idempotency_key = searchParams.get('idempotency_key');

        // Validate query parameters
        if (!job_type) {
            return NextResponse.json(
                { error: 'job_type query parameter is required' },
                { status: 400 }
            );
        }

        if (!idempotency_key) {
            return NextResponse.json(
                { error: 'idempotency_key query parameter is required' },
                { status: 400 }
            );
        }

        // Query job by composite key
        const result = await query<JobResponse>(
            `SELECT 
         job_id,
         job_type,
         idempotency_key,
         status,
         payload,
         attempts,
         created_at,
         updated_at,
         completed_at,
         error_message
       FROM jobs
       WHERE job_type = $1 AND idempotency_key = $2`,
            [job_type, idempotency_key]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching job:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
