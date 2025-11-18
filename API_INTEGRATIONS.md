# Xmarket — Required APIs & Software Integrations

## Overview
This document lists all APIs and software integrations needed for Xmarket MVP - a trading platform where users can trade everything. Focus on crypto-only payments (multi-stablecoin support) and TradingView lightweight charts.

---

## 1. CRYPTO PAYMENT & WALLET APIs

### 1.1 Primary Payment Processors (Choose 1-2 for MVP)

#### **Custodial Wallet System (Selected for MVP)**
- **Approach**: Platform holds user funds in custodial wallets
- **Purpose**: Users deposit directly to platform, withdraw instantly without permission
- **Features**:
  - Unique deposit addresses per user/token/network
  - Multi-stablecoin support (USDC, USDT, DAI, PYUSD, etc.)
  - Multi-chain support (Ethereum, Polygon, Base, Arbitrum, Optimism, etc.)
  - Instant automated withdrawals
  - Unified USD balance system
  - Hot/cold wallet management
- **Why**: Simpler UX, instant withdrawals, no wallet connection needed
- **Note**: No external payment processor needed - direct blockchain integration via Alchemy

#### **Coinbase Commerce (Alternative - Not Selected)**
- **API**: Coinbase Commerce API
- **Purpose**: Alternative payment processor (not used in MVP)
- **Note**: Using direct custodial wallet system instead

#### **Circle (Alternative - Not Selected)**
- **API**: Circle API v2
- **Purpose**: USDC deposits, withdrawals, custody
- **Features**:
  - Multi-chain USDC support (Ethereum, Polygon, Avalanche, Base, etc.)
  - Programmable wallets
  - Webhook notifications for transactions
  - Compliance tools (KYC/AML)
- **Documentation**: https://developers.circle.com/
- **Cost**: Transaction-based fees
- **Note**: Considered but not selected - using Coinbase Commerce instead

#### **Stripe Crypto (Alternative)**
- **API**: Stripe Crypto API
- **Purpose**: Crypto onramps (fiat → crypto)
- **Features**:
  - Fiat-to-crypto conversion
  - Card payments converted to crypto
- **Documentation**: https://stripe.com/docs/crypto
- **Cost**: Standard Stripe fees + crypto conversion
- **Note**: For future fiat onramps, not MVP

### 1.2 Blockchain Infrastructure APIs

#### **Alchemy (Recommended)**
- **API**: Alchemy API
- **Purpose**: Blockchain node access, transaction monitoring
- **Features**:
  - Multi-chain support (Ethereum, Polygon, Arbitrum, Base, etc.)
  - Webhook notifications for on-chain events
  - Enhanced APIs (getAssetTransfers, getTokenBalances)
  - Transaction simulation
- **Documentation**: https://docs.alchemy.com/
- **Cost**: Free tier (300M compute units/month), then pay-as-you-go
- **Why**: Reliable, feature-rich, good free tier

#### **Infura (Alternative)**
- **API**: Infura API
- **Purpose**: Ethereum/Polygon node access
- **Features**:
  - JSON-RPC endpoints
  - WebSocket support
  - IPFS integration
- **Documentation**: https://docs.infura.com/
- **Cost**: Free tier (100k requests/day), then paid
- **Why**: Established, reliable

#### **QuickNode (Alternative)**
- **API**: QuickNode API
- **Purpose**: Multi-chain node infrastructure
- **Features**:
  - 20+ blockchain networks
  - Enhanced APIs
  - Webhook notifications
- **Documentation**: https://www.quicknode.com/docs
- **Cost**: Free tier available, then tiered pricing
- **Why**: Good for multi-chain support

### 1.3 Wallet & Transaction Monitoring

#### **Tenderly (Recommended)**
- **API**: Tenderly API
- **Purpose**: Transaction monitoring, debugging, simulation
- **Features**:
  - Real-time transaction tracking
  - Transaction simulation
  - Alert system
  - Debugging tools
