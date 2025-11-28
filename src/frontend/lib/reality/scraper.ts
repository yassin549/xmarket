/**
 * Reality Engine - Web Scraper
 * 
 * Simple HTTP-based web scraping utility for extracting content from URLs.
 * Used by the reality engine to gather real-world data.
 */

import * as crypto from 'crypto';

export interface ScrapedContent {
    url: string;
    content: string;
    contentHash: string;
    contentLength: number;
    scrapedAt: Date;
    success: boolean;
    error?: string;
}

/**
 * Scrape content from a URL
 */
export async function scrapeSource(url: string): Promise<ScrapedContent> {
    const scrapedAt = new Date();

    try {
        // Fetch the page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Xmarket-Reality-Engine/1.0'
            },
            signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        // Extract main content (simple approach - remove scripts, styles)
        const content = extractMainContent(html);

        // Calculate hash for deduplication
        const contentHash = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex');

        return {
            url,
            content,
            contentHash,
            contentLength: content.length,
            scrapedAt,
            success: true
        };

    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);

        return {
            url,
            content: '',
            contentHash: '',
            contentLength: 0,
            scrapedAt,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Extract main content from HTML
 * Removes scripts, styles, and HTML tags
 */
function extractMainContent(html: string): string {
    // Remove script tags and their content
    let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove style tags and their content
    content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML comments
    content = content.replace(/<!--[\s\S]*?-->/g, '');

    // Remove HTML tags but keep content
    content = content.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    content = content
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Normalize whitespace
    content = content
        .replace(/\s+/g, ' ')
        .trim();

    // Limit to reasonable length (first 10000 characters for LLM)
    if (content.length > 10000) {
        content = content.substring(0, 10000) + '...';
    }

    return content;
}

/**
 * Scrape multiple sources in parallel
 */
export async function scrapeMultipleSources(urls: string[]): Promise<ScrapedContent[]> {
    const results = await Promise.allSettled(
        urls.map(url => scrapeSource(url))
    );

    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return {
                url: urls[index],
                content: '',
                contentHash: '',
                contentLength: 0,
                scrapedAt: new Date(),
                success: false,
                error: result.reason?.message || 'Promise rejected'
            };
        }
    });
}

/**
 * Check if content is duplicate based on hash
 */
export function isDuplicateContent(hash: string, previousHashes: string[]): boolean {
    return previousHashes.includes(hash);
}
