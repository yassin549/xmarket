-- Migration 000: Create Helper Functions
-- Purpose: Common utility functions for database triggers
-- Date: 2025-11-28

-- ============================================================================
-- FUNCTION: update_updated_at_column
-- ============================================================================
-- Automatically updates the 'updated_at' timestamp when a row is modified
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS 'Trigger function to auto-update updated_at timestamp';
