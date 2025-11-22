"""
Orderbook Data Models
=====================

Defines Pydantic models for API and SQLAlchemy models for persistence.
"""

from enum import Enum
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import Column, String, Float, DateTime, Enum as SAEnum, ForeignKey, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# ============================================================================
# Enums
# ============================================================================

class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"

class OrderType(str, Enum):
    LIMIT = "limit"
    MARKET = "market"

class OrderStatus(str, Enum):
    OPEN = "open"
    PARTIAL = "partial"
    FILLED = "filled"
    CANCELLED = "cancelled"

# ============================================================================
# Pydantic Models (API)
# ============================================================================

class OrderCreate(BaseModel):
    """Payload to create a new order."""
    symbol: str = Field(..., min_length=1, max_length=10)
    side: OrderSide
    type: OrderType
    price: float = Field(..., gt=0, description="Price (0-100)")
    qty: float = Field(..., gt=0, description="Quantity")
    user_id: str = Field(..., description="User identifier")
    
    model_config = ConfigDict(from_attributes=True)

class OrderResponse(BaseModel):
    """Response for order creation/query."""
    order_id: UUID
    symbol: str
    side: OrderSide
    type: OrderType
    price: float
    qty: float
    filled: float
    status: OrderStatus
    created_at: datetime
    user_id: str

    model_config = ConfigDict(from_attributes=True)

class TradeResponse(BaseModel):
    """Response for a trade execution."""
    trade_id: UUID
    symbol: str
    price: float
    qty: float
    buy_order_id: UUID
    sell_order_id: UUID
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class OrderBookLevel(BaseModel):
    """Single price level in the orderbook."""
    price: float
    qty: float
    count: int

class MarketSnapshot(BaseModel):
    """Current state of the orderbook."""
    symbol: str
    bids: List[OrderBookLevel]
    asks: List[OrderBookLevel]
    timestamp: datetime

class MarketPressure(BaseModel):
    """Market pressure metrics."""
    symbol: str
    buy_volume: float
    sell_volume: float
    net_pressure: float
    market_price: float
    timestamp: datetime

# ============================================================================
# SQLAlchemy Models (Persistence)
# ============================================================================

class Base(DeclarativeBase):
    pass

class OrderDB(Base):
    """
    Persistent storage for orders.
    Replayed on startup to rebuild in-memory state.
    """
    __tablename__ = "orders"

    order_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=False)
    symbol: Mapped[str] = mapped_column(String, index=True, nullable=False)
    side: Mapped[OrderSide] = mapped_column(SAEnum(OrderSide), nullable=False)
    type: Mapped[OrderType] = mapped_column(SAEnum(OrderType), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    filled: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus), default=OrderStatus.OPEN)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class TradeDB(Base):
    """
    Persistent storage for trade history.
    """
    __tablename__ = "trade_history"

    trade_id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    symbol: Mapped[str] = mapped_column(String, index=True, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    buy_order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.order_id"), nullable=False)
    sell_order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.order_id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
