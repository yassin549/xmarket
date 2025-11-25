/**
 * HMAC Request Verifier
 * 
 * Verifies HMAC-SHA256 signatures on incoming requests with replay protection.
 * 
 * Validation steps:
 * 1. Check all required headers present
 * 2. Verify timestamp within tolerance window (±5 minutes)
 * 3. Check nonce hasn't been used before (replay protection)
 * 4. Verify signature matches expected value
 */

import crypto from 'crypto';

export interface VerificationResult {
    valid: boolean;
    error?: string;
    keyId?: string;
    timestamp?: Date;
    nonce?: string;
}

export interface NonceCache {
    has(nonce: string): Promise<boolean>;
    set(nonce: string, value: boolean, ttlSeconds: number): Promise<void>;
}

/**
 * Verify HMAC signature on incoming request
 * 
 * @param method HTTP method
 * @param path Request path
 * @param body Request body (as string)
 * @param headers Request headers (lowercase keys)
 * @param nonceCache Redis-backed nonce cache
 * @returns Verification result with details
 */
export async function verifyRequest(
    method: string,
    path: string,
    body: string,
    headers: Record<string, string | undefined>,
    nonceCache: NonceCache
): Promise<VerificationResult> {
    // Extract HMAC headers (case-insensitive)
    const keyId = headers['x-hmac-keyid'];
    const timestamp = headers['x-hmac-ts'];
    const nonce = headers['x-hmac-nonce'];
    const providedSignature = headers['x-hmac-signature'];

    // 1. Check all headers present
    if (!keyId || !timestamp || !nonce || !providedSignature) {
        return {
            valid: false,
            error: 'Missing required HMAC headers (X-HMAC-KeyId, X-HMAC-Ts, X-HMAC-Nonce, X-HMAC-Signature)',
        };
    }

    // 2. Check timestamp (prevent old/future requests)
    const requestTime = new Date(timestamp);
    const now = Date.now();
    const diff = Math.abs(now - requestTime.getTime());
    const TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

    if (diff > TOLERANCE_MS) {
        return {
            valid: false,
            error: `Timestamp outside tolerance window (±5 minutes). Diff: ${Math.round(diff / 1000)}s`,
        };
    }

    // 3. Check nonce (replay protection)
    const nonceUsed = await nonceCache.has(nonce);
    if (nonceUsed) {
        return {
            valid: false,
            error: 'Nonce already used - possible replay attack detected',
        };
    }

    // 4. Verify signature
    let secret: string;
    try {
        secret = getHMACSecret(keyId);
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Invalid key-id',
        };
    }

    const canonical = `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${body}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(canonical)
        .digest('hex');

    if (providedSignature !== expectedSignature) {
        return {
            valid: false,
            error: 'Signature mismatch - request may have been tampered with',
        };
    }

    // Mark nonce as used (TTL = 10 minutes to handle clock skew)
    await nonceCache.set(nonce, true, 600);

    return {
        valid: true,
        keyId,
        timestamp: requestTime,
        nonce,
    };
}

/**
 * Get HMAC secret from environment
 */
function getHMACSecret(keyId: string): string {
    const envKey = `HMAC_SECRET_${keyId.toUpperCase()}`;
    const secret = process.env[envKey];

    if (!secret) {
        throw new Error(`HMAC secret not found for key-id: ${keyId}`);
    }

    return secret;
}

/**
 * Default export
 */
export default {
    verifyRequest,
};
