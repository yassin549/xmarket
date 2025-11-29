/**
 * Session Extraction Utilities
 * 
 * Extracts and validates JWT from Next.js requests.
 * Supports both Authorization header and cookies.
 */

import { NextRequest } from 'next/server';
import { verifyToken, JWTPayload } from './jwt';

export interface UserSession extends JWTPayload {
    // Additional session properties can be added here
}

/**
 * Extract JWT token from request
 * Checks Authorization header first, then falls back to cookies
 */
export function extractToken(request: NextRequest): string | null {
    // 1. Check Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // 2. Check cookies (for browser requests)
    const cookieToken = request.cookies.get('auth_token')?.value;
    if (cookieToken) {
        return cookieToken;
    }

    return null;
}

/**
 * Get user session from request
 * @returns UserSession object or null if not authenticated
 */
export async function getSession(request: NextRequest): Promise<UserSession | null> {
    const token = extractToken(request);

    if (!token) {
        return null;
    }

    const payload = verifyToken(token);

    if (!payload) {
        return null;
    }

    return payload as UserSession;
}

/**
 * Check if user has required role
 */
export function hasRole(session: UserSession | null, allowedRoles: string[]): boolean {
    if (!session) {
        return false;
    }

    return allowedRoles.includes(session.role);
}
