-- Migration 011: Remove Manual URL System, Add Volume Tracking
-- Author: Development Team
-- Date: December 2025

-- Part 1: Remove deprecated URL-based fields
ALTER TABLE variables 
  DROP COLUMN IF EXISTS reality_sources,
  DROP COLUMN IF EXISTS impact_keywords;

-- llm_context remains for human guidance
COMMENT ON COLUMN variables.llm_context IS 
  'Optional context to guide LLM search query generation. Example: "Focus on technical innovations, business decisions, public statements"';

-- Part 2: Update historical_values for reality-only + volume tracking
ALTER TABLE historical_values
  DROP COLUMN IF EXISTS market_value,
  DROP COLUMN IF EXISTS trading_value,
  ADD COLUMN IF NOT EXISTS buy_volume_24h NUMERIC(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_volume_24h NUMERIC(20,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_buyers_24h INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_sellers_24h INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buy_orders_24h INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_orders_24h INTEGER DEFAULT 0;

-- Indexes for volume queries
CREATE INDEX IF NOT EXISTS idx_hist_vals_var_time 
  ON historical_values(variable_id, timestamp DESC);

-- Part 3: Update sample data with llm_context guidance
UPDATE variables 
SET llm_context = 'Analyze for evidence of intelligent or unintelligent decisions. Focus on: technical innovations, strategic business wins, successful product launches vs public mistakes, poor judgment, controversies, failed projects.'
WHERE symbol = 'ELON-IQ'
  AND llm_context IS NULL;

UPDATE variables
SET llm_context = 'Analyze for signals that AI is becoming more or less risky. Focus on: AI safety incidents, misalignment examples, concerning capabilities vs safety breakthroughs, successful alignment research, positive regulation.'
WHERE symbol = 'AI-RISK'
  AND llm_context IS NULL;
