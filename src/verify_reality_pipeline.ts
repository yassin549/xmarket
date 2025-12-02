
import { updateAllVariables } from './frontend/lib/reality/calculateRealityValue';
import { query } from './frontend/lib/infra/db/pool';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, 'frontend/.env.local') });

async function verifyPipeline() {
    console.log('🧪 Starting Reality Engine Verification...');

    const TEST_SYMBOL = 'TEST_REALITY_' + Date.now();
    let variableId: string | null = null;

    try {
        // 1. Create Test Variable
        console.log(`\n1. Creating test variable ${TEST_SYMBOL}...`);
        const insertResult = await query<{ variable_id: string }>(
            `INSERT INTO variables (
                symbol, name, description, category, reality_sources, impact_keywords, initial_value, status, is_tradeable
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', true)
            RETURNING variable_id`,
            [
                TEST_SYMBOL,
                'Test Reality Variable',
                'A test variable for verification',
                'tech',
                JSON.stringify(['https://example.com']), // Use a safe, static URL
                JSON.stringify(['example', 'domain']),
                100.00
            ]
        );
        variableId = insertResult.rows[0].variable_id;
        console.log(`✅ Created variable: ${variableId}`);

        // 2. Trigger Update
        console.log('\n2. Triggering Reality Engine update...');
        const results = await updateAllVariables();

        const myResult = results.find(r => r.variableId === variableId);

        if (!myResult) {
            throw new Error('Test variable was not updated!');
        }
        console.log('✅ Update triggered successfully');
        console.log('Result:', myResult);

        // 3. Verify Database Updates
        console.log('\n3. Verifying database state...');

        // Check variables table
        const varResult = await query(
            `SELECT reality_value, trading_value, last_reality_update FROM variables WHERE variable_id = $1`,
            [variableId]
        );
        const updatedVar = varResult.rows[0];
        console.log('Variable State:', updatedVar);

        if (!updatedVar.last_reality_update) throw new Error('last_reality_update not set');
        if (updatedVar.reality_value === null) throw new Error('reality_value is null');

        // Check history table
        const historyResult = await query(
            `SELECT * FROM historical_values WHERE variable_id = $1 ORDER BY timestamp DESC LIMIT 1`,
            [variableId]
        );

        if (historyResult.rows.length === 0) {
            throw new Error('No history record created!');
        }
        console.log('✅ History record found:', historyResult.rows[0]);

        // Check reality_data table
        const dataResult = await query(
            `SELECT * FROM reality_data WHERE variable_id = $1`,
            [variableId]
        );

        if (dataResult.rows.length === 0) {
            throw new Error('No scraped data found!');
        }
        console.log(`✅ Found ${dataResult.rows.length} scraped data records`);

        console.log('\n🎉 VERIFICATION SUCCESSFUL!');

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error);
        process.exit(1);
    } finally {
        // Cleanup
        if (variableId) {
            console.log('\n🧹 Cleaning up...');
            await query(`DELETE FROM variables WHERE variable_id = $1`, [variableId]);
            console.log('Cleanup complete');
        }
        process.exit(0);
    }
}

verifyPipeline();
