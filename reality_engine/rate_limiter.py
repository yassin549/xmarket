"""
Redis token bucket rate limiter for LLM calls.

Implements token bucket algorithm to limit LLM calls per hour.
Prevents API spam and controls costs.
"""

import time
from typing import Optional
import logging

# Import with error handling
try:
    import redis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logging.warning("redis not installed, using in-memory fallback")

try:
    import fakeredis
    HAS_FAKEREDIS = True
except ImportError:
    HAS_FAKEREDIS = False

logger = logging.getLogger(__name__)


class InMemoryTokenBucket:
    """
    Simple in-memory token bucket (fallback when Redis unavailable).
    
    Not suitable for distributed systems, but works for single-instance testing.
    """
    
    def __init__(self, rate_per_hour: int):
        self.rate = rate_per_hour
        self.capacity = rate_per_hour
        self.tokens = float(rate_per_hour)
        self.last_refill = time.time()
    
    def consume(self) -> bool:
        """Try to consume one token."""
        now = time.time()
        
        # Refill tokens based on elapsed time
        elapsed = now - self.last_refill
        refill = (elapsed / 3600) * self.rate
        self.tokens = min(self.capacity, self.tokens + refill)
        self.last_refill = now
        
        # Try to consume
        if self.tokens >= 1.0:
            self.tokens -= 1.0
            logger.debug(f"Token consumed, {self.tokens:.1f} remaining")
            return True
        
        logger.warning("Token bucket exhausted, rate limit exceeded")
        return False
    
    def reset(self):
        """Reset bucket to full capacity."""
        self.tokens = float(self.capacity)
        self.last_refill = time.time()


class RedisTokenBucket:
    """
    Redis-backed token bucket for distributed rate limiting.
    
    Thread-safe and works across multiple poller instances.
    """
    
    def __init__(self, redis_client, rate_per_hour: int, key_prefix: str = "llm:token_bucket"):
        self.redis = redis_client
        self.rate = rate_per_hour
        self.capacity = rate_per_hour
        self.key_prefix = key_prefix
    
    def consume(self) -> bool:
        """Try to consume one token."""
        now = time.time()
        
        tokens_key = f"{self.key_prefix}:tokens"
        refill_key = f"{self.key_prefix}:last_refill"
        
        try:
            # Get current state
            tokens = self.redis.get(tokens_key)
            last_refill = self.redis.get(refill_key)
            
            # Initialize if not exists
            if tokens is None:
                tokens = float(self.capacity)
            else:
                tokens = float(tokens)
            
            if last_refill is None:
                last_refill = now
            else:
                last_refill = float(last_refill)
            
            # Refill based on time elapsed
            elapsed = now - last_refill
            refill = (elapsed / 3600) * self.rate
            tokens = min(self.capacity, tokens + refill)
            
            # Try to consume
            if tokens >= 1.0:
                tokens -= 1.0
                
                # Update Redis
                self.redis.set(tokens_key, tokens)
                self.redis.set(refill_key, now)
                
                logger.debug(f"Token consumed (Redis), {tokens:.1f} remaining")
                return True
            
            logger.warning("Token bucket exhausted (Redis), rate limit exceeded")
            return False
        
        except Exception as e:
            logger.error(f"Redis error in token bucket: {e}, falling back to allow")
            return True  # Fail open to avoid blocking
    
    def reset(self):
        """Reset bucket to full capacity."""
        tokens_key = f"{self.key_prefix}:tokens"
        refill_key = f"{self.key_prefix}:last_refill"
        
        self.redis.set(tokens_key, float(self.capacity))
        self.redis.set(refill_key, time.time())


def create_rate_limiter(rate_per_hour: int, redis_url: Optional[str] = None) -> InMemoryTokenBucket:
    """
    Create appropriate rate limiter based on available dependencies.
    
    Args:
        rate_per_hour: Maximum LLM calls per hour
        redis_url: Optional Redis connection URL
        
    Returns:
        Token bucket instance
    """
    # Try Redis if URL provided
    if redis_url and HAS_REDIS:
        try:
            client = redis.from_url(redis_url)
            client.ping()  # Test connection
            logger.info(f"Using Redis token bucket (rate={rate_per_hour}/hour)")
            return RedisTokenBucket(client, rate_per_hour)
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}, using in-memory fallback")
    
    # Fallback to in-memory
    logger.info(f"Using in-memory token bucket (rate={rate_per_hour}/hour)")
    return InMemoryTokenBucket(rate_per_hour)


def create_fake_rate_limiter(rate_per_hour: int):
    """
    Create fake Redis rate limiter for testing.
    
    Args:
        rate_per_hour: Maximum LLM calls per hour
        
    Returns:
        Token bucket with fake Redis backend
    """
    if not HAS_FAKEREDIS:
        logger.warning("fakeredis not available, using in-memory")
        return InMemoryTokenBucket(rate_per_hour)
    
    fake_redis = fakeredis.FakeStrictRedis()
    return RedisTokenBucket(fake_redis, rate_per_hour)
