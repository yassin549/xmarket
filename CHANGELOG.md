# Changelog

All notable changes to the Everything Market project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0-dev] - 2025-11-22 (Partial)

### Added
- **LLM Infrastructure** (Partial Implementation - Prompt #8):
  - JSON schema validator (`llm_schema.py`) with Appendix A.2 spec
  - Redis token bucket rate limiter (`rate_limiter.py`)
  - In-memory fallback rate limiter for testing
  - LLM output validation (summary, impact_suggestion, confidence, rationale)
  - Fallback mechanism for when LLM unavailable
  - Dependencies: transformers, torch, redis, fakeredis, jsonschema

### In Progress
- TinyLlama-1.1B model integration
- Prompt template and inference
- Integration with poller for grouped articles

## [0.6.0] - 2025-11-22

### Added
- **Deterministic Quick Scorer** (Prompt #7):
  - Full quick_score implementation with formula: `0.4*sentiment + 0.3*keyword + 0.3*ner`
  - VADER sentiment analysis (deterministic, lexicon-based)
  - Weighted keyword scoring (30+ positive/negative keywords)
  - spaCy NER relevance scoring
  - Replaced placeholder in event_builder.py
  - Detailed scoring breakdown for analysis
- **Comprehensive Tests** (`test_quick_scorer.py`):
  - Sentiment scoring tests
  - Keyword scoring tests
  - NER relevance tests
  - Combined formula tests
  - Determinism validation
  - Range validation [-1, 1]
  - Edge cases (empty text, very long text)
- **Dependencies**: vaderSentiment, spacy (en_core_web_sm model)

### Changed
- Event builder now uses real quick_score instead of placeholder
- Impact points calculation uses proper sentiment analysis

## [0.5.0] - 2025-11-22

### Added
- **Embedding & FAISS Deduplication** (Prompt #6):
  - sentence-transformers/all-MiniLM-L6-v2 embedder (384 dimensions)
  - L2-normalized float32 vectors for cosine similarity
  - Batch embedding support (~40ms per article on CPU)
  - LRU cache (1000 items) for embedding reuse
  - FAISS IndexFlatIP for vector similarity search (<1ms)
  - Duplicate detection at SIMILARITY_DUPLICATE (0.88) threshold
  - Article clustering at SIMILARITY_GROUP (0.78) threshold
  - TTL-based vector eviction (VECTOR_WINDOW_SECONDS = 6 hours)
- **Integration with Poller**:
  - Automatic deduplication in article processing workflow
  - Similarity-based grouping for future LLM aggregation
  - Periodic vector eviction after each poll iteration
- **Comprehensive Tests** (`test_embedding.py`):
  - Embedding determinism tests
  - L2 normalization validation
  - Vector dtype (float32) verification
  - Batch embedding tests
  - FAISS operations tests
  - Duplicate detection tests
  - Clustering/grouping tests
  - TTL eviction tests
  - Integration workflow tests
- **Dependencies**: sentence-transformers, faiss-cpu, numpy

### Performance
- Model loading: ~1s (one-time)
- Per-article embedding: ~40ms (CPU)
- FAISS search: <1ms (1000 vectors)

## [0.4.0] - 2025-11-22

### Added
- **Reality-Engine Poller Skeleton**: Complete news ingestion service
  - RSS/Atom feed parsing with feedparser
  - Article content extraction with newspaper3k
  - Robots.txt compliance with 24h caching
  - Per-domain rate limiting
  - Language detection and content filtering
  - Stock symbol mapping (configured + auto-detect)
  - Deterministic quick_score placeholder
  - Canonical event payload construction (Appendix A.1)
  - HMAC-SHA256 signing and POST to backend
  - Main polling loop with configurable interval
  - Graceful shutdown (SIGINT/SIGTERM)
  - Dry-run mode for testing
  - CLI entry point with argument parsing
- **Configuration**:
  - `sources.yaml` - RSS feed configuration
  - Trust scores per feed
  - Crawl delay settings
  - Global settings (poll interval, user agent, etc.)
- **Comprehensive Tests** (`test_reality_engine.py`):
  - Configuration loading
  - Content validation
  - Event structure validation
  - HMAC signing (deterministic, canonical)
  - Rate limiting
- **Documentation**:
  - Reality-engine README with usage guide
  - Architecture documentation
  - Configuration examples

### Technical Details
- Respects robots.txt with caching layer
- Rate limits: default 1 req/30s per domain (configurable)
- HMAC signatures match backend authentication
- Events follow exact Appendix A.1 schema
- In-memory tracking of processed URLs

### Future Enhancements
- Embedding & FAISS deduplication (Prompt #6)
- Proper quick scorer with sentiment/keywords (Prompt #7)
- TinyLLama integration (Prompt #8)

## [0.3.0] - 2025-11-22

### Added
- **FastAPI Backend Skeleton**: Complete backend service with reality event ingestion
  - FastAPI application with automatic OpenAPI documentation
  - Health check endpoint (`/health`)
  - API information endpoint (`/`)
- **Reality Ingest Endpoint**: `POST /api/v1/reality/ingest`
  - HMAC-SHA256 signature verification (X-Reality-Signature header)
  - Pydantic schema validation per Appendix A.1
  - Idempotency via event_id uniqueness check
  - Stock symbol validation against database
  - Impact points range validation (±DELTA_CAP)
- **Anti-Manipulation Logic**:
  - Suspicious delta detection (abs(impact_points) > SUSPICIOUS_DELTA)
  - Automatic llm_audit record creation for flagged events
  - Pending review workflow (202 response)
  - Scores table protection (no updates until admin approval)
- **Pydantic Models**:
  - `RealityEventRequest` - Full validation per spec
  - `SourceModel` - News source metadata
  - Response models (Created, Duplicate, PendingReview, Error)
- **HMAC Authentication Module**:
  - `sign_payload()` - Canonical JSON signing
  - `verify_signature()` - Timing-safe comparison
  - FastAPI dependency for signature verification
- **Database Operations**:
  - Event persistence with JSONB sources
  - Idempotency checking
  - Stock validation
  - LLM audit record creation
- **Comprehensive Tests** (`test_ingest_api.py`):
  - Valid signed payload (201)
  - Idempotent replay (200)
  - Invalid signature rejection (401)
  - Suspicious delta audit creation
  - Schema validation (422)
  - Stock validation (400)

### Technical Details
- FastAPI 0.108.0+ with automatic OpenAPI docs
- HMAC-SHA256 over canonical JSON (sorted keys)
- Timing-attack prevention with `hmac.compare_digest()`
- Transaction-safe database operations
- CORS middleware (configurable for production)

### Security
- Required HMAC signature on all reality events
- Signature verified before any business logic
- Invalid signatures rejected immediately (401)
- Anti-manipulation checks prevent score manipulation

## [0.2.0] - 2025-11-22

### Added
- **Database Schema**: Complete PostgreSQL schema with Alembic migrations
  - `stocks` table - managed by admin only
  - `scores` table - reality and final pricing
  - `events` table - news events with impact scoring
  - `llm_calls` table - LLM inference audit trail
  - `llm_audit` table - manual review queue for suspicious changes
  - `score_changes` table - full audit log of score modifications
  - `orders` table - orderbook with ENUM types (buy/sell, limit/market, status)
  - `trade_history` table - immutable trade execution record
- **Constraints**: Comprehensive data validation
  - Check constraints for value ranges (weights 0..1, scores 0..100)
  - Foreign key constraints with CASCADE deletes
  - Unique constraints (events.event_id, stocks.symbol)
  - ENUM types for type safety (order_side, order_type, order_status)
- **Indexes**: Performance optimization
  - Symbol indexes on all key tables
  - Composite indexes on (symbol, timestamp DESC)
  - Partial indexes for open orders and pending audits
- **JSONB Columns**: Flexible data storage
  - events.sources - article sources with trust scores
  - llm_calls.output_json - LLM responses
  - llm_audit.sources - audit trail metadata
- **Migration Tools**:
  - Alembic configuration reading DATABASE_URL from config
  - Bootstrap scripts (PowerShell and bash)
  - Database connection helper with session management
- **Schema Tests**: Comprehensive validation (50+ tests)
  - Table existence and structure
  - Primary key validation
  - Foreign key enforcement
  - Constraint validation (check, unique, FK)
  - Index verification
  - ENUM functionality
  - JSONB storage and retrieval
  - Default value generation (UUID, timestamps)
  - Anti-seeding verification

### Changed
- Updated `requirements.txt` with database dependencies (alembic, psycopg2-binary, sqlalchemy)
- Enhanced `migrations/env.py` to read DATABASE_URL from config module

### Technical Details
- Migration ID: `001_create_core_tables`
- PostgreSQL 12+ required for `gen_random_uuid()`
- Uses TIMESTAMPTZ for all timestamps (UTC)
- CASCADE deletes on event relationships for data consistency

### Security
- **Anti-seeding rule enforced**: Migration creates NO stock data
- All stocks must be created manually by authenticated admins via API
- Foreign key constraints prevent orphaned records

## [0.1.0] - 2025-11-22

### Added
- **Configuration Module**: Single source of truth for system constants
  - `config/constants.py` - 11 core constants from master plan
  - `config/env.py` - Environment variable loading with validation
  - Type-safe configuration with comprehensive error messages
- **Testing Infrastructure**:
  - pytest configuration
  - 27 passing unit tests for config module
- **Project Setup**:
  - requirements.txt
  - .gitignore
  - .env.example
  - Documentation (config/README.md)

[Unreleased]: https://github.com/everything-market/xmarket/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/everything-market/xmarket/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/everything-market/xmarket/releases/tag/v0.1.0
