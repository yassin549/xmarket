/**
 * Market Header Component
 * 
 * Displays market title, type badge, approval status, and current price.
 */

import { Market } from '@/types/market';
import TypeBadge from '@/components/ui/TypeBadge';
import ApprovalBanner from '@/components/market/ApprovalBanner';

interface MarketHeaderProps {
    market: Market;
    currentPrice?: number;
    priceChange24h?: number;
}

export default function MarketHeader({ market, currentPrice, priceChange24h }: MarketHeaderProps) {
    const isPositiveChange = (priceChange24h || 0) >= 0;

    return (
        <div className="bg-white border-b border-gray-200 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Title and Badge */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-gray-900">{market.title}</h1>
                            <TypeBadge type={market.type} size="md" />
                        </div>
                        <p className="text-gray-600">{market.description}</p>
                    </div>
                </div>

                {/* Price Info */}
                {currentPrice !== undefined && (
                    <div className="flex items-baseline gap-4 mb-4">
                        <span className="text-4xl font-bold text-gray-900">
                            ${currentPrice.toLocaleString()}
                        </span>
                        {priceChange24h !== undefined && (
                            <span className={`text-lg font-medium ${isPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
                                {isPositiveChange ? '↗' : '↘'} {Math.abs(priceChange24h).toFixed(2)}% (24h)
                            </span>
                        )}
                    </div>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                    <span>Symbol: <span className="font-medium text-gray-900">{market.symbol}</span></span>
                    {market.region && <span>Region: <span className="font-medium">{market.region}</span></span>}
                    <span className="capitalize">Risk: <span className="font-medium">{market.risk_level}</span></span>
                </div>

                {/* Approval Banner */}
                <ApprovalBanner market={market} />
            </div>
        </div>
    );
}
