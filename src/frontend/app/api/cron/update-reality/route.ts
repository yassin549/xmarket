/**
 * Cron Job: Update Reality Values
 * 
 * This endpoint is called by Vercel Cron (every 15 minutes)
 * to update reality chart values for all active variables.
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-reality",
 *     "schedule": "* /15 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateAllVariables } from '@/lib/reality/calculateRealityValue';

export const runtime = 'nodejs'; // Use Node.js runtime for longer timeouts
export const maxDuration = 300; // 5 minutes max execution time

/**
 * GET /api/cron/update-reality
 * 
 * Runs the reality engine for all variables
 */
export async function GET(request: NextRequest) {
    console.log('[Cron] Reality update triggered');

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

        // Run reality engine for all variables
        const results = await updateAllVariables();

        const duration = Date.now() - startTime;

        // Log summary
        const summary = {
            totalVariables: results.length,
            totalSourcesScraped: results.reduce((sum, r) => sum + r.sourcesScraped, 0),
            totalSourcesAnalyzed: results.reduce((sum, r) => sum + r.sourcesAnalyzed, 0),
            avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
            variablesIncreased: results.filter(r => r.change > 0).length,
            variablesDecreased: results.filter(r => r.change < 0).length,
            variablesUnchanged: results.filter(r => r.change === 0).length,
            durationMs: duration
        };

        console.log('[Cron] Reality update completed:', summary);

        return NextResponse.json({
            success: true,
            summary,
            results: results.map(r => ({
                symbol: r.symbol,
                oldValue: r.oldValue,
                newValue: r.newValue,
                changePercent: r.changePercent.toFixed(2) + '%',
                confidence: r.confidence.toFixed(2)
            }))
        });

    } catch (error) {
        console.error('[Cron] Reality update failed:', error);

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
 * POST /api/cron/update-reality
 * 
 * Manual trigger (for testing/admin use)
 */
export async function POST(request: NextRequest) {
    console.log('[Manual] Reality update triggered');

    // Require auth for manual triggers
    // TODO: Add proper admin auth middleware

    return GET(request);
}
