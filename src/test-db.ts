#!/usr/bin/env node
/**
 * Test Database Connection
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function testConnection() {
    const connectionString = process.env.NEON_DATABASE_URL;

    console.log('Testing database connection...');
    console.log('Connection string:', connectionString ? 'Set ✓' : 'Not set ✗');

    if (!connectionString) {
        console.error('❌ NEON_DATABASE_URL is not set in .env file');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const result = await pool.query('SELECT NOW() as time, version() as version');
        console.log('✅ Database connection successful!');
        console.log('Server time:', result.rows[0].time);
        console.log('PostgreSQL version:', result.rows[0].version.split('\n')[0]);
    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testConnection();
