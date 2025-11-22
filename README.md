# Everything Market

A reality-driven prediction market platform that blends AI-analyzed news events with traditional market trading.

## Architecture

This platform consists of 4 microservices deployed on Railway:

1. **Reality Engine** - Scrapes news, analyzes impact using TinyLlama LLM, computes reality scores
2. **Orderbook** - Handles order matching, trade execution, market pressure calculation
3. **Backend** - Orchestrates reality + market blending, manages persistence, broadcasts updates
4. **Frontend** - React dashboard for trading, viewing events, and admin controls

## Key Features

- **Dual-Price System**: Final Price = 60% Market + 40% Reality Score
- **AI-Powered Analysis**: TinyLlama-1.1B for event summarization and impact scoring
- **Anti-Manipulation**: Human-in-loop approval for suspicious events (delta > 15 points)
- **Real-time Updates**: WebSocket broadcasts for live price and event updates
- **Deterministic Scoring**: Reproducible quick-scorer with fixed constants

## Environment Variables

### Reality Engine
- `DATABASE_URL` - Postgres connection string
- `REALITY_API_SECRET` - HMAC signing secret (shared with backend)
- `POLL_INTERVAL` - Scraping interval in seconds (default: 300)
- `LLM_MODE` - `local` (TinyLlama binary) or `heuristic` (fallback)
- `LLM_CALLS_PER_HOUR` - Rate limit for LLM calls (default: 10)

### Orderbook
- `DATABASE_URL` - Postgres connection string
- `PORT` - Service port (Railway auto-assigns)

### Backend
- `DATABASE_URL` - Postgres connection string
- `REALITY_API_SECRET` - HMAC verification secret
- `ADMIN_API_KEY` - Admin endpoint protection key
- `PORT` - Service port (Railway auto-assigns)

### Frontend
- `VITE_BACKEND_URL` - Backend API URL
- `VITE_WS_URL` - WebSocket URL

## Constants (Canonical)

See `config/constants.py`:
- `DELTA_CAP = 20` - Max impact points per event
- `SIMILARITY_DUPLICATE = 0.88` - Duplicate detection threshold
- `SIMILARITY_GROUP = 0.78` - Event grouping threshold
- `LLM_QUICK_THRESHOLD = 0.45` - Minimum quick_score for LLM analysis
- `SUSPICIOUS_DELTA = 15` - Threshold for admin review
- `MIN_INDEP_SOURCES = 2` - Minimum independent sources for LLM
- `VECTOR_WINDOW_SECONDS = 21600` - FAISS index TTL (6 hours)
- `TAU_SECONDS = 172800` - Event decay time constant (48 hours)
- `EWMA_ALPHA = 0.25` - Exponential moving average smoothing

## Local Development

```bash
# Install dependencies for each service
cd backend && pip install -r requirements.txt
cd ../orderbook && pip install -r requirements.txt
cd ../reality-engine && pip install -r requirements.txt
cd ../frontend && npm install

# Run services (separate terminals)
cd backend && uvicorn app.main:app --reload --port 8000
cd orderbook && uvicorn app.main:app --reload --port 8001
cd reality-engine && python -m app.main
cd frontend && npm run dev
```

## Testing

```bash
# Run all tests
pytest

# Run specific service tests
pytest backend/tests/
pytest orderbook/tests/
pytest reality-engine/tests/

# Integration tests
pytest tests/integration/
```

## Deployment (Railway)

1. Create Railway project: `everything-market`
2. Add Postgres plugin
3. Create 4 services linked to this repo:
   - `reality-engine` (root: `reality-engine/`)
   - `orderbook` (root: `orderbook/`)
   - `backend` (root: `backend/`)
   - `frontend` (root: `frontend/`)
4. Set environment variables in Railway dashboard
5. Deploy via Git push to `main` branch

## License

MIT
