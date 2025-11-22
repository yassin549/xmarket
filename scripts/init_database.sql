-- Everything Market - Database Initialization SQL
-- Run this in Railway PostgreSQL Query tab if you don't have Railway CLI

-- Create stocks table
CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    market_weight FLOAT DEFAULT 0.6,
    reality_weight FLOAT DEFAULT 0.4,
    initial_score FLOAT DEFAULT 50.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create scores table
CREATE TABLE IF NOT EXISTS scores (
    symbol VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol),
    reality_score FLOAT DEFAULT 50.0,
    final_price FLOAT DEFAULT 50.0,
    confidence FLOAT DEFAULT 0.5,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(100) PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol),
    impact_points FLOAT NOT NULL,
    quick_score FLOAT NOT NULL,
    summary TEXT NOT NULL,
    sources JSONB NOT NULL,
    num_independent_sources INTEGER NOT NULL,
    llm_mode VARCHAR(20),
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create llm_audit table
CREATE TABLE IF NOT EXISTS llm_audit (
    event_id VARCHAR(100) PRIMARY KEY REFERENCES events(id),
    flagged_reason TEXT NOT NULL,
    approved BOOLEAN,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create score_changes table
CREATE TABLE IF NOT EXISTS score_changes (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol),
    event_id VARCHAR(100) REFERENCES events(id),
    old_reality_score FLOAT NOT NULL,
    new_reality_score FLOAT NOT NULL,
    old_final_price FLOAT NOT NULL,
    new_final_price FLOAT NOT NULL,
    delta FLOAT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create llm_calls table
CREATE TABLE IF NOT EXISTS llm_calls (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(100) REFERENCES events(id),
    mode VARCHAR(20) NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol),
    side VARCHAR(10) NOT NULL,
    order_type VARCHAR(10) NOT NULL,
    quantity FLOAT NOT NULL,
    price FLOAT,
    status VARCHAR(20) NOT NULL,
    filled FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
    trade_id VARCHAR(100) PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol),
    buy_order_id VARCHAR(100) NOT NULL,
    sell_order_id VARCHAR(100) NOT NULL,
    quantity FLOAT NOT NULL,
    price FLOAT NOT NULL,
    buyer_id VARCHAR(100) NOT NULL,
    seller_id VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_symbol ON events(symbol);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_score_changes_symbol ON score_changes(symbol);
CREATE INDEX IF NOT EXISTS idx_score_changes_timestamp ON score_changes(timestamp);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

-- Insert initial stocks
INSERT INTO stocks (symbol, name, description, market_weight, reality_weight, initial_score) VALUES
('ELON', 'Elon Musk Sentiment Index', 'Tracks sentiment and news impact around Elon Musk and his companies (Tesla, SpaceX, X)', 0.6, 0.4, 50.0),
('AI_INDEX', 'AI Industry Index', 'Composite index tracking AI industry sentiment and developments', 0.6, 0.4, 50.0),
('TECH', 'Technology Sector Index', 'Broad technology sector sentiment tracker', 0.6, 0.4, 50.0)
ON CONFLICT (symbol) DO NOTHING;

-- Insert initial scores
INSERT INTO scores (symbol, reality_score, final_price, confidence) VALUES
('ELON', 50.0, 50.0, 0.5),
('AI_INDEX', 50.0, 50.0, 0.5),
('TECH', 50.0, 50.0, 0.5)
ON CONFLICT (symbol) DO NOTHING;

-- Verify data
SELECT 'Stocks created:' as info, COUNT(*) as count FROM stocks
UNION ALL
SELECT 'Scores created:', COUNT(*) FROM scores;
