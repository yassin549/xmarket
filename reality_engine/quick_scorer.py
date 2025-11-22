"""
Deterministic quick scorer for reality-engine.

Implements quick_score formula:
    0.4 * sentiment + 0.3 * keyword_score + 0.3 * ner_relevance

All components are deterministic (same input = same output).
Output is clamped to [-1, 1].
"""

from typing import List, Optional
import logging

# Import with error handling
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    HAS_VADER = True
except ImportError:
    HAS_VADER = False
    logging.warning("vaderSentiment not installed, sentiment scoring will be disabled")

try:
    import spacy
    HAS_SPACY = True
except ImportError:
    HAS_SPACY = False
    logging.warning("spacy not installed, NER scoring will be disabled")

logger = logging.getLogger(__name__)

# Global sentiment analyzer (cached)
_SENTIMENT_ANALYZER: Optional[SentimentIntensityAnalyzer] = None

# Global spaCy model (cached)
_SPACY_MODEL = None


# ============================================================================
# Keyword Lists (Deterministic)
# ============================================================================

POSITIVE_KEYWORDS = {
    # Strong positive (1.0)
    'breakthrough': 1.0,
    'success': 1.0,
    'achievement': 1.0,
    'revolutionary': 1.0,
    
    # Moderate positive (0.7-0.9)
    'growth': 0.9,
    'innovation': 0.8,
    'improvement': 0.8,
    'increase': 0.7,
    'gain': 0.7,
    'advancement': 0.8,
    'progress': 0.8,
    'record': 0.9,
    
    # Mild positive (0.5-0.6)
    'positive': 0.6,
    'better': 0.5,
    'opportunity': 0.6,
    'strong': 0.6,
}

NEGATIVE_KEYWORDS = {
    # Strong negative (-1.0)
    'crisis': -1.0,
    'catastrophe': -1.0,
    'disaster': -1.0,
    'collapse': -1.0,
    
    # Moderate negative (-0.7 to -0.9)
    'failure': -0.9,
    'decline': -0.9,
    'loss': -0.8,
    'decrease': -0.7,
    'cut': -0.7,
    'fall': -0.7,
    'drop': -0.7,
    
    # Mild negative (-0.5 to -0.6)
    'risk': -0.6,
    'concern': -0.5,
    'warning': -0.6,
    'threat': -0.6,
}


# ============================================================================
# Sentiment Scoring (VADER)
# ============================================================================

def get_sentiment_analyzer() -> Optional[SentimentIntensityAnalyzer]:
    """Get cached sentiment analyzer."""
    global _SENTIMENT_ANALYZER
    
    if not HAS_VADER:
        return None
    
    if _SENTIMENT_ANALYZER is None:
        _SENTIMENT_ANALYZER = SentimentIntensityAnalyzer()
    
    return _SENTIMENT_ANALYZER


def compute_sentiment_score(text: str) -> float:
    """
    Compute sentiment score using VADER.
    
    VADER is deterministic and lexicon-based, perfect for reproducible scoring.
    
    Args:
        text: Input text
        
    Returns:
        Sentiment score in range [-1, 1]
        -1 = extremely negative, 0 = neutral, +1 = extremely positive
    """
    analyzer = get_sentiment_analyzer()
    
    if analyzer is None:
        logger.warning("VADER not available, returning neutral sentiment")
        return 0.0
    
    scores = analyzer.polarity_scores(text)
    # compound score is already in [-1, 1]
    return scores['compound']


# ============================================================================
# Keyword Scoring
# ============================================================================

def compute_keyword_score(text: str) -> float:
    """
    Compute keyword-based score from weighted keyword lists.
    
    Args:
        text: Input text
        
    Returns:
        Keyword score in range [-1, 1]
    """
    text_lower = text.lower()
    
    total_score = 0.0
    count = 0
    
    # Check positive keywords
    for keyword, weight in POSITIVE_KEYWORDS.items():
        if keyword in text_lower:
            total_score += weight
            count += 1
    
    # Check negative keywords
    for keyword, weight in NEGATIVE_KEYWORDS.items():
        if keyword in text_lower:
            total_score += weight  # weight is already negative
            count += 1
    
    if count == 0:
        return 0.0
    
    # Average and clamp
    avg_score = total_score / count
    return max(-1.0, min(1.0, avg_score))


