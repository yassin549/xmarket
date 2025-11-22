# Reality-Engine Poller

News ingestion service for Everything Market that fetches RSS feeds, processes articles, and posts events to the backend.

## Overview

The reality-engine poller:
- Fetches news from RSS/Atom feeds
- Extracts article content with newspaper3k
- Normalizes and filters content (language, length, stock mentions)
- Builds canonical event payloads
- Signs events with HMAC-SHA256
- POSTs to backend `/api/v1/reality/ingest` endpoint

## Features

✅ **RSS Feed Support** - Parses RSS/Atom feeds with feedparser  
✅ **Smart Content Extraction** - Uses newspaper3k for article text  
✅ **Robots.txt Compliance** - Respects robots.txt rules and crawl delays  
✅ **Rate Limiting** - Per-domain throttling (configurable)  
✅ **Language Detection** - Filters to English articles  
✅ **Stock Mapping** - Maps articles to stock symbols  
✅ **HMAC Authentication** - Signs all events with REALITY_API_SECRET  
✅ **Dry-run Mode** - Test without actually POSTing  
✅ **Graceful Shutdown** - Handles SIGINT/SIGTERM cleanly

## Quick Start

### 1. Configure Sources

Edit `reality_engine/sources.yaml` to add RSS feeds:

```yaml
feeds:
  - name: "TechCrunch"
    url: "https://techcrunch.com/feed/"
    stocks: ["TECH"]
    trust: 0.85
    crawl_delay: 30
```

### 2. Set Environment Variables

```bash
export REALITY_API_SECRET="your-secret-key"
```

### 3. Run Poller

```bash
# Dry run (no actual POSTs)
python reality_engine/run.py --dry-run

# Connect to backend
python reality_engine/run.py --backend-url http://localhost:8000

# Verbose logging
python reality_engine/run.py --backend-url http://localhost:8000 --verbose
```

## Architecture

```
reality_engine/
├── config.py          # Load sources.yaml
├── fetcher.py         # RSS + HTML fetching
├── normalizer.py      # Content filtering & validation
├── robots.py          # Robots.txt compliance & rate limiting
├── event_builder.py   # Build canonical events
├── poster.py          # HMAC signing & HTTP POST
├── poller.py          # Main polling loop
├── run.py             # CLI entry point
└── sources.yaml       # Feed configuration
```

## Configuration

### sources.yaml Format

```yaml
feeds:
  - name: "Feed Name"
    url: "https://example.com/feed.rss"
    stocks: ["SYMBOL1", "SYMBOL2"]  # Or [] for auto-detect
    trust: 0.85  # 0.0 to 1.0
    crawl_delay: 30  # Seconds between requests

settings:
  poll_interval: 300  # Poll every 5 minutes
  min_content_length: 200
  user_agent: "EverythingMarketBot/0.1"
  default_crawl_delay: 30
  max_articles_per_feed: 10
```

## How It Works

1. **Poll RSS Feeds** - Fetches feed entries on interval
2. **Check Robots.txt** - Validates URL is allowed
3. **Rate Limit** - Waits if needed per domain
4. **Fetch Article** - Extracts content with newspaper3k
5. **Normalize** - Validates language, length, stocks
6. **Build Event** - Creates canonical payload
7. **Sign** - HMAC-SHA256 signature
8. **POST** - Sends to backend `/api/v1/reality/ingest`

## Event Format

Events follow Appendix A.1 spec:

```json
{
  "event_id": "uuid",
  "timestamp": "2025-11-22T16:00:00Z",
  "stocks": ["TECH"],
  "quick_score": 0.5,
  "impact_points": 4.25,
  "summary": "Article title",
  "sources": [
    {"id": "src-id", "url": "https://...", "trust": 0.85}
  ],
  "num_independent_sources": 1,
  "llm_mode": "skipped",
  "meta": {"title": "...", "feed": "..."}
}
```

## Testing

```bash
# Run unit tests
pytest tests/test_reality_engine.py -v

# Test configuration
pytest tests/test_reality_engine.py::TestConfiguration -v

# Test HMAC signing
pytest tests/test_reality_engine.py::TestHMACSignature -v
```

## Future Enhancements

This skeleton will be enhanced with:
- **Prompt #6**: Embedding & FAISS deduplication
- **Prompt #7**: Proper quick scorer (sentiment + keywords)
- **Prompt #8**: TinyLLama integration for summaries

## Troubleshooting

**No events posted:**
- Check REALITY_API_SECRET is set
- Verify backend is running
- Check logs for filtering reasons

**Rate limiting issues:**
- Increase `crawl_delay` in sources.yaml
- Check robots.txt compliance

**Content extraction fails:**
- Some sites block scrapers
- Try different feeds
- Check user_agent string
