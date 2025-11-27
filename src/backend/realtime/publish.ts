/**
 * Realtime Publish
 * 
 * Publishes messages to Ably with sequence numbers for gap detection.
 */

import Ably from 'ably';
import { incrementSequence } from './channel_counters';

// Initialize Ably client
const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export interface RealtimeMessage {
    sequence_number: number;
    ts: number;
    source_of_truth: string;
    producer: string;
    payload: any;
}

/**
 * Publish a message to a realtime channel with sequence number
 */
export async function publishToChannel(
    channel: string,
    eventType: string,
    payload: any,
    options: {
        sourceOfTruth?: string;
        producer?: string;
    } = {}
): Promise<number> {
    // Get atomic sequence number
    const sequence = await incrementSequence(channel);

    // Construct message
    const message: RealtimeMessage = {
        sequence_number: sequence,
        ts: Date.now(),
        source_of_truth: options.sourceOfTruth || 'backend',
        producer: options.producer || 'unknown',
        payload,
    };

    // Publish to Ably
    const ablyChannel = ably.channels.get(channel);
    await ablyChannel.publish(eventType, message);

    console.log(`Published to ${channel}: seq=${sequence}, event=${eventType}`);

    return sequence;
}

/**
 * Publish a trade from the orderbook
 */
export async function publishTrade(
    symbol: string,
    trade: {
        buyer_order_id: string;
        seller_order_id: string;
        price: number;
        quantity: number;
    }
): Promise<number> {
    return publishToChannel(
        `market:${symbol}`,
        'TRADE',
        trade,
        {
            sourceOfTruth: 'orderbook_service',
            producer: 'orderbook',
        }
    );
}

/**
 * Publish an event creation
 */
export async function publishEvent(
    event: {
        event_id: string;
        summary: string;
        confidence: number;
        snapshot_ids: string[];
    }
): Promise<number> {
    return publishToChannel(
        'events',
        'EVENT_CREATED',
        event,
        {
            sourceOfTruth: 'reality_worker',
            producer: 'finalizer',
        }
    );
}

/**
 * Publish order status update
 */
export async function publishOrderUpdate(
    symbol: string,
    order: {
        order_id: string;
        status: string;
        filled_quantity: number;
    }
): Promise<number> {
    return publishToChannel(
        `market:${symbol}`,
        'ORDER_UPDATE',
        order,
        {
            sourceOfTruth: 'orderbook_service',
            producer: 'orderbook',
        }
    );
}
