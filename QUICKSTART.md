# Everything Market - Quick Start Guide

## 🚀 Getting Started (3 Options)

### Option 1: Automated Setup (Recommended)

```bash
# Run the quickstart script
python scripts/quickstart.py
```

This will:
- ✅ Install all Python dependencies
- ✅ Download spaCy NLP model
- ✅ Initialize database with sample stocks
- ✅ Install frontend dependencies

### Option 2: Manual Setup

```bash
# 1. Install backend dependencies
cd backend
pip install -r requirements.txt

# 2. Install orderbook dependencies
cd ../orderbook
pip install -r requirements.txt

# 3. Install reality-engine dependencies
cd ../reality-engine
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# 4. Initialize database
cd ..
python scripts/init_db.py

# 5. Install frontend dependencies
cd frontend
npm install
```

### Option 3: Docker Compose (Coming Soon)

```bash
docker-compose up
```

---

## 🏃 Running the Services

You need **4 separate terminal windows**:

### Terminal 1: Backend
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
✅ Backend running at http://localhost:8000

### Terminal 2: Orderbook
```bash
cd orderbook
uvicorn app.main:app --reload --port 8001
```
✅ Orderbook running at http://localhost:8001

### Terminal 3: Reality Engine
```bash
cd reality-engine
python -m app.main
```
✅ Reality Engine scraping news every 5 minutes

### Terminal 4: Frontend
```bash
cd frontend
npm run dev
```
✅ Frontend running at http://localhost:3000

---

## 🧪 Testing the Platform

### 1. Open the Dashboard
Navigate to http://localhost:3000 and you should see:
- Stock selector (ELON, AI_INDEX, TECH)
- Price cards showing Reality Score, Final Price, Confidence
- Empty chart (will populate as events arrive)

### 2. Test Backend API
```bash
python scripts/test_backend.py
```

Expected output:
```
✅ PASS - Health Check
✅ PASS - List Stocks
✅ PASS - Get Stock
✅ PASS - Create Stock (Admin)
✅ PASS - Reality Event
```

### 3. Test Orderbook API
```bash
python scripts/test_orderbook.py
```

Expected output:
```
✅ PASS - Health Check
✅ PASS - Place Buy Order
✅ PASS - Place Sell Order
✅ PASS - Market Snapshot
✅ PASS - Market Pressure
```

### 4. Manually Create a Stock (Admin)

```bash
curl -X POST http://localhost:8000/api/v1/admin/stocks \
  -H "X-Admin-Key: dev-admin-key-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "CRYPTO",
    "name": "Crypto Market Index",
    "description": "Tracks cryptocurrency market sentiment",
    "market_weight": 0.6,
    "reality_weight": 0.4,
    "initial_score": 50.0
  }'
```

### 5. Simulate a Reality Event

```python
import requests
import json
import hmac
import hashlib

event = {
    "event_id": "demo-event-001",
    "timestamp": "2025-11-22T10:00:00Z",
    "stocks": ["ELON"],
    "quick_score": 0.75,
    "impact_points": 15.0,
    "summary": "Tesla announces major AI breakthrough in autonomous driving",
    "sources": [
        {"id": "reuters", "url": "https://reuters.com/tech/tesla-ai", "trust": 0.95}
    ],
    "num_independent_sources": 1,
    "llm_mode": "heuristic"
}

# Sign the payload
payload = json.dumps(event, sort_keys=True).encode()
signature = hmac.new(
    b"dev-reality-secret-change-in-production",
    payload,
    hashlib.sha256
).hexdigest()

# Send to backend
response = requests.post(
    "http://localhost:8000/api/v1/reality/ingest",
    json=event,
    headers={"X-Signature": signature}
)

print(response.json())
```

You should see the Final Price update in real-time on the dashboard!

### 6. Place an Order

```bash
curl -X POST http://localhost:8001/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "trader-123",
    "symbol": "ELON",
    "side": "BUY",
    "order_type": "LIMIT",
    "quantity": 10,
    "price": 55.0
  }'
```

---

## 📊 Understanding the Dashboard

### Price Cards

1. **Reality Score** (Green)
   - Computed from news sentiment and AI analysis
   - Updates when reality events are ingested
   - Range: 0-100

2. **Final Price** (Purple, highlighted)
   - Blended price: `60% Market + 40% Reality`
   - This is the "official" price shown to users
   - Smoothed with EWMA (α=0.25)

