use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderType {
    Limit,
    Market,
    IOC, // Immediate or Cancel
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    PartiallyFilled,
    Filled,
    Cancelled,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub market_id: String,
    pub user_id: String,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub price: Option<Decimal>, // None for market orders
    pub quantity: Decimal,
    pub remaining_quantity: Decimal,
    pub filled_quantity: Decimal,
    pub status: OrderStatus,
    pub timestamp_ns: i64,
    pub sequence_number: i64,
}

impl Order {
    pub fn new(
        id: Uuid,
        market_id: String,
        user_id: String,
        side: OrderSide,
        order_type: OrderType,
        price: Option<Decimal>,
        quantity: Decimal,
        timestamp_ns: i64,
        sequence_number: i64,
    ) -> Self {
        Self {
            id,
            market_id,
            user_id,
            side,
            order_type,
            price,
            quantity,
            remaining_quantity: quantity,
            filled_quantity: Decimal::ZERO,
            status: OrderStatus::Pending,
            timestamp_ns,
            sequence_number,
        }
    }

    pub fn is_filled(&self) -> bool {
        self.remaining_quantity.is_zero()
    }

    pub fn fill(&mut self, quantity: Decimal, price: Decimal) {
        let fill_amount = quantity.min(self.remaining_quantity);
        self.remaining_quantity -= fill_amount;
        self.filled_quantity += fill_amount;
        
        if self.remaining_quantity.is_zero() {
            self.status = OrderStatus::Filled;
        } else {
            self.status = OrderStatus::PartiallyFilled;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub market_id: String,
    pub taker_order_id: Uuid,
    pub maker_order_id: Uuid,
    pub side: OrderSide,
    pub price: Decimal,
    pub quantity: Decimal,
    pub timestamp_ns: i64,
    pub sequence_number: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Event {
    OrderPlaced {
        order: Order,
        sequence_number: i64,
        timestamp_ns: i64,
    },
    OrderCancelled {
        order_id: Uuid,
        market_id: String,
        side: OrderSide,
        price: Option<Decimal>,
        cancelled_quantity: Decimal,
        sequence_number: i64,
        timestamp_ns: i64,
    },
    TradeExecuted {
        trade: Trade,
        sequence_number: i64,
        timestamp_ns: i64,
    },
}

impl Event {
    pub fn sequence_number(&self) -> i64 {
        match self {
            Event::OrderPlaced { sequence_number, .. } => *sequence_number,
            Event::OrderCancelled { sequence_number, .. } => *sequence_number,
            Event::TradeExecuted { sequence_number, .. } => *sequence_number,
        }
    }

    pub fn timestamp_ns(&self) -> i64 {
        match self {
            Event::OrderPlaced { timestamp_ns, .. } => *timestamp_ns,
            Event::OrderCancelled { timestamp_ns, .. } => *timestamp_ns,
            Event::TradeExecuted { timestamp_ns, .. } => *timestamp_ns,
        }
    }
}

// Global sequence number generator
pub struct SequenceGenerator {
    counter: AtomicI64,
}

impl SequenceGenerator {
    pub fn new(initial: i64) -> Self {
        Self {
            counter: AtomicI64::new(initial),
        }
    }

    pub fn next(&self) -> i64 {
        self.counter.fetch_add(1, Ordering::SeqCst)
    }

    pub fn current(&self) -> i64 {
        self.counter.load(Ordering::SeqCst)
    }
}

// Timestamp generator
pub struct TimestampGenerator;

impl TimestampGenerator {
    pub fn now_ns() -> i64 {
        Utc::now().timestamp_nanos_opt().unwrap_or(0)
    }
}

