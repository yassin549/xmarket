"""
Unit tests for orderbook matching engine.
"""
import pytest
from orderbook.app.matching_engine import OrderBook, Order, OrderSide, OrderType, OrderStatus
from datetime import datetime


def test_limit_order_matching():
    """Test basic limit order matching."""
    book = OrderBook("TEST")
    
    # Place buy order
    buy_order = Order(
        order_id="buy-1",
        user_id="user1",
        symbol="TEST",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=10.0,
        price=50.0
    )
    
    trades = book.add_order(buy_order)
    assert len(trades) == 0  # No match yet
    assert buy_order.status == OrderStatus.OPEN
    
    # Place matching sell order
    sell_order = Order(
        order_id="sell-1",
        user_id="user2",
        symbol="TEST",
        side=OrderSide.SELL,
        order_type=OrderType.LIMIT,
        quantity=10.0,
        price=50.0
    )
    
    trades = book.add_order(sell_order)
    assert len(trades) == 1  # Should match
    assert trades[0].quantity == 10.0
    assert trades[0].price == 50.0
    assert buy_order.status == OrderStatus.FILLED
    assert sell_order.status == OrderStatus.FILLED


def test_partial_fill():
    """Test partial order fills."""
    book = OrderBook("TEST")
    
    # Place large buy order
    buy_order = Order(
        order_id="buy-1",
        user_id="user1",
        symbol="TEST",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=100.0,
        price=50.0
    )
    book.add_order(buy_order)
    
    # Place smaller sell order
    sell_order = Order(
        order_id="sell-1",
        user_id="user2",
        symbol="TEST",
        side=OrderSide.SELL,
        order_type=OrderType.LIMIT,
        quantity=30.0,
        price=50.0
    )
    
    trades = book.add_order(sell_order)
    assert len(trades) == 1
    assert trades[0].quantity == 30.0
    assert buy_order.status == OrderStatus.PARTIAL
    assert buy_order.filled == 30.0
    assert buy_order.remaining == 70.0
    assert sell_order.status == OrderStatus.FILLED


def test_price_time_priority():
    """Test price-time priority matching."""
    book = OrderBook("TEST")
    
    # Place two buy orders at same price
    buy1 = Order("buy-1", "user1", "TEST", OrderSide.BUY, OrderType.LIMIT, 10.0, 50.0)
    buy2 = Order("buy-2", "user2", "TEST", OrderSide.BUY, OrderType.LIMIT, 10.0, 50.0)
    
    book.add_order(buy1)
    book.add_order(buy2)
    
    # Place sell order
    sell = Order("sell-1", "user3", "TEST", OrderSide.SELL, OrderType.LIMIT, 10.0, 50.0)
    trades = book.add_order(sell)
    
    # Should match with first buy order (FIFO)
    assert len(trades) == 1
    assert trades[0].buy_order_id == "buy-1"
    assert buy1.status == OrderStatus.FILLED
    assert buy2.status == OrderStatus.OPEN


def test_market_price_calculation():
    """Test market price computation."""
    book = OrderBook("TEST")
    
    # Add some orders
    book.add_order(Order("buy-1", "u1", "TEST", OrderSide.BUY, OrderType.LIMIT, 10.0, 49.0))
    book.add_order(Order("sell-1", "u2", "TEST", OrderSide.SELL, OrderType.LIMIT, 10.0, 51.0))
    
    market_price = book.compute_market_price()
    
    # Mid price should be (49 + 51) / 2 = 50
    assert market_price == 50.0


def test_order_cancellation():
    """Test order cancellation."""
    book = OrderBook("TEST")
    
    order = Order("order-1", "user1", "TEST", OrderSide.BUY, OrderType.LIMIT, 10.0, 50.0)
    book.add_order(order)
    
    success = book.cancel_order("order-1")
    assert success is True
    assert order.status == OrderStatus.CANCELLED
    
    # Try to cancel again
    success = book.cancel_order("order-1")
    assert success is False
