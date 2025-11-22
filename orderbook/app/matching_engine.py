"""
Order matching engine with price-time priority.
Implements deterministic matching, partial fills, and trade execution.
"""
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import uuid
import logging
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class OrderSide(str, Enum):
    """Order side enum."""
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    """Order type enum."""
    LIMIT = "LIMIT"
    MARKET = "MARKET"


class OrderStatus(str, Enum):
    """Order status enum."""
    OPEN = "OPEN"
    PARTIAL = "PARTIAL"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"


@dataclass
class Order:
    """Order data structure."""
    order_id: str
    user_id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: Optional[float] = None
    filled: float = 0.0
    status: OrderStatus = OrderStatus.OPEN
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def remaining(self) -> float:
        """Get remaining unfilled quantity."""
        return self.quantity - self.filled
    
    def fill(self, quantity: float):
        """Fill order by quantity."""
        self.filled += quantity
        if self.filled >= self.quantity:
            self.status = OrderStatus.FILLED
        elif self.filled > 0:
            self.status = OrderStatus.PARTIAL


@dataclass
class Trade:
    """Trade execution record."""
    trade_id: str
    buy_order_id: str
    sell_order_id: str
    symbol: str
    price: float
    quantity: float
    timestamp: datetime = field(default_factory=datetime.utcnow)


