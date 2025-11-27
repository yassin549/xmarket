/**
 * Matching Engine
 * 
 * Implements price-time priority matching for limit and market orders.
 * Maintains separate buy/sell orderbooks per symbol.
 */

export interface Order {
    order_id: string;
    user_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    price?: number;  // undefined for market orders
    quantity: number;
    filled_quantity: number;
    timestamp: number;
}

export interface Trade {
    buyer_order_id: string;
    seller_order_id: string;
    price: number;
    quantity: number;
}

interface OrderBookEntry {
    order: Order;
    timestamp: number;
}

class PriorityQueue {
    private items: OrderBookEntry[] = [];
    private compareFn: (a: OrderBookEntry, b: OrderBookEntry) => number;

    constructor(compareFn: (a: OrderBookEntry, b: OrderBookEntry) => number) {
        this.compareFn = compareFn;
    }

    enqueue(item: OrderBookEntry): void {
        this.items.push(item);
        this.items.sort(this.compareFn);
    }

    dequeue(): OrderBookEntry | undefined {
        return this.items.shift();
    }

    peek(): OrderBookEntry | undefined {
        return this.items[0];
    }

    remove(order_id: string): boolean {
        const index = this.items.findIndex(entry => entry.order.order_id === order_id);
        if (index !== -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }

    size(): number {
        return this.items.length;
    }

    getAll(): OrderBookEntry[] {
        return [...this.items];
    }
}

interface OrderBook {
    bids: PriorityQueue;  // Buy orders (highest price first)
    asks: PriorityQueue;  // Sell orders (lowest price first)
}

export class MatchingEngine {
    private books: Map<string, OrderBook> = new Map();

    constructor() { }

    /**
     * Get or create orderbook for a symbol
     */
    private getBook(symbol: string): OrderBook {
        if (!this.books.has(symbol)) {
            this.books.set(symbol, {
                // Bids sorted by price DESC, then timestamp ASC (price-time priority)
                bids: new PriorityQueue((a, b) => {
                    if (a.order.price !== b.order.price) {
                        return (b.order.price || 0) - (a.order.price || 0);
                    }
                    return a.timestamp - b.timestamp;
                }),
                // Asks sorted by price ASC, then timestamp ASC (price-time priority)
                asks: new PriorityQueue((a, b) => {
                    if (a.order.price !== b.order.price) {
                        return (a.order.price || 0) - (b.order.price || 0);
                    }
                    return a.timestamp - b.timestamp;
                }),
            });
        }
        return this.books.get(symbol)!;
    }

    /**
     * Place an order and attempt to match
     */
    placeOrder(order: Order): { order: Order; trades: Trade[] } {
        const book = this.getBook(order.symbol);
        const trades: Trade[] = [];

        // Try to match the order
        if (order.side === 'buy') {
            this.matchBuyOrder(order, book, trades);
        } else {
            this.matchSellOrder(order, book, trades);
        }

        // If order is not fully filled, add to orderbook (limit orders only)
        if (order.filled_quantity < order.quantity && order.type === 'limit') {
            const queue = order.side === 'buy' ? book.bids : book.asks;
            queue.enqueue({
                order: { ...order },
                timestamp: Date.now(),
            });
        }

        return { order, trades };
    }

    /**
     * Match a buy order against asks
     */
    private matchBuyOrder(order: Order, book: OrderBook, trades: Trade[]): void {
        while (order.filled_quantity < order.quantity) {
            const bestAsk = book.asks.peek();

            if (!bestAsk) break;  // No sellers

            // Check if price matches
            const matchPrice = bestAsk.order.price!;
            if (order.type === 'limit' && order.price! < matchPrice) {
                break;  // Buy price too low
            }

            // Match!
            const remainingBuy = order.quantity - order.filled_quantity;
            const remainingSell = bestAsk.order.quantity - bestAsk.order.filled_quantity;
            const matchQuantity = Math.min(remainingBuy, remainingSell);

            // Create trade
            trades.push({
                buyer_order_id: order.order_id,
                seller_order_id: bestAsk.order.order_id,
                price: matchPrice,
                quantity: matchQuantity,
            });

            // Update filled quantities
            order.filled_quantity += matchQuantity;
            bestAsk.order.filled_quantity += matchQuantity;

            // Remove fully filled ask
            if (bestAsk.order.filled_quantity >= bestAsk.order.quantity) {
                book.asks.dequeue();
            }
        }
    }

    /**
     * Match a sell order against bids
     */
    private matchSellOrder(order: Order, book: OrderBook, trades: Trade[]): void {
        while (order.filled_quantity < order.quantity) {
            const bestBid = book.bids.peek();

            if (!bestBid) break;  // No buyers

            // Check if price matches
            const matchPrice = bestBid.order.price!;
            if (order.type === 'limit' && order.price! > matchPrice) {
                break;  // Sell price too high
            }

            // Match!
            const remainingSell = order.quantity - order.filled_quantity;
            const remainingBuy = bestBid.order.quantity - bestBid.order.filled_quantity;
            const matchQuantity = Math.min(remainingSell, remainingBuy);

            // Create trade
            trades.push({
                buyer_order_id: bestBid.order.order_id,
                seller_order_id: order.order_id,
                price: matchPrice,
                quantity: matchQuantity,
            });

            // Update filled quantities
            order.filled_quantity += matchQuantity;
            bestBid.order.filled_quantity += matchQuantity;

            // Remove fully filled bid
            if (bestBid.order.filled_quantity >= bestBid.order.quantity) {
                book.bids.dequeue();
            }
        }
    }

    /**
     * Cancel an order
     */
    cancelOrder(symbol: string, order_id: string): boolean {
        const book = this.getBook(symbol);
        return book.bids.remove(order_id) || book.asks.remove(order_id);
    }

    /**
     * Get orderbook snapshot for a symbol
     */
    getSnapshot(symbol: string): { bids: [number, number][]; asks: [number, number][] } {
        const book = this.getBook(symbol);

        // Aggregate by price level
        const bids: Map<number, number> = new Map();
        const asks: Map<number, number> = new Map();

        for (const entry of book.bids.getAll()) {
            const price = entry.order.price!;
            const qty = entry.order.quantity - entry.order.filled_quantity;
            bids.set(price, (bids.get(price) || 0) + qty);
        }

        for (const entry of book.asks.getAll()) {
            const price = entry.order.price!;
            const qty = entry.order.quantity - entry.order.filled_quantity;
            asks.set(price, (asks.get(price) || 0) + qty);
        }

        return {
            bids: Array.from(bids.entries()).sort((a, b) => b[0] - a[0]),
            asks: Array.from(asks.entries()).sort((a, b) => a[0] - b[0]),
        };
    }

    /**
     * Get full state for snapshot/recovery
     */
    getFullState() {
        const state: any = {};
        for (const [symbol, book] of this.books.entries()) {
            state[symbol] = {
                bids: book.bids.getAll().map(e => e.order),
                asks: book.asks.getAll().map(e => e.order),
            };
        }
        return state;
    }

    /**
     * Restore state from snapshot
     */
    restoreState(state: any): void {
        this.books.clear();
        for (const [symbol, data] of Object.entries(state as any)) {
            const book = this.getBook(symbol);
            for (const order of data.bids) {
                book.bids.enqueue({ order, timestamp: order.timestamp || Date.now() });
            }
            for (const order of data.asks) {
                book.asks.enqueue({ order, timestamp: order.timestamp || Date.now() });
            }
        }
    }
}
