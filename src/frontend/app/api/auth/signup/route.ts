/**
 * User Signup API Route
 * POST /api/auth/signup
 * 
 * Creates new user account with email and password.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/infra/db/pool';
import bcrypt from 'bcrypt';
import { generateToken } from '@/lib/auth/jwt';

const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, display_name } = body;

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

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid email format',
                },
                { status: 400 }
            );
        }

        // Password strength validation (minimum 8 characters)
        if (password.length < 8) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Password must be at least 8 characters long',
                },
                { status: 400 }
            );
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert user into database
        try {
            const result = await query<{
                user_id: string;
                email: string;
                role: string;
                display_name: string;
            }>(
                `INSERT INTO users (email, password_hash, display_name, role)
         VALUES ($1, $2, $3, 'viewer')
         RETURNING user_id, email, role, display_name`,
                [email, password_hash, display_name || email.split('@')[0]]
            );

            const user = result.rows[0];

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
        } catch (dbError: any) {
            // Check for unique constraint violation (email already exists)
            if (dbError.code === '23505') {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'An account with this email already exists',
                    },
                    { status: 409 }
                );
            }
            throw dbError;
        }
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
            },
            { status: 500 }
        );
    }
}
