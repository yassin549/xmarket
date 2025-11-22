# Railway Deployment - Correct Method for Monorepo

## ⚠️ IMPORTANT: Do NOT Deploy from Root

Railway's monorepo support requires creating each service separately, each pointing to its subdirectory.

## Step-by-Step Deployment

### Step 1: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/xmarket.git
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Click **"Empty Project"** (NOT "Deploy from GitHub repo")
4. Name it `xmarket`

### Step 3: Add PostgreSQL Database

1. In your project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway creates database with `DATABASE_URL` automatically

### Step 4: Add Backend Service

1. Click **"+ New"**
2. Select **"GitHub Repo"**
3. Authorize Railway to access GitHub (if needed)
4. Select your `xmarket` repository
5. **CRITICAL**: Railway will ask "Configure" → Click **"Add variables"** → Skip for now
6. After service is created, go to **Settings**:
   - **Service Name**: Change to `backend`
   - **Root Directory**: Set to `backend` ⭐ THIS IS KEY
   - **Watch Paths**: Leave as default or set to `backend/**`
7. Go to **Variables** tab and add:
   ```
   REALITY_API_SECRET=<generate with: python scripts/generate_secrets.py>
   ADMIN_API_KEY=<from generate_secrets.py>
   JWT_SECRET=<from generate_secrets.py>
   ```
8. Railway will auto-detect `backend/Dockerfile` and deploy

### Step 5: Add Orderbook Service

1. Click **"+ New"** → **"GitHub Repo"** → Select `xmarket`
2. Go to **Settings**:
   - **Service Name**: `orderbook`
   - **Root Directory**: `orderbook` ⭐
3. No additional variables needed (DATABASE_URL is auto-added)
4. Deploy

### Step 6: Add Reality Engine Service

1. Click **"+ New"** → **"GitHub Repo"** → Select `xmarket`
2. Go to **Settings**:
   - **Service Name**: `reality-engine`
   - **Root Directory**: `reality-engine` ⭐
3. Go to **Variables** and add:
   ```
   REALITY_API_SECRET=<same as backend>
   POLL_INTERVAL=300
   LLM_MODE=heuristic
   ```
4. Deploy

### Step 7: Add Frontend Service

1. Click **"+ New"** → **"GitHub Repo"** → Select `xmarket`
2. Go to **Settings**:
   - **Service Name**: `frontend`
   - **Root Directory**: `frontend` ⭐
3. Variables will be added after getting backend URL
4. Deploy

### Step 8: Configure Service URLs

After all services deploy, Railway assigns public domains.

#### Get Service URLs

For each service, go to **Settings** → **Networking** → **Public Networking**:
- Backend: `backend-production-XXXX.up.railway.app`
- Orderbook: `orderbook-production-XXXX.up.railway.app`

#### Update Cross-Service Variables

**Backend Service** → **Variables** → Add:
```
ORDERBOOK_URL=https://orderbook-production-XXXX.up.railway.app
```

**Reality Engine Service** → **Variables** → Add:
```
BACKEND_URL=https://backend-production-XXXX.up.railway.app
```

**Frontend Service** → **Variables** → Add:
```
VITE_BACKEND_URL=https://backend-production-XXXX.up.railway.app
VITE_WS_URL=wss://backend-production-XXXX.up.railway.app/ws/updates
```

#### Trigger Redeployment

After adding URLs:
1. Go to each service
2. Click **"Deployments"** tab
3. Click **"⋮"** menu on latest deployment → **"Redeploy"**

### Step 9: Initialize Database

#### Option A: Railway CLI (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Select the backend service
railway service

# Run init script
railway run python scripts/init_db.py
```

#### Option B: SQL Query (Browser)

1. Go to **PostgreSQL service** → **Data** tab
2. Click **"Query"**
3. Copy entire contents of `scripts/init_database.sql`
4. Paste and click **"Run"**
5. Verify: Should see "Stocks created: 3"

### Step 10: Verify Deployment

#### Check Service Health

**Backend**:
```
https://backend-production-XXXX.up.railway.app/health
```
Expected: `{"status":"healthy","database":"connected"}`

**Orderbook**:
```
https://orderbook-production-XXXX.up.railway.app/
```
Expected: `{"service":"everything-market-orderbook","status":"healthy"}`

**Frontend**:
Open in browser:
```
https://frontend-production-XXXX.up.railway.app/
```
Expected: Dashboard with stock selector

#### Test API

```
https://backend-production-XXXX.up.railway.app/api/v1/stocks
```
Should return array of 3 stocks (ELON, AI_INDEX, TECH)

---

## Why This Works

Railway's monorepo support works by:
1. **Root Directory**: Tells Railway where the service code lives
2. **Dockerfile Detection**: Railway finds `Dockerfile` in the root directory
3. **Build Context**: Railway builds from the specified root directory
4. **Separate Services**: Each service is independent with its own deployment

## Common Mistakes to Avoid

❌ **DON'T**: Deploy from project root (causes Nixpacks error)
✅ **DO**: Create each service separately with root directory set

❌ **DON'T**: Use railway.toml for monorepo (not well supported)
✅ **DO**: Set root directory in service settings

❌ **DON'T**: Forget to set root directory
✅ **DO**: Always set root directory BEFORE first deployment

## Troubleshooting

### "Nixpacks build failed"

**Cause**: Railway is trying to build from project root
**Fix**: 
1. Go to service **Settings**
2. Set **Root Directory** to service folder (e.g., `backend`)
3. Redeploy

### "Dockerfile not found"

**Cause**: Root directory not set correctly
**Fix**: Verify root directory matches folder name exactly

### Service won't start

**Check**:
1. **Logs** tab for errors
2. Environment variables are set
3. `DATABASE_URL` exists (auto-added by Railway)

### Database connection failed

**Fix**:
1. Ensure PostgreSQL service is in same project
2. Check `DATABASE_URL` variable exists
3. Verify services can communicate (same project = same network)

---

## Environment Variables Summary

### Backend
```
DATABASE_URL          (auto-added by Railway)
REALITY_API_SECRET    (generate with scripts/generate_secrets.py)
ADMIN_API_KEY         (generate with scripts/generate_secrets.py)
JWT_SECRET            (generate with scripts/generate_secrets.py)
ORDERBOOK_URL         (https://orderbook-production-XXXX.up.railway.app)
```

### Orderbook
```
DATABASE_URL          (auto-added)
```

### Reality Engine
```
DATABASE_URL          (auto-added)
REALITY_API_SECRET    (same as backend)
BACKEND_URL           (https://backend-production-XXXX.up.railway.app)
POLL_INTERVAL         (300)
LLM_MODE              (heuristic)
```

### Frontend
```
VITE_BACKEND_URL      (https://backend-production-XXXX.up.railway.app)
VITE_WS_URL           (wss://backend-production-XXXX.up.railway.app/ws/updates)
```

---

## Cost Estimate

**Monthly Cost** (Railway):
- 4 services × $5/month = $20
- PostgreSQL: $5/month
- **Total**: ~$25/month

**Free Tier**: $5 credit/month (services sleep after inactivity)

---

## Next Steps After Deployment

1. ✅ Test health endpoints
2. ✅ Verify database initialization
3. ✅ Create test stock via admin API
4. ✅ Run demo event script
5. ✅ Place test orders
6. ✅ Monitor logs

---

**Deployment Time**: 20-30 minutes
**Difficulty**: Medium
**Key**: Set root directory for each service!
