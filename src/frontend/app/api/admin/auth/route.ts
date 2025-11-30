/**
 * Admin Authentication API Route
 * POST /api/admin/auth
 * 
 * Verifies admin password and returns JWT token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword } from '@/lib/middleware/adminPassword';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Password is required',
                },
                { status: 400 }
            );
        }

        const result = await verifyAdminPassword(password);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                },
                { status: 401 }
            );
        }

        // Create response
        const response = NextResponse.json({
            success: true,
            token: result.token,
            message: 'Admin authentication successful',
        });

        // Set HttpOnly cookie
        response.cookies.set('auth_token', result.token!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 hours for admin
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Admin auth error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 }
        );
    }
}
