/**
 * Seed Test Data (Users + Markets)
 */

import { config } from 'dotenv';
import { query } from './infra/db/pool';

config();

const markets = [
    {
        symbol: 'BTC-USD',
        title: 'Bitcoin Price Prediction',
        description: 'Will Bitcoin reach $100,000 by end of 2024?',
        type: 'finance',
        region: 'Global',
        risk_level: 'high',
        human_approval: false,
    },
    {
        symbol: 'ELECTION-2024',
        title: '2024 US Presidential Election',
        description: 'Prediction market for 2024 presidential outcome',
        type: 'political',
        region: 'United States',
        risk_level: 'medium',
        human_approval: true,
        approved_by: 'admin',
        approved_at: new Date(),
    },
    {
        symbol: 'AI-BREAKTHROUGH',
        title: 'Next Major AI Breakthrough',
        description: 'When will the next significant AI milestone be achieved?',
        type: 'tech',
        region: 'Global',
        risk_level: 'medium',
        human_approval: false,
    },
    {
        symbol: 'CLIMATE-GOALS',
        title: 'Paris Climate Agreement Goals',
        description: 'Will major countries meet their 2030 emissions targets?',
        type: 'social',
        region: 'Global',
        risk_level: 'low',
        human_approval: true,
        approved_by: 'admin',
        approved_at: new Date(),
    },
    {
        symbol: 'ETH-USD',
        title: 'Ethereum Price Prediction',
        description: 'Will Ethereum reach $10,000 in 2024?',
        type: 'finance',
        region: 'Global',
        risk_level: 'high',
        human_approval: false,
    },
    {
        symbol: 'WORLD-CUP-2026',
        title: '2026 FIFA World Cup Winner',
        description: 'Which team will win the 2026 World Cup?',
        type: 'sports',
        region: 'Global',
        risk_level: 'low',
        human_approval: false,
    },
    {
        symbol: 'INFLATION-US',
        title: 'US Inflation Rate 2024',
        description: 'Will US inflation fall below 2% in 2024?',
        type: 'economic',
        region: 'United States',
        risk_level: 'medium',
        human_approval: true,
        approved_by: 'admin',
        approved_at: new Date(),
    },
];

console.log('Creating test markets...');
for (const market of markets) {
    await query(
        `INSERT INTO markets (symbol, title, description, type, region, risk_level, created_by, human_approval_audit_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (symbol) DO NOTHING`,
        [
            market.symbol,
            market.title,
            market.description,
            market.type,
            market.region,
            market.risk_level,
            placeholderUserId,
            placeholderAuditId,
            JSON.stringify({
                approved_by: market.approved_by || null,
                approved_at: market.approved_at || null,
                human_approval: market.human_approval,
            }),
        ]
    );
    console.log(`  ✅ ${market.symbol} (${market.type})`);
}

console.log(`\n✅ Seeded ${markets.length} test markets`);

// Verify
const result = await query('SELECT COUNT(*) as count FROM markets');
console.log(`📊 Total markets in database: ${result.rows[0].count}\n`);

process.exit(0);
    } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
}
}

seedAll();
