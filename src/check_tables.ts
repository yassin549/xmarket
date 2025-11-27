/**
 * Check Database Tables
 */

import { config } from 'dotenv';
import { query } from './infra/db/pool';

config();

async function checkTables() {
    try {
        const result = await query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);

        console.log('\n📊 Database Tables:\n');
        result.rows.forEach((row: any) => {
            console.log(`  ✅ ${row.tablename}`);
        });
        console.log(`\nTotal: ${result.rowCount} tables\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkTables();
