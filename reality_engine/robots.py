"""
Robots.txt compliance and rate limiting for reality-engine.

Implements ethical scraping practices:
- Respects robots.txt rules
- Enforces per-domain crawl delays
- Caches robots.txt files for 24 hours
"""

import time
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse
from typing import Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class RobotsChecker:
    """
    Checks robots.txt compliance for URLs.
    
    Caches robots.txt files per domain for 24 hours.
    """
    
    def __init__(self, cache_duration: int = 86400):
        """
        Initialize robots checker.
        
        Args:
            cache_duration: How long to cache robots.txt in seconds (default 24h)
        """
        self.cache: Dict[str, Tuple[RobotFileParser, float]] = {}
        self.cache_duration = cache_duration
    
    def can_fetch(self, url: str, user_agent: str) -> bool:
        """
        Check if URL can be fetched according to robots.txt.
        
        Args:
            url: URL to check
            user_agent: User agent string
            
        Returns:
            True if allowed, False otherwise
        """
        try:
            domain = urlparse(url).netloc
            parser = self._get_parser(domain)
            
            if parser is None:
                # If robots.txt fetch failed, be conservative and allow
                logger.warning(f"Could not fetch robots.txt for {domain}, allowing by default")
                return True
            
            can_fetch = parser.can_fetch(user_agent, url)
            logger.debug(f"robots.txt check for {url}: {'allowed' if can_fetch else 'disallowed'}")
            return can_fetch
        
        except Exception as e:
            logger.error(f"Error checking robots.txt for {url}: {e}")
            return True  # Allow on error (be permissive)
    
    def get_crawl_delay(self, url: str, user_agent: str) -> float:
        """
        Get crawl delay for domain from robots.txt.
        
        Args:
            url: URL to check
            user_agent: User agent string
            
        Returns:
            Crawl delay in seconds, or default (30) if not specified
        """
        try:
            domain = urlparse(url).netloc
            parser = self._get_parser(domain)
            
            if parser is None:
                return 30.0  # Default
            
            delay = parser.crawl_delay(user_agent)
            return float(delay) if delay is not None else 30.0
        
        except Exception as e:
            logger.error(f"Error getting crawl delay for {url}: {e}")
            return 30.0
    
    def _get_parser(self, domain: str) -> Optional[RobotFileParser]:
        """
        Get robots.txt parser for domain, using cache if available.
        
        Args:
            domain: Domain name
            
        Returns:
            RobotFileParser instance or None if fetch failed
        """
        # Check cache
        if domain in self.cache:
            parser, timestamp = self.cache[domain]
            if time.time() - timestamp < self.cache_duration:
                return parser
            else:
                # Cache expired
                logger.debug(f"robots.txt cache expired for {domain}")
        
        # Fetch fresh robots.txt
        try:
            parser = RobotFileParser()
            robots_url = f"https://{domain}/robots.txt"
            parser.set_url(robots_url)
            parser.read()
            
            # Cache it
            self.cache[domain] = (parser, time.time())
            logger.info(f"Fetched and cached robots.txt for {domain}")
            return parser
        
        except Exception as e:
            logger.warning(f"Failed to fetch robots.txt for {domain}: {e}")
            return None


class RateLimiter:
    """
    Enforces per-domain rate limiting.
    
    Tracks last request time per domain and enforces minimum delay.
    """
    
    def __init__(self):
        """Initialize rate limiter."""
        self.last_request_time: Dict[str, float] = {}
    
    def wait_if_needed(self, url: str, crawl_delay: float) -> None:
        """
        Wait if needed to respect crawl delay for domain.
        
        Args:
            url: URL being fetched
            crawl_delay: Minimum seconds between requests
        """
        domain = urlparse(url).netloc
        
        if domain in self.last_request_time:
            elapsed = time.time() - self.last_request_time[domain]
            
            if elapsed < crawl_delay:
                wait_time = crawl_delay - elapsed
                logger.debug(f"Rate limiting {domain}: waiting {wait_time:.1f}s")
                time.sleep(wait_time)
        
        self.last_request_time[domain] = time.time()
    
    def reset_domain(self, url: str) -> None:
        """
        Reset rate limit tracking for a domain.
        
        Args:
            url: URL whose domain to reset
        """
        domain = urlparse(url).netloc
        if domain in self.last_request_time:
            del self.last_request_time[domain]
