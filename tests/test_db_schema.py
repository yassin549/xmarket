"""
Tests for database schema validation.
Tests Prompt #3 acceptance criteria from prompts.txt.

These tests validate:
- All 8 tables exist
- Primary keys are correct
- Foreign keys enforce referential integrity
- Unique constraints work
- Check constraints prevent invalid data
- Indexes exist for performance
- ENUMs work correctly
- JSONB columns store/retrieve JSON
- Default values work (UUIDs, timestamps)
"""

import pytest
import os
from datetime import datetime
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import IntegrityError, CheckViolation
from contextlib import contextmanager

# We'll use a test database URL or skip tests if not available
TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL') or os.getenv('DATABASE_URL')

# Skip all tests if no database URL
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL or DATABASE_URL not set"
)


@pytest.fixture(scope="module")
def engine():
    """Create test database engine."""
    if not TEST_DATABASE_URL:
        pytest.skip("No database URL configured")
    return create_engine(TEST_DATABASE_URL)


@pytest.fixture(scope="function")
def conn(engine):
    """Create a connection with transaction rollback."""
    connection = engine.connect()
    transaction = connection.begin()
    yield connection
    transaction.rollback()
    connection.close()


@contextmanager
def expect_integrity_error():
    """Context manager to expect IntegrityError or CheckViolation."""
    with pytest.raises((IntegrityError, CheckViolation)):
        yield


# ============================================================================
# Test: Table Existence
# ============================================================================

class TestTableExistence:
    """Test that all required tables exist."""
    
    def test_all_tables_exist(self, engine):
        """Test that all 8 core tables exist."""
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        expected_tables = [
            'stocks',
            'scores',
            'events',
            'llm_calls',
            'llm_audit',
            'score_changes',
            'orders',
            'trade_history'
        ]
        
        for table in expected_tables:
            assert table in tables, f"Table '{table}' not found"
    
    def test_table_count(self, engine):
        """Test that exactly 8 tables exist (no extra tables)."""
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert len(tables) == 8, f"Expected 8 tables, found {len(tables)}: {tables}"


# ============================================================================
# Test: Primary Keys
# ============================================================================

class TestPrimaryKeys:
    """Test that all tables have correct primary keys."""
    
    def test_stocks_pk(self, engine):
        """Test stocks table PK is symbol."""
        inspector = inspect(engine)
        pk = inspector.get_pk_constraint('stocks')
        assert pk['constrained_columns'] == ['symbol']
    
    def test_scores_pk(self, engine):
        """Test scores table PK is symbol."""
        inspector = inspect(engine)
        pk = inspector.get_pk_constraint('scores')
        assert pk['constrained_columns'] == ['symbol']
    
    def test_events_pk(self, engine):
        """Test events table PK is id (UUID)."""
        inspector = inspect(engine)
        pk = inspector.get_pk_constraint('events')
        assert pk['constrained_columns'] == ['id']
    
    def test_orders_pk(self, engine):
        """Test orders table PK is order_id (UUID)."""
        inspector = inspect(engine)
        pk = inspector.get_pk_constraint('orders')
        assert pk['constrained_columns'] == ['order_id']


# ============================================================================
# Test: Foreign Keys
# ============================================================================

