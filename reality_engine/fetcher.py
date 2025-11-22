"""
Content fetching for reality-engine.

Supports:
- RSS/Atom feed parsing with feedparser
- HTML article extraction with newspaper3k
- (Future: Playwright fallback for JavaScript-heavy sites)
"""

import feedparser
from newspaper import Article
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def fetch_rss_feed(feed_url: str, max_entries: int = 10) -> List[Dict[str, Any]]:
    """
    Fetch and parse RSS/Atom feed.
    
    Args:
        feed_url: RSS feed URL
        max_entries: Maximum number of entries to return
        
    Returns:
        List of feed entry dicts with keys: title, link, published, summary
    """
    try:
        logger.info(f"Fetching RSS feed: {feed_url}")
        feed = feedparser.parse(feed_url)
        
        entries = []
        for entry in feed.entries[:max_entries]:
            entries.append({
                'title': entry.get('title', ''),
                'link': entry.get('link', ''),
                'published': entry.get('published', ''),
                'summary': entry.get('summary', ''),
                'id': entry.get('id', entry.get('link', ''))
            })
        
        logger.info(f"Fetched {len(entries)} entries from {feed_url}")
        return entries
    
    except Exception as e:
        logger.error(f"Error fetching RSS feed {feed_url}: {e}")
        return []


def fetch_article_content(url: str, user_agent: str) -> Optional[Dict[str, Any]]:
    """
    Fetch and extract article content from URL using newspaper3k.
    
    Args:
        url: Article URL
        user_agent: User agent string
        
    Returns:
        Dict with keys: title, text, authors, publish_date, url
        Returns None if extraction fails
    """
    try:
        logger.debug(f"Fetching article: {url}")
        
        # Configure newspaper3k
        article = Article(url)
        article.config.browser_user_agent = user_agent
        article.config.request_timeout = 10
        
        # Download and parse
        article.download()
        article.parse()
        
        # Extract data
        result = {
            'title': article.title or '',
            'text': article.text or '',
            'authors': article.authors or [],
            'publish_date': article.publish_date,
           'url': url,
            'top_image': article.top_image or None
        }
        
        # Validate we got actual content
        if not result['text'] or len(result['text']) < 100:
            logger.warning(f"Article {url} has insufficient text content")
            return None
        
        logger.info(f"Successfully extracted article: {url} ({len(result['text'])} chars)")
        return result
    
    except Exception as e:
        logger.error(f"Error fetching article {url}: {e}")
        return None


def fetch_article_with_fallback(url: str, user_agent: str) -> Optional[Dict[str, Any]]:
    """
    Fetch article with fallback methods.
    
    Currently uses newspaper3k only.
    Future: Add Playwright fallback for JavaScript-heavy sites.
    
    Args:
        url: Article URL
        user_agent: User agent string
        
    Returns:
        Article data dict or None
    """
    # Try newspaper3k
    result = fetch_article_content(url, user_agent)
    
    if result is not None:
        return result
    
    # Future: Try Playwright fallback here
    logger.warning(f"All fetch methods failed for {url}")
    return None
