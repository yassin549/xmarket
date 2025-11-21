import pytest
import time
from unittest.mock import Mock, patch
from app.nlp.llm_client import LLMClient, RateLimiter, get_llm_client

def test_rate_limiter_allows_calls():
    """Test rate limiter allows calls within limit"""
    limiter = RateLimiter(calls_per_hour=2)
    
    assert limiter.allow_call() == True
    assert limiter.allow_call() == True
    assert limiter.allow_call() == False  # Third call blocked

def test_rate_limiter_refills():
    """Test rate limiter refills over time"""
    limiter = RateLimiter(calls_per_hour=3600)  # 1 per second
    
    # Use one token
    assert limiter.allow_call() == True
    
    # Wait 1 second
    time.sleep(1.1)
    
    # Should have refilled
    assert limiter.allow_call() == True

def test_heuristic_mode():
    """Test heuristic mode returns valid summary"""
    client = LLMClient()
    client.mode = "heuristic"
    
    docs = [
        {
            "title": "AI Breakthrough",
            "text": "Researchers announce major AI advancement. This could change everything. The impact is significant.",
            "source_id": "arxiv-cs",
            "trust": 0.9,
            "quick_score": 0.8
        },
        {
            "title": "Related News",
            "text": "Industry experts react to AI news. Many are excited. Some express caution.",
            "source_id": "the-verge",
            "trust": 0.7,
            "quick_score": 0.6
        }
    ]
    
    result = client.summarize_group(docs)
    
    assert "summary" in result
    assert isinstance(result["summary"], str)
    assert len(result["summary"]) > 0
    
    assert "impact_points" in result
    assert isinstance(result["impact_points"], (int, float))
    assert -100 <= result["impact_points"] <= 100
    
    assert "rationale" in result
    assert "confidence" in result
    assert 0 <= result["confidence"] <= 1

def test_empty_docs():
    """Test handling of empty document list"""
    client = LLMClient()
    client.mode = "heuristic"
    
    result = client.summarize_group([])
    
    assert result["summary"] == "No articles to summarize."
    assert result["impact_points"] == 0.0
    assert result["confidence"] == 0.0

def test_input_hash():
    """Test input hash generation"""
    client = LLMClient()
    
    docs1 = [
        {"title": "Article 1", "source_id": "source1"},
        {"title": "Article 2", "source_id": "source2"}
    ]
    
    docs2 = [
        {"title": "Article 2", "source_id": "source2"},
        {"title": "Article 1", "source_id": "source1"}
    ]
    
    # Same docs in different order should have same hash
    hash1 = client.get_input_hash(docs1)
    hash2 = client.get_input_hash(docs2)
    
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA256 hex

@patch('requests.post')
def test_railway_mode_success(mock_post):
    """Test railway mode with successful response"""
    client = LLMClient()
    client.mode = "railway"
    client.llm_service_url = "http://test:8001"
    
    # Mock successful response
    mock_response = Mock()
    mock_response.json.return_value = {
        "summary": "Test summary",
        "impact_points": 50.0,
        "rationale": "Test rationale",
        "confidence": 0.8
    }
    mock_response.raise_for_status = Mock()
    mock_post.return_value = mock_response
    
    docs = [{"title": "Test", "text": "Test", "source_id": "test", "trust": 0.5, "quick_score": 0.5}]
    result = client.summarize_group(docs)
    
    assert result["summary"] == "Test summary"
    assert result["impact_points"] == 50.0
    assert mock_post.called

@patch('requests.post')
def test_railway_mode_fallback(mock_post):
    """Test railway mode falls back to heuristic on error"""
    client = LLMClient()
    client.mode = "railway"
    
    # Mock failed response
    mock_post.side_effect = Exception("Connection error")
    
    docs = [{"title": "Test", "text": "Test content here.", "source_id": "test", "trust": 0.5, "quick_score": 0.5}]
    result = client.summarize_group(docs)
    
    # Should fall back to heuristic
    assert "summary" in result
    assert isinstance(result["impact_points"], (int, float))

def test_rate_limit_fallback():
    """Test that rate limiting triggers fallback"""
    client = LLMClient()
    client.mode = "railway"
    client.rate_limiter = RateLimiter(calls_per_hour=0)  # No calls allowed
    
    docs = [{"title": "Test", "text": "Test.", "source_id": "test", "trust": 0.5, "quick_score": 0.5}]
    result = client.summarize_group(docs)
    
    # Should fall back to heuristic
    assert "summary" in result
    assert result["confidence"] == 0.4  # Heuristic confidence

def test_singleton_pattern():
    """Test that get_llm_client returns same instance"""
    client1 = get_llm_client()
    client2 = get_llm_client()
    
    assert client1 is client2

def test_impact_points_clamping():
    """Test that impact points are clamped to [-100, 100]"""
    client = LLMClient()
    client.mode = "heuristic"
    
    # Extreme positive score
    docs = [{"title": "Test", "text": "Test.", "source_id": "test", "trust": 1.0, "quick_score": 100.0}]
    result = client.summarize_group(docs)
    assert -100 <= result["impact_points"] <= 100
    
    # Extreme negative score
    docs = [{"title": "Test", "text": "Test.", "source_id": "test", "trust": 1.0, "quick_score": -100.0}]
    result = client.summarize_group(docs)
    assert -100 <= result["impact_points"] <= 100
