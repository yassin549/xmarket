"""
Tests for Orderbook API and Persistence
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from orderbook.main import app, get_db, ENGINE
from orderbook.models import Base, OrderSide, OrderType, OrderStatus
from orderbook.persistence import init_db

# Setup in-memory DB for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    # Clear engine state
    ENGINE.books = {}
    yield
    Base.metadata.drop_all(bind=engine)

def test_place_order_api():
    """Test placing an order via API."""
    payload = {
        "symbol": "TEST",
        "side": "buy",
        "type": "limit",
        "price": 100.0,
        "qty": 10.0,
        "user_id": "user1"
    }
    
    response = client.post("/orders", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["symbol"] == "TEST"
    assert data["status"] == "open"
    
    # Verify DB persistence
    db = TestingSessionLocal()
    from orderbook.models import OrderDB
    order = db.query(OrderDB).first()
    assert order is not None
    assert order.symbol == "TEST"
    db.close()

def test_match_order_persistence():
    """Test that matched orders update DB correctly."""
    # 1. Place Buy
    client.post("/orders", json={
        "symbol": "TEST", "side": "buy", "type": "limit",
        "price": 100.0, "qty": 10.0, "user_id": "user1"
    })
    
    # 2. Place Sell (Match)
    response = client.post("/orders", json={
        "symbol": "TEST", "side": "sell", "type": "limit",
        "price": 100.0, "qty": 5.0, "user_id": "user2"
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "filled"
    
    # Verify DB
    db = TestingSessionLocal()
    from orderbook.models import OrderDB, TradeDB
    
    # Check trades
    trades = db.query(TradeDB).all()
    assert len(trades) == 1
    assert trades[0].qty == 5.0
    
    # Check Buy Order (Partial)
    buy_order = db.query(OrderDB).filter(OrderDB.side == "buy").first()
    assert buy_order.filled == 5.0
    assert buy_order.status == "partial"
    
    # Check Sell Order (Filled)
    sell_order = db.query(OrderDB).filter(OrderDB.side == "sell").first()
    assert sell_order.filled == 5.0
    assert sell_order.status == "filled"
    
    db.close()

def test_cancel_order_api():
    """Test cancelling order via API."""
    # Place order
    resp = client.post("/orders", json={
        "symbol": "TEST", "side": "buy", "type": "limit",
        "price": 100.0, "qty": 10.0, "user_id": "user1"
    })
    order_id = resp.json()["order_id"]
    
    # Cancel
    resp = client.post(f"/cancel?symbol=TEST&order_id={order_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    
    # Verify DB
    db = TestingSessionLocal()
    from orderbook.models import OrderDB
    order = db.query(OrderDB).filter(OrderDB.order_id == order_id).first()
    assert order.status == "cancelled"
    db.close()

def test_snapshot_api():
    """Test snapshot endpoint."""
    client.post("/orders", json={
        "symbol": "TEST", "side": "buy", "type": "limit",
        "price": 100.0, "qty": 10.0, "user_id": "user1"
    })
    
    resp = client.get("/market/TEST/snapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["bids"]) == 1
    assert data["bids"][0]["price"] == 100.0
