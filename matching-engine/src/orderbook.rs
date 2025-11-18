use crate::types::{Order, OrderSide, OrderType};
use parking_lot::RwLock;
use rust_decimal::Decimal;
use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use uuid::Uuid;

/// Price-time priority orderbook
/// Uses BTreeMap for efficient price level ordering
pub struct Orderbook {
    market_id: String,
    // Bids: highest price first (descending)
    bids: Arc<RwLock<BTreeMap<PriceLevelKey, PriceLevel>>>,
    // Asks: lowest price first (ascending, but we use negative prices for ordering)
    asks: Arc<RwLock<BTreeMap<PriceLevelKey, PriceLevel>>>,
    // Active orders by ID for fast lookup
    orders: Arc<RwLock<HashMap<Uuid, Order>>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct PriceLevelKey {
    // For bids: price (descending), then negative timestamp (ascending)
    // For asks: negative price (ascending), then negative timestamp (ascending)
    price_key: i64,
    timestamp_ns: i64,
}

impl PriceLevelKey {
    fn for_bid(price: Decimal, timestamp_ns: i64) -> Self {
        // Convert price to integer (scaled by 1e8 for precision)
        let price_scaled = (price * Decimal::from(100_000_000u64))
            .to_i64()
            .unwrap_or(0);
        Self {
            // Negate for descending order (highest first)
            price_key: -price_scaled,
            timestamp_ns: -timestamp_ns, // Earlier orders first
        }
    }

    fn for_ask(price: Decimal, timestamp_ns: i64) -> Self {
        let price_scaled = (price * Decimal::from(100_000_000u64))
            .to_i64()
            .unwrap_or(0);
        Self {
            // Positive for ascending order (lowest first)
            price_key: price_scaled,
            timestamp_ns: -timestamp_ns, // Earlier orders first
        }
    }
}

#[derive(Debug, Clone)]
struct PriceLevel {
    price: Decimal,
    orders: Vec<Order>,
    total_quantity: Decimal,
}

impl PriceLevel {
    fn new(price: Decimal) -> Self {
        Self {
            price,
            orders: Vec::new(),
            total_quantity: Decimal::ZERO,
        }
    }

    fn add_order(&mut self, order: Order) {
        self.total_quantity += order.remaining_quantity;
        self.orders.push(order);
    }

    fn remove_order(&mut self, order_id: &Uuid) -> Option<Order> {
        if let Some(pos) = self.orders.iter().position(|o| o.id == *order_id) {
            let order = self.orders.remove(pos);
            self.total_quantity -= order.remaining_quantity;
            Some(order)
        } else {
            None
        }
    }

