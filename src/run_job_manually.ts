import 'dotenv/config';
import { query } from './infra/db/pool';
import DiscoverEventsExecutor from './reality/actions/discover_events';

async function run() {
    try {
        console.log('Checking for ELON-IQ variable...');

        // 1. Check/Create Variable
        let result = await query("SELECT variable_id FROM variables WHERE symbol = 'ELON-IQ'");
        let variableId;

        if (result.rows.length === 0) {
            console.log('Creating ELON-IQ variable...');
            const insert = await query(`
        INSERT INTO variables (
          symbol, name, description, category, 
          status, is_tradeable, reality_value, initial_value,
          llm_context
        ) VALUES (
          'ELON-IQ', 
          'Elon Musk Intelligence', 
          'Perceived intelligence based on decisions', 
          'tech',
          'active', 
          true, 
          100, 
          100,
          'Focus on business decisions, technical innovations, public statements'
        ) RETURNING variable_id
      `);
            variableId = insert.rows[0].variable_id;
        } else {
            variableId = result.rows[0].variable_id;
            console.log('Variable exists:', variableId);
        }

        // 2. Run Job Executor
        console.log('\nRunning DiscoverEventsExecutor...');

        // Force Qwen2.5 for test
        process.env.AGENT_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

        const executor = new DiscoverEventsExecutor();
        const summary = await executor.execute({ variable_id: variableId });

        console.log('\n✅ Job Execution Complete:');
        console.log(JSON.stringify(summary, null, 2));

        // 3. Verify Data
        const events = await query(`
      SELECT summary, impact_score, status 
      FROM candidate_events 
      WHERE variable_name = 'Elon Musk Intelligence'
      ORDER BY created_at DESC LIMIT 3
    `);

        console.log('\nLatest Events in DB:');
        events.rows.forEach(r => console.log(`- [${r.status}] ${r.impact_score}: ${r.summary.substring(0, 50)}...`));

        const history = await query(`
      SELECT reality_value, timestamp 
      FROM historical_values 
      WHERE variable_id = $1 
      ORDER BY timestamp DESC LIMIT 3
    `, [variableId]);

        console.log('\nLatest History Snapshots:');
        history.rows.forEach(r => console.log(`- ${r.timestamp.toISOString()}: ${r.reality_value}`));

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

run();
