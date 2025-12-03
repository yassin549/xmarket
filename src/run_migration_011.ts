import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'src/.env') });

import { query } from './infra/db/pool';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    try {
        console.log('Running migration 011...');

        const migrationPath = path.join(process.cwd(), 'src/infra/migrations/011_remove_url_fields.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await query(sql);
        console.log('✅ Migration 011 applied successfully');

        // Verify
        const result = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'variables'");
        const columns = result.rows.map(r => r.column_name);
        console.log('\nVariables columns:', columns);

        if (!columns.includes('reality_sources')) {
            console.log('✓ reality_sources removed');
        }

        const histResult = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'historical_values'");
        const histColumns = histResult.rows.map(r => r.column_name);

        if (histColumns.includes('buy_volume_24h')) {
            console.log('✓ buy_volume_24h added');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
