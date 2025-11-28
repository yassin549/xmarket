/**
 * Cron Job: Update Trading Values
 * 
 * This endpoint is called by Vercel Cron (every 5 minutes)
 * to update trading chart values (blend reality + market).
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-trading-values",
 *     "schedule": "*/5 * * * * "
    *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateAllTradingValues } from '@/lib/charts/calculateTradingValue';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max execution time

/**
 * GET /api/cron/update-trading-values
 * 
 * Runs the chart blender for all variables
 */
export async function GET(request: NextRequest) {
    console.log('[Cron] Trading values update triggered');

    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Cron] Unauthorized request');
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const startTime = Date.now();

        // Update all trading values
        const updates = await updateAllTradingValues();

        const duration = Date.now() - startTime;

        // Log summary
        const summary = {
            totalVariables: updates.length,
            variablesIncreased: updates.filter(u => u.change > 0).length,
            variablesDecreased: updates.filter(u => u.change < 0).length,
            variablesUnchanged: updates.filter(u => u.change === 0).length,
            avgChange: updates.reduce((sum, u) => sum + u.changePercent, 0) / updates.length,
            durationMs: duration
        };

        console.log('[Cron] Trading values update completed:', summary);

        return NextResponse.json({
            success: true,
            summary,
            updates: updates.map(u => ({
                symbol: u.symbol,
                realityValue: u.realityValue.toFixed(2),
                marketValue: u.marketValue.toFixed(2),
                tradingValue: u.tradingValue.toFixed(2),
                changePercent: u.changePercent.toFixed(2) + '%'
            }))
        });

    } catch (error) {
        console.error('[Cron] Trading values update failed:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/cron/update-trading-values
 * 
 * Manual trigger (for testing/admin use)
 */
export async function POST(request: NextRequest) {
    console.log('[Manual] Trading values update triggered');
    return GET(request);
}
