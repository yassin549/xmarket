/**
 * User Profile API Route
 * GET /api/auth/me
 * 
 * Returns current user profile from JWT token.
 * Protected route - requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAnyAuth } from '@/lib/middleware/requireAuth';

export async function GET(request: NextRequest): Promise<NextResponse> {
    // Require authentication
    const authResult = await requireAnyAuth(request);
    if (authResult.error) {
        return authResult.response!;
    }

    const session = authResult.session!;

    return NextResponse.json({
        success: true,
        user: {
            user_id: session.user_id,
            email: session.email,
            role: session.role,
            display_name: session.display_name,
        },
    });
}
