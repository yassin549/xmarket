"""
Unit tests for reality engine quick scorer.
"""
import pytest
from reality_engine.app.quick_scorer import QuickScorer
from config import constants


@pytest.fixture
def scorer():
    """Create QuickScorer instance."""
    return QuickScorer()


def test_positive_sentiment(scorer):
    """Test positive sentiment detection."""
    text = "This is an amazing breakthrough! Great success and innovation."
    score = scorer.compute_sentiment_score(text)
    
    assert score > 0  # Should be positive
    assert -1 <= score <= 1  # Within range


def test_negative_sentiment(scorer):
    """Test negative sentiment detection."""
    text = "Terrible scandal and fraud investigation. Complete failure."
    score = scorer.compute_sentiment_score(text)
    
    assert score < 0  # Should be negative
    assert -1 <= score <= 1  # Within range


def test_keyword_scoring_positive(scorer):
    """Test positive keyword detection."""
    text = "Company announces breakthrough innovation and record growth"
    score = scorer.compute_keyword_score(text)
    
    assert score > 0  # Should be positive


def test_keyword_scoring_negative(scorer):
    """Test negative keyword detection."""
    text = "Lawsuit filed amid scandal and bankruptcy concerns"
    score = scorer.compute_keyword_score(text)
    
    assert score < 0  # Should be negative


def test_quick_score_range(scorer):
    """Test that quick score is always in valid range."""
    texts = [
        "Amazing breakthrough success!",
        "Terrible scandal and fraud",
        "Neutral statement about company",
        "Mixed positive and negative news"
    ]
    
    for text in texts:
        score = scorer.compute_quick_score(text)
        assert -1 <= score <= 1, f"Score {score} out of range for text: {text}"


def test_quick_score_formula(scorer):
    """Test quick score uses correct weighted formula."""
    text = "Positive breakthrough innovation"
    entities = ["Tesla", "Elon Musk"]
    
    sentiment = scorer.compute_sentiment_score(text)
    keywords = scorer.compute_keyword_score(text)
    ner_raw = scorer.compute_ner_relevance(text, entities)
    ner = (ner_raw * 2) - 1
    
    expected = (
        constants.QUICK_SCORE_SENTIMENT_WEIGHT * sentiment +
        constants.QUICK_SCORE_KEYWORD_WEIGHT * keywords +
        constants.QUICK_SCORE_NER_WEIGHT * ner
    )
    
    actual = scorer.compute_quick_score(text, entities)
    
    assert actual == pytest.approx(expected, abs=0.01)


def test_deterministic_scoring(scorer):
    """Test that same text produces same score (deterministic)."""
    text = "Company announces major partnership and expansion"
    
    score1 = scorer.compute_quick_score(text)
    score2 = scorer.compute_quick_score(text)
    
    assert score1 == score2  # Must be deterministic
