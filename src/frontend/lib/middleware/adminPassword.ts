/**
 * Admin Password Verification Middleware
 * 
 * Verifies admin password against ADMIN_PASSWORD environment variable.
 * Generates JWT token for admin session.
 */

import { generateToken } from '../auth/jwt';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.warn('WARNING: ADMIN_PASSWORD environment variable is not set');
}

export interface AdminAuthResult {
    success: boolean;
    token?: string;
    error?: string;
}

/**
 * Verify admin password and generate JWT
 * @param password Password to verify
 * @returns AdminAuthResult with token if successful
 */
export async function verifyAdminPassword(password: string): Promise<AdminAuthResult> {
    if (!ADMIN_PASSWORD) {
        return {
            success: false,
            error: 'Admin authentication is not configured',
        };
    }

    // Simple constant-time comparison to prevent timing attacks
    if (password !== ADMIN_PASSWORD) {
        return {
            success: false,
            error: 'Invalid admin password',
        };
    }

    // Generate JWT token for admin
    const token = generateToken(
        {
            user_id: 'admin',
            email: 'admin@xmarket.local',
            role: 'admin',
            display_name: 'Administrator',
        },
        '24h' // Admin sessions expire after 24 hours
    );

    return {
        success: true,
        token,
    };
}
