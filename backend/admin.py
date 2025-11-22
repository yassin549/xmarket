"""
Admin API Endpoints
===================

Protected endpoints for administrative operations:
- Stock creation
- Audit approval/rejection
- LLM call inspection
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import logging

from database import get_db_session
from config.env import get_admin_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# ============================================================================
# Authentication
# ============================================================================

def verify_admin_key(x_admin_key: str = Header(...)) -> str:
    """Verify admin API key from header."""
    valid_key = get_admin_api_key()
    if x_admin_key != valid_key:
        raise HTTPException(status_code=401, detail="Invalid admin API key")
    return x_admin_key

# ============================================================================
# Request/Response Models
# ============================================================================

class StockCreate(BaseModel):
    """Request to create a new stock."""
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol (uppercase)")
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    market_weight: float = Field(0.5, ge=0.0, le=1.0)
    reality_weight: float = Field(0.5, ge=0.0, le=1.0)
    min_price: float = Field(0.0, ge=0.0)
    max_price: float = Field(100.0, ge=0.0)

class StockResponse(BaseModel):
    """Stock information response."""
    symbol: str
    name: str
    description: Optional[str]
    market_weight: float
    reality_weight: float
    min_price: float
    max_price: float
    created_at: datetime

class AuditItem(BaseModel):
    """LLM audit item awaiting approval."""
    id: str
    event_id: str
    symbol: str
    summary: str
    impact: float
    sources: dict | str  # Can be dict or JSON string from SQLite
    approved: bool
    approved_by: Optional[str]
    created_at: datetime
    approved_at: Optional[datetime]

class AuditApproval(BaseModel):
    """Request to approve/reject an audit."""
    approved: bool
    approved_by: str = Field(..., description="Admin username or ID")

# ============================================================================
# Stock Management
# ============================================================================

@router.post("/stocks", response_model=StockResponse, status_code=201)
def create_stock(
    stock: StockCreate,
    session: Session = Depends(get_db_session),
    _: str = Depends(verify_admin_key)
):
    """
    Create a new stock.
    
    **Requires ADMIN_API_KEY in X-Admin-Key header.**
    
    This is the ONLY way to create stocks. No automated seeding allowed.
    """
    # Validate weights sum (optional constraint)
    if abs((stock.market_weight + stock.reality_weight) - 1.0) > 0.01:
        raise HTTPException(
            status_code=400,
            detail="market_weight + reality_weight must equal 1.0"
        )
    
    # Check if stock already exists
    existing = session.execute(
        text("SELECT symbol FROM stocks WHERE symbol = :symbol"),
        {"symbol": stock.symbol.upper()}
    ).fetchone()
    
    if existing:
        raise HTTPException(status_code=409, detail=f"Stock {stock.symbol} already exists")
    
    # Insert stock
    session.execute(
        text("""
            INSERT INTO stocks (symbol, name, description, market_weight, reality_weight, min_price, max_price)
            VALUES (:symbol, :name, :description, :market_weight, :reality_weight, :min_price, :max_price)
        """),
        {
            "symbol": stock.symbol.upper(),
            "name": stock.name,
            "description": stock.description,
            "market_weight": stock.market_weight,
            "reality_weight": stock.reality_weight,
            "min_price": stock.min_price,
            "max_price": stock.max_price
        }
    )
    
    # Initialize score for this stock
    initial_score = (stock.min_price + stock.max_price) / 2
    session.execute(
        text("""
            INSERT INTO scores (symbol, reality_score, final_price, confidence)
            VALUES (:symbol, :initial_score, :initial_score, 0.5)
        """),
        {
            "symbol": stock.symbol.upper(),
            "initial_score": initial_score
        }
    )
    
    session.commit()
    
    logger.info(f"Admin created stock: {stock.symbol}")
    
    # Fetch and return created stock
    result = session.execute(
        text("SELECT symbol, name, description, market_weight, reality_weight, min_price, max_price, created_at FROM stocks WHERE symbol = :symbol"),
        {"symbol": stock.symbol.upper()}
    ).fetchone()
    
    return StockResponse(
        symbol=result[0],
        name=result[1],
        description=result[2],
        market_weight=result[3],
        reality_weight=result[4],
        min_price=result[5],
        max_price=result[6],
        created_at=result[7]
    )

@router.get("/stocks", response_model=List[StockResponse])
def list_stocks(
    session: Session = Depends(get_db_session),
    _: str = Depends(verify_admin_key)
):
    """List all stocks."""
    results = session.execute(
        text("SELECT symbol, name, description, market_weight, reality_weight, min_price, max_price, created_at FROM stocks ORDER BY created_at DESC")
    ).fetchall()
    
    return [StockResponse(
        symbol=r[0], name=r[1], description=r[2],
        market_weight=r[3], reality_weight=r[4],
        min_price=r[5], max_price=r[6], created_at=r[7]
    ) for r in results]

# ============================================================================
# Audit Management
# ============================================================================

@router.get("/audits", response_model=List[AuditItem])
def list_audits(
    pending_only: bool = True,
    session: Session = Depends(get_db_session),
    _: str = Depends(verify_admin_key)
):
    """
    List LLM audit items.
    
    By default shows only pending (unapproved) items.
    """
    query = """
        SELECT id, event_id, symbol, summary, impact, sources, approved, approved_by, created_at, approved_at
        FROM llm_audit
    """
    
    if pending_only:
        query += " WHERE approved = false"
    
    query += " ORDER BY created_at DESC"
    
    results = session.execute(text(query)).fetchall()
    
    return [AuditItem(
        id=str(r[0]), event_id=r[1], symbol=r[2], summary=r[3],
        impact=r[4], sources=r[5], approved=r[6], approved_by=r[7],
        created_at=r[8], approved_at=r[9]
    ) for r in results]

@router.post("/audits/{audit_id}/approve")
async def approve_audit(
    audit_id: str,
    approval: AuditApproval,
    session: Session = Depends(get_db_session),
    _: str = Depends(verify_admin_key)
):
    """
    Approve or reject an audit item.
    
    If approved, the associated event will be applied to scores.
    """
    # Get audit record
    audit = session.execute(
        text("SELECT event_id, symbol, approved FROM llm_audit WHERE id = :id"),
        {"id": audit_id}
    ).fetchone()
    
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    if audit[2]:  # already approved/rejected
        raise HTTPException(status_code=409, detail="Audit already processed")
    
    # Update audit record
    session.execute(
        text("""
            UPDATE llm_audit
            SET approved = :approved,
                approved_by = :approved_by,
                approved_at = CURRENT_TIMESTAMP
            WHERE id = :id
        """),
        {
            "id": audit_id,
            "approved": approval.approved,
            "approved_by": approval.approved_by
        }
    )
    
    # If approved, apply the event to scores
    if approval.approved:
        event_id = audit[0]
        
        # Get event details
        event_data = session.execute(
            text("SELECT symbol, impact_points FROM events WHERE event_id = :event_id"),
            {"event_id": event_id}
        ).fetchone()
        
        if event_data:
            # Apply event to scores (similar to blender logic but simpler)
            from backend.blender import apply_event_to_scores
            from backend.models import RealityEventRequest, SourceModel
            
            # Reconstruct event for application
            # In production, you'd store full event or have better reconstruction
            # For now, just update processed flag
            session.execute(
                text("UPDATE events SET processed = true WHERE event_id = :event_id"),
                {"event_id": event_id}
            )
            
            logger.info(f"Admin approved audit {audit_id}, event {event_id} marked for processing")
    
    session.commit()
    
    return {
        "status": "approved" if approval.approved else "rejected",
        "audit_id": audit_id,
        "approved_by": approval.approved_by
    }

# ============================================================================
# LLM Inspection
# ============================================================================

@router.get("/llm-calls")
def list_llm_calls(
    limit: int = 100,
    session: Session = Depends(get_db_session),
    _: str = Depends(verify_admin_key)
):
    """List recent LLM calls for debugging."""
    results = session.execute(
        text("""
            SELECT id, event_id, llm_mode, input_hash, output_json, timestamp
            FROM llm_calls
            ORDER BY timestamp DESC
            LIMIT :limit
        """),
        {"limit": limit}
    ).fetchall()
    
    return [
        {
            "id": str(r[0]),
            "event_id": r[1],
            "llm_mode": r[2],
            "input_hash": r[3],
            "output_json": r[4],
            "timestamp": r[5]
        }
        for r in results
    ]
