"""
Tests for Admin API
===================

Tests admin endpoints for stock management and audit approval.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.main import app
from database import get_db_session

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

# Mock admin key
ADMIN_KEY = "test-admin-key"

app.dependency_overrides[get_db_session] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    """Create test database with schema."""
    with engine.connect() as conn:
        # Create stocks table
        conn.execute(text("""
            CREATE TABLE stocks (
                symbol TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                market_weight REAL,
                reality_weight REAL,
                min_price REAL,
                max_price REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Create scores table
        conn.execute(text("""
            CREATE TABLE scores (
                symbol TEXT PRIMARY KEY,
                reality_score REAL,
                final_price REAL,
                confidence REAL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # Create llm_audit table  
        conn.execute(text("""
            CREATE TABLE llm_audit (
                id TEXT PRIMARY KEY,
                event_id TEXT,
                symbol TEXT,
                summary TEXT,
                impact REAL,
                sources TEXT,
                approved BOOLEAN DEFAULT 0,
                approved_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP
            )
        """))
        
        # Create events table
        conn.execute(text("""
            CREATE TABLE events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT UNIQUE,
                symbol TEXT,
                impact_points REAL,
                processed BOOLEAN DEFAULT 0
            )
        """))
        
        # Create llm_calls table
        conn.execute(text("""
            CREATE TABLE llm_calls (
                id TEXT PRIMARY KEY,
                event_id TEXT,
                llm_mode TEXT,
                input_hash TEXT,
                output_json TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        conn.commit()
    
    yield
    
    # Cleanup
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS llm_calls"))
        conn.execute(text("DROP TABLE IF EXISTS events"))
        conn.execute(text("DROP TABLE IF EXISTS llm_audit"))
        conn.execute(text("DROP TABLE IF EXISTS scores"))
        conn.execute(text("DROP TABLE IF EXISTS stocks"))
        conn.commit()

def test_create_stock_no_auth():
    """Test stock creation fails without admin key."""
    response = client.post("/api/v1/admin/stocks", json={
        "symbol": "TEST",
        "name": "Test Stock",
        "market_weight": 0.5,
    with patch("backend.admin.get_admin_api_key", return_value=ADMIN_KEY):
        response = client.post(
            "/api/v1/admin/stocks",
            json={
                "symbol": "TECH",
                "name": "Technology Sector",
                "description": "Tech companies",
                "market_weight": 0.6,
                "reality_weight": 0.4,
                "min_price":  0.0,
                "max_price": 100.0
            },
            headers={"X-Admin-Key": ADMIN_KEY}
        )
    
    assert response.status_code == 201
    data = response.json()
    assert data["symbol"] == "TECH"
    assert data["name"] == "Technology Sector"
    assert data["market_weight"] == 0.6
    
    # Verify score was initialized
    db = TestingSessionLocal()
    score = db.execute(text("SELECT reality_score FROM scores WHERE symbol = 'TECH'")).fetchone()
    assert score is not None
    assert score[0] == 50.0  # (0 + 100) / 2
    db.close()

def test_create_stock_duplicate():
    """Test creating duplicate stock fails."""
    from unittest.mock import patch
    
    with patch("backend.admin.get_admin_api_key", return_value=ADMIN_KEY):
        # Create first
        client.post(
            "/api/v1/admin/stocks",
            json={"symbol": "DUP", "name": "Duplicate", "market_weight": 0.5, "reality_weight": 0.5},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        # Try to create again
        response = client.post(
            "/api/v1/admin/stocks",
            json={"symbol": "DUP", "name": "Duplicate", "market_weight": 0.5, "reality_weight": 0.5},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
    
    assert response.status_code == 409

def test_list_stocks():
    """Test listing stocks."""
    from unittest.mock import patch
    
    # Create some stocks
    with patch("backend.admin.get_admin_api_key", return_value=ADMIN_KEY):
        client.post(
            "/api/v1/admin/stocks",
            json={"symbol": "TECH", "name": "Tech", "market_weight": 0.5, "reality_weight": 0.5},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        client.post(
            "/api/v1/admin/stocks",
            json={"symbol": "HEALTH", "name": "Health", "market_weight": 0.5, "reality_weight": 0.5},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
        
        # List stocks
        response = client.get("/api/v1/admin/stocks", headers={"X-Admin-Key": ADMIN_KEY})
    
    assert response.status_code == 200
    stocks = response.json()
    assert len(stocks) == 2
    assert any(s["symbol"] == "TECH" for s in stocks)
    assert any(s["symbol"] == "HEALTH" for s in stocks)

def test_list_audits():
    """Test listing audit items."""
    from unittest.mock import patch
    
    # Insert test audit
    db = TestingSessionLocal()
    db.execute(text("""
        INSERT INTO llm_audit (id, event_id, symbol, summary, impact, sources, approved)
        VALUES ('audit-1', 'event-1', 'TEST', 'Test event', 18.0, '{}', 0)
    """))
    db.commit()
    db.close()
    
    with patch("backend.admin.get_admin_api_key", return_value=ADMIN_KEY):
        response = client.get("/api/v1/admin/audits", headers={"X-Admin-Key": ADMIN_KEY})
    
    assert response.status_code == 200
    audits = response.json()
    assert len(audits) == 1
    assert audits[0]["id"] == "audit-1"
    assert audits[0]["approved"] == False

def test_approve_audit():
    """Test approving an audit item."""
    from unittest.mock import patch
    
    # Insert test audit and event
    db = TestingSessionLocal()
    db.execute(text("""
        INSERT INTO llm_audit (id, event_id, symbol, summary, impact, sources, approved)
        VALUES ('audit-2', 'event-2', 'TEST', 'Test event', 18.0, '{}', 0)
    """))
    db.execute(text("""
        INSERT INTO events (event_id, symbol, impact_points, processed)
        VALUES ('event-2', 'TEST', 18.0, 0)
    """))
    db.commit()
    db.close()
    
    with patch("backend.admin.get_admin_api_key", return_value=ADMIN_KEY):
        response = client.post(
            "/api/v1/admin/audits/audit-2/approve",
            json={"approved": True, "approved_by": "admin1"},
            headers={"X-Admin-Key": ADMIN_KEY}
        )
    
    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    
    # Verify audit was updated
    db = TestingSessionLocal()
    audit = db.execute(text("SELECT approved, approved_by FROM llm_audit WHERE id = 'audit-2'")).fetchone()
    assert audit[0] == 1  # approved
    assert audit[1] == "admin1"
    db.close()