3. **Confidence** (Gray)
   - System confidence in current price
   - Based on data quality and source diversity
   - Range: 0-100%

### Real-Time Updates

The dashboard uses WebSocket to receive:
- `reality_update` - New reality score from news
- `market_update` - Market pressure from trading
- `final_update` - New blended final price
- `audit_event` - Events flagged for admin review

---

## 🔧 Configuration

### Environment Variables

Copy `.env.development` to `.env` and customize:

```bash
# Database
DATABASE_URL=sqlite:///./everything_market.db

# Security (CHANGE IN PRODUCTION!)
REALITY_API_SECRET=your-secret-here
ADMIN_API_KEY=your-admin-key-here
JWT_SECRET=your-jwt-secret-here

# Reality Engine
POLL_INTERVAL=300          # Scrape every 5 minutes
LLM_MODE=heuristic         # or 'local' for TinyLlama
LLM_CALLS_PER_HOUR=10      # Rate limit

# Development
DEBUG=true
LOG_LEVEL=INFO
```

### News Sources

Edit `reality-engine/sources.yaml` to add/remove news sources:

```yaml
sources:
  - id: your-source
    url: https://example.com/tech
    rss: https://example.com/tech/rss
    trust: 0.85
    crawl_delay: 2.0
```

---

## 🐛 Troubleshooting

### Backend won't start
```
Error: Required environment variable REALITY_API_SECRET is not set
```
**Solution**: Copy `.env.development` to `.env`

### Reality Engine crashes
```
OSError: [E050] Can't find model 'en_core_web_sm'
```
**Solution**: `python -m spacy download en_core_web_sm`

### Frontend shows "Loading..."
```
WebSocket connection failed
```
**Solution**: Make sure backend is running on port 8000

### Database errors
```
sqlalchemy.exc.OperationalError: no such table: stocks
```
**Solution**: Run `python scripts/init_db.py`

### Port already in use
```
Error: [Errno 48] Address already in use
```
**Solution**: Kill existing process or use different port:
```bash
uvicorn app.main:app --reload --port 8002
```

---

## 📈 What Happens Next?

### Reality Engine Cycle (Every 5 minutes)

1. **Scrape** - Fetches RSS feeds from configured sources
2. **Extract** - Downloads full articles using newspaper3k
3. **Embed** - Converts text to 384-dim vectors
4. **Deduplicate** - Checks FAISS index for similar articles (>0.88 similarity)
5. **Group** - Clusters related articles (>0.78 similarity)
6. **Score** - Computes quick_score using sentiment + keywords + NER
7. **LLM** (Optional) - Runs TinyLlama if thresholds met
8. **Build Event** - Computes event_weight and impact_points
9. **Publish** - Signs with HMAC and POSTs to backend

### Backend Processing

1. **Validate** - Checks HMAC signature
2. **Anti-Manipulation** - Flags suspicious events (delta > 15)
3. **Query Orderbook** - Fetches current market pressure
4. **Blend** - Computes final price (60% market + 40% reality)
5. **Persist** - Saves to database in transaction
6. **Broadcast** - Sends WebSocket updates to all clients

### Frontend Updates

1. **Receive** - WebSocket message arrives
2. **Update State** - React state updated
3. **Animate** - Price transitions smoothly (EWMA)
4. **Chart** - New data point added to time series

---

## 🎯 Next Steps

1. ✅ **Verify Setup** - Run test scripts
2. ✅ **Explore Dashboard** - Open http://localhost:3000
3. ✅ **Simulate Events** - Use test scripts to create events
4. ✅ **Place Orders** - Test the orderbook
5. 🔜 **Deploy to Railway** - See deployment guide
6. 🔜 **Add Admin UI** - Build stock creation form
7. 🔜 **Integrate TinyLlama** - Replace heuristic mode

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:8000/docs (FastAPI auto-docs)
- **Orderbook API**: http://localhost:8001/docs
- **Implementation Plan**: See `implementation_plan.md`
- **Architecture Details**: See `details.txt` and `breakdown.txt`

---

## 🆘 Need Help?

Check the logs:
- Backend: Terminal 1 output
- Orderbook: Terminal 2 output
- Reality Engine: Terminal 3 output
- Frontend: Terminal 4 output + Browser console

All services log to stdout with timestamps and log levels.

---

**Happy Trading! 📊🚀**
