/**
 * Next.js Edge Middleware
 * 
 * Protects routes requiring authentication:
 * - /admin/* (except /admin/login) - requires admin session
 * - /dashboard/* - requires any authenticated user
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth/jwt';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Extract token from header or cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : request.cookies.get('auth_token')?.value;

    // Verify token
    const session = token ? verifyToken(token) : null;

    // Protect /admin routes (except /admin/login)
    if (pathname.startsWith('/admin')) {
        if (pathname === '/admin/login') {
            // Allow access to login page
            // If already authenticated, redirect to admin dashboard
            if (session && (session.role === 'admin' || session.role === 'super-admin')) {
                return NextResponse.redirect(new URL('/admin', request.url));
            }
            return NextResponse.next();
        }

        // All other /admin routes require authentication
        if (!session) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        // Check for admin role
        if (session.role !== 'admin' && session.role !== 'super-admin') {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    // Protect /dashboard routes
    if (pathname.startsWith('/dashboard')) {
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    // Redirect authenticated users away from login/signup pages
    if (session && (pathname === '/login' || pathname === '/signup')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
    matcher: [
        '/admin/:path*',
        '/dashboard/:path*',
        '/login',
        '/signup',
    ],
};
