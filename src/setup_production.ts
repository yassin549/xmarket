/**
 * Production Database Setup
 * Quick seed with minimal test data
 */

import { config } from 'dotenv';
import { query } from './infra/db/pool';

config();

async function setupProduction() {
    console.log('🚀 Setting up production database...\n');

    try {
        // 1. Create system user
        const systemUserId = '00000000-0000-0000-0000-000000000001';

        await query(
            `INSERT INTO users (user_id, email, password_hash, role, display_name, is_active, email_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (user_id) DO NOTHING`,
            [systemUserId, 'system@xmarket.local', 'placeholder', 'admin', 'System', true, true]
        );
        console.log('✅ System user created');

        // 2. Create Audit Event (required for markets)
        const auditId = '00000000-0000-0000-0000-000000000002';

        await query(
            `INSERT INTO audit_event (audit_id, action, actor_type, actor_id, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (audit_id) DO NOTHING`,
            [auditId, 'MARKET_CREATION', 'system', systemUserId]
        );
        console.log('✅ Audit event created');

        // 3. Create 3 simple test markets
        const markets = [
            ['BTC-USD', 'Bitcoin reaches $100k', 'Will BTC hit $100k?', 'finance', 'Global', 'high'],
            ['ELECTION-2024', '2024 US Election', 'Electoral outcome', 'political', 'USA', 'medium'],
            ['ETH-USD', 'Ethereum $10k', 'Will ETH reach $10k?', 'finance', 'Global', 'high'],
        ];

        for (const [symbol, title, desc, type, region, risk] of markets) {
            await query(
                `INSERT INTO markets (symbol, title, description, type, region, risk_level, created_by, human_approval_audit_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}')
                 ON CONFLICT (symbol) DO NOTHING`,
                [symbol, title, desc, type, region, risk, systemUserId, auditId]
            );
            console.log(`✅ ${symbol}`);
        }

        // 4. Verify
        const count = await query('SELECT COUNT(*) as count FROM markets');
        console.log(`\n✅ Setup complete. Markets: ${count.rows[0].count}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setupProduction();
