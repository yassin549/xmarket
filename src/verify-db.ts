#!/usr/bin/env node
/**
 * Verify Database Schema
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function verifySchema() {
    const pool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔍 Verifying database schema...\n');

        // Check tables
        const tables = await pool.query(`
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename;
        `);

        console.log('📋 Tables created:');
        tables.rows.forEach(row => console.log(`  ✓ ${row.tablename}`));

        // Check sample variables
        const variables = await pool.query('SELECT variable_id, symbol, name FROM variables LIMIT 5;');

        console.log('\n📊 Sample variables:');
        if (variables.rows.length === 0) {
            console.log('  ⚠️  No variables found - you may need to seed data');
        } else {
            variables.rows.forEach(v => console.log(`  ✓ ${v.symbol}: ${v.name}`));
        }

        console.log('\n✅ Database schema verification complete!');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifySchema();
