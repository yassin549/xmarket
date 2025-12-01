-- Migration: Add Impact Scoring and Auto-Approval Columns
-- Date: 2025-12-01

-- Add new columns to candidate_events
ALTER TABLE candidate_events 
ADD COLUMN IF NOT EXISTS impact_score INTEGER,
ADD COLUMN IF NOT EXISTS llm_reasoning TEXT,
ADD COLUMN IF NOT EXISTS variable_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS variable_description TEXT,
ADD COLUMN IF NOT EXISTS market_id UUID REFERENCES markets(market_id);

-- Create index for approved events (for Finalizer polling)
CREATE INDEX IF NOT EXISTS idx_candidate_approved 
ON candidate_events(status, created_at) 
WHERE status = 'approved';

-- Create index for failed events (for monitoring)
CREATE INDEX IF NOT EXISTS idx_candidate_failed 
ON candidate_events(status) 
WHERE status = 'failed';

-- Add metadata column to markets if it doesn't exist
ALTER TABLE markets 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add metadata column to orders if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN candidate_events.impact_score IS 'LLM-calculated impact score (0-100)';
COMMENT ON COLUMN candidate_events.llm_reasoning IS 'LLM reasoning for the impact score';
COMMENT ON COLUMN candidate_events.variable_name IS 'Real-world variable name (e.g., "AI Risk")';
COMMENT ON COLUMN candidate_events.variable_description IS 'Description of the variable';
COMMENT ON COLUMN candidate_events.market_id IS 'Link to created market (if processed)';
