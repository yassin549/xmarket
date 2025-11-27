-- Migration 006: Create Markets Table
-- 
-- This migration creates the markets table for storing tradable markets
-- with type categorization and human approval tracking.

CREATE TABLE IF NOT EXISTS markets (
    market_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(50) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('political', 'economic', 'social', 'tech', 'finance', 'culture', 'sports')),
    region VARCHAR(50),
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
    human_approval BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,
    approved_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_markets_type ON markets(type);
CREATE INDEX idx_markets_symbol ON markets(symbol);
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_human_approval ON markets(human_approval);

-- Comments
COMMENT ON TABLE markets IS 'Tradable markets with type categorization';
COMMENT ON COLUMN markets.type IS 'Market category: political, economic, social, tech, finance, culture, sports';
COMMENT ON COLUMN markets.human_approval IS 'Whether this market has been reviewed and approved by a human admin';
COMMENT ON COLUMN markets.risk_level IS 'Risk assessment: low, medium, high';
