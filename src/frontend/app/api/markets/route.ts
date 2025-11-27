/**
 * Markets API Route
 * 
 * Handles fetching markets with filtering by type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';
import { Market } from '@/types/market';

/**
 * GET /api/markets
 * 
 * Query parameters:
 * - type: Filter by market type
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        let sql = `
      SELECT 
        market_id,
        symbol,
        title,
        description,
        type,
        region,
        risk_level,
        human_approval,
        approved_at,
        approved_by,
        status,
        created_at,
        updated_at
      FROM markets
      WHERE status = 'active'
    `;

        const params: any[] = [];
        let paramIndex = 1;

        if (type) {
            sql += ` AND type = $${paramIndex++}`;
            params.push(type);
        }

        sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await query<Market>(sql, params);

        return NextResponse.json({
            success: true,
            markets: result.rows,
            count: result.rowCount,
        });
    } catch (error) {
        console.error('Error fetching markets:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch markets',
            },
            { status: 500 }
        );
    }
}
