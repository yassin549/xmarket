/**
 * requireAuth Middleware Factory
 * 
 * Creates middleware to protect API routes with JWT authentication.
 * Validates JWT and checks user role against allowed roles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '../auth/session';

export interface AuthMiddlewareOptions {
    allowedRoles?: string[];
    optional?: boolean; // If true, allows unauthenticated but still populates session
}

/**
 * Middleware factory for protecting routes
 * 
 * @example
 * // Protect route for admin and editor only
 * const guardResult = await requireAuth(request, { allowedRoles: ['admin', 'editor'] });
 * if (guardResult.error) return guardResult.response;
 * const userId = guardResult.session!.user_id;
 * 
 * @example
 * // Protect route for any authenticated user
 * const guardResult = await requireAuth(request);
 * if (guardResult.error) return guardResult.response;
 */
export async function requireAuth(
    request: NextRequest,
    options: AuthMiddlewareOptions = {}
) {
    const session = await getSession(request);

    // If session is required and missing
    if (!session && !options.optional) {
        return {
            error: true,
            response: NextResponse.json(
                {
                    success: false,
                    error: 'Unauthorized',
                    message: 'Authentication required',
                },
                { status: 401 }
            ),
            session: null,
        };
    }

    // If specific roles are required
    if (options.allowedRoles && options.allowedRoles.length > 0) {
        if (!hasRole(session, options.allowedRoles)) {
            return {
                error: true,
                response: NextResponse.json(
                    {
                        success: false,
                        error: 'Forbidden',
                        message: `Access denied. Required roles: ${options.allowedRoles.join(', ')}`,
                        user_role: session?.role,
                    },
                    { status: 403 }
                ),
                session,
            };
        }
    }

    // Authentication successful
    return {
        error: false,
        response: null,
        session,
    };
}

/**
 * Shorthand: Require any authenticated user
 */
export async function requireAnyAuth(request: NextRequest) {
    return requireAuth(request);
}

/**
 * Shorthand: Require admin role
 */
export async function requireAdmin(request: NextRequest) {
    return requireAuth(request, { allowedRoles: ['admin', 'super-admin'] });
}

/**
 * Shorthand: Require editor or admin role
 */
export async function requireEditor(request: NextRequest) {
    return requireAuth(request, { allowedRoles: ['editor', 'admin', 'super-admin'] });
}
