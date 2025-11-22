# Railway Deployment Guide (GitHub + Browser)

## Prerequisites
- GitHub account
- Railway account (sign up at railway.app)
- Git installed locally

---

## Step 1: Push to GitHub

### 1.1 Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `everything-market`
3. Description: "Reality-driven prediction market platform"
4. **Keep it Private** (recommended for now)
5. Click "Create repository"

### 1.2 Push Your Code
```bash
# Initialize git (if not already done)
cd c:\Users\khoua\OneDrive\Desktop\Xmarket
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Everything Market platform"

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/everything-market.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 2: Set Up Railway Project

### 2.1 Create New Project
1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub
5. Select your `everything-market` repository

### 2.2 Add PostgreSQL Database
1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will create a Postgres instance
4. Note: `DATABASE_URL` will be automatically available to all services

---

## Step 3: Create Services

You need to create **4 separate services**. For each service:

### 3.1 Backend Service

1. Click **"+ New"** → **"GitHub Repo"** → Select `everything-market`
2. **Service Name**: `backend`
3. **Settings** → **Root Directory**: `backend`
4. **Settings** → **Build**: Use Dockerfile
5. **Variables** → Add these environment variables:
   ```
   REALITY_API_SECRET=<generate using scripts/generate_secrets.py>
   ADMIN_API_KEY=<generate using scripts/generate_secrets.py>
   JWT_SECRET=<generate using scripts/generate_secrets.py>
   ORDERBOOK_URL=<will be orderbook service URL>
   PORT=8000
   ```
6. **Deploy**

### 3.2 Orderbook Service

1. Click **"+ New"** → **"GitHub Repo"** → Select `everything-market`
2. **Service Name**: `orderbook`
3. **Settings** → **Root Directory**: `orderbook`
4. **Settings** → **Build**: Use Dockerfile
5. **Variables** → Add:
   ```
   PORT=8001
   ```
6. **Deploy**

### 3.3 Reality Engine Service

1. Click **"+ New"** → **"GitHub Repo"** → Select `everything-market`
2. **Service Name**: `reality-engine`
3. **Settings** → **Root Directory**: `reality-engine`
4. **Settings** → **Build**: Use Dockerfile
5. **Variables** → Add:
   ```
   REALITY_API_SECRET=<same as backend>
   BACKEND_URL=<backend service URL>
   POLL_INTERVAL=300
   LLM_MODE=heuristic
   ```
6. **Deploy**

### 3.4 Frontend Service

1. Click **"+ New"** → **"GitHub Repo"** → Select `everything-market`
2. **Service Name**: `frontend`
3. **Settings** → **Root Directory**: `frontend`
4. **Settings** → **Build**: Use Dockerfile
5. **Variables** → Add:
   ```
   VITE_BACKEND_URL=<backend service URL>
   VITE_WS_URL=<backend WebSocket URL>
   ```
6. **Deploy**

---

## Step 4: Generate Secrets

Run this locally to generate secure secrets:

```bash
python scripts/generate_secrets.py
```

Copy the output and paste into Railway environment variables (Step 3).

---

## Step 5: Configure Service URLs

After all services are deployed, Railway will assign URLs. Update these:

### 5.1 Get Service URLs
- Backend: `https://backend-production-XXXX.up.railway.app`
- Orderbook: `https://orderbook-production-XXXX.up.railway.app`
- Frontend: `https://frontend-production-XXXX.up.railway.app`

### 5.2 Update Environment Variables

**Backend Service** → Variables:
```
ORDERBOOK_URL=https://orderbook-production-XXXX.up.railway.app
```

**Reality Engine Service** → Variables:
```
BACKEND_URL=https://backend-production-XXXX.up.railway.app
```

**Frontend Service** → Variables:
```
VITE_BACKEND_URL=https://backend-production-XXXX.up.railway.app
VITE_WS_URL=wss://backend-production-XXXX.up.railway.app/ws/updates
```

### 5.3 Redeploy Services
After updating URLs, click **"Redeploy"** on each service.

---

## Step 6: Initialize Database

### 6.1 Connect to Backend Service
1. Go to **Backend Service** → **Settings** → **Service**
2. Copy the **Service ID**

### 6.2 Run Database Initialization
Unfortunately, without Railway CLI, you'll need to:

**Option A: Use Railway CLI (recommended)**
```bash
npm install -g @railway/cli
railway login
railway run python scripts/init_db.py
```

