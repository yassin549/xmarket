import pytest
from datetime import datetime, timezone, timedelta
from app.scoring.reality_engine import RealityEngine, TAU_SECONDS, DELTA_CAP, EWMA_ALPHA
from app.models import Base, Score
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session():
    """Create in-memory SQLite database for testing"""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_reality_engine_initialization(db_session):
    """Test that Reality Engine initializes correctly"""
    engine = RealityEngine(db_session)
    assert engine is not None
    assert engine.db is db_session


def test_apply_event_new_stock(db_session):
    """Test applying event to a new stock"""
    engine = RealityEngine(db_session)
    
    score = engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=10.0,
        source_id="test_source",
        timestamp=datetime.now(timezone.utc)
    )
    
    # Should start at 50 (neutral) and move up
    assert 50 < score < 70, f"Expected score between 50-70, got {score}"
    
    # Check database
    score_record = db_session.query(Score).filter_by(stock_id="TEST_STOCK").first()
    assert score_record is not None
    assert score_record.score == score


def test_apply_event_capping(db_session):
    """Test that event impact is capped to DELTA_CAP"""
    engine = RealityEngine(db_session)
    
    # Try to apply huge positive event
    score = engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=100.0,  # Way over cap (20)
        source_id="test_source",
        timestamp=datetime.now(timezone.utc)
    )
    
    # Should be capped: 50 + 20 with smoothing
    # With EWMA (alpha=0.25): 0.25*(50+20) + 0.75*50 = 55
    assert score < 60, f"Expected capped score < 60, got {score}"


def test_apply_event_negative(db_session):
    """Test applying negative event"""
    engine = RealityEngine(db_session)
    
    score = engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=-15.0,
        source_id="test_source",
        timestamp=datetime.now(timezone.utc)
    )
    
    # Should be below neutral (50)
    assert score < 50, f"Expected score < 50 for negative event, got {score}"


def test_apply_event_smoothing(db_session):
    """Test EWMA smoothing"""
    engine = RealityEngine(db_session)
    
    # Apply first event
    score1 = engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=10.0,
        source_id="test_source",
        timestamp=datetime.now(timezone.utc)
    )
    
    # Apply second event immediately
    score2 = engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=10.0,
        source_id="test_source",
        timestamp=datetime.now(timezone.utc)
    )
    
    # Second score should be higher but smoothed
    assert score2 > score1
    # Should not jump by full 10 points due to smoothing
    assert (score2 - score1) < 10


def test_get_score_nonexistent(db_session):
    """Test getting score for nonexistent stock"""
    engine = RealityEngine(db_session)
    
    result = engine.get_score("NONEXISTENT")
    assert result is None


def test_get_score_existing(db_session):
    """Test getting score for existing stock"""
    engine = RealityEngine(db_session)
    
    # Create a score
    engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=10.0,
        source_id="test_source",
        timestamp=datetime.now(timezone.utc)
    )
    
    # Get score
    result = engine.get_score("TEST_STOCK")
    
    assert result is not None
    assert result["stock_id"] == "TEST_STOCK"
    assert "score" in result
    assert "confidence" in result
    assert "last_updated" in result


def test_lazy_decay_on_read(db_session):
    """Test that get_score applies lazy decay without DB write"""
    engine = RealityEngine(db_session)
    
    # Apply event in the past
    past_time = datetime.now(timezone.utc) - timedelta(hours=48)
    engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=20.0,
        source_id="test_source",
        timestamp=past_time
    )
    
    # Manually set last_updated to past
    score_record = db_session.query(Score).filter_by(stock_id="TEST_STOCK").first()
    original_score = score_record.score
    score_record.last_updated = past_time
    db_session.commit()
    
    # Get score (should apply decay)
    result = engine.get_score("TEST_STOCK")
    
    # Score should be decayed toward 50
    assert result["score"] < original_score
    assert 45 < result["score"] < 65  # Should be near neutral after 48h
    
    # DB should not be updated (lazy decay is read-only)
    score_record = db_session.query(Score).filter_by(stock_id="TEST_STOCK").first()
    assert score_record.score == original_score  # Unchanged in DB


def test_confidence_increases(db_session):
    """Test that confidence increases with related documents"""
    engine = RealityEngine(db_session)
    
    # Apply event with 1 related doc
    engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=5.0,
        source_id="test_source",
        timestamp=datetime.now(timezone.utc),
        num_related_docs=1
    )
    
    result1 = engine.get_score("TEST_STOCK")
    confidence1 = result1["confidence"]
    
    # Apply event with 5 related docs
    engine.apply_event(
        stock_id="TEST_STOCK",
        event_points=5.0,
        source_id="test_source",
        timestamp=datetime.now(timezone.utc),
        num_related_docs=5
    )
    
    result2 = engine.get_score("TEST_STOCK")
    confidence2 = result2["confidence"]
    
    # Confidence should increase
    assert confidence2 > confidence1


def test_score_clamping(db_session):
    """Test that scores are clamped to [0, 100]"""
    engine = RealityEngine(db_session)
    
    # Try to push score way up
    for _ in range(10):
        engine.apply_event(
            stock_id="TEST_STOCK",
            event_points=20.0,
            source_id="test_source",
            timestamp=datetime.now(timezone.utc)
        )
    
    result = engine.get_score("TEST_STOCK")
    assert 0 <= result["score"] <= 100


def test_decay_scores_batch(db_session):
    """Test batch decay of all scores"""
    engine = RealityEngine(db_session)
    
    # Create multiple stocks
    for i in range(3):
        engine.apply_event(
            stock_id=f"STOCK_{i}",
            event_points=20.0,
            source_id="test_source",
            timestamp=datetime.now(timezone.utc) - timedelta(hours=24)
        )
    
    # Manually set last_updated to past
    for score_record in db_session.query(Score).all():
        score_record.last_updated = datetime.now(timezone.utc) - timedelta(hours=24)
    db_session.commit()
    
    # Apply batch decay
    engine.decay_scores()
    
    # All scores should be updated
    for score_record in db_session.query(Score).all():
        # last_updated should be recent
        time_diff = (datetime.now(timezone.utc) - score_record.last_updated).total_seconds()
        assert time_diff < 10  # Within 10 seconds
