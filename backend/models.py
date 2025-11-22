"""
Pydantic models for Everything Market Backend API.

These models define the request/response schemas for the reality ingest endpoint
following the canonical schema from plan.txt Appendix A.1.
"""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field, HttpUrl, field_validator
import uuid


# ============================================================================
# Source Models
# ============================================================================

class SourceModel(BaseModel):
    """
    News source metadata.
    
    Attributes:
        id: Source identifier
        url: Source URL
        trust: Trust score for this source (0..1)
    """
    id: str
    url: HttpUrl
    trust: float = Field(ge=0.0, le=1.0, description="Source trust score (0..1)")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "src-123",
                "url": "https://example.com/article",
                "trust": 0.85
            }
        }
    }


# ============================================================================
# Reality Event Request (Appendix A.1)
# ============================================================================

class RealityEventRequest(BaseModel):
    """
    Reality event payload from reality-engine.
    
    Spec: plan.txt Appendix A.1
    
    This is the canonical schema for events sent from reality-engine to backend.
    All fields are validated according to master plan constraints.
    """
    event_id: str = Field(
        description="Unique event identifier (UUID format)"
    )
    timestamp: datetime = Field(
        description="Event timestamp (ISO8601 UTC)"
    )
    stocks: list[str] = Field(
        min_length=1,
        description="List of affected stock symbols"
    )
    quick_score: float = Field(
        description="Quick score from deterministic scoring (-1..1)"
    )
    impact_points: float = Field(
        ge=-20,  # DELTA_CAP from constants
        le=20,
        description="Computed impact points (capped at ±DELTA_CAP)"
    )
    summary: str = Field(
        max_length=2000,
        description="LLM or computed summary"
    )
    sources: list[SourceModel] = Field(
        min_length=1,
        description="List of news sources for this event"
    )
    num_independent_sources: int = Field(
        ge=1,
        description="Number of independent sources"
    )
    llm_mode: Literal["tinyLLama", "skipped", "failed"] = Field(
        description="LLM processing mode"
    )
    meta: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (title, author, etc.)"
    )
    
    @field_validator("event_id")
    @classmethod
    def validate_event_id_format(cls, v: str) -> str:
        """Validate event_id is UUID format."""
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError(f"event_id must be valid UUID format, got: {v}")
        return v
    
    @field_validator("stocks")
    @classmethod
    def validate_stocks_not_empty(cls, v: list[str]) -> list[str]:
        """Validate stocks list is not empty."""
        if not v:
            raise ValueError("stocks list cannot be empty")
        return v
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "event_id": "550e8400-e29b-41d4-a716-446655440000",
                "timestamp": "2025-11-22T16:00:00Z",
                "stocks": ["TECH", "CLIMATE"],
                "quick_score": 0.65,
                "impact_points": 12.5,
                "summary": "Major breakthrough in renewable energy announced",
                "sources": [
                    {
                        "id": "src-reuters-123",
                        "url": "https://reuters.com/article/123",
                        "trust": 0.95
                    }
                ],
                "num_independent_sources": 2,
                "llm_mode": "tinyLLama",
                "meta": {
                    "title": "Renewable Energy Breakthrough",
                    "author": "John Doe"
                }
            }
        }
    }


# ============================================================================
# Response Models
# ============================================================================

class EventCreatedResponse(BaseModel):
    """Response when event is successfully created (201)."""
    status: str = "created"
    event_id: str
    message: str = "Event successfully persisted"
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "created",
                "event_id": "550e8400-e29b-41d4-a716-446655440000",
                "message": "Event successfully persisted"
            }
        }
    }


class EventDuplicateResponse(BaseModel):
    """Response when event already exists (200 - idempotent)."""
    status: str = "duplicate"
    event_id: str
    message: str = "Event already processed (idempotent)"
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "duplicate",
                "event_id": "550e8400-e29b-41d4-a716-446655440000",
                "message": "Event already processed (idempotent)"
            }
        }
    }


class PendingReviewResponse(BaseModel):
    """Response when event requires manual review (202)."""
    status: str = "pending_review"
    event_id: str
    pending_review: bool = True
    reason: str
    message: str = "Event flagged for manual review"
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "pending_review",
                "event_id": "550e8400-e29b-41d4-a716-446655440000",
                "pending_review": True,
                "reason": "Suspicious delta: abs(impact_points) > SUSPICIOUS_DELTA",
                "message": "Event flagged for manual review"
            }
        }
    }


class ErrorResponse(BaseModel):
    """Generic error response."""
    status: str = "error"
    error: str
    detail: str | None = None
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "error",
                "error": "Invalid stocks",
                "detail": "Stocks not found: INVALID1, INVALID2"
            }
        }
    }