- **Documentation**: https://docs.tenderly.co/
- **Cost**: Free tier (100 simulations/month), then paid
- **Why**: Excellent for monitoring deposits/withdrawals

#### **Etherscan API (For Ethereum)**
- **API**: Etherscan API
- **Purpose**: Transaction verification, address monitoring
- **Features**:
  - Transaction history
  - Token balance checks
  - Contract verification
- **Documentation**: https://docs.etherscan.io/
- **Cost**: Free tier (5 calls/sec), paid for higher limits
- **Why**: Standard for Ethereum verification

### 1.4 Multi-Chain Token Support

#### **CoinGecko API**
- **API**: CoinGecko API
- **Purpose**: Token prices, market data, multi-chain token info
- **Features**:
  - Real-time prices (USDC, USDT, etc.)
  - Historical price data
  - Token metadata
  - Multi-chain support
- **Documentation**: https://www.coingecko.com/en/api
- **Cost**: Free tier (10-50 calls/min), paid for higher limits
- **Why**: Comprehensive token data, good free tier

#### **1inch API (For Token Swaps - Future)**
- **API**: 1inch API
- **Purpose**: Token swaps (if users deposit non-USDC tokens)
- **Features**:
  - Multi-chain DEX aggregation
  - Best price routing
  - Swap execution
- **Documentation**: https://docs.1inch.io/
- **Cost**: Transaction-based fees
- **Note**: For Phase 2 if supporting multiple tokens

---

## 2. TRADINGVIEW LIGHTWEIGHT CHARTS

### 2.1 TradingView Lightweight Charts Library
- **Library**: TradingView Lightweight Charts
- **Purpose**: Real-time price charts, candlesticks, volume bars
- **Features**:
  - High-performance rendering
  - Customizable themes
  - Multiple chart types (line, candlestick, area, histogram)
  - Time range selection
  - Crosshair, tooltips
  - Mobile-responsive
- **Documentation**: https://tradingview.github.io/lightweight-charts/
- **Cost**: Free (open-source)
- **Integration**: NPM package `lightweight-charts`
- **Why**: Industry standard, performant, free

### 2.2 Chart Data Sources
- **Your Backend API**: Real-time price data via WebSocket
- **Historical Data**: Your Postgres database (trades, OHLCV aggregates)
- **Note**: TradingView charts consume your own data, no external API needed

---

## 3. REAL-TIME DATA & WEBSOCKET INFRASTRUCTURE

### 3.1 Redis (Pub/Sub for Real-time Events)
- **Service**: Redis Cloud or self-hosted
- **Purpose**: Pub/sub for market updates, trade events
- **Features**:
  - Pub/sub channels
  - Caching
  - Rate limiting
- **Documentation**: https://redis.io/docs/
- **Cost**: Free tier available (Redis Cloud), then paid
- **Why**: Standard for real-time pub/sub

### 3.2 WebSocket Server
- **Implementation**: Custom (using `ws` or `uWebSockets.js`)
- **Purpose**: Real-time market data streaming to frontend
- **Features**:
  - Market price updates
  - Trade notifications
  - Position updates
  - Funding rate updates
- **Note**: Built-in, no external API needed

---

## 4. DATABASE & STORAGE

### 4.1 PostgreSQL
- **Service**: Railway, Supabase, or AWS RDS
- **Purpose**: Primary database (markets, trades, positions, users)
- **Features**:
  - ACID transactions
  - JSON support
  - Full-text search
  - Read replicas (Phase 2)
- **Cost**: Free tier available, then paid
- **Why**: Standard for financial applications

### 4.2 Redis (Caching)
- **Service**: Redis Cloud or self-hosted
- **Purpose**: Caching, session storage, rate limiting
- **Cost**: Free tier available, then paid

### 4.3 Object Storage (For Phase 2)
- **Service**: AWS S3, Cloudflare R2, or Railway Storage
- **Purpose**: WAL snapshots, audit logs, backups
- **Cost**: Pay-as-you-go
- **Note**: For Phase 2 matching engine

---

## 5. MESSAGE QUEUE (Phase 2)

