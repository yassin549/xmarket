# Railway Deployment - Manual Service Setup

Since Railway's auto-detection may not work perfectly for monorepos, here's the manual setup process:

## Step 1: Push to GitHub

```bash
# If you haven't already
git remote add origin https://github.com/YOUR_USERNAME/xmarket.git
git push -u origin main
```

## Step 2: Create Railway Project

1. Go to https://railway.app/new
2. Click **"Empty Project"**
3. Name it `xmarket`

## Step 3: Add PostgreSQL Database

1. Click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway creates the database with auto-generated `DATABASE_URL`

## Step 4: Add Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your `xmarket` repository
3. Railway will ask for **Root Directory** → Enter: `backend`
4. **Service Settings**:
   - Name: `backend`
   - Build: Dockerfile (auto-detected from `backend/Dockerfile`)
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

5. **Environment Variables** (click "Variables"):
   ```
   REALITY_API_SECRET=<run: python scripts/generate_secrets.py>
   ADMIN_API_KEY=<from generate_secrets.py>
   JWT_SECRET=<from generate_secrets.py>
   PORT=8000
   ```
   
   Note: `DATABASE_URL` is automatically added by Railway

6. Click **"Deploy"**

## Step 5: Add Orderbook Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select `xmarket` repository
3. **Root Directory**: `orderbook`
4. **Service Settings**:
   - Name: `orderbook`
   - Build: Dockerfile
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

5. **Environment Variables**:
   ```
   PORT=8001
   ```

6. Click **"Deploy"**

## Step 6: Add Reality Engine Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select `xmarket` repository
3. **Root Directory**: `reality-engine`
4. **Service Settings**:
   - Name: `reality-engine`
   - Build: Dockerfile
   - Start Command: `python -m app.main`

5. **Environment Variables**:
   ```
   REALITY_API_SECRET=<same as backend>
   POLL_INTERVAL=300
   LLM_MODE=heuristic
   ```

6. Click **"Deploy"**

## Step 7: Add Frontend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select `xmarket` repository
3. **Root Directory**: `frontend`
4. **Service Settings**:
   - Name: `frontend`
   - Build: Dockerfile
   - Start Command: `nginx -g 'daemon off;'`

5. **Environment Variables**:
   ```
   (Set after getting backend URL)
   ```

6. Click **"Deploy"**

## Step 8: Configure Service URLs

After all services deploy, Railway assigns public URLs. Now update cross-service references:

### Get Service URLs

Go to each service → Settings → Networking → Copy the public URL:
- Backend: `backend-production-XXXX.up.railway.app`
- Orderbook: `orderbook-production-XXXX.up.railway.app`

### Update Environment Variables

**Backend Service** → Variables → Add:
```
ORDERBOOK_URL=https://orderbook-production-XXXX.up.railway.app
```

**Reality Engine Service** → Variables → Add:
```
BACKEND_URL=https://backend-production-XXXX.up.railway.app
```

**Frontend Service** → Variables → Add:
```
VITE_BACKEND_URL=https://backend-production-XXXX.up.railway.app
VITE_WS_URL=wss://backend-production-XXXX.up.railway.app/ws/updates
```

### Redeploy Services

After updating URLs:
1. Go to each service
2. Click **"Deployments"** tab
3. Click **"Redeploy"** on the latest deployment

## Step 9: Initialize Database

### Option A: Railway CLI (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run initialization
railway run python scripts/init_db.py
```

### Option B: SQL Query (Browser)

1. Go to **PostgreSQL service** → **Data** tab → **Query**
2. Copy the entire contents of `scripts/init_database.sql`
3. Paste into the query editor
4. Click **"Run"**
5. Verify output shows stocks created

## Step 10: Verify Deployment

### Check Health Endpoints

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
```
https://frontend-production-XXXX.up.railway.app/
```
Expected: Dashboard loads with stock selector

### Test API

**List Stocks**:
```
https://backend-production-XXXX.up.railway.app/api/v1/stocks
```
Should return: `[{"symbol":"ELON",...}, {"symbol":"AI_INDEX",...}, ...]`

## Step 11: Generate Secrets

Run locally before deployment:

```bash
python scripts/generate_secrets.py
```

Copy the output and use for environment variables in Step 4-7.

## Troubleshooting

### Service Won't Build

**Check**:
1. Logs tab for build errors
2. Dockerfile path is correct
3. Root directory is set correctly

**Common Issues**:
- Missing `config/` directory → Copy from root to each service
- Import errors → Check Python path in Dockerfile

### Database Connection Failed

**Check**:
1. PostgreSQL service is running
2. `DATABASE_URL` variable exists (auto-added by Railway)
3. Services are in same project

**Fix**: Railway auto-adds `DATABASE_URL` to all services in the same project

### Frontend Shows "Loading..."

**Check**:
1. Browser console for errors
2. `VITE_BACKEND_URL` is correct
3. Backend is running

**Fix**: 
- Verify backend URL has `https://` prefix
- Verify WebSocket URL has `wss://` prefix

### Reality Engine Not Publishing Events

**Check**:
1. Logs for scraping activity
2. `BACKEND_URL` is correct
3. `REALITY_API_SECRET` matches backend

**Fix**: Ensure secrets match exactly between services

## Railway Service Configuration Summary

| Service | Root Dir | Dockerfile | Port | Health Check |
|---------|----------|------------|------|--------------|
| backend | `backend` | `backend/Dockerfile` | 8000 | `/health` |
| orderbook | `orderbook` | `orderbook/Dockerfile` | 8001 | `/` |
| reality-engine | `reality-engine` | `reality-engine/Dockerfile` | N/A | None |
| frontend | `frontend` | `frontend/Dockerfile` | 80 | `/` |

## Environment Variables Quick Reference

### Shared (All Services)
- `DATABASE_URL` - Auto-provided by Railway

### Backend
- `REALITY_API_SECRET` - Generate with scripts/generate_secrets.py
- `ADMIN_API_KEY` - Generate with scripts/generate_secrets.py
- `JWT_SECRET` - Generate with scripts/generate_secrets.py
- `ORDERBOOK_URL` - https://orderbook-production-XXXX.up.railway.app
- `PORT` - 8000

### Orderbook
- `PORT` - 8001

### Reality Engine
- `REALITY_API_SECRET` - Same as backend
- `BACKEND_URL` - https://backend-production-XXXX.up.railway.app
- `POLL_INTERVAL` - 300
- `LLM_MODE` - heuristic

### Frontend
- `VITE_BACKEND_URL` - https://backend-production-XXXX.up.railway.app
- `VITE_WS_URL` - wss://backend-production-XXXX.up.railway.app/ws/updates

## Cost Estimate

**Monthly Cost** (Railway Pro Plan recommended):
- 4 services × $5/month = $20
- PostgreSQL: $5/month
- **Total**: ~$25/month

**Free Tier**: $5 credit/month (services sleep after inactivity)

## Next Steps After Deployment

1. ✅ Test all health endpoints
2. ✅ Create test stock via admin API
3. ✅ Run `python scripts/demo_event.py` locally
4. ✅ Watch dashboard update in real-time
5. ✅ Place test orders
6. ✅ Monitor logs for errors

---

**Deployment Time**: ~20-30 minutes
**Difficulty**: Medium (manual service setup)
**Support**: Railway Discord at discord.gg/railway
