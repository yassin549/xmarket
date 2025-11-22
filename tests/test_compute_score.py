"""
Tests for event scoring computation.
"""

import pytest
import math
from reality_engine.compute_score import compute_event_weight, compute_event_points
from config.constants import TAU_SECONDS, DELTA_CAP

def test_compute_event_weight_basic():
    """Test basic weight computation."""
    trust = 0.8
    docs = 1
    age = 0
    
    # Formula: trust * (1 + log(1 + docs)) * exp(-age/TAU)
    # 0.8 * (1 + log(2)) * 1.0
    # 0.8 * 1.693... = 1.354...
    
    weight = compute_event_weight(trust, docs, age)
    expected = trust * (1 + math.log(2))
    
    assert math.isclose(weight, expected, rel_tol=1e-5)

def test_compute_event_weight_decay():
    """Test time decay."""
    trust = 1.0
    docs = 0 # 1 + log(1) = 1
    
    # Age = TAU -> exp(-1) ~= 0.367
    weight_tau = compute_event_weight(trust, 0, TAU_SECONDS)
    assert math.isclose(weight_tau, math.exp(-1), rel_tol=1e-5)
    
    # Age = 0 -> 1.0
    weight_zero = compute_event_weight(trust, 0, 0)
    assert math.isclose(weight_zero, 1.0, rel_tol=1e-5)
    
    assert weight_tau < weight_zero

def test_compute_event_weight_volume():
    """Test volume factor."""
    trust = 1.0
    age = 0
    
    w1 = compute_event_weight(trust, 1, age)
    w10 = compute_event_weight(trust, 10, age)
    
    assert w10 > w1
    # 1 doc -> 1 + log(2) ~= 1.69
    # 10 docs -> 1 + log(11) ~= 3.39
    assert w10 > 1.5 * w1

def test_compute_event_points_clamping():
    """Test that points are clamped to DELTA_CAP."""
    # Massive score
    # weight ~ 1.7, score 1.0 -> 170 points -> clamp to 20
    points = compute_event_points(1.0, 1.0, 1, 0)
    assert points == float(DELTA_CAP)
    
    # Massive negative score
    points_neg = compute_event_points(-1.0, 1.0, 1, 0)
    assert points_neg == -float(DELTA_CAP)

def test_compute_event_points_rounding():
    """Test rounding to 2 decimals."""
    # 0.5 * 0.5 * (1+log(2)) * 100 = 0.25 * 1.693 * 100 = 42.32...
    # Clamped to 20
    
    # Let's try a small one that won't clamp
    # trust 0.1, score 0.1, 0 docs -> weight 0.1 * 1 = 0.1
    # points = 0.1 * 0.1 * 100 = 1.0
    points = compute_event_points(0.1, 0.1, 0, 0)
    assert points == 1.0
    
    # trust 0.123, score 0.1, 0 docs -> 0.0123 * 100 = 1.23
    points = compute_event_points(0.1, 0.123, 0, 0)
    assert points == 1.23

def test_compute_event_points_zero_trust():
    """Test zero trust results in zero points."""
    points = compute_event_points(1.0, 0.0, 10, 0)
    assert points == 0.0
