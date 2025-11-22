# Railway Auto-Detection for Monorepo

## How It Works

Railway will automatically detect all 4 services when you:
1. Deploy from GitHub
2. Have `railway.json` files in each service directory

Each `railway.json` tells Railway:
- How to build (Dockerfile)
- How to start the service
- Health check endpoints

## Deployment Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "Add Railway auto-detection config"
git push origin main
```

### 2. Deploy on Railway

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Select your `xmarket` repository
4. Railway will automatically detect all 4 services! 🎉

Each service will be created with:
- **backend** - Detected from `backend/railway.json`
- **orderbook** - Detected from `orderbook/railway.json`
- **reality-engine** - Detected from `reality-engine/railway.json`
- **frontend** - Detected from `frontend/railway.json`

### 3. Add PostgreSQL

1. Click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway automatically adds `DATABASE_URL` to all services

### 4. Set Environment Variables

Generate secrets first:
```bash
python scripts/generate_secrets.py
```

Then add to **Shared Variables** (applies to all services):
- `REALITY_API_SECRET` = (from generate_secrets.py)
- `ADMIN_API_KEY` = (from generate_secrets.py)
- `JWT_SECRET` = (from generate_secrets.py)

**Service-specific variables:**

**Backend**:
- `ORDERBOOK_URL` = `https://${{orderbook.RAILWAY_PUBLIC_DOMAIN}}`

**Reality Engine**:
- `BACKEND_URL` = `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}`
- `POLL_INTERVAL` = `300`
- `LLM_MODE` = `heuristic`

**Frontend**:
- `VITE_BACKEND_URL` = `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}`
- `VITE_WS_URL` = `wss://${{backend.RAILWAY_PUBLIC_DOMAIN}}/ws/updates`

### 5. Initialize Database

**Option A: Railway CLI**:
```bash
npm install -g @railway/cli
railway login
railway link
railway run python scripts/init_db.py
```

**Option B: SQL Query**:
1. Go to PostgreSQL → Data → Query
2. Copy/paste `scripts/init_database.sql`
3. Click "Run"

### 6. Verify Deployment

**Backend**: `https://backend-production-XXXX.up.railway.app/health`
**Orderbook**: `https://orderbook-production-XXXX.up.railway.app/`
**Frontend**: `https://frontend-production-XXXX.up.railway.app/`

---

## How Auto-Detection Works

Railway scans your repository for:
1. **`railway.json` files** in subdirectories
2. Each file defines a separate service
3. Railway creates services automatically

### File Structure
```
xmarket/
├── backend/
│   ├── railway.json  ← Detected as "backend" service
│   └── Dockerfile
├── orderbook/
│   ├── railway.json  ← Detected as "orderbook" service
│   └── Dockerfile
├── reality-engine/
│   ├── railway.json  ← Detected as "reality-engine" service
│   └── Dockerfile
└── frontend/
    ├── railway.json  ← Detected as "frontend" service
    └── Dockerfile
```

---

## Troubleshooting

### Services Not Auto-Detected

**Check**:
1. Each service has `railway.json` in its directory
2. JSON files are valid (no syntax errors)
3. Dockerfile exists in same directory

**Fix**: Verify all `railway.json` files are committed to GitHub

### Build Failures

**Check logs** for each service:
- Backend logs
- Orderbook logs
- Reality Engine logs
- Frontend logs

Common issues:
- Missing dependencies in `requirements.txt`
- Dockerfile errors
- Missing environment variables

### Environment Variables Not Working

**Railway Service References**:
- Use `${{service-name.RAILWAY_PUBLIC_DOMAIN}}` to reference other services
- Example: `${{backend.RAILWAY_PUBLIC_DOMAIN}}`
- Railway automatically resolves these at runtime

---

## Environment Variables Reference

### Shared (All Services)
```
DATABASE_URL          - Auto-provided by Railway PostgreSQL
REALITY_API_SECRET    - Generate with scripts/generate_secrets.py
ADMIN_API_KEY         - Generate with scripts/generate_secrets.py
JWT_SECRET            - Generate with scripts/generate_secrets.py
```

### Backend
```
ORDERBOOK_URL         - ${{orderbook.RAILWAY_PUBLIC_DOMAIN}}
```

### Reality Engine
```
BACKEND_URL           - ${{backend.RAILWAY_PUBLIC_DOMAIN}}
POLL_INTERVAL         - 300
LLM_MODE              - heuristic
```

### Frontend
```
VITE_BACKEND_URL      - https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
VITE_WS_URL           - wss://${{backend.RAILWAY_PUBLIC_DOMAIN}}/ws/updates
```

---

## Cost Estimate

**Monthly Cost**:
- 4 services × $5/month = $20
- PostgreSQL: $5/month
- **Total**: ~$25/month

**Free Tier**: $5 credit/month (services sleep after inactivity)

---

## Next Steps

1. ✅ Push to GitHub
2. ✅ Deploy on Railway (auto-detects all services)
3. ✅ Add PostgreSQL
4. ✅ Set environment variables
5. ✅ Initialize database
6. ✅ Verify deployment
7. ✅ Test endpoints

**Deployment Time**: ~10 minutes (fully automated!)
