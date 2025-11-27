/**
 * Apply Migration 004: Orders and Trades
 */

import { config } from 'dotenv';
import { query } from './infra/db/pool';
import * as fs from 'fs';

config();

async function applyMigration() {
    console.log('📦 Applying Migration 004: Orders and Trades...\n');

    try {
        const sql = fs.readFileSync('./infra/migrations/004_create_trades_orders.sql', 'utf-8');
        await query(sql);

        console.log('✅ Migration 004 applied successfully\n');

        // Verify tables created
        const result = await query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('orders', 'trades')
            ORDER BY tablename
        `);

        console.log('Verified tables:');
        result.rows.forEach((row: any) => console.log(`  ✅ ${row.tablename}`));

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

applyMigration();
