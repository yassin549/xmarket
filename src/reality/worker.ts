/**
 * Reality Worker
 * 
 * Orchestrates the processing of reality jobs (snapshot processing, etc).
 * Uses the generic JobWorker infrastructure.
 */

import { JobWorker } from '../infra/jobs/worker';
import ProcessSnapshotExecutor from './actions/process_snapshot';
import DiscoverEventsExecutor from './actions/discover_events';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

async function startWorker() {
    console.log('🚀 Starting Reality Worker...');

    const worker = new JobWorker({
        pollIntervalMs: 2000,
        batchSize: 5,
        workerId: `reality-worker-${process.pid}`
    });

    // Register Executors
    worker.registerExecutor('process_snapshot', new ProcessSnapshotExecutor());
    worker.registerExecutor('discover_events', new DiscoverEventsExecutor());

    // Start processing
    await worker.start();

    // Handle shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received, stopping worker...');
        await worker.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('SIGINT received, stopping worker...');
        await worker.stop();
        process.exit(0);
    });
}

if (require.main === module) {
    startWorker().catch(error => {
        console.error('Fatal worker error:', error);
        process.exit(1);
    });
}
