/**
 * Market Detail Page
 * 
 * Full market view with orderbook, trading interface, and trade history.
 */

import { notFound } from 'next/navigation';
import MarketHeader from '@/components/market/MarketHeader';
import OrderBook from '@/components/market/OrderBook';
import OrderForm from '@/components/market/OrderForm';
import TradeHistory from '@/components/market/TradeHistory';
import { Market } from '@/types/market';

// This would normally fetch from API
async function getMarket(symbol: string): Promise<Market | null> {
    // TODO: Implement actual API call
    // For now, return mock data
    return {
        market_id: '123',
        symbol: symbol,
        title: `Market for ${symbol}`,
        description: 'This is a placeholder market. Real data coming soon.',
        type: 'finance',
        risk_level: 'medium',
        human_approval: true,
        approved_by: 'admin',
        approved_at: new Date(),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
    };
}

export default async function MarketPage({
    params,
}: {
    params: Promise<{ symbol: string }>;
}) {
    const { symbol } = await params;
    const market = await getMarket(symbol);

    if (!market) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Market Header */}
            <MarketHeader market={market} currentPrice={50000} priceChange24h={5.2} />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: OrderBook + Trade History */}
                    <div className="lg:col-span-1 space-y-6">
                        <OrderBook symbol={symbol} />
                        <TradeHistory symbol={symbol} />
                    </div>

                    {/* Right Column: Order Form */}
                    <div className="lg:col-span-2">
                        <OrderForm symbol={symbol} />
                    </div>
                </div>
            </div>
        </div>
    );
}
