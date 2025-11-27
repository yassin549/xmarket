/**
 * Snapshot Manager
 * 
 * Periodically saves orderbook state to object storage for faster recovery.
 */

import { MatchingEngine } from './matching';

export interface Snapshot {
    timestamp: number;
    sequence: number;
    books: any;
}

export class SnapshotManager {
    private engine: MatchingEngine;
    private intervalMs: number;
    private intervalHandle: NodeJS.Timeout | null = null;

    constructor(engine: MatchingEngine, intervalMs: number = 10000) {
        this.engine = engine;
        this.intervalMs = intervalMs;
    }

    /**
     * Start periodic snapshots
     */
    start(getCurrentSequence: () => number): void {
        this.intervalHandle = setInterval(() => {
            this.createSnapshot(getCurrentSequence());
        }, this.intervalMs);

        console.log(`Snapshot manager started (interval: ${this.intervalMs}ms)`);
    }

    /**
     * Stop periodic snapshots
     */
    stop(): void {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }

    /**
     * Create a snapshot
     */
    private async createSnapshot(sequence: number): Promise<void> {
        const snapshot: Snapshot = {
            timestamp: Date.now(),
            sequence,
            books: this.engine.getFullState(),
        };

        // TODO: Upload to object storage (Cloudflare R2)
        // For now, just log it
        console.log(`Snapshot created at sequence ${sequence}`);

        // In production, upload to S3-compatible storage:
        // await uploadToR2(snapshot);
    }

    /**
     * Load latest snapshot (stub for now)
     */
    async loadLatest(): Promise<Snapshot | null> {
        // TODO: Download from object storage
        // For now, return null (will replay full WAL)
        return null;
    }
}
