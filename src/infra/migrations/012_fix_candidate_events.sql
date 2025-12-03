-- Migration 012: Fix Candidate Events Schema
-- Author: Development Team
-- Date: December 2025

-- Add missing columns to candidate_events if they don't exist
ALTER TABLE candidate_events
  ADD COLUMN IF NOT EXISTS impact_score INTEGER,
  ADD COLUMN IF NOT EXISTS llm_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS variable_name TEXT,
  ADD COLUMN IF NOT EXISTS variable_description TEXT,
  ADD COLUMN IF NOT EXISTS market_id UUID;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidate_events_status ON candidate_events(status);
CREATE INDEX IF NOT EXISTS idx_candidate_events_variable ON candidate_events(variable_name);
