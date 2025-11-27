/**
 * Type Tile Component
 * 
 * Clickable tile for browsing markets by type.
 */

'use client';

import Link from 'next/link';
import { MarketType, MARKET_TYPE_INFO } from '@/types/market';

interface TypeTileProps {
    type: MarketType;
    count?: number;
}

const COLOR_GRADIENTS: Record<string, string> = {
    blue: 'from-blue-400 to-blue-600',
    green: 'from-green-400 to-green-600',
    purple: 'from-purple-400 to-purple-600',
    indigo: 'from-indigo-400 to-indigo-600',
    yellow: 'from-yellow-400 to-yellow-600',
    pink: 'from-pink-400 to-pink-600',
    orange: 'from-orange-400 to-orange-600',
};

export default function TypeTile({ type, count = 0 }: TypeTileProps) {
    const info = MARKET_TYPE_INFO[type];
    const gradient = COLOR_GRADIENTS[info.color];

    return (
        <Link
            href={`/discover?type=${type}`}
            className="group block rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200"
        >
            <div className={`bg-gradient-to-br ${gradient} p-6 text-white`}>
                <div className="text-4xl mb-2">{info.icon}</div>
                <h3 className="text-xl font-bold">{info.label}</h3>
            </div>
            <div className="p-4 bg-white">
                <p className="text-sm text-gray-600 mb-2">{info.description}</p>
                <p className="text-xs text-gray-500">
                    {count} {count === 1 ? 'market' : 'markets'}
                </p>
            </div>
        </Link>
    );
}
