import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'src/.env') });

import { query } from './infra/db/pool';
import fs from 'fs';

async function runMigration() {
    try {
        console.log('Running migration 012...');

        const migrationPath = path.join(process.cwd(), 'src/infra/migrations/012_fix_candidate_events.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await query(sql);
        console.log('✅ Migration 012 applied successfully');

        // Verify
        const result = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'candidate_events'");
        const columns = result.rows.map(r => r.column_name);
        console.log('\nCandidate Events columns:', columns);

        if (columns.includes('impact_score')) {
            console.log('✓ impact_score added');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