class TestForeignKeys:
    """Test that foreign key constraints are enforced."""
    
    def test_scores_fk_to_stocks(self, conn):
        """Test scores.symbol references stocks.symbol."""
        # Insert stock
        conn.execute(text("""
            INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
            VALUES ('TEST', 'Test Stock', 0.5, 0.5, 0, 100)
        """))
        conn.commit()
        
        # Insert score - should work
        conn.execute(text("""
            INSERT INTO scores (symbol, reality_score, final_price, confidence)
            VALUES ('TEST', 50.0, 50.0, 0.9)
        """))
        conn.commit()
        
        # Try to insert score for non-existent stock - should fail
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO scores (symbol, reality_score, final_price, confidence)
                VALUES ('NONEXISTENT', 50.0, 50.0, 0.9)
            """))
            conn.commit()
    
    def test_llm_calls_fk_to_events(self, conn):
        """Test llm_calls.event_id references events.event_id."""
        # Insert event
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points)
            VALUES ('event_123', 'SYM', 10.0)
        """))
        conn.commit()
        
        # Insert llm_call - should work
        conn.execute(text("""
            INSERT INTO llm_calls (event_id, llm_mode, input_hash)
            VALUES ('event_123', 'tinyLLama', 'hash123')
        """))
        conn.commit()
        
        # Try with non-existent event_id - should fail
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO llm_calls (event_id, llm_mode, input_hash)
                VALUES ('nonexistent', 'tinyLLama', 'hash456')
            """))
            conn.commit()
    
    def test_cascade_delete_events(self, conn):
        """Test that deleting an event cascades to llm_calls."""
        # Insert event
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points)
            VALUES ('event_cascade', 'SYM', 10.0)
        """))
        conn.commit()
        
        # Insert llm_call
        conn.execute(text("""
            INSERT INTO llm_calls (event_id, llm_mode, input_hash)
            VALUES ('event_cascade', 'tinyLLama', 'hash123')
        """))
        conn.commit()
        
        # Delete event
        conn.execute(text("DELETE FROM events WHERE event_id = 'event_cascade'"))
        conn.commit()
        
        # llm_call should be gone (CASCADE)
        result = conn.execute(text("""
            SELECT COUNT(*) FROM llm_calls WHERE event_id = 'event_cascade'
        """))
        assert result.scalar() == 0


# ============================================================================
# Test: Unique Constraints
# ============================================================================

class TestUniqueConstraints:
    """Test that unique constraints are enforced."""
    
    def test_events_event_id_unique(self, conn):
        """Test that events.event_id is unique."""
        # Insert first event
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points)
            VALUES ('unique_event', 'SYM', 10.0)
        """))
        conn.commit()
        
        # Try to insert duplicate event_id - should fail
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO events (event_id, symbol, impact_points)
                VALUES ('unique_event', 'SYM2', 15.0)
            """))
            conn.commit()
    
    def test_stocks_symbol_unique(self, conn):
        """Test that stocks.symbol is unique (PK)."""
        # Insert stock
        conn.execute(text("""
            INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
            VALUES ('UNIQ', 'Test', 0.5, 0.5, 0, 100)
        """))
        conn.commit()
        
        # Try duplicate - should fail
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
                VALUES ('UNIQ', 'Another Test', 0.5, 0.5, 0, 100)
            """))
            conn.commit()


# ============================================================================
# Test: Check Constraints
# ============================================================================

class TestCheckConstraints:
    """Test that check constraints prevent invalid data."""
    
    def test_market_weight_range(self, conn):
        """Test market_weight must be between 0 and 1."""
        # Valid value
        conn.execute(text("""
            INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
            VALUES ('VALID', 'Test', 0.7, 0.3, 0, 100)
        """))
        conn.commit()
        
        # Invalid: > 1
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
                VALUES ('INVALID1', 'Test', 1.5, 0.5, 0, 100)
            """))
            conn.commit()
        
        # Invalid: < 0
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
                VALUES ('INVALID2', 'Test', -0.1, 0.5, 0, 100)
            """))
            conn.commit()
    
    def test_reality_score_range(self, conn):
        """Test reality_score must be between 0 and 100."""
        # Insert stock first
        conn.execute(text("""
            INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
            VALUES ('TEST', 'Test', 0.5, 0.5, 0, 100)
        """))
        conn.commit()
        
        # Valid
        conn.execute(text("""
            INSERT INTO scores (symbol, reality_score, final_price, confidence)
            VALUES ('TEST', 75.0, 75.0, 0.9)
        """))
        conn.commit()
        
        # Invalid: > 100
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO scores (symbol, reality_score, final_price, confidence)
                VALUES ('TEST', 150.0, 75.0, 0.9)
            """))
            conn.commit()
    
    def test_min_max_price_relationship(self, conn):
        """Test max_price >= min_price."""
        # Valid
        conn.execute(text("""
            INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
            VALUES ('VALID_PRICE', 'Test', 0.5, 0.5, 10, 100)
        """))
        conn.commit()
        
        # Invalid: max < min
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO stocks (symbol, name, market_weight, reality_weight, min_price, max_price)
                VALUES ('INVALID_PRICE', 'Test', 0.5, 0.5, 100, 10)
            """))
            conn.commit()
    
    def test_order_qty_positive(self, conn):
        """Test order qty must be positive."""
        # Valid
        conn.execute(text("""
            INSERT INTO orders (user_id, symbol, side, type, price, qty)
            VALUES ('user1', 'SYM', 'buy', 'limit', 50.0, 10.0)
        """))
        conn.commit()
        
        # Invalid: qty = 0
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO orders (user_id, symbol, side, type, price, qty)
                VALUES ('user1', 'SYM', 'buy', 'limit', 50.0, 0)
            """))
            conn.commit()
        
        # Invalid: qty < 0
        with expect_integrity_error():
            conn.execute(text("""
                INSERT INTO orders (user_id, symbol, side, type, price, qty)
                VALUES ('user1', 'SYM', 'buy', 'limit', 50.0, -5.0)
            """))
            conn.commit()


