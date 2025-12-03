import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

export async function GET(
    request: NextRequest,
    { params }: { params: { symbol: string } }
) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || '24h';

        // Map time ranges to SQL intervals
        const intervalMap: Record<string, string> = {
            '1h': '1 hour',
            '24h': '24 hours',
            '7d': '7 days',
            '30d': '30 days',
            '90d': '90 days'
        };

        const interval = intervalMap[range] || '24 hours';

        // Fetch variable metadata
        const varResult = await query(`
      SELECT 
        variable_id, symbol, name, category,
        reality_value, initial_value
      FROM variables
      WHERE symbol = $1 AND status = 'active'
    `, [params.symbol]);

        if (varResult.rows.length === 0) {
            return NextResponse.json(
                { error: 'Variable not found' },
                { status: 404 }
            );
        }

        const variable = varResult.rows[0];

        // Fetch historical data (reality value only)
        const historyResult = await query(`
      SELECT 
        reality_value,
        buy_volume_24h,
        sell_volume_24h,
        unique_buyers_24h,
        unique_sellers_24h,
        change_1h,
        change_24h,
        change_7d,
        timestamp
      FROM historical_values
      WHERE variable_id = $1
        AND timestamp >= NOW() - INTERVAL '${interval}'
      ORDER BY timestamp ASC
    `, [variable.variable_id]);

        // Calculate current stats
        const latest = historyResult.rows[historyResult.rows.length - 1] || {};

        return NextResponse.json({
            variable: {
                symbol: variable.symbol,
                name: variable.name,
                category: variable.category,
                currentValue: parseFloat(variable.reality_value || variable.initial_value || '100')
            },
            history: historyResult.rows.map(row => ({
                value: parseFloat(row.reality_value),
                buyVolume: parseFloat(row.buy_volume_24h || '0'),
                sellVolume: parseFloat(row.sell_volume_24h || '0'),
                buyers: row.unique_buyers_24h || 0,
                sellers: row.unique_sellers_24h || 0,
                timestamp: row.timestamp
            })),
            stats: {
                change1h: parseFloat(latest.change_1h || '0'),
                change24h: parseFloat(latest.change_24h || '0'),
                change7d: parseFloat(latest.change_7d || '0'),
                dataPoints: historyResult.rows.length
            }
        });

    } catch (error) {
        console.error('[API] History error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