### 5.1 Apache Kafka (Recommended)
- **Service**: Confluent Cloud or self-hosted
- **Purpose**: Event streaming for matching engine, trade events
- **Features**:
  - High throughput
  - Event replay
  - Consumer groups
- **Documentation**: https://kafka.apache.org/documentation/
- **Cost**: Free tier available (Confluent), then paid
- **Why**: Industry standard for event streaming

### 5.2 RabbitMQ (Alternative)
- **Service**: CloudAMQP or self-hosted
- **Purpose**: Message queue for async processing
- **Cost**: Free tier available, then paid
- **Why**: Simpler than Kafka, good for MVP

---

## 6. MONITORING & OBSERVABILITY

### 6.1 Sentry (Error Tracking)
- **API**: Sentry API
- **Purpose**: Error tracking, performance monitoring
- **Features**:
  - Real-time error alerts
  - Performance monitoring
  - Release tracking
  - User context
- **Documentation**: https://docs.sentry.io/
- **Cost**: Free tier (5k events/month), then paid
- **Why**: Industry standard, excellent DX

### 6.2 Prometheus + Grafana
- **Service**: Self-hosted or Grafana Cloud
- **Purpose**: Metrics, dashboards, alerting
- **Features**:
  - Custom metrics (trading volume, latency, etc.)
  - Dashboards
  - Alerting rules
- **Documentation**: https://prometheus.io/docs/
- **Cost**: Free (self-hosted) or Grafana Cloud free tier
- **Why**: Standard for observability

### 6.3 Logging
- **Service**: Railway logs, Logtail, or Datadog
- **Purpose**: Centralized logging
- **Cost**: Free tier available, then paid
- **Why**: Essential for debugging

---

## 7. AUTHENTICATION & SECURITY

### 7.1 JWT (Built-in)
- **Implementation**: Custom (using `jsonwebtoken`)
- **Purpose**: User authentication
- **Note**: No external API needed

### 7.2 Rate Limiting
- **Implementation**: Redis-based (built-in)
- **Purpose**: API rate limiting
- **Note**: No external API needed

### 7.3 IP Geolocation (For Geofencing)
- **API**: MaxMind GeoIP2 or ipapi.co
- **Purpose**: Geofencing, compliance
- **Features**:
  - IP to country/city mapping
  - VPN detection
- **Documentation**: https://dev.maxmind.com/geoip/
- **Cost**: Free tier available, then paid
- **Why**: Required for compliance geofencing

---

## 8. NOTIFICATIONS (Optional for MVP)

### 8.1 Email Service
- **Service**: SendGrid, Resend, or AWS SES
- **Purpose**: Transaction emails, notifications
- **Features**:
  - Transactional emails
  - Templates
  - Analytics
- **Cost**: Free tier available, then paid
- **Why**: User notifications

### 8.2 Push Notifications (Future)
- **Service**: OneSignal or Firebase Cloud Messaging
- **Purpose**: Mobile push notifications
- **Cost**: Free tier available, then paid
- **Note**: For mobile app (Phase 2)

---

## 9. ORACLE APIs (For Event Market Resolution - Phase 2)

### 9.1 Chainlink (Recommended)
- **API**: Chainlink Price Feeds, Chainlink Functions
- **Purpose**: Event market resolution, price feeds
- **Features**:
  - Decentralized oracles
  - Custom data feeds
  - Multiple data sources
- **Documentation**: https://docs.chain.link/
- **Cost**: Pay-per-request or subscription
- **Why**: Industry standard, decentralized

### 9.2 UMA (Alternative)
- **API**: UMA Oracle
- **Purpose**: Event market resolution
- **Features**:
  - Optimistic oracles
  - Custom resolution logic
- **Documentation**: https://docs.umaproject.org/
- **Cost**: Transaction fees
- **Why**: Good for custom resolution logic

### 9.3 Pyth Network (For Price Feeds)
- **API**: Pyth Network API
- **Purpose**: Real-time price feeds
- **Features**:
  - High-frequency price updates
  - Multi-chain support
