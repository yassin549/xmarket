/**
 * Orderbook HTTP Server
 * 
 * Provides REST API for order placement, cancellation, and orderbook snapshots.
 */

import express, { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { MatchingEngine, Order, Trade } from './matching';
import { WAL } from './wal';
import { SnapshotManager } from './snapshot';

const app = express();
app.use(express.json());

// Configuration
const PORT = parseInt(process.env.ORDERBOOK_PORT || '3001');
const WAL_PATH = process.env.ORDERBOOK_WAL_PATH || './data/wal/orderbook.wal';
const FSYNC_EVERY_N = parseInt(process.env.FSYNC_EVERY_N || '1');
const SNAPSHOT_INTERVAL_MS = parseInt(process.env.SNAPSHOT_INTERVAL_MS || '10000');

// Initialize components
const engine = new MatchingEngine();
const wal = new WAL(WAL_PATH, FSYNC_EVERY_N);
const snapshotManager = new SnapshotManager(engine, SNAPSHOT_INTERVAL_MS);

// Recovery on startup
async function recover() {
    console.log('🔄 Starting recovery...');

    // Try to load latest snapshot
    const snapshot = await snapshotManager.loadLatest();
    let startSeq = 0;

    if (snapshot) {
        console.log(`📸 Loaded snapshot at sequence ${snapshot.sequence}`);
        engine.restoreState(snapshot.books);
        startSeq = snapshot.sequence;
    }

    // Replay WAL entries since snapshot
    const entries = await wal.readSince(startSeq);
    console.log(`📝 Replaying ${entries.length} WAL entries...`);

    for (const entry of entries) {
        try {
            switch (entry.type) {
                case 'ORDER_PLACED':
                    engine.placeOrder(entry.payload.order);
                    break;
                case 'ORDER_CANCELLED':
                    engine.cancelOrder(entry.payload.symbol, entry.payload.order_id);
                    break;
                // ORDER_MATCHED is implicit in placeOrder
            }
        } catch (error) {
            console.error(`Failed to replay entry ${entry.seq}:`, error);
        }
    }

    console.log('✅ Recovery complete');
}

// POST /order - Place order
app.post('/order', async (req: Request, res: Response) => {
    try {
        const { order_id, user_id, symbol, side, type, price, quantity } = req.body;

        // Validate input
        if (!user_id || !symbol || !side || !type || !quantity) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!['buy', 'sell'].includes(side)) {
            return res.status(400).json({ error: 'Invalid side' });
        }

        if (!['limit', 'market'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        if (type === 'limit' && !price) {
            return res.status(400).json({ error: 'Limit orders require price' });
        }

        // Create order
        const order: Order = {
            order_id: order_id || uuid(),
            user_id,
            symbol,
            side: side as 'buy' | 'sell',
            type: type as 'limit' | 'market',
            price: type === 'limit' ? price : undefined,
            quantity,
            filled_quantity: 0,
            timestamp: Date.now(),
        };

        // Write to WAL before matching
        const seq = await wal.append('ORDER_PLACED', { order });

        // Match order
        const result = engine.placeOrder(order);

        // Write trades to WAL
        for (const trade of result.trades) {
            await wal.append('ORDER_MATCHED', { trade });
        }

        // Determine status
        let status: string;
        if (result.order.filled_quantity === 0) {
            status = 'accepted';
        } else if (result.order.filled_quantity < result.order.quantity) {
            status = 'partially_filled';
        } else {
            status = 'filled';
        }

        res.json({
            server_order_id: result.order.order_id,
            status,
            matched: result.trades.length > 0,
            trades: result.trades,
            sequence_number: seq,
        });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /cancel - Cancel order
app.post('/cancel', async (req: Request, res: Response) => {
    try {
        const { order_id, symbol } = req.body;

        if (!order_id || !symbol) {
            return res.status(400).json({ error: 'Missing order_id or symbol' });
        }

        // Write to WAL
        await wal.append('ORDER_CANCELLED', { symbol, order_id });

        // Cancel order
        const cancelled = engine.cancelOrder(symbol, order_id);

        res.json({
            status: cancelled ? 'cancelled' : 'not_found',
        });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /snapshot - Get orderbook snapshot
app.get('/snapshot', (req: Request, res: Response) => {
    try {
        const symbol = req.query.symbol as string;

        if (!symbol) {
            return res.status(400).json({ error: 'Missing symbol parameter' });
        }

        const snapshot = engine.getSnapshot(symbol);
        const sequence = wal.getCurrentSequence();

        res.json({
            symbol,
            bids: snapshot.bids,
            asks: snapshot.asks,
            last_sequence: sequence,
        });
    } catch (error) {
        console.error('Error getting snapshot:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /health - Health check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        sequence: wal.getCurrentSequence(),
        timestamp: Date.now(),
    });
});

// Start server
async function start() {
    await recover();

    // Start snapshot manager
    snapshotManager.start(() => wal.getCurrentSequence());

    // Start HTTP server
    app.listen(PORT, () => {
        console.log(`🚀 Orderbook service running on port ${PORT}`);
        console.log(`   WAL: ${WAL_PATH}`);
        console.log(`   fsync every ${FSYNC_EVERY_N} writes`);
    });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    snapshotManager.stop();
    await wal.close();
    process.exit(0);
});

// Export for testing
export { app, engine, wal };

// Start if running directly
if (require.main === module) {
    start().catch(error => {
        console.error('Failed to start:', error);
        process.exit(1);
    });
}
