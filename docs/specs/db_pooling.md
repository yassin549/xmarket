# Database Connection Pooling

## Overview

Database connection pooling is critical for serverless environments like Vercel, where functions are ephemeral and connection limits are strict. This document defines connection pooling strategies for the Everything Market platform.

## The Problem

**Neon PostgreSQL** (and most PostgreSQL providers) have connection limits:
- Free tier: ~20 connections
- Pro tier: ~100 connections

**Vercel Serverless Functions** are stateless and short-lived:
- Each function invocation may create new DB connection
- Functions scale horizontally (100s of instances)
- Without pooling: connection exhaustion → service outage

## Solution: Connection Pooling

### Strategy 1: Application-Level Pooling (Current)

Use `pg` library's connection pool within each serverless function.

**Configuration**:
```javascript
// src/infra/db/pool.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  
  // CRITICAL: Keep low for serverless
  max: 5,  // Maximum 5 connections per function instance
  
  // Short timeouts for serverless
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 3000,  // Fail fast if pool exhausted
  
  // Reconnection
  allowExitOnIdle: true,  // Allow process to exit when idle
});

export default pool;
```

**Why `max: 5`?**
- Vercel can scale to 100+ function instances
- 100 instances × 5 connections = 500 total connections
- With pooling, typical active connections: 20-50
- Without pooling: 100+ connections (exhaustion)

### Strategy 2: External Connection Pooler (Recommended for Production)

Use **PgBouncer** or Neon's built-in pooler as external proxy.

#### Option A: Neon Pooling (Built-in)

Neon provides pooled connection strings:

```bash
# Direct connection (limited)
NEON_DATABASE_URL=postgres://user:pass@host/db

# Pooled connection (use this)
NEON_DATABASE_URL=postgres://user:pass@host/db?sslmode=require&pooling=true
```

**Benefits**:
- Managed by Neon
- No additional infrastructure
- Connection limit handled by Neon

**Trade-offs**:
- Less control over pool parameters
- May have slight latency overhead

#### Option B: Self-hosted PgBouncer

Deploy PgBouncer on dedicated instance:

```ini
# pgbouncer.ini
[databases]
xmarket = host=neon-host.com port=5432 dbname=xmarket

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction  # Best for serverless
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5

# Timeouts
server_idle_timeout = 600
server_lifetime = 3600
```

**Connection string**:
```bash
PGBOUNCER_URL=postgres://user:pass@pgbouncer-host:6432/xmarket
```

**Benefits**:
- Fine-grained control
- Advanced pool modes (transaction, session, statement)
- Better monitoring and observability

**Trade-offs**:
- Additional infrastructure to manage
- Operational overhead

## Recommended Configuration by Environment

### Development (Local)
```javascript
{
  max: 10,  // More connections for local testing
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 5000
}
```

### Preview (Vercel Preview Deployments)
```javascript
{
  max: 3,  // Conservative for preview branches
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 2000
}
```

### Staging (Vercel Staging)
```javascript
{
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000
}
```

### Production (Vercel Production)
```javascript
{
  max: 5,  // With PgBouncer or Neon pooling
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000
}
```

## Implementation

### 1. Create Pool Module

```typescript
// src/infra/db/pool.ts
import { Pool, PoolConfig } from 'pg';

const getPoolConfig = (): PoolConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  const baseConfig: PoolConfig = {
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  };
  
  const envConfigs: Record<string, Partial<PoolConfig>> = {
    development: {
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 5000,
    },
    preview: {
      max: 3,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 2000,
    },
    staging: {
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    },
    production: {
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    },
  };
  
  return { ...baseConfig, ...envConfigs[env] };
};

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool(getPoolConfig());
    
    // Error handling
    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
      process.exit(-1);
    });
  }
  
  return pool;
};

export default getPool();
```

### 2. Usage in API Routes

```typescript
// src/backend/api/markets/route.ts
import pool from '@/infra/db/pool';

export async function GET(request: Request) {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT * FROM markets LIMIT 10');
    return Response.json(result.rows);
  } finally {
    client.release();  // CRITICAL: Always release
  }
}
```

### 3. Health Check Endpoint

```typescript
// src/backend/api/health/route.ts
import pool from '@/infra/db/pool';

export async function GET() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    return Response.json({
      status: 'healthy',
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    });
  } catch (error) {
    return Response.json({ status: 'unhealthy', error }, { status: 500 });
  }
}
```

## Monitoring

### Metrics to Track

1. **Pool utilization**: `pool.totalCount` / `max`
2. **Waiting clients**: `pool.waitingCount` (should be 0)
3. **Idle connections**: `pool.idleCount`
4. **Connection errors**: Log all `pool.on('error')` events

### Datadog/Grafana Queries

```javascript
// Export metrics for monitoring
export const getPoolMetrics = () => ({
  'db.pool.total': pool.totalCount,
  'db.pool.idle': pool.idleCount,
  'db.pool.waiting': pool.waitingCount,
  'db.pool.max': pool.options.max,
});
```

### Alerts

- **Alert 1**: `pool.waitingCount > 0` for >30s → Scale up or increase `max`
- **Alert 2**: Connection errors → Check Neon status and credentials
- **Alert 3**: `pool.totalCount == max` for >60s → Pool exhaustion risk

## Troubleshooting

### Issue: "Sorry, too many clients already"

**Symptom**: PostgreSQL connection limit exceeded

**Solutions**:
1. Reduce `max` in pool config (more instances sharing fewer connections)
2. Use PgBouncer or Neon pooling
3. Upgrade Neon plan (higher connection limit)
4. Check for connection leaks (missing `client.release()`)

### Issue: High latency on cold starts

**Symptom**: First request after idle period is slow

**Solutions**:
1. Use Neon pooling (keeps connections warm)
2. Implement connection pre-warming in serverless function init
3. Accept trade-off (cold starts are inherent to serverless)

### Issue: Connection leaks

**Symptom**: `pool.idleCount` never decreases, `pool.totalCount` grows

**Solutions**:
1. Audit all database code for missing `client.release()`
2. Use `try/finally` pattern religiously
3. Enable pool debugging: `pool.on('acquire', ...)` and `pool.on('release', ...)`

## Best Practices

1. **Always release connections** - Use `try/finally` blocks
2. **Use transactions sparingly** - Transactions hold connections longer
3. **Monitor pool metrics** - Track utilization and waiting clients
4. **Use PgBouncer for production** - External pooling is more robust
5. **Keep `max` low in serverless** - Scale horizontally, not per-function
6. **Test connection exhaustion** - Simulate 100+ concurrent requests in staging

## References

- [node-postgres pooling](https://node-postgres.com/features/pooling)
- [Neon connection pooling](https://neon.tech/docs/connect/connection-pooling)
- [PgBouncer documentation](https://www.pgbouncer.org/)
- [Vercel serverless functions limits](https://vercel.com/docs/functions/serverless-functions/runtimes)
