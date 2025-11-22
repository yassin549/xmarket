"""
Blender module - computes final price from market and reality scores.
FinalPrice = market_weight × MarketPrice + reality_weight × RealityScore
"""
import httpx
import logging
import sys
import os
from typing import Optional, Dict, Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import env, constants

logger = logging.getLogger(__name__)


async def get_market_pressure(symbol: str) -> Optional[Dict[str, Any]]:
    """
    Fetch market pressure data from Orderbook service.
    
    Returns:
        {
            "market_price": float,
            "buy_volume": float,
            "sell_volume": float,
            "net_pressure": float,
            "timestamp": str
        }
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{env.ORDERBOOK_URL}/api/v1/market/{symbol}/pressure"
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching market pressure for {symbol}")
        return None
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching market pressure for {symbol}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching market pressure for {symbol}: {e}")
        return None


def compute_final_price(
    reality_score: float,
    market_price: Optional[float],
    market_weight: float,
    reality_weight: float
) -> float:
    """
    Compute final price by blending reality and market scores.
    
    Args:
        reality_score: Current reality score (0-100)
        market_price: Current market price (0-100), None if no market data
        market_weight: Weight for market component (0-1)
        reality_weight: Weight for reality component (0-1)
    
    Returns:
        Final blended price (0-100)
    """
    # If no market data available, use reality score only
    if market_price is None:
        logger.warning("No market data available, using reality score only")
        return reality_score
    
    # Ensure both scores are in valid range
    reality_score = max(constants.MIN_PRICE, min(constants.MAX_PRICE, reality_score))
    market_price = max(constants.MIN_PRICE, min(constants.MAX_PRICE, market_price))
    
    # Blend scores
    final = (market_weight * market_price) + (reality_weight * reality_score)
    
    # Clamp to valid range
    final = max(constants.MIN_PRICE, min(constants.MAX_PRICE, final))
    
    logger.debug(
        f"Blended price: market={market_price:.2f} (w={market_weight:.2f}), "
        f"reality={reality_score:.2f} (w={reality_weight:.2f}) → final={final:.2f}"
    )
    
    return final


def apply_ewma_smoothing(current_price: float, new_price: float, alpha: float = None) -> float:
    """
    Apply exponential moving average smoothing to price transitions.
    
    Args:
        current_price: Current price
        new_price: New computed price
        alpha: Smoothing factor (0-1), defaults to EWMA_ALPHA
    
    Returns:
        Smoothed price
    """
    if alpha is None:
        alpha = constants.EWMA_ALPHA
    
    smoothed = alpha * new_price + (1 - alpha) * current_price
    
    logger.debug(f"EWMA smoothing: {current_price:.2f} → {new_price:.2f} = {smoothed:.2f} (α={alpha})")
    
    return smoothed
