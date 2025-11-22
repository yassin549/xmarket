# Everything Market - Demo Script

## Prerequisites

- All services running (backend, orderbook, reality-engine, frontend)
- Database initialized with sample stocks
- Terminal access for curl commands

## Demo Flow (15 minutes)

### Part 1: Platform Overview (3 min)

**Narrator**: "Everything Market is a reality-driven prediction market that blends AI-analyzed news with traditional trading."

1. **Open Dashboard** (http://localhost:3000)
   - Show stock selector (ELON, AI_INDEX, TECH)
   - Point out three price cards: Reality Score, Market Price, Final Price
   - Explain: "Final Price = 60% Market + 40% Reality"

2. **Show Architecture**:
   - 4 microservices: Reality Engine, Orderbook, Backend, Frontend
   - Real-time WebSocket updates
   - PostgreSQL database

### Part 2: Reality Engine Demo (5 min)

**Narrator**: "The Reality Engine continuously scrapes news and analyzes impact using AI."

1. **Simulate News Event**:
   ```bash
   python scripts/demo_event.py
   ```
   
   This will:
   - Create a positive event about Tesla AI breakthrough
   - Impact: +15 points
   - Watch dashboard update in real-time

2. **Show Event Details**:
   - Event appears in Events Panel
   - Reality Score increases from 50 → 65
   - Final Price updates smoothly (EWMA animation)
   - Explain quick scorer: 0.4×sentiment + 0.3×keywords + 0.3×NER

3. **Show Anti-Manipulation**:
   ```bash
   python scripts/demo_suspicious_event.py
   ```
   
   - Create event with impact > 15 points
   - Show it gets flagged for admin review
   - Explain: "Human-in-loop for suspicious events"

### Part 3: Trading Demo (4 min)

**Narrator**: "Users can trade on the platform, creating market pressure that influences final price."

1. **Place Buy Order**:
   ```bash
   curl -X POST http://localhost:8001/api/v1/orders \
     -H "Content-Type: application/json" \
     -d '{
       "user_id": "trader-1",
       "symbol": "ELON",
       "side": "BUY",
       "order_type": "LIMIT",
       "quantity": 10,
       "price": 55.0
     }'
   ```
   
   - Show order appears in orderbook
   - Explain price-time priority matching

2. **Place Matching Sell Order**:
   ```bash
   curl -X POST http://localhost:8001/api/v1/orders \
     -H "Content-Type: application/json" \
     -d '{
       "user_id": "trader-2",
       "symbol": "ELON",
       "side": "SELL",
       "order_type": "LIMIT",
       "quantity": 10,
       "price": 54.0
     }'
   ```
   
   - Orders match instantly
   - Trade executes at 54.0 (taker price)
   - Market pressure updates
   - Final price adjusts based on new market data

3. **Show Market Impact**:
   - Market Price increases due to buying pressure
   - Final Price recalculates: 60% market + 40% reality
   - Dashboard updates in real-time via WebSocket

### Part 4: Admin Features (3 min)

**Narrator**: "Admins can create stocks and review flagged events."

1. **Create New Stock**:
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
   
   - New stock appears in selector
   - Starts at initial score of 50

2. **Review Pending Audit**:
   ```bash
   curl http://localhost:8000/api/v1/admin/pending \
     -H "X-Admin-Key: dev-admin-key-change-in-production"
   ```
   
   - Show pending events from earlier
   - Explain admin can approve/reject

3. **Approve Event**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/admin/approve \
     -H "X-Admin-Key: dev-admin-key-change-in-production" \
     -H "Content-Type: application/json" \
     -d '{
       "event_id": "<event-id-from-pending>",
       "approve": true,
       "admin_id": "admin-1"
     }'
   ```
   
   - Event applies to score
   - Dashboard updates
   - Audit trail recorded

## Demo Script Files

Create these helper scripts for smooth demo:

### scripts/demo_event.py
```python
import requests
import json
import hmac
import hashlib
from datetime import datetime

event = {
    "event_id": f"demo-{datetime.now().timestamp()}",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "stocks": ["ELON"],
    "quick_score": 0.75,
    "impact_points": 15.0,
    "summary": "Tesla announces major breakthrough in autonomous driving AI, stock sentiment surges",
    "sources": [
        {"id": "reuters", "url": "https://reuters.com/tech/tesla-ai", "trust": 0.95}
    ],
    "num_independent_sources": 1,
    "llm_mode": "heuristic"
}

payload = json.dumps(event, sort_keys=True).encode()
signature = hmac.new(
    b"dev-reality-secret-change-in-production",
    payload,
    hashlib.sha256
).hexdigest()

response = requests.post(
    "http://localhost:8000/api/v1/reality/ingest",
    json=event,
    headers={"X-Signature": signature}
)

print(f"✅ Event published: {response.json()}")
```

### scripts/demo_suspicious_event.py
```python
# Similar to above but with impact_points = 18.0 (above SUSPICIOUS_DELTA)
```

## Expected Outcomes

After demo, audience should understand:

1. **How reality influences price**: News → AI analysis → Reality Score → Final Price
2. **How trading influences price**: Orders → Matching → Market Pressure → Final Price
3. **Anti-manipulation**: Large impacts flagged for human review
4. **Real-time updates**: WebSocket broadcasts keep UI in sync
5. **Transparency**: All events, trades, and score changes are auditable

## Q&A Preparation

**Q: How do you prevent manipulation?**
A: Three layers:
1. HMAC-signed events from Reality Engine
2. Suspicious delta detection (>15 points flagged)
3. Single-source influence caps (max 35% in 24h)

**Q: What if the LLM hallucinates?**
A: We use deterministic quick scorer as baseline, LLM only for high-confidence events, and admin review for large impacts.

**Q: How do you handle high trading volume?**
A: In-memory orderbook with price-time priority, can scale horizontally on Railway.

**Q: Can users create their own stocks?**
A: No, only admins can create stocks to maintain quality and prevent spam.

**Q: How is this different from prediction markets like Polymarket?**
A: We blend AI news analysis with market trading, creating a hybrid price discovery mechanism.

---

**Demo Duration**: 15 minutes
**Preparation Time**: 5 minutes
**Recommended Audience**: Technical stakeholders, investors, potential users
