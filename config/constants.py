"""
Canonical constants for Everything Market platform.
Single source of truth for all thresholds and configuration values.
"""

# Similarity thresholds for vector deduplication and grouping
SIMILARITY_DUPLICATE = 0.88  # Cosine similarity threshold to treat articles as duplicates
SIMILARITY_GROUP = 0.78      # Threshold to group related articles for LLM analysis

# LLM triggering and rate limiting
LLM_QUICK_THRESHOLD = 0.45   # Minimum |quick_score| to trigger LLM analysis
LLM_CALLS_PER_HOUR = 10      # Rate limit for LLM API calls
MIN_INDEP_SOURCES = 2        # Minimum independent sources to trigger LLM

# Vector index and event decay
VECTOR_WINDOW_SECONDS = 6 * 3600    # 6 hours - FAISS index TTL
TAU_SECONDS = 48 * 3600             # 48 hours - event decay time constant

# Impact scoring limits
DELTA_CAP = 20               # Maximum absolute impact points per event (±20)
SUSPICIOUS_DELTA = 15        # Threshold for flagging events for admin review

# Price blending (EWMA smoothing)
EWMA_ALPHA = 0.25           # Exponential moving average alpha for smooth transitions

# Default market/reality weights (can be overridden per stock in DB)
DEFAULT_MARKET_WEIGHT = 0.6
DEFAULT_REALITY_WEIGHT = 0.4

# Scraping and crawling
DEFAULT_POLL_INTERVAL = 300  # 5 minutes between scraping cycles
DEFAULT_CRAWL_DELAY = 1.0    # Default delay between requests (seconds)
MAX_RETRIES = 3              # Maximum retry attempts for failed requests
REQUEST_TIMEOUT = 30         # HTTP request timeout (seconds)

# Embedding model
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384          # Dimension of embedding vectors
EMBEDDING_BATCH_SIZE = 32    # Batch size for embedding operations

# Quick scorer weights (must sum to 1.0)
QUICK_SCORE_SENTIMENT_WEIGHT = 0.4
QUICK_SCORE_KEYWORD_WEIGHT = 0.3
QUICK_SCORE_NER_WEIGHT = 0.3

# Anti-manipulation
MAX_SINGLE_SOURCE_INFLUENCE_24H = 0.35  # Max 35% of total impact from one source in 24h
ROLLING_WINDOW_HOURS = 24                # Rolling window for source influence calculation

# Database
DEFAULT_DB_POOL_SIZE = 10
DEFAULT_DB_MAX_OVERFLOW = 20

# WebSocket
WS_HEARTBEAT_INTERVAL = 30   # Seconds between heartbeat pings
WS_RECONNECT_DELAY = 5       # Seconds to wait before reconnecting

# Orderbook
ORDER_BOOK_DEPTH = 10        # Number of price levels to show in order book
MAX_ORDER_SIZE = 10000       # Maximum order quantity
MIN_ORDER_SIZE = 0.01        # Minimum order quantity

# Price normalization (0-100 scale)
MIN_PRICE = 0.0
MAX_PRICE = 100.0
INITIAL_PRICE = 50.0         # Default starting price for new stocks

# Logging
LOG_LEVEL = "INFO"
LOG_FORMAT = "json"          # json or text
