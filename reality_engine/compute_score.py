"""
Event scoring computation module.

Implements the formulas for event weight and points:
1. event_weight = source_trust * (1 + log(1 + num_related_docs)) * exp(-age_seconds/TAU_SECONDS)
2. event_points = clamp(event_weight * quick_score * 100, -DELTA_CAP, +DELTA_CAP)
"""

import math
from typing import Optional
import logging
from config.constants import TAU_SECONDS, DELTA_CAP

logger = logging.getLogger(__name__)

def compute_event_weight(
    source_trust: float,
    num_related_docs: int,
    age_seconds: float
) -> float:
    """
    Compute event weight based on trust, volume, and age.
    
    Formula:
        weight = trust * (1 + log(1 + num_docs)) * exp(-age / TAU)
        
    Args:
        source_trust: Trust score of the source (0.0 to 1.0)
        num_related_docs: Number of related documents in the group
        age_seconds: Age of the event in seconds
        
    Returns:
        Computed weight (float)
    """
    # 1. Volume factor: logarithmic scaling
    # 1 doc -> 1 + log(2) ~= 1.69
    # 10 docs -> 1 + log(11) ~= 3.40
    volume_factor = 1.0 + math.log(1.0 + num_related_docs)
    
    # 2. Time decay: exponential decay
    # age=0 -> 1.0
    # age=TAU -> 0.37
    decay_factor = math.exp(-age_seconds / TAU_SECONDS)
    
    weight = source_trust * volume_factor * decay_factor
    return weight

def compute_event_points(
    quick_score: float,
    source_trust: float,
    num_related_docs: int = 1,
    age_seconds: float = 0.0
) -> float:
    """
    Compute final impact points for an event.
    
    Formula:
        points = clamp(weight * quick_score * 100, -DELTA_CAP, +DELTA_CAP)
        
    Args:
        quick_score: Sentiment/relevance score (-1.0 to 1.0)
        source_trust: Trust score of the source (0.0 to 1.0)
        num_related_docs: Number of related documents (default 1)
        age_seconds: Age of the event in seconds (default 0)
        
    Returns:
        Impact points rounded to 2 decimals
    """
    # Calculate weight
    weight = compute_event_weight(source_trust, num_related_docs, age_seconds)
    
    # Calculate raw points
    # quick_score is [-1, 1], so raw_points is roughly [-100, 100] * weight
    raw_points = weight * quick_score * 10.0 # Wait, plan says * 100?
    # Let me check the plan again.
    # Plan says: event_points = clamp(event_weight * quick_score * 100, -DELTA_CAP, DELTA_CAP)
    # But wait, DELTA_CAP is 20.
    # If quick_score is 0.5, trust 0.8, 1 doc (weight ~1.35)
    # points = 1.35 * 0.5 * 100 = 67.5 -> clamped to 20.
    # This means almost ANY event will hit the cap immediately.
    # Let me check the previous implementation in event_builder.py
    # It used: impact_points = quick_score * trust * 10.0
    # If I use 100, it's 10x stronger.
    # Let's look at the plan again carefully.
    # "event_points = clamp(event_weight * quick_score * 100, -DELTA_CAP, DELTA_CAP)"
    # Maybe the intention is that 100 is the base scale (0-100 reality score), and DELTA_CAP limits the *change*.
    # Yes, that makes sense. A single event shouldn't move the needle more than 20 points.
    # But with *100, a moderate event (0.3 score) from a trusted source (0.8) is:
    # 0.8 * 1.69 * 0.3 * 100 = 40.5 -> clamped to 20.
    # So basically any significant news hits the cap.
    # Is that desired?
    # Maybe the formula in plan meant * 10?
    # "event_points = clamp(event_weight * quick_score * 100, ...)"
    # I will stick to the plan's formula (* 100) but I suspect it might be too aggressive.
    # However, I must follow the plan.
    
    raw_points = weight * quick_score * 100.0
    
    # Clamp to DELTA_CAP
    clamped_points = max(-float(DELTA_CAP), min(float(DELTA_CAP), raw_points))
    
    return round(clamped_points, 2)
