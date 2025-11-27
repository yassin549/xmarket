# Foundation Setup - Testing Guide

## Prerequisites

1. **Next.js initialized** (follow `docs/runbooks/nextjs_setup.md`)
2. **Dependencies installed** in `src/` directory
3. **Environment variables** configured in `src/frontend/.env.local`

---

## Step 1: Install Infrastructure Dependencies

```bash
cd src

# Install dependencies
npm install

# Build TypeScript
npm run build
```

Expected output: TypeScript compiles successfully, `dist/` directory created.

---

## Step 2: Test Database Pool (Optional)

```bash
cd src

# Create a test script
node -e "
const { testConnection } = require('./dist/infra/db/pool');
testConnection().then(latency => {
  console.log('Database connection successful!');
  console.log('Latency:', latency, 'ms');
  process.exit(0);
}).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
"
```

Expected: "Database connection successful! Latency: XX ms"

---

## Step 3: Start Next.js Dev Server

```bash
cd src/frontend

# Start dev server
npm run dev
```

Expected: Server starts on http://localhost:3000

---

## Step 4: Test Health Check API

```bash
# In a new terminal
curl http://localhost:3000/api/health | jq
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-24T...",
  "environment": "development",
  "services": {
    "database": {
      "status": "healthy",
      "latency_ms": 45,
      "details": {
        "pool": {
          "total": 1,
          "idle": 0,
          "waiting": 0
        }
      }
    },
    "cache": {
      "status": "healthy",
      "latency_ms": 12
    },
    "vector_db": {
      "status": "healthy",
      "latency_ms": 89
    },
    "storage": {
      "status": "healthy"
    }
  }
}
```

**If any service shows "unhealthy"**:
- Check `.env.local` has correct credentials
- Verify services are accessible
- Check terminal logs for error details

---

## Step 5: Test Jobs API - Create Job

```bash
# Create a job
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "manual_test",
    "idempotency_key": "test-001",
    "payload": {"url": "https://example.com", "test": true}
  }' | jq
```

Expected response:
```json
{
  "job_id": "uuid-here",
  "job_type": "manual_test",
  "idempotency_key": "test-001",
  "status": "pending",
  "payload": {"url": "https://example.com", "test": true},
  "attempts": 0,
  "created_at": "2025-11-24T...",
  "updated_at": "2025-11-24T...",
  "completed_at": null,
  "error_message": null
}
```

---

## Step 6: Test Idempotency - Duplicate Request

```bash
# Send the SAME request again
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "manual_test",
    "idempotency_key": "test-001",
    "payload": {"url": "https://different.com", "different": true}
  }' | jq
```

Expected: **Same job_id** returned (idempotency working!)
Note: `updated_at` will be newer, but `created_at` remains the same.

---

## Step 7: Test Jobs API - Get Job

```bash
# Get job by type and key
curl "http://localhost:3000/api/jobs?job_type=manual_test&idempotency_key=test-001" | jq
```

Expected: Same job returned.

---

## Step 8: Verify in Database

```bash
# Connect to Neon
psql "postgresql://neondb_owner:npg_7HXxQztwRU1u@ep-patient-dream-adyej6lf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

```sql
-- Check jobs table
SELECT job_type, idempotency_key, status, created_at 
FROM jobs 
WHERE job_type = 'manual_test';

-- Should see 1 row with status='pending'

-- Cleanup test data
DELETE FROM jobs WHERE job_type = 'manual_test';
```

---

## Step 9: Test Error Handling

```bash
# Test missing fields
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"job_type": "test"}' | jq

# Expected: 400 error with message about missing idempotency_key

# Test invalid job type
curl "http://localhost:3000/api/jobs?job_type=nonexistent&idempotency_key=test" | jq

# Expected: 404 not found
```

---

## Success Criteria

✅ Health check returns 200 with all services "healthy"  
✅ POST /api/jobs creates job successfully  
✅ Duplicate POST returns same job_id (idempotency)  
✅ GET /api/jobs retrieves job correctly  
✅ Database shows correct job record  
✅ Pool metrics within expected ranges (total < max)  
✅ Error handling works (400 for bad requests, 404 for not found)

---

## Troubleshooting

### Issue: "NEON_DATABASE_URL environment variable is not set"
**Solution**: Ensure `.env.local` exists in `src/frontend/` with correct connection string

### Issue: "Connection timeout"
**Solution**: Check Neon database is active (may be auto-suspended), try connecting with psql first

### Issue: "404 not found" on API routes
**Solution**: Ensure Next.js dev server is running, check file paths are correct

### Issue: Pool exhaustion (waiting > 0)
**Solution**: Check for missing `client.release()` calls, restart dev server

---

## Next Steps

After all tests pass:
1. Document any issues found
2. Proceed to Phase 2: Security primitives (HMAC)
3. Add automated tests with Jest
4. Deploy to Vercel preview environment
