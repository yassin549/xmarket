/**
 * Discover Page
 * 
 * Browse markets by type categories.
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TypeTile from '@/components/discover/TypeTile';
import TypeBadge from '@/components/ui/TypeBadge';
import { Market, MarketType, MARKET_TYPE_INFO } from '@/types/market';
import Link from 'next/link';

function DiscoverContent() {
    const searchParams = useSearchParams();
    const selectedType = searchParams?.get('type') as MarketType | null;
    const [markets, setMarkets] = useState<Market[]>([]);
    const [loading, setLoading] = useState(false);
    const [typeCounts, setTypeCounts] = useState<Record<MarketType, number>>({
        political: 0,
        economic: 0,
        social: 0,
        tech: 0,
        finance: 0,
        culture: 0,
        sports: 0,
    });

    // Fetch markets filtered by type
    useEffect(() => {
        const fetchMarkets = async () => {
            setLoading(true);
            try {
                const url = selectedType
                    ? `/api/markets?type=${selectedType}&limit=20`
                    : '/api/markets?limit=20';

                const response = await fetch(url);
                const data = await response.json();

                if (data.success) {
                    setMarkets(data.markets);
                }
            } catch (error) {
                console.error('Failed to fetch markets:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMarkets();
    }, [selectedType]);

    // TODO: Fetch type counts from backend
    // For now, using placeholder counts
    useEffect(() => {
        setTypeCounts({
            political: 45,
            economic: 38,
            social: 102,
            tech: 67,
            finance: 89,
            culture: 54,
            sports: 76,
        });
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Discover Markets</h1>
                    <p className="text-gray-600">Browse prediction markets by category</p>
                </div>

                {/* Search Bar */}
                <div className="mb-8">
                    <input
                        type="text"
                        placeholder="Search markets..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {selectedType ? (
                    // Filtered View
                    <div>
                        <div className="mb-6 flex items-center gap-3">
                            <Link
                                href="/discover"
                                className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                                ← All Categories
                            </Link>
                            <TypeBadge type={selectedType} size="lg" />
                        </div>

                        {loading ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500">Loading markets...</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {markets.map((market) => (
                                    <Link
                                        key={market.market_id}
                                        href={`/market/${market.symbol}`}
                                        className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">{market.title}</h3>
                                            <TypeBadge type={market.type} size="sm" />
                                        </div>
                                        {market.description && (
                                            <p className="text-gray-600 text-sm mb-3">{market.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span>Symbol: {market.symbol}</span>
                                            {market.region && <span>Region: {market.region}</span>}
                                            <span className="capitalize">Risk: {market.risk_level}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    // Type Tiles Grid
                    <>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse by Category</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            {(Object.keys(MARKET_TYPE_INFO) as MarketType[]).map((type) => (
                                <TypeTile key={type} type={type} count={typeCounts[type]} />
                            ))}
                        </div>

                        {/* Trending Markets */}
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Trending Now</h2>
                            {loading ? (
                                <p className="text-gray-500">Loading...</p>
                            ) : (
                                <div className="grid gap-4">
                                    {markets.slice(0, 10).map((market) => (
                                        <Link
                                            key={market.market_id}
                                            href={`/market/${market.symbol}`}
                                            className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-gray-900">{market.title}</h3>
                                                        <TypeBadge type={market.type} size="sm" />
                                                    </div>
                                                    <p className="text-sm text-gray-500">{market.symbol}</p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function DiscoverPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
            <DiscoverContent />
        </Suspense>
    );
}
