"""
News scraper with RSS-first approach and robots.txt compliance.
"""
import feedparser
import requests
from newspaper import Article
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from typing import List, Dict, Optional
from datetime import datetime
import time
import logging
import yaml
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import constants

logger = logging.getLogger(__name__)


class RobotsChecker:
    """Check and respect robots.txt rules."""
    
    def __init__(self):
        self.parsers: Dict[str, RobotFileParser] = {}
    
    def can_fetch(self, url: str, user_agent: str = "*") -> bool:
        """Check if URL can be fetched according to robots.txt."""
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # Get or create parser for this domain
        if base_url not in self.parsers:
            robots_url = f"{base_url}/robots.txt"
            parser = RobotFileParser()
            parser.set_url(robots_url)
            try:
                parser.read()
                self.parsers[base_url] = parser
                logger.info(f"Loaded robots.txt for {base_url}")
            except Exception as e:
                logger.warning(f"Could not load robots.txt for {base_url}: {e}")
                # If robots.txt fails, assume allowed
                return True
        
        return self.parsers[base_url].can_fetch(user_agent, url)
    
    def get_crawl_delay(self, url: str, user_agent: str = "*") -> Optional[float]:
        """Get crawl delay from robots.txt."""
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        if base_url in self.parsers:
            return self.parsers[base_url].crawl_delay(user_agent)
        return None


class NewsScraper:
    """
    News scraper with RSS-first approach.
    Falls back to newspaper3k, then Playwright if needed.
    """
    
    def __init__(self, sources_file: str = "sources.yaml"):
        # Load sources configuration
        with open(sources_file, 'r') as f:
            config = yaml.safe_load(f)
            self.sources = config['sources']
        
        self.robots_checker = RobotsChecker()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'EverythingMarketBot/1.0 (News aggregator; +https://everythingmarket.com)'
        })
        
        logger.info(f"Loaded {len(self.sources)} news sources")
    
    def fetch_rss_items(self, source: Dict) -> List[Dict]:
        """
        Fetch items from RSS feed.
        
        Returns:
            List of {title, link, published, summary}
        """
        if 'rss' not in source:
            return []
        
        try:
            feed = feedparser.parse(source['rss'])
            items = []
            
            for entry in feed.entries[:10]:  # Limit to 10 most recent
                items.append({
                    'title': entry.get('title', ''),
                    'link': entry.get('link', ''),
                    'published': entry.get('published', ''),
                    'summary': entry.get('summary', ''),
                    'source_id': source['id'],
                    'source_trust': source['trust']
                })
            
            logger.info(f"Fetched {len(items)} items from {source['id']} RSS")
            return items
            
        except Exception as e:
            logger.error(f"Error fetching RSS from {source['id']}: {e}")
            return []
    
    def extract_article(self, url: str, source_id: str) -> Optional[Dict]:
        """
        Extract article content using newspaper3k.
        
        Returns:
            {title, text, authors, publish_date, url}
        """
        # Check robots.txt
        if not self.robots_checker.can_fetch(url):
            logger.warning(f"Blocked by robots.txt: {url}")
            return None
        
        try:
            article = Article(url)
            article.download()
            article.parse()
            
            return {
                'title': article.title,
                'text': article.text,
                'authors': article.authors,
                'publish_date': article.publish_date,
                'url': url,
                'source_id': source_id
            }
            
        except Exception as e:
            logger.error(f"Error extracting article from {url}: {e}")
            return None
    
    def scrape_all_sources(self) -> List[Dict]:
        """
        Scrape all configured sources.
        
        Returns:
            List of article dicts
        """
        all_articles = []
        
        for source in self.sources:
            # Respect crawl delay
            crawl_delay = source.get('crawl_delay', constants.DEFAULT_CRAWL_DELAY)
            
            # Fetch RSS items
            rss_items = self.fetch_rss_items(source)
            
            # Extract full articles
            for item in rss_items:
                time.sleep(crawl_delay)  # Rate limiting
                
                article = self.extract_article(item['link'], source['id'])
                if article:
                    # Merge RSS metadata with extracted content
                    article['rss_summary'] = item['summary']
                    article['source_trust'] = source['trust']
                    all_articles.append(article)
            
            logger.info(f"Scraped {len(rss_items)} articles from {source['id']}")
        
        return all_articles
    
    def make_article_id(self, url: str, published: Optional[datetime] = None) -> str:
        """
        Create deterministic article ID.
        
        Args:
            url: Article URL
            published: Publication date
        
        Returns:
            Unique article ID
        """
        import hashlib
        
        # Use URL + date for uniqueness
        key = url
        if published:
            key += published.isoformat()
        
        return hashlib.sha256(key.encode()).hexdigest()[:16]


# Global scraper instance
_scraper = None


def get_scraper() -> NewsScraper:
    """Get or create global scraper."""
    global _scraper
    if _scraper is None:
        _scraper = NewsScraper()
    return _scraper
