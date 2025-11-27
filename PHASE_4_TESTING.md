# Phase 4 Testing Guide

## Quick Test: Snapshot ID Determinism

```bash
cd src
node -e "
const crypto = require('crypto');
const url = 'https://example.com';
const ts = new Date('2025-11-25T10:00:00Z');
const canonical = url + '|' + ts.toISOString();
const id = crypto.createHash('sha256').update(canonical).digest('hex');
console.log('Snapshot ID:', id);
"
```

**Expected**: Same ID every time (deterministic)

---

## Test Playwright Runner Locally

**1. Install dependencies:**
```bash
cd src/playwright-runner
npm install
```

**2. Create `.env` file:**
```bash
copy .env.example .env
notepad .env
```

Add your Vercel Blob credentials from `src/frontend/.env.local`:
```bash
BLOB_READ_WRITE_TOKEN=<your_token>
BLOB_URL_BASE=<your_blob_url>
```

**3. Run the service:**
```bash
npm run dev
```

**4. Test /fetch endpoint (new terminal):**
```powershell
Invoke-RestMethod -Uri http://localhost:3001/fetch -Method Post -ContentType "application/json" -Body '{"url":"https://example.com","idempotency_key":"test-001"}'
```

**Expected response:**
```json
{
  "snapshot_id": "64-char-hex...",
  "metadata": {
    "title": "Example Domain",
    "url": "https://example.com",
    "final_url": "https://example.com",
    "status_code": 200,
    "fetched_at": "2025-11-25T..."
  }
}
```

---

## End-to-End Test

**Terminal 1: Playwright Runner**
```bash
cd src/playwright-runner
npm run dev
```

**Terminal 2: Job Worker**
```bash
cd src
npm run worker
```

**Terminal 3: Submit Ingest Job**
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/v1/ingest -Method Post -ContentType "application/json" -Body '{"url":"https://example.com"}'
```

**Check worker logs** - Should see:
```
Processing job <id> (ingest_fetch), attempt 1
Calling Playwright runner for: https://example.com
Job <id> completed successfully
```

**Verify result:**
```powershell
Invoke-RestMethod http://localhost:3000/api/v1/jobs/<job_id>
```

Should show `status: "completed"` with snapshot_id in result.

---

## Deployment: Render

**1. Push to GitHub:**
```bash
git add src/playwright-runner
git commit -m "Add Playwright runner service"
git push
```

**2. Create Render service:**
- Go to render.com
- New → Web Service
- Connect GitHub repo
- Root Directory: `src/playwright-runner`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

**3. Environment variables:**
```
BLOB_READ_WRITE_TOKEN=<your_token>
BLOB_URL_BASE=<your_url>
PLAYWRIGHT_CONCURRENCY=4
NODE_ENV=production
```

**4. Deploy and test:**
```powershell
$RUNNER_URL = "https://your-app.onrender.com"
Invoke-RestMethod -Uri "$RUNNER_URL/health"
```

---

## Troubleshooting

**Issue**: "Browser not initialized"  
**Fix**: Ensure `fetcher.initialize()` completed

**Issue**: "BLOB_READ_WRITE_TOKEN not configured"  
**Fix**: Check `.env` file has correct token

**Issue**: "Rate limit: waiting 1000ms"  
**Fix**: Expected! This is the rate limiter working

**Issue**: Worker can't reach Playwright runner  
**Fix**: Add `PLAYWRIGHT_RUNNER_URL=http://localhost:3001` to `src/.env`

---

**All tests passing? Phase 4 complete! 🎉**
