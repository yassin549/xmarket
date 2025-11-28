# Xmarket - Quick Reference Guide

## Platform Concept
**Real-World Variables Trading Platform** - Trade measurable real-world metrics like "Elon Musk Intelligence" or "AI Risk" as stocks.

## The Three-Chart System™

| Chart | Source | Update Frequency |
|-------|--------|------------------|
| **Reality** | AI scraping + LLM analysis | Every 15 min |
| **Market** | Orderbook (user trading) | Every 5 min |
| **Trading** | Blend of Reality + Market | Every 5 min |

**Trading Value = (Reality Value + Market Value) / 2**

---

## Files Created Today

### Database Migrations
- `src/infra/migrations/001_create_variables.sql` - Variables table
- `src/infra/migrations/007_create_reality_data.sql` - LLM analysis results
- `src/infra/migrations/008_create_historical_values.sql` - Chart history

### Reality Engine
- `src/frontend/lib/reality/scraper.ts` - Web scraper
- `src/frontend/lib/reality/llmAnalyzer.ts` - Hugging Face LLM integration
- `src/frontend/lib/reality/calculateRealityValue.ts` - Core update logic

### Chart System
- `src/frontend/lib/charts/calculateTradingValue.ts` - Blending logic

### API Endpoints (Cron)
- `src/frontend/app/api/cron/update-reality/route.ts` - Reality updates
- `src/frontend/app/api/cron/update-trading-values/route.ts` - Trading value updates

### Configuration
- `vercel.json` - Deployment & cron configuration
- `README.md` - Updated platform documentation

---

## Environment Variables

Required for deployment:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Hugging Face (Free: huggingface.co/settings/tokens)
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxx

# Cron Security (Generate random string)
CRON_SECRET=your-secret-here

# Auth (Generate random string)
NEXTAUTH_SECRET=your-secret-here

# Real-time (Optional for now)
ABLY_API_KEY=your-key-here
```

---

## Quick Start

### 1. Database Setup
```sql
-- Run migrations in order:
\i src/infra/migrations/001_create_variables.sql
\i src/infra/migrations/007_create_reality_data.sql
\i src/infra/migrations/008_create_historical_values.sql
```

Sample variables are auto-inserted (ELON-IQ, AI-RISK).

### 2. Local Development
```bash
cd src/frontend
npm install
npm run dev
```

### 3. Test Reality Engine
```bash
# Manually trigger reality update
curl http://localhost:3000/api/cron/update-reality

# Check database
psql $DATABASE_URL -c "SELECT symbol, reality_value FROM variables;"
```

### 4. Test Chart Blender
```bash
# Manually trigger trading value update
curl http://localhost:3000/api/cron/update-trading-values

# Check results
psql $DATABASE_URL -c "SELECT symbol, reality_value, market_value, trading_value FROM variables;"
```

---

## Next Steps (In Order)

### Week 1: Foundation
1. Set up Vercel Postgres database
2. Run migrations
3. Get Hugging Face API key (free)
4. Test reality engine locally
5. Verify data flow end-to-end

### Week 2: Frontend
6. Create variable explorer page
7. Build three-chart visualization component
8. Implement trading interface
9. Add order placement form

### Week 3: Trading
10. Simplify orderbook for Vercel
11. Connect orderbook to chart blender
12. Test full trading cycle
13. Add real-time updates (Ably)

### Week 4: Polish & Deploy
14. Admin dashboard (create variables)
15. User authentication (NextAuth)
16. Deploy to Vercel
17. Configure cron jobs
18. Beta test with real users

---

## Sample Variable Configuration

### Elon Musk Intelligence (ELON-IQ)
```json
{
  "symbol": "ELON-IQ",
  "name": "Elon Musk Intelligence",
  "reality_sources": [
    "https://twitter.com/elonmusk",
    "https://techcrunch.com/tag/elon-musk/",
    "https://news.ycombinator.com/",
    "https://www.tesla.com/blog",
    "https://www.spacex.com/news"
  ],
  "impact_keywords": [
    "smart decision",
    "innovation",
    "genius",
    "breakthrough",
    "mistake",
    "failure"
  ]
}
```

**How it works:**
1. Every 15min: Scrape all 5 sources
2. LLM analyzes for smart/dumb decisions
3. Impact: Smart decision = +score, Mistake = -score
4. Reality value adjusts accordingly

---

## Common Commands

### Check Reality Engine Status
```bash
# View recent scrapes
psql $DATABASE_URL -c "
  SELECT 
    v.symbol, 
    rd.source_url, 
    rd.impact_score, 
    rd.confidence, 
    rd.scraped_at
  FROM reality_data rd
  JOIN variables v ON rd.variable_id = v.variable_id
  ORDER BY rd.scraped_at DESC
  LIMIT 10;
"
```

### View Three-Chart History
```bash
# Last 24 hours
psql $DATABASE_URL -c "
  SELECT 
    v.symbol,
    hv.reality_value,
    hv.market_value,
    hv.trading_value,
    hv.timestamp
  FROM historical_values hv
  JOIN variables v ON hv.variable_id = v.variable_id
  WHERE hv.timestamp >= NOW() - INTERVAL '24 hours'
  ORDER BY hv.timestamp DESC;
"
```

---

##  Troubleshooting

### Reality Engine Not Updating
- Check `HUGGINGFACE_API_KEY` is set
- Verify cron endpoint is accessible
- Check logs: `vercel logs`
- Test manually: `curl /api/cron/update-reality`

### LLM Analysis Failing
- Hugging Face free tier has rate limits
- Add delay between variables (2 seconds)
- Check model availability
- Use smaller content chunks (<10K chars)

### Trading Values Not Blending
- Ensure reality engine ran first
- Check orderbook has orders (for market value)
- Verify cron schedule in `vercel.json`

---

## Resources

- **Hugging Face:** https://huggingface.co/docs/inference
- **Vercel Cron:** https://vercel.com/docs/cron-jobs
- **Vercel Postgres:** https://vercel.com/docs/storage/vercel-postgres
- **Next.js API Routes:** https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

## Architecture Diagram

```
┌────────────────────────────────────────────┐
│          VERCEL (Single Service)           │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Frontend │ │   Cron   │ │   API    │  │
│  │ Next.js  │ │  Jobs    │ │  Routes  │  │
│  └──────────┘ └─────┬────┘ └──────────┘  │
│                      │                     │
│  ┌──────────────────┴─────────────────┐  │
│  │      Reality Engine Logic          │  │
│  │  • Scraper                         │  │
│  │  • LLM Analyzer (Hugging Face)     │  │
│  │  • Value Calculator                │  │
│  └───────────┬────────────────────────┘  │
│              │                            │
│  ┌───────────┴────────────────────────┐  │
│  │     Chart Blender Logic            │  │
│  │  • Market value from orderbook     │  │
│  │  • Blend with reality value        │  │
│  │  • Save historical snapshots       │  │
│  └───────────┬────────────────────────┘  │
│              │                            │
└──────────────┼────────────────────────────┘
               │
        ┌──────┴──────┐
        │   Vercel    │
        │  Postgres   │
        └─────────────┘
```

---

**Status:** ✅ Core infrastructure complete, ready for frontend development!
