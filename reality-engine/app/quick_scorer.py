"""
Deterministic quick scorer.
Computes quick_score ∈ [-1, 1] using:
  0.4 × sentiment + 0.3 × keywords + 0.3 × NER relevance
"""
import spacy
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from typing import List, Dict
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import constants

logger = logging.getLogger(__name__)


class QuickScorer:
    """
    Deterministic quick scoring using sentiment, keywords, and NER.
    """
    
    def __init__(self):
        # Load spaCy model
        logger.info("Loading spaCy model for NER...")
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning("spaCy model not found. Run: python -m spacy download en_core_web_sm")
            self.nlp = None
        
        # Initialize VADER sentiment analyzer
        self.sentiment_analyzer = SentimentIntensityAnalyzer()
        
        # Keyword lists with weights
        self.positive_keywords = {
            "breakthrough": 0.8,
            "innovation": 0.7,
            "growth": 0.6,
            "success": 0.6,
            "profit": 0.7,
            "revenue": 0.5,
            "partnership": 0.6,
            "expansion": 0.6,
            "launch": 0.5,
            "award": 0.6,
            "milestone": 0.7,
            "record": 0.6,
        }
        
        self.negative_keywords = {
            "scandal": -0.8,
            "lawsuit": -0.7,
            "loss": -0.6,
            "decline": -0.6,
            "bankruptcy": -0.9,
            "fraud": -0.9,
            "investigation": -0.7,
            "layoff": -0.7,
            "shutdown": -0.8,
            "failure": -0.7,
            "crisis": -0.8,
            "controversy": -0.6,
        }
        
        logger.info("QuickScorer initialized")
    
    def compute_sentiment_score(self, text: str) -> float:
        """
        Compute sentiment score using VADER.
        
        Returns:
            Score in [-1, 1]
        """
        scores = self.sentiment_analyzer.polarity_scores(text)
        # Use compound score (already in [-1, 1])
        return scores['compound']
    
    def compute_keyword_score(self, text: str) -> float:
        """
        Compute keyword-based score.
        
        Returns:
            Score in [-1, 1]
        """
        text_lower = text.lower()
        
        # Count positive keywords
        pos_score = sum(
            weight for keyword, weight in self.positive_keywords.items()
            if keyword in text_lower
        )
        
        # Count negative keywords
        neg_score = sum(
            abs(weight) for keyword, weight in self.negative_keywords.items()
            if keyword in text_lower
        )
        
        # Normalize to [-1, 1]
        total = pos_score + neg_score
        if total == 0:
            return 0.0
        
        return (pos_score - neg_score) / max(total, 1.0)
    
    def compute_ner_relevance(self, text: str, target_entities: List[str]) -> float:
        """
        Compute NER-based relevance score.
        
        Args:
            text: Article text
            target_entities: List of entity names to look for (e.g., ["Tesla", "Elon Musk"])
        
        Returns:
            Score in [0, 1] based on entity mentions
        """
        if not self.nlp:
            # Fallback: simple keyword matching
            text_lower = text.lower()
            matches = sum(1 for entity in target_entities if entity.lower() in text_lower)
            return min(matches / max(len(target_entities), 1), 1.0)
        
        # Use spaCy NER
        doc = self.nlp(text)
        
        # Extract entities
        entities = [ent.text.lower() for ent in doc.ents]
        
        # Count matches
        matches = sum(
            1 for target in target_entities
            if any(target.lower() in entity for entity in entities)
        )
        
        # Normalize
        return min(matches / max(len(target_entities), 1), 1.0)
    
    def compute_quick_score(
        self,
        text: str,
        target_entities: Optional[List[str]] = None
    ) -> float:
        """
        Compute final quick score using weighted formula.
        
        Args:
            text: Article text
            target_entities: Optional list of entities to check relevance
        
        Returns:
            Quick score in [-1, 1]
        """
        # Compute components
        sentiment = self.compute_sentiment_score(text)
        keywords = self.compute_keyword_score(text)
        
        # NER relevance (0-1, so we map to -1 to 1 by centering)
        if target_entities:
            ner_raw = self.compute_ner_relevance(text, target_entities)
            ner = (ner_raw * 2) - 1  # Map [0,1] to [-1,1]
        else:
            ner = 0.0
        
        # Weighted combination
        quick_score = (
            constants.QUICK_SCORE_SENTIMENT_WEIGHT * sentiment +
            constants.QUICK_SCORE_KEYWORD_WEIGHT * keywords +
            constants.QUICK_SCORE_NER_WEIGHT * ner
        )
        
        # Clamp to [-1, 1]
        quick_score = max(-1.0, min(1.0, quick_score))
        
        logger.debug(
            f"Quick score: sentiment={sentiment:.3f}, keywords={keywords:.3f}, "
            f"ner={ner:.3f} → {quick_score:.3f}"
        )
        
        return quick_score


# Global scorer instance
_quick_scorer = None


def get_quick_scorer() -> QuickScorer:
    """Get or create global quick scorer."""
    global _quick_scorer
    if _quick_scorer is None:
        _quick_scorer = QuickScorer()
    return _quick_scorer