class OrderBook:
    """
    Order book for a single symbol.
    Maintains buy and sell orders with price-time priority matching.
    """
    
    def __init__(self, symbol: str):
        self.symbol = symbol
        
        # Price levels: {price: [orders]} sorted by time
        self.bids: Dict[float, List[Order]] = defaultdict(list)  # Buy orders
        self.asks: Dict[float, List[Order]] = defaultdict(list)  # Sell orders
        
        # Order lookup
        self.orders: Dict[str, Order] = {}
        
        # Trade history
        self.trades: List[Trade] = []
        
        logger.info(f"Initialized order book for {symbol}")
    
    def add_order(self, order: Order) -> List[Trade]:
        """
        Add order to book and attempt matching.
        
        Returns:
            List of executed trades
        """
        if order.order_type == OrderType.MARKET:
            return self._execute_market_order(order)
        else:
            return self._add_limit_order(order)
    
    def _add_limit_order(self, order: Order) -> List[Trade]:
        """Add limit order and match if possible."""
        trades = []
        
        if order.side == OrderSide.BUY:
            # Match against asks
            trades = self._match_order(order, self.asks, reverse=False)
            
            # Add remaining to bids if not fully filled
            if order.remaining > 0:
                self.bids[order.price].append(order)
                self.orders[order.order_id] = order
        else:  # SELL
            # Match against bids
            trades = self._match_order(order, self.bids, reverse=True)
            
            # Add remaining to asks if not fully filled
            if order.remaining > 0:
                self.asks[order.price].append(order)
                self.orders[order.order_id] = order
        
        return trades
    
    def _execute_market_order(self, order: Order) -> List[Trade]:
        """Execute market order at best available prices."""
        trades = []
        
        if order.side == OrderSide.BUY:
            trades = self._match_order(order, self.asks, reverse=False, market=True)
        else:  # SELL
            trades = self._match_order(order, self.bids, reverse=True, market=True)
        
        # Market orders that can't be filled are rejected
        if order.remaining > 0:
            order.status = OrderStatus.CANCELLED
            logger.warning(f"Market order {order.order_id} partially unfilled: {order.remaining} remaining")
        
        return trades
    
    def _match_order(
        self,
        order: Order,
        book: Dict[float, List[Order]],
        reverse: bool,
        market: bool = False
    ) -> List[Trade]:
        """
        Match order against opposite side of book.
        
        Args:
            order: Incoming order
            book: Opposite side order book (asks for buy, bids for sell)
            reverse: True for matching against bids (descending), False for asks (ascending)
            market: True if market order (match at any price)
        
        Returns:
            List of executed trades
        """
        trades = []
        
        # Sort price levels (ascending for asks, descending for bids)
        sorted_prices = sorted(book.keys(), reverse=reverse)
        
        for price in sorted_prices:
            # Check if price is acceptable
            if not market:
                if order.side == OrderSide.BUY and price > order.price:
                    break  # No more acceptable prices
                if order.side == OrderSide.SELL and price < order.price:
                    break
            
            # Match against orders at this price level (FIFO)
            price_level = book[price]
            
            while price_level and order.remaining > 0:
                resting_order = price_level[0]
                
                # Determine trade quantity
                trade_qty = min(order.remaining, resting_order.remaining)
                
                # Create trade
                trade = Trade(
                    trade_id=str(uuid.uuid4()),
                    buy_order_id=order.order_id if order.side == OrderSide.BUY else resting_order.order_id,
                    sell_order_id=resting_order.order_id if order.side == OrderSide.BUY else order.order_id,
                    symbol=self.symbol,
                    price=price,  # Trade at resting order price
                    quantity=trade_qty
                )
                
                # Fill both orders
                order.fill(trade_qty)
                resting_order.fill(trade_qty)
                
                # Remove resting order if fully filled
                if resting_order.status == OrderStatus.FILLED:
                    price_level.pop(0)
                
                trades.append(trade)
                self.trades.append(trade)
                
                logger.info(
                    f"Trade executed: {trade.trade_id} | {self.symbol} | "
                    f"{trade.quantity}@{trade.price}"
                )
            
            # Clean up empty price level
            if not price_level:
                del book[price]
            
            # Stop if order is filled
            if order.remaining == 0:
                break
        
        return trades
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order."""
        order = self.orders.get(order_id)
        if not order:
            return False
        
        if order.status not in [OrderStatus.OPEN, OrderStatus.PARTIAL]:
            return False
        
        # Remove from book
        book = self.bids if order.side == OrderSide.BUY else self.asks
        price_level = book.get(order.price, [])
        
        if order in price_level:
            price_level.remove(order)
            if not price_level:
                del book[order.price]
        
        # Update status
        order.status = OrderStatus.CANCELLED
        
        logger.info(f"Cancelled order {order_id}")
        return True
    
    def get_top_of_book(self) -> Dict[str, Optional[float]]:
        """Get best bid and ask prices."""
        best_bid = max(self.bids.keys()) if self.bids else None
        best_ask = min(self.asks.keys()) if self.asks else None
        
        return {
            "best_bid": best_bid,
            "best_ask": best_ask,
            "mid_price": (best_bid + best_ask) / 2 if best_bid and best_ask else None
        }
    
    def get_depth(self, levels: int = 10) -> Dict[str, List[Tuple[float, float]]]:
        """
        Get order book depth.
        
        Returns:
            {"bids": [(price, quantity), ...], "asks": [(price, quantity), ...]}
        """
        # Aggregate quantities at each price level
        bid_depth = []
        for price in sorted(self.bids.keys(), reverse=True)[:levels]:
            total_qty = sum(order.remaining for order in self.bids[price])
            bid_depth.append((price, total_qty))
        
        ask_depth = []
        for price in sorted(self.asks.keys())[:levels]:
            total_qty = sum(order.remaining for order in self.asks[price])
            ask_depth.append((price, total_qty))
        
        return {
            "bids": bid_depth,
            "asks": ask_depth
        }
    
    def get_recent_trades(self, limit: int = 50) -> List[Trade]:
        """Get recent trades."""
        return self.trades[-limit:]
    
    def compute_market_price(self) -> float:
        """
        Compute normalized market price (0-100 scale).
        Uses mid-price or last trade price.
        """
        top = self.get_top_of_book()
        
        if top["mid_price"] is not None:
            return top["mid_price"]
        
        # Fallback to last trade price
        if self.trades:
            return self.trades[-1].price
        
        # Default to 50 if no data
        return 50.0
    
    def compute_pressure(self, window_minutes: int = 60) -> Dict[str, float]:
        """
        Compute market pressure from recent trades.
        
        Returns:
            {
                "buy_volume": float,
                "sell_volume": float,
                "net_pressure": float
            }
        """
        from datetime import timedelta
        
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        recent_trades = [t for t in self.trades if t.timestamp >= cutoff]
        
        buy_volume = sum(t.quantity for t in recent_trades)
        sell_volume = buy_volume  # Trades have equal buy/sell volume
        
        # Calculate net pressure from order book imbalance
        total_bid_qty = sum(
            sum(order.remaining for order in orders)
            for orders in self.bids.values()
        )
        total_ask_qty = sum(
            sum(order.remaining for order in orders)
            for orders in self.asks.values()
        )
        
        net_pressure = total_bid_qty - total_ask_qty
        
        return {
            "buy_volume": buy_volume,
            "sell_volume": sell_volume,
            "net_pressure": net_pressure
        }


class OrderBookManager:
    """Manages multiple order books (one per symbol)."""
    
    def __init__(self):
        self.books: Dict[str, OrderBook] = {}
    
    def get_or_create_book(self, symbol: str) -> OrderBook:
        """Get or create order book for symbol."""
        if symbol not in self.books:
            self.books[symbol] = OrderBook(symbol)
        return self.books[symbol]
    
    def get_book(self, symbol: str) -> Optional[OrderBook]:
        """Get order book for symbol."""
        return self.books.get(symbol)
