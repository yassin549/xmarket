/**
 * Realtime Client SDK
 * 
 * Handles realtime subscriptions with:
 * - Sequence number tracking
 * - Gap detection
 * - Automatic reconciliation
 * - Reconnection handling
 */

'use client';

import Ably from 'ably';
import { useEffect, useRef, useState, useCallback } from 'react';

interface RealtimeMessage {
    sequence_number: number;
    ts: number;
    source_of_truth: string;
    producer: string;
    payload: any;
}

class RealtimeClient {
    private ably: Ably.Realtime;
    private channels: Map<string, number> = new Map(); // channel -> last_seq
    private subscribers: Map<string, Set<(payload: any, metadata: { sequence: number; ts: number }) => void>> = new Map();

    constructor(apiKey: string) {
        this.ably = new Ably.Realtime(apiKey);

        // Handle connection state changes
        this.ably.connection.on('connected', () => {
            console.log('✅ Realtime connected');
        });

        this.ably.connection.on('disconnected', () => {
            console.warn('⚠️ Realtime disconnected');
        });

        this.ably.connection.on('failed', (error) => {
            console.error('❌ Realtime connection failed:', error);
        });
    }

    /**
     * Subscribe to a channel with gap detection
     */
    subscribe(
        channelName: string,
        onMessage: (payload: any, metadata: { sequence: number; ts: number }) => void,
        onGap?: (fromSeq: number, toSeq: number) => void
    ): () => void {
        const channel = this.ably.channels.get(channelName);

        // Store callback
        if (!this.subscribers.has(channelName)) {
            this.subscribers.set(channelName, new Set());
        }
        this.subscribers.get(channelName)!.add(onMessage);

        // Subscribe to messages
        const messageHandler = (message: Ably.Types.Message) => {
            const data = message.data as RealtimeMessage;
            const { sequence_number, payload, ts } = data;

            // Gap detection
            const lastSeq = this.channels.get(channelName) || 0;
            if (sequence_number > lastSeq + 1) {
                console.warn(`Gap detected on ${channelName}: ${lastSeq} -> ${sequence_number}`);

                if (onGap) {
                    onGap(lastSeq, sequence_number);
                } else {
                    // Default: fetch snapshot
                    this.reconcile(channelName, lastSeq, sequence_number);
                }
            }

            // Update tracking
            this.channels.set(channelName, sequence_number);

            // Call subscriber
            onMessage(payload, { sequence: sequence_number, ts });
        };

        channel.subscribe(messageHandler);

        // Return unsubscribe function
        return () => {
            channel.unsubscribe(messageHandler);
            this.subscribers.get(channelName)?.delete(onMessage);
        };
    }

    /**
     * Reconcile by fetching snapshot
     */
    private async reconcile(channel: string, fromSeq: number, toSeq: number): Promise<void> {
        try {
            console.log(`Reconciling ${channel}: fetching snapshot...`);

            // Fetch snapshot from backend API
            const response = await fetch(`/api/realtime/snapshot?channel=${channel}&since=${fromSeq}`);
            const data = await response.json();

            if (data.success && data.messages) {
                console.log(`Received ${data.messages.length} missed messages`);

                // Process missed messages in order
                for (const msg of data.messages) {
                    const callbacks = this.subscribers.get(channel);
                    if (callbacks) {
                        callbacks.forEach(cb => cb(msg.payload, { sequence: msg.sequence_number, ts: msg.ts }));
                    }
                    this.channels.set(channel, msg.sequence_number);
                }
            }
        } catch (error) {
            console.error('Failed to reconcile:', error);
        }
    }

    /**
     * Get current sequence for a channel
     */
    getCurrentSequence(channel: string): number {
        return this.channels.get(channel) || 0;
    }

    /**
     * Close the client
     */
    close(): void {
        this.ably.close();
    }
}

// Singleton instance
let realtimeClient: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
    if (!realtimeClient) {
        const apiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY || process.env.ABLY_API_KEY;
        if (!apiKey) {
            throw new Error('ABLY_API_KEY not configured');
        }
        realtimeClient = new RealtimeClient(apiKey);
    }
    return realtimeClient;
}

/**
 * React hook for realtime subscriptions
 */
export function useRealtimeChannel<T = any>(
    channelName: string,
    onMessage: (payload: T, metadata: { sequence: number; ts: number }) => void
) {
    const [connected, setConnected] = useState(false);
    const clientRef = useRef<RealtimeClient | null>(null);

    useEffect(() => {
        // Get or create client
        clientRef.current = getRealtimeClient();
        setConnected(true);

        // Subscribe
        const unsubscribe = clientRef.current.subscribe(channelName, onMessage);

        // Cleanup
        return () => {
            unsubscribe();
        };
    }, [channelName]);

    return { connected };
}

/**
 * React hook for market data (trades)
 */
export function useMarketData(symbol: string) {
    const [trades, setTrades] = useState<any[]>([]);
    const [orderbook, setOrderbook] = useState<{ bids: [number, number][]; asks: [number, number][] } | null>(null);

    const handleMessage = useCallback((payload: any, metadata: any) => {
        if (payload.type === 'TRADE') {
            setTrades(prev => [payload.trade, ...prev].slice(0, 50)); // Keep last 50
        } else if (payload.type === 'ORDERBOOK_UPDATE') {
            setOrderbook(payload.orderbook);
        }
    }, []);

    const { connected } = useRealtimeChannel(`market:${symbol}`, handleMessage);

    return { trades, orderbook, connected };
}

export { RealtimeClient };
