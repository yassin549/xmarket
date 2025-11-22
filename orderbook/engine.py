"""
Matching Engine
===============

In-memory order matching engine with price-time priority.
"""

import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
from uuid import uuid4, UUID
from collections import deque

from orderbook.models import OrderSide, OrderType, OrderStatus, OrderCreate, OrderResponse, TradeResponse

logger = logging.getLogger(__name__)

class Order:
    """Internal order representation for the engine."""
    def __init__(self, order_id: str, side: OrderSide, price: float, qty: float, user_id: str, created_at: datetime):
        self.order_id = order_id
        self.side = side
        self.price = price
        self.qty = qty
        self.filled = 0.0
        self.user_id = user_id
        self.created_at = created_at
        self.status = OrderStatus.OPEN

    @property
    def remaining(self) -> float:
        return self.qty - self.filled

    def to_response(self) -> OrderResponse:
        return OrderResponse(
            order_id=UUID(self.order_id),
            symbol="UNKNOWN", # Engine manages per symbol, so this needs context
            side=self.side,
            type=OrderType.LIMIT, # Internal engine treats everything as limit-like logic
            price=self.price,
            qty=self.qty,
            filled=self.filled,
            status=self.status,
            created_at=self.created_at,
            user_id=self.user_id
        )

class OrderBook:
    """
    Orderbook for a single symbol.
    
    Bids: Buy orders, sorted by Price DESC, Time ASC
    Asks: Sell orders, sorted by Price ASC, Time ASC
    """
    def __init__(self, symbol: str):
        self.symbol = symbol
        # Price -> List[Order] (deque for FIFO)
        self.bids: Dict[float, deque] = {} 
        self.asks: Dict[float, deque] = {}
        # Sorted price levels
        self.bid_prices: List[float] = [] # Descending
        self.ask_prices: List[float] = [] # Ascending
        # Quick lookup
        self.orders: Dict[str, Order] = {}

    def add_order(self, order: Order) -> List[Tuple[Order, Order, float]]:
        """
        Match order against book and add remaining to book.
        Returns list of trades: (buy_order, sell_order, qty)
        """
        trades = []
        
        if order.side == OrderSide.BUY:
            trades = self._match_buy(order)
        else:
            trades = self._match_sell(order)
            
        # If remaining, add to book
        if order.remaining > 0 and order.status != OrderStatus.FILLED:
            self._add_to_book(order)
            self.orders[order.order_id] = order
            
        return trades

    def _match_buy(self, order: Order) -> List[Tuple[Order, Order, float]]:
        trades = []
        
        # Match against asks (lowest price first)
        while order.remaining > 0 and self.ask_prices:
            best_ask_price = self.ask_prices[0]
            
            # If bid price < best ask, no match (unless market order, handled separately)
            # For now assuming limit orders. Market orders should have price=Inf or handled before.
            if order.price < best_ask_price:
                break
                
            # Get orders at this price level
            level_orders = self.asks[best_ask_price]
            
            while order.remaining > 0 and level_orders:
                ask_order = level_orders[0]
                
                # Calculate trade qty
                trade_qty = min(order.remaining, ask_order.remaining)
                
                # Update orders
                order.filled += trade_qty
                ask_order.filled += trade_qty
                
                # Update status
                self._update_status(order)
                self._update_status(ask_order)
                
                # Record trade
                trades.append((order, ask_order, trade_qty))
                
                # Remove filled ask
                if ask_order.status == OrderStatus.FILLED:
                    level_orders.popleft()
                    del self.orders[ask_order.order_id]
                else:
                    break # Ask partially filled, meaning incoming order is filled
            
            # Clean up empty price level
            if not level_orders:
                del self.asks[best_ask_price]
                self.ask_prices.pop(0)
                
        return trades

    def _match_sell(self, order: Order) -> List[Tuple[Order, Order, float]]:
        trades = []
        
        # Match against bids (highest price first)
        while order.remaining > 0 and self.bid_prices:
            best_bid_price = self.bid_prices[0]
            
            if order.price > best_bid_price:
                break
                
            level_orders = self.bids[best_bid_price]
            
            while order.remaining > 0 and level_orders:
                bid_order = level_orders[0]
                
                trade_qty = min(order.remaining, bid_order.remaining)
                
                order.filled += trade_qty
                bid_order.filled += trade_qty
                
                self._update_status(order)
                self._update_status(bid_order)
                
                trades.append((bid_order, order, trade_qty))
                
                if bid_order.status == OrderStatus.FILLED:
                    level_orders.popleft()
                    del self.orders[bid_order.order_id]
                else:
                    break
            
            if not level_orders:
                del self.bids[best_bid_price]
                self.bid_prices.pop(0)
                
        return trades

    def _add_to_book(self, order: Order):
        """Add non-filled order to book."""
        if order.side == OrderSide.BUY:
            if order.price not in self.bids:
                self.bids[order.price] = deque()
                self.bid_prices.append(order.price)
                self.bid_prices.sort(reverse=True)
            self.bids[order.price].append(order)
        else:
            if order.price not in self.asks:
                self.asks[order.price] = deque()
                self.ask_prices.append(order.price)
                self.ask_prices.sort()
            self.asks[order.price].append(order)

    def _update_status(self, order: Order):
        if order.filled >= order.qty:
            order.status = OrderStatus.FILLED
        elif order.filled > 0:
            order.status = OrderStatus.PARTIAL
        else:
            order.status = OrderStatus.OPEN

    def cancel_order(self, order_id: str) -> Optional[Order]:
        """Cancel an order if it exists."""
        if order_id not in self.orders:
            return None
            
        order = self.orders[order_id]
        
        # Remove from book
        if order.side == OrderSide.BUY:
            if order.price in self.bids:
                try:
                    self.bids[order.price].remove(order)
                    if not self.bids[order.price]:
                        del self.bids[order.price]
                        self.bid_prices.remove(order.price)
                except ValueError:
                    pass # Should not happen if logic is correct
        else:
            if order.price in self.asks:
                try:
                    self.asks[order.price].remove(order)
                    if not self.asks[order.price]:
                        del self.asks[order.price]
                        self.ask_prices.remove(order.price)
                except ValueError:
                    pass

        del self.orders[order_id]
        order.status = OrderStatus.CANCELLED
        return order

    def get_snapshot(self, depth: int = 10) -> dict:
        """Get orderbook snapshot."""
        bids = []
        for price in self.bid_prices[:depth]:
            qty = sum(o.remaining for o in self.bids[price])
            count = len(self.bids[price])
            bids.append({"price": price, "qty": qty, "count": count})
            
        asks = []
        for price in self.ask_prices[:depth]:
            qty = sum(o.remaining for o in self.asks[price])
            count = len(self.asks[price])
            asks.append({"price": price, "qty": qty, "count": count})
            
        return {
            "symbol": self.symbol,
            "bids": bids,
            "asks": asks,
            "timestamp": datetime.now(timezone.utc)
        }

