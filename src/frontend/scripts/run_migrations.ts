import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), 'src/frontend/.env.local') });

import { query, closePool } from '../lib/infra/db/pool';

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/infra/migrations');

async function runMigrations() {
    console.log('Starting database migrations...');

    try {
        // Get all SQL files
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Ensure order by filename (000, 001, etc.)

        console.log(`Found ${files.length} migration files.`);

        for (const file of files) {
            console.log(`Running migration: ${file}`);
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await query(sql);
                console.log(`✅ Successfully applied ${file}`);
            } catch (error) {
                console.error(`❌ Failed to apply ${file}:`, error);
                throw error; // Stop on first failure
            }
        }

        console.log('🎉 All migrations completed successfully!');
    } catch (error) {
        console.error('Migration process failed:', error);
        process.exit(1);
    } finally {
        await closePool();
    }
}

runMigrations();
