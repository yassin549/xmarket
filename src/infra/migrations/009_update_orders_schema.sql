-- Migration 009: Update Orders Schema
-- Purpose: Update orders table to reference variables instead of markets/symbols
-- Date: 2025-11-28

-- ============================================================================
-- ORDERS TABLE UPDATE
-- ============================================================================

-- 1. Add variable_id column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS variable_id UUID REFERENCES variables(variable_id);

-- 2. Migrate data (if any) - mapping symbol to variable_id would go here
-- For now, we assume fresh start or we'll handle mapping later if needed.
-- Since we are pivoting, old orders might be invalid anyway.

-- 3. Make variable_id required (after data migration if needed)
-- ALTER TABLE orders ALTER COLUMN variable_id SET NOT NULL; 
-- Keeping it nullable for a moment to allow migration if we had data, 
-- but for this "purge" phase, we can enforce it if we truncate.

-- Let's truncate orders since we changed the core concept
-- Must truncate trades first due to FK constraint
TRUNCATE TABLE trades CASCADE;
TRUNCATE TABLE orders CASCADE;

ALTER TABLE orders 
ALTER COLUMN variable_id SET NOT NULL;

-- 4. Drop obsolete columns
ALTER TABLE orders 
DROP COLUMN IF EXISTS market_id,
DROP COLUMN IF EXISTS symbol;

-- 5. Re-create indexes
DROP INDEX IF EXISTS idx_orders_market_id;
DROP INDEX IF EXISTS idx_orders_symbol;

CREATE INDEX IF NOT EXISTS idx_orders_variable_id ON orders(variable_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_variable ON orders(user_id, variable_id);

-- ============================================================================
-- TRADES TABLE UPDATE (if needed)
-- ============================================================================
-- Trades usually link to orders, so they might be fine if they just reference order_id.
-- But if they have market_id/symbol denormalized, we should fix that too.

-- Check if trades has market_id/symbol
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'market_id') THEN
        ALTER TABLE trades ADD COLUMN IF NOT EXISTS variable_id UUID REFERENCES variables(variable_id);
        TRUNCATE TABLE trades; -- Purge old trades
        ALTER TABLE trades ALTER COLUMN variable_id SET NOT NULL;
        ALTER TABLE trades DROP COLUMN market_id;
        CREATE INDEX IF NOT EXISTS idx_trades_variable_id ON trades(variable_id);
    END IF;
END $$;
