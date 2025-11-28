-- Migration 002: Create Reality Data Table
-- Purpose: Store scraped data and LLM analysis results for reality engine
-- Date: 2025-11-27

-- ============================================================================
-- REALITY_DATA TABLE
-- ============================================================================
-- Stores raw scraped content and LLM impact analysis
-- Each row represents one scraping event from one source for one variable
-- ============================================================================

CREATE TABLE IF NOT EXISTS reality_data (
  data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID NOT NULL REFERENCES variables(variable_id) ON DELETE CASCADE,
  
  -- Source Information
  source_url TEXT NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Raw Scraped Data
  raw_content TEXT,                            -- Scraped webpage content
  content_hash VARCHAR(64),                    -- SHA256 of raw_content (deduplication)
  content_length INT,
  
  -- LLM Analysis Results
  llm_summary TEXT,                            -- LLM's interpretation of content
  impact_score DECIMAL(5, 2),                  -- -100.00 to +100.00 (impact on variable)
  confidence DECIMAL(3, 2),                    -- 0.00 to 1.00 (LLM confidence)
  llm_model VARCHAR(100),                      -- e.g., "mistralai/Mixtral-8x7B-Instruct-v0.1"
  
  -- Processing Status
  processing_status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Metadata
  processing_time_ms INT,                      -- Time taken for LLM analysis
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT chk_reality_impact_score CHECK (
    impact_score IS NULL OR (impact_score >= -100 AND impact_score <= 100)
  ),
  CONSTRAINT chk_reality_confidence CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  CONSTRAINT chk_reality_status CHECK (
    processing_status IN ('pending', 'processing', 'completed', 'failed')
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reality_variable ON reality_data(variable_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_reality_status ON reality_data(processing_status, scraped_at);
CREATE INDEX IF NOT EXISTS idx_reality_scraped ON reality_data(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_reality_hash ON reality_data(content_hash);  -- For deduplication

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reality_data IS 'Scraped data and LLM analysis for reality engine';
COMMENT ON COLUMN reality_data.impact_score IS 'LLM-assessed impact on variable: -100 (very negative) to +100 (very positive)';
COMMENT ON COLUMN reality_data.confidence IS 'LLM confidence in analysis: 0.00 (no confidence) to 1.00 (certain)';
COMMENT ON COLUMN reality_data.content_hash IS 'SHA256 hash for detecting duplicate scrapes';