class Engine:
    """Global matching engine managing multiple orderbooks."""
    def __init__(self):
        self.books: Dict[str, OrderBook] = {}

    def get_book(self, symbol: str) -> OrderBook:
        if symbol not in self.books:
            self.books[symbol] = OrderBook(symbol)
        return self.books[symbol]

    def place_order(self, order_create: OrderCreate) -> Tuple[OrderResponse, List[TradeResponse]]:
        book = self.get_book(order_create.symbol)
        
        order = Order(
            order_id=str(uuid4()),
            side=order_create.side,
            price=order_create.price,
            qty=order_create.qty,
            user_id=order_create.user_id,
            created_at=datetime.now(timezone.utc)
        )
        
        raw_trades = book.add_order(order)
        
        # Convert trades to response format
        trades = []
        for buy, sell, qty in raw_trades:
            trades.append(TradeResponse(
                trade_id=uuid4(),
                symbol=order_create.symbol,
                price=sell.price if order.side == OrderSide.BUY else buy.price, # Trade price is maker price
                qty=qty,
                buy_order_id=UUID(buy.order_id),
                sell_order_id=UUID(sell.order_id),
                timestamp=datetime.now(timezone.utc)
            ))
            
        response = order.to_response()
        response.symbol = order_create.symbol # Inject symbol
        
        return response, trades

    def cancel_order(self, symbol: str, order_id: str) -> Optional[OrderResponse]:
        if symbol not in self.books:
            return None
        
        book = self.books[symbol]
        order = book.cancel_order(order_id)
        
        if order:
            resp = order.to_response()
            resp.symbol = symbol
            return resp
        return None
