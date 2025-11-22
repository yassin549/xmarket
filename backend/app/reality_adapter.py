"""
Reality Engine adapter - validates and processes reality events.
Handles event validation, anti-manipulation checks, and score application.
"""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import constants
from .models import Event, Score, ScoreChange, LLMAudit, LLMCall, Stock
from .schemas import RealityEventIngest
from .anti_manipulation import check_suspicious_event
from .blender import get_market_pressure, compute_final_price, apply_ewma_smoothing
from .websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)


async def validate_and_process_event(
    event: RealityEventIngest,
    db: Session,
    ws_manager: WebSocketManager
) -> Dict[str, Any]:
    """
    Validate reality event and process it (or flag for audit).
    
    Returns:
        Status dict with processing result
    """
    # Validate stocks exist
    for symbol in event.stocks:
        stock = db.query(Stock).filter(Stock.symbol == symbol).first()
        if not stock:
            raise ValueError(f"Stock {symbol} not found")
    
    # Defensive recomputation of event_weight (verify Reality Engine calculation)
    # For now, trust the impact_points from Reality Engine
    # In production, you could recompute and compare
    
    # Check for suspicious activity
    for symbol in event.stocks:
        is_suspicious, reason = check_suspicious_event(
            symbol=symbol,
            impact_points=event.impact_points,
            sources=[s.dict() for s in event.sources],
            db=db
        )
        
        if is_suspicious:
            # Create audit record
            audit = LLMAudit(
                event_id=event.event_id,
                symbol=symbol,
                summary=event.summary,
                impact=event.impact_points,
                sources=[s.dict() for s in event.sources],
                approved=None  # Pending
            )
            db.add(audit)
            
            # Create event record (but don't process yet)
            db_event = Event(
                id=event.event_id,
                symbol=symbol,
                impact_points=event.impact_points,
                quick_score=event.quick_score,
                summary=event.summary,
                sources=[s.dict() for s in event.sources],
                num_independent_sources=event.num_independent_sources,
                llm_mode=event.llm_mode,
                processed=False
            )
            db.add(db_event)
            db.commit()
            
            # Broadcast audit event
            await ws_manager.broadcast({
                "type": "audit_event",
                "event_id": event.event_id,
                "stock": symbol,
                "delta": event.impact_points,
                "state": "pending_review",
                "reason": reason,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            logger.warning(f"Event {event.event_id} flagged for audit: {reason}")
            
            return {
                "status": "pending_audit",
                "event_id": event.event_id,
                "reason": reason
            }
    
    # Event passed checks - process normally
    results = []
    for symbol in event.stocks:
        # Create event record
        db_event = Event(
            id=event.event_id,
            symbol=symbol,
            impact_points=event.impact_points,
            quick_score=event.quick_score,
            summary=event.summary,
            sources=[s.dict() for s in event.sources],
            num_independent_sources=event.num_independent_sources,
            llm_mode=event.llm_mode,
            processed=False
        )
        db.add(db_event)
        
        # Log LLM call if used
        if event.llm_mode:
            llm_call = LLMCall(
                event_id=event.event_id,
                llm_mode=event.llm_mode,
                input_hash="",  # Would compute from event data
                output_json={"summary": event.summary},
                success=True
            )
            db.add(llm_call)
        
        # Apply event to scores
        result = await apply_event_to_scores(db_event, db, ws_manager)
        results.append(result)
        
        db_event.processed = True
    
    db.commit()
    
    return {
        "status": "processed",
        "event_id": event.event_id,
        "results": results
    }


async def apply_event_to_scores(
    event: Event,
    db: Session,
    ws_manager: WebSocketManager
) -> Dict[str, Any]:
    """
    Apply an event's impact to stock scores and compute final price.
    This is called both for normal events and approved audits.
    
    Returns:
        Dict with updated scores
    """
    symbol = event.symbol
    
    # Get current score
    score = db.query(Score).filter(Score.symbol == symbol).first()
    if not score:
        raise ValueError(f"Score not found for {symbol}")
    
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    
    # Update reality score
    old_reality = score.reality_score
    new_reality = old_reality + event.impact_points
    
    # Clamp to valid range
    new_reality = max(constants.MIN_PRICE, min(constants.MAX_PRICE, new_reality))
    
    # Broadcast reality update
    await ws_manager.broadcast({
        "type": "reality_update",
        "stock": symbol,
        "reality_score": new_reality,
        "delta": event.impact_points,
        "timestamp": datetime.utcnow().isoformat(),
        "event_id": event.id
    })
    
    # Fetch market pressure
    market_data = await get_market_pressure(symbol)
    market_price = market_data.get("market_price") if market_data else None
    
    if market_data:
        # Broadcast market update
        await ws_manager.broadcast({
            "type": "market_update",
            "stock": symbol,
            "market_price": market_data["market_price"],
            "buy_volume": market_data["buy_volume"],
            "sell_volume": market_data["sell_volume"],
            "net_pressure": market_data["net_pressure"],
            "timestamp": market_data["timestamp"]
        })
    
    # Compute final price
    raw_final = compute_final_price(
        reality_score=new_reality,
        market_price=market_price,
        market_weight=stock.market_weight,
        reality_weight=stock.reality_weight
    )
    
    # Apply EWMA smoothing
    old_final = score.final_price
    new_final = apply_ewma_smoothing(old_final, raw_final)
    
    # Record score change
    score_change = ScoreChange(
        symbol=symbol,
        event_id=event.id,
        old_score=old_reality,
        new_score=new_reality,
        delta=event.impact_points
    )
    db.add(score_change)
    
    # Update score
    score.reality_score = new_reality
    score.final_price = new_final
    score.last_updated = datetime.utcnow()
    
    # Broadcast final update
    await ws_manager.broadcast({
        "type": "final_update",
        "stock": symbol,
        "final_price": new_final,
        "components": {
            "market": market_price,
            "reality": new_reality,
            "weights": {
                "market": stock.market_weight,
                "reality": stock.reality_weight
            }
        },
        "timestamp": datetime.utcnow().isoformat()
    })
    
    logger.info(
        f"Applied event {event.id} to {symbol}: "
        f"reality {old_reality:.2f}→{new_reality:.2f}, "
        f"final {old_final:.2f}→{new_final:.2f}"
    )
    
    return {
        "symbol": symbol,
        "old_reality": old_reality,
        "new_reality": new_reality,
        "old_final": old_final,
        "new_final": new_final,
        "market_price": market_price
    }
