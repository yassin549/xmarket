"""
Backend Blender - Reality + Market Score Fusion
================================================

Applies events to update reality scores and blends with market price.
"""

import logging
import math
from typing import Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session
import httpx

from backend.models import RealityEventRequest
from config.constants import EWMA_ALPHA

logger = logging.getLogger(__name__)

# ============================================================================
# Score Computation
# ============================================================================

def get_current_score(session: Session, symbol: str) -> Optional[dict]:
    """
    Get current scores for a symbol.
    
    Returns:
        Dict with reality_score, final_price, confidence, or None if not found
    """
    result = session.execute(
        text("""
            SELECT reality_score, final_price, confidence
            FROM scores
            WHERE symbol = :symbol
        """),
        {"symbol": symbol}
    )
    row = result.fetchone()
    if row:
        return {
            "reality_score": row[0],
            "final_price": row[1],
            "confidence": row[2]
        }
    return None

def get_stock_weights(session: Session, symbol: str) -> Optional[dict]:
    """
    Get market/reality weights for a symbol.
    
    Returns:
        Dict with market_weight, reality_weight, or None if not found
    """
    result = session.execute(
        text("""
            SELECT market_weight, reality_weight
            FROM stocks
            WHERE symbol = :symbol
        """),
        {"symbol": symbol}
    )
    row = result.fetchone()
    if row:
        return {
            "market_weight": row[0],
            "reality_weight": row[1]
        }
    return None

def compute_new_reality_score(
    current_score: float,
    impact_points: float,
    alpha: float = EWMA_ALPHA
) -> float:
    """
    Compute new reality score using EWMA smoothing.
    
    Formula: new_score = current + alpha * impact
    Clamped to [0, 100]
    
    Args:
        current_score: Current reality score (0-100)
        impact_points: Event impact points (-20 to +20)
        alpha: EWMA smoothing factor (default 0.25)
        
    Returns:
        New reality score (0-100)
    """
    # Apply impact with smoothing
    new_score = current_score + (alpha * impact_points)
    
    # Clamp to valid range
    new_score = max(0.0, min(100.0, new_score))
    
    return round(new_score, 2)

def compute_confidence(num_independent_sources: int, avg_trust: float) -> float:
    """
    Compute confidence metric.
    
    Formula: confidence = min(1.0, log(1 + sources) * avg_trust)
    
    Args:
        num_independent_sources: Number of independent sources
        avg_trust: Average trust score across sources
        
    Returns:
        Confidence score (0-1)
    """
    confidence = math.log(1 + num_independent_sources) * avg_trust
    return min(1.0, round(confidence, 2))

# ============================================================================
# Market Integration
# ============================================================================

async def get_market_price(symbol: str, orderbook_url: str = "http://localhost:8001") -> float:
    """
    Query orderbook service for market price.
    
    Args:
        symbol: Stock symbol
        orderbook_url: Base URL for orderbook service
        
    Returns:
        Market price (0-100), defaults to 50.0 if unavailable
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{orderbook_url}/market/{symbol}/pressure",
                timeout=2.0
            )
            response.raise_for_status()
            data = response.json()
            return data.get("market_price", 50.0)
    except Exception as e:
        logger.warning(f"Failed to fetch market price for {symbol}: {e}")
        # Default to middle if orderbook unavailable
        return 50.0

def blend_final_price(
    reality_score: float,
    market_price: float,
    market_weight: float,
    reality_weight: float
) -> float:
    """
    Blend reality and market scores into final price.
    
    Formula: final = market_weight * market_price + reality_weight * reality_score
    
    Args:
        reality_score: Reality score (0-100)
        market_price: Market price (0-100)
        market_weight: Weight for market (0-1)
        reality_weight: Weight for reality (0-1)
        
    Returns:
        Blended final price (0-100)
    """
    final = (market_weight * market_price) + (reality_weight * reality_score)
    return round(max(0.0, min(100.0, final)), 2)

# ============================================================================
# Score Application
# ============================================================================

async def apply_event_to_scores(
    session: Session,
    event: RealityEventRequest,
    orderbook_url: str = "http://localhost:8001"
) -> dict:
    """
    Apply event to update scores.
    
    This is the core blender logic that:
    1. Gets current reality_score
    2. Computes new reality_score
    3. Gets market_price from orderbook
    4. Blends into final_price
    5. Updates scores table
    6. Records change in score_changes
    
    Args:
        session: Database session
        event: Reality event to apply
        orderbook_url: Orderbook service URL
        
    Returns:
        Dict with old_score, new_score, delta, market_price, final_price
    """
    symbol = event.stocks[0]  # Primary symbol
    
    # Get current scores
    current = get_current_score(session, symbol)
    if not current:
        # Initialize if first event for this stock
        current = {
            "reality_score": 50.0,  # Start at neutral
            "final_price": 50.0,
            "confidence": 0.5
        }
        
        # Create initial score record
        session.execute(
            text("""
                INSERT INTO scores (symbol, reality_score, final_price, confidence)
                VALUES (:symbol, :reality_score, :final_price, :confidence)
            """),
            {
                "symbol": symbol,
                "reality_score": 50.0,
                "final_price": 50.0,
                "confidence": 0.5
            }
        )
    
    # Compute new reality score
    old_score = current["reality_score"]
    new_score = compute_new_reality_score(old_score, event.impact_points)
    delta = new_score - old_score
    
    # Compute confidence
    avg_trust = sum(s.trust for s in event.sources) / len(event.sources)
    confidence = compute_confidence(event.num_independent_sources, avg_trust)
    
    # Get market price
    market_price = await get_market_price(symbol, orderbook_url)
    
    # Get blending weights
    weights = get_stock_weights(session, symbol)
    if not weights:
        # Default to 50/50 blend if weights not found
        weights = {"market_weight": 0.5, "reality_weight": 0.5}
    
    # Blend final price
    final_price = blend_final_price(
        new_score,
        market_price,
        weights["market_weight"],
        weights["reality_weight"]
    )
    
    # Update scores table
    session.execute(
        text("""
            UPDATE scores
            SET reality_score = :new_score,
                final_price = :final_price,
                confidence = :confidence,
                last_updated = CURRENT_TIMESTAMP
            WHERE symbol = :symbol
        """),
        {
            "symbol": symbol,
            "new_score": new_score,
            "final_price": final_price,
            "confidence": confidence
        }
    )
    
    # Record change in score_changes
    session.execute(
        text("""
            INSERT INTO score_changes (symbol, old_score, new_score, delta, event_id)
            VALUES (:symbol, :old_score, :new_score, :delta, :event_id)
        """),
        {
            "symbol": symbol,
            "old_score": old_score,
            "new_score": new_score,
            "delta": delta,
            "event_id": event.event_id
        }
    )
    
    # Mark event as processed
    session.execute(
        text("UPDATE events SET processed = true WHERE event_id = :event_id"),
        {"event_id": event.event_id}
    )
    
    session.commit()
    
    logger.info(
        f"Applied event {event.event_id} to {symbol}: "
        f"{old_score:.2f} -> {new_score:.2f} (Δ{delta:+.2f}), "
        f"final_price={final_price:.2f}"
    )
    
    return {
        "symbol": symbol,
        "old_score": old_score,
        "new_score": new_score,
        "delta": delta,
        "market_price": market_price,
        "final_price": final_price,
        "confidence": confidence
    }
