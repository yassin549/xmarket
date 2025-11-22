"""
Orderbook Persistence Layer
===========================

Handles database operations for orders and trades.
"""

import logging
from typing import List
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session

from config.env import get_database_url
from orderbook.models import Base, OrderDB, TradeDB, OrderStatus, OrderSide
from orderbook.engine import Engine, Order

logger = logging.getLogger(__name__)

# Database setup
_ENGINE = None
_SESSION_MAKER = None

def get_db_engine():
    global _ENGINE
    if _ENGINE is None:
        url = get_database_url()
        _ENGINE = create_engine(url)
    return _ENGINE

def get_session_maker():
    global _SESSION_MAKER
    if _SESSION_MAKER is None:
        engine = get_db_engine()
        _SESSION_MAKER = sessionmaker(bind=engine)
    return _SESSION_MAKER

def init_db():
    """Initialize database tables."""
    engine = get_db_engine()
    Base.metadata.create_all(engine)
    logger.info("Orderbook tables initialized")

def persist_order(session: Session, order: Order, symbol: str):
    """
    Persist a new order or update existing one.
    
    For high throughput, this should ideally be async or batched,
    but for now we do synchronous updates.
    """
    # Check if exists
    stmt = select(OrderDB).where(OrderDB.order_id == order.order_id)
    existing = session.execute(stmt).scalar_one_or_none()
    
    if existing:
        existing.filled = order.filled
        existing.status = order.status
    else:
        db_order = OrderDB(
            order_id=order.order_id,
            user_id=order.user_id,
            symbol=symbol,
            side=order.side,
            type=order.type if hasattr(order, 'type') else "limit", # Engine order doesn't store type currently, assuming limit
            price=order.price,
            qty=order.qty,
            filled=order.filled,
            status=order.status,
            created_at=order.created_at
        )
        session.add(db_order)

def persist_trade(session: Session, trade_response):
    """Persist a trade execution."""
    trade = TradeDB(
        trade_id=str(trade_response.trade_id),
        symbol=trade_response.symbol,
        price=trade_response.price,
        qty=trade_response.qty,
        buy_order_id=str(trade_response.buy_order_id),
        sell_order_id=str(trade_response.sell_order_id),
        timestamp=trade_response.timestamp
    )
    session.add(trade)

def load_active_orders(session: Session) -> List[OrderDB]:
    """Load all OPEN or PARTIAL orders from DB."""
    stmt = select(OrderDB).where(
        OrderDB.status.in_([OrderStatus.OPEN, OrderStatus.PARTIAL])
    ).order_by(OrderDB.created_at)
    
    return list(session.execute(stmt).scalars().all())

def replay_orders(engine: Engine, orders: List[OrderDB]):
    """
    Replay orders into the engine to rebuild state.
    
    Args:
        engine: The matching engine instance
        orders: List of OrderDB objects
    """
    count = 0
    for db_order in orders:
        # Create engine Order
        order = Order(
            order_id=db_order.order_id,
            side=db_order.side,
            price=db_order.price,
            qty=db_order.qty,
            user_id=db_order.user_id,
            created_at=db_order.created_at
        )
        order.filled = db_order.filled
        order.status = db_order.status
        
        # Add to book directly (bypass matching logic as these are already processed state)
        # Wait, if we just add them to book, we assume they are not matched against each other.
        # Since we only load OPEN/PARTIAL, they shouldn't match (unless logic changed).
        # But wait, if we replay them, we should just add them to the book structure.
        
        book = engine.get_book(db_order.symbol)
        book._add_to_book(order)
        book.orders[order.order_id] = order
        
        count += 1
        
    logger.info(f"Replayed {count} active orders from DB")
