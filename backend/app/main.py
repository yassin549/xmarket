"""
FastAPI backend application for Everything Market.
Orchestrates reality events, market data, and final price blending.
"""
from fastapi import FastAPI, Depends, HTTPException, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import sys
import os
import logging

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from config import env, constants
from .database import get_db, init_db
from .models import Stock, Score, Event, LLMAudit, ScoreChange
from . import schemas
from .websocket_manager import WebSocketManager
from .blender import compute_final_price
from .anti_manipulation import check_suspicious_event
from .reality_adapter import validate_and_process_event

# Configure logging
logging.basicConfig(
    level=getattr(logging, env.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Everything Market Backend",
    description="Central orchestrator for reality-driven prediction markets",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if env.DEBUG else [env.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket manager
ws_manager = WebSocketManager()


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    logger.info("Starting Everything Market Backend...")
    init_db()
    logger.info(f"Database initialized at {env.DATABASE_URL}")
    logger.info(f"Environment: {env.ENVIRONMENT}")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "everything-market-backend",
        "status": "healthy",
        "version": "1.0.0",
        "environment": env.ENVIRONMENT
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "websocket_clients": ws_manager.active_connections_count()
    }


# ============================================================================
# Stock Management (Admin)
# ============================================================================

def verify_admin_key(x_admin_key: str = Header(...)):
    """Verify admin API key using constant-time comparison."""
    import hmac
    if not hmac.compare_digest(x_admin_key, env.ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Invalid admin key")
    return True


@app.post("/api/v1/admin/stocks", dependencies=[Depends(verify_admin_key)])
async def create_stock(stock: schemas.StockCreate, db: Session = Depends(get_db)):
    """Create a new stock or index (admin only)."""
    # Check if stock already exists
    existing = db.query(Stock).filter(Stock.symbol == stock.symbol).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Stock {stock.symbol} already exists")
    
    # Create stock
    db_stock = Stock(**stock.dict())
    db.add(db_stock)
    
    # Initialize score
    db_score = Score(
        symbol=stock.symbol,
        reality_score=stock.initial_score,
        final_price=stock.initial_score,
        confidence=0.5
    )
    db.add(db_score)
    
    db.commit()
    db.refresh(db_stock)
    
    logger.info(f"Created stock: {stock.symbol}")
    return db_stock


@app.get("/api/v1/stocks")
async def list_stocks(db: Session = Depends(get_db)):
    """List all active stocks."""
    stocks = db.query(Stock).filter(Stock.is_active == True).all()
    return stocks


@app.get("/api/v1/stocks/{symbol}")
async def get_stock(symbol: str, db: Session = Depends(get_db)):
    """Get stock details including current scores."""
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    
    score = db.query(Score).filter(Score.symbol == symbol).first()
    
    return {
        "stock": stock,
        "score": score
    }


@app.get("/api/v1/stocks/{symbol}/final")
async def get_final_price(symbol: str, db: Session = Depends(get_db)):
    """Get current final price and components."""
    score = db.query(Score).filter(Score.symbol == symbol).first()
    if not score:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    
    return {
        "symbol": symbol,
        "final_price": score.final_price,
        "reality_score": score.reality_score,
        "confidence": score.confidence,
        "weights": {
            "market": stock.market_weight,
            "reality": stock.reality_weight
        },
        "last_updated": score.last_updated.isoformat()
    }


# ============================================================================
# Reality Ingestion
# ============================================================================

@app.post("/api/v1/reality/ingest")
async def ingest_reality_event(
    event: schemas.RealityEventIngest,
    x_signature: str = Header(...),
    db: Session = Depends(get_db)
):
    """
    Ingest reality event from Reality Engine.
    Validates signature, checks for manipulation, blends with market data.
    """
    # Validate HMAC signature
    import hmac
    import hashlib
    import json
    
    payload = json.dumps(event.dict(), sort_keys=True).encode()
    expected_sig = hmac.new(
        env.REALITY_API_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(x_signature, expected_sig):
        logger.warning(f"Invalid signature for event {event.event_id}")
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    # Check if event already processed (idempotency)
    existing = db.query(Event).filter(Event.id == event.event_id).first()
    if existing:
        logger.info(f"Event {event.event_id} already processed")
        return {"status": "already_processed", "event_id": event.event_id}
    
    # Validate and process event
    try:
        result = await validate_and_process_event(event, db, ws_manager)
        return result
    except Exception as e:
        logger.error(f"Error processing event {event.event_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Admin Audit Workflow
# ============================================================================

@app.get("/api/v1/admin/pending", dependencies=[Depends(verify_admin_key)])
async def get_pending_audits(db: Session = Depends(get_db)):
    """Get all pending audit events."""
    audits = db.query(LLMAudit).filter(LLMAudit.approved == None).order_by(LLMAudit.created_at.desc()).all()
    return audits


@app.post("/api/v1/admin/approve", dependencies=[Depends(verify_admin_key)])
async def approve_audit(
    approval: schemas.AuditApproval,
    db: Session = Depends(get_db)
):
    """Approve or reject a pending audit."""
    from datetime import datetime
    
    audit = db.query(LLMAudit).filter(LLMAudit.event_id == approval.event_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    
    if audit.approved is not None:
        raise HTTPException(status_code=400, detail="Audit already processed")
    
    # Update audit
    audit.approved = approval.approve
    audit.approved_by = approval.admin_id
    audit.approved_at = datetime.utcnow()
    if not approval.approve:
        audit.rejection_reason = approval.reason
    
    # If approved, apply the event
    if approval.approve:
        event = db.query(Event).filter(Event.id == approval.event_id).first()
        if event:
            # Process the event (similar to normal ingestion)
            from .reality_adapter import apply_event_to_scores
            await apply_event_to_scores(event, db, ws_manager)
            event.processed = True
    
    db.commit()
    
    # Broadcast audit decision
    await ws_manager.broadcast({
        "type": "audit_decision",
        "event_id": approval.event_id,
        "approved": approval.approve,
        "admin_id": approval.admin_id
    })
    
    logger.info(f"Audit {approval.event_id} {'approved' if approval.approve else 'rejected'} by {approval.admin_id}")
    
    return {"status": "success", "approved": approval.approve}


# ============================================================================
# Events API
# ============================================================================

@app.get("/api/v1/events/{symbol}")
async def get_events(
    symbol: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get recent events for a stock."""
    events = db.query(Event).filter(
        Event.symbol == symbol
    ).order_by(
        Event.created_at.desc()
    ).limit(limit).offset(offset).all()
    
    return events


# ============================================================================
# WebSocket
# ============================================================================

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle client messages
            data = await websocket.receive_text()
            # Could handle client subscriptions here
            logger.debug(f"Received from client: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        logger.info("Client disconnected from WebSocket")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=env.HOST,
        port=env.PORT,
        reload=env.DEBUG,
        log_level=env.LOG_LEVEL.lower()
    )
