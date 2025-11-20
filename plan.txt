# Everything Market — Actionable Build Plan & GitHub Repo

**Purpose:** This document is an unambiguous, step‑by‑step build plan you can paste into Antigravity agents or run locally. It includes the exact GitHub repository layout, commit/branch guidance, file list, commands, CI config, and LLM prompts to *automatically* scaffold and implement the Everything Market MVP (Reality Engine + Orderbook + Frontend). Treat this doc as the single source of truth.

---

## Repository (create this on GitHub)

**Repo name (suggested):** `everything-market`
**Owner / path:** `github.com/<YOUR_GITHUB_USERNAME>/everything-market`
(Replace `<YOUR_GITHUB_USERNAME>` with your GitHub username.)

**Default branch:** `main`
**Development branch:** `dev`
**Release tags:** `v0.1-mvp`, `v0.2-alpha`, ...

**High-level README (short):** keep `README.md` minimal at first; the repo will contain a full `docs/` folder with this plan.

---

## Repo structure (exact)

```
everything-market/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI entry (api.server)
│   │   ├── config.py                 # env var loader
│   │   ├── models.py                 # SQLAlchemy models (events, scores, users)
│   │   ├── db.py                     # DB session maker
│   │   ├── scraper/
│   │   │   ├── poller.py             # polling loop
│   │   │   ├── scraper_utils.py      # rss + newspaper + playwright helpers
│   │   │   └── sources.yaml          # sources config
│   │   ├── nlp/
│   │   │   ├── embed.py              # embeddings wrapper
│   │   │   ├── filters.py            # quick scorer functions
│   │   │   └── llm_client.py         # llama.cpp wrapper or API bridge
│   │   ├── index/
│   │   │   └── vector_index.py       # in-memory FAISS wrapper
│   │   ├── scoring/
│   │   │   ├── reality_engine.py     # apply_event, decay, smoothing
│   │   │   └── quick_scorer.py
│   │   ├── matching/
│   │   │   └── orderbook.py          # limit orderbook engine
│   │   └── api/
│   │       ├── routes.py             # registers routers
│   │       └── sockets.py            # websocket broadcaster
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── Chart.jsx
│       │   ├── Orderbook.jsx
│       │   └── EventsList.jsx
│       └── ws.js
├── infra/
│   ├── railway.json                   # optional Railway manifest
│   └── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── ci.yml                     # run tests + lint on PRs
│       └── deploy.yml                 # deploy to Railway (if using ghactions)
├── docs/
│   └── plan.md                        # this document (kept in sync)
├── README.md
└── LICENSE
```

---

## EXACT `backend/requirements.txt` (copy‑paste)

```
fastapi==0.95.2
uvicorn[standard]==0.22.0
feedparser==6.0.10
newspaper3k==0.2.8
playwright==1.40.0
sentence-transformers==2.2.2
spacy==3.5.4
psycopg2-binary==2.9.7
sqlalchemy==2.0.18
python-dotenv==1.0.0
faiss-cpu==1.7.4
pytest==7.4.0
```

---

## EXACT `backend/Dockerfile` (copy‑paste)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y build-essential libxml2-dev libxslt-dev libjpeg-dev zlib1g-dev git ffmpeg curl \
    && pip install --upgrade pip \
    && pip install -r requirements.txt \
    && playwright install --with-deps chromium
COPY . .
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## EXACT `frontend/package.json` deps (skeleton)

Use Vite React template and install:

```
npm init vite@latest frontend --template react
cd frontend
npm install chart.js react-chartjs-2
```

---

## Branching & commit conventions (exact)

* Create `main` branch with no code at start.
* Create `dev` branch: `git checkout -b dev`
* Use feature branches: `feature/scraper`, `feature/reality-engine`, `feature/orderbook`, `feature/frontend`.
* Commit messages: `feat(scraper): add rss poller`, `fix(reality): clamp score delta`, `test(orderbook): matching partial fill`.

---

## Milestones (improved, explicit, LLM‑friendly tasks)

Below each milestone I provide **two inputs**: 1) CLI / dev steps you run manually and 2) an **LLM agent prompt** to instruct Antigravity or any code generator to implement the feature exactly. Use the LLM prompts as-is.

