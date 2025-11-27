# Foundation Setup - Quick Start

## Overview

This guide will get your development environment running in ~15 minutes.

---

## Prerequisites

- ✅ Phase 1 complete (database migrated, services provisioned)
- ✅ `.env.local` copied to repository root
- ✅ PostgreSQL client (psql) installed
- ✅ Node.js 18+ installed

---

## Quick Setup (15 minutes)

### 1. Install Infrastructure Dependencies (2 min)

```bash
cd c:\Users\khoua\OneDrive\Desktop\Xmarket\src

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 2. Initialize Next.js (5 min)

```bash
cd c:\Users\khoua\OneDrive\Desktop\Xmarket\src\frontend

# Initialize Next.js
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"

# When prompted:
# ✔ Would you like to use Turbopack? … No
# ✔ Would you like to customize import alias? … No

# Install additional dependencies
npm install pg @upstash/redis @pinecone-database/pinecone @vercel/blob
npm install -D @types/pg

# Copy environment variables
copy ..\..\. env.local .env.local
```

### 3. Update TypeScript Config (1 min)

Edit `src/frontend/tsconfig.json` and add to `compilerOptions.paths`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/infra/*": ["../../infra/*"]
    }
  }
}
```

### 4. Start Dev Server (1 min)

```bash
# Still in src/frontend
npm run dev
```

Visit: http://localhost:3000

### 5. Test Health Check (1 min)

```bash
# In a new terminal
curl http://localhost:3000/api/health | jq
```

Expected: All services show `"status": "healthy"`

### 6. Test Jobs API (2 min)

```bash
# Create a job
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "test",
    "idempotency_key": "quickstart-001",
    "payload": {"test": true}
  }' | jq

# Create duplicate (should return same job_id)
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "test",
    "idempotency_key": "quickstart-001",
    "payload": {"different": true}
  }' | jq
```

### 7. Verify in Database (2 min)

```bash
psql "postgresql://neondb_owner:npg_7HXxQztwRU1u@ep-patient-dream-adyej6lf-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

```sql
SELECT * FROM jobs WHERE job_type = 'test';
-- Should see 1 row

DELETE FROM jobs WHERE job_type = 'test';
\q
```

---

## Success Checklist

- [ ] Next.js dev server running on http://localhost:3000
- [ ] Health check returns 200 with all services healthy
- [ ] Jobs API creates jobs successfully
- [ ] Duplicate requests return same job_id (idempotency working)
- [ ] Database shows correct records

---

## If Something Goes Wrong

**Issue**: "Cannot find module '@/infra/db/pool'"  
**Fix**: Ensure TypeScript paths are configured in both `src/tsconfig.json` and `src/frontend/tsconfig.json`

**Issue**: "NEON_DATABASE_URL is not set"  
**Fix**: Copy `.env.local` to `src/frontend/.env.local`

**Issue**: "Connection timeout"  
**Fix**: Neon database may be auto-suspended, connect with psql first to wake it up

**Issue**: API routes return 404  
**Fix**: Ensure file paths are correct: `src/frontend/app/api/health/route.ts`

---

## Next Steps

After setup is complete:
1. Review files created (`git status`)
2. Commit foundation setup
3. Proceed to Phase 2: Security primitives (HMAC)

---

**For detailed testing**: See `docs/runbooks/foundation_testing.md`
