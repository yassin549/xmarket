/**
 * Channel Counters
 * 
 * Atomic sequence number management for realtime channels.
 * Enables gap detection and message ordering.
 */

import { query } from '../db/pool';

/**
 * Atomically increment sequence number for a channel
 * Returns the new sequence number
 */
export async function incrementSequence(channel: string): Promise<number> {
    const result = await query<{ last_sequence_number: number }>(
        `INSERT INTO channel_counters (channel, last_sequence_number, updated_at)
         VALUES ($1, 1, NOW())
         ON CONFLICT (channel) 
         DO UPDATE SET 
             last_sequence_number = channel_counters.last_sequence_number + 1,
             updated_at = NOW()
         RETURNING last_sequence_number`,
        [channel]
    );

    return result.rows[0].last_sequence_number;
}

/**
 * Get current sequence number for a channel
 */
export async function getCurrentSequence(channel: string): Promise<number> {
    const result = await query<{ last_sequence_number: number }>(
        `SELECT last_sequence_number 
         FROM channel_counters 
         WHERE channel = $1`,
        [channel]
    );

    return result.rows[0]?.last_sequence_number || 0;
}

/**
 * Get all channel counters (for monitoring)
 */
export async function getAllCounters(): Promise<Array<{ channel: string; last_sequence_number: number; updated_at: Date }>> {
    const result = await query<{ channel: string; last_sequence_number: number; updated_at: Date }>(
        `SELECT channel, last_sequence_number, updated_at 
         FROM channel_counters 
         ORDER BY updated_at DESC`
    );

    return result.rows;
}
