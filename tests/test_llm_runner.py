"""
Tests for LLM Runner
====================

Verifies:
1. Model loading (mocked)
2. Prompt formatting
3. JSON output parsing
4. Schema validation
5. Fallback mechanisms
"""

import pytest
from unittest.mock import MagicMock, patch
import json
from reality_engine import llm_runner
from reality_engine.prompt_template import PromptTemplate

# Sample data
SAMPLE_ARTICLES = [
    {
        "title": "Tech Stock Soars",
        "summary": "Tech company released new product.",
        "source": {"trust": 0.9}
    },
    {
        "title": "Market Reaction",
        "content": "Investors are happy.",
        "source": {"trust": 0.8}
    }
]

SAMPLE_STOCKS = ["TECH"]
SAMPLE_SCORE = 0.8

def test_prompt_formatting():
    """Test that prompt template formats correctly."""
    prompt = PromptTemplate.format_prompt(SAMPLE_ARTICLES, SAMPLE_STOCKS, SAMPLE_SCORE)
    
    assert "Tech Stock Soars" in prompt
    assert "Market Reaction" in prompt
    assert "TECH" in prompt
    assert "0.8" in prompt  # Quick score
    assert "0.85" in prompt  # Avg trust (0.9+0.8)/2

def test_extract_json():
    """Test JSON extraction from text."""
    # Pure JSON
    text1 = '{"key": "value"}'
    assert llm_runner._extract_json(text1) == {"key": "value"}
    
    # Markdown JSON
    text2 = 'Here is json:\n```json\n{"key": "value"}\n```'
    assert llm_runner._extract_json(text2) == {"key": "value"}
    
    # Embedded JSON
    text3 = 'Sure! {"key": "value"} is the answer.'
    assert llm_runner._extract_json(text3) == {"key": "value"}
    
    # Invalid JSON
    text4 = 'Not json'
    assert llm_runner._extract_json(text4) is None

@patch("reality_engine.llm_runner._get_model")
def test_analyze_impact_success(mock_get_model):
    """Test successful LLM analysis."""
    # Mock pipeline output
    mock_pipe = MagicMock()
    mock_pipe.tokenizer.apply_chat_template.return_value = "prompt"
    
    valid_json = {
        "summary": "Test summary",
        "impact_suggestion": 15,
        "confidence": 0.9,
        "rationale": "Good news for the company"
    }
    
    # Mock generation output
    mock_pipe.return_value = [{"generated_text": json.dumps(valid_json)}]
    
    mock_get_model.return_value = (None, None, mock_pipe)
    
    result = llm_runner.analyze_impact(SAMPLE_ARTICLES, SAMPLE_STOCKS, SAMPLE_SCORE)
    
    assert result["summary"] == "Test summary", f"Fallback triggered: {result.get('rationale')}"
    assert result["impact_suggestion"] == 15
    assert result["confidence"] == 0.9

@patch("reality_engine.llm_runner._get_model")
def test_analyze_impact_invalid_schema(mock_get_model):
    """Test handling of invalid schema output."""
    mock_pipe = MagicMock()
    mock_pipe.tokenizer.apply_chat_template.return_value = "prompt"
    
    # Missing required fields
    invalid_json = {
        "summary": "Test summary"
        # Missing impact, confidence, rationale
    }
    
    mock_pipe.return_value = [{"generated_text": json.dumps(invalid_json)}]
    mock_get_model.return_value = (None, None, mock_pipe)
    
    result = llm_runner.analyze_impact(SAMPLE_ARTICLES, SAMPLE_STOCKS, SAMPLE_SCORE)
    
    # Should return fallback
    assert result["impact_suggestion"] == 80  # Fallback: quick_score * 100
    assert "Schema validation failed" in result["rationale"]

@patch("reality_engine.llm_runner.HAS_TRANSFORMERS", False)
def test_analyze_impact_no_transformers():
    """Test fallback when transformers not installed."""
    result = llm_runner.analyze_impact(SAMPLE_ARTICLES, SAMPLE_STOCKS, SAMPLE_SCORE)
    
    assert result["impact_suggestion"] == 80
    assert "LLM libraries missing" in result["rationale"]
