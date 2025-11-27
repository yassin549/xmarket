# Render Deployment Guide

## Prerequisites

Before deploying to Render, ensure you have:

1. **GitHub repository** - Push your code to GitHub
2. **Render account** - Sign up at https://render.com
3. **Environment variables** - Prepare values from `.env.example`:
   - `NEON_DATABASE_URL`
   - `PINECONE_API_KEY`
   - `ABLY_API_KEY`
   - `VERCEL_BLOB_READ_WRITE_TOKEN`
   - `HUGGINGFACE_API_KEY`
   - `HMAC_SECRET_DEFAULT`
   - `HMAC_SECRET_V1`

---

## Deployment Steps

### Option 1: Deploy via Blueprint (Recommended)

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Configure Render deployment"
   git push origin main
   ```

2. **Create New Blueprint in Render:**
   - Go to https://dashboard.render.com/blueprints
   - Click "New Blueprint Instance"
   - Connect your GitHub repository
   - Select repository: `yassin549/xmarket`
   - Render will auto-detect `render.yaml`

3. **Configure Environment Variables:**
   
   During blueprint setup, you'll be prompted to configure the `xmarket-env` group:
   
   - `PINECONE_API_KEY`: Your Pinecone API key
   - `ABLY_API_KEY`: Your Ably realtime API key
   - `VERCEL_BLOB_READ_WRITE_TOKEN`: Blob storage token
   - `PLAYWRIGHT_RUNNER_URL`: (Optional) Set if using separate playwright service

4. **Review and Deploy:**
   - Review the service configuration
   - Click "Apply"
   - Render will create:
     - PostgreSQL database (`xmarket-db`)
     - Frontend web service (`xmarket-frontend`)
     - Orderbook service with 10GB persistent disk (`xmarket-orderbook`)
     - Reality Engine worker (`xmarket-reality-engine`)

5. **Wait for Deployment:**
   - Database provisioning: ~2-3 minutes
   - Services build and deploy: ~5-10 minutes
   - Watch logs in Render dashboard

---

### Option 2: Manual Service Creation

If blueprint deployment fails, create services manually:

#### 1. Create PostgreSQL Database

- Service Type: **PostgreSQL**
- Name: `xmarket-db`
- Plan: **Starter** ($7/month)
- Region: **Oregon**

Save the **Internal Database URL** - you'll need it for services.

#### 2. Create Orderbook Service

- Service Type: **Web Service**
- Runtime: **Docker**
- Name: `xmarket-orderbook`
- Region: **Oregon**
- Root Directory: `src/orderbook`
- Dockerfile Path: `./src/orderbook/Dockerfile`

**Environment Variables:**
```
NODE_ENV=production
ORDERBOOK_PORT=3001
ORDERBOOK_WAL_PATH=/data/wal/orderbook.wal
FSYNC_EVERY_N=1
SNAPSHOT_INTERVAL_MS=10000
NEON_DATABASE_URL=<from xmarket-db>
```

**Disk:**
- Name: `orderbook-wal`
- Mount Path: `/data`
- Size: **10 GB**

#### 3. Create Frontend Service

- Service Type: **Web Service**
- Runtime: **Node**
- Name: `xmarket-frontend`
- Region: **Oregon**
- Build Command: `cd src/frontend && npm install && npm run build`
- Start Command: `cd src/frontend && npm start`

**Environment Variables:**
```
NODE_ENV=production
PORT=3000
NEON_DATABASE_URL=<from xmarket-db>
ORDERBOOK_URL=http://xmarket-orderbook:3001
PINECONE_API_KEY=<your-key>
ABLY_API_KEY=<your-key>
VERCEL_BLOB_READ_WRITE_TOKEN=<your-token>
```

#### 4. Create Reality Engine Worker

- Service Type: **Background Worker**
- Runtime: **Node**
- Name: `xmarket-reality-engine`
- Region: **Oregon**
- Build Command: `cd src && npm install && npm run build`
- Start Command: `cd src && node dist/infra/jobs/index.js`

**Environment Variables:**
```
NODE_ENV=production
NEON_DATABASE_URL=<from xmarket-db>
PINECONE_API_KEY=<your-key>
HUGGINGFACE_API_KEY=<your-key>
```

---

## Post-Deployment Verification

### 1. Check Service Health

```bash
# Frontend health check
curl https://xmarket-frontend.onrender.com/api/health

