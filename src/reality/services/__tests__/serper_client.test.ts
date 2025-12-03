import { SerperClient } from '../serper_client';

describe('SerperClient', () => {
    let client: SerperClient;

    beforeEach(() => {
        client = new SerperClient();
    });

    it('should search and return results', async () => {
        const results = await client.search('Elon Musk Tesla news', { num: 5 });

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(5);

        // Verify result structure
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('link');
        expect(results[0]).toHaveProperty('snippet');
        expect(results[0]).toHaveProperty('position');

        console.log('\n✅ Sample result:', {
            title: results[0].title,
            link: results[0].link.substring(0, 50) + '...',
            snippet: results[0].snippet.substring(0, 80) + '...'
        });
    }, 10000); // 10s timeout

    it('should handle time filters', async () => {
        const results = await client.search('AI news', {
            num: 3,
            tbs: 'qdr:d' // Past day
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(3);

        console.log('\n✅ Found', results.length, 'results from past day');
    }, 10000);

    it('should track API usage', async () => {
        client.resetUsageCount();
        expect(client.getUsageCount()).toBe(0);

        await client.search('test query 1', { num: 3 });
        expect(client.getUsageCount()).toBe(1);

        await client.search('test query 2', { num: 3 });
        expect(client.getUsageCount()).toBe(2);

        console.log('\n✅ Usage tracking works:', client.getUsageCount(), 'calls');
    }, 15000);

    it('should throw error if API key missing', () => {
        const originalKey = process.env.SERPER_API_KEY;
        delete process.env.SERPER_API_KEY;

        expect(() => {
            new SerperClient();
        }).toThrow('SERPER_API_KEY environment variable is required');

        // Restore
        process.env.SERPER_API_KEY = originalKey;
    });
});
