/**
 * Admin Decision Guard Middleware
 * 
 * Enforces human-in-the-loop for sensitive operations by requiring
 * a valid admin_decision audit event before allowing writes to:
 * - markets table
 * - events table
 * - any admin-level changes
 * 
 * As per details.txt: "agents cannot bypass the guard"
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';

/**
 * Guard middleware - verifies admin approval exists
 * 
 * @param request Next.js request object
 * @param requiredAction Action that requires approval (e.g., 'create_market')
 * @returns NextResponse with error if validation fails, null if allowed
 * 
 * @example
 * // In API route:
 * const guardResult = await guardAdminDecision(request, 'create_market');
 * if (guardResult) return guardResult; // Blocked
 * 
 * // Continue with market creation...
 */
export async function guardAdminDecision(
    request: NextRequest,
    requiredAction: string
): Promise<NextResponse | null> {
    try {
        // Parse request body
        const body = await request.json();
        const adminDecisionId = body.admin_decision_id;

        // 1. Check admin_decision_id is provided
        if (!adminDecisionId) {
            return NextResponse.json(
                {
                    error: 'Forbidden',
                    message: `admin_decision_id required for action: ${requiredAction}`,
                    required_field: 'admin_decision_id',
                },
                { status: 403 }
            );
        }

        // 2. Verify admin decision exists in audit_event table
        const result = await query<{
            audit_id: string;
            action: string;
            actor_id: string;
            actor_type: string;
            created_at: string;
            signature: string | null;
        }>(
            `SELECT audit_id, action, actor_id, actor_type, created_at, signature
       FROM audit_event
       WHERE audit_id = $1 AND action = $2`,
            [adminDecisionId, requiredAction]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    error: 'Forbidden',
                    message: `No admin decision found for action: ${requiredAction}`,
                    provided_decision_id: adminDecisionId,
                },
                { status: 403 }
            );
        }

        const decision = result.rows[0];

        // 3. Verify actor is human (not agent)
        if (decision.actor_type !== 'human') {
            return NextResponse.json(
                {
                    error: 'Forbidden',
                    message: `Decision must be made by human admin, got: ${decision.actor_type}`,
                    decision_id: adminDecisionId,
                },
                { status: 403 }
            );
        }

        // 4. Check decision age (must be recent - within 24 hours)
        const decisionTime = new Date(decision.created_at).getTime();
        const age = Date.now() - decisionTime;
        const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

        if (age > MAX_AGE_MS) {
            return NextResponse.json(
                {
                    error: 'Forbidden',
                    message: 'Admin decision expired (>24 hours old)',
                    decision_age_hours: Math.round(age / (60 * 60 * 1000)),
                    decision_id: adminDecisionId,
                },
                { status: 403 }
            );
        }

        // 5. Check for future timestamps (clock skew or tampering)
        if (age < 0) {
            return NextResponse.json(
                {
                    error: 'Forbidden',
                    message: 'Admin decision has future timestamp - possible clock skew',
                    decision_id: adminDecisionId,
                },
                { status: 403 }
            );
        }

        // All checks passed - request is allowed
        console.log('Admin decision validated:', {
            decision_id: adminDecisionId,
            action: requiredAction,
            actor: decision.actor_id,
            age_minutes: Math.round(age / (60 * 1000)),
        });

        return null; // null = allow request to proceed
    } catch (error) {
        console.error('Guard error:', error);

        // Fail closed: block request on errors
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'Admin decision validation failed',
            },
            { status: 500 }
        );
    }
}

/**
 * Check if admin decision exists (without throwing)
 * 
 * Utility function for checking approval status without blocking request.
 */
export async function hasAdminDecision(
    adminDecisionId: string,
    requiredAction: string
): Promise<boolean> {
    try {
        const result = await query(
            `SELECT 1 FROM audit_event
       WHERE audit_id = $1 AND action = $2 AND actor_type = 'human'`,
            [adminDecisionId, requiredAction]
        );

        return result.rows.length > 0;
    } catch {
        return false;
    }
}

/**
 * Default export
 */
export default {
    guardAdminDecision,
    hasAdminDecision,
};
