from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import logging

from app.models import get_db, Event, Score
from app.scoring.reality_engine import get_reality_engine

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/stocks/{stock_id}/reality")
async def get_reality_score(
    stock_id: str,
    db: Session = Depends(get_db)
):
    """
    Get the current reality score for a stock/entity.
    
    The reality score is computed using:
    - Lazy decay (scores decay toward neutral 50 over 48 hours)
    - Event capping (individual events limited to ±20 points)
    - EWMA smoothing (prevents sudden spikes)
    
    Returns:
        - stock_id: Identifier
        - score: Current score [0-100], 50 is neutral
        - confidence: Confidence level [0-1]
        - last_updated: ISO timestamp of last update
        - time_since_update_hours: Hours since last event
    """
    try:
        engine = get_reality_engine(db)
        result = engine.get_score(stock_id)
        
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"Stock '{stock_id}' not found. No events have been processed for this entity yet."
            )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting reality score for {stock_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stocks")
async def list_stocks(
    limit: int = Query(default=50, le=100),
    db: Session = Depends(get_db)
):
    """
    List all stocks with reality scores.
    
    Args:
        limit: Maximum number of results (default 50, max 100)
    """
    try:
        scores = db.query(Score).limit(limit).all()
        
        engine = get_reality_engine(db)
        results = []
        
        for score_record in scores:
            result = engine.get_score(score_record.stock_id)
            if result:
                results.append(result)
        
        return {
            "count": len(results),
            "stocks": results
        }
    
    except Exception as e:
        logger.error(f"Error listing stocks: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/events")
async def list_events(
    limit: int = Query(default=20, le=100),
    source_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List recent events.
    
    Args:
        limit: Maximum number of results (default 20, max 100)
        source_id: Filter by source ID (optional)
    """
    try:
        query = db.query(Event).order_by(Event.created_at.desc())
        
        if source_id:
            query = query.filter(Event.source_id == source_id)
        
        events = query.limit(limit).all()
        
        return {
            "count": len(events),
            "events": [
                {
                    "id": e.id,
                    "url": e.url,
                    "title": e.title,
                    "published": e.published.isoformat() if e.published else None,
                    "source_id": e.source_id,
                    "summary": e.summary,
                    "impact": e.impact,
                    "created_at": e.created_at.isoformat() if e.created_at else None
                }
                for e in events
            ]
        }
    
    except Exception as e:
        logger.error(f"Error listing events: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get platform statistics"""
    try:
        total_events = db.query(Event).count()
        total_stocks = db.query(Score).count()
        
        # Get recent event
        recent_event = db.query(Event).order_by(Event.created_at.desc()).first()
        
        return {
            "total_events": total_events,
            "total_stocks": total_stocks,
            "last_event_at": recent_event.created_at.isoformat() if recent_event and recent_event.created_at else None
        }
    
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
