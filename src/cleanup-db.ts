#!/usr/bin/env node
/**
 * Database Cleanup - Drop all tables for fresh start
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function cleanup() {
    const pool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🧹 Cleaning up database...\n');

        // Drop tables in reverse dependency order
        const dropStatements = [
            'DROP TABLE IF EXISTS trades CASCADE;',
            'DROP TABLE IF EXISTS orders CASCADE;',
            'DROP TABLE IF EXISTS historical_values CASCADE;',
            'DROP TABLE IF EXISTS reality_data CASCADE;',
            'DROP TABLE IF EXISTS channel_counters CASCADE;',
            'DROP TABLE IF EXISTS events CASCADE;',
            'DROP TABLE IF EXISTS snapshots CASCADE;',
            'DROP TABLE IF EXISTS markets CASCADE;',
            'DROP TABLE IF EXISTS audit_event CASCADE;',
            'DROP TABLE IF EXISTS users CASCADE;',
            'DROP TABLE IF EXISTS variables CASCADE;'
        ];

        for (const statement of dropStatements) {
            console.log(`📝 ${statement}`);
            await pool.query(statement);
        }

        console.log('\n✅ Database cleaned successfully!');
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

cleanup();