# ============================================================================
# Test: Indexes
# ============================================================================

class TestIndexes:
    """Test that performance indexes exist."""
    
    def test_events_event_id_index(self, engine):
        """Test index exists on events.event_id."""
        inspector = inspect(engine)
        indexes = inspector.get_indexes('events')
        index_columns = [idx['column_names'] for idx in indexes]
        assert ['event_id'] in index_columns
    
    def test_scores_symbol_index(self, engine):
        """Test index exists on scores.symbol."""
        inspector = inspect(engine)
        indexes = inspector.get_indexes('scores')
        index_columns = [idx['column_names'] for idx in indexes]
        # Symbol is PK so it has an index
        assert any('symbol' in cols for cols in index_columns)
    
    def test_orders_symbol_index(self, engine):
        """Test index exists on orders.symbol."""
        inspector = inspect(engine)
        indexes = inspector.get_indexes('orders')
        index_columns = [idx['column_names'] for idx in indexes]
        assert ['symbol'] in index_columns


# ============================================================================
# Test: ENUMs
# ============================================================================

class TestEnums:
    """Test that ENUM types work correctly."""
    
    def test_order_side_enum(self, conn):
        """Test order_side enum ('buy', 'sell')."""
        # Valid: buy
        conn.execute(text("""
            INSERT INTO orders (user_id, symbol, side, type, qty)
            VALUES ('user1', 'SYM', 'buy', 'market', 10.0)
        """))
        conn.commit()
        
        # Valid: sell
        conn.execute(text("""
            INSERT INTO orders (user_id, symbol, side, type, qty)
            VALUES ('user1', 'SYM', 'sell', 'market', 10.0)
        """))
        conn.commit()
        
        # Invalid value should fail
        with pytest.raises(Exception):  # Can be DataError or ProgrammingError
            conn.execute(text("""
                INSERT INTO orders (user_id, symbol, side, type, qty)
                VALUES ('user1', 'SYM', 'invalid', 'market', 10.0)
            """))
            conn.commit()
    
    def test_order_type_enum(self, conn):
        """Test order_type enum ('limit', 'market')."""
        conn.execute(text("""
            INSERT INTO orders (user_id, symbol, side, type, qty)
            VALUES ('user1', 'SYM', 'buy', 'limit', 10.0)
        """))
        conn.commit()
        
        conn.execute(text("""
            INSERT INTO orders (user_id, symbol, side, type, qty)
            VALUES ('user1', 'SYM', 'buy', 'market', 10.0)
        """))
        conn.commit()
    
    def test_order_status_enum(self, conn):
        """Test order_status enum values."""
        valid_statuses = ['open', 'filled', 'partially_filled', 'cancelled']
        
        for status in valid_statuses:
            conn.execute(text(f"""
                INSERT INTO orders (user_id, symbol, side, type, qty, status)
                VALUES ('user1', 'SYM', 'buy', 'market', 10.0, '{status}')
            """))
            conn.commit()


# ============================================================================
# Test: JSONB Columns
# ============================================================================

