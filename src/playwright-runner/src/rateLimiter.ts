/**
 * Rate Limiter
 * 
 * Per-domain rate limiting to avoid getting blocked by target sites.
 * Default: 1 request/second per domain with burst capacity of 3.
 */

export interface RateLimiterConfig {
    requestsPerSecond: number;
    burstSize: number;
}

export class RateLimiter {
    private limits: Map<string, number[]> = new Map();
    private requestsPerSecond: number;
    private burstSize: number;

    constructor(config: RateLimiterConfig = { requestsPerSecond: 1, burstSize: 3 }) {
        this.requestsPerSecond = config.requestsPerSecond;
        this.burstSize = config.burstSize;
    }

    /**
     * Acquire permission to make request to domain
     * 
     * Will wait if rate limit exceeded
     */
    async acquire(domain: string): Promise<void> {
        const now = Date.now();
        const windowMs = 1000; // 1 second window

        // Get existing requests for this domain
        let requests = this.limits.get(domain) || [];

        // Remove requests outside the window
        requests = requests.filter(ts => now - ts < windowMs);

        // Check if we've hit the limit
        if (requests.length >= this.requestsPerSecond) {
            const oldestRequest = Math.min(...requests);
            const waitTime = windowMs - (now - oldestRequest);

            console.log(`Rate limit: waiting ${waitTime}ms for ${domain}`);
            await this.sleep(waitTime + 10); // +10ms buffer

            // Recursively try again after waiting
            return this.acquire(domain);
        }

        // Record this request
        requests.push(Date.now());
        this.limits.set(domain, requests);
    }

    /**
     * Get current request count for domain
     */
    getCurrentCount(domain: string): number {
        const now = Date.now();
        const requests = this.limits.get(domain) || [];
        return requests.filter(ts => now - ts < 1000).length;
    }

    /**
     * Clear all rate limit data
     */
    clear(): void {
        this.limits.clear();
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default RateLimiter;
