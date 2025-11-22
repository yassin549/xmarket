"""
Content normalization and filtering for reality-engine.

Filters and processes raw article content:
- Language detection
- Content length validation
- Stock symbol mapping
"""

from typing import Dict, Any, List, Optional
import logging

# Try to import langdetect, but make it optional
try:
    from langdetect import detect, DetectorFactory
    # Set seed for consistency
    DetectorFactory.seed = 0
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False
    logging.warning("langdetect not installed, language detection will be skipped")

logger = logging.getLogger(__name__)


def detect_language(text: str) -> Optional[str]:
    """
    Detect language of text.
    
    Args:
        text: Text to analyze
        
    Returns:
        ISO 639-1 language code (e.g., 'en') or None if detection fails
    """
    if not HAS_LANGDETECT:
        return 'en'  # Assume English if langdetect not available
    
    try:
        lang = detect(text)
        return lang
    except Exception as e:
        logger.debug(f"Language detection failed: {e}")
        return None


def is_valid_content(text: str, min_length: int = 200) -> bool:
    """
    Check if content meets minimum quality requirements.
    
    Args:
        text: Article text
        min_length: Minimum required length
        
    Returns:
        True if valid, False otherwise
    """
    if not text or not isinstance(text, str):
        return False
    
    # Remove excessive whitespace
    cleaned = ' '.join(text.split())
    
    return len(cleaned) >= min_length


def extract_stock_mentions(text: str, known_stocks: List[str] = None) -> List[str]:
    """
    Extract stock symbol mentions from text.
    
    Simple implementation: checks if stock symbols appear in uppercase.
    Future: Use NER or more sophisticated matching.
    
    Args:
        text: Article text
        known_stocks: List of known stock symbols to look for
        
    Returns:
        List of detected stock symbols
    """
    if not known_stocks:
        # Default stocks for auto-detection
        known_stocks = ['TECH', 'CLIMATE', 'ENERGY', 'HEALTH', 'FINANCE']
    
    detected = []
    text_upper = text.upper()
    
    for stock in known_stocks:
        if stock in text_upper:
            detected.append(stock)
    
    return list(set(detected))  # Remove duplicates


def normalize_article(
    article_data: Dict[str, Any],
    feed_config: Dict[str, Any],
    settings: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Normalize and validate article data.
    
    Args:
        article_data: Raw article data from fetcher
        feed_config: Feed configuration
        settings: Global settings
        
    Returns:
        Normalized article dict or None if article should be skipped
    """
    text = article_data.get('text', '')
    
    # 1. Language check (only English for now)
    lang = detect_language(text)
    if lang and lang != 'en':
        logger.debug(f"Skipping non-English article: {article_data['url']} (lang={lang})")
        return None
    
    # 2. Content length check
    min_length = settings.get('min_content_length', 200)
    if not is_valid_content(text, min_length):
        logger.debug(f"Skipping article with insufficient content: {article_data['url']}")
        return None
    
    # 3. Stock mapping
    stocks = feed_config.get('stocks', [])
    
    # If feed doesn't specify stocks, try to auto-detect
    if not stocks:
        stocks = extract_stock_mentions(text)
        if not stocks:
            logger.debug(f"No stock mentions found in article: {article_data['url']}")
            return None  # Skip if no relevant stocks
    
    # 4. Build normalized result
    normalized = {
        'title': article_data.get('title', ''),
        'text': text,
        'stocks': stocks,
        'source_url': article_data['url'],
        'publish_date': article_data.get('publish_date'),
        'authors': article_data.get('authors', []),
        'lang': lang or 'en',
        'content_length': len(text)
    }
    
    logger.info(f"Normalized article: {normalized['title'][:50]}... -> stocks={stocks}")
    return normalized