- **Documentation**: https://docs.pyth.network/
- **Cost**: Free (public good)
- **Why**: Fast, reliable price feeds

---

## 10. ANALYTICS & TRACKING (Optional)

### 10.1 PostHog or Mixpanel
- **Service**: PostHog / Mixpanel
- **Purpose**: Product analytics, user behavior tracking
- **Features**:
  - Event tracking
  - Funnels
  - User cohorts
- **Cost**: Free tier available, then paid
- **Why**: Understand user behavior

### 10.2 Google Analytics (Optional)
- **Service**: Google Analytics 4
- **Purpose**: Web analytics
- **Cost**: Free
- **Note**: Privacy considerations

---

## 11. DEPLOYMENT & INFRASTRUCTURE

### 11.1 Railway (Recommended for MVP)
- **Service**: Railway
- **Purpose**: Hosting (web app, API, database, Redis)
- **Features**:
  - Simple deployment
  - Built-in Postgres, Redis
  - Environment variables
  - GitHub integration
- **Documentation**: https://docs.railway.app/
- **Cost**: Free tier ($5 credit/month), then pay-as-you-go
- **Why**: Easiest for solo builder, good for MVP

### 11.2 Vercel (For Frontend - Alternative)
- **Service**: Vercel
- **Purpose**: Next.js frontend hosting
- **Features**:
  - Edge functions
  - CDN
  - Analytics
- **Cost**: Free tier, then paid
- **Why**: Optimized for Next.js

### 11.3 Docker
- **Service**: Docker Hub
- **Purpose**: Containerization
- **Cost**: Free
- **Why**: Standard for deployment

---

## 12. CDN & ASSET HOSTING

### 12.1 Cloudflare (Recommended)
- **Service**: Cloudflare
- **Purpose**: CDN, DDoS protection, DNS
- **Features**:
  - Global CDN
  - DDoS protection
  - SSL certificates
  - Analytics
- **Cost**: Free tier, then paid
- **Why**: Best free tier, excellent performance

### 12.2 Vercel Edge Network (If using Vercel)
- **Service**: Built into Vercel
- **Purpose**: CDN for static assets
- **Cost**: Included with Vercel
- **Why**: Automatic with Vercel deployment

---

## 13. DEVELOPMENT TOOLS

### 13.1 GitHub Actions (CI/CD)
- **Service**: GitHub Actions
- **Purpose**: CI/CD pipelines
- **Cost**: Free for public repos, free tier for private
- **Why**: Standard, integrated with GitHub

### 13.2 npm / pnpm
- **Service**: npm registry
- **Purpose**: Package management
- **Cost**: Free
- **Why**: Standard for Node.js

---

## MVP PRIORITY RANKING

### **Critical (Must Have for MVP)**
1. ✅ **PostgreSQL** - Database
2. ✅ **Redis** - Caching & pub/sub
3. ✅ **Alchemy** - Blockchain node access (transaction monitoring, deposits/withdrawals)
4. ✅ **CoinGecko API** - Token prices (for USD conversion)
5. ✅ **TradingView Lightweight Charts** - Price charts
6. ✅ **Sentry** - Error tracking
7. ✅ **Railway** - Hosting
8. ✅ **Cloudflare** - CDN & DNS

### **Important (Should Have)**
9. ⚠️ **CoinGecko API** - Token prices
10. ⚠️ **Tenderly** - Transaction monitoring
11. ⚠️ **MaxMind GeoIP** - Geofencing
12. ⚠️ **SendGrid/Resend** - Email notifications

### **Nice to Have (Phase 2)**
13. 📋 **Kafka** - Event streaming
14. 📋 **Chainlink/UMA** - Oracle resolution
15. 📋 **Prometheus + Grafana** - Advanced monitoring
16. 📋 **PostHog** - Product analytics

---

## INTEGRATION CHECKLIST

