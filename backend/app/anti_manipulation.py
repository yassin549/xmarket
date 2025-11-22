"""
Anti-manipulation module.
Detects suspicious events based on delta thresholds and source influence caps.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Tuple
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import constants
from .models import Event, ScoreChange

logger = logging.getLogger(__name__)


def check_suspicious_event(
    symbol: str,
    impact_points: float,
    sources: list,
    db: Session
) -> Tuple[bool, str]:
    """
    Check if an event is suspicious and should be flagged for admin review.
    
    Returns:
        (is_suspicious, reason)
    """
    # Check 1: Absolute delta exceeds threshold
    if abs(impact_points) > constants.SUSPICIOUS_DELTA:
        reason = f"Impact points ({impact_points:.2f}) exceeds SUSPICIOUS_DELTA ({constants.SUSPICIOUS_DELTA})"
        logger.warning(f"Suspicious event for {symbol}: {reason}")
        return True, reason
    
    # Check 2: Single source influence in 24h window
    if sources:
        source_id = sources[0].get('id') if isinstance(sources[0], dict) else sources[0].id
        
        # Calculate rolling 24h window
        window_start = datetime.utcnow() - timedelta(hours=constants.ROLLING_WINDOW_HOURS)
        
        # Get all events from this source in the window
        recent_events = db.query(Event).filter(
            Event.symbol == symbol,
            Event.created_at >= window_start,
            Event.processed == True
        ).all()
        
        # Calculate total impact from this source
        source_impact = sum(
            event.impact_points
            for event in recent_events
            if any(
                (s.get('id') if isinstance(s, dict) else s.id) == source_id
                for s in (event.sources if isinstance(event.sources, list) else [])
            )
        )
        
        # Calculate total impact from all sources
        total_impact = sum(abs(event.impact_points) for event in recent_events)
        
        if total_impact > 0:
            source_influence = abs(source_impact) / total_impact
            
            if source_influence > constants.MAX_SINGLE_SOURCE_INFLUENCE_24H:
                reason = f"Source {source_id} influence ({source_influence:.2%}) exceeds max ({constants.MAX_SINGLE_SOURCE_INFLUENCE_24H:.2%}) in 24h window"
                logger.warning(f"Suspicious event for {symbol}: {reason}")
                return True, reason
    
    return False, ""


def cap_single_source_influence(
    symbol: str,
    source_id: str,
    proposed_impact: float,
    db: Session
) -> float:
    """
    Cap the impact from a single source to prevent manipulation.
    
    Returns:
        Capped impact points
    """
    window_start = datetime.utcnow() - timedelta(hours=constants.ROLLING_WINDOW_HOURS)
    
    # Get recent events from this source
    recent_events = db.query(Event).filter(
        Event.symbol == symbol,
        Event.created_at >= window_start,
        Event.processed == True
    ).all()
    
    source_impact = sum(
        event.impact_points
        for event in recent_events
        if any(
            (s.get('id') if isinstance(s, dict) else s.id) == source_id
            for s in (event.sources if isinstance(event.sources, list) else [])
        )
    )
    
    total_impact = sum(abs(event.impact_points) for event in recent_events)
    
    if total_impact == 0:
        return proposed_impact
    
    # Calculate maximum allowed impact for this source
    max_allowed = total_impact * constants.MAX_SINGLE_SOURCE_INFLUENCE_24H - abs(source_impact)
    
    if abs(proposed_impact) > max_allowed:
        capped = max_allowed if proposed_impact > 0 else -max_allowed
        logger.info(f"Capped impact for source {source_id} from {proposed_impact:.2f} to {capped:.2f}")
        return capped
    
    return proposed_impact
