import spacy
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

# Load spaCy model once (small English model)
try:
    nlp = spacy.load("en_core_web_sm")
    logger.info("Loaded spaCy model: en_core_web_sm")
except OSError:
    logger.warning("spaCy model 'en_core_web_sm' not found. Run: python -m spacy download en_core_web_sm")
    nlp = None

# Keyword lists for sentiment analysis
NEGATIVE_KEYWORDS = [
    "fail", "failure", "failed", "bankrupt", "bankruptcy", "lawsuit", "sued",
    "attack", "attacked", "exploit", "exploited", "breach", "breached",
    "scandal", "crisis", "crash", "collapse", "decline", "loss", "losses"
]

POSITIVE_KEYWORDS = [
    "profit", "profits", "profitable", "record", "success", "successful",
    "breakthrough", "innovation", "innovative", "growth", "growing", "gain",
    "gains", "win", "winner", "achievement", "advance", "improved"
]

NEUTRAL_KEYWORDS = [
    "acquit", "acquitted", "settle", "settled", "announce", "announced",
    "report", "reported", "update", "statement"
]


def quick_score(
    text: str,
    target_tokens: Optional[List[str]] = None,
    source_trust: float = 0.5,
    num_sources: int = 1
) -> float:
    """
    Compute quick score for text using heuristic analysis.
    
    Args:
        text: Article text to score
        target_tokens: Optional list of target entities to match
        source_trust: Trust score of the source (0-1)
        num_sources: Number of independent sources reporting
        
    Returns:
        Score in range [-1, 1] where:
        - Negative = bad news
        - Positive = good news
        - 0 = neutral
    """
    
    # Sentiment score (keyword-based)
    sentiment = compute_sentiment(text)
    
    # Keyword score
    keyword_score = compute_keyword_score(text)
    
    # NER relevance
    ner_relevance = compute_ner_relevance(text, target_tokens)
    
    # Combine: 0.4*sentiment + 0.3*keyword + 0.3*ner
    score = 0.4 * sentiment + 0.3 * keyword_score + 0.3 * ner_relevance
    
    # Clamp to [-1, 1]
    score = max(-1.0, min(1.0, score))
    
    logger.debug(f"Quick score: {score:.3f} (sentiment={sentiment:.3f}, keyword={keyword_score:.3f}, ner={ner_relevance:.3f})")
    
    return score


def compute_sentiment(text: str) -> float:
    """
    Simple keyword-based sentiment analysis.
    
    Returns:
        Sentiment score in [-1, 1]
    """
    text_lower = text.lower()
    
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)
    
    if neg_count + pos_count == 0:
        return 0.0
    
    # Normalize to [-1, 1]
    sentiment = (pos_count - neg_count) / (pos_count + neg_count)
    return sentiment


def compute_keyword_score(text: str) -> float:
    """
    Score based on keyword presence and density.
    
    Returns:
        Keyword score in [-1, 1]
    """
    text_lower = text.lower()
    
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text_lower)
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in text_lower)
    
    total = neg_count + pos_count
    if total == 0:
        return 0.0
    
    # Normalize to [-1, 1]
    return (pos_count - neg_count) / max(total, 1)


def compute_ner_relevance(text: str, target_tokens: Optional[List[str]] = None) -> float:
    """
    Score based on Named Entity Recognition match with targets.
    
    Args:
        text: Input text
        target_tokens: List of target entities to look for (e.g., ["OpenAI", "GPT"])
        
    Returns:
        Relevance score in [0, 1]
    """
    if not target_tokens or nlp is None:
        return 0.0
    
    # Limit text length for performance
    doc = nlp(text[:1000])
    
    # Extract entities
    entities = [ent.text.lower() for ent in doc.ents]
    
    # Count matches
    matches = 0
    for target in target_tokens:
        target_lower = target.lower()
        if any(target_lower in ent for ent in entities):
            matches += 1
    
    if not target_tokens:
        return 0.0
    
    # Normalize to [0, 1]
    relevance = matches / len(target_tokens)
    return min(1.0, relevance)


def extract_entities(text: str, limit: int = 10) -> List[str]:
    """
    Extract named entities from text.
    
    Args:
        text: Input text
        limit: Maximum number of entities to return
        
    Returns:
        List of entity strings
    """
    if nlp is None:
        return []
    
    doc = nlp(text[:1000])
    entities = [ent.text for ent in doc.ents]
    
    return entities[:limit]
