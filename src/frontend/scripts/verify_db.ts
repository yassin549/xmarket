import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), 'src/frontend/.env.local') });

import { query, closePool } from '../lib/infra/db/pool';

async function verifyDatabase() {
    console.log('🔍 Verifying database state...');

    try {
        // 1. Check Tables
        const tables = ['variables', 'reality_data', 'historical_values', 'orders'];
        for (const table of tables) {
            const res = await query(
                `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = $1
         );`,
                [table]
            );
            const exists = res.rows[0].exists;
            console.log(`${exists ? '✅' : '❌'} Table '${table}' exists`);

            if (!exists) throw new Error(`Missing table: ${table}`);
        }

        // 2. Check Functions
        const funcRes = await query(
            `SELECT EXISTS (
         SELECT FROM pg_proc 
         WHERE proname = 'update_updated_at_column'
       );`
        );
        console.log(`${funcRes.rows[0].exists ? '✅' : '❌'} Function 'update_updated_at_column' exists`);

        // 3. Check Data
        const varCount = await query('SELECT COUNT(*) FROM variables');
        console.log(`📊 Variables count: ${varCount.rows[0].count}`);

        if (parseInt(varCount.rows[0].count) === 0) {
            console.warn('⚠️ No variables found! Migration 001 might have failed to insert sample data.');
        } else {
            console.log('✅ Sample data present');
        }

        console.log('🎉 Database verification passed!');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await closePool();
    }
}

verifyDatabase();
