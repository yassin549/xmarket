/**
 * Start All Workers
 * 
 * Runs both Reality Worker (processes snapshots) and Finalizer (creates markets) concurrently.
 */

import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting Xmarket Worker Pipeline...\n');

// Start Reality Worker (processes snapshots)
const realityWorker = spawn('npx', ['ts-node', 'reality/worker.ts'], {
    cwd: path.join(__dirname),
    stdio: 'inherit',
    shell: true
});

realityWorker.on('error', (error) => {
    console.error('❌ Reality Worker failed to start:', error);
    process.exit(1);
});

realityWorker.on('exit', (code) => {
    console.error(`❌ Reality Worker exited with code ${code}`);
    process.exit(code || 1);
});

// Start Finalizer Worker (creates markets)
const finalizerWorker = spawn('npx', ['ts-node', 'backend/workers/finalizer.ts'], {
    cwd: path.join(__dirname),
    stdio: 'inherit',
    shell: true
});

finalizerWorker.on('error', (error) => {
    console.error('❌ Finalizer Worker failed to start:', error);
    process.exit(1);
});

finalizerWorker.on('exit', (code) => {
    console.error(`❌ Finalizer Worker exited with code ${code}`);
    process.exit(code || 1);
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down workers...');
    realityWorker.kill('SIGTERM');
    finalizerWorker.kill('SIGTERM');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Shutting down workers...');
    realityWorker.kill('SIGTERM');
    finalizerWorker.kill('SIGTERM');
    process.exit(0);
});

console.log('✅ All workers started successfully');
console.log('Press Ctrl+C to stop\n');
