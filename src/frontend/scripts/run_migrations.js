const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), 'src/frontend/.env.local') });

const MIGRATIONS_DIR = path.join(process.cwd(), 'src/infra/migrations');

async function runMigrations() {
    console.log('Starting database migrations (JS)...');

    // Fallback for NEON_DATABASE_URL
    if (!process.env.DATABASE_URL && process.env.NEON_DATABASE_URL) {
        process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
    }

    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Get all SQL files
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration files.`);

        for (const file of files) {
            console.log(`Running migration: ${file}`);
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await pool.query(sql);
                console.log(`✅ Successfully applied ${file}`);
            } catch (error) {
                console.error(`❌ Failed to apply ${file}:`, error);
                throw error;
            }
        }

        console.log('🎉 All migrations completed successfully!');
    } catch (error) {
        console.error('Migration process failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
