/**
 * Market Types & Interfaces
 * 
 * Type definitions for the Xmarket platform's market categorization system.
 */

export type MarketType =
    | 'political'
    | 'economic'
    | 'social'
    | 'tech'
    | 'finance'
    | 'culture'
    | 'sports';

export interface Market {
    market_id: string;
    symbol: string;
    title: string;
    description?: string;
    type: MarketType;
    region?: string;
    risk_level: 'low' | 'medium' | 'high';
    human_approval: boolean;
    approved_at?: Date;
    approved_by?: string;
    status: 'active' | 'suspended' | 'closed';
    created_at: Date;
    updated_at: Date;
}

export interface MarketWithStats extends Market {
    current_price?: number;
    price_change_24h?: number;
    volume_24h?: number;
    trades_count?: number;
}

export const MARKET_TYPE_INFO: Record<MarketType, {
    label: string;
    icon: string;
    description: string;
    color: string;
}> = {
    political: {
        label: 'Political',
        icon: '🏛️',
        description: 'Elections, policy, governance',
        color: 'blue',
    },
    economic: {
        label: 'Economic',
        icon: '💼',
        description: 'Markets, GDP, employment',
        color: 'green',
    },
    social: {
        label: 'Social',
        icon: '🌍',
        description: 'Trends, movements, demographics',
        color: 'purple',
    },
    tech: {
        label: 'Tech',
        icon: '💻',
        description: 'Product launches, adoption, breakthroughs',
        color: 'indigo',
    },
    finance: {
        label: 'Finance',
        icon: '💰',
        description: 'Stock prices, crypto, commodities',
        color: 'yellow',
    },
    culture: {
        label: 'Culture',
        icon: '🎭',
        description: 'Entertainment, arts, memes',
        color: 'pink',
    },
    sports: {
        label: 'Sports',
        icon: '⚽',
        description: 'Games, championships, records',
        color: 'orange',
    },
};
