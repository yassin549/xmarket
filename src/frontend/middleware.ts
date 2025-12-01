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

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    console.log('[Middleware] Request to:', pathname);

    // Extract token from header or cookie
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : cookieToken;

    console.log('[Middleware] Auth check:', {
        hasAuthHeader: !!authHeader,
        hasCookieToken: !!cookieToken,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
    });

    // Verify token
    let session = null;
    if (token) {
        try {
            session = await verifyToken(token);
            console.log('[Middleware] Session verified:', {
                user_id: session?.user_id,
                email: session?.email,
                role: session?.role
            });
        } catch (error) {
            console.error('[Middleware] Token verification failed:', error);
        }
    } else {
        console.log('[Middleware] No token found');
    }

    // Protect /admin routes (except /admin/login)
    if (pathname.startsWith('/admin')) {
        if (pathname === '/admin/login') {
            // Allow access to login page
            // If already authenticated, redirect to admin dashboard
            if (session && (session.role === 'admin' || session.role === 'super-admin')) {
                console.log('[Middleware] Admin already logged in, redirecting to /admin');
                return NextResponse.redirect(new URL('/admin', request.url));
            }
            return NextResponse.next();
        }

        // All other /admin routes require authentication
        if (!session) {
            console.log('[Middleware] No session for /admin, redirecting to /admin/login');
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        // Check for admin role
        if (session.role !== 'admin' && session.role !== 'super-admin') {
            console.log('[Middleware] Non-admin trying to access /admin, redirecting to /');
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    // Protect /dashboard routes
    if (pathname.startsWith('/dashboard')) {
        if (!session) {
            console.log('[Middleware] No session for /dashboard, redirecting to /login');
            return NextResponse.redirect(new URL('/login', request.url));
        }
        console.log('[Middleware] Session valid for /dashboard, allowing access');
    }

    // Redirect authenticated users away from login/signup pages
    if (session && (pathname === '/login' || pathname === '/signup')) {
        console.log('[Middleware] Authenticated user on login/signup, redirecting to /dashboard');
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    console.log('[Middleware] Allowing request to proceed');
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
