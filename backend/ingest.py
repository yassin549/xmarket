"""
Reality event ingestion endpoint and business logic.

Implements POST /api/v1/reality/ingest per plan.txt Section 8.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.models import (
    RealityEventRequest,
    EventCreatedResponse,
    EventDuplicateResponse,
    PendingReviewResponse,
    ErrorResponse,
)
from backend.auth import verify_reality_signature
from database import get_db_session
from config.constants import SUSPICIOUS_DELTA, DELTA_CAP
import json

router = APIRouter()


# ============================================================================
# Database Operations
# ============================================================================

def event_exists(session: Session, event_id: str) -> bool:
    """
    Check if event_id already exists (idempotency check).
    
    Args:
        session: Database session
        event_id: Event identifier to check
        
    Returns:
        True if event exists, False otherwise
    """
    result = session.execute(
        text("SELECT COUNT(*) FROM events WHERE event_id = :event_id"),
        {"event_id": event_id}
    )
    count = result.scalar()
    return count > 0


def validate_stocks_exist(session: Session, stocks: list[str]) -> list[str]:
    """
    Validate that all stock symbols exist in database.
    
    Args:
        session: Database session
        stocks: List of stock symbols to validate
        
    Returns:
        List of invalid stock symbols (empty if all valid)
    """
    placeholders = ", ".join([f":stock{i}" for i in range(len(stocks))])
    params = {f"stock{i}": stock for i, stock in enumerate(stocks)}
    
    result = session.execute(
        text(f"SELECT symbol FROM stocks WHERE symbol IN ({placeholders})"),
        params
    )
    valid_stocks = {row[0] for row in result}
    
    invalid_stocks = [stock for stock in stocks if stock not in valid_stocks]
    return invalid_stocks


def persist_event(session: Session, event: RealityEventRequest) -> None:
    """
    Persist event to events table.
    
    Args:
        session: Database session
        event: Validated reality event
    """
    # Convert sources to JSON
    sources_json = json.dumps([s.model_dump() for s in event.sources])
    
    session.execute(
        text("""
            INSERT INTO events (
                event_id, symbol, impact_points, quick_score,
                summary, sources, llm_mode, processed
            ) VALUES (
                :event_id, :symbol, :impact_points, :quick_score,
                :summary, :sources::jsonb, :llm_mode, :processed
            )
        """),
        {
            "event_id": event.event_id,
            "symbol": event.stocks[0] if event.stocks else None,  # Primary symbol
            "impact_points": event.impact_points,
            "quick_score": event.quick_score,
            "summary": event.summary,
            "sources": sources_json,
            "llm_mode": event.llm_mode,
            "processed": False  # Will be processed later by backend worker
        }
    )
    session.commit()


def create_llm_audit(session: Session, event: RealityEventRequest) -> None:
    """
    Create llm_audit record for suspicious events requiring manual review.
    
    Args:
        session: Database session
        event: Reality event that triggered audit
    """
    # Convert sources to JSON
    sources_json = json.dumps([s.model_dump() for s in event.sources])
    
    session.execute(
        text("""
            INSERT INTO llm_audit (
                event_id, symbol, summary, impact, sources, approved
            ) VALUES (
                :event_id, :symbol, :summary, :impact, :sources::jsonb, :approved
            )
        """),
        {
            "event_id": event.event_id,
            "symbol": event.stocks[0] if event.stocks else None,
            "summary": event.summary,
            "impact": event.impact_points,
            "sources": sources_json,
            "approved": False  # Requires manual admin approval
        }
    )
    session.commit()


# ============================================================================
# Ingest Endpoint
# ============================================================================

@router.post(
    "/api/v1/reality/ingest",
    response_model=EventCreatedResponse | EventDuplicateResponse | PendingReviewResponse,
    status_code=201,
    responses={
        200: {"model": EventDuplicateResponse, "description": "Event already processed (idempotent)"},
        201: {"model": EventCreatedResponse, "description": "Event created successfully"},
        202: {"model": PendingReviewResponse, "description": "Event pending manual review"},
        400: {"model": ErrorResponse, "description": "Bad request (invalid stocks, etc.)"},
        401: {"model": ErrorResponse, "description": "Unauthorized (invalid signature)"},
        422: {"model": ErrorResponse, "description": "Validation error"},
    },
    tags=["reality"],
    summary="Ingest reality event from reality-engine",
    description="""
    Receive and validate reality events from the reality-engine.
    
    Security:
    - Requires valid HMAC-SHA256 signature in X-Reality-Signature header
    - Signature computed over canonical JSON (sorted keys, compact)
    
    Workflow:
    1. Verify HMAC signature (via dependency)
    2. Validate Pydantic schema
    3. Check idempotency (event_id uniqueness)
    4. Validate stocks exist
    5. Check for suspicious delta (abs(impact_points) > SUSPICIOUS_DELTA)
    6. Persist event or create audit record
    
    Anti-manipulation:
    - Events with abs(impact_points) > 15 create llm_audit record
    - These events do NOT update scores until admin approval
    """
)
async def ingest_reality_event(
    payload: dict = Depends(verify_reality_signature),
    session: Session = Depends(get_db_session),
):
    """
    Ingest reality event with HMAC verification and validation.
    
    Args:
        payload: Verified and signed payload from reality-engine
        session: Database session
        
    Returns:
        EventCreatedResponse (201): Event persisted successfully
        EventDuplicateResponse (200): Event already exists (idempotent)
        PendingReviewResponse (202): Event flagged for review
        
    Raises:
        HTTPException 400: Invalid stocks or validation error
        HTTPException 401: Invalid signature (handled by dependency)
        HTTPException 422: Schema validation error (handled by Pydantic)
    """
    # Parse and validate with Pydantic
    try:
        event = RealityEventRequest(**payload)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Schema validation error: {str(e)}"
        )
    
    # 1. Idempotency check
    if event_exists(session, event.event_id):
        return EventDuplicateResponse(event_id=event.event_id)
    
    # 2. Validate stocks exist
    invalid_stocks = validate_stocks_exist(session, event.stocks)
    if invalid_stocks:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stocks (not found in database): {', '.join(invalid_stocks)}"
        )
    
    # 3. Check suspicious delta threshold
    if abs(event.impact_points) > SUSPICIOUS_DELTA:
        # Create audit record for manual review
        create_llm_audit(session, event)
        
        # Also persist the event but mark as unprocessed
        persist_event(session, event)
        
        return PendingReviewResponse(
            event_id=event.event_id,
            reason=f"Suspicious delta: abs(impact_points)={abs(event.impact_points)} > SUSPICIOUS_DELTA={SUSPICIOUS_DELTA}",
        )
    
    # 4. Normal flow: persist event and apply to scores
    persist_event(session, event)
    
    # Apply event to scores (blender logic)
    from backend.blender import apply_event_to_scores
    
    try:
        result = await apply_event_to_scores(session, event)
        logger.info(f"Event {event.event_id} applied: {result}")
    except Exception as e:
        logger.error(f"Failed to apply event {event.event_id}: {e}")
        # Event is persisted but not applied to scores yet
        # Could be retried later or handled by background worker
    
    return EventCreatedResponse(event_id=event.event_id)
