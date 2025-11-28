-- Migration: 002_create_core_schema.sql
-- Purpose: Core domain tables for Everything Market platform
-- Phase: Phase 1 (Core infra & config)
-- Checklist: Phase 1, Item 5

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- User accounts and authentication
-- Roles: viewer, editor, admin, super-admin
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  
  -- RBAC: viewer, editor, admin, super-admin
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  
  -- Profile
  display_name VARCHAR(255),
  
  -- Account status
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  CONSTRAINT chk_users_role CHECK (
    role IN ('viewer', 'editor', 'admin', 'super-admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

COMMENT ON TABLE users IS 'User accounts and authentication';
COMMENT ON COLUMN users.role IS 'RBAC role: viewer, editor, admin, super-admin';

-- ============================================================================
-- AUDIT_EVENT TABLE (Must be created before markets table)
-- ============================================================================
-- Append-only audit log for all state-changing actions
-- Records both human and agent actions with signatures
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_event (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Action details
  action VARCHAR(100) NOT NULL,
  
  -- Actor identification
  actor_id UUID,  -- Can be user_id or agent identifier
  actor_type VARCHAR(20) NOT NULL,
  
  -- Provenance
  payload_hash VARCHAR(64),  -- SHA256 of action payload
  signature TEXT,  -- HMAC signature for agent actions
  job_id UUID,  -- Foreign key to jobs table (if triggered by job)
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamp (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_audit_actor_type CHECK (
    actor_type IN ('human', 'agent', 'system')
  )
);

-- Prevent UPDATE and DELETE on audit_event (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_event table is append-only - UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_event;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE ON audit_event
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modifications();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_event;
CREATE TRIGGER trg_prevent_audit_delete
  BEFORE DELETE ON audit_event
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modifications();

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_event(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_event(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_event(action);

COMMENT ON TABLE audit_event IS 'Append-only audit log for all state changes';
COMMENT ON COLUMN audit_event.actor_type IS 'Actor type: human, agent, or system';
COMMENT ON COLUMN audit_event.signature IS 'HMAC signature for agent actions';

-- ============================================================================
-- MARKETS TABLE
-- ============================================================================
-- Trading markets/instruments organized by type
-- Types: political, economic, social, technology, finance, culture, sports
-- Human approval required via audit_event
-- ============================================================================

CREATE TABLE IF NOT EXISTS markets (
  market_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(50) NOT NULL UNIQUE,
  
  -- Classification
  type VARCHAR(50) NOT NULL,
  subtype VARCHAR(100),
  region VARCHAR(100),
  
  -- Risk classification
  risk_level VARCHAR(20),
  
  -- Human approval requirement
  created_by UUID NOT NULL REFERENCES users(user_id),
  human_approval_audit_id UUID NOT NULL REFERENCES audit_event(audit_id),
  
  -- Market details
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_markets_type CHECK (
    type IN ('political', 'economic', 'social', 'technology', 'finance', 'culture', 'sports')
  ),
  CONSTRAINT chk_markets_risk_level CHECK (
    risk_level IN ('low', 'medium', 'high') OR risk_level IS NULL
  ),
  CONSTRAINT chk_markets_status CHECK (
    status IN ('active', 'paused', 'closed', 'pending_approval')
  )
);

CREATE INDEX IF NOT EXISTS idx_markets_type ON markets(type);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_created_by ON markets(created_by);
CREATE INDEX IF NOT EXISTS idx_markets_symbol ON markets(symbol);

COMMENT ON TABLE markets IS 'Trading markets organized by category';
COMMENT ON COLUMN markets.type IS 'Market category: political, economic, social, technology, finance, culture, sports';
COMMENT ON COLUMN markets.human_approval_audit_id IS 'Required audit_event proving human approval for market creation';

-- ============================================================================
-- SNAPSHOTS TABLE
-- ============================================================================
-- Metadata for external content snapshots (actual HTML in object storage)
-- snapshot_id = sha256(url + "|" + fetched_iso_ts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id VARCHAR(64) PRIMARY KEY,  -- SHA256 hash
  url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  
  -- Object storage reference
  object_store_path TEXT NOT NULL,
  
  -- Content metadata
  content_type VARCHAR(100),
  size_bytes BIGINT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_url ON snapshots(url);
CREATE INDEX IF NOT EXISTS idx_snapshots_fetched_at ON snapshots(fetched_at);

COMMENT ON TABLE snapshots IS 'Metadata for content-addressed external snapshots';
COMMENT ON COLUMN snapshots.snapshot_id IS 'SHA256(url + "|" + fetched_iso_ts)';
COMMENT ON COLUMN snapshots.object_store_path IS 'Path in S3-compatible object storage';

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================
-- Final published events affecting markets
-- Requires snapshot_ids for LLM provenance
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(market_id),
  
  -- Event content
  summary TEXT NOT NULL,
  event_type VARCHAR(50),
  confidence NUMERIC(3, 2),  -- 0.00 to 1.00
  
  -- Provenance: must reference snapshots
  snapshot_ids TEXT[] NOT NULL DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_events_confidence CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  CONSTRAINT chk_events_snapshots CHECK (
    array_length(snapshot_ids, 1) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_events_market_id ON events(market_id);
CREATE INDEX IF NOT EXISTS idx_events_published_at ON events(published_at);

COMMENT ON TABLE events IS 'Final published events affecting markets';
COMMENT ON COLUMN events.snapshot_ids IS 'Array of snapshot_id references for provenance';
COMMENT ON COLUMN events.confidence IS 'LLM confidence score 0.00-1.00';

-- ============================================================================
-- CHANNEL_COUNTERS TABLE
-- ============================================================================
-- Realtime sequence number tracking per channel
-- Ensures monotonic sequence numbers for client reconciliation
-- ============================================================================

CREATE TABLE IF NOT EXISTS channel_counters (
  channel VARCHAR(255) PRIMARY KEY,
  last_sequence_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_counters_updated_at ON channel_counters(updated_at);

COMMENT ON TABLE channel_counters IS 'Realtime sequence tracking per channel';
COMMENT ON COLUMN channel_counters.last_sequence_number IS 'Monotonically increasing sequence per channel';

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_markets_updated_at ON markets;
CREATE TRIGGER trg_markets_updated_at
  BEFORE UPDATE ON markets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_channel_counters_updated_at ON channel_counters;
CREATE TRIGGER trg_channel_counters_updated_at
  BEFORE UPDATE ON channel_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- To rollback this migration:
--   DROP TRIGGER IF EXISTS trg_channel_counters_updated_at ON channel_counters;
--   DROP TRIGGER IF EXISTS trg_markets_updated_at ON markets;
--   DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
--   DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_event;
--   DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_event;
--   DROP FUNCTION IF EXISTS prevent_audit_modifications();
--   DROP TABLE IF EXISTS channel_counters CASCADE;
--   DROP TABLE IF EXISTS events CASCADE;
--   DROP TABLE IF EXISTS snapshots CASCADE;
--   DROP TABLE IF EXISTS markets CASCADE;
--   DROP TABLE IF EXISTS audit_event CASCADE;
--   DROP TABLE IF EXISTS users CASCADE;
