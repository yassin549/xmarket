-- Migration: 001_create_jobs.sql
-- Purpose: Create jobs table for idempotent job tracking across all async operations
-- Phase: Phase 3 (Idempotency & job system)
-- Checklist: Phase 1, Item 4

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
-- Provides idempotent job processing with exactly-once semantics.
-- Jobs are uniquely identified by (job_type, idempotency_key) composite.
-- Supports retry logic with exponential backoff via next_attempt_at.
--
-- Usage:
--   - Ingest workers: job_type='ingest_fetch'
--   - Scraping: job_type='playwright_fetch'
--   - LLM calls: job_type='llm_summarize'
--   - Reality worker: job_type='reality_process'
--
-- Status flow: pending -> processing -> completed
--                    \-> failed -> retry -> processing -> ...
--                                      \-> dlq (after max_attempts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jobs (
  -- Identity
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Idempotency key (unique per job_type)
  idempotency_key VARCHAR(255) NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  
  -- Payload and configuration
  payload JSONB NOT NULL DEFAULT '{}',
  max_attempts INT NOT NULL DEFAULT 5,
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  
  -- Results and errors
  result JSONB,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Idempotency constraint: one job per (type, key) combination
  CONSTRAINT uq_jobs_type_key UNIQUE (job_type, idempotency_key),
  
  -- Status validation
  CONSTRAINT chk_jobs_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'retry', 'dlq')
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Worker polling: find next jobs to process
-- Partial index for efficiency (only active jobs)
CREATE INDEX idx_jobs_worker_poll 
  ON jobs(status, next_attempt_at, created_at) 
  WHERE status IN ('pending', 'retry');

-- Job lookup by idempotency key (for API responses)
CREATE INDEX idx_jobs_idempotency 
  ON jobs(job_type, idempotency_key);

-- Time-based queries and cleanup
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_jobs_completed_at ON jobs(completed_at) 
  WHERE completed_at IS NOT NULL;

-- DLQ monitoring
CREATE INDEX idx_jobs_dlq 
  ON jobs(created_at) 
  WHERE status = 'dlq';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE jobs IS 'Idempotent job queue for async operations';
COMMENT ON COLUMN jobs.idempotency_key IS 'Client-provided key for idempotency (typically URL, request hash, etc.)';
COMMENT ON COLUMN jobs.job_type IS 'Type of job: ingest_fetch, playwright_fetch, llm_summarize, reality_process, etc.';
COMMENT ON COLUMN jobs.payload IS 'Job parameters as JSON';
COMMENT ON COLUMN jobs.next_attempt_at IS 'Timestamp for next retry attempt (NULL if not scheduled)';
COMMENT ON COLUMN jobs.status IS 'Job status: pending, processing, completed, failed, retry, dlq';

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- To rollback this migration:
--   DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
--   DROP FUNCTION IF EXISTS update_updated_at_column();
--   DROP TABLE IF EXISTS jobs CASCADE;
