# Railway Deployment Guide for Xmarket
## Complete Setup Instructions

### Prerequisites
- Railway account (railway.app)
- GitHub repo pushed
- Generated API secrets (see below)

---

## 🔐 API Secrets (Already Generated)

```
REALITY_API_SECRET=12c894cb811503af1845b0d7560fc334afe5326a39f63456a87158fa68f68ded
ADMIN_API_KEY=ec3f3e64567921df0414ab763b9a9bf0a0ab4d0a72a7dd4fb50d06b71c34a822
```

---

## 📦 Service Configuration

### Service 1: PostgreSQL Database
1. In Railway dashboard → New → Database → PostgreSQL
2. Copy the `DATABASE_URL` (will be auto-available to other services)

### Service 2: Backend
**Settings:**
- **Source**: GitHub repo
- **Root Directory**: `/` (leave empty or set to root)
- **Build Command**: Auto-detected (uses nixpacks.toml)
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

**Environment Variables:**
```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
REALITY_API_SECRET = 12c894cb811503af1845b0d7560fc334afe5326a39f63456a87158fa68f68ded
ADMIN_API_KEY = ec3f3e64567921df0414ab763b9a9bf0a0ab4d0a72a7dd4fb50d06b71c34a822
REDIS_URL = redis://red-xxx.railway.app:6379  (add Redis service first)
PORT = ${{PORT}}
```

### Service 3: Orderbook
**Settings:**
- **Source**: Same GitHub repo
- **Root Directory**: `orderbook`
- **Build Command**: Auto-detected (uses orderbook/nixpacks.toml)
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Environment Variables:**
```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
PORT = ${{PORT}}
```

**⚠️ IMPORTANT FIX for Orderbook:**
The start command should reference the parent module. Update to:
```
cd .. && uvicorn orderbook.main:app --host 0.0.0.0 --port $PORT
```

OR update the nixpacks.toml to handle this correctly.

### Service 4: Reality Engine
**Settings:**
- **Source**: Same GitHub repo
- **Root Directory**: `reality_engine`
- **Build Command**: Auto-detected (uses reality_engine/nixpacks.toml)
- **Start Command**: `cd .. && python -m reality_engine.run --backend-url $BACKEND_URL`

**Environment Variables:**
```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
REALITY_API_SECRET = 12c894cb811503af1845b0d7560fc334afe5326a39f63456a87158fa68f68ded
BACKEND_URL = ${{Backend.RAILWAY_STATIC_URL}}
REDIS_URL = redis://red-xxx.railway.app:6379
POLL_INTERVAL = 300
LLM_MODE = tinyLLama
LLM_CALLS_PER_HOUR = 10
```

### Service 5: Frontend
**Settings:**
- **Source**: Same GitHub repo
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run preview -- --host 0.0.0.0 --port $PORT`

**Environment Variables:**
```
VITE_BACKEND_URL = https://${{Backend.RAILWAY_STATIC_URL}}
VITE_ORDERBOOK_URL = https://${{Orderbook.RAILWAY_STATIC_URL}}
PORT = ${{PORT}}
```

---

## 🔄 Deployment Steps

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Add Railway deployment config"
git push origin main
```

### 2. Create Railway Project
1. Go to railway.app → New Project
2. Deploy from GitHub repo
3. Select your Xmarket repository

### 3. Add Services (in this order)
1. **PostgreSQL** → Add from template
2. **Redis** (optional but recommended) → Add from template
3. **Backend** → Deploy from repo (root directory: `/`)
4. **Orderbook** → Deploy from repo (root directory: `orderbook`)
5. **Frontend** → Deploy from repo (root directory: `frontend`)
6. **Reality Engine** → Deploy from repo (root directory: `reality_engine`)

### 4. Run Database Migrations
After Backend is deployed:
```bash
# In Railway Backend service → Settings → Deploy logs
# Or run locally with Railway's DATABASE_URL:
railway run alembic upgrade head
```

### 5. Create Initial Stocks
Using the deployed admin API:
```bash
curl -X POST https://your-backend.railway.app/api/v1/admin/stocks \
  -H "X-Admin-Key: ec3f3e64567921df0414ab763b9a9bf0a0ab4d0a72a7dd4fb50d06b71c34a822" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TECH",
    "name": "Technology Sector",
    "market_weight": 0.6,
    "reality_weight": 0.4,
    "min_price": 0,
    "max_price": 100
  }'
```

---

## 🐛 Troubleshooting

### Backend/Orderbook: "ModuleNotFoundError: No module named 'fastapi'"
**Fix**: Check that `requirements.txt` is in the root directory and contains:
```
fastapi
uvicorn[standard]
sqlalchemy
psycopg2-binary
```

### Reality Engine: "Railpack could not determine how to build"
**Fix**: Ensure `reality_engine/nixpacks.toml` exists with:
```toml
[start]
cmd = "cd .. && python -m reality_engine.run --backend-url $BACKEND_URL"
```

### Database Connection Errors
**Fix**: Ensure `DATABASE_URL` environment variable is set and migrations have run:
```bash
railway run alembic upgrade head
```

### CORS Errors on Frontend
**Fix**: Ensure backend's CORS settings allow frontend domain. Check `backend/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.railway.app"],
    ...
)
```

---

## ✅ Verification Checklist

- [ ] PostgreSQL service running
- [ ] Backend service deployed (check /health endpoint)
- [ ] Orderbook service deployed (check /health endpoint)
- [ ] Database  migrations run successfully
- [ ] At least one stock created via admin API
- [ ] Frontend loads and shows stock cards
- [ ] Reality engine running (check logs for polling activity)

---

## 📊 Service URLs

After deployment, you'll have:
- **Backend**: `https://xmarket-backend-xxx.railway.app`
- **Orderbook**: `https://xmarket-orderbook-xxx.railway.app`
- **Frontend**: `https://xmarket-frontend-xxx.railway.app` ← **This is your public URL!**

---

## 🚀 Post-Deployment

1. Open the frontend URL
2. You should see beautiful stock cards with real-time prices
3. Events from reality engine will update scores every 5 minutes
4. Place orders via the orderbook API to affect market prices

**Your prediction market is LIVE!** 🎉