# Orderbook health check
curl https://xmarket-orderbook.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": 1732699200000
}
```

### 2. Test Orderbook

```bash
# Place a test order
curl -X POST https://xmarket-orderbook.onrender.com/order \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "symbol": "TEST_MARKET",
    "side": "buy",
    "type": "limit",
    "price": 0.5,
    "quantity": 10
  }'
```

### 3. Verify WAL Persistence

1. Place several orders
2. Restart the orderbook service in Render dashboard
3. Check that orders are recovered from WAL:
   ```bash
   curl https://xmarket-orderbook.onrender.com/snapshot?symbol=TEST_MARKET
   ```

### 4. Test Frontend

- Visit: `https://xmarket-frontend.onrender.com`
- Navigate to a market page
- Verify orderbook loads
- Place a test trade

---

## Troubleshooting

### Service Won't Start

**Check logs in Render dashboard:**
- Click service → Logs tab
- Look for build or runtime errors

**Common issues:**
- Missing environment variables → Add in service settings
- Build failure → Check `package.json` scripts
- Port binding → Ensure service listens on `PORT` env var

### Orderbook WAL Errors

**Symptom:** `ENOENT: no such file or directory, open '/data/wal/orderbook.wal'`

**Fix:** Verify disk is mounted:
1. Go to orderbook service settings
2. **Disks** section
3. Ensure `/data` is mounted
4. Redeploy service

### Database Connection Errors

**Symptom:** `Connection refused` or `timeout`

**Fix:**
1. Verify `NEON_DATABASE_URL` is set correctly
2. Check database is running (green status in dashboard)
3. Use **Internal Database URL** not external

### Frontend Can't Reach Orderbook

**Symptom:** Orders fail with network error

**Fix:**
1. Verify `ORDERBOOK_URL=http://xmarket-orderbook:3001`
2. Ensure both services are in same Render account
3. Check orderbook service is running

---

## Monitoring

### Service Metrics

Render provides built-in metrics:
- **CPU usage**
- **Memory usage**
- **Request rate**
- **Response time**

Access via service → **Metrics** tab

### Disk Usage

Monitor orderbook disk:
- Service → **Disks** tab
- Watch WAL growth over time
- Upgrade disk if >80% full

### Logs

Real-time logs available:
- Service → **Logs** tab
- Filter by severity
- Search for errors

---

## Scaling

### Horizontal Scaling (Frontend)

```
Service Settings → Instance Count → Increase to 2+
```

**Note:** Orderbook must remain **single instance** (stateful).

### Vertical Scaling

Upgrade service plan for more resources:
- **Starter**: 512MB RAM, 0.5 CPU
- **Standard**: 2GB RAM, 1 CPU
- **Pro**: 4GB RAM, 2 CPU

### Disk Expansion

If orderbook disk fills:
1. Service → Disks
2. Click disk → **Upgrade Size**
3. Available up to 100GB

---

## Cost Estimate

**Minimum monthly cost:**

| Service | Plan | Cost |
|---------|------|------|
| PostgreSQL | Starter | $7 |
| Frontend | Starter | $7 |
| Orderbook | Starter + 10GB disk | $7 + $1 = $8 |
| Reality Engine | Starter | $7 |
| **Total** | | **$29/month** |

**Notes:**
- Free tier available (750 hours/month) - can run 1 service free
- Bandwidth: First 100GB free
- Additional scaling increases costs proportionally

---

## Going to Production

Before production deployment:

1. **Remove test data** from database
2. **Set** `SANDBOX_MODE=false`
3. **Enable** WAL snapshots to object storage (TODO in code)
4. **Configure** custom domain in Render
5. **Enable** auto-deploy from `main` branch
6. **Set up** monitoring alerts
7. **Backup** database (Render auto-backups on paid plans)

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Status Page**: https://status.render.com
