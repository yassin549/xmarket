use crate::orderbook::Orderbook;
use crate::types::{Event, Order, OrderSide, OrderType, SequenceGenerator, Trade, TimestampGenerator};
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

pub struct MatchingEngine {
    orderbook: Arc<Orderbook>,
    sequence_gen: Arc<SequenceGenerator>,
}

impl MatchingEngine {
    pub fn new(market_id: String, initial_sequence: i64) -> Self {
        Self {
            orderbook: Arc::new(Orderbook::new(market_id)),
            sequence_gen: Arc::new(SequenceGenerator::new(initial_sequence)),
        }
    }

    pub fn orderbook(&self) -> &Arc<Orderbook> {
        &self.orderbook
    }

    /// Match a new order against the orderbook
    /// Returns: (filled trades, remaining order if partially filled, events)
    pub fn match_order(
        &self,
        mut order: Order,
    ) -> (Vec<Trade>, Option<Order>, Vec<Event>) {
        let mut trades = Vec::new();
        let mut events = Vec::new();

        // Market and IOC orders need immediate execution
        match order.order_type {
            OrderType::Market | OrderType::IOC => {
                // Match against opposite side until filled or no more liquidity
                while !order.is_filled() {
                    if let Some(maker) = self.orderbook.get_next_maker(order.side) {
                        let trade = self.execute_trade(&mut order, maker);
                        if let Some(t) = trade {
                            trades.push(t.clone());
                            let seq = self.sequence_gen.next();
                            events.push(Event::TradeExecuted {
                                trade: t,
                                sequence_number: seq,
                                timestamp_ns: TimestampGenerator::now_ns(),
                            });
                        } else {
                            break; // No more matches possible
                        }
                    } else {
                        break; // No more liquidity
                    }
                }

                // For IOC orders, cancel remaining quantity if not fully filled
                if order.order_type == OrderType::IOC && !order.is_filled() {
                    order.status = crate::types::OrderStatus::Cancelled;
                    let seq = self.sequence_gen.next();
                    events.push(Event::OrderCancelled {
                        order_id: order.id,
                        market_id: order.market_id.clone(),
                        side: order.side,
                        price: order.price,
                        cancelled_quantity: order.remaining_quantity,
                        sequence_number: seq,
                        timestamp_ns: TimestampGenerator::now_ns(),
                    });
                }
            }
            OrderType::Limit => {
                // Try to match immediately
                while !order.is_filled() {
                    if let Some(maker) = self.orderbook.get_next_maker(order.side) {
                        // Check if limit price allows matching
                        let can_match = match order.side {
                            OrderSide::Buy => {
                                // Buying: can match if limit price >= ask price
                                order.price.unwrap() >= maker.price.unwrap()
                            }
                            OrderSide::Sell => {
                                // Selling: can match if limit price <= bid price
                                order.price.unwrap() <= maker.price.unwrap()
                            }
                        };

                        if can_match {
                            let trade = self.execute_trade(&mut order, maker);
                            if let Some(t) = trade {
                                trades.push(t.clone());
                                let seq = self.sequence_gen.next();
                                events.push(Event::TradeExecuted {
                                    trade: t,
                                    sequence_number: seq,
                                    timestamp_ns: TimestampGenerator::now_ns(),
                                });
                            } else {
                                break;
                            }
                        } else {
                            // Can't match at limit price, add to orderbook
                            break;
                        }
                    } else {
                        // No more liquidity, add to orderbook
                        break;
                    }
                }

                // If still has remaining quantity, add to orderbook
                if !order.is_filled() {
                    self.orderbook.add_order(order.clone());
                    let seq = self.sequence_gen.next();
                    events.push(Event::OrderPlaced {
                        order: order.clone(),
                        sequence_number: seq,
                        timestamp_ns: TimestampGenerator::now_ns(),
                    });
                }
            }
        }

        let remaining_order = if order.is_filled() {
            None
        } else {
            Some(order)
        };

        (trades, remaining_order, events)
    }

    /// Execute a trade between taker and maker orders
    fn execute_trade(&self, taker: &mut Order, maker: Order) -> Option<Trade> {
        let trade_price = maker.price?; // Maker's limit price
        let trade_quantity = taker.remaining_quantity.min(maker.remaining_quantity);

        // Fill both orders
        taker.fill(trade_quantity, trade_price);
        
        // Update maker order
        let mut updated_maker = maker.clone();
        updated_maker.fill(trade_quantity, trade_price);
        
        // Update maker in orderbook
        if updated_maker.is_filled() {
            self.orderbook.remove_order(&updated_maker.id);
        } else {
            self.orderbook.update_order(&updated_maker);
        }

        // Create trade
        let trade = Trade {
            id: Uuid::new_v4(),
            market_id: taker.market_id.clone(),
            taker_order_id: taker.id,
            maker_order_id: maker.id,
            side: taker.side,
            price: trade_price,
            quantity: trade_quantity,
            timestamp_ns: TimestampGenerator::now_ns(),
            sequence_number: self.sequence_gen.next(),
        };

        Some(trade)
    }