### Milestone 0 — Bootstrap repository (1 hour)

Manual steps:

1. Create the GitHub repo `everything-market`.
2. Clone locally: `git clone git@github.com:<YOU>/everything-market.git`.
3. Create `dev` branch: `git checkout -b dev`.
4. Add empty `README.md`, `LICENSE` (MIT), `.gitignore` (Python, Node, .env).
5. Commit & push.

LLM prompt (run inside Antigravity):

```
Task: Initialize the repo structure for `everything-market`.
Files to create: README.md, LICENSE (MIT), .gitignore, infra/docker-compose.yml (empty), backend/requirements.txt (fill with list), backend/Dockerfile. Commit to branch `dev` with message "chore(repo): bootstrap repo structure".
Deliverable: a PR from `dev`->`main` with the files.
```

Acceptance: PR created and CI (lint) passes (CI added later). Merge `dev` into `main` only after Milestone 1.

---

### Milestone 1 — Scraper & Poller (concrete) (4–8 hours)

Manual steps:

1. Create `backend/app/scraper/sources.yaml` with explicit sources (I include the example file below).
2. Implement `scraper_utils.py` (RSS fetch, newspaper extraction, make_id).
3. Implement `poller.py` using exact code snippet below (copy/paste safe minimal implementation). The poller writes candidate events to a local SQLite DB or Postgres if `DATABASE_URL` is set.
4. Run locally: `python -m backend.app.scraper.poller`.

**Exact `sources.yaml`** (place under `backend/app/scraper/sources.yaml`):

```yaml
- id: arxiv-cs
  type: rss
  url: https://export.arxiv.org/rss/cs.AI
  trust: 0.9
- id: hacker-news
  type: rss
  url: https://news.ycombinator.com/rss
  trust: 0.6
- id: the-verge
  type: rss
  url: https://www.theverge.com/rss/index.xml
  trust: 0.7
- id: r-machine-learning
  type: reddit
  query: r/MachineLearning
  trust: 0.7
- id: llmarena
  type: scrape
  url: https://llmarena.example/rss
  trust: 0.5
```

LLM agent prompt (Antigravity-ready):

```
Task: Implement scraper utilities and a poller for the Everything Market MVP.
Requirements: Use feedparser, newspaper3k, and a Playwright fallback. Save candidate events (id,url,title,body,published,source_id) into a `events` table in the configured DATABASE_URL or a local SQLite file if DATABASE_URL is missing.
Edge cases: Deduplicate by SHA1(url|published), skip short articles (<100 chars), respect POLL_INTERVAL env var (default 300s).
Commit: feature/scraper
```

Acceptance criteria:

* `python -m backend.app.scraper.poller` runs and logs new candidate events when sources publish.
* Poller creates entries in the `events` table with the required fields.

---

### Milestone 2 — Embeddings + Dedupe + Quick Scorer (6–12 hours)

Manual steps:

1. Implement `embed.py` which loads `SentenceTransformer('all-MiniLM-L6-v2')` and exposes `embed_text(text: str) -> np.ndarray` normalized.
2. Implement `vector_index.py` wrapping FAISS index with in-memory eviction policy (keep last 6 hours). API: `add(id, vector, ts)`, `query(vector, k)`, `evict_older_than(seconds)`.
3. Implement `quick_scorer.py` that uses spaCy NER + keyword heuristics to output `quick_score` ∈ [-1,1].
4. Wire poller to compute embedding and skip candidates too similar (cosine > 0.88) to existing vectors.

LLM prompt (Antigravity):

```
Task: Implement embedding wrapper (all-MiniLM-L6-v2), FAISS in-memory index with eviction, and a quick_scorer that returns normalized quick_score based on sentiment keywords, NER match with targets, and source_trust.
Deliverable: functions embed_text, add_vector, is_duplicate, quick_score. Unit tests demonstrating dedupe and scoring behavior.
Branch: feature/embeddings
```

Acceptance criteria:

* Unit tests show dedupe: two near-duplicate texts get similarity >0.88 and are considered duplicates.
* quick_score returns values in [-1,1] and higher magnitude for texts with negative keywords.

---

### Milestone 3 — Reality Engine (6–12 hours)

Manual steps:

