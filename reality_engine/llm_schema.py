"""
LLM output JSON schema definition and validation.

Defines Appendix A.2 schema for LLM responses:
- summary: concise event summary (10-500 chars)
- impact_suggestion: integer from -100 to 100
- confidence: float from 0.0 to 1.0
- rationale: explanation (10-1000 chars)
"""

from jsonschema import validate, ValidationError
from typing import Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# Appendix A.2: LLM Output Schema
# ============================================================================

LLM_OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["summary", "impact_suggestion", "confidence", "rationale"],
    "properties": {
        "summary": {
            "type": "string",
            "minLength": 10,
            "maxLength": 500,
            "description": "Concise summary of the aggregated event"
        },
        "impact_suggestion": {
            "type": "integer",
            "minimum": -100,
            "maximum": 100,
            "description": "Suggested impact score (-100=very negative, +100=very positive)"
        },
        "confidence": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0,
            "description": "LLM's confidence in this assessment (0.0=no confidence, 1.0=very confident)"
        },
        "rationale": {
            "type": "string",
            "minLength": 10,
            "maxLength": 1000,
            "description": "Brief explanation of the assessment"
        }
    },
    "additionalProperties": False
}


def validate_llm_output(data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validate LLM output against Appendix A.2 schema.
    
    Args:
        data: LLM output to validate
        
    Returns:
        Tuple of (is_valid, error_message)
        - If valid: (True, "")
        - If invalid: (False, "error details")
    """
    try:
        validate(instance=data, schema=LLM_OUTPUT_SCHEMA)
        logger.debug("LLM output validation passed")
        return True, ""
    
    except ValidationError as e:
        error_msg = f"Schema validation failed: {e.message}"
        logger.warning(f"LLM output validation failed: {error_msg}")
        return False, error_msg
    
    except Exception as e:
        error_msg = f"Unexpected validation error: {str(e)}"
        logger.error(f"LLM output validation error: {error_msg}")
        return False, error_msg


def create_llm_fallback_output(quick_score: float, reason: str = "LLM unavailable") -> Dict[str, Any]:
    """
    Create fallback LLM output when actual LLM call fails or is skipped.
    
    Uses deterministic quick_score to generate a valid but simple response.
    
    Args:
        quick_score: Deterministic quick_score from scorer
        reason: Reason for fallback
        
    Returns:
        Valid LLM output dict matching schema
    """
    # Scale quick_score (-1 to 1) to impact_suggestion (-100 to 100)
    impact = int(quick_score * 100)
    
    # Generate summary based on sentiment
    if quick_score > 0.3:
        summary = f"Positive development detected (score: {quick_score:.2f})"
    elif quick_score < -0.3:
        summary = f"Negative development detected (score: {quick_score:.2f})"
    else:
        summary = f"Neutral event detected (score: {quick_score:.2f})"
    
    return {
        "summary": summary,
        "impact_suggestion": impact,
        "confidence": 0.5,  # Low confidence for fallback
        "rationale": f"Deterministic fallback: {reason}"
    }
