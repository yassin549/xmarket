"""
Orderbook Service API
=====================

FastAPI application exposing orderbook functionality.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session

from orderbook.engine import Engine
from orderbook.models import OrderCreate, OrderResponse, MarketSnapshot, MarketPressure
from orderbook.persistence import init_db, get_session_maker, load_active_orders, replay_orders, persist_order, persist_trade

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global Engine
ENGINE = Engine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    # Startup
    logger.info("Starting Orderbook Service...")
    
    # Initialize DB
    try:
        init_db()
        
        # Replay orders
        session_maker = get_session_maker()
        with session_maker() as session:
            orders = load_active_orders(session)
            replay_orders(ENGINE, orders)
            
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        # We might want to crash here if DB is critical, but for now just log
        
    yield
    
    # Shutdown
    logger.info("Shutting down Orderbook Service...")

app = FastAPI(title="Xmarket Orderbook", lifespan=lifespan)

# Dependency
def get_db():
    session_maker = get_session_maker()
    session = session_maker()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

@app.post("/orders", response_model=OrderResponse, status_code=201)
def place_order(order: OrderCreate, db: Session = Depends(get_db)):
    """Place a new order."""
    try:
        # Execute in memory
        response, trades = ENGINE.place_order(order)
        
        # Persist order (new)
        # We need to map response back to internal Order object or just update DB manually
        # The persistence logic expects internal Order object.
        # Let's get the order object from engine
        book = ENGINE.get_book(order.symbol)
        
        # If filled, it might not be in book.orders anymore?
        # Wait, engine logic removes filled orders from book.orders.
        # But we need to persist the final state.
        
        # We can construct a temporary Order object from response for persistence
        # Or better, modify persistence to accept response object?
        # No, persistence uses OrderDB model which maps closely to Order.
        
        # Let's verify engine logic.
        # Engine returns response and trades.
        # If filled, order is gone from engine memory (except maybe history? No, engine is current state).
        
        # So we must persist based on the response.
        # Let's update persist_order to handle this or create a helper.
        
        # Actually, let's just create a DB object directly here
        from orderbook.models import OrderDB
        
        db_order = OrderDB(
            order_id=str(response.order_id),
            user_id=response.user_id,
            symbol=response.symbol,
            side=response.side,
            type=response.type,
            price=response.price,
            qty=response.qty,
            filled=response.filled,
            status=response.status,
            created_at=response.created_at
        )
        db.add(db_order)
        
        # Persist trades
        for trade in trades:
            # Also update the counterparty order in DB!
            # This is tricky. The engine modified the counterparty order in memory.
            # But we don't have easy access to which orders were modified unless engine returns them.
            # Engine returns trades which have (buy_order_id, sell_order_id).
            # We need to update those orders in DB.
            
            # For now, let's assume we just persist the trade.
            # BUT, if we don't update the counterparty, their 'filled' qty in DB will be wrong.
            # On restart, they will be replayed as if nothing happened!
            # CRITICAL: We must update matched orders in DB.
            
            # Engine's place_order returns trades.
            # We need to find the counterparty order and update it.
            # Since engine modifies in-memory objects, if they are still in book, we can get them.
            # If they became filled, they are removed.
            
            # We need to fetch the counterparty order from DB and update it.
            # Or better, the engine should return the modified orders?
            pass
            
        # To properly handle persistence of matched orders:
        # We need to update the orders involved in trades.
        # The trade response has IDs.
        
        from orderbook.models import TradeDB
        
        for trade in trades:
            # Persist trade
            db_trade = TradeDB(
                trade_id=str(trade.trade_id),
                symbol=trade.symbol,
                price=trade.price,
                qty=trade.qty,
                buy_order_id=str(trade.buy_order_id),
                sell_order_id=str(trade.sell_order_id),
                timestamp=trade.timestamp
            )
            db.add(db_trade)
            
            # Update counterparty order
            # If incoming was BUY, counterparty is SELL (sell_order_id)
            # If incoming was SELL, counterparty is BUY (buy_order_id)
            
            counterparty_id = str(trade.sell_order_id) if order.side == "buy" else str(trade.buy_order_id)
            
            # Fetch from DB
            cp_order = db.query(OrderDB).filter(OrderDB.order_id == counterparty_id).first()
            if cp_order:
                # We need to know the new filled amount.
                # Since we don't have the object, we can increment filled by trade qty?
                # Yes, trade qty is what was just matched.
                cp_order.filled += trade.qty
                if cp_order.filled >= cp_order.qty:
                    cp_order.status = "filled"
                else:
                    cp_order.status = "partial"
        
        db.commit()
        return response
        
    except Exception as e:
        logger.error(f"Error placing order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cancel", response_model=OrderResponse)
def cancel_order(symbol: str, order_id: str, db: Session = Depends(get_db)):
    """Cancel an order."""
    response = ENGINE.cancel_order(symbol, order_id)
    if not response:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update DB
    from orderbook.models import OrderDB
    db_order = db.query(OrderDB).filter(OrderDB.order_id == order_id).first()
    if db_order:
        db_order.status = response.status # CANCELLED
        db.commit()
        
    return response

@app.get("/market/{symbol}/snapshot", response_model=MarketSnapshot)
def get_snapshot(symbol: str):
    """Get orderbook snapshot."""
    book = ENGINE.get_book(symbol)
    return book.get_snapshot()

@app.get("/market/{symbol}/pressure", response_model=MarketPressure)
def get_pressure(symbol: str):
    """Get market pressure metrics."""
    from datetime import datetime
    from orderbook.pressure import calculate_pressure
    
    book = ENGINE.get_book(symbol)
    metrics = calculate_pressure(book)
    
    return MarketPressure(
        symbol=symbol,
        buy_volume=metrics["buy_volume"],
        sell_volume=metrics["sell_volume"],
        net_pressure=metrics["net_pressure"],
        market_price=metrics["market_price"],
        timestamp=datetime.now()
    )

@app.get("/health")
def health_check():
    """Health check endpoint for Railway monitoring."""
    return {
        "status": "healthy",
        "service": "orderbook",
        "version": "0.1.0"
    }

