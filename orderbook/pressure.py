"""
Market Pressure Calculation
============================

Computes market metrics for blending with reality score.
"""

from typing import Optional
from datetime import datetime, timezone, timedelta
from orderbook.engine import OrderBook

def calculate_pressure(book: OrderBook, window_hours: int = 1) -> dict:
    """
    Calculate market pressure metrics from orderbook state.
    
    Args:
        book: OrderBook instance
        window_hours: Time window for volume calculation (default 1 hour)
        
    Returns:
        Dict with buy_volume, sell_volume, net_pressure, market_price
    """
    # For MVP, we calculate based on current orderbook state (all open orders)
    # In production, we'd filter by time window using created_at
    
    # Sum all open buy volume (bid volume)
    buy_volume = 0.0
    for price_level in book.bids.values():
        for order in price_level:
            buy_volume += order.remaining
    
    # Sum all open sell volume (ask volume)
    sell_volume = 0.0
    for price_level in book.asks.values():
        for order in price_level:
            sell_volume += order.remaining
    
    # Net pressure: positive = more buying, negative = more selling
    net_pressure = buy_volume - sell_volume
    
    # Market price: mid-price if available, otherwise best bid or best ask
    market_price = calculate_market_price(book)
    
    return {
        "buy_volume": round(buy_volume, 2),
        "sell_volume": round(sell_volume, 2),
        "net_pressure": round(net_pressure, 2),
        "market_price": round(market_price, 2)
    }

def calculate_market_price(book: OrderBook) -> float:
    """
    Calculate current market price from orderbook.
    
    Uses mid-price (average of best bid and ask) if both sides exist.
    Otherwise uses best available price.
    
    Returns:
        Normalized price in 0-100 range
    """
    best_bid = book.bid_prices[0] if book.bid_prices else None
    best_ask = book.ask_prices[0] if book.ask_prices else None
    
    if best_bid is not None and best_ask is not None:
        # Mid-price
        return (best_bid + best_ask) / 2.0
    elif best_bid is not None:
        # Only bids, use best bid
        return best_bid
    elif best_ask is not None:
        # Only asks, use best ask
        return best_ask
    else:
        # Empty book, return middle of range
        return 50.0

def calculate_volume_weighted_price(book: OrderBook, side: str, depth: int = 5) -> Optional[float]:
    """
    Calculate volume-weighted average price for a side.
    
    Args:
        book: OrderBook instance
        side: "bid" or "ask"
        depth: Number of price levels to consider
        
    Returns:
        VWAP or None if no orders
    """
    total_volume = 0.0
    weighted_sum = 0.0
    
    if side == "bid":
        prices = book.bid_prices[:depth]
        levels = book.bids
    else:
        prices = book.ask_prices[:depth]
        levels = book.asks
    
    for price in prices:
        volume = sum(order.remaining for order in levels[price])
        weighted_sum += price * volume
        total_volume += volume
    
    if total_volume > 0:
        return weighted_sum / total_volume
    return None
