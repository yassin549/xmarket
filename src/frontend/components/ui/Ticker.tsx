'use client';

/**
 * Ticker Component
 * 
 * Displays a scrolling ticker of market data.
 */

import { useEffect, useState } from 'react';
import { Market } from '@/types/market';

export function Ticker() {
    const [markets, setMarkets] = useState<Market[]>([]);

    useEffect(() => {
        // Fetch initial markets for ticker
        fetch('/api/markets?limit=10')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setMarkets(data.markets);
                }
            })
            .catch(err => console.error('Failed to fetch ticker data', err));
    }, []);

    if (markets.length === 0) return null;

    return (
        <div className="w-full bg-[var(--surface-10)] border-y border-[var(--glass-border)] overflow-hidden py-3">
            <div className="flex animate-scroll whitespace-nowrap">
                {[...markets, ...markets].map((market, i) => (
                    <div key={`${market.symbol}-${i}`} className="flex items-center gap-4 mx-8">
                        <span className="font-bold text-[var(--text-10)]">{market.symbol}</span>
                        <span className="text-sm text-[var(--muted-20)]">{market.title}</span>
                        {/* Placeholder for price change - would come from realtime data */}
                        <span className="text-sm text-[var(--success)]">+2.4%</span>
                    </div>
                ))}
            </div>

        </div>
    );
}
