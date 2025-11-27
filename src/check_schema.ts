/**
 * Check Users Table Schema
 */

import { config } from 'dotenv';
import { query } from './infra/db/pool';

config();

async function checkSchema() {
    try {
        const result = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Users Table Columns:\n');
        result.rows.forEach((row: any) => {
            console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkSchema();