    fn update_order(&mut self, order: &Order) {
        if let Some(existing) = self.orders.iter_mut().find(|o| o.id == order.id) {
            let old_qty = existing.remaining_quantity;
            *existing = order.clone();
            self.total_quantity += order.remaining_quantity - old_qty;
        }
    }
}

impl Orderbook {
    pub fn new(market_id: String) -> Self {
        Self {
            market_id,
            bids: Arc::new(RwLock::new(BTreeMap::new())),
            asks: Arc::new(RwLock::new(BTreeMap::new())),
            orders: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn market_id(&self) -> &str {
        &self.market_id
    }

    /// Add order to orderbook
    pub fn add_order(&self, order: Order) {
        let mut orders = self.orders.write();
        orders.insert(order.id, order.clone());

        match order.side {
            OrderSide::Buy => {
                let mut bids = self.bids.write();
                let price = order.price.expect("Limit order must have price");
                let key = PriceLevelKey::for_bid(price, order.timestamp_ns);
                bids.entry(key)
                    .or_insert_with(|| PriceLevel::new(price))
                    .add_order(order);
            }
            OrderSide::Sell => {
                let mut asks = self.asks.write();
                let price = order.price.expect("Limit order must have price");
                let key = PriceLevelKey::for_ask(price, order.timestamp_ns);
                asks.entry(key)
                    .or_insert_with(|| PriceLevel::new(price))
                    .add_order(order);
            }
        }
    }

    /// Get best bid price
    pub fn best_bid(&self) -> Option<Decimal> {
        self.bids
            .read()
            .iter()
            .next()
            .map(|(_, level)| level.price)
    }

    /// Get best ask price
    pub fn best_ask(&self) -> Option<Decimal> {
        self.asks
            .read()
            .iter()
            .next()
            .map(|(_, level)| level.price)
    }

    /// Get order by ID
    pub fn get_order(&self, order_id: &Uuid) -> Option<Order> {
        self.orders.read().get(order_id).cloned()
    }

    /// Remove order from orderbook
    pub fn remove_order(&self, order_id: &Uuid) -> Option<Order> {
        let order = self.orders.write().remove(order_id)?;

        match order.side {
            OrderSide::Buy => {
                let mut bids = self.bids.write();
                if let Some(price) = order.price {
                    let key = PriceLevelKey::for_bid(price, order.timestamp_ns);
                    if let Some(level) = bids.get_mut(&key) {
                        level.remove_order(&order.id);
                        if level.orders.is_empty() {
                            bids.remove(&key);
                        }
                    }
                }
            }
            OrderSide::Sell => {
                let mut asks = self.asks.write();
                if let Some(price) = order.price {
                    let key = PriceLevelKey::for_ask(price, order.timestamp_ns);
                    if let Some(level) = asks.get_mut(&key) {
                        level.remove_order(&order.id);
                        if level.orders.is_empty() {
                            asks.remove(&key);
                        }
                    }
                }
            }
        }

        Some(order)
    }

    /// Update order in orderbook (after partial fill)
    pub fn update_order(&self, order: &Order) {
        let mut orders = self.orders.write();
        orders.insert(order.id, order.clone());

        match order.side {
            OrderSide::Buy => {
                let mut bids = self.bids.write();
                if let Some(price) = order.price {
                    let key = PriceLevelKey::for_bid(price, order.timestamp_ns);
                    if let Some(level) = bids.get_mut(&key) {
                        level.update_order(order);
                    }
                }
            }
            OrderSide::Sell => {
                let mut asks = self.asks.write();
                if let Some(price) = order.price {
                    let key = PriceLevelKey::for_ask(price, order.timestamp_ns);
                    if let Some(level) = asks.get_mut(&key) {
                        level.update_order(order);
                    }
                }
            }
        }
    }

    /// Get next order to match (best price, earliest time)
    pub fn get_next_maker(&self, side: OrderSide) -> Option<Order> {
        match side {
            OrderSide::Buy => {
                // Taker is buying, need to match against asks (sells)
                let asks = self.asks.read();
                for level in asks.values() {
                    if let Some(order) = level.orders.first() {
                        return Some(order.clone());
                    }
                }
            }
            OrderSide::Sell => {
                // Taker is selling, need to match against bids (buys)
                let bids = self.bids.read();
                for level in bids.values() {
                    if let Some(order) = level.orders.first() {
                        return Some(order.clone());
                    }
                }
            }
        }
        None
    }

    /// Get snapshot of orderbook (top N levels)
    pub fn snapshot(&self, depth: usize) -> OrderbookSnapshot {
        let bids = self.bids.read();
        let asks = self.asks.read();

        let bid_levels: Vec<_> = bids
            .values()
            .take(depth)
            .map(|level| OrderLevel {
                price: level.price,
                total_quantity: level.total_quantity,
                order_count: level.orders.len() as u32,
            })
            .collect();

        let ask_levels: Vec<_> = asks
            .values()
            .take(depth)
            .map(|level| OrderLevel {
                price: level.price,
                total_quantity: level.total_quantity,
                order_count: level.orders.len() as u32,
            })
            .collect();

        OrderbookSnapshot {
            market_id: self.market_id.clone(),
            bids: bid_levels,
            asks: ask_levels,
        }
    }
}

#[derive(Debug, Clone)]
pub struct OrderLevel {
    pub price: Decimal,
    pub total_quantity: Decimal,
    pub order_count: u32,
}

#[derive(Debug, Clone)]
pub struct OrderbookSnapshot {
    pub market_id: String,
    pub bids: Vec<OrderLevel>,
    pub asks: Vec<OrderLevel>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TimestampGenerator;

    #[test]
    fn test_orderbook_add_bid() {
        let book = Orderbook::new("test".to_string());
        let order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Some(Decimal::from(50)),
            Decimal::from(10),
            TimestampGenerator::now_ns(),
            1,
        );
        
        book.add_order(order.clone());
        assert_eq!(book.best_bid(), Some(Decimal::from(50)));
        assert_eq!(book.get_order(&order.id), Some(order));
    }

    #[test]
    fn test_orderbook_add_ask() {
        let book = Orderbook::new("test".to_string());
        let order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Some(Decimal::from(51)),
            Decimal::from(10),
            TimestampGenerator::now_ns(),
            1,
        );
        
        book.add_order(order.clone());
        assert_eq!(book.best_ask(), Some(Decimal::from(51)));
    }

    #[test]
    fn test_orderbook_price_priority() {
        let book = Orderbook::new("test".to_string());
        
        // Add multiple bids at different prices
        let order1 = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Some(Decimal::from(50)),
            Decimal::from(10),
            TimestampGenerator::now_ns(),
            1,
        );
        
        let order2 = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user2".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Some(Decimal::from(51)), // Higher price
            Decimal::from(10),
            TimestampGenerator::now_ns(),
            2,
        );
        
        book.add_order(order1);
        book.add_order(order2);
        
        // Best bid should be the higher price
        assert_eq!(book.best_bid(), Some(Decimal::from(51)));
    }

    #[test]
    fn test_orderbook_remove_order() {
        let book = Orderbook::new("test".to_string());
        let order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Some(Decimal::from(50)),
            Decimal::from(10),
            TimestampGenerator::now_ns(),
            1,
        );
        
        book.add_order(order.clone());
        assert!(book.get_order(&order.id).is_some());
        
        book.remove_order(&order.id);
        assert!(book.get_order(&order.id).is_none());
        assert_eq!(book.best_bid(), None);
    }

    #[test]
    fn test_orderbook_snapshot() {
        let book = Orderbook::new("test".to_string());
        
        for i in 0..5 {
            let order = Order::new(
                Uuid::new_v4(),
                "test".to_string(),
                format!("user{}", i),
                OrderSide::Buy,
                OrderType::Limit,
                Some(Decimal::from(50 + i)),
                Decimal::from(10),
                TimestampGenerator::now_ns(),
                i as i64,
            );
            book.add_order(order);
        }
        
        let snapshot = book.snapshot(3);
        assert_eq!(snapshot.bids.len(), 3);
        assert_eq!(snapshot.market_id, "test");
    }
}
