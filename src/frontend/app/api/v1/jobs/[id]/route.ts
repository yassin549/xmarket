/**
 * Jobs API v1 - Single Job Route
 * 
 * Operations on individual jobs by ID.
 * 
 * Endpoints:
 * - GET /api/v1/jobs/:id - Get job details
 * - PATCH /api/v1/jobs/:id - Update job status/result
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
 * GET /api/v1/jobs/:id
 * 
 * Get single job by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const jobId = params.id;

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
       WHERE job_id = $1`,
            [jobId]
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

/**
 * PATCH /api/v1/jobs/:id
 * 
 * Update job status or result
 * 
 * Request body:
 * {
 *   "status": "completed",  // optional
 *   "result": {...},        // optional
 *   "error_message": "..."  // optional
 * }
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const jobId = params.id;
        const body = await request.json();
        const { status, result, error_message } = body;

        // Validate status if provided
        if (status) {
            const validStatuses = ['pending', 'processing', 'completed', 'failed', 'retry', 'dlq'];
            if (!validStatuses.includes(status)) {
                return NextResponse.json(
                    { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                    { status: 400 }
                );
            }
        }

        // Build update query dynamically
        const updates: string[] = ['updated_at = NOW()'];
        const params: any[] = [];
        let paramIndex = 1;

        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);

            // Set completed_at if status is completed
            if (status === 'completed') {
                updates.push(`completed_at = NOW()`);
            }
        }

        if (result !== undefined) {
            updates.push(`result = $${paramIndex++}`);
            params.push(JSON.stringify(result));
        }

        if (error_message !== undefined) {
            updates.push(`error_message = $${paramIndex++}`);
            params.push(error_message);
        }

        if (updates.length === 1) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        // Add job_id as last parameter
        params.push(jobId);

        const updateResult = await query<JobResponse>(
            `UPDATE jobs
       SET ${updates.join(', ')}
       WHERE job_id = $${paramIndex}
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
            params
        );

        if (updateResult.rows.length === 0) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(updateResult.rows[0]);
    } catch (error) {
        console.error('Error updating job:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
