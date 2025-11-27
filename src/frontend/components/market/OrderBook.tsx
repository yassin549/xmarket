/**
 * OrderBook Component
 * 
 * Displays live orderbook with bids and asks.
 */

'use client';

import { useEffect, useState } from 'react';

interface OrderBookEntry {
    price: number;
    quantity: number;
}

interface OrderBookProps {
    symbol: string;
}

export default function OrderBook({ symbol }: OrderBookProps) {
    const [bids, setBids] = useState<OrderBookEntry[]>([]);
    const [asks, setAsks] = useState<OrderBookEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch initial orderbook snapshot
        const fetchOrderbook = async () => {
            try {
                const response = await fetch(`/api/orderbook/snapshot?symbol=${symbol}`);
                const data = await response.json();

                if (data.success) {
                    setBids(data.bids.map(([price, qty]: [number, number]) => ({ price, quantity: qty })));
                    setAsks(data.asks.map(([price, qty]: [number, number]) => ({ price, quantity: qty })));
                }
            } catch (error) {
                console.error('Failed to fetch orderbook:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrderbook();

        // TODO: Subscribe to realtime updates
        // const { useMarketData } = require('@/lib/realtime');
        // const { orderbook } = useMarketData(symbol);

    }, [symbol]);

    if (loading) {
        return (
            <div className="p-6 text-center text-gray-500">
                Loading orderbook...
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Order Book</h3>
            </div>

            <div className="p-4">
                {/* Asks (Sell Orders) */}
                <div className="mb-4">
                    <div className="text-xs text-gray-500 uppercase font-medium mb-2 grid grid-cols-2">
                        <span>Price</span>
                        <span className="text-right">Quantity</span>
                    </div>
                    <div className="space-y-1">
                        {asks.slice(0, 10).reverse().map((ask, idx) => (
                            <div key={idx} className="grid grid-cols-2 text-sm py-1 hover:bg-red-50 rounded">
                                <span className="text-red-600 font-medium">${ask.price.toLocaleString()}</span>
                                <span className="text-right text-gray-700">{ask.quantity.toFixed(4)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Spread */}
                <div className="border-y border-gray-200 py-2 my-2 text-center">
                    {asks.length > 0 && bids.length > 0 && (
                        <span className="text-xs text-gray-500">
                            Spread: ${(asks[0].price - bids[0].price).toFixed(2)}
                        </span>
                    )}
                </div>

                {/* Bids (Buy Orders) */}
                <div>
                    <div className="space-y-1">
                        {bids.slice(0, 10).map((bid, idx) => (
                            <div key={idx} className="grid grid-cols-2 text-sm py-1 hover:bg-green-50 rounded">
                                <span className="text-green-600 font-medium">${bid.price.toLocaleString()}</span>
                                <span className="text-right text-gray-700">{bid.quantity.toFixed(4)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
