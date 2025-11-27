/**
 * Apply Migration 005: Channel Counters
 */

import { config } from 'dotenv';
import { query } from './infra/db/pool';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

async function applyMigration() {
    console.log('📦 Applying Migration 005: Channel Counters...');

    try {
        // Read migration file
        const migrationPath = path.join(__dirname, 'infra', 'migrations', '005_create_channel_counters.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');

        // Execute migration
        await query(sql);

        console.log('✅ Migration 005 applied successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

applyMigration();
