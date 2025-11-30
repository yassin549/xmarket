/**
 * User Login API Route
 * POST /api/auth/login
 * 
 * Authenticates user with email and password, returns JWT token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';
import bcrypt from 'bcrypt';
import { generateToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Validation
        if (!email || !password) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Email and password are required',
                },
                { status: 400 }
            );
        }

        // Fetch user from database
        const result = await query<{
            user_id: string;
            email: string;
            password_hash: string;
            role: string;
            display_name: string;
            is_active: boolean;
        }>(
            `SELECT user_id, email, password_hash, role, display_name, is_active
       FROM users
       WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid email or password',
                },
                { status: 401 }
            );
        }

        const user = result.rows[0];

        // Check if account is active
        if (!user.is_active) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Account is deactivated',
                },
                { status: 403 }
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid email or password',
                },
                { status: 401 }
            );
        }

        // Update last_login_at
        await query(
            `UPDATE users SET last_login_at = NOW() WHERE user_id = $1`,
            [user.user_id]
        );

        // Generate JWT token
        const token = generateToken({
            user_id: user.user_id,
            email: user.email,
            role: user.role,
            display_name: user.display_name,
        });

        // Create response
        const response = NextResponse.json({
            success: true,
            token,
            user: {
                user_id: user.user_id,
                email: user.email,
                role: user.role,
                display_name: user.display_name,
            },
        });

        // Set HttpOnly cookie
        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 }
        );
    }
}
