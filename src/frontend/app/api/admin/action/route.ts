import { NextRequest, NextResponse } from 'next/server';
import { query, getClient } from '@/lib/infra/db/pool';

/**
 * POST /api/admin/action
 * 
 * Unified endpoint for admin decisions.
 * Creates an audit_event for all admin actions.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action_type, payload, admin_id = 'system' } = body;

        // Validate input
        if (!action_type || !payload) {
            return NextResponse.json(
                { success: false, error: 'Missing action_type or payload' },
                { status: 400 }
            );
        }

        // Get a client for transaction
        const client = await getClient();

        try {
            await client.query('BEGIN');

            // 1. Create audit_event
            const auditResult = await client.query(
                `INSERT INTO audit_event 
          (event_type, actor_id, metadata, created_at) 
        VALUES ($1, $2, $3, NOW()) 
        RETURNING audit_id`,
                [
                    'admin_decision',
                    admin_id,
                    JSON.stringify({
                        action_type,
                        payload,
                    }),
                ]
            );

            const auditId = auditResult.rows[0].audit_id;

            // 2. Execute action based on type
            let actionResult;
            if (action_type === 'APPROVE_CANDIDATE') {
                actionResult = await client.query(
                    `UPDATE candidate_events 
          SET status = 'approved', updated_at = NOW() 
          WHERE candidate_id = $1 
          RETURNING candidate_id`,
                    [payload.candidate_id]
                );
            } else if (action_type === 'REJECT_CANDIDATE') {
                actionResult = await client.query(
                    `UPDATE candidate_events 
          SET status = 'rejected', updated_at = NOW() 
          WHERE candidate_id = $1 
          RETURNING candidate_id`,
                    [payload.candidate_id]
                );
            } else {
                throw new Error(`Unknown action_type: ${action_type}`);
            }

            if (actionResult.rowCount === 0) {
                throw new Error('Candidate not found');
            }

            await client.query('COMMIT');

            return NextResponse.json({
                success: true,
                audit_id: auditId,
                candidate_id: actionResult.rows[0].candidate_id,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error processing admin action:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