**Option B: Manual SQL (if no CLI)**
1. Go to **PostgreSQL** → **Data** → **Query**
2. Run this SQL to create initial stocks:
```sql
-- Create stocks table (if not exists from migrations)
CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    market_weight FLOAT DEFAULT 0.6,
    reality_weight FLOAT DEFAULT 0.4,
    initial_score FLOAT DEFAULT 50.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create scores table
CREATE TABLE IF NOT EXISTS scores (
    symbol VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol),
    reality_score FLOAT DEFAULT 50.0,
    final_price FLOAT DEFAULT 50.0,
    confidence FLOAT DEFAULT 0.5,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Insert initial stocks
INSERT INTO stocks (symbol, name, description) VALUES
('ELON', 'Elon Musk Sentiment Index', 'Tracks sentiment around Elon Musk and his companies'),
('AI_INDEX', 'AI Industry Index', 'Composite index tracking AI industry sentiment'),
('TECH', 'Technology Sector Index', 'Broad technology sector sentiment tracker')
ON CONFLICT (symbol) DO NOTHING;

-- Insert initial scores
INSERT INTO scores (symbol, reality_score, final_price, confidence) VALUES
('ELON', 50.0, 50.0, 0.5),
('AI_INDEX', 50.0, 50.0, 0.5),
('TECH', 50.0, 50.0, 0.5)
ON CONFLICT (symbol) DO NOTHING;
```

---

## Step 7: Verify Deployment

### 7.1 Check Service Health

**Backend**:
```
https://backend-production-XXXX.up.railway.app/health
```
Expected: `{"status":"healthy",...}`

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

### 7.2 Test API Endpoints

**List Stocks**:
```
https://backend-production-XXXX.up.railway.app/api/v1/stocks
```

**Get Stock**:
```
https://backend-production-XXXX.up.railway.app/api/v1/stocks/ELON
```

---

## Step 8: Enable Auto-Deploy (Optional)

1. Go to each service → **Settings** → **Deploys**
2. Enable **"Auto-deploy on push to main"**
3. Now every push to GitHub will auto-deploy!

---

## Troubleshooting

### Service Won't Start
1. Check **Logs** tab for errors
2. Verify environment variables are set
3. Check `DATABASE_URL` is available
4. Verify Dockerfile path is correct

### Database Connection Failed
1. Ensure PostgreSQL service is running
2. Check `DATABASE_URL` in service variables
3. Verify database is in same Railway project

### Frontend Shows "Loading..."
1. Check browser console for errors
2. Verify `VITE_BACKEND_URL` is correct
3. Check CORS settings in backend
4. Verify backend is running

### WebSocket Connection Failed
1. Verify `VITE_WS_URL` uses `wss://` (not `ws://`)
2. Check backend WebSocket endpoint is accessible
3. Verify no firewall blocking WebSocket

---

## Cost Estimate (Railway)

**Hobby Plan** (Free):
- $5 free credit/month
- Enough for development/testing
- Services sleep after inactivity

**Pro Plan** ($20/month):
- $20 credit included
- No sleeping
- Better for production

**Estimated Usage**:
- 4 services × $5/month = $20/month
- PostgreSQL: $5/month
- **Total**: ~$25/month

---

## Next Steps After Deployment

1. ✅ Test all endpoints
2. ✅ Create a test stock via admin API
3. ✅ Simulate a reality event
4. ✅ Place test orders
5. ✅ Monitor logs for errors
6. ✅ Set up monitoring/alerts
7. ✅ Run demo script

---

## Quick Reference

### Service URLs Pattern
```
Backend:    https://backend-production-XXXX.up.railway.app
Orderbook:  https://orderbook-production-XXXX.up.railway.app
Frontend:   https://frontend-production-XXXX.up.railway.app
PostgreSQL: Internal (automatic DATABASE_URL)
```

### Key Environment Variables
```
REALITY_API_SECRET  - Shared between backend & reality-engine
ADMIN_API_KEY       - For admin endpoints
JWT_SECRET          - For user authentication
DATABASE_URL        - Auto-provided by Railway
```

### Important Files
```
backend/Dockerfile          - Backend container config
orderbook/Dockerfile        - Orderbook container config
reality-engine/Dockerfile   - Reality engine container config
frontend/Dockerfile         - Frontend container config
railway.toml               - Railway service configuration
```

---

**Deployment Time**: ~30 minutes
**Difficulty**: Medium (mostly clicking in Railway UI)
**Support**: Railway Discord, documentation at docs.railway.app
