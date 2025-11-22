# Everything Market

A sophisticated prediction market platform combining reality-based scoring with market dynamics.

## Project Status

✅ **Prompt #2 COMPLETE** - Core configuration module  
✅ **Prompt #3 COMPLETE** - PostgreSQL schema with Alembic migrations  
✅ **Prompt #4 COMPLETE** - Backend API with reality ingest endpoint  
✅ **Prompt #5 COMPLETE** - Reality-engine poller with RSS fetching  
✅ **Prompt #6 COMPLETE** - Embedding & FAISS deduplication  
✅ **Prompt #7 COMPLETE** - Deterministic quick scorer (VADER + keywords + NER)  
🚧 **Prompt #8 PARTIAL** - LLM integration (schema + rate limiter done, model integration pending)

## Quick Start

### 1. Setup Environment

```bash
# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your actual values
```

### 2. Setup Database

```bash
# Start PostgreSQL (example with Docker)
docker run --name xmarket-db -e POSTGRES_PASSWORD=yourpass -p 5432:5432 -d postgres:16

# Set DATABASE_URL in .env or environment
$env:DATABASE_URL="postgresql://postgres:yourpass@localhost:5432/xmarket"

# Run migrations
alembic upgrade head

# Or use bootstrap script
.\scripts\db_bootstrap.ps1
```

### 3. Run Backend Server

```bash
# Start backend API server
uvicorn backend.main:app --reload

# Server runs at http://localhost:8000
# API docs at http://localhost:8000/docs
# Health check: http://localhost:8000/health
```

### 4. Run Reality-Engine Poller

```bash
# Set secret
export REALITY_API_SECRET="your-secret-key"  # Or add to .env

# Dry run (test mode)
python reality_engine/run.py --dry-run

# Connect to backend
python reality_engine/run.py --backend-url http://localhost:8000

# Verbose logging
python reality_engine/run.py --verbose
```

### 5. Run Tests

```bash
# Run config tests
pytest tests/test_config.py -v

# Run database schema tests (requires DATABASE_URL)
pytest tests/test_db_schema.py -v

# Run reality-engine tests
pytest tests/test_reality_engine.py -v

# Run all tests with coverage
pytest -v --cov=config --cov=backend --cov=reality_engine --cov-report=term-missing
```

### 4. Use Configuration

```python
# Import constants
from config import constants
print(constants.SIMILARITY_DUPLICATE)  # 0.88

# Load environment
from config import Config
config = Config()
config.validate()
print(config.database_url)

# Use database
from database import get_db_session
with get_db_session() as session:
    result = session.execute(text("SELECT * FROM stocks"))

# Use backend API (example client)
import requests
import json
import hmac
import hashlib

# Sign and send event
payload = {
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-11-22T16:00:00Z",
    "stocks": ["TECH"],
    "quick_score": 0.5,
    "impact_points": 10.0,
    "summary": "Test event",
    "sources": [{"id": "src1", "url": "https://example.com", "trust": 0.9}],
    "num_independent_sources": 1,
    "llm_mode": "tinyLLama",
    "meta": {}
}

# Generate HMAC signature
secret = "your-reality-api-secret"
canonical = json.dumps(payload, separators=(",", ":"), sort_keys=True)
signature = hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()

# POST to ingest endpoint
response = requests.post(
    "http://localhost:8000/api/v1/reality/ingest",
    json=payload,
    headers={"X-Reality-Signature": signature}
)
```

## Project Structure

```
Xmarket/
├── backend/            # FastAPI backend ✅
│   ├── __init__.py
│   ├── main.py         # FastAPI app
│   ├── models.py       # Pydantic models
│   ├── auth.py         # HMAC authentication
│   └── ingest.py       # Ingest endpoint
├── reality_engine/     # News poller ✅
│   ├── __init__.py
│   ├── config.py       # Load sources.yaml
│   ├── fetcher.py      # RSS + HTML fetching
│   ├── normalizer.py   # Content filtering
│   ├── robots.py       # Robots.txt compliance
│   ├── event_builder.py # Event construction
│   ├── poster.py       # HMAC signing + POST
│   ├── poller.py       # Main loop
│   ├── run.py          # Entry point
│   ├── sources.yaml    # Feed config
│   └── README.md
├── config/              # Configuration module ✅
│   ├── constants.py     # System constants
│   ├── env.py          # Environment loading
│   └── README.md       # Documentation
├── migrations/         # Alembic migrations ✅
│   ├── versions/
│   │   └── 001_create_core_tables.py
│   └── env.py         # Migration environment
├── scripts/           # Utility scripts ✅
│   ├── db_bootstrap.ps1
│   └── db_bootstrap.sh
├── tests/              # Test suite ✅
│   ├── test_config.py  # Config tests (27 passing)
│   ├── test_db_schema.py # Schema tests (~50 tests)
│   └── test_ingest_api.py # API tests (~15 tests)
├── database.py        # Database helper ✅
├── alembic.ini        # Alembic config
├── plan.txt           # Master architecture plan
├── prompts.txt        # Implementation prompts
├── requirements.txt   # Python dependencies
└── CHANGELOG.md       # Version history
```

## Database Schema

8 core tables:
- `stocks` - Trading symbols (admin-managed)
- `scores` - Reality scores and final prices
- `events` - News events with impact scoring
- `llm_calls` - LLM inference audit trail
- `llm_audit` - Manual review queue
- `score_changes` - Score modification history
- `orders` - Orderbook
- `trade_history` - Trade execution log

See [CHANGELOG.md](file:///c:/Users/khoua/OneDrive/Desktop/Xmarket/CHANGELOG.md) for detailed schema documentation.

## Documentation

- **Master Plan**: [plan.txt](file:///c:/Users/khoua/OneDrive/Desktop/Xmarket/plan.txt) - Complete architecture specification
- **Prompts**: [prompts.txt](file:///c:/Users/khoua/OneDrive/Desktop/Xmarket/prompts.txt) - 30 implementation prompts
- **Config Module**: [config/README.md](file:///c:/Users/khoua/OneDrive/Desktop/Xmarket/config/README.md) - Configuration documentation

## Next Steps

Ready to implement:
- **Prompt #5** - Reality-engine poller skeleton
- **Prompt #6** - Embedding & FAISS indexing module
- **Prompt #7** - Quick scorer (deterministic)

## Requirements

- Python 3.10+ (using 3.12)
- PostgreSQL (for future prompts)
- Redis (for future prompts)

## Testing

All tests passing: **27/27 ✅**

```bash
pytest tests/test_config.py -v
```

Coverage: Comprehensive across all config modules
