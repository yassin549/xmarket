# Configuration Module

Single source of truth for all system constants and environment variables for the Everything Market platform.

## Overview

This module provides:
- **Constants**: Fixed system parameters (similarity thresholds, time windows, rate limits, etc.)
- **Environment variables**: Runtime configuration (database URLs, API keys, etc.)
- **Validation**: Type-safe loading and validation of configuration

## Usage

### Importing Constants

```python
# Import the constants module
from config import constants

# Access constants
print(constants.SIMILARITY_DUPLICATE)  # 0.88
print(constants.LLM_QUICK_THRESHOLD)   # 0.45
print(constants.USER_AGENT)            # "EverythingMarketBot/0.1 ..."

# Or import specific constants
from config.constants import SIMILARITY_DUPLICATE, DELTA_CAP
```

### Loading Environment Variables

```python
# Using the Config class (recommended)
from config import Config

config = Config()
config.validate()  # Raises ConfigurationError if invalid

print(config.database_url)
print(config.redis_url)
print(config.poll_interval)

# Or using individual getters
from config.env import get_database_url, get_poll_interval

db_url = get_database_url()           # Required
poll_interval = get_poll_interval()   # Optional with default
```

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection URL
- `REDIS_URL`: Redis connection URL
- `REALITY_API_SECRET`: HMAC secret for reality-engine authentication
- `ADMIN_API_KEY`: Admin API key for protected endpoints

### Optional (with defaults)

- `POLL_INTERVAL`: Polling interval in seconds (default: 300)
- `LLM_MODE`: LLM mode ("tinyLLama", "skipped", "disabled") (default: "tinyLLama")
- `LLM_CALLS_PER_HOUR`: Rate limit for LLM calls (default: 10)

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your actual values
3. Never commit `.env` to version control

```bash
cp .env.example .env
# Edit .env with your values
```

## Constants Reference

### Similarity Thresholds
- `SIMILARITY_DUPLICATE = 0.88`: Duplicate detection threshold
- `SIMILARITY_GROUP = 0.78`: Event grouping threshold

### LLM Configuration
- `LLM_QUICK_THRESHOLD = 0.45`: Minimum score to trigger LLM analysis
- `LLM_CALLS_PER_HOUR = 10`: Rate limit for LLM calls

### Time Windows
- `VECTOR_WINDOW_SECONDS = 21600`: Vector similarity window (6 hours)
- `TAU_SECONDS = 172800`: Event decay constant (48 hours)

### Score Limits
- `DELTA_CAP = 20`: Maximum impact points per event
- `SUSPICIOUS_DELTA = 15`: Threshold for manual review

### Aggregation
- `EWMA_ALPHA = 0.25`: EWMA smoothing factor
- `MIN_INDEP_SOURCES = 2`: Minimum independent sources for LLM analysis

### Scraping
- `USER_AGENT`: User agent string for web scraping

## Security

⚠️ **Never commit secrets!**
- Use `.env` for local development
- Use Railway/cloud environment variables for production
- Never log sensitive values