    /// Cancel an order
    pub fn cancel_order(&self, order_id: Uuid, market_id: &str) -> Option<Event> {
        if let Some(order) = self.orderbook.remove_order(&order_id) {
            if order.market_id == market_id {
                let seq = self.sequence_gen.next();
                return Some(Event::OrderCancelled {
                    order_id: order.id,
                    market_id: order.market_id,
                    side: order.side,
                    price: order.price,
                    cancelled_quantity: order.remaining_quantity,
                    sequence_number: seq,
                    timestamp_ns: TimestampGenerator::now_ns(),
                });
            }
        }
        None
    }

    pub fn current_sequence(&self) -> i64 {
        self.sequence_gen.current()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_limit_order_immediate_match() {
        let engine = MatchingEngine::new("test".to_string(), 0);
        
        // Add a sell order to the book
        let sell_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Some(Decimal::from(50)),
            Decimal::from(10),
            TimestampGenerator::now_ns(),
            1,
        );
        engine.orderbook().add_order(sell_order);

        // Place a buy order that should match
        let buy_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user2".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Some(Decimal::from(51)), // Higher price, should match
            Decimal::from(5),
            TimestampGenerator::now_ns(),
            2,
        );

        let (trades, remaining, _) = engine.match_order(buy_order);
        
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, Decimal::from(5));
        assert_eq!(trades[0].price, Decimal::from(50)); // Maker's price
        assert!(remaining.is_none()); // Fully filled
    }

    #[test]
    fn test_limit_order_partial_fill() {
        let engine = MatchingEngine::new("test".to_string(), 0);
        
        // Add a sell order
        let sell_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Some(Decimal::from(50)),
            Decimal::from(5), // Only 5 available
            TimestampGenerator::now_ns(),
            1,
        );
        engine.orderbook().add_order(sell_order);

        // Place a buy order for more than available
        let buy_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user2".to_string(),
            OrderSide::Buy,
            OrderType::Limit,
            Some(Decimal::from(51)),
            Decimal::from(10), // Want 10, only 5 available
            TimestampGenerator::now_ns(),
            2,
        );

        let (trades, remaining, _) = engine.match_order(buy_order.clone());
        
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, Decimal::from(5));
        
        // Should have remaining order
        assert!(remaining.is_some());
        let rem = remaining.unwrap();
        assert_eq!(rem.remaining_quantity, Decimal::from(5));
    }

    #[test]
    fn test_market_order_full_fill() {
        let engine = MatchingEngine::new("test".to_string(), 0);
        
        // Add a sell order
        let sell_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Some(Decimal::from(50)),
            Decimal::from(10),
            TimestampGenerator::now_ns(),
            1,
        );
        engine.orderbook().add_order(sell_order);

        // Place a market buy order
        let buy_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user2".to_string(),
            OrderSide::Buy,
            OrderType::Market,
            None, // No price for market orders
            Decimal::from(5),
            TimestampGenerator::now_ns(),
            2,
        );

        let (trades, remaining, _) = engine.match_order(buy_order);
        
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, Decimal::from(5));
        assert!(remaining.is_none()); // Fully filled
    }

    #[test]
    fn test_ioc_order_cancels_remaining() {
        let engine = MatchingEngine::new("test".to_string(), 0);
        
        // Add a sell order with limited quantity
        let sell_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user1".to_string(),
            OrderSide::Sell,
            OrderType::Limit,
            Some(Decimal::from(50)),
            Decimal::from(5), // Only 5 available
            TimestampGenerator::now_ns(),
            1,
        );
        engine.orderbook().add_order(sell_order);

        // Place an IOC buy order for more than available
        let buy_order = Order::new(
            Uuid::new_v4(),
            "test".to_string(),
            "user2".to_string(),
            OrderSide::Buy,
            OrderType::IOC,
            None,
            Decimal::from(10), // Want 10, only 5 available
            TimestampGenerator::now_ns(),
            2,
        );

        let (trades, remaining, events) = engine.match_order(buy_order);
        
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].quantity, Decimal::from(5));
        
        // IOC should cancel remaining
        assert!(remaining.is_none());
        
        // Should have cancellation event
        let has_cancel = events.iter().any(|e| matches!(e, Event::OrderCancelled { .. }));
        assert!(has_cancel);
    }

    #[test]
    fn test_cancel_order() {
        let engine = MatchingEngine::new("test".to_string(), 0);
        
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
        
        engine.orderbook().add_order(order.clone());
        assert!(engine.orderbook().get_order(&order.id).is_some());
        
        let event = engine.cancel_order(order.id, "test");
        assert!(event.is_some());
        assert!(engine.orderbook().get_order(&order.id).is_none());
    }
}
