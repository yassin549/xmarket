const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(process.cwd(), 'src/frontend/.env.local') });

// Fallback for NEON_DATABASE_URL
if (!process.env.DATABASE_URL && process.env.NEON_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
}

async function verifyDatabase() {
    console.log('🔍 Verifying database state...\n');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 1. Check Core Tables
        console.log('=== Core Tables ===');
        const coreTables = ['variables', 'reality_data', 'historical_values', 'orders', 'trades', 'users'];
        for (const table of coreTables) {
            const res = await pool.query(
                `SELECT EXISTS (
           SELECT FROM information_schema.tables 
           WHERE table_schema = 'public' 
           AND table_name = $1
         );`,
                [table]
            );
            const exists = res.rows[0].exists;
            console.log(`${exists ? '✅' : '❌'} Table '${table}'`);
        }

        // 2. Check Functions
        console.log('\n=== Functions ===');
        const functions = ['update_updated_at_column', 'get_latest_value'];
        for (const func of functions) {
            const res = await pool.query(
                `SELECT EXISTS (
           SELECT FROM pg_proc 
           WHERE proname = $1
         );`,
                [func]
            );
            console.log(`${res.rows[0].exists ? '✅' : '❌'} Function '${func}'`);
        }

        // 3. Check Sample Data
        console.log('\n=== Sample Data ===');
        const varCount = await pool.query('SELECT COUNT(*) FROM variables');
        console.log(`📊 Variables: ${varCount.rows[0].count}`);

        if (parseInt(varCount.rows[0].count) > 0) {
            const vars = await pool.query('SELECT symbol, name, reality_value, market_value, trading_value FROM variables LIMIT 5');
            vars.rows.forEach(v => {
                console.log(`  - ${v.symbol}: ${v.name}`);
                console.log(`    Reality: ${v.reality_value}, Market: ${v.market_value}, Trading: ${v.trading_value}`);
            });
        }

        // 4. Check Variable ID column in orders
        console.log('\n=== Schema Validation ===');
        const ordersCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name IN ('variable_id', 'symbol', 'market_id')
    `);
        console.log('Orders table columns:');
        ordersCols.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        const hasVariableId = ordersCols.rows.some(c => c.column_name === 'variable_id');
        const hasSymbol = ordersCols.rows.some(c => c.column_name === 'symbol');

        if (hasVariableId && !hasSymbol) {
            console.log('✅ Orders table correctly references variables (not symbol)');
        } else if (hasSymbol) {
            console.log('⚠️ Orders table still has symbol column (should be variable_id)');
        }

        console.log('\n🎉 Database verification complete!');
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifyDatabase();
