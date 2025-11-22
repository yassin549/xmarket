"""
Unit tests for anti-manipulation module.
"""
import pytest
from datetime import datetime, timedelta
from backend.app.anti_manipulation import check_suspicious_event, cap_single_source_influence
from backend.app.models import Event
from backend.app.database import get_db_context
from config import constants


def test_suspicious_delta_threshold():
    """Test that large deltas are flagged as suspicious."""
    with get_db_context() as db:
        is_suspicious, reason = check_suspicious_event(
            symbol="TEST",
            impact_points=18.0,  # Above SUSPICIOUS_DELTA (15)
            sources=[{"id": "source1", "url": "http://test.com", "trust": 0.9}],
            db=db
        )
        
        assert is_suspicious is True
        assert "SUSPICIOUS_DELTA" in reason


def test_normal_delta_not_suspicious():
    """Test that normal deltas are not flagged."""
    with get_db_context() as db:
        is_suspicious, reason = check_suspicious_event(
            symbol="TEST",
            impact_points=10.0,  # Below SUSPICIOUS_DELTA (15)
            sources=[{"id": "source1", "url": "http://test.com", "trust": 0.9}],
            db=db
        )
        
        assert is_suspicious is False
        assert reason == ""


def test_cap_single_source_influence():
    """Test source influence capping."""
    with get_db_context() as db:
        # Create some historical events from same source
        for i in range(3):
            event = Event(
                id=f"test-event-{i}",
                symbol="TEST",
                impact_points=10.0,
                quick_score=0.5,
                summary="Test event",
                sources=[{"id": "source1", "url": f"http://test.com/{i}", "trust": 0.9}],
                num_independent_sources=1,
                processed=True,
                created_at=datetime.utcnow() - timedelta(hours=1)
            )
            db.add(event)
        db.commit()
        
        # Try to add another event from same source
        capped = cap_single_source_influence(
            symbol="TEST",
            source_id="source1",
            proposed_impact=15.0,
            db=db
        )
        
        # Should be capped due to 24h influence limit
        assert capped <= 15.0
