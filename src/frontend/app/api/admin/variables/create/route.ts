/**
 * Admin API: Create Stock/Variable
 * 
 * POST /api/admin/variables/create
 * 
 * Allows admins to create new tradable stocks/variables with reality sources configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

interface CreateVariableRequest {
    symbol: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    reality_sources: string[];
    impact_keywords: string[];
    llm_context?: string;
    initial_value: number;
}

const VALID_CATEGORIES = [
    'tech', 'politics', 'environment', 'economy', 'society', 'culture', 'health', 'energy'
];

/**
 * Validate symbol format
 */
function validateSymbol(symbol: string): { valid: boolean; error?: string } {
    if (!symbol || symbol.length < 2 || symbol.length > 20) {
        return { valid: false, error: 'Symbol must be 2-20 characters' };
    }

    if (!/^[A-Z0-9-]+$/.test(symbol)) {
        return {
            valid: false,
            error: 'Symbol must contain only uppercase letters, numbers, and hyphens'
        };
    }

    return { valid: true };
}

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
 * POST /api/admin/variables/create
 */
export async function POST(request: NextRequest) {
    try {
        // TODO: Add admin authentication middleware
        // const user = await getAuthUser(request);
        // if (!user || user.role !== 'admin') {
        //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        // }

        const body: CreateVariableRequest = await request.json();

        // Validate symbol
        const symbolValidation = validateSymbol(body.symbol);
        if (!symbolValidation.valid) {
            return NextResponse.json(
                { success: false, error: symbolValidation.error },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!body.name || !body.description) {
            return NextResponse.json(
                { success: false, error: 'Name and description are required' },
                { status: 400 }
            );
        }

        // Validate category
        if (!VALID_CATEGORIES.includes(body.category)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
                },
                { status: 400 }
            );
        }

        // Validate reality sources
        if (!body.reality_sources || body.reality_sources.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one reality source URL is required' },
                { status: 400 }
            );
        }

        // Validate all URLs
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

        // Validate initial value
        if (!body.initial_value || body.initial_value <= 0) {
            return NextResponse.json(
                { success: false, error: 'Initial value must be positive' },
                { status: 400 }
            );
        }

        // Check symbol uniqueness
        const existingSymbol = await query(
            'SELECT variable_id FROM variables WHERE symbol = $1',
            [body.symbol.toUpperCase()]
        );

        if (existingSymbol.rows.length > 0) {
            return NextResponse.json(
                { success: false, error: 'Symbol already exists' },
                { status: 409 }
            );
        }

        // Insert new variable
        const result = await query(
            `INSERT INTO variables (
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
        is_tradeable
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        initial_value,
        reality_value,
        status,
        created_at`,
            [
                body.symbol.toUpperCase(),
                body.name,
                body.description,
                body.category,
                JSON.stringify(body.tags || []),
                JSON.stringify(body.reality_sources),
                JSON.stringify(body.impact_keywords || []),
                body.llm_context || null,
                body.initial_value,
                body.initial_value, // Set reality_value to initial_value
                body.initial_value, // Set trading_value to initial_value
                'active',
                true
            ]
        );

        const variable = result.rows[0];

        console.log(`[Admin] Created variable: ${variable.symbol} (${variable.variable_id})`);

        return NextResponse.json({
            success: true,
            variable: {
                ...variable,
                tags: JSON.parse(variable.tags),
                reality_sources: JSON.parse(variable.reality_sources),
                impact_keywords: JSON.parse(variable.impact_keywords)
            }
        });

    } catch (error) {
        console.error('Error creating variable:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to create variable',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
