-- Migration 005: Create Channel Counters
-- 
-- This migration creates the channel_counters table for tracking
-- sequence numbers per realtime channel to enable gap detection.

-- Channel Counters table
CREATE TABLE IF NOT EXISTS channel_counters (
    channel VARCHAR(100) PRIMARY KEY,
    last_sequence_number BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for monitoring
CREATE INDEX IF NOT EXISTS idx_channel_counters_updated ON channel_counters(updated_at DESC);

-- Comments
COMMENT ON TABLE channel_counters IS 'Tracks sequence numbers for realtime channels to enable gap detection';
COMMENT ON COLUMN channel_counters.channel IS 'Channel identifier (e.g., market:BTC-USD, events)';
COMMENT ON COLUMN channel_counters.last_sequence_number IS 'Monotonically increasing sequence number';
