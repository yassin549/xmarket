/**
 * JWT Token Utilities
 * 
 * Handles JWT token generation and verification for user authentication.
 * Uses NEXTAUTH_SECRET from environment variables.
 */

import jwt from 'jsonwebtoken';

const SECRET = process.env.NEXTAUTH_SECRET;

if (!SECRET) {
    throw new Error('NEXTAUTH_SECRET environment variable is not set');
}

export interface JWTPayload {
    user_id: string;
    email: string;
    role: string;
    display_name?: string;
    exp?: number;
    iat?: number;
}

/**
 * Generate a JWT token for a user
 * @param payload User information to encode
 * @param expiresIn Token expiration (default: 7 days)
 * @returns Signed JWT token
 */
export function generateToken(
    payload: Omit<JWTPayload, 'exp' | 'iat'>,
    expiresIn: string = '7d'
): string {
    return jwt.sign(payload, SECRET, {
        expiresIn,
        algorithm: 'HS256',
    });
}

/**
 * Verify and decode a JWT token
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, SECRET, {
            algorithms: ['HS256'],
        }) as JWTPayload;
        return decoded;
    } catch (error) {
        // Token is invalid or expired
        return null;
    }
}

/**
 * Decode a JWT token without verifying (useful for debugging)
 * WARNING: Do not use for authentication - use verifyToken instead
 */
export function decodeToken(token: string): JWTPayload | null {
    try {
        return jwt.decode(token) as JWTPayload;
    } catch {
        return null;
    }
}
