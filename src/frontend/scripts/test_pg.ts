import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), 'src/frontend/.env.local') });

import { Pool } from 'pg';

async function test() {
    console.log('Testing pg connection...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query('SELECT 1 as test');
        console.log('Query result:', res.rows[0]);
        console.log('Connection successful!');
    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await pool.end();
    }
}

test();