1. Implement `reality_engine.py` with these exact functions:

   * `apply_event(stock_id, event_points, source_id, timestamp)`:
     * First, read current score and `last_updated`.
     * Apply **Lazy Decay**: `score = score * exp(-(now - last_updated) / tau)`.
     * Then apply new event impact and update `last_updated = now`.
   * `get_score(stock_id)`:
     * Read score from DB.
     * Apply **Lazy Decay** (in-memory only) to return the effective score at `now` without writing to DB (read-only optimization).
   * `decay_scores(now)`: (Optional background job, since lazy decay handles reads).
2. Use constants: `tau_seconds = 48*3600`, `delta_cap = 20`, `alpha = 0.25`.
3. Persist final reality score into `scores` table: `(stock_id, score, confidence, last_updated)`.

LLM prompt:

```
Task: Implement reality scoring engine for Everything Market.
Inputs: event impact points (float), source_id, timestamp. Use event_weight formula: source_trust*(1+log(1+num_related_docs))*exp(-age/tau). Scale to event_points = event_weight*quick_score*100. Cap per-event delta to ±20. Smooth with EWMA alpha=0.25. Persist scores in DB and provide get_score API.
Branch: feature/reality-engine
```

Acceptance criteria:

* The engine's unit tests validate capping, smoothing and decay behavior.
* API returns stable values for simulated events.

---

### Milestone 4 — Selective LLM Summaries (4–8 hours)

Manual steps:

1. Implement `llm_client.py` that supports two modes via env var `LLM_MODE`: `local` (calls llama.cpp subprocess) or `api` (calls remote endpoint via API key). If none provided use `heuristic` mode.
2. Integrate with poller using **Batch-based Clustering**:
   * For each batch of articles, query `vector_index` (k=5, window=6h).
   * If `similarity > 0.78`, mark as related to existing event and increment `num_related_docs`.
   * If no match, create new event.
   * **Trigger LLM**: Only for "Hot Events" where `num_related_docs >= 2` OR `|quick_score| >= 0.45`.
3. Save LLM summaries and numeric impact to `events` table for audit.

LLM prompt:

```
Task: Implement llm_client supporting local (llama.cpp), remote API, and heuristic fallback. Provide a stable JSON output: {summary, impact_points, rationale}. Only call for top events. Add rate limiter: max LLM_CALLS_PER_HOUR (env var).
Branch: feature/llm
```

Acceptance criteria:

* LLM client returns valid summary JSON for sample input.
* Calls are rate-limited and logged in DB.

---

### Milestone 5 — Orderbook + Blending (8–12 hours)

Manual steps:

1. Implement `orderbook.py` API with functions: `place_order(user, side, price, qty)`, `cancel_order(order_id)`, `match_orders()`.
2. Implement **Matching Logic** (In-Memory Loop):
   * Lock orderbook.
   * While `incoming.qty > 0` and `opposite_heap` not empty:
     * Peek `best_match`.
     * If `price` crosses (buy >= ask or sell <= bid):
       * `trade_qty = min(incoming.qty, best_match.qty)`
       * `trade_price = best_match.price` (Maker priority)
       * Create Trade event, update quantities.
       * If `best_match.qty == 0`, pop from heap.
     * Else: Break.
   * If `incoming.qty > 0`, push to own heap.
   * Release lock.
3. Implement `price.blend(market_price, reality_score, weights)` which returns final price. Use default weights market=0.6, reality=0.4.

LLM prompt:

```
Task: Implement a limit orderbook for the Everything Market MVP. Provide a simple REST API to place/cancel orders and to query best_bid, best_ask, last_trade. Implement full matching logic with unit tests showing matching and partial fills.
Branch: feature/orderbook
```

Acceptance criteria:

* Matching unit tests pass (limit, market orders, partial fills).
* The backend provides REST endpoints to place orders and returns correct trades.

---

### Milestone 6 — API + WebSocket + Frontend (12–24 hours)

Manual steps:

1. Implement FastAPI endpoints: `/stocks/{id}/score`, `/stocks/{id}/orderbook`, `/order` (place order), WebSocket `/ws` broadcasting updates.
2. Build React demo: connect to `/ws`, display current RealityScore, MarketPrice, FinalPrice, orderbook, and events list. Add a "simulate news" button to POST a synthetic event for demo.

