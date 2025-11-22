# Railway One-Click Deployment Guide

## Automatic Service Detection

Railway will now automatically detect all 4 services when you deploy from GitHub!

### How It Works

The project is configured with:
- **Root `railway.toml`** - Defines all 4 services
- **Service-specific `railway.json`** files - Configure each service individually

### Deployment Steps

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Add Railway auto-detection config"
   git push origin main
   ```

2. **Deploy on Railway**:
   - Go to https://railway.app/new
   - Click **"Deploy from GitHub repo"**
   - Select `everything-market` repository
   - Railway will automatically detect all 4 services!

3. **Add PostgreSQL**:
   - Click **"+ New"** → **"Database"** → **"PostgreSQL"**
   - Railway will automatically add `DATABASE_URL` to all services

4. **Set Environment Variables**:
   
   Generate secrets first:
   ```bash
   python scripts/generate_secrets.py
   ```
   
   Then add to **Shared Variables** (applies to all services):
   - `REALITY_API_SECRET` = (from generate_secrets.py)
   - `ADMIN_API_KEY` = (from generate_secrets.py)
   - `JWT_SECRET` = (from generate_secrets.py)
   
   **Backend-specific**:
   - `ORDERBOOK_URL` = `${{orderbook.RAILWAY_PUBLIC_DOMAIN}}`
   
   **Reality Engine-specific**:
   - `BACKEND_URL` = `${{backend.RAILWAY_PUBLIC_DOMAIN}}`
   - `POLL_INTERVAL` = `300`
   - `LLM_MODE` = `heuristic`
   
   **Frontend-specific**:
   - `VITE_BACKEND_URL` = `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}`
   - `VITE_WS_URL` = `wss://${{backend.RAILWAY_PUBLIC_DOMAIN}}/ws/updates`

5. **Initialize Database**:
   
   **Option A: Railway CLI** (recommended):
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   railway run python scripts/init_db.py
   ```
   
   **Option B: SQL Query** (in Railway dashboard):
   - Go to PostgreSQL → Data → Query
   - Copy/paste contents of `scripts/init_database.sql`
   - Click "Run"

6. **Deploy**:
   - All services will deploy automatically
   - Railway will assign URLs to each service

7. **Verify**:
   - Backend: `https://backend-production-XXXX.up.railway.app/health`
   - Orderbook: `https://orderbook-production-XXXX.up.railway.app/`
   - Frontend: `https://frontend-production-XXXX.up.railway.app/`

---

## Service Configuration

### Detected Services

Railway will create these services automatically:

1. **backend**
   - Root directory: `backend/`
   - Dockerfile: `backend/Dockerfile`
   - Health check: `/health`
   - Port: Auto-assigned

2. **orderbook**
   - Root directory: `orderbook/`
   - Dockerfile: `orderbook/Dockerfile`
   - Health check: `/`
   - Port: Auto-assigned

3. **reality-engine**
   - Root directory: `reality-engine/`
   - Dockerfile: `reality-engine/Dockerfile`
   - No health check (background service)

4. **frontend**
   - Root directory: `frontend/`
   - Dockerfile: `frontend/Dockerfile`
   - Health check: `/`
   - Port: 80 (Nginx)

---

## Environment Variable Reference

### Shared Variables (All Services)
```
DATABASE_URL          - Auto-provided by Railway PostgreSQL
REALITY_API_SECRET    - Generate with scripts/generate_secrets.py
ADMIN_API_KEY         - Generate with scripts/generate_secrets.py
JWT_SECRET            - Generate with scripts/generate_secrets.py
```

### Backend
```
ORDERBOOK_URL         - ${{orderbook.RAILWAY_PUBLIC_DOMAIN}}
PORT                  - Auto-assigned by Railway
```

### Orderbook
```
PORT                  - Auto-assigned by Railway
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

## Railway Service References

Railway allows you to reference other services using `${{service-name.VARIABLE}}`:

- `${{backend.RAILWAY_PUBLIC_DOMAIN}}` - Backend's public URL
- `${{orderbook.RAILWAY_PUBLIC_DOMAIN}}` - Orderbook's public URL
- `${{postgres.DATABASE_URL}}` - PostgreSQL connection string

This automatically updates when services are deployed!

---

## Troubleshooting

### Services Not Detected
- Verify `railway.toml` is in root directory
- Verify each service has `railway.json` in its directory
- Check Dockerfile paths are correct

### Build Failures
- Check logs in Railway dashboard
- Verify Dockerfiles are valid
- Ensure all dependencies are in requirements.txt

### Environment Variables Not Set
- Use Railway's "Shared Variables" for common vars
- Use service-specific variables for unique configs
- Verify variable names match exactly

---

## Cost Optimization

**Free Tier**:
- $5 credit/month
- Services sleep after 30min inactivity
- Good for development

**Hobby Plan** ($5/month):
- $5 credit included
- No sleeping
- Better for staging

**Pro Plan** ($20/month):
- $20 credit included
- Priority support
- Production-ready

**Estimated Monthly Cost**:
- 4 services × $5 = $20
- PostgreSQL: $5
- **Total**: ~$25/month (Pro plan recommended)

---

## Next Steps After Deployment

1. ✅ Verify all services are running
2. ✅ Check health endpoints
3. ✅ Initialize database
4. ✅ Test API endpoints
5. ✅ Create test stock
6. ✅ Simulate reality event
7. ✅ Place test orders
8. ✅ Monitor logs

---

**Deployment Time**: ~10 minutes (fully automated!)
**Difficulty**: Easy (one-click deployment)
**Support**: Railway Discord, docs.railway.app
