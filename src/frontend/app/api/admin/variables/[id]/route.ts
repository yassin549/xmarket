/**
 * Admin API: Get/Update/Delete Single Variable
 * 
 * GET /api/admin/variables/:id - Fetch single variable
 * PUT /api/admin/variables/:id - Update variable configuration
 * DELETE /api/admin/variables/:id - Delist variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

interface UpdateVariableRequest {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    reality_sources?: string[];
    impact_keywords?: string[];
    llm_context?: string;
    status?: string;
    is_tradeable?: boolean;
}

const VALID_CATEGORIES = [
    'tech', 'politics', 'environment', 'economy', 'society', 'culture', 'health', 'energy'
];

const VALID_STATUSES = ['active', 'paused', 'delisted'];

/**
 * Validate URL format
 */
function validateURL(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * GET /api/admin/variables/:id
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // TODO: Add admin authentication

        const { id } = await params;

        const result = await query(
            `SELECT 
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
      WHERE variable_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Variable not found' },
                { status: 404 }
            );
        }

        const variable = result.rows[0];

        return NextResponse.json({
            success: true,
            variable: {
                ...variable,
                tags: JSON.parse(variable.tags || '[]'),
                reality_sources: JSON.parse(variable.reality_sources || '[]'),
                impact_keywords: JSON.parse(variable.impact_keywords || '[]')
            }
        });

    } catch (error) {
        console.error('Error fetching variable:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch variable',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/admin/variables/:id
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // TODO: Add admin authentication

        const { id } = await params;
        const body: UpdateVariableRequest = await request.json();

        // Validate category if provided
        if (body.category && !VALID_CATEGORIES.includes(body.category)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
                },
                { status: 400 }
            );
        }

        // Validate status if provided
        if (body.status && !VALID_STATUSES.includes(body.status)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Status must be one of: ${VALID_STATUSES.join(', ')}`
                },
                { status: 400 }
            );
        }

        // Validate reality sources URLs if provided
        if (body.reality_sources) {
            if (body.reality_sources.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'At least one reality source is required' },
                    { status: 400 }
                );
            }

            const invalidUrls = body.reality_sources.filter(url => !validateURL(url));
            if (invalidUrls.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid URLs: ${invalidUrls.join(', ')}`
                    },
                    { status: 400 }
                );
            }
        }

        // Build dynamic UPDATE query
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (body.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(body.name);
        }

        if (body.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(body.description);
        }

        if (body.category !== undefined) {
            updates.push(`category = $${paramIndex++}`);
            values.push(body.category);
        }

        if (body.tags !== undefined) {
            updates.push(`tags = $${paramIndex++}`);
            values.push(JSON.stringify(body.tags));
        }

        if (body.reality_sources !== undefined) {
            updates.push(`reality_sources = $${paramIndex++}`);
            values.push(JSON.stringify(body.reality_sources));
        }

        if (body.impact_keywords !== undefined) {
            updates.push(`impact_keywords = $${paramIndex++}`);
            values.push(JSON.stringify(body.impact_keywords));
        }

        if (body.llm_context !== undefined) {
            updates.push(`llm_context = $${paramIndex++}`);
            values.push(body.llm_context);
        }

        if (body.status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(body.status);
        }

        if (body.is_tradeable !== undefined) {
            updates.push(`is_tradeable = $${paramIndex++}`);
            values.push(body.is_tradeable);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No fields to update' },
                { status: 400 }
            );
        }

        // Always update updated_at
        updates.push(`updated_at = NOW()`);

        // Add variable_id as last parameter
        values.push(id);

        const sql = `
      UPDATE variables
      SET ${updates.join(', ')}
      WHERE variable_id = $${paramIndex}
      RETURNING 
        variable_id,
        symbol,
        name,
        description,
        category,
        tags,
        reality_sources,
        impact_keywords,
        llm_context,
        status,
        is_tradeable,
        updated_at
    `;

        const result = await query(sql, values);

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Variable not found' },
                { status: 404 }
            );
        }

        const variable = result.rows[0];

        console.log(`[Admin] Updated variable: ${variable.symbol}`);

        return NextResponse.json({
            success: true,
            variable: {
                ...variable,
                tags: JSON.parse(variable.tags || '[]'),
                reality_sources: JSON.parse(variable.reality_sources || '[]'),
                impact_keywords: JSON.parse(variable.impact_keywords || '[]')
            }
        });

    } catch (error) {
        console.error('Error updating variable:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update variable',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/admin/variables/:id
 * 
 * Soft delete by setting status to 'delisted'
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // TODO: Add admin authentication

        const { id } = await params;

        const result = await query(
            `UPDATE variables
       SET status = 'delisted', is_tradeable = false, updated_at = NOW()
       WHERE variable_id = $1
       RETURNING symbol`,
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Variable not found' },
                { status: 404 }
            );
        }

        console.log(`[Admin] Delisted variable: ${result.rows[0].symbol}`);

        return NextResponse.json({
            success: true,
            message: 'Variable delisted successfully'
        });

    } catch (error) {
        console.error('Error delisting variable:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to delist variable',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