LLM prompt:

```
Task: Implement API endpoints and a React dashboard for Everything Market MVP. Dashboard must show final price, reality score, market price, orderbook, and top events. Use Chart.js for the price chart and Socket.io or native WebSocket for real-time updates.
Branch: feature/frontend
```

Acceptance criteria:

* UI shows live updates when a simulated event is sent from backend.
* Orders placed from UI update orderbook and final price in real time.

---

### Milestone 7 — Deployment & CI (4 hours)

Manual steps:

1. Create Railway project and add Postgres plugin. Set `DATABASE_URL` in Railway env. Add `POLL_INTERVAL=300`, `LLM_MODE=heuristic` for demo.
2. Create GitHub Actions workflow `.github/workflows/ci.yml` to run `pytest` for backend on PRs.
3. Add a simple deploy workflow to push Docker image to Railway or trigger Railway deploy from GitHub.

LLM prompt:

```
Task: Add GitHub Actions CI to run backend tests on PR. Add a deploy workflow that triggers Railway deployment on merge to main. Ensure secrets (DATABASE_URL) are read from Railway, not stored in repo.
Branch: chore/ci
```

Acceptance criteria:

* PR triggers CI tests.
* Merge to `main` triggers deploy and Railway services start.

---

## Detailed file templates & exact code snippets (copy/paste ready)

Below are *critical* starter files — copy them exactly into the repo. These are intentionally minimal and safe for MVP.

### `backend/app/models.py`

```python
import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

Base = declarative_base()

class Event(Base):
    __tablename__ = 'events'
    id = sa.Column(sa.String, primary_key=True)
    url = sa.Column(sa.String)
    title = sa.Column(sa.String)
    published = sa.Column(sa.DateTime)
    source_id = sa.Column(sa.String)
    summary = sa.Column(sa.Text)
    impact = sa.Column(sa.Float)
    created_at = sa.Column(sa.DateTime, default=datetime.now(timezone.utc))

class Score(Base):
    __tablename__ = 'scores'
    stock_id = sa.Column(sa.String, primary_key=True)
    score = sa.Column(sa.Float)
    confidence = sa.Column(sa.Float)
    last_updated = sa.Column(sa.DateTime)
```

### `backend/app/scraper/scraper_utils.py`

```python
import feedparser
from newspaper import Article
from playwright.sync_api import sync_playwright
import hashlib

def fetch_rss_items(url):
    feed = feedparser.parse(url)
    items = []
    for e in feed.entries:
        items.append({
            "url": e.get("link"),
            "title": e.get("title", ""),
            "published": e.get("published", None),
        })
    return items

def extract_article_text(url, use_playwright=False, timeout=20):
    try:
        a = Article(url)
        a.download()
        a.parse()
        text = a.text
        if text and len(text) > 100:
            return text
    except Exception:
        pass
    if not use_playwright:
        return ""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(url, timeout=timeout*1000)
            text = page.inner_text("body")
            return text
        except Exception:
            return ""
        finally:
            browser.close()

def make_id(url, published):
    key = f"{url}|{published}"
    return hashlib.sha1(key.encode()).hexdigest()
```

### `backend/app/scraper/poller.py` (minimal)

