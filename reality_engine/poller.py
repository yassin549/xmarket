"""
Main poller loop for reality-engine.

Polls RSS feeds on interval, processes articles, and posts events to backend.
"""

import time
import signal
import sys
from urllib.parse import urlparse
from typing import Set
import logging

from reality_engine.config import load_sources
from reality_engine.robots import RobotsChecker, RateLimiter
from reality_engine.fetcher import fetch_rss_feed, fetch_article_with_fallback
from reality_engine.normalizer import normalize_article
from reality_engine.event_builder import build_event
from reality_engine.poster import post_event_to_backend, get_reality_api_secret
from reality_engine.embedder import load_model, embed_text, text_hash
from reality_engine.vector_index import VectorIndex
from reality_engine.vector_index import VectorIndex
from reality_engine import llm_runner
from reality_engine.rate_limiter import create_rate_limiter
from config.constants import (
    SIMILARITY_DUPLICATE, 
    SIMILARITY_GROUP, 
    VECTOR_WINDOW_SECONDS,
    LLM_QUICK_THRESHOLD
)
from config.env import get_llm_mode, get_llm_calls_per_hour, get_redis_url

logger = logging.getLogger(__name__)


class Poller:
    """
    Main poller that fetches feeds and posts events to backend.
    
    Handles:
    - RSS feed polling on interval
    - Robots.txt compliance
    - Rate limiting
    - Article processing
    - Embedding & deduplication
    - Event posting
    - Graceful shutdown
    """
    
    def __init__(self, backend_url: str, dry_run: bool = False):
        """
        Initialize poller.
        
        Args:
            backend_url: Backend base URL
            dry_run: If True, don't actually POST events
        """
        self.backend_url = backend_url
        self.dry_run = dry_run
        self.running = True
        
        # Initialize components
        self.robots_checker = RobotsChecker()
        self.rate_limiter = RateLimiter()
        
        # Track processed URLs to avoid duplicates (simple in-memory cache)
        self.processed_urls: Set[str] = set()
        
        # Initialize rate limiter for LLM
        self.llm_mode = get_llm_mode()
        self.llm_rate_limiter = create_rate_limiter(
            get_llm_calls_per_hour(),
            get_redis_url()
        )
        
        # Initialize embedding model and vector index
        try:
            logger.info("Loading embedding model...")
            self.embedding_model = load_model()
            self.vector_index = VectorIndex()
            self.enable_deduplication = True
            logger.info("Embedding and deduplication enabled")
        except Exception as e:
            logger.warning(f"Could not load embedding model: {e}")
            logger.warning("Deduplication will be disabled")
            self.embedding_model = None
            self.vector_index = None
            self.enable_deduplication = False
        
        # Get secret (validate it exists)
        try:
            self.secret = get_reality_api_secret()
        except ValueError as e:
            if dry_run:
                logger.warning("REALITY_API_SECRET not set, but using dry-run mode")
                self.secret = "dry-run-secret"
            else:
                raise e
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self.shutdown)
        signal.signal(signal.SIGTERM, self.shutdown)
    
    def shutdown(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info("Received shutdown signal, stopping poller...")
        self.running = False
    
    def run(self):
        """
        Main poller loop.
        
        Polls feeds on interval and processes articles.
        """
        config = load_sources()
        feeds = config['feeds']
        settings = config['settings']
        poll_interval = settings['poll_interval']
        
        logger.info(f"Starting poller with {len(feeds)} feeds, interval={poll_interval}s")
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Dry run: {self.dry_run}")
        logger.info(f"Deduplication: {'enabled' if self.enable_deduplication else 'disabled'}")
        
        iteration = 0
        
        while self.running:
            iteration += 1
            logger.info(f"\n{'='*60}")
            logger.info(f"Poll iteration #{iteration}")
            logger.info(f"{'='*60}")
            
            for feed_config in feeds:
                if not self.running:
                    break
                
                self.process_feed(feed_config, settings)
            
            # Evict old vectors after each iteration
            if self.enable_deduplication and self.vector_index:
                evicted = self.vector_index.evict_old_vectors(VECTOR_WINDOW_SECONDS)
                if evicted > 0:
                    logger.info(f"Evicted {evicted} old vectors (older than {VECTOR_WINDOW_SECONDS/3600:.1f}h)")
            
            if self.running:
                logger.info(f"\nSleeping for {poll_interval} seconds...")
                time.sleep(poll_interval)
        
        logger.info("Poller stopped")
    
    def process_feed(self, feed_config: dict, settings: dict):
        """
        Process a single RSS feed.
        
        Args:
            feed_config: Feed configuration
            settings: Global settings
        """
        feed_name = feed_config['name']
        feed_url = feed_config['url']
        max_articles = settings.get('max_articles_per_feed', 10)
        user_agent = settings['user_agent']
        
        logger.info(f"\nProcessing feed: {feed_name}")
        logger.info(f"URL: {feed_url}")
        
        # Fetch RSS feed
        entries = fetch_rss_feed(feed_url, max_entries=max_articles)
        
        if not entries:
            logger.warning(f"No entries found in feed: {feed_name}")
            return
        
        logger.info(f"Found {len(entries)} entries in feed")
        
        # Process each entry
        processed_count = 0
        skipped_count = 0
        
        for entry in entries:
            if not self.running:
                break
            
            article_url = entry.get('link')
            if not article_url:
                continue
            
            # Skip if already processed
            if article_url in self.processed_urls:
                logger.debug(f"Skipping already processed: {article_url}")
                skipped_count += 1
                continue
            
            # Process article
            success = self.process_article(article_url, feed_config, settings)
            
            if success:
                processed_count += 1
                self.processed_urls.add(article_url)
            else:
                skipped_count += 1
        
        logger.info(f"Feed {feed_name}: processed={processed_count}, skipped={skipped_count}")
    
    def process_article(self, url: str, feed_config: dict, settings: dict) -> bool:
        """
        Process a single article.
        
        Args:
            url: Article URL
            feed_config: Feed configuration
            settings: Global settings
            
        Returns:
            True if processed successfully, False otherwise
        """
        user_agent = settings['user_agent']
        
        try:
            # 1. Check robots.txt
            if not self.robots_checker.can_fetch(url, user_agent):
                logger.info(f"Skipping (robots.txt disallows): {url}")
                return False
            
            # 2. Rate limiting
            crawl_delay = feed_config.get('crawl_delay', settings['default_crawl_delay'])
            self.rate_limiter.wait_if_needed(url, crawl_delay)
            
            # 3. Fetch article
            article_data = fetch_article_with_fallback(url, user_agent)
            if not article_data:
                logger.warning(f"Failed to fetch article: {url}")
                return False
            
            # 4. Normalize content
            normalized = normalize_article(article_data, feed_config, settings)
            if not normalized:
                logger.debug(f"Article filtered out during normalization: {url}")
                return False
            
            # 5. Embedding & deduplication
            embedding = None
            if self.enable_deduplication and self.embedding_model and self.vector_index:
                try:
                    # Embed article text
                    article_text = normalized['text']
                    embedding = embed_text(article_text, self.embedding_model)
                    
                    # Check for duplicates (similarity > SIMILARITY_DUPLICATE)
                    if self.vector_index.check_duplicate(embedding, SIMILARITY_DUPLICATE):
                        logger.info(f"⊗ Duplicate article detected (sim > {SIMILARITY_DUPLICATE}): {url}")
                        return False  # Skip duplicate
                    
                    # Find similar articles for grouping (similarity > SIMILARITY_GROUP)
                    similar = self.vector_index.find_groups(embedding, SIMILARITY_GROUP)
                    if similar:
                        logger.info(f"⊕ Found {len(similar)} similar articles (sim > {SIMILARITY_GROUP}) for potential grouping")
                        # Future: Aggregate with LLM (Prompt #8)
                    
                except Exception as e:
                    logger.error(f"Error in embedding/deduplication: {e}")
                    # Continue processing even if embedding fails
                    embedding = None
            
            # 6. Build event
            event = build_event(normalized, feed_config)
            
            # 6.5 LLM Analysis (Prompt #8)
            # Check if we should run LLM based on thresholds
            should_run_llm = (
                self.llm_mode != "disabled" and 
                abs(event['quick_score']) >= LLM_QUICK_THRESHOLD
            )
            
            if should_run_llm:
                if self.llm_rate_limiter.consume():
                    logger.info(f"Triggering LLM analysis for event {event['event_id']} (score={event['quick_score']})")
                    
                    # Run LLM analysis
                    llm_result = llm_runner.analyze_impact(
                        [normalized], 
                        event['stocks'], 
                        event['quick_score']
                    )
                    
                    # Update event with LLM results
                    if llm_result:
                        event['summary'] = llm_result.get('summary', event['summary'])
                        event['llm_mode'] = 'tinyLLama'
                        
                        # Update impact points if provided and valid
                        if 'impact_suggestion' in llm_result:
                            # Clamp and round
                            impact = float(llm_result['impact_suggestion'])
                            impact = max(-20.0, min(20.0, impact))  # DELTA_CAP
                            event['impact_points'] = round(impact, 2)
                            
                        # Store full LLM output in meta for audit
                        event['meta']['llm_output'] = llm_result
                else:
                    logger.info(f"Skipping LLM for event {event['event_id']} (rate limit exceeded)")
                    event['llm_mode'] = 'skipped'
            
            # 7. Add to vector index (after duplicate check)
            if self.enable_deduplication and self.embedding_model and self.vector_index and embedding is not None:
                try:
                    article_text_hash = text_hash(normalized['text'])
                    self.vector_index.add_vector(embedding, event['event_id'], article_text_hash)
                except Exception as e:
                    logger.error(f"Error adding vector to index: {e}")
            
            # 8. Post to backend
            result = post_event_to_backend(
                event,
                self.backend_url,
                self.secret,
                dry_run=self.dry_run
            )
            
            # Success if 2xx status
            return 200 <= result['status_code'] < 300
        
        except Exception as e:
            logger.error(f"Error processing article {url}: {e}")
            return False
