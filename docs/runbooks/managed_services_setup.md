# Managed Services Setup Guide

## Overview

This runbook provides step-by-step instructions for provisioning all external managed services required for the Everything Market platform. **These steps must be performed by humans**—agents cannot provision external services.

> [!IMPORTANT]
> This guide is for **STAGING ENVIRONMENT ONLY**. Production provisioning is deferred to Phase 13+.

---

## Prerequisites

- [ ] GitHub repository created and accessible
- [ ] Credit card or payment method (for paid tiers if needed)
- [ ] Admin access to organization accounts
- [ ] Password manager for credential storage

---

## Service 1: Neon Database (PostgreSQL)

**Provider**: [Neon](https://neon.tech)  
**Purpose**: Primary PostgreSQL database  
**Tier**: Free tier for staging (sufficient for development)

### Steps

1. **Create Neon Account**
   - Go to https://neon.tech
   - Sign up with GitHub OAuth (recommended)
   - Verify email

2. **Create Staging Project**
   - Click "New Project"
   - Project name: `xmarket-staging`
   - Region: Choose closest to your Vercel deployment region
   - PostgreSQL version: 15+ (latest stable)
   - Click "Create Project"

3. **Obtain Connection String**
   - Navigate to "Dashboard" → "Connection Details"
   - Copy the connection string
   - Format: `postgres://user:password@host/dbname`
   - **Copy both**: Direct connection AND Pooled connection URLs

4. **Configure Auto-Suspend** (Free tier optimization)
   - Settings → Compute
   - Enable "Auto-suspend" after 5 minutes of inactivity
   - This saves compute credits on free tier

5. **Save Credentials**
   ```bash
   # Save to password manager
   NEON_DATABASE_URL=postgres://user:pass@ep-xxx.region.aws.neon.tech/xmarket
   NEON_DATABASE_URL_POOLED=postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/xmarket?sslmode=require
   ```

### Post-Setup Verification
```bash
# Test connection
psql $NEON_DATABASE_URL -c "SELECT version();"
```

---

## Service 2: Upstash (Redis-like KV Store)

**Provider**: [Upstash](https://upstash.com)  
**Purpose**: Caching, rate limiting, nonce storage  
**Tier**: Free tier (10k commands/day sufficient for staging)

### Steps

1. **Create Upstash Account**
   - Go to https://console.upstash.com
   - Sign up with GitHub OAuth
   - Verify email

2. **Create Redis Database**
   - Click "Create Database"
   - Name: `xmarket-staging-cache`
   - Region: Choose same/closest to Neon region
   - Type: "Global" (for free tier) or "Regional" (faster, paid)
   - TLS: **Enabled** (default)
   - Eviction: **LRU** (Least Recently Used)

3. **Obtain REST API Credentials**
   - Navigate to database → "REST API" tab
   - Copy:
     - `UPSTASH_REST_URL`
     - `UPSTASH_REST_TOKEN`

4. **Save Credentials**
   ```bash
   UPSTASH_REST_URL=https://   xxx.upstash.io
   UPSTASH_REST_TOKEN=AxxxYYYzzz...
   ```

### Post-Setup Verification
```bash
# Test connection (requires curl)
curl -H "Authorization: Bearer $UPSTASH_REST_TOKEN" \
  "$UPSTASH_REST_URL/set/test/hello"

curl -H "Authorization: Bearer $UPSTASH_REST_TOKEN" \
  "$UPSTASH_REST_URL/get/test"
# Expected: "hello"
```

---

## Service 3: Vector Database

**Decision Checkpoint**: Choose provider (Week 1-2)

### Option A: Pinecone (Recommended for Simplicity)

**Provider**: [Pinecone](https://www.pinecone.io)  
**Tier**: Free tier (1 index, 100k vectors)

1. Create account at https://app.pinecone.io
2. Create index:
   - Name: `xmarket-staging-embeddings`
   - Dimensions: 384 (for `sentence-transformers/all-MiniLM-L6-v2`)
   - Metric: `cosine`
   - Pod type: `s1.x1` (free tier)
3. Obtain API key from "API Keys" tab
4. Save:
   ```bash
   VECTOR_DB_URL=https://xmarket-staging-embeddings-xxx.svc.pinecone.io
   VECTOR_DB_API_KEY=xxx-yyy-zzz
   VECTOR_DB_PROVIDER=pinecone
   ```

### Option B: Supabase Vector (Alternative)

**Provider**: [Supabase](https://supabase.com)  
**Tier**: Free tier (500MB database, includes pgvector)

1. Create account at https://supabase.com
2. Create project: `xmarket-staging`
3. Enable `pgvector` extension:
   - SQL Editor → Run:
     ```sql
     CREATE EXTENSION vector;
     ```
4. Obtain connection string from "Project Settings" → "Database"
5. Save:
   ```bash
   VECTOR_DB_URL=postgres://postgres:pass@db.xxx.supabase.co:5432/postgres
   VECTOR_DB_PROVIDER=supabase
   ```

### Recommendation
- **Pinecone**: Easier setup, managed vector search
- **Supabase**: More control, can reuse PostgreSQL knowledge

**TODO**: Document final choice in `docs/decisions.md` after evaluation

---

## Service 4: Object Storage (S3-Compatible)

**Decision Checkpoint**: Choose provider

### Option A: Vercel Blob (Recommended for Vercel Deployment)

**Provider**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)  
**Tier**: Free tier (1GB, sufficient for staging)

1. Navigate to Vercel dashboard
2. Select project (created in Service 6)
3. Storage → "Create Store" → "Blob"
4. Name: `xmarket-staging-snapshots`
5. Credentials automatically added to Vercel environment variables:
   ```bash
   BLOB_READ_WRITE_TOKEN=vercel_blob_xxx
   ```

### Option B: Cloudflare R2 (Alternative)

**Provider**: [Cloudflare R2](https://www.cloudflare.com/products/r2/)  
**Tier**: Free tier (10GB/month)

1. Create Cloudflare account
2. R2 → "Create Bucket"
3. Name: `xmarket-staging-snapshots`
4. Create R2 API token
5. Save:
   ```bash
   OBJECT_STORE_URL=https://xxx.r2.cloudflarestorage.com
OBJECT_STORE_KEY=xxx
   OBJECT_STORE_SECRET=yyy
   OBJECT_STORE_PROVIDER=r2
   ```

**Recommendation**: Use Vercel Blob for simplicity if deploying to Vercel

---

## Service 5: Realtime Provider

**Decision Checkpoint**: Choose provider (Week 1)

### Option A: Ably (Recommended for Production-Grade)

**Provider**: [Ably](https://ably.com)  
**Tier**: Free tier (3M messages/month)

1. Create account at https://ably.com/signup
2. Create app: `xmarket-staging`
3. API Keys → Copy "Root API Key"
4. Save:
   ```bash
   REALTIME_PROVIDER_KEY=xxx.yyy:zzz
   REALTIME_PROVIDER=ably
   ```

### Option B: Pusher (Alternative)

**Provider**: [Pusher](https://pusher.com)  
**Tier**: Free tier (200k messages/day)

1. Create account at https://dashboard.pusher.com/accounts/sign_up
2. Create channel: `xmarket-staging`
3. Copy credentials (app_id, key, secret)
4. Save:
   ```bash
   PUSHER_APP_ID=xxx
   PUSHER_KEY=yyy
   PUSHER_SECRET=zzz
   PUSHER_CLUSTER=us2
   REALTIME_PROVIDER=pusher
   ```

### Option C: Supabase Realtime (If using Supabase for Vector DB)

**Provider**: Supabase  
**Tier**: Included in free tier

1. Use same Supabase project from Vector DB setup
2. API Keys → Copy "anon public" key
3. Save:
   ```bash
   REALTIME_PROVIDER_KEY=eyJxxx...
   REALTIME_PROVIDER_URL=https://xxx.supabase.co
   REALTIME_PROVIDER=supabase
   ```

**TODO**: Document final choice in `docs/decisions.md`

---

## Service 6: Vercel Project

**Provider**: [Vercel](https://vercel.com)  
**Purpose**: Hosting frontend + serverless functions  
**Tier**: Hobby (free) for staging

### Steps

1. **Create Vercel Account**
   - Go to https://vercel.com/signup
   - Sign up with GitHub OAuth
   - Authorize Vercel to access repositories

2. **Import Project**
   - Dashboard → "New Project"
   - Import `xmarket` repository
   - Framework Preset: "Next.js" (if using Next.js) or "Other"
   - Click "Import"

3. **Configure Build Settings**
   - Root Directory: `./` (or `src/frontend` if monorepo)
   - Build Command: (will be configured in Phase 9)
   - Output Directory: `.next` (for Next.js)

4. **Configure Environment Variables**
   - Project Settings → "Environment Variables"
   - Add all variables from previous services:
     ```bash
     NEON_DATABASE_URL=...
     UPSTASH_REST_URL=...
     UPSTASH_REST_TOKEN=...
     VECTOR_DB_URL=...
     VECTOR_DB_API_KEY=...
     # ... (see checklist below)
     ```
   - **Scope**: "Preview" and "Development" only (NOT Production yet)

5. **Enable Preview Deployments**
   - Settings → Git → Enable "Automatically create Preview Deployments"
   - This allows PRs to deploy to preview URLs

6. **Configure Sandbox Mode** (for agent previews)
   - Add environment variable:
     ```bash
     SANDBOX_MODE=true
     NODE_ENV=preview
     ```

### Post-Setup Verification
- Push to `dev` branch
- Verify preview deployment succeeds
- Check deployment logs for errors

---

## Service 7: Hugging Face (LLM Provider)

**Provider**: [Hugging Face](https://huggingface.co)  
**Purpose**: LLM inference for summarization and embeddings  
**Tier**: Free tier (limited rate, sufficient for staging)

### Steps

1. **Create Hugging Face Account**
   - Go to https://huggingface.co/join
   - Sign up and verify email

2. **Generate API Token**
   - Settings → Access Tokens
   - Create "Read" token (or "Write" if fine-tuning)
   - Copy token

3. **Choose Models** (Decision Checkpoint - Week 1)
   - **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2` (recommended for start)
   - **Generation Model**: TBD (evaluate `google/flan-t5-base` or similar)
   - Document choice in `docs/decisions.md`

4. **Save Credentials**
   ```bash
   HUGGINGFACE_API_KEY=hf_xxx
   HUGGINGFACE_API_URL=https://api-inference.huggingface.co/models/
   EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
   LLM_MODE=enabled  # or 'disabled' for testing
   ```

### Post-Setup Verification
```bash
# Test embedding API (requires curl + jq)
curl -X POST \
  -H "Authorization: Bearer $HUGGINGFACE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"inputs": "Hello world"}' \
  "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
# Expected: array of 384 floats
```

---

## Environment Variables Checklist

After completing all services, verify all variables are set in Vercel:

```bash
# Database
✓ NEON_DATABASE_URL
✓ NEON_DATABASE_URL_POOLED (optional, recommended)

# Cache & KV
✓ UPSTASH_REST_URL
✓ UPSTASH_REST_TOKEN

# Vector DB (choose one provider)
✓ VECTOR_DB_URL
✓ VECTOR_DB_API_KEY (Pinecone)
# OR
✓ VECTOR_DB_URL (Supabase reuses Neon/Supabase Postgres)

# Object Storage (choose one provider)
✓ BLOB_READ_WRITE_TOKEN (Vercel Blob)
# OR
✓ OBJECT_STORE_URL (R2)
✓ OBJECT_STORE_KEY (R2)
✓ OBJECT_STORE_SECRET (R2)

# Realtime (choose one provider)
✓ REALTIME_PROVIDER_KEY
✓ REALTIME_PROVIDER (ably/pusher/supabase)

# LLM
✓ HUGGINGFACE_API_KEY
✓ HUGGINGFACE_API_URL
✓ EMBEDDING_MODEL
✓ LLM_MODE

# App Config
✓ NODE_ENV=staging
✓ SANDBOX_MODE=true
```

**Verification Command**:
```bash
# In Vercel CLI
vercel env ls --environment preview
```

---

## Security Checklist

- [ ] All API keys stored in Vercel environment variables (never in code)
- [ ] Credentials saved in organization password manager
- [ ] API keys have minimal required permissions (read-only where possible)
- [ ] Production variables NOT set yet (staging/preview only)
- [ ] TLS/SSL enabled for all service connections
- [ ] `.env.example` file created in repo (without actual values)

---

## Next Steps

1. **Apply database migrations** (see `migration_checklist.md`)
2. **Test all service connections** from Vercel preview deployment
3. **Document provider decisions** in `docs/decisions.md`
4. **Proceed to Phase 2**: Security primitives (HMAC utilities)

---

## Troubleshooting

### Issue: Connection timeout from Vercel to Neon
- **Solution**: Ensure Neon project is in same region (or nearby)
- Check Neon auto-suspend settings (may need to keep warm)

### Issue: Upstash rate limit exceeded
- **Solution**: Free tier has 10k commands/day limit
- Upgrade to paid tier or reduce cache usage

### Issue: Vector DB dimension mismatch
- **Solution**: Ensure embedding model dimensions match index dimensions
- `all-MiniLM-L6-v2` = 384 dimensions

### Issue: Vercel deployment fails with "Module not found"
- **Solution**: Ensure all dependencies in `package.json`
- Check build logs for missing environment variables

---

## Support Contacts

- **Neon**: https://neon.tech/docs/introduction
- **Upstash**: https://docs.upstash.com/redis
- **Pinecone**: https://docs.pinecone.io
- **Vercel**: https://vercel.com/docs
- **Hugging Face**: https://huggingface.co/docs