```python
import time, os
import yaml
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
from sentence_transformers import SentenceTransformer

from .scraper_utils import fetch_rss_items, extract_article_text, make_id
# Import models to ensure tables are defined
from ..models import Base, Event

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./data.db')
engine = sa.create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {})
Session = sessionmaker(bind=engine)

# Create tables if not exist
Base.metadata.create_all(engine)

embed_model = SentenceTransformer('all-MiniLM-L6-v2')

SOURCES = []
with open('app/scraper/sources.yaml','r') as f:
    SOURCES = yaml.safe_load(f)

POLL_INTERVAL = int(os.getenv('POLL_INTERVAL','300'))
RECENT_IDS = set()

def process_source(src):
    items = fetch_rss_items(src['url'])
    for it in items:
        uid = make_id(it['url'], it.get('published'))
        
        # Check memory first
        if uid in RECENT_IDS:
            continue
            
        # Check DB robustness (in case of restart)
        session = Session()
        if session.query(Event).filter_by(id=uid).first():
            RECENT_IDS.add(uid)
            session.close()
            continue
        session.close()

        text = extract_article_text(it['url'], use_playwright=False)
        if not text or len(text) < 120:
            continue
            
        # Embed (placeholder for snippet)
        emb = embed_model.encode(text, normalize_embeddings=True)
        RECENT_IDS.add(uid)
        
        quick = 0.2
        impact = quick * src.get('trust', 0.5) * 10
        
        try:
            session = Session()
            new_event = Event(
                id=uid, url=it['url'], title=it['title'], 
                published=datetime.now(timezone.utc), 
                source_id=src['id'], summary='placeholder', impact=impact
            )
            session.add(new_event)
            session.commit()
        except sa.exc.IntegrityError:
            session.rollback()
        except Exception as e:
            print(f"Error inserting event {uid}: {e}")
        finally:
            session.close()

def run_loop():
    while True:
        for s in SOURCES:
            try:
                process_source(s)
            except Exception as e:
                print('src error', s.get('id'), e)
        time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    run_loop()
```
## Exact LLM prompts (copy-paste) for Antigravity to implement features

Below are **ready-to-run prompts** you can paste into Antigravity agents to build each milestone. Each prompt includes input files to create, tests, branch names, and acceptance criteria.

### Prompt A — "Scaffolder: create repo files and CI"

```
You are an automated developer. Create the repo files for the Everything Market MVP as described in docs/plan.md. Create backend/requirements.txt, backend/Dockerfile, basic frontend scaffold (Vite React), and a GitHub Actions CI YAML that runs Python tests. Commit on branch 'dev' and open a PR to 'main'.
Tests: none required. Acceptance: PR exists with files.
```

### Prompt B — "Scraper builder"

```
You are an automated developer. Implement the scraper utilities and poller exactly as supplied in this document (scraper_utils.py and poller.py). Wire sources.yaml under backend/app/scraper. Ensure the poller writes events to DB. Add unit tests mocking HTTP responses.
Branch: feature/scraper. Tests: provide pytest tests for dedupe and RSS parsing.
```

(Use similar LLM prompts for Embeddings, Reality Engine, Orderbook, Frontend; each prompt should reference the file templates above and request unit tests.)

---

## CI / Tests (exact .github/workflows/ci.yml)

```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: 3.11
      - name: Install deps
        run: |
          cd backend
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd backend
          pytest -q
```

---

## Deployment notes (Railway)

1. Create a Railway project and add Postgres plugin.
2. Add two services: `api` (FastAPI) and `scraper-worker` (background worker running poller). Use Dockerfile for `api` and a separate worker process for `scraper-worker` with command `python -m app.scraper.poller`.
3. Set env vars in Railway: `DATABASE_URL`, `POLL_INTERVAL=300`, `LLM_MODE=heuristic`, `LLM_CALLS_PER_HOUR=10`.
4. Use `LLM_MODE=heuristic` for demo to avoid LLM costs.

---

## Security, legal & ToS checklist (must do before public demo)

* Add robots.txt checking in scraper_utils and respect crawl-delay.
* Add source trust scores and avoid high-risk scraping (X/Twitter) until you have API access.
* Display source links on frontend and keep LLM summaries auditable (store urls + summary).
* Add rate limiting, backoff and IP throttling.

---

## How to use this doc with Antigravity (exact instructions)

1. Open Antigravity and create a new project folder linked to your cloned repository.
2. Use the LLM prompts under "Exact LLM prompts" section. Paste each prompt into an Antigravity agent and run it to scaffold code.
3. After each agent run, run unit tests locally to validate.
4. Commit and push feature branches, open PRs and use CI to run tests.

---

## Final checklist before investor demo

* [ ] Backend poller runs and produces candidate events (logs).
* [ ] Embedding + dedupe + quick scorer implemented and unit tested.
* [ ] Reality engine updates scores per event with capping and smoothing.
* [ ] Orderbook accepts orders and matches trades.
* [ ] Final price is published as blended value via WebSocket.
* [ ] Frontend dashboard shows live values and events with links.
* [ ] Anti-manipulation rules (multi-source checks, caps, smoothing) implemented.
* [ ] LLM mode set to `heuristic` for demo; commit flag shows calls are limited.