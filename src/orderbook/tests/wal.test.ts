/**
 * WAL Replay Test
 * 
 * Verifies that the orderbook can recover from crash by replaying the WAL.
 */

import { MatchingEngine, Order } from '../src/matching';
import { WAL } from '../src/wal';
import * as fs from 'fs';
import * as path from 'path';

describe('WAL Replay', () => {
    const TEST_WAL_PATH = path.join(__dirname, 'test.wal');
    let engine: MatchingEngine;
    let wal: WAL;

    beforeEach(() => {
        // Clean up test WAL if it exists
        if (fs.existsSync(TEST_WAL_PATH)) {
            fs.unlinkSync(TEST_WAL_PATH);
        }

        engine = new MatchingEngine();
        wal = new WAL(TEST_WAL_PATH, 1);
    });

    afterEach(async () => {
        await wal.close();
        if (fs.existsSync(TEST_WAL_PATH)) {
            fs.unlinkSync(TEST_WAL_PATH);
        }
    });

    test('should replay orders from WAL after restart', async () => {
        // Place some orders
        const order1: Order = {
            order_id: '1',
            user_id: 'alice',
            symbol: 'BTC-USD',
            side: 'buy',
            type: 'limit',
            price: 50000,
            quantity: 1.0,
            filled_quantity: 0,
            timestamp: Date.now(),
        };

        const order2: Order = {
            order_id: '2',
            user_id: 'bob',
            symbol: 'BTC-USD',
            side: 'sell',
            type: 'limit',
            price: 50001,
            quantity: 0.5,
            filled_quantity: 0,
            timestamp: Date.now(),
        };

        // Write to WAL and place in engine
        await wal.append('ORDER_PLACED', { order: order1 });
        engine.placeOrder(order1);

        await wal.append('ORDER_PLACED', { order: order2 });
        engine.placeOrder(order2);

        // Get snapshot before "crash"
        const snapshotBefore = engine.getSnapshot('BTC-USD');
        expect(snapshotBefore.bids.length).toBeGreaterThan(0);
        expect(snapshotBefore.asks.length).toBeGreaterThan(0);

        // Simulate crash: create new engine and WAL, replay
        await wal.close();
        const newEngine = new MatchingEngine();
        const newWal = new WAL(TEST_WAL_PATH, 1);

        const entries = await newWal.readAll();
        expect(entries.length).toBe(2);

        for (const entry of entries) {
            if (entry.type === 'ORDER_PLACED') {
                newEngine.placeOrder(entry.payload.order);
            }
        }

        // Verify state matches
        const snapshotAfter = newEngine.getSnapshot('BTC-USD');
        expect(snapshotAfter.bids).toEqual(snapshotBefore.bids);
        expect(snapshotAfter.asks).toEqual(snapshotBefore.asks);

        await newWal.close();
    });

    test('should preserve order sequence after replay', async () => {
        const orders: Order[] = [
            {
                order_id: '1',
                user_id: 'alice',
                symbol: 'ETH-USD',
                side: 'buy',
                type: 'limit',
                price: 3000,
                quantity: 10,
                filled_quantity: 0,
                timestamp: Date.now(),
            },
            {
                order_id: '2',
                user_id: 'bob',
                symbol: 'ETH-USD',
                side: 'buy',
                type: 'limit',
                price: 3000,
                quantity: 5,
                filled_quantity: 0,
                timestamp: Date.now() + 1,  // Later timestamp
            },
        ];

        for (const order of orders) {
            await wal.append('ORDER_PLACED', { order });
            engine.placeOrder(order);
        }

        // Verify order (price-time priority)
        const snapshot1 = engine.getSnapshot('ETH-USD');
        const firstBid1 = snapshot1.bids[0];

        // Replay
        await wal.close();
        const newEngine = new MatchingEngine();
        const newWal = new WAL(TEST_WAL_PATH, 1);
        const entries = await newWal.readAll();

        for (const entry of entries) {
            if (entry.type === 'ORDER_PLACED') {
                newEngine.placeOrder(entry.payload.order);
            }
        }

        const snapshot2 = newEngine.getSnapshot('ETH-USD');
        const firstBid2 = snapshot2.bids[0];

        expect(firstBid2).toEqual(firstBid1);

        await newWal.close();
    });
});
