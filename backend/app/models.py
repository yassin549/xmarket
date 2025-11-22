# Database models for Everything Market backend

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Stock(Base):
    """Stock/index asset definition."""
    __tablename__ = "stocks"
    
    symbol = Column(String(20), primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    denom = Column(String(50), default="shares")
    
    # Price bounds (for normalization)
    min_price = Column(Float, default=0.0)
    max_price = Column(Float, default=100.0)
    
    # Blending weights
    market_weight = Column(Float, default=0.6)
    reality_weight = Column(Float, default=0.4)
    
    # Initial state
    initial_score = Column(Float, default=50.0)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    scores = relationship("Score", back_populates="stock", uselist=False)
    events = relationship("Event", back_populates="stock")
    score_changes = relationship("ScoreChange", back_populates="stock")


class Score(Base):
    """Current scores and prices for each stock."""
    __tablename__ = "scores"
    
    symbol = Column(String(20), ForeignKey("stocks.symbol"), primary_key=True, index=True)
    
    # Core scores
    reality_score = Column(Float, default=50.0)
    final_price = Column(Float, default=50.0)
    confidence = Column(Float, default=0.5)
    
    # Metadata
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    stock = relationship("Stock", back_populates="scores")


class Event(Base):
    """Reality events that impact scores."""
    __tablename__ = "events"
    
    id = Column(String(36), primary_key=True)  # UUID
    symbol = Column(String(20), ForeignKey("stocks.symbol"), nullable=False, index=True)
    
    # Impact scoring
    impact_points = Column(Float, nullable=False)
    quick_score = Column(Float, nullable=False)
    
    # Content
    summary = Column(Text, nullable=False)
    sources = Column(JSON, nullable=False)  # List of {id, url, trust}
    
    # Metadata
    num_independent_sources = Column(Integer, default=1)
    llm_mode = Column(String(20), nullable=True)  # tiny, local, heuristic, None
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    stock = relationship("Stock", back_populates="events")
    llm_call = relationship("LLMCall", back_populates="event", uselist=False)
    audit = relationship("LLMAudit", back_populates="event", uselist=False)
    score_changes = relationship("ScoreChange", back_populates="event")
    
    __table_args__ = (
        Index("idx_events_symbol_created", "symbol", "created_at"),
    )


class LLMAudit(Base):
    """Pending audits for suspicious events."""
    __tablename__ = "llm_audit"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(36), ForeignKey("events.id"), unique=True, nullable=False, index=True)
    symbol = Column(String(20), nullable=False)
    
    # Event details for review
    summary = Column(Text, nullable=False)
    impact = Column(Float, nullable=False)
    sources = Column(JSON, nullable=False)
    
    # Approval workflow
    approved = Column(Boolean, nullable=True)  # None = pending, True/False = decision
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    event = relationship("Event", back_populates="audit")


class ScoreChange(Base):
    """Audit trail of all score changes."""
    __tablename__ = "score_changes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), ForeignKey("stocks.symbol"), nullable=False, index=True)
    event_id = Column(String(36), ForeignKey("events.id"), nullable=True, index=True)
    
    # Change details
    old_score = Column(Float, nullable=False)
    new_score = Column(Float, nullable=False)
    delta = Column(Float, nullable=False)
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    stock = relationship("Stock", back_populates="score_changes")
    event = relationship("Event", back_populates="score_changes")
    
    __table_args__ = (
        Index("idx_score_changes_symbol_timestamp", "symbol", "timestamp"),
    )


class LLMCall(Base):
    """Log of all LLM invocations for debugging and rate limiting."""
    __tablename__ = "llm_calls"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String(36), ForeignKey("events.id"), nullable=True, index=True)
    
    # Call details
    llm_mode = Column(String(20), nullable=False)
    input_hash = Column(String(64), nullable=False)  # SHA256 of input
    output_json = Column(JSON, nullable=True)
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    duration_ms = Column(Integer, nullable=True)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    event = relationship("Event", back_populates="llm_call")
    
    __table_args__ = (
        Index("idx_llm_calls_timestamp", "timestamp"),
    )


# Orderbook models (can be in separate DB or same)

class Order(Base):
    """User orders in the orderbook."""
    __tablename__ = "orders"
    
    order_id = Column(String(36), primary_key=True)  # UUID
    user_id = Column(String(100), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    
    # Order details
    side = Column(String(4), nullable=False)  # BUY or SELL
    order_type = Column(String(10), nullable=False)  # LIMIT or MARKET
    price = Column(Float, nullable=True)  # None for market orders
    quantity = Column(Float, nullable=False)
    filled = Column(Float, default=0.0)
    
    # Status
    status = Column(String(20), default="OPEN")  # OPEN, FILLED, PARTIAL, CANCELLED
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    buy_trades = relationship("Trade", foreign_keys="Trade.buy_order_id", back_populates="buy_order")
    sell_trades = relationship("Trade", foreign_keys="Trade.sell_order_id", back_populates="sell_order")
    
    __table_args__ = (
        Index("idx_orders_symbol_status", "symbol", "status"),
        Index("idx_orders_symbol_price", "symbol", "price"),
    )


class Trade(Base):
    """Executed trades."""
    __tablename__ = "trade_history"
    
    trade_id = Column(String(36), primary_key=True)  # UUID
    buy_order_id = Column(String(36), ForeignKey("orders.order_id"), nullable=False, index=True)
    sell_order_id = Column(String(36), ForeignKey("orders.order_id"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    
    # Trade details
    price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    buy_order = relationship("Order", foreign_keys=[buy_order_id], back_populates="buy_trades")
    sell_order = relationship("Order", foreign_keys=[sell_order_id], back_populates="sell_trades")
    
    __table_args__ = (
        Index("idx_trades_symbol_timestamp", "symbol", "timestamp"),
    )