### Phase 1 (MVP)
- [ ] Set up PostgreSQL database (Railway)
- [ ] Set up Redis (Railway or Redis Cloud)
- [ ] Set up Alchemy account and API keys (for all networks: Ethereum, Polygon, Base, etc.)
- [ ] Integrate Alchemy API for deposit detection (all stablecoins)
- [ ] Integrate Alchemy API for automated withdrawals
- [ ] Integrate CoinGecko API for token prices (USD conversion)
- [ ] Set up hot wallet management system (for instant withdrawals)
- [ ] Integrate TradingView Lightweight Charts
- [ ] Set up Sentry for error tracking
- [ ] Configure Cloudflare for CDN/DNS
- [ ] Set up GitHub Actions for CI/CD
- [ ] Set up Tenderly for transaction monitoring
- [ ] Configure MaxMind GeoIP for geofencing
- [ ] Set up email service (SendGrid/Resend)

### Phase 2 (Production)
- [ ] Set up Kafka for event streaming
- [ ] Integrate Chainlink/UMA for oracle resolution
- [ ] Set up Prometheus + Grafana
- [ ] Add PostHog for analytics
- [ ] Set up S3-compatible storage for backups
- [ ] Configure advanced monitoring & alerting

---

## COST ESTIMATION (Monthly)

### MVP (Low Traffic)
- **Railway**: $0-20 (free tier + small usage)
- **Alchemy**: $0 (free tier sufficient for MVP - 300M compute units/month)
- **CoinGecko API**: $0 (free tier: 10-50 calls/min)
- **Redis Cloud**: $0 (free tier)
- **Sentry**: $0 (free tier)
- **Cloudflare**: $0 (free tier)
- **CoinGecko**: $0 (free tier)
- **Tenderly**: $0 (free tier)
- **SendGrid**: $0 (free tier: 100 emails/day)
- **Total**: ~$0-50/month

### Production (Moderate Traffic)
- **Railway**: $50-200
- **Circle API**: Transaction-based
- **Alchemy**: $50-100
- **Redis Cloud**: $10-30
- **Sentry**: $26-80 (Team plan)
- **Cloudflare**: $0-20
- **Kafka (Confluent)**: $0-50 (free tier)
- **Total**: ~$150-500/month

---

## NOTES

1. **Custodial Wallet System**: Xmarket uses custodial wallets - users deposit to platform addresses, no wallet connection needed
2. **Multi-Stablecoin Support**: Support all major stablecoins (USDC, USDT, DAI, PYUSD) on multiple networks (Ethereum, Polygon, Base, Arbitrum, Optimism, Avalanche)
3. **Instant Withdrawals**: Automated withdrawal system - users can withdraw instantly without platform permission
4. **Unified Balance**: Users see one USD balance - all deposits converted to USD equivalent, withdrawals can be in any stablecoin
5. **TradingView Charts**: No external API needed - library is free, consumes your own data
6. **Real-time Data**: Use Redis pub/sub + WebSocket (built-in, no external API)
7. **Geofencing**: Required for compliance - use MaxMind or similar
8. **Monitoring**: Start with Sentry + Railway logs, add Prometheus/Grafana in Phase 2
9. **Oracle Resolution**: Only needed for Event Markets (Phase 2), not Sentiment Markets (MVP focus)

---

## RECOMMENDED STACK FOR MVP

```
Frontend:
- Next.js (Vercel or Railway)
- TradingView Lightweight Charts
- Tailwind CSS + shadcn/ui

Backend:
- Node.js/TypeScript (Fastify)
- PostgreSQL (Railway)
- Redis (Railway or Redis Cloud)

Payments & Wallets:
- Alchemy (Blockchain monitoring - deposit detection & withdrawals)
- CoinGecko API (Token prices for USD conversion)
- Custodial wallet system (platform-managed, no wallet connection needed)

Infrastructure:
- Railway (Hosting)
- Cloudflare (CDN/DNS)
- GitHub Actions (CI/CD)

Monitoring:
- Sentry (Errors)
- Railway Logs (Application logs)
```

---

**Last Updated**: 2024
**Version**: 1.0

