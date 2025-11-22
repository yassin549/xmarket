"""Pydantic schemas for API request/response validation."""
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime


# ============================================================================
# Stock Schemas
# ============================================================================

class StockCreate(BaseModel):
    """Schema for creating a new stock."""
    symbol: str = Field(..., min_length=1, max_length=20, description="Stock symbol (e.g., ELON)")
    name: str = Field(..., min_length=1, max_length=200, description="Full name")
    description: Optional[str] = Field(None, description="Description of the asset")
    denom: str = Field("shares", description="Denomination unit")
    min_price: float = Field(0.0, ge=0.0, description="Minimum price for normalization")
    max_price: float = Field(100.0, gt=0.0, description="Maximum price for normalization")
    market_weight: float = Field(0.6, ge=0.0, le=1.0, description="Market weight in blending")
    reality_weight: float = Field(0.4, ge=0.0, le=1.0, description="Reality weight in blending")
    initial_score: float = Field(50.0, ge=0.0, le=100.0, description="Initial reality score")
    
    @validator('market_weight', 'reality_weight')
    def validate_weights(cls, v, values):
        """Ensure weights sum to 1.0."""
        if 'market_weight' in values and 'reality_weight' in values:
            if abs(values['market_weight'] + values['reality_weight'] - 1.0) > 0.01:
                raise ValueError("market_weight + reality_weight must equal 1.0")
        return v


class StockResponse(BaseModel):
    """Schema for stock response."""
    symbol: str
    name: str
    description: Optional[str]
    market_weight: float
    reality_weight: float
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# Reality Event Schemas
# ============================================================================

class SourceInfo(BaseModel):
    """Information about a news source."""
    id: str = Field(..., description="Source identifier")
    url: str = Field(..., description="Article URL")
    trust: float = Field(..., ge=0.0, le=1.0, description="Source trust score")


class RealityEventIngest(BaseModel):
    """Schema for reality event ingestion from Reality Engine."""
    event_id: str = Field(..., description="Unique event UUID")
    timestamp: str = Field(..., description="ISO8601 UTC timestamp")
    stocks: List[str] = Field(..., min_items=1, description="List of affected stock symbols")
    quick_score: float = Field(..., ge=-1.0, le=1.0, description="Quick scorer output")
    impact_points: float = Field(..., description="Computed impact points")
    summary: str = Field(..., max_length=2000, description="Event summary")
    sources: List[SourceInfo] = Field(..., min_items=1, description="Source articles")
    num_independent_sources: int = Field(..., ge=1, description="Number of independent sources")
    llm_mode: Optional[str] = Field(None, description="LLM mode used (tiny, local, heuristic)")
    raw_meta: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    
    @validator('impact_points')
    def validate_impact_points(cls, v):
        """Ensure impact points are within DELTA_CAP."""
        from config import constants
        if abs(v) > constants.DELTA_CAP:
            raise ValueError(f"impact_points must be within ±{constants.DELTA_CAP}")
        return v


class EventResponse(BaseModel):
    """Schema for event response."""
    id: str
    symbol: str
    impact_points: float
    quick_score: float
    summary: str
    sources: List[Dict[str, Any]]
    num_independent_sources: int
    llm_mode: Optional[str]
    processed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# Audit Schemas
# ============================================================================

class AuditApproval(BaseModel):
    """Schema for approving/rejecting an audit."""
    event_id: str = Field(..., description="Event ID to approve/reject")
    approve: bool = Field(..., description="True to approve, False to reject")
    admin_id: str = Field(..., description="Admin user ID")
    reason: Optional[str] = Field(None, description="Rejection reason (if applicable)")


class AuditResponse(BaseModel):
    """Schema for audit response."""
    id: int
    event_id: str
    symbol: str
    summary: str
    impact: float
    sources: List[Dict[str, Any]]
    approved: Optional[bool]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# Score Schemas
# ============================================================================

class ScoreResponse(BaseModel):
    """Schema for score response."""
    symbol: str
    reality_score: float
    final_price: float
    confidence: float
    last_updated: datetime
    
    class Config:
        from_attributes = True


class FinalPriceResponse(BaseModel):
    """Schema for final price with components."""
    symbol: str
    final_price: float
    reality_score: float
    market_price: Optional[float] = None
    confidence: float
    weights: Dict[str, float]
    last_updated: str


# ============================================================================
# WebSocket Message Schemas
# ============================================================================

class RealityUpdateMessage(BaseModel):
    """WebSocket message for reality score update."""
    type: str = "reality_update"
    stock: str
    reality_score: float
    delta: float
    timestamp: str
    event_id: str


class MarketUpdateMessage(BaseModel):
    """WebSocket message for market update."""
    type: str = "market_update"
    stock: str
    market_price: float
    buy_volume: float
    sell_volume: float
    net_pressure: float
    timestamp: str


class FinalUpdateMessage(BaseModel):
    """WebSocket message for final price update."""
    type: str = "final_update"
    stock: str
    final_price: float
    components: Dict[str, Any]
    timestamp: str


class AuditEventMessage(BaseModel):
    """WebSocket message for audit event."""
    type: str = "audit_event"
    event_id: str
    stock: str
    delta: float
    state: str  # pending_review, approved, rejected
    timestamp: str
