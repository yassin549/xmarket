/**
 * Snapshot Provenance System
 * 
 * Generates deterministic snapshot IDs and manages snapshot storage.
 * Implements the snapshot contract from details.txt:
 * 
 * snapshot_id = sha256(url + "|" + fetched_iso_ts)
 * 
 * Storage: Vercel Blob at snapshots/{snapshot_id}.html
 */

import crypto from 'crypto';
import { put } from '@vercel/blob';

export interface SnapshotMetadata {
    snapshot_id: string;
    url: string;
    fetched_at: string;
    content_type: string;
    size_bytes: number;
    status_code?: number;
}

/**
 * Generate deterministic snapshot ID
 * 
 * Formula: SHA256(url + "|" + ISO8601_timestamp)
 * 
 * @param url Canonical URL that was fetched
 * @param fetchedAt Exact timestamp of fetch
 * @returns 64-character hex snapshot ID
 * 
 * @example
 * const id = generateSnapshotId('https://example.com', new Date('2025-11-25T10:00:00Z'));
 * // => 'a1b2c3d4...' (64 hex chars)
 */
export function generateSnapshotId(url: string, fetchedAt: Date): string {
    const timestamp = fetchedAt.toISOString();
    const canonical = `${url}|${timestamp}`;

    return crypto
        .createHash('sha256')
        .update(canonical)
        .digest('hex');
}

/**
 * Store snapshot to Vercel Blob
 * 
 * Critical: Uses deterministic filenames (no random suffix)
 * to ensure snapshot_id always maps to the same blob.
 * 
 * @param snapshot_id Snapshot ID (from generateSnapshotId)
 * @param content HTML content to store
 * @param metadata Snapshot metadata
 * @returns Blob URL
 */
export async function storeSnapshot(
    snapshot_id: string,
    content: string,
    metadata: Partial<SnapshotMetadata>
): Promise<string> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
        throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }

    // Store with deterministic filename
    const blob = await put(`snapshots/${snapshot_id}.html`, content, {
        access: 'public', // Public for audit trails
        token,
        addRandomSuffix: false, // CRITICAL: No random suffix for determinism
        contentType: metadata.content_type || 'text/html',
    });

    console.log('Snapshot stored:', {
        snapshot_id,
        url: blob.url,
        size: metadata.size_bytes,
    });

    return blob.url;
}

/**
 * Retrieve snapshot from Vercel Blob
 * 
 * @param snapshot_id Snapshot ID
 * @returns HTML content
 */
export async function getSnapshot(snapshot_id: string): Promise<string> {
    const baseUrl = process.env.BLOB_URL_BASE;

    if (!baseUrl) {
        throw new Error('BLOB_URL_BASE not configured');
    }

    const url = `${baseUrl}/snapshots/${snapshot_id}.html`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Snapshot not found: ${snapshot_id} (HTTP ${response.status})`);
    }

    return await response.text();
}

/**
 * Check if snapshot exists in blob storage
 * 
 * @param snapshot_id Snapshot ID
 * @returns true if snapshot exists
 */
export async function snapshotExists(snapshot_id: string): Promise<boolean> {
    try {
        await getSnapshot(snapshot_id);
        return true;
    } catch {
        return false;
    }
}

/**
 * Default export
 */
export default {
    generateSnapshotId,
    storeSnapshot,
    getSnapshot,
    snapshotExists,
};
