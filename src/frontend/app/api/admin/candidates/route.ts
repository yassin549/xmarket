import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

/**
 * GET /api/admin/candidates
 * 
 * Fetches all pending candidate events for admin review.
 */
export async function GET(request: NextRequest) {
    try {
        const result = await query(
            `SELECT 
        candidate_id, 
        snapshot_id, 
        summary, 
        confidence, 
        metadata, 
        status, 
        created_at 
      FROM candidate_events 
      WHERE status = 'pending' 
      ORDER BY created_at DESC`
        );

        return NextResponse.json({
            success: true,
            candidates: result.rows,
        });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch candidates'
            },
            { status: 500 }
        );
    }
}
