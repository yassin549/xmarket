import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

export async function GET(
    request: NextRequest,
    { params }: { params: { symbol: string } }
) {
    try {
        // Get variable
        const varResult = await query(`
      SELECT variable_id FROM variables WHERE symbol = $1
    `, [params.symbol]);

        if (varResult.rows.length === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Get hourly buy/sell data for last 24h
        const pressureData = await query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        SUM(CASE WHEN side = 'buy' THEN quantity ELSE 0 END) as buy_volume,
        SUM(CASE WHEN side = 'sell' THEN quantity ELSE 0 END) as sell_volume,
        COUNT(DISTINCT CASE WHEN side = 'buy' THEN user_id END) as buyers,
        COUNT(DISTINCT CASE WHEN side = 'sell' THEN user_id END) as sellers
      FROM trades
      WHERE variable_id = $1
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
    `, [varResult.rows[0].variable_id]);

        // Calculate pressure ratio
        const totalBuy = pressureData.rows.reduce((sum, r) => sum + parseFloat(r.buy_volume), 0);
        const totalSell = pressureData.rows.reduce((sum, r) => sum + parseFloat(r.sell_volume), 0);
        const buyPressure = totalBuy / (totalBuy + totalSell + 0.0001); // 0-1

        return NextResponse.json({
            symbol: params.symbol,
            buyPressure, // 0 = all sell, 1 = all buy, 0.5 = balanced
            totalBuyers: pressureData.rows.reduce((sum, r) => sum + r.buyers, 0),
            totalSellers: pressureData.rows.reduce((sum, r) => sum + r.sellers, 0),
            hourlyData: pressureData.rows.map(row => ({
                hour: row.hour,
                buyVolume: parseFloat(row.buy_volume),
                sellVolume: parseFloat(row.sell_volume),
                buyers: row.buyers,
                sellers: row.sellers
            }))
        });

    } catch (error) {
        console.error('[API] Volume profile error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
