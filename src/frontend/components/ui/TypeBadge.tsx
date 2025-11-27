/**
 * Type Badge Component
 * 
 * Color-coded badge for market types.
 */

import { MarketType, MARKET_TYPE_INFO } from '@/types/market';

interface TypeBadgeProps {
    type: MarketType;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

const SIZE_CLASSES = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
};

const COLOR_CLASSES: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    pink: 'bg-pink-100 text-pink-800 border-pink-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function TypeBadge({ type, size = 'md', showIcon = true }: TypeBadgeProps) {
    const info = MARKET_TYPE_INFO[type];
    const sizeClass = SIZE_CLASSES[size];
    const colorClass = COLOR_CLASSES[info.color];

    return (
        <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClass} ${colorClass}`}>
            {showIcon && <span>{info.icon}</span>}
            <span>{info.label}</span>
        </span>
    );
}
