/**
 * DLQ Job Worker
 * 
 * Background worker that polls database for pending/retry jobs,
 * processes them, and handles failures with exponential backoff.
 * 
 * Features:
 * - Polls every 5 seconds (configurable)
 * - FOR UPDATE SKIP LOCKED (no race conditions)
 * - Exponential backoff with jitter
 * - DLQ for poison messages (max_attempts exceeded)
 * - Graceful shutdown on SIGTERM/SIGINT
 */

import { query, getPool, closePool } from '../db/pool';
import type { QueryResult } from 'pg';

interface Job {
    job_id: string;
    job_type: string;
    idempotency_key: string;
    payload: any;
    attempts: number;
    max_attempts: number;
    status: string;
}

interface WorkerConfig {
    pollInterval?: number;    // Milliseconds between polls (default: 5000)
    maxConcurrency?: number;  // Max jobs to process concurrently (default: 10)
    baseDelay?: number;       // Base retry delay in seconds (default: 60)
    maxDelay?: number;        // Max retry delay in seconds (default: 3600)
}

export class JobWorker {
    private running = false;
    private pollInterval: number;
    private maxConcurrency: number;
    private baseDelay: number;
    private maxDelay: number;
    private activeJobs = 0;

    constructor(config: WorkerConfig = {}) {
        this.pollInterval = config.pollInterval || 5000;
        this.maxConcurrency = config.maxConcurrency || 10;
        this.baseDelay = config.baseDelay || 60;
        this.maxDelay = config.maxDelay || 3600;
    }

    /**
     * Start the worker
     */
    async start(): Promise<void> {
        this.running = true;
        console.log('Job worker started', {
            pollInterval: this.pollInterval,
            maxConcurrency: this.maxConcurrency,
        });

        while (this.running) {
            try {
                await this.pollAndProcess();
            } catch (error) {
                console.error('Poll error:', error);
            }

            await this.sleep(this.pollInterval);
        }

        // Wait for active jobs to complete
        while (this.activeJobs > 0) {
            console.log(`Waiting for ${this.activeJobs} active jobs to complete...`);
            await this.sleep(1000);
        }

        console.log('Job worker stopped');
    }

    /**
     * Stop the worker gracefully
     */
    async stop(): Promise<void> {
        console.log('Job worker stopping...');
        this.running = false;
    }

    /**
     * Poll database and process ready jobs
     */
    private async pollAndProcess(): Promise<void> {
        // Check if we have capacity
        if (this.activeJobs >= this.maxConcurrency) {
            return;
        }

        const batchSize = this.maxConcurrency - this.activeJobs;

        // Fetch jobs ready for processing
        const jobs = await this.fetchReadyJobs(batchSize);

        if (jobs.length === 0) {
            return;
        }

        console.log(`Processing ${jobs.length} jobs`);

        // Process jobs concurrently
        for (const job of jobs) {
            this.processJob(job).catch(error => {
                console.error('Unexpected error processing job:', job.job_id, error);
            });
        }
    }

    /**
     * Fetch jobs ready for processing with FOR UPDATE SKIP LOCKED
     */
    private async fetchReadyJobs(limit: number): Promise<Job[]> {
        try {
            const result = await query<Job>(
                `UPDATE jobs
         SET status = 'processing', updated_at = NOW()
         WHERE job_id IN (
           SELECT job_id FROM jobs
           WHERE status IN ('pending', 'retry')
             AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
           ORDER BY created_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING job_id, job_type, idempotency_key, payload, attempts, max_attempts, status`,
                [limit]
            );

            return result.rows;
        } catch (error) {
            console.error('Error fetching jobs:', error);
            return [];
        }
    }

    /**
     * Process a single job
     */
    private async processJob(job: Job): Promise<void> {
        this.activeJobs++;

        try {
            console.log(`Processing job ${job.job_id} (${job.job_type}), attempt ${job.attempts + 1}`);

            // Execute job based on type
            const result = await this.executeJob(job);

            // Mark as completed
            await query(
                `UPDATE jobs
         SET status = 'completed',
             result = $1,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE job_id = $2`,
                [JSON.stringify(result), job.job_id]
            );

            console.log(`Job ${job.job_id} completed successfully`);
        } catch (error) {
            console.error(`Job ${job.job_id} failed:`, error);
            await this.handleFailure(job, error as Error);
        } finally {
            this.activeJobs--;
        }
    }

    /**
     * Execute job based on type
     * 
     * This is a placeholder - actual execution logic should be in separate executors
     */
    private async executeJob(job: Job): Promise<any> {
        // Simulate work
        await this.sleep(100);

        // For now, just return the payload
        // In production, this would dispatch to type-specific executors
        return {
            job_id: job.job_id,
            job_type: job.job_type,
            processed_at: new Date().toISOString(),
            payload: job.payload,
        };
    }

    /**
     * Handle job failure with retry or DLQ
     */
    private async handleFailure(job: Job, error: Error): Promise<void> {
        const newAttempts = job.attempts + 1;

        if (newAttempts >= job.max_attempts) {
            // Move to DLQ (Dead Letter Queue)
            await query(
                `UPDATE jobs
         SET status = 'dlq',
             attempts = $1,
             error_message = $2,
             updated_at = NOW()
         WHERE job_id = $3`,
                [newAttempts, error.message, job.job_id]
            );

            console.error(`Job ${job.job_id} moved to DLQ after ${newAttempts} attempts`);
        } else {
            // Schedule retry with exponential backoff
            const nextAttempt = this.calculateNextAttempt(newAttempts);

            await query(
                `UPDATE jobs
         SET status = 'retry',
             attempts = $1,
             next_attempt_at = $2,
             error_message = $3,
             updated_at = NOW()
         WHERE job_id = $4`,
                [newAttempts, nextAttempt, error.message, job.job_id]
            );

            console.log(`Job ${job.job_id} scheduled for retry at ${nextAttempt.toISOString()}`);
        }
    }

    /**
     * Calculate next attempt time with exponential backoff and jitter
     * 
     * Formula: delay = min(baseDelay * 2^attempts, maxDelay) + jitter
     */
    private calculateNextAttempt(attempts: number): Date {
        // Exponential backoff: baseDelay * 2^attempts
        const exponentialDelay = this.baseDelay * Math.pow(2, attempts - 1);

        // Cap at max delay
        const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

        // Add jitter (±20% of delay)
        const jitter = cappedDelay * 0.2 * (Math.random() - 0.5) * 2;
        const totalDelay = cappedDelay + jitter;

        return new Date(Date.now() + totalDelay * 1000);
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Default export
 */
export default JobWorker;
