/**
 * Job Worker Entry Point
 * 
 * Starts the DLQ worker process with graceful shutdown handling.
 * 
 * Usage:
 *   node dist/infra/jobs/index.js
 * 
 * Environment variables:
 *   POLL_INTERVAL - Milliseconds between polls (default: 5000)
 *   MAX_CONCURRENCY - Max concurrent jobs (default: 10)
 *   BASE_RETRY_DELAY - Base retry delay in seconds (default: 60)
 *   MAX_RETRY_DELAY - Max retry delay in seconds (default: 3600)
 */

// Load environment variables from .env file
import 'dotenv/config';

import { JobWorker } from './worker';
import { closePool } from '../db/pool';

// Create worker instance
const worker = new JobWorker({
    pollInterval: parseInt(process.env.POLL_INTERVAL || '5000'),
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '10'),
    baseDelay: parseInt(process.env.BASE_RETRY_DELAY || '60'),
    maxDelay: parseInt(process.env.MAX_RETRY_DELAY || '3600'),
});

// Graceful shutdown handler
async function shutdown(signal: string) {
    console.log(`\nReceived ${signal}, initiating graceful shutdown...`);

    try {
        // Stop worker (waits for active jobs)
        await worker.stop();

        // Close database pool
        await closePool();

        console.log('Shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
});

// Start worker
console.log('Starting job worker...');
console.log('Configuration:', {
    pollInterval: process.env.POLL_INTERVAL || '5000',
    maxConcurrency: process.env.MAX_CONCURRENCY || '10',
    baseRetryDelay: process.env.BASE_RETRY_DELAY || '60',
    maxRetryDelay: process.env.MAX_RETRY_DELAY || '3600',
    nodeEnv: process.env.NODE_ENV || 'development',
});

worker.start().catch(error => {
    console.error('Worker startup error:', error);
    process.exit(1);
});
