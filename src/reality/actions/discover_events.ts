import { JobExecutor } from '../../infra/jobs/executors';
import { query } from '../../infra/db/pool';
import { WebSearchAgent } from '../agents/web_search_agent';
import { updateHistoricalValues } from './update_historical_values';

export class DiscoverEventsExecutor implements JobExecutor {
    /**
     * Main job execution function
     * 
     * Flow:
     * 1. Fetch variable from database
     * 2. Run WebSearchAgent discovery
     * 3. Store candidate events
     * 4. Auto-approve high-quality events
     * 5. Update historical values for approved events
     * 
     * @param payload - { variable_id: string }
     * @returns Execution summary
     */
    async execute(payload: any): Promise<any> {
        const { variable_id } = payload;

        if (!variable_id) {
            throw new Error('variable_id is required in payload');
        }

        console.log(`\n[DiscoverEvents] Processing variable: ${variable_id}`);

        // 1. Fetch variable details
        const variableResult = await query(`
      SELECT 
        variable_id, symbol, name, description, category, 
        llm_context, reality_value, initial_value
      FROM variables
      WHERE variable_id = $1 AND status = 'active'
    `, [variable_id]);

        if (variableResult.rows.length === 0) {
            throw new Error(`Variable not found or inactive: ${variable_id}`);
        }

        const variable = variableResult.rows[0];

        // 2. Run autonomous discovery
        const agent = new WebSearchAgent();
        const events = await agent.discoverEventsForVariable(variable);

        console.log(`[DiscoverEvents] Discovered ${events.length} events`);

        if (events.length === 0) {
            console.log(`[DiscoverEvents] No events found for ${variable.symbol}`);
            return {
                variable_id,
                variable_name: variable.name,
                discovered: 0,
                approved: 0,
                pending: 0
            };
        }

        // 3. Store candidate events and handle auto-approval
        let approvedCount = 0;
        let pendingCount = 0;

        const MIN_SCORE = Number(process.env.APPROVAL_MIN_SCORE) || 65;
        const MIN_CONFIDENCE = Number(process.env.APPROVAL_MIN_CONFIDENCE) || 0.80;

        for (const event of events) {
            // Auto-approval logic
            const status = (event.impact_score >= MIN_SCORE && event.confidence >= MIN_CONFIDENCE)
                ? 'approved'
                : 'pending';

            // Check for duplicates
            const existing = await query(`
        SELECT candidate_id FROM candidate_events 
        WHERE dedupe_hash = $1
      `, [event.snapshot_id]);

            if (existing.rows.length > 0) {
                console.log(`[DiscoverEvents] Skipping duplicate: ${event.summary.substring(0, 50)}...`);
                continue;
            }

            // Insert candidate event
            await query(`
        INSERT INTO candidate_events (
          snapshot_id,
          summary,
          confidence,
          metadata,
          dedupe_hash,
          status,
          impact_score,
          llm_reasoning,
          variable_name,
          variable_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
                event.snapshot_id,
                event.summary,
                event.confidence,
                JSON.stringify({
                    sources: event.sources,
                    keywords: event.keywords_found,
                    discovery_method: 'autonomous_llm_search',
                    model: process.env.AGENT_MODEL || 'Qwen/Qwen2.5-7B-Instruct'
                }),
                event.snapshot_id,
                status,
                event.impact_score,
                event.reasoning,
                variable.name,
                variable.description || ''
            ]);

            console.log(`[DiscoverEvents] Created ${status} event: ${event.summary.substring(0, 60)}...`);

            // Update counts
            if (status === 'approved') {
                approvedCount++;

                // Calculate new reality value based on impact
                const currentValue = parseFloat(variable.reality_value || variable.initial_value || '100');
                const impactMultiplier = (event.impact_score - 50) / 100; // -0.5 to +0.5
                const newRealityValue = currentValue * (1 + impactMultiplier);

                // Update historical snapshot
                await updateHistoricalValues(variable.variable_id, newRealityValue);

                console.log(`[DiscoverEvents] Updated reality: ${currentValue} → ${newRealityValue.toFixed(2)}`);
            } else {
                pendingCount++;
            }
        }

        // 4. Update variable's last_reality_update timestamp
        await query(`
      UPDATE variables 
      SET last_reality_update = NOW()
      WHERE variable_id = $1
    `, [variable_id]);

        return {
            variable_id,
            variable_name: variable.name,
            discovered: events.length,
            approved: approvedCount,
            pending: pendingCount,
            auto_approval_rate: (approvedCount / events.length * 100).toFixed(1) + '%'
        };
    }
}

export default DiscoverEventsExecutor;
