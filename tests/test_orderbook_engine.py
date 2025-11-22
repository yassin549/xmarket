"""
Tests for Orderbook Matching Engine
"""

import pytest
from uuid import uuid4
from orderbook.engine import Engine, OrderBook, Order
from orderbook.models import OrderSide, OrderType, OrderStatus, OrderCreate

@pytest.fixture
def engine():
    return Engine()

def test_place_limit_buy(engine):
    """Test placing a limit buy order that sits in the book."""
    order_create = OrderCreate(
        symbol="TEST",
        side=OrderSide.BUY,
        type=OrderType.LIMIT,
        price=100.0,
        qty=10.0,
        user_id="user1"
    )
    
    resp, trades = engine.place_order(order_create)
    
    assert resp.status == OrderStatus.OPEN
    assert resp.filled == 0.0
    assert len(trades) == 0
    
    book = engine.get_book("TEST")
    assert len(book.bids) == 1
    assert book.bid_prices == [100.0]

def test_match_limit_sell(engine):
    """Test matching a sell order against existing buy."""
    # 1. Place Buy
    buy_order = OrderCreate(
        symbol="TEST",
        side=OrderSide.BUY,
        type=OrderType.LIMIT,
        price=100.0,
        qty=10.0,
        user_id="user1"
    )
    engine.place_order(buy_order)
    
    # 2. Place Sell (matching)
    sell_order = OrderCreate(
        symbol="TEST",
        side=OrderSide.SELL,
        type=OrderType.LIMIT,
        price=100.0,
        qty=5.0,
        user_id="user2"
    )
    
    resp, trades = engine.place_order(sell_order)
    
    assert resp.status == OrderStatus.FILLED
    assert len(trades) == 1
    assert trades[0].qty == 5.0
    assert trades[0].price == 100.0
    
    # Check book state
    book = engine.get_book("TEST")
    assert len(book.bids[100.0]) == 1
    remaining_buy = book.bids[100.0][0]
    assert remaining_buy.remaining == 5.0
    assert remaining_buy.status == OrderStatus.PARTIAL

def test_price_time_priority(engine):
    """Test that better price gets filled first, then earlier time."""
    # Bids: 100 (user1), 101 (user2), 100 (user3)
    
    # 1. User1 @ 100
    engine.place_order(OrderCreate(symbol="TEST", side=OrderSide.BUY, type=OrderType.LIMIT, price=100.0, qty=10.0, user_id="user1"))
    
    # 2. User2 @ 101 (Better price)
    engine.place_order(OrderCreate(symbol="TEST", side=OrderSide.BUY, type=OrderType.LIMIT, price=101.0, qty=10.0, user_id="user2"))
    
    # 3. User3 @ 100 (Same price as user1, but later)
    engine.place_order(OrderCreate(symbol="TEST", side=OrderSide.BUY, type=OrderType.LIMIT, price=100.0, qty=10.0, user_id="user3"))
    
    # Sell 25 @ 99 (Should wipe out 101, then 100(user1), then partial 100(user3))
    sell_order = OrderCreate(symbol="TEST", side=OrderSide.SELL, type=OrderType.LIMIT, price=99.0, qty=25.0, user_id="seller")
    
    resp, trades = engine.place_order(sell_order)
    
    assert len(trades) == 3
    
    # Trade 1: User2 @ 101 (10 qty)
    assert trades[0].price == 101.0
    assert trades[0].qty == 10.0
    
    # Trade 2: User1 @ 100 (10 qty) - Time priority over User3
    assert trades[1].price == 100.0
    assert trades[1].qty == 10.0
    
    # Trade 3: User3 @ 100 (5 qty)
    assert trades[2].price == 100.0
    assert trades[2].qty == 5.0

def test_cancel_order(engine):
    """Test cancelling an order."""
    order_create = OrderCreate(
        symbol="TEST",
        side=OrderSide.BUY,
        type=OrderType.LIMIT,
        price=100.0,
        qty=10.0,
        user_id="user1"
    )
    
    resp, _ = engine.place_order(order_create)
    order_id = str(resp.order_id)
    
    # Cancel
    cancelled = engine.cancel_order("TEST", order_id)
    assert cancelled is not None
    assert cancelled.status == OrderStatus.CANCELLED
    
    # Check book
    book = engine.get_book("TEST")
    assert 100.0 not in book.bids

def test_partial_fill_cancel(engine):
    """Test cancelling a partially filled order."""
    # Buy 10
    resp_buy, _ = engine.place_order(OrderCreate(symbol="TEST", side=OrderSide.BUY, type=OrderType.LIMIT, price=100.0, qty=10.0, user_id="user1"))
    
    # Sell 5 (matches)
    engine.place_order(OrderCreate(symbol="TEST", side=OrderSide.SELL, type=OrderType.LIMIT, price=100.0, qty=5.0, user_id="user2"))
    
    # Cancel remainder of buy
    cancelled = engine.cancel_order("TEST", str(resp_buy.order_id))
    
    assert cancelled.status == OrderStatus.CANCELLED
    assert cancelled.filled == 5.0
    assert cancelled.qty == 10.0
    
    book = engine.get_book("TEST")
    assert 100.0 not in book.bids