# ============================================================================
# NER Relevance Scoring (spaCy)
# ============================================================================

def get_spacy_model():
    """Get cached spaCy model."""
    global _SPACY_MODEL
    
    if not HAS_SPACY:
        return None
    
    if _SPACY_MODEL is None:
        try:
            _SPACY_MODEL = spacy.load('en_core_web_sm')
        except OSError:
            logger.warning("spaCy model 'en_core_web_sm' not found. Run: python -m spacy download en_core_web_sm")
            return None
    
    return _SPACY_MODEL


def compute_ner_relevance(text: str, stocks: Optional[List[str]] = None) -> float:
    """
    Compute NER-based relevance score.
    
    Detects named entities (ORG, PRODUCT, PERSON) to determine
    how "newsworthy" or relevant the text is.
    
    Args:
        text: Input text
        stocks: Optional list of stock symbols for relevance check
        
    Returns:
        Relevance score in range [0, 1]
    """
    nlp = get_spacy_model()
    
    if nlp is None:
        logger.warning("spaCy not available, returning neutral NER score")
        return 0.0
    
    doc = nlp(text)
    
    # Count relevant entity types
    org_count = len([ent for ent in doc.ents if ent.label_ == 'ORG'])
    product_count = len([ent for ent in doc.ents if ent.label_ == 'PRODUCT'])
    person_count = len([ent for ent in doc.ents if ent.label_ == 'PERSON'])
    
    total_entities = org_count + product_count + person_count
    
    # Entity density (normalize by text length)
    text_words = len(text.split())
    if text_words == 0:
        return 0.0
    
    entity_density = total_entities / max(text_words / 100, 1.0)  # Per 100 words
    
    # Relevance score (more entities = more newsworthy)
    relevance = min(1.0, entity_density / 5.0)  # Cap at 5 entities per 100 words
    
    return relevance


# ============================================================================
# Combined Quick Score
# ============================================================================

def compute_quick_score(text: str, stocks: Optional[List[str]] = None) -> float:
    """
    Compute deterministic quick_score for an article.
    
    Formula: 0.4*sentiment + 0.3*keyword + 0.3*ner
    
    All components are deterministic (same input = same output).
    
    Args:
        text: Article text
        stocks: Optional list of stock symbols
        
    Returns:
        Quick score in range [-1, 1]
        -1 = very negative, 0 = neutral, +1 = very positive
    """
    # Compute individual scores
    sentiment = compute_sentiment_score(text)
    keyword = compute_keyword_score(text)
    ner = compute_ner_relevance(text, stocks)
    
    # Weighted combination
    score = 0.4 * sentiment + 0.3 * keyword + 0.3 * ner
    
    # Clamp to [-1, 1]
    score = max(-1.0, min(1.0, score))
    
    # Round to 2 decimal places for consistency
    return round(score, 2)


# ============================================================================
# Detailed scoring (for debugging/analysis)
# ============================================================================

def compute_quick_score_detailed(text: str, stocks: Optional[List[str]] = None) -> dict:
    """
    Compute quick_score with detailed breakdown for analysis.
    
    Args:
        text: Article text
        stocks: Optional list of stock symbols
        
    Returns:
        Dictionary with detailed scores
    """
    sentiment = compute_sentiment_score(text)
    keyword = compute_keyword_score(text)
    ner = compute_ner_relevance(text, stocks)
    
    final_score = 0.4 * sentiment + 0.3 * keyword + 0.3 * ner
    final_score = max(-1.0, min(1.0, final_score))
    
    return {
        'final_score': round(final_score, 2),
        'sentiment': round(sentiment, 2),
        'keyword': round(keyword, 2),
        'ner': round(ner, 2),
        'breakdown': {
            'sentiment_contribution': round(0.4 * sentiment, 2),
            'keyword_contribution': round(0.3 * keyword, 2),
            'ner_contribution': round(0.3 * ner, 2)
        }
    }
