#!/usr/bin/env node
/**
 * Database Migration Runner - With Better Error Reporting
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const migrations = [
    '000_functions.sql',
    '001_create_variables.sql',
    '002_create_core_schema.sql',
    '004_create_trades_orders.sql',
    '005_create_channel_counters.sql',
    '007_create_reality_data.sql',
    '008_create_historical_values.sql'
];

async function runMigrations() {
    const pool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔄 Starting database migrations...\n');

        for (const migration of migrations) {
            const filePath = join(__dirname, 'infra', 'migrations', migration);

            try {
                const sql = readFileSync(filePath, 'utf-8');
                console.log(`📝 Running migration: ${migration}`);
                await pool.query(sql);
                console.log(`✅ Completed: ${migration}\n`);
            } catch (error) {
                console.error(`❌ Failed on migration: ${migration}`);
                console.error('Error details:', error.message);
                console.error('Error code:', error.code);

                // Continue or stop?
                if (error.code === '42P07') {
                    // Relation already exists - can continue
                    console.log('⚠️  Object already exists, continuing...\n');
                } else if (error.code === '42703') {
                    // Column doesn't exist
                    console.error('Column reference issue - stopping.');
                    throw error;
                } else {
                    throw error;
                }
            }
        }

        console.log('🎉 All migrations completed!');
    } catch (error) {
        console.error('\n💥 Migration process failed.');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
