-- Migration: 003_create_candidate_events.sql
-- Purpose: Store AI-extracted events for human review before finalization
-- Phase: Phase 6 (Reality Engine Logic)

-- ============================================================================
-- CANDIDATE_EVENTS TABLE
-- ============================================================================
-- Intermediate state for events extracted by LLM
-- Requires admin approval for high-risk categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS candidate_events (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source linkage
  snapshot_id VARCHAR(64) NOT NULL REFERENCES snapshots(snapshot_id),
  
  -- Extracted Content
  summary TEXT NOT NULL,
  confidence NUMERIC(3, 2), -- 0.00 to 1.00
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- extracted entities, keywords, etc.
  
  -- Status Workflow
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  
  -- Deduplication
  dedupe_hash VARCHAR(64), -- SHA256 of (summary + snapshot_id) to prevent dupes
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_candidate_status CHECK (
    status IN ('pending', 'approved', 'rejected', 'processed')
  ),
  CONSTRAINT chk_candidate_confidence CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  )
);

CREATE INDEX idx_candidate_status ON candidate_events(status);
CREATE INDEX idx_candidate_snapshot ON candidate_events(snapshot_id);
CREATE INDEX idx_candidate_dedupe ON candidate_events(dedupe_hash);

COMMENT ON TABLE candidate_events IS 'Intermediate storage for AI-extracted events requiring review';
COMMENT ON COLUMN candidate_events.dedupe_hash IS 'Hash to prevent duplicate processing of same extraction';

-- Trigger for updated_at
CREATE TRIGGER trg_candidate_events_updated_at
  BEFORE UPDATE ON candidate_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Rollback
-- DROP TRIGGER IF EXISTS trg_candidate_events_updated_at ON candidate_events;
-- DROP TABLE IF EXISTS candidate_events CASCADE;