class TestJsonbColumns:
    """Test that JSONB columns work correctly."""
    
    def test_events_sources_jsonb(self, conn):
        """Test events.sources can store and retrieve JSON."""
        import json
        
        sources_data = [
            {"id": "src1", "url": "https://example.com", "trust": 0.95},
            {"id": "src2", "url": "https://example.org", "trust": 0.85}
        ]
        
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points, sources)
            VALUES (:event_id, :symbol, :impact, :sources::jsonb)
        """), {
            "event_id": "json_test",
            "symbol": "SYM",
            "impact": 10.0,
            "sources": json.dumps(sources_data)
        })
        conn.commit()
        
        # Retrieve and verify
        result = conn.execute(text("""
            SELECT sources FROM events WHERE event_id = 'json_test'
        """))
        row = result.fetchone()
        retrieved = row[0]
        
        assert len(retrieved) == 2
        assert retrieved[0]["id"] == "src1"
        assert retrieved[1]["trust"] == 0.85
    
    def test_llm_calls_output_json(self, conn):
        """Test llm_calls.output_json JSONB column."""
        import json
        
        # Insert event first
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points)
            VALUES ('llm_json_test', 'SYM', 10.0)
        """))
        conn.commit()
        
        output_data = {
            "summary": "Test summary",
            "impact_suggestion": 15.5,
            "confidence": 0.87
        }
        
        conn.execute(text("""
            INSERT INTO llm_calls (event_id, llm_mode, input_hash, output_json)
            VALUES (:event_id, :mode, :hash, :output::jsonb)
        """), {
            "event_id": "llm_json_test",
            "mode": "tinyLLama",
            "hash": "hash123",
            "output": json.dumps(output_data)
        })
        conn.commit()
        
        # Retrieve
        result = conn.execute(text("""
            SELECT output_json FROM llm_calls WHERE event_id = 'llm_json_test'
        """))
        row = result.fetchone()
        retrieved = row[0]
        
        assert retrieved["summary"] == "Test summary"
        assert retrieved["impact_suggestion"] == 15.5


# ============================================================================
# Test: Default Values
# ============================================================================

class TestDefaultValues:
    """Test that default values work correctly."""
    
    def test_uuid_generation(self, conn):
        """Test that UUID columns auto-generate values."""
        # Insert event without specifying id
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points)
            VALUES ('uuid_test', 'SYM', 10.0)
        """))
        conn.commit()
        
        result = conn.execute(text("""
            SELECT id FROM events WHERE event_id = 'uuid_test'
        """))
        row = result.fetchone()
        uuid_value = row[0]
        
        # Should be a valid UUID
        assert uuid_value is not None
        assert len(str(uuid_value)) == 36  # UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    
    def test_timestamp_defaults(self, conn):
        """Test that timestamp columns default to now()."""
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points)
            VALUES ('timestamp_test', 'SYM', 10.0)
        """))
        conn.commit()
        
        result = conn.execute(text("""
            SELECT created_at FROM events WHERE event_id = 'timestamp_test'
        """))
        row = result.fetchone()
        timestamp = row[0]
        
        assert timestamp is not None
        assert isinstance(timestamp, datetime)
    
    def test_boolean_defaults(self, conn):
        """Test boolean default values."""
        # events.processed defaults to false
        conn.execute(text("""
            INSERT INTO events (event_id, symbol, impact_points)
            VALUES ('bool_test', 'SYM', 10.0)
        """))
        conn.commit()
        
        result = conn.execute(text("""
            SELECT processed FROM events WHERE event_id = 'bool_test'
        """))
        row = result.fetchone()
        assert row[0] is False
    
    def test_order_defaults(self, conn):
        """Test order defaults (filled=0, status='open')."""
        conn.execute(text("""
            INSERT INTO orders (user_id, symbol, side, type, qty)
            VALUES ('user1', 'SYM', 'buy', 'market', 10.0)
        """))
        conn.commit()
        
        result = conn.execute(text("""
            SELECT filled, status FROM orders WHERE user_id = 'user1' LIMIT 1
        """))
        row = result.fetchone()
        
        assert row[0] == 0  # filled defaults to 0
        assert row[1] == 'open'  # status defaults to 'open'


# ============================================================================
# Test: Anti-Seeding Rule
# ============================================================================

class TestAntiSeeding:
    """Verify migration does not seed any data."""
    
    def test_stocks_table_empty_after_migration(self, conn):
        """Test that stocks table is empty after migration (no seeded data)."""
        result = conn.execute(text("SELECT COUNT(*) FROM stocks"))
        count = result.scalar()
        
        # Should be 0 - no pre-seeded stocks
        assert count == 0, "Stocks table should be empty after migration (anti-seeding rule)"
    
    def test_all_tables_empty_after_migration(self, conn):
        """Test that all tables are empty after migration."""
        tables = ['stocks', 'scores', 'events', 'llm_calls', 'llm_audit', 
                 'score_changes', 'orders', 'trade_history']
        
        for table in tables:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.scalar()
            assert count == 0, f"Table {table} should be empty after migration"
