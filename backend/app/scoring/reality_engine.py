import math
from datetime import datetime, timezone
from typing import Optional, Dict
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

# Constants (as per plan)
TAU_SECONDS = 48 * 3600  # 48 hours - decay time constant
DELTA_CAP = 20.0  # Maximum change per event (±20 points)
EWMA_ALPHA = 0.25  # Exponential weighted moving average smoothing factor
MIN_SCORE = 0.0  # Minimum score
MAX_SCORE = 100.0  # Maximum score
NEUTRAL_SCORE = 50.0  # Neutral baseline


class RealityEngine:
    """
    Reality Engine: Computes and maintains Reality Scores for stocks/entities.
    
    Uses:
    - Lazy Decay: Scores decay toward neutral (50) over time
    - Event Capping: Individual events limited to ±20 points
    - EWMA Smoothing: Prevents sudden spikes
    """
    
    def __init__(self, db_session: Session):
        """
        Initialize Reality Engine.
        
        Args:
            db_session: SQLAlchemy session for database operations
        """
        self.db = db_session
    
    def apply_event(
        self,
        stock_id: str,
        event_points: float,
        source_id: str,
        timestamp: datetime = None,
        num_related_docs: int = 1
    ) -> float:
        """
        Apply an event to update the reality score.
        
        Args:
            stock_id: Identifier for the stock/entity
            event_points: Impact points from event (can be negative)
            source_id: ID of the source reporting the event
            timestamp: When the event occurred (defaults to now)
            num_related_docs: Number of related documents (for confidence)
            
        Returns:
            New reality score after applying event
        """
        from ..models import Score  # Import here to avoid circular dependency
        
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)
        
        now = datetime.now(timezone.utc)
        
        # Get current score record
        score_record = self.db.query(Score).filter_by(stock_id=stock_id).first()
        
        if score_record is None:
            # Initialize new stock at neutral
            current_score = NEUTRAL_SCORE
            last_updated = now
            confidence = 0.1
            logger.info(f"Initializing new stock {stock_id} at neutral score {NEUTRAL_SCORE}")
        else:
            current_score = score_record.score
            last_updated = score_record.last_updated
            confidence = score_record.confidence
            
            # Ensure last_updated is timezone-aware (SQLite may strip timezone)
            if last_updated.tzinfo is None:
                last_updated = last_updated.replace(tzinfo=timezone.utc)
        
        # Apply Lazy Decay
        time_diff = (now - last_updated).total_seconds()
        decay_factor = math.exp(-time_diff / TAU_SECONDS)
        
        # Decay toward neutral (50)
        decayed_score = current_score * decay_factor + NEUTRAL_SCORE * (1 - decay_factor)
        
        logger.info(
            f"[{stock_id}] Score decay: {current_score:.2f} -> {decayed_score:.2f} "
            f"(time_diff={time_diff/3600:.1f}h, decay_factor={decay_factor:.3f})"
        )
        
        # Cap event impact to prevent manipulation
        capped_points = max(-DELTA_CAP, min(DELTA_CAP, event_points))
        
        if abs(event_points) > DELTA_CAP:
            logger.warning(
                f"[{stock_id}] Event impact capped: {event_points:.2f} -> {capped_points:.2f}"
            )
        
        # Apply event impact
        new_score_raw = decayed_score + capped_points
        
        # EWMA smoothing to prevent sudden spikes
        new_score = EWMA_ALPHA * new_score_raw + (1 - EWMA_ALPHA) * decayed_score
        
        # Clamp to valid range [0, 100]
        new_score = max(MIN_SCORE, min(MAX_SCORE, new_score))
        
        # Update confidence (increases with more related documents)
        # Confidence increases logarithmically with number of sources
        confidence_boost = 0.1 * math.log(1 + num_related_docs)
        new_confidence = min(1.0, confidence + confidence_boost)
        
        logger.info(
            f"[{stock_id}] Applied event: {capped_points:+.2f} points -> "
            f"score {decayed_score:.2f} -> {new_score:.2f}, "
            f"confidence {confidence:.2f} -> {new_confidence:.2f}"
        )
        
        # Persist to database
        if score_record is None:
            score_record = Score(
                stock_id=stock_id,
                score=new_score,
                confidence=new_confidence,
                last_updated=now
            )
            self.db.add(score_record)
        else:
            score_record.score = new_score
            score_record.confidence = new_confidence
            score_record.last_updated = now
        
        self.db.commit()
        
        return new_score
    
    def get_score(self, stock_id: str) -> Optional[Dict]:
        """
        Get current score with lazy decay applied (read-only, no DB write).
        
        Args:
            stock_id: Identifier for the stock/entity
            
        Returns:
            Dictionary with score, confidence, last_updated, or None if not found
        """
        from ..models import Score
        
        score_record = self.db.query(Score).filter_by(stock_id=stock_id).first()
        
        if score_record is None:
            return None
        
        now = datetime.now(timezone.utc)
        last_updated = score_record.last_updated
        
        # Ensure last_updated is timezone-aware (SQLite may strip timezone)
        if last_updated.tzinfo is None:
            last_updated = last_updated.replace(tzinfo=timezone.utc)
        
        time_diff = (now - last_updated).total_seconds()
        decay_factor = math.exp(-time_diff / TAU_SECONDS)
        
        # Apply decay without writing to DB (read-only)
        decayed_score = score_record.score * decay_factor + NEUTRAL_SCORE * (1 - decay_factor)
        decayed_score = max(MIN_SCORE, min(MAX_SCORE, decayed_score))
        
        return {
            "stock_id": stock_id,
            "score": decayed_score,
            "confidence": score_record.confidence,
            "last_updated": score_record.last_updated.isoformat(),
            "time_since_update_hours": time_diff / 3600
        }
    
    def decay_scores(self, now: datetime = None):
        """
        Optional: Explicitly decay all scores (background job).
        
        Note: With lazy decay, this is not strictly necessary as decay
        is applied on-read. However, it can be useful for batch updates.
        
        Args:
            now: Current time (defaults to now)
        """
        from ..models import Score
        
        if now is None:
            now = datetime.now(timezone.utc)
        
        all_scores = self.db.query(Score).all()
        
        for score_record in all_scores:
            last_updated = score_record.last_updated
            
            # Ensure last_updated is timezone-aware (SQLite may strip timezone)
            if last_updated.tzinfo is None:
                last_updated = last_updated.replace(tzinfo=timezone.utc)
            
            time_diff = (now - last_updated).total_seconds()
            decay_factor = math.exp(-time_diff / TAU_SECONDS)
            
            decayed_score = score_record.score * decay_factor + NEUTRAL_SCORE * (1 - decay_factor)
            decayed_score = max(MIN_SCORE, min(MAX_SCORE, decayed_score))
            
            score_record.score = decayed_score
            score_record.last_updated = now
        
        self.db.commit()
        logger.info(f"Decayed {len(all_scores)} scores")


# Global instance cache (per-session)
_reality_engines = {}

def get_reality_engine(db_session: Session) -> RealityEngine:
    """
    Get or create Reality Engine instance for a database session.
    
    Args:
        db_session: SQLAlchemy session
        
    Returns:
        RealityEngine instance
    """
    session_id = id(db_session)
    
    if session_id not in _reality_engines:
        _reality_engines[session_id] = RealityEngine(db_session)
    
    return _reality_engines[session_id]
