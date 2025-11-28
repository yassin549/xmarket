# Xmarket - Real-World Variables Trading Platform

**Trade the reality behind real-world variables**

---

## What is Xmarket?

Xmarket is **not a prediction market**. It's a platform that enables users to **invest in and trade real-world variables** as financial instruments.

### Examples of Tradable Variables

- **Elon Musk Intelligence (ELON-IQ)** - Value changes based on quality of decisions
- **AI Risk (AI-RISK)** - Goes up when data shows AI becoming more dangerous
- **Climate Change Severity (CLIMATE)** - Based on real environmental data
- **Tech Industry Sentiment (TECH-SENT)** - Market mood based on news

## The Three-Chart System™

Every variable has **three independent price charts**:

### 1. Reality Chart 📊
- **Data Source:** AI-powered reality engine
- **Process:** Scrapes 10+ websites → LLM analysis → Impact assessment
- **Output:** Objective reality-based value

### 2. Market Chart 💹
- **Data Source:** User trading orderbook
- **Process:** Public buy/sell orders creating price discovery
- **Output:** Crowd-determined market price

### 3. Trading Chart ⚖️
- **Data Source:** Blend of Reality + Market
- **Formula:** `Trading Price = (Reality Price + Market Price) / 2`
- **Output:** The actual tradable price

**Key Innovation:** Full transparency - all three charts are shown overlaid so traders have complete information.

---

## Architecture

### Single-Service Deployment (Vercel)

```
Next.js Application
├── Frontend (React UI)
├── API Routes (Serverless)
│   ├── /api/variables
│   ├── /api/orders
│   ├── /api/charts
│   └── /api/cron/update-reality
├── Reality Engine (Edge Functions)
│   ├── Web Scraper
│   ├── Hugging Face LLM
│   └── Impact Assessor
└── Orderbook (In-Memory Matching)
```

### Technology Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Vercel Postgres
- **LLM:** Hugging Face Inference API (Mixtral-8x7B)
- **Deployment:** Vercel (single service)
- **Real-time:** Ably
- **Styling:** Tailwind CSS

---

## How It Works

### For Users

1. **Browse Variables** - Explore tradable real-world variables
2. **View Three Charts** - See Reality, Market, and Trading price overlaid
3. **Place Orders** - Buy/sell at Trading price (blended value)
4. **Track Performance** - Monitor your positions based on real-world events

### Behind the Scenes

#### Reality Engine (runs every 15 minutes)
```
1. Scrape 10 configured websites for each variable
2. Send content to Hugging Face LLM
3. LLM assesses impact (-100 to +100)
4. Calculate new reality value
5. Update reality chart
```

#### Trading Price Calculation (runs every 5 minutes)
```
1. Get current reality value from database
2. Get current market mid-price from orderbook
3. Calculate: trading_value = (reality + market) / 2
4. Update trading chart
5. Store historical snapshot
```

#### Order Matching
```
1. User places order at trading price
2. In-memory orderbook matches buy/sell
3. Trades execute instantly
4. Market chart updates with new prices
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Vercel account
- Hugging Face API key (free)

### Installation

```bash
# Clone repository
git clone https://github.com/yassin549/xmarket.git
cd xmarket

# Install dependencies
cd src/frontend
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your keys

# Run development server
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://...
HUGGINGFACE_API_KEY=hf_xxx
NEXTAUTH_SECRET=xxx
ABLY_API_KEY=xxx
```

---

## Database Schema

###  Core Tables

**variables** - Tradable real-world variables
```sql
- variable_id (UUID)
- symbol (e.g., "ELON-IQ")
- name (e.g., "Elon Musk Intelligence")
- reality_sources (JSONB) - URLs to scrape
- impact_keywords (JSONB) - For LLM analysis
- reality_value, market_value, trading_value (DECIMAL)
```

**reality_data** - LLM analysis results
```sql
- source_url, scraped_at
- raw_content (scraped text)
- llm_summary, impact_score, confidence
```

**historical_values** - Chart data
```sql
- variable_id
- reality_value, market_value, trading_value
- timestamp
```

**orders** - User orders
```sql
- order_id, user_id, variable_id
- side (buy/sell), price, quantity
- status (pending/filled/cancelled)
```

**trades** - Matched trades
```sql
- trade_id, buyer_order_id, seller_order_id
- price, quantity, timestamp
```

---

## Project Status

### ✅ Completed
- Core architecture design
- Database schema
- Three-chart system design

### 🚧 In Progress (Refactoring)
- Reality engine implementation
- LLM integration (Hugging Face)
- Frontend three-chart visualization
- Orderbook simplification for Vercel

### 📋 Roadmap
1. **Week 1:** Schema migration + Reality engine core
2. **Week 2:** LLM integration + Chart blending
3. **Week 3:** Frontend UI + Trading interface
4. **Week 4:** Testing + Vercel deployment
5. **Month 2:** Beta launch with initial variables

---

## Contributing

Currently in private development. Public contributions will be welcomed after beta launch.

---

## License

Proprietary - All rights reserved

---

## Contact

- **Website:** Coming soon
- **GitHub:** https://github.com/yassin549/xmarket

---

**Xmarket - Where Reality Meets Market Consensus**
