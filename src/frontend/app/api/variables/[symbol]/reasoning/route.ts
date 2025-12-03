import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

export async function GET(
    request: NextRequest,
    { params }: { params: { symbol: string } }
) {
    try {
        // Get variable
        const varResult = await query(`
      SELECT variable_id, symbol, name FROM variables
      WHERE symbol = $1
    `, [params.symbol]);

        if (varResult.rows.length === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const variable = varResult.rows[0];

        // Get latest approved events (last 5)
        const eventsResult = await query(`
      SELECT 
        summary,
        impact_score,
        confidence,
        llm_reasoning,
        metadata,
        created_at
      FROM candidate_events
      WHERE variable_name = $1 AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 5
    `, [variable.name]);

        const events = eventsResult.rows.map(row => {
            const meta = JSON.parse(row.metadata || '{}');
            return {
                summary: row.summary,
                impactScore: row.impact_score,
                confidence: parseFloat(row.confidence),
                reasoning: row.llm_reasoning,
                sources: meta.sources || [],
                keywords: meta.keywords || [],
                timestamp: row.created_at
            };
        });

        return NextResponse.json({
            variable: {
                symbol: variable.symbol,
                name: variable.name
            },
            latest: events[0] || null,
            recentEvents: events
        });

    } catch (error) {
        console.error('[API] Reasoning error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
