-- Migration 008: Create Historical Values Table
-- Purpose: Store historical snapshots of the three charts for charting
-- Date: 2025-11-27

-- ============================================================================
-- HISTORICAL_VALUES TABLE
-- ============================================================================
-- Time-series data for the three-chart system
-- Each row is a snapshot at a specific timestamp showing:
--   - Reality chart value (from reality engine)
--   - Market chart value (from orderbook)
--   - Trading chart value (blended mean)
-- ============================================================================

CREATE TABLE IF NOT EXISTS historical_values (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID NOT NULL REFERENCES variables(variable_id) ON DELETE CASCADE,
  
  -- The Three Chart Values
  reality_value DECIMAL(20, 8),                -- Reality engine value at this time
  market_value DECIMAL(20, 8),                 -- Orderbook market value at this time
  trading_value DECIMAL(20, 8) NOT NULL,       -- Blended trading value (always present)
  
  -- Volume & Activity
  volume_24h DECIMAL(20, 8) DEFAULT 0,         -- 24h trading volume
  trades_count_24h INT DEFAULT 0,              -- Number of trades in 24h
  
  -- Price Changes
  change_1h DECIMAL(10, 4),                    -- % change in last hour
  change_24h DECIMAL(10, 4),                   -- % change in last 24h
  change_7d DECIMAL(10, 4),                    -- % change in last 7 days
  
  -- Timestamp (for charting)
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Snapshot metadata
  snapshot_type VARCHAR(20) DEFAULT 'scheduled', -- scheduled, manual, event-triggered
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary index for chart queries
CREATE INDEX IF NOT EXISTS idx_historical_variable_time ON historical_values(variable_id, timestamp DESC);

-- For time-range queries
CREATE INDEX IF NOT EXISTS idx_historical_timestamp ON historical_values(timestamp DESC);

-- For snapshot type filtering
CREATE INDEX IF NOT EXISTS idx_historical_type ON historical_values(snapshot_type, timestamp DESC);

-- ============================================================================
-- PARTITIONING (Optional - for large scale)
-- ============================================================================
-- Consider partitioning by timestamp (monthly) when dataset grows
-- This is commented out for now, enable when needed:

-- CREATE TABLE historical_values_2025_11 PARTITION OF historical_values
--   FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE historical_values IS 'Time-series snapshots of the three-chart system';
COMMENT ON COLUMN historical_values.reality_value IS 'Reality chart value from AI analysis';
COMMENT ON COLUMN historical_values.market_value IS 'Market chart value from orderbook';
COMMENT ON COLUMN historical_values.trading_value IS 'Trading chart value (blended mean)';
COMMENT ON COLUMN historical_values.snapshot_type IS 'How this snapshot was created: scheduled cron, manual trigger, or event-based';

-- ============================================================================
-- FUNCTION: Get Latest Value
-- ============================================================================

CREATE OR REPLACE FUNCTION get_latest_value(var_id UUID)
RETURNS TABLE (
  reality DECIMAL(20, 8),
  market DECIMAL(20, 8),
  trading DECIMAL(20, 8),
  ts TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    reality_value,
    market_value,
    trading_value,
    historical_values.timestamp
  FROM historical_values
  WHERE variable_id = var_id
  ORDER BY historical_values.timestamp DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_latest_value IS 'Get the most recent three-chart values for a variable';
