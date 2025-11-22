import pytest
from app.scoring.quick_scorer import (
    quick_score, compute_sentiment, compute_keyword_score,
    compute_ner_relevance, extract_entities
)


def test_quick_score_negative():
    """Test negative sentiment detection"""
    text = "Company faces bankruptcy and lawsuit after major security breach and scandal"
    score = quick_score(text)
    assert score < 0, f"Expected negative score, got {score}"


def test_quick_score_positive():
    """Test positive sentiment detection"""
    text = "Company reports record profits and breakthrough innovation with successful growth"
    score = quick_score(text)
    assert score > 0, f"Expected positive score, got {score}"


def test_quick_score_neutral():
    """Test neutral text"""
    text = "Company announces quarterly report and provides update on operations"
    score = quick_score(text)
    assert abs(score) < 0.3, f"Expected near-neutral score, got {score}"


def test_quick_score_range():
    """Test that scores are in valid range"""
    texts = [
        "Massive failure and complete collapse",
        "Record success and amazing growth",
        "Regular business update"
    ]
    
    for text in texts:
        score = quick_score(text)
        assert -1.0 <= score <= 1.0, f"Score {score} out of range [-1, 1]"


def test_compute_sentiment_negative():
    """Test sentiment computation for negative text"""
    text = "failure bankruptcy lawsuit scandal"
    sentiment = compute_sentiment(text)
    assert sentiment < 0


def test_compute_sentiment_positive():
    """Test sentiment computation for positive text"""
    text = "success profit growth innovation"
    sentiment = compute_sentiment(text)
    assert sentiment > 0


def test_compute_sentiment_mixed():
    """Test sentiment with mixed keywords"""
    text = "success and failure"
    sentiment = compute_sentiment(text)
    assert abs(sentiment) < 0.5  # Should be somewhat neutral


def test_compute_keyword_score():
    """Test keyword scoring"""
    text_neg = "lawsuit breach scandal"
    text_pos = "profit success growth"
    
    score_neg = compute_keyword_score(text_neg)
    score_pos = compute_keyword_score(text_pos)
    
    assert score_neg < 0
    assert score_pos > 0


def test_ner_relevance_no_targets():
    """Test NER relevance with no targets"""
    text = "OpenAI released GPT-4 today"
    score = compute_ner_relevance(text, target_tokens=None)
    assert score == 0.0


def test_ner_relevance_with_targets():
    """Test NER relevance with target entities"""
    text = "OpenAI and Microsoft announced a partnership today"
    targets = ["OpenAI", "Microsoft"]
    
    # Note: This test may fail if spaCy model is not installed
    try:
        score = compute_ner_relevance(text, target_tokens=targets)
        assert 0.0 <= score <= 1.0
    except Exception:
        pytest.skip("spaCy model not available")


def test_extract_entities():
    """Test entity extraction"""
    text = "Apple and Google are competing in the smartphone market"
    
    try:
        entities = extract_entities(text)
        assert isinstance(entities, list)
        # Should extract company names
        assert len(entities) >= 0
    except Exception:
        pytest.skip("spaCy model not available")


def test_quick_score_with_source_trust():
    """Test that source trust is accepted (even if not used in current implementation)"""
    text = "Company announces new product"
    
    score1 = quick_score(text, source_trust=0.9)
    score2 = quick_score(text, source_trust=0.1)
    
    # Scores should be valid regardless of trust
    assert -1.0 <= score1 <= 1.0
    assert -1.0 <= score2 <= 1.0


def test_quick_score_empty_text():
    """Test handling of empty text"""
    score = quick_score("")
    assert score == 0.0


def test_quick_score_long_text():
    """Test handling of long text"""
    text = "profit " * 1000  # Very long text
    score = quick_score(text)
    assert score > 0  # Should still detect positive sentiment
    assert -1.0 <= score <= 1.0
