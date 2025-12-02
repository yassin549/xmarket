/**
 * Admin API: List All Variables
 * 
 * GET /api/admin/variables
 * 
 * Returns all variables for admin management with filtering and pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

/**
 * GET /api/admin/variables?status=active&category=tech&limit=50&offset=0
 */
export async function GET(request: NextRequest) {
    try {
        // TODO: Add admin authentication middleware

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const category = searchParams.get('category');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        let sql = `
      SELECT 
        variable_id,
        symbol,
        name,
        description,
        category,
        tags,
        reality_sources,
        impact_keywords,
        llm_context,
        initial_value,
        reality_value,
        trading_value,
        status,
        is_tradeable,
        created_at,
        updated_at,
        last_reality_update
      FROM variables
      WHERE 1=1
    `;

        const params: any[] = [];
        let paramIndex = 1;

        // Filter by status
        if (status) {
            sql += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        // Filter by category
        if (category) {
            sql += ` AND category = $${paramIndex++}`;
            params.push(category);
        }

        // Order and pagination
        sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        // Parse JSONB fields
        const variables = result.rows.map(row => ({
            ...row,
            tags: JSON.parse(row.tags || '[]'),
            reality_sources: JSON.parse(row.reality_sources || '[]'),
            impact_keywords: JSON.parse(row.impact_keywords || '[]')
        }));

        return NextResponse.json({
            success: true,
            variables,
            count: result.rowCount
        });

    } catch (error) {
        console.error('Error fetching variables:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch variables',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
