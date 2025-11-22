"""
FastAPI orderbook service.
Handles order placement, matching, and market pressure calculation.
"""
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import logging
import sys
import os
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from config import env, constants
from .matching_engine import (
    OrderBookManager,
    Order,
    OrderSide,
    OrderType,
    OrderStatus
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, env.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Everything Market Orderbook",
    description="Order matching and market pressure service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if env.DEBUG else [env.FRONTEND_URL, env.BACKEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global order book manager
order_book_manager = OrderBookManager()

# WebSocket connections
active_connections: List[WebSocket] = []


# ============================================================================
# Schemas
# ============================================================================

class OrderCreate(BaseModel):
    """Schema for creating an order."""
    user_id: str = Field(..., description="User ID")
    symbol: str = Field(..., description="Stock symbol")
    side: str = Field(..., description="BUY or SELL")
    order_type: str = Field(..., description="LIMIT or MARKET")
    quantity: float = Field(..., gt=0, description="Order quantity")
    price: Optional[float] = Field(None, gt=0, description="Limit price (required for LIMIT orders)")
    
    def validate_price(self):
        """Validate price for limit orders."""
        if self.order_type == "LIMIT" and self.price is None:
            raise ValueError("Price is required for LIMIT orders")


class OrderResponse(BaseModel):
    """Schema for order response."""
    order_id: str
    user_id: str
    symbol: str
    side: str
    order_type: str
    quantity: float
    price: Optional[float]
    filled: float
    status: str
    created_at: datetime


class TradeResponse(BaseModel):
    """Schema for trade response."""
    trade_id: str
    buy_order_id: str
    sell_order_id: str
    symbol: str
    price: float
    quantity: float
    timestamp: datetime


class MarketPressureResponse(BaseModel):
    """Schema for market pressure response."""
    stock: str
    market_price: float
    buy_volume: float
    sell_volume: float
    net_pressure: float
    timestamp: str


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "everything-market-orderbook",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.post("/api/v1/orders", response_model=OrderResponse)
async def place_order(order_create: OrderCreate):
    """Place a new order."""
    try:
        order_create.validate_price()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Create order
    order = Order(
        order_id=str(uuid.uuid4()),
        user_id=order_create.user_id,
        symbol=order_create.symbol,
        side=OrderSide(order_create.side),
        order_type=OrderType(order_create.order_type),
        quantity=order_create.quantity,
        price=order_create.price
    )
    
    # Get or create order book
    book = order_book_manager.get_or_create_book(order_create.symbol)
    
    # Add order and match
    trades = book.add_order(order)
    
    logger.info(f"Order placed: {order.order_id} | {order.symbol} | {order.side} | {order.quantity}@{order.price}")
    
    # Broadcast trades
    if trades:
        for trade in trades:
            await broadcast_trade(trade)
    
    # Broadcast order book update
    await broadcast_orderbook_update(order_create.symbol)
    
    return OrderResponse(
        order_id=order.order_id,
        user_id=order.user_id,
        symbol=order.symbol,
        side=order.side.value,
        order_type=order.order_type.value,
        quantity=order.quantity,
        price=order.price,
        filled=order.filled,
        status=order.status.value,
        created_at=order.created_at
    )


@app.post("/api/v1/cancel")
async def cancel_order(order_id: str, symbol: str):
    """Cancel an open order."""
    book = order_book_manager.get_book(symbol)
    if not book:
        raise HTTPException(status_code=404, detail=f"Order book for {symbol} not found")
    
    success = book.cancel_order(order_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found or cannot be cancelled")
    
    # Broadcast update
    await broadcast_orderbook_update(symbol)
    
    return {"status": "cancelled", "order_id": order_id}


@app.get("/api/v1/market/{symbol}/snapshot")
async def get_market_snapshot(symbol: str):
    """Get order book snapshot."""
    book = order_book_manager.get_book(symbol)
    if not book:
        raise HTTPException(status_code=404, detail=f"Order book for {symbol} not found")
    
    top = book.get_top_of_book()
    depth = book.get_depth(levels=constants.ORDER_BOOK_DEPTH)
    recent_trades = book.get_recent_trades(limit=20)
    
    return {
        "symbol": symbol,
        "top_of_book": top,
        "depth": depth,
        "market_price": book.compute_market_price(),
        "recent_trades": [
            TradeResponse(
                trade_id=t.trade_id,
                buy_order_id=t.buy_order_id,
                sell_order_id=t.sell_order_id,
                symbol=t.symbol,
                price=t.price,
                quantity=t.quantity,
                timestamp=t.timestamp
            )
            for t in recent_trades
        ]
    }


@app.get("/api/v1/market/{symbol}/pressure", response_model=MarketPressureResponse)
async def get_market_pressure(symbol: str):
    """Get market pressure for backend blending."""
    book = order_book_manager.get_book(symbol)
    if not book:
        # Return default values if no order book exists yet
        return MarketPressureResponse(
            stock=symbol,
            market_price=constants.INITIAL_PRICE,
            buy_volume=0.0,
            sell_volume=0.0,
            net_pressure=0.0,
            timestamp=datetime.utcnow().isoformat()
        )
    
    market_price = book.compute_market_price()
    pressure = book.compute_pressure(window_minutes=60)
    
    return MarketPressureResponse(
        stock=symbol,
        market_price=market_price,
        buy_volume=pressure["buy_volume"],
        sell_volume=pressure["sell_volume"],
        net_pressure=pressure["net_pressure"],
        timestamp=datetime.utcnow().isoformat()
    )


# ============================================================================
# WebSocket
# ============================================================================

async def broadcast_trade(trade):
    """Broadcast trade to all connected clients."""
    message = {
        "type": "trade_event",
        "trade_id": trade.trade_id,
        "symbol": trade.symbol,
        "price": trade.price,
        "quantity": trade.quantity,
        "timestamp": trade.timestamp.isoformat()
    }
    
    disconnected = []
    for connection in active_connections:
        try:
            await connection.send_json(message)
        except:
            disconnected.append(connection)
    
    for conn in disconnected:
        active_connections.remove(conn)


async def broadcast_orderbook_update(symbol: str):
    """Broadcast order book update."""
    book = order_book_manager.get_book(symbol)
    if not book:
        return
    
    top = book.get_top_of_book()
    
    message = {
        "type": "orderbook_update",
        "symbol": symbol,
        "best_bid": top["best_bid"],
        "best_ask": top["best_ask"],
        "mid_price": top["mid_price"],
        "timestamp": datetime.utcnow().isoformat()
    }
    
    disconnected = []
    for connection in active_connections:
        try:
            await connection.send_json(message)
        except:
            disconnected.append(connection)
    
    for conn in disconnected:
        active_connections.remove(conn)


@app.websocket("/ws/orders")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time order book updates."""
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"WebSocket connected. Total connections: {len(active_connections)}")
    
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            logger.debug(f"Received from client: {data}")
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(active_connections)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=env.HOST,
        port=env.PORT,
        reload=env.DEBUG,
        log_level=env.LOG_LEVEL.lower()
    )
