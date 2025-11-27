/**
 * TradeHistory Component
 * 
 * Shows recent trades with realtime updates.
 */

'use client';

import { useEffect, useState } from 'react';

interface Trade {
    trade_id: string;
    price: number;
    quantity: number;
    created_at: string;
}

interface TradeHistoryProps {
    symbol: string;
}

export default function TradeHistory({ symbol }: TradeHistoryProps) {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch recent trades
        const fetchTrades = async () => {
            try {
                const response = await fetch(`/api/trades?symbol=${symbol}&limit=20`);
                const data = await response.json();

                if (data.success) {
                    setTrades(data.trades);
                }
            } catch (error) {
                console.error('Failed to fetch trades:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTrades();

        // TODO: Subscribe to realtime updates
        // const { useMarketData } = require('@/lib/realtime');
        // const { trades: realtimeTrades } = useMarketData(symbol);

    }, [symbol]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                Loading trades...
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Recent Trades</h3>
            </div>

            <div className="p-4">
                {trades.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No trades yet</p>
                ) : (
                    <div className="space-y-2">
                        <div className="grid grid-cols-3 text-xs text-gray-500 uppercase font-medium mb-2">
                            <span>Price</span>
                            <span className="text-right">Quantity</span>
                            <span className="text-right">Time</span>
                        </div>
                        {trades.map((trade) => (
                            <div key={trade.trade_id} className="grid grid-cols-3 text-sm py-2 hover:bg-gray-50 rounded">
                                <span className="font-medium text-gray-900">${trade.price.toLocaleString()}</span>
                                <span className="text-right text-gray-700">{trade.quantity.toFixed(4)}</span>
                                <span className="text-right text-gray-500 text-xs">
                                    {new Date(trade.created_at).toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
