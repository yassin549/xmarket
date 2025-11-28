/**
 * Database Connection Pool
 * 
 * Implements connection pooling strategy for serverless environment.
 * See: docs/specs/db_pooling.md
 * 
 * Key features:
 * - Environment-specific pool sizes (dev: 10, production: 5)
 * - Singleton pattern to prevent multiple pools
 * - Query logging in development
 * - Health metrics for monitoring
 */

import { Pool, PoolConfig, QueryResult, PoolClient, QueryResultRow } from 'pg';

/**
 * Get pool configuration based on environment
 */
const getPoolConfig = (): PoolConfig => {
    const env = process.env.NODE_ENV || 'development';

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set');
    }

    const baseConfig: PoolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: env !== 'test' ? { rejectUnauthorized: false } : undefined,
    };

    // Environment-specific configurations
    // See: docs/specs/db_pooling.md for rationale
    const envConfigs: Record<string, Partial<PoolConfig>> = {
        development: {
            max: 10, // More connections for local testing
            idleTimeoutMillis: 60000, // 60s
            connectionTimeoutMillis: 5000, // 5s
        },
        staging: {
            max: 5,
            idleTimeoutMillis: 30000, // 30s
            connectionTimeoutMillis: 3000, // 3s
        },
        production: {
            max: 5, // CRITICAL: Keep low for serverless
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 3000,
        },
        test: {
            max: 2,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 2000,
        },
    };

    return { ...baseConfig, ...envConfigs[env] };
};

/**
 * Singleton pool instance
 */
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 */
export const getPool = (): Pool => {
    if (!pool) {
        const config = getPoolConfig();
        pool = new Pool(config);

        // Error handler - log unexpected errors
        pool.on('error', (err: Error) => {
            console.error('Unexpected pool error:', err);
            // Don't exit process here - let the app recover
        });

        // Connection logging (development only)
        if (process.env.NODE_ENV === 'development') {
            pool.on('connect', (client: PoolClient) => {
                console.log('New database connection established');
            });

            pool.on('remove', () => {
                console.log('Database connection removed from pool');
            });
        }

        console.log(`Database pool initialized (env: ${process.env.NODE_ENV}, max: ${config.max})`);
    }

    return pool;
};

/**
 * Execute a query with automatic connection management
 * 
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export const query = async <T extends QueryResultRow = any>(
    text: string,
    params?: any[]
): Promise<QueryResult<T>> => {
    const pool = getPool();
    const start = Date.now();

    try {
        const result = await pool.query<T>(text, params);
        const duration = Date.now() - start;

        // Log queries in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Query executed:', {
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                duration: `${duration}ms`,
                rows: result.rowCount,
            });
        }

        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.error('Query error:', {
            text: text.substring(0, 100),
            duration: `${duration}ms`,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
};

/**
 * Get a client from the pool for transactions
 * IMPORTANT: Must call client.release() when done
 * 
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO ...');
 *   await client.query('COMMIT');
 * } catch (e) {
 *   await client.query('ROLLBACK');
 *   throw e;
 * } finally {
 *   client.release();
 * }
 */
export const getClient = async (): Promise<PoolClient> => {
    const pool = getPool();
    return await pool.connect();
};

/**
 * Get pool metrics for health checks and monitoring
 */
export interface PoolMetrics {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
}

export const getPoolMetrics = (): PoolMetrics => {
    const pool = getPool();
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
};

/**
 * Test database connectivity
 * Returns latency in milliseconds
 */
export const testConnection = async (): Promise<number> => {
    const start = Date.now();
    await query('SELECT 1 as test');
    return Date.now() - start;
};

/**
 * Graceful shutdown - close all connections
 * Call this when shutting down the application
 */
export const closePool = async (): Promise<void> => {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('Database pool closed');
    }
};

/**
 * Default export for convenience
 */
export default {
    getPool,
    query,
    getClient,
    getPoolMetrics,
    testConnection,
    closePool,
};
