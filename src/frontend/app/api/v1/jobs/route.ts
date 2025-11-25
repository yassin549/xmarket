/**
 * Jobs API v1 - Main Route
 * 
 * RESTful API for job management with idempotency, filtering, and pagination.
 * 
 * Endpoints:
 * - POST /api/v1/jobs - Create new job
 * - GET /api/v1/jobs - List jobs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

interface JobResponse {
    job_id: string;
    job_type: string;
    idempotency_key: string;
    status: string;
    payload: any;
    result: any;
    attempts: number;
    max_attempts: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    next_attempt_at: string | null;
    error_message: string | null;
}

/**
 * POST /api/v1/jobs
 * 
 * Create a new job (idempotent)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { job_type, idempotency_key, payload, max_attempts = 5 } = body;

        // Validation
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

        if (max_attempts < 1 || max_attempts > 20) {
            return NextResponse.json(
                { error: 'max_attempts must be between 1 and 20' },
                { status: 400 }
            );
        }

        // Create job with idempotency
        const result = await query<JobResponse>(
            `INSERT INTO jobs (job_type, idempotency_key, payload, max_attempts)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_type, idempotency_key)
       DO UPDATE SET updated_at = NOW()
       RETURNING 
         job_id,
         job_type,
         idempotency_key,
         status,
         payload,
         result,
         attempts,
         max_attempts,
         created_at,
         updated_at,
         completed_at,
         next_attempt_at,
         error_message`,
            [job_type, idempotency_key, JSON.stringify(payload), max_attempts]
        );

        if (result.rows.length === 0) {
            throw new Error('Failed to create job');
        }

        return NextResponse.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Error creating job:', error);
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
 * GET /api/v1/jobs
 * 
 * List jobs with optional filters and pagination
 * 
 * Query params:
 * - job_type: Filter by job type
 * - status: Filter by status (pending, processing, completed, failed, retry, dlq)
 * - limit: Page size (default: 50, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const jobType = searchParams.get('job_type');
        const status = searchParams.get('status');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
        const offset = parseInt(searchParams.get('offset') || '0');

        // Build query dynamically based on filters
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (jobType) {
            conditions.push(`job_type = $${paramIndex++}`);
            params.push(jobType);
        }

        if (status) {
            // Validate status
            const validStatuses = ['pending', 'processing', 'completed', 'failed', 'retry', 'dlq'];
            if (!validStatuses.includes(status)) {
                return NextResponse.json(
                    { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                    { status: 400 }
                );
            }
            conditions.push(`status = $${paramIndex++}`);
            params.push(status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) as total FROM jobs ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);

        // Get jobs
        params.push(limit, offset);
        const result = await query<JobResponse>(
            `SELECT 
         job_id,
         job_type,
         idempotency_key,
         status,
         payload,
         result,
         attempts,
         max_attempts,
         created_at,
         updated_at,
         completed_at,
         next_attempt_at,
         error_message
       FROM jobs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            params
        );

        return NextResponse.json({
            jobs: result.rows,
            total,
            limit,
            offset,
            has_more: offset + limit < total,
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
