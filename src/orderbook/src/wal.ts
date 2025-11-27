/**
 * Write-Ahead Log (WAL)
 * 
 * Ensures durability by writing all operations to an append-only log
 * before applying them to the in-memory orderbook.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const appendFile = promisify(fs.appendFile);
const readFile = promisify(fs.readFile);
const fsync = promisify(fs.fsync);

export interface WALEntry {
    seq: number;
    ts: number;
    type: 'ORDER_PLACED' | 'ORDER_MATCHED' | 'ORDER_CANCELLED';
    payload: any;
}

export class WAL {
    private filePath: string;
    private sequence: number = 0;
    private fsyncEveryN: number;
    private pendingWrites: number = 0;
    private fileDescriptor: number | null = null;

    constructor(filePath: string, fsyncEveryN: number = 1) {
        this.filePath = filePath;
        this.fsyncEveryN = fsyncEveryN;

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Open file descriptor
        this.fileDescriptor = fs.openSync(filePath, 'a');
    }

    /**
     * Append an entry to the WAL
     */
    async append(type: WALEntry['type'], payload: any): Promise<number> {
        const entry: WALEntry = {
            seq: ++this.sequence,
            ts: Date.now(),
            type,
            payload,
        };

        const line = JSON.stringify(entry) + '\n';
        await appendFile(this.filePath, line);

        this.pendingWrites++;

        // Sync to disk if we've reached the fsync threshold
        if (this.pendingWrites >= this.fsyncEveryN && this.fileDescriptor !== null) {
            await fsync(this.fileDescriptor);
            this.pendingWrites = 0;
        }

        return entry.seq;
    }

    /**
     * Force sync to disk
     */
    async sync(): Promise<void> {
        if (this.fileDescriptor !== null) {
            await fsync(this.fileDescriptor);
            this.pendingWrites = 0;
        }
    }

    /**
     * Read all entries from the WAL
     */
    async readAll(): Promise<WALEntry[]> {
        if (!fs.existsSync(this.filePath)) {
            return [];
        }

        const content = await readFile(this.filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        const entries: WALEntry[] = [];
        for (const line of lines) {
            try {
                entries.push(JSON.parse(line));
            } catch (error) {
                console.error('Failed to parse WAL entry:', line, error);
            }
        }

        // Update sequence to the highest seen
        if (entries.length > 0) {
            this.sequence = Math.max(...entries.map(e => e.seq));
        }

        return entries;
    }

    /**
     * Read entries since a specific sequence number
     */
    async readSince(seq: number): Promise<WALEntry[]> {
        const allEntries = await this.readAll();
        return allEntries.filter(entry => entry.seq > seq);
    }

    /**
     * Get current sequence number
     */
    getCurrentSequence(): number {
        return this.sequence;
    }

    /**
     * Close the WAL
     */
    async close(): Promise<void> {
        await this.sync();
        if (this.fileDescriptor !== null) {
            fs.closeSync(this.fileDescriptor);
            this.fileDescriptor = null;
        }
    }

    /**
     * Truncate the WAL (for testing)
     */
    async truncate(): Promise<void> {
        await this.close();
        if (fs.existsSync(this.filePath)) {
            fs.unlinkSync(this.filePath);
        }
        this.sequence = 0;
        this.fileDescriptor = fs.openSync(this.filePath, 'a');
    }
}
