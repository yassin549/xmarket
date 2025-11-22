"""
Unit tests for backend blender module.
"""
import pytest
from backend.app.blender import compute_final_price, apply_ewma_smoothing
from config import constants


def test_compute_final_price_with_market_data():
    """Test final price calculation with market data."""
    reality_score = 70.0
    market_price = 60.0
    market_weight = 0.6
    reality_weight = 0.4
    
    final = compute_final_price(reality_score, market_price, market_weight, reality_weight)
    
    # Expected: 0.6 * 60 + 0.4 * 70 = 36 + 28 = 64
    assert final == pytest.approx(64.0, abs=0.01)


def test_compute_final_price_no_market_data():
    """Test final price falls back to reality score when no market data."""
    reality_score = 75.0
    market_price = None
    
    final = compute_final_price(reality_score, market_price, 0.6, 0.4)
    
    # Should return reality score
    assert final == 75.0


def test_compute_final_price_clamping():
    """Test final price is clamped to valid range."""
    reality_score = 150.0  # Out of range
    market_price = 50.0
    
    final = compute_final_price(reality_score, market_price, 0.5, 0.5)
    
    # Should be clamped to MAX_PRICE (100)
    assert final <= constants.MAX_PRICE
    assert final >= constants.MIN_PRICE


def test_ewma_smoothing():
    """Test EWMA smoothing calculation."""
    current_price = 50.0
    new_price = 60.0
    alpha = 0.25
    
    smoothed = apply_ewma_smoothing(current_price, new_price, alpha)
    
    # Expected: 0.25 * 60 + 0.75 * 50 = 15 + 37.5 = 52.5
    assert smoothed == pytest.approx(52.5, abs=0.01)


def test_ewma_smoothing_default_alpha():
    """Test EWMA uses default alpha from constants."""
    current_price = 50.0
    new_price = 60.0
    
    smoothed = apply_ewma_smoothing(current_price, new_price)
    
    # Should use constants.EWMA_ALPHA (0.25)
    expected = constants.EWMA_ALPHA * new_price + (1 - constants.EWMA_ALPHA) * current_price
    assert smoothed == pytest.approx(expected, abs=0.01)
