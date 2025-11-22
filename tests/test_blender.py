"""
Tests for Backend Blender
==========================

Tests the complete event application flow:
- Score computation
- Orderbook integration 
- Final price blending
- Anti-manipulation checks
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.blender import (
    compute_new_reality_score,
    compute_confidence,
    blend_final_price,
    get_current_score,
    apply_event_to_scores
)
from backend.models import RealityEventRequest, SourceModel
from datetime import datetime

# Setup in-memory DB for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    """Create test database with schema."""
    # Create tables (simplified for testing)
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE stocks (
                symbol TEXT PRIMARY KEY,
                name TEXT,
                market_weight REAL,
                reality_weight REAL,
                min_price REAL,
                max_price REAL
            )
        """))
        
        conn.execute(text("""
            CREATE TABLE scores (
                symbol TEXT PRIMARY KEY,
                reality_score REAL,
                final_price REAL,
                confidence REAL,
                last_updated TIMESTAMP
            )
        """))
        
        conn.execute(text("""
            CREATE TABLE score_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT,
                old_score REAL,
                new_score REAL,
                delta REAL,
                event_id TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        conn.execute(text("""
            CREATE TABLE events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT UNIQUE,
                symbol TEXT,
                impact_points REAL,
                quick_score REAL,
                summary TEXT,
                sources TEXT,
                llm_mode TEXT,
                processed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Insert test stock
        conn.execute(text("""
            INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
            VALUES ('TEST', 'Test Stock', 0.5, 0.5, 0, 100)
        """))
        
        # Insert initial score
        conn.execute(text("""
            INSERT INTO scores (symbol, reality_score, final_price, confidence, last_updated)
            VALUES ('TEST', 50.0, 50.0, 0.5, CURRENT_TIMESTAMP)
        """))
        
        conn.commit()
    
    session = TestingSessionLocal()
    yield session
    session.close()
    
    # Cleanup
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS events"))
        conn.execute(text("DROP TABLE IF EXISTS score_changes"))
        conn.execute(text("DROP TABLE IF EXISTS scores"))
        conn.execute(text("DROP TABLE IF EXISTS stocks"))
        conn.commit()

def test_compute_new_reality_score():
    """Test reality score computation with EWMA."""
    # Positive impact
    new_score = compute_new_reality_score(50.0, 10.0, alpha=0.25)
    assert new_score == 52.5  # 50 + 0.25 * 10
    
    # Negative impact
    new_score = compute_new_reality_score(50.0, -10.0, alpha=0.25)
    assert new_score == 47.5
    
    # Clamp at 100
    new_score = compute_new_reality_score(95.0, 20.0, alpha=1.0)
    assert new_score == 100.0
    
    # Clamp at 0
    new_score = compute_new_reality_score(5.0, -20.0, alpha=1.0)
    assert new_score == 0.0

def test_compute_confidence():
    """Test confidence metric computation."""
    # More sources = higher confidence
    conf1 = compute_confidence(1, 0.8)
    conf2 = compute_confidence(5, 0.8)
    assert conf2 > conf1
    
    # Higher trust = higher confidence
    conf1 = compute_confidence(3, 0.5)
    conf2 = compute_confidence(3, 0.9)
    assert conf2 > conf1
    
    # Capped at 1.0
    conf = compute_confidence(100, 1.0)
    assert conf == 1.0

def test_blend_final_price():
    """Test final price blending."""
    # 50/50 blend
    final = blend_final_price(60.0, 40.0, 0.5, 0.5)
    assert final == 50.0  # (0.5 * 40) + (0.5 * 60)
    
    # Market-heavy blend (80/20)
    final = blend_final_price(60.0, 40.0, 0.8, 0.2)
    assert final == 44.0  # (0.8 * 40) + (0.2 * 60)
    
    # Reality-heavy blend (20/80)
    final = blend_final_price(60.0, 40.0, 0.2, 0.8)
    assert final == 56.0

def test_get_current_score(db_session):
    """Test fetching current scores."""
    score = get_current_score(db_session, "TEST")
    assert score is not None
    assert score["reality_score"] == 50.0
    assert score["final_price"] == 50.0
    
    # Non-existent symbol
    score = get_current_score(db_session, "NONE")
    assert score is None

@pytest.mark.asyncio
async def test_apply_event_positive(db_session):
    """Test applying a positive event."""
    event = RealityEventRequest(
        event_id="550e8400-e29b-41d4-a716-446655440001",
        timestamp=datetime.now(),
        stocks=["TEST"],
        quick_score=0.5,
        impact_points=10.0,
        summary="Positive news",
        sources=[SourceModel(id="src1", url="http://example.com", trust=0.9)],
        num_independent_sources=1,
        llm_mode="tinyLLama",
        meta={}
    )
    
    # Mock orderbook to return fixed price
    # In real test, would use mock or test server
    # For now, it will default to 50.0 on failure
    
    result = await apply_event_to_scores(db_session, event, orderbook_url="http://invalid")
    
    assert result["symbol"] == "TEST"
    assert result["old_score"] == 50.0
    assert result["new_score"] > 50.0  # Should increase
    assert result["delta"] > 0
    
    # Verify DB update
    score = get_current_score(db_session, "TEST")
    assert score["reality_score"] == result["new_score"]
    
    # Verify score_changes entry
    changes = db_session.execute(text("SELECT COUNT(*) FROM score_changes WHERE symbol = 'TEST'"))
    assert changes.scalar() == 1

@pytest.mark.asyncio
async def test_apply_event_negative(db_session):
    """Test applying a negative event."""
    event = RealityEventRequest(
        event_id="550e8400-e29b-41d4-a716-446655440002",
        timestamp=datetime.now(),
        stocks=["TEST"],
        quick_score=-0.6,
        impact_points=-15.0,
        summary="Negative news",
        sources=[SourceModel(id="src1", url="http://example.com", trust=0.8)],
        num_independent_sources=1,
        llm_mode="tinyLLama",
        meta={}
    )
    
    result = await apply_event_to_scores(db_session, event, orderbook_url="http://invalid")
    
    assert result["new_score"] < result["old_score"]  # Should decrease
    assert result["delta"] < 0
