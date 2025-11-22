"""
Public API Endpoints
====================

Public endpoints for frontend to fetch market data.
No authentication required (read-only data).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database import get_db_session

router = APIRouter(prefix="/api/v1", tags=["public"])

# ============================================================================
# Response Models
# ============================================================================

class StockInfo(BaseModel):
    """Basic stock information."""
    symbol: str
    name: str
    description: Optional[str]
    market_weight: float
    reality_weight: float
    created_at: datetime

class ScoreInfo(BaseModel):
    """Current score information."""
    symbol: str
    reality_score: float
    final_price: float
    confidence: float
    last_updated: datetime

class EventInfo(BaseModel):
    """Event information."""
    event_id: str
    symbol: str
    impact_points: float
    quick_score: Optional[float]
    summary: Optional[str]
    llm_mode: Optional[str]
    created_at: datetime
    processed: bool

# ============================================================================
# Endpoints
# ============================================================================

@router.get("/stocks", response_model=List[StockInfo])
def list_stocks(session: Session = Depends(get_db_session)):
    """
    List all stocks.
    
    Returns basic information about all available stocks.
    """
    results = session.execute(
        text("""
            SELECT symbol, name, description, market_weight, reality_weight, created_at
            FROM stocks
            ORDER BY created_at DESC
        """)
    ).fetchall()
    
    return [
        StockInfo(
            symbol=r[0],
            name=r[1],
            description=r[2],
            market_weight=r[3],
            reality_weight=r[4],
            created_at=r[5]
        )
        for r in results
    ]

@router.get("/scores/{symbol}", response_model=ScoreInfo)
def get_score(symbol: str, session: Session = Depends(get_db_session)):
    """
    Get current score for a symbol.
    
    Returns the current reality score, final price, and confidence.
    """
    result = session.execute(
        text("""
            SELECT symbol, reality_score, final_price, confidence, last_updated
            FROM scores
            WHERE symbol = :symbol
        """),
        {"symbol": symbol.upper()}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail=f"Score not found for {symbol}")
    
    return ScoreInfo(
        symbol=result[0],
        reality_score=result[1],
        final_price=result[2],
        confidence=result[3],
        last_updated=result[4]
    )

@router.get("/events/{symbol}", response_model=List[EventInfo])
def get_events(
    symbol: str,
    limit: int = 20,
    session: Session = Depends(get_db_session)
):
    """
    Get recent events for a symbol.
    
    Returns the most recent events affecting this stock.
    """
    results = session.execute(
        text("""
            SELECT event_id, symbol, impact_points, quick_score, summary, llm_mode, created_at, processed
            FROM events
            WHERE symbol = :symbol
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"symbol": symbol.upper(), "limit": limit}
    ).fetchall()
    
    return [
        EventInfo(
            event_id=r[0],
            symbol=r[1],
            impact_points=r[2],
            quick_score=r[3],
            summary=r[4],
            llm_mode=r[5],
            created_at=r[6],
            processed=r[7]
        )
        for r in results
    ]

@router.get("/scores/{symbol}/history")
def get_score_history(
    symbol: str,
    hours: int = 24,
    session: Session = Depends(get_db_session)
):
    """
    Get score history for charts.
    
    Returns historical score changes over the specified time period.
    """
    results = session.execute(
        text("""
            SELECT old_score, new_score, delta, timestamp
            FROM score_changes
            WHERE symbol = :symbol
              AND timestamp > datetime('now', '-' || :hours || ' hours')
            ORDER BY timestamp ASC
        """),
        {"symbol": symbol.upper(), "hours": hours}
    ).fetchall()
    
    return [
        {
            "old_score": r[0],
            "new_score": r[1],
            "delta": r[2],
            "timestamp": r[3]
        }
        for r in results
    ]

@router.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "backend-api"}
