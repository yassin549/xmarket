import { NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

/**
 * Reality update cron job
 * Triggered 3x/day: 06:00, 14:00, 22:00 UTC
 * 
 * Creates discover_events jobs for all active variables
 * Priority: Oldest last_reality_update first
 */
export async function GET(request: Request) {
    try {
        console.log('[Cron] Reality update triggered at', new Date().toISOString());

        // Fetch all active variables, prioritize stale ones
        const variables = await query(`
      SELECT variable_id, symbol, name, last_reality_update
      FROM variables 
      WHERE status = 'active' AND is_tradeable = true
      ORDER BY last_reality_update ASC NULLS FIRST
      LIMIT 50
    `);

        console.log(`[Cron] Found ${variables.rows.length} active variables`);

        // Create discover_events jobs
        let scheduled = 0;
        for (const variable of variables.rows) {
            const idempotencyKey = `discover-${variable.variable_id}-${Date.now()}`;

            const result = await query(`
        INSERT INTO jobs (job_type, idempotency_key, payload, status, priority)
        VALUES ($1, $2, $3, 'pending', 1)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING job_id
      `, [
                'discover_events',
                idempotencyKey,
                JSON.stringify({ variable_id: variable.variable_id })
            ]);

            if (result.rows.length > 0) {
                scheduled++;
                console.log(`[Cron] Scheduled: ${variable.symbol} (last update: ${variable.last_reality_update || 'never'})`);
            }
        }

        return NextResponse.json({
            success: true,
            scheduled,
            total_variables: variables.rows.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Cron] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
