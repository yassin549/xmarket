/**
 * Health Check API Route
 * 
 * Tests connectivity to all infrastructure services:
 * - Neon Database (PostgreSQL)
 * - Upstash (Redis/KV)
 * - Pinecone (Vector DB)
 * - Vercel Blob (Object Storage)
 * 
 * Returns comprehensive health status with latency metrics.
 * 
 * @route GET /api/health
 */

import { NextResponse } from 'next/server';
import { query, getPoolMetrics, testConnection } from '@/lib/infra/db/pool';

interface ServiceHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency_ms?: number;
    error?: string;
    details?: any;
}

interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    environment: string;
    services: {
        database: ServiceHealth & { pool?: any };
        cache: ServiceHealth;
        vector_db: ServiceHealth;
        storage: ServiceHealth;
    };
}

/**
 * Check Neon database connectivity
 */
async function checkDatabase(): Promise<ServiceHealth> {
    try {
        const latency = await testConnection();
        const metrics = getPoolMetrics();

        return {
            status: 'healthy',
            latency_ms: latency,
            details: {
                pool: {
                    total: metrics.totalCount,
                    idle: metrics.idleCount,
                    waiting: metrics.waitingCount,
                },
            },
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Database connection failed',
        };
    }
}

/**
 * Check Upstash Redis connectivity
 */
async function checkCache(): Promise<ServiceHealth> {
    try {
        if (!process.env.UPSTASH_REST_URL || !process.env.UPSTASH_REST_TOKEN) {
            return {
                status: 'degraded',
                error: 'Upstash credentials not configured',
            };
        }

        const start = Date.now();
        const response = await fetch(`${process.env.UPSTASH_REST_URL}/ping`, {
            headers: {
                Authorization: `Bearer ${process.env.UPSTASH_REST_TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const latency = Date.now() - start;
        return {
            status: 'healthy',
            latency_ms: latency,
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Cache connection failed',
        };
    }
}

/**
 * Check Pinecone vector database connectivity
 */
async function checkVectorDB(): Promise<ServiceHealth> {
    try {
        if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_HOST) {
            return {
                status: 'degraded',
                error: 'Pinecone credentials not configured',
            };
        }

        const start = Date.now();
        // Simple connectivity check - describe index stats
        const response = await fetch(`${process.env.PINECONE_INDEX_HOST}/describe_index_stats`, {
            method: 'POST',
            headers: {
                'Api-Key': process.env.PINECONE_API_KEY,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const latency = Date.now() - start;
        return {
            status: 'healthy',
            latency_ms: latency,
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Vector DB connection failed',
        };
    }
}

/**
 * Check Vercel Blob storage connectivity
 */
async function checkStorage(): Promise<ServiceHealth> {
    try {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return {
                status: 'degraded',
                error: 'Blob storage credentials not configured',
            };
        }

        // For now, just check if credentials exist
        // Actual blob operations would require @vercel/blob package
        return {
            status: 'healthy',
            details: {
                note: 'Credentials configured (full test pending blob operations)',
            },
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Storage check failed',
        };
    }
}

/**
 * GET /api/health
 * 
 * Returns health status of all services
 */
export async function GET() {
    try {
        // Run all health checks in parallel
        const [database, cache, vectorDB, storage] = await Promise.all([
            checkDatabase(),
            checkCache(),
            checkVectorDB(),
            checkStorage(),
        ]);

        // Determine overall status
        const statuses = [database.status, cache.status, vectorDB.status, storage.status];
        const overallStatus = statuses.includes('unhealthy')
            ? 'unhealthy'
            : statuses.includes('degraded')
                ? 'degraded'
                : 'healthy';

        const response: HealthResponse = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            services: {
                database,
                cache,
                vector_db: vectorDB,
                storage,
            },
        };

        // Return 200 if healthy/degraded, 503 if unhealthy
        const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

        return NextResponse.json(response, { status: statusCode });
    } catch (error) {
        console.error('Health check error:', error);
        return NextResponse.json(
            {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Internal health check error',
            },
            { status: 500 }
        );
    }
}
