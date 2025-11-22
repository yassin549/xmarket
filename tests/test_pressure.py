"""
Tests for Market Pressure Calculation
"""

import pytest
from datetime import datetime, timezone
from orderbook.engine import OrderBook, Order
from orderbook.models import OrderSide
from orderbook.pressure import calculate_pressure, calculate_market_price, calculate_volume_weighted_price

def test_calculate_pressure_balanced():
    """Test pressure calculation with balanced book."""
    book = OrderBook("TEST")
    
    # Add equal buy and sell volume
    buy_order = Order("buy1", OrderSide.BUY, 100.0, 10.0, "user1", datetime.now(timezone.utc))
    sell_order = Order("sell1", OrderSide.SELL, 100.0, 10.0, "user2", datetime.now(timezone.utc))
    
    book._add_to_book(buy_order)
    book.orders["buy1"] = buy_order
    book._add_to_book(sell_order)
    book.orders["sell1"] = sell_order
    
    pressure = calculate_pressure(book)
    
    assert pressure["buy_volume"] == 10.0
    assert pressure["sell_volume"] == 10.0
    assert pressure["net_pressure"] == 0.0
    assert pressure["market_price"] == 100.0 # Mid-price

def test_calculate_pressure_net_buying():
    """Test pressure with more buying than selling."""
    book = OrderBook("TEST")
    
    # More buy volume
    buy1 = Order("buy1", OrderSide.BUY, 100.0, 20.0, "user1", datetime.now(timezone.utc))
    buy2 = Order("buy2", OrderSide.BUY, 99.0, 15.0, "user2", datetime.now(timezone.utc))
    sell1 = Order("sell1", OrderSide.SELL, 101.0, 10.0, "user3", datetime.now(timezone.utc))
    
    for order in [buy1, buy2, sell1]:
        book._add_to_book(order)
        book.orders[order.order_id] = order
    
    pressure = calculate_pressure(book)
    
    assert pressure["buy_volume"] == 35.0
    assert pressure["sell_volume"] == 10.0
    assert pressure["net_pressure"] == 25.0 # Positive = buying pressure

def test_calculate_market_price_mid():
    """Test market price calculation with both sides."""
    book = OrderBook("TEST")
    
    buy = Order("buy1", OrderSide.BUY, 98.0, 10.0, "user1", datetime.now(timezone.utc))
    sell = Order("sell1", OrderSide.SELL, 102.0, 10.0, "user2", datetime.now(timezone.utc))
    
    book._add_to_book(buy)
    book._add_to_book(sell)
    
    price = calculate_market_price(book)
    assert price == 100.0 # (98 + 102) / 2

def test_calculate_market_price_bids_only():
    """Test market price with only bids."""
    book = OrderBook("TEST")
    
    buy = Order("buy1", OrderSide.BUY, 95.0, 10.0, "user1", datetime.now(timezone.utc))
    book._add_to_book(buy)
    
    price = calculate_market_price(book)
    assert price == 95.0

def test_calculate_market_price_asks_only():
    """Test market price with only asks."""
    book = OrderBook("TEST")
    
    sell = Order("sell1", OrderSide.SELL, 105.0, 10.0, "user1", datetime.now(timezone.utc))
    book._add_to_book(sell)
    
    price = calculate_market_price(book)
    assert price == 105.0

def test_calculate_market_price_empty():
    """Test market price with empty book."""
    book = OrderBook("TEST")
    
    price = calculate_market_price(book)
    assert price == 50.0 # Default middle

def test_volume_weighted_price():
    """Test VWAP calculation."""
    book = OrderBook("TEST")
    
    # Multiple bid levels
    buy1 = Order("buy1", OrderSide.BUY, 100.0, 10.0, "user1", datetime.now(timezone.utc))
    buy2 = Order("buy2", OrderSide.BUY, 99.0, 20.0, "user2", datetime.now(timezone.utc))
    buy3 = Order("buy3", OrderSide.BUY, 98.0, 30.0, "user3", datetime.now(timezone.utc))
    
    for order in [buy1, buy2, buy3]:
        book._add_to_book(order)
    
    vwap = calculate_volume_weighted_price(book, "bid", depth=3)
    
    # (100*10 + 99*20 + 98*30) / (10+20+30) = 98.67
    expected = (100*10 + 99*20 + 98*30) / 60
    assert abs(vwap - expected) < 0.01

def test_pressure_deterministic():
    """Test that pressure calculation is deterministic."""
    book = OrderBook("TEST")
    
    buy = Order("buy1", OrderSide.BUY, 100.0, 10.0, "user1", datetime.now(timezone.utc))
    sell = Order("sell1", OrderSide.SELL, 102.0, 5.0, "user2", datetime.now(timezone.utc))
    
    book._add_to_book(buy)
    book.orders["buy1"] = buy
    book._add_to_book(sell)
    book.orders["sell1"] = sell
    
    # Multiple calls should give same result
    pressure1 = calculate_pressure(book)
    pressure2 = calculate_pressure(book)
    
    assert pressure1 == pressure2
    assert pressure1["market_price"] == 101.0 # (100+102)/2
