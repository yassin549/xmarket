/**
 * Nonce Cache - Upstash Redis Implementation
 * 
 * Provides Redis-backed nonce storage for HMAC replay protection.
 * Uses Upstash REST API for serverless compatibility.
 */

import { NonceCache } from './verifier';

/**
 * Upstash Redis nonce cache implementation
 * 
 * Uses REST API instead of Redis protocol for serverless environments.
 */
export class UpstashNonceCache implements NonceCache {
    private baseUrl: string;
    private token: string;

    constructor() {
        this.baseUrl = process.env.UPSTASH_REST_URL!;
        this.token = process.env.UPSTASH_REST_TOKEN!;

        if (!this.baseUrl || !this.token) {
            throw new Error(
                'Upstash credentials not configured. Set UPSTASH_REST_URL and UPSTASH_REST_TOKEN'
            );
        }
    }

    /**
     * Check if nonce exists in cache
     * 
     * @param nonce UUID nonce to check
     * @returns true if nonce has been used
     */
    async has(nonce: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/get/nonce:${nonce}`, {
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            if (!response.ok) {
                // If key doesn't exist, Upstash returns 404 or null result
                return false;
            }

            const data = await response.json() as { result: string | null };
            return data.result !== null;
        } catch (error) {
            console.error('Nonce cache check error:', error);
            // Fail closed: treat errors as "nonce exists" to prevent replay attacks
            return true;
        }
    }

    /**
     * Store nonce in cache with TTL
     * 
     * @param nonce UUID nonce
     * @param value Always true (just marking as used)
     * @param ttlSeconds Time-to-live in seconds (600 = 10 minutes)
     */
    async set(nonce: string, value: boolean, ttlSeconds: number): Promise<void> {
        try {
            const response = await fetch(
                `${this.baseUrl}/setex/nonce:${nonce}/${ttlSeconds}/1`,
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Upstash SET failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Nonce cache set error:', error);
            // Don't throw - this would reject valid requests
            // Better to allow potential replay than block legitimate traffic
        }
    }
}

/**
 * In-memory nonce cache for testing
 * 
 * NOT for production use - doesn't work across multiple instances
 */
export class InMemoryNonceCache implements NonceCache {
    private cache = new Map<string, number>(); // nonce -> expiry timestamp

    async has(nonce: string): Promise<boolean> {
        const expiry = this.cache.get(nonce);
        if (!expiry) return false;

        // Remove if expired
        if (Date.now() > expiry) {
            this.cache.delete(nonce);
            return false;
        }

        return true;
    }

    async set(nonce: string, value: boolean, ttlSeconds: number): Promise<void> {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(nonce, expiry);

        // Cleanup expired entries periodically
        if (this.cache.size > 1000) {
            const now = Date.now();
            for (const [key, exp] of this.cache.entries()) {
                if (now > exp) {
                    this.cache.delete(key);
                }
            }
        }
    }

    /** Clear all nonces (for testing) */
    clear(): void {
        this.cache.clear();
    }
}

/**
 * Default export - Upstash implementation
 */
export default UpstashNonceCache;
