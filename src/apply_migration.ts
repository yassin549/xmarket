
import db from './infra/db/pool';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: './frontend/.env.local' });

async function applyMigration() {
    console.log('🚀 Applying Migration 003...');

    const migrationPath = path.join(__dirname, 'infra/migrations/003_create_candidate_events.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`   Reading SQL from: ${migrationPath}`);

    try {
        await db.query(sql);
        console.log('   ✅ Migration applied successfully');
    } catch (error) {
        console.error('   ❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await db.closePool();
    }
}

applyMigration().catch(console.error);
