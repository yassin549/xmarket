-- Migration 001: Create Variables (Real-World Tradable Variables)
-- Purpose: Core table for tradable real-world variables/stocks/indexes
-- Date: 2025-11-27

-- ============================================================================
-- VARIABLES TABLE
-- ============================================================================
-- Each variable represents a tradable real-world metric
-- Examples: "Elon Musk Intelligence", "AI Risk", "Climate Change Severity"
-- ============================================================================

CREATE TABLE IF NOT EXISTS variables (
  variable_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  symbol VARCHAR(50) UNIQUE NOT NULL,           -- e.g., "ELON-IQ", "AI-RISK"
  name TEXT NOT NULL,                           -- "Elon Musk Intelligence"
  description TEXT,
  
  -- Classification
  category VARCHAR(50) NOT NULL,                -- tech, politics, environment, economy, society
  tags JSONB DEFAULT '[]',                      -- ["tech", "personalities", "business"]
  
  -- Reality Engine Configuration
  reality_sources JSONB NOT NULL DEFAULT '[]',  -- Array of URLs to scrape
  impact_keywords JSONB DEFAULT '[]',           -- Keywords for LLM impact assessment
  llm_context TEXT,                             -- Additional context for LLM analysis
  
  -- Current Values (The Three Charts)
  reality_value DECIMAL(20, 8),                 -- Current reality chart value
  market_value DECIMAL(20, 8),                  -- Current market orderbook value
  trading_value DECIMAL(20, 8),                 -- Blended value (what users trade)
  
  -- Initial Value (Starting Point)
  initial_value DECIMAL(20, 8) DEFAULT 100.00,  -- IPO price
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, paused, delisted
  is_tradeable BOOLEAN NOT NULL DEFAULT true,
  
  -- Admin
  created_by UUID,                              -- Admin who created this variable
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reality_update TIMESTAMPTZ,              -- Last time reality engine ran
  
  CONSTRAINT chk_variables_category CHECK (
    category IN ('tech', 'politics', 'environment', 'economy', 'society', 'culture', 'health', 'energy')
  ),
  CONSTRAINT chk_variables_status CHECK (
    status IN ('active', 'paused', 'delisted')
  ),
  CONSTRAINT chk_variables_values CHECK (
    reality_value IS NULL OR reality_value >= 0
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_variables_symbol ON variables(symbol);
CREATE INDEX IF NOT EXISTS idx_variables_category ON variables(category);
CREATE INDEX IF NOT EXISTS idx_variables_status ON variables(status, is_tradeable);
CREATE INDEX IF NOT EXISTS idx_variables_updated ON variables(last_reality_update DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE variables IS 'Tradable real-world variables (stocks/indexes)';
COMMENT ON COLUMN variables.reality_value IS 'Current value from reality engine (AI analysis)';
COMMENT ON COLUMN variables.market_value IS 'Current value from orderbook (public trading)';
COMMENT ON COLUMN variables.trading_value IS 'Blended value = mean(reality_value, market_value)';
COMMENT ON COLUMN variables.reality_sources IS 'Array of URLs for reality engine to scrape';
COMMENT ON COLUMN variables.impact_keywords IS 'Keywords to guide LLM impact assessment';

-- ============================================================================
-- TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS trg_variables_updated_at ON variables;

CREATE TRIGGER trg_variables_updated_at
  BEFORE UPDATE ON variables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (for development)
-- ============================================================================

-- Example: Elon Musk Intelligence Variable
INSERT INTO variables (
  symbol, 
  name, 
  description, 
  category,
  tags,
  reality_sources,
  impact_keywords,
  llm_context,
  initial_value,
  reality_value,
  trading_value
) VALUES (
  'ELON-IQ',
  'Elon Musk Intelligence',
  'Measures the perceived intelligence of Elon Musk based on public decisions and statements',
  'tech',
  '["tech", "personalities", "business", "innovation"]',
  '[
    "https://twitter.com/elonmusk",
    "https://techcrunch.com/tag/elon-musk/",
    "https://news.ycombinator.com/",
    "https://www.tesla.com/blog",
    "https://www.spacex.com/news"
  ]',
  '["smart decision", "innovation", "mistake", "genius", "vision", "failure", "success", "breakthrough"]',
  'Analyze content for evidence of intelligent or unintelligent decisions. Positive impact: new innovations, strategic wins, technical breakthroughs. Negative impact: public mistakes, poor decisions, controversies.',
  100.00,
  100.00,
  100.00
) ON CONFLICT (symbol) DO NOTHING;

-- Example: AI Risk Variable
INSERT INTO variables (
  symbol,
  name,
  description,
  category,
  tags,
  reality_sources,
  impact_keywords,
  llm_context,
  initial_value,
  reality_value,
  trading_value
) VALUES (
  'AI-RISK',
  'AI Existential Risk',
  'Measures the perceived risk of AI to human society based on research and incidents',
  'tech',
  '["ai", "safety", "existential-risk", "technology"]',
  '[
    "https://www.safe.ai/blog",
    "https://arxiv.org/search/?query=ai+safety",
    "https://openai.com/blog",
    "https://www.anthropic.com/news",
    "https://futureoflife.org/ai/"
  ]',
  '["ai incident", "safety concern", "alignment", "dangerous", "breakthrough", "regulation", "misuse"]',
  'Analyze for evidence of AI becoming more or less risky. Positive impact (risk up): AI incidents, safety concerns, misalignment examples. Negative impact (risk down): safety breakthroughs, successful alignment, regulation.',
  100.00,
  100.00,
  100.00
) ON CONFLICT (symbol) DO NOTHING;
