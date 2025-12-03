export interface SerperSearchResult {
    title: string;
    link: string;
    snippet: string;
    date?: string;
    position: number;
}

export interface SerperSearchOptions {
    num?: number;        // Max results (default: 10)
    tbs?: string;        // Time filter: 'qdr:d' (day), 'qdr:w' (week), 'qdr:m' (month)
    location?: string;   // Geographic location (e.g., 'us')
}

/**
 * Serper.dev Google Search API Client
 * 
 * Free tier: 2500 searches/month (no credit card required)
 * 
 * Usage:
 *   const client = new SerperClient();
 *   const results = await client.search('Elon Musk news', { num: 5, tbs: 'qdr:d' });
 */
export class SerperClient {
    private apiKey: string;
    private baseUrl = 'https://google.serper.dev/search';
    private requestCount = 0;

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.SERPER_API_KEY || '';

        if (!this.apiKey) {
            throw new Error('SERPER_API_KEY environment variable is required');
        }
    }

    /**
     * Execute a Google search via Serper API
     * 
     * @param query - Search query string
     * @param options - Search options (num results, time filter, location)
     * @returns Array of search results with title, URL, snippet, date
     * 
     * @example
     * const results = await client.search('Tesla FSD beta', { 
     *   num: 10, 
     *   tbs: 'qdr:d' // Past day
     * });
     */
    async search(
        query: string,
        options?: SerperSearchOptions
    ): Promise<SerperSearchResult[]> {
        console.log(`[Serper] Searching: "${query}"`);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'X-API-KEY': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: query,
                    num: options?.num || 10,
                    ...(options?.tbs && { tbs: options.tbs }),
                    ...(options?.location && { gl: options.location })
                })
            });

            this.requestCount++;

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Serper API error (${response.status}): ${errorText}`
                );
            }

            const data: any = await response.json();

            // Extract organic results (main search results)
            const results = data.organic?.map((result: any, index: number) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
                date: result.date,
                position: index + 1
            })) || [];

            console.log(
                `[Serper] Found ${results.length} results ` +
                `(total API calls: ${this.requestCount})`
            );

            return results;

        } catch (error) {
            console.error('[Serper] Search failed:', error);
            throw error;
        }
    }

    /**
     * Get total number of API calls made
     * Used for monitoring to stay within free tier (2500/month)
     */
    getUsageCount(): number {
        return this.requestCount;
    }

    /**
     * Reset usage counter (for testing)
     */
    resetUsageCount(): void {
        this.requestCount = 0;
    }
}
