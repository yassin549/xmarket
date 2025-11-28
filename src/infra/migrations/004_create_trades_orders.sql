-- Migration 004: Create Orders and Trades Tables
-- 
-- This migration creates the schema for storing orders and matched trades
-- from the orderbook service.

-- Orders table: stores all orders submitted to the orderbook
CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    variable_id UUID REFERENCES variables(variable_id),
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('limit', 'market')),
    price DECIMAL(20, 8),  -- NULL for market orders
    quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
    filled_quantity DECIMAL(20, 8) DEFAULT 0 CHECK (filled_quantity >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'partially_filled', 'cancelled', 'rejected')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Trades table: stores matched trades
CREATE TABLE IF NOT EXISTS trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_order_id UUID NOT NULL REFERENCES orders(order_id),
    seller_order_id UUID NOT NULL REFERENCES orders(order_id),
    variable_id UUID REFERENCES variables(variable_id),
    price DECIMAL(20, 8) NOT NULL CHECK (price > 0),
    quantity DECIMAL(20, 8) NOT NULL CHECK (quantity > 0),
    sequence_number BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_variable_id ON orders(variable_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_buyer_order ON trades(buyer_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_order ON trades(seller_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_variable_id ON trades(variable_id);
CREATE INDEX IF NOT EXISTS idx_trades_sequence ON trades(sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);

-- Comments
COMMENT ON TABLE orders IS 'All orders submitted to the orderbook';
COMMENT ON TABLE trades IS 'Matched trades from the orderbook';
COMMENT ON COLUMN orders.filled_quantity IS 'Amount of the order that has been filled';
COMMENT ON COLUMN trades.sequence_number IS 'Monotonic sequence number from orderbook for ordering trades';
