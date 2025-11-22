"""
Everything Market - Core Constants
===================================

Single source of truth for all system constants as defined in the master plan.
These constants are used across all services: reality-engine, backend, orderbook, and frontend.

All values are based on the canonical master plan (Section 3).
"""

# ============================================================================
# Similarity Thresholds (for FAISS vector deduplication and grouping)
# ============================================================================

SIMILARITY_DUPLICATE: float = 0.88
"""
Similarity threshold for duplicate detection.
If two articles have cosine similarity > SIMILARITY_DUPLICATE, the second is dropped as duplicate.
Range: [0, 1] where 1 is identical.
"""

SIMILARITY_GROUP: float = 0.78
"""
Similarity threshold for grouping related articles for LLM analysis.
Articles with similarity > SIMILARITY_GROUP are clustered together.
Range: [0, 1] where 1 is identical.
"""

# ============================================================================
# LLM Configuration
# ============================================================================

LLM_QUICK_THRESHOLD: float = 0.45
"""
Minimum absolute quick_score value to trigger LLM analysis.
If |quick_score| >= LLM_QUICK_THRESHOLD, the event group is sent to the LLM.
Range: [0, 1]
"""

LLM_CALLS_PER_HOUR: int = 10
"""
Maximum number of LLM calls allowed per hour (rate limit).
Enforced via Redis token-bucket to prevent overuse and control costs.
"""

# ============================================================================
# Time Windows (in seconds)
# ============================================================================

VECTOR_WINDOW_SECONDS: int = 6 * 3600
"""
Time window for vector similarity comparisons (6 hours).
Embeddings older than this are evicted from FAISS index and cache.
"""

TAU_SECONDS: int = 48 * 3600
"""
Time decay constant for event aging (48 hours).
Used in exponential decay formula: exp(-age_seconds/TAU_SECONDS)
Events decay to ~37% impact after 48 hours.
"""

# ============================================================================
# Score Limits and Deltas
# ============================================================================

DELTA_CAP: int = 20
"""
Maximum absolute impact points any single event can have on a reality score.
Prevents single events from causing extreme score swings.
Range: typically ±20 points on a 0-100 scale.
"""

SUSPICIOUS_DELTA: int = 15
"""
Threshold for flagging suspicious score changes requiring manual review.
If |delta| > SUSPICIOUS_DELTA, event creates an llm_audit entry (approved=false)
and does NOT automatically update scores until admin approval.
"""

# ============================================================================
# Aggregation Parameters
# ============================================================================

EWMA_ALPHA: float = 0.25
"""
Exponentially Weighted Moving Average (EWMA) smoothing factor.
Used for smoothing score updates over time.
Range: [0, 1] where higher values give more weight to recent observations.
"""

MIN_INDEP_SOURCES: int = 2
"""
Minimum number of independent sources required to trigger LLM analysis.
Even if quick_score is low, events with >= MIN_INDEP_SOURCES are sent to LLM
for verification (helps detect coordinated narratives).
"""

# ============================================================================
# Scraping and User Agent
# ============================================================================

USER_AGENT: str = "EverythingMarketBot/0.1 (+mailto:ops@yourdomain.com)"
"""
User-Agent string for polite web scraping.
Used in all HTTP requests to news sources. Identifies the bot and provides
contact information for site administrators.
Replace ops@yourdomain.com with your actual contact email.
"""
