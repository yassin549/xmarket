"""
Event builder - computes event_points and prepares events for publishing.
"""
import math
from typing import List, Dict
from datetime import datetime
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import constants

logger = logging.getLogger(__name__)


def compute_event_weight(
    source_trust: float,
    num_related_docs: int,
    age_seconds: float
) -> float:
    """
    Compute event weight using the canonical formula.
    
    event_weight = source_trust × (1 + log(1 + num_related_docs)) × exp(-age_seconds/TAU)
    
    Args:
        source_trust: Source trust score (0-1)
        num_related_docs: Number of related/grouped documents
        age_seconds: Age of event in seconds
    
    Returns:
        Event weight (positive float)
    """
    # Grouping factor
    grouping_factor = 1 + math.log(1 + num_related_docs)
    
    # Decay factor
    decay_factor = math.exp(-age_seconds / constants.TAU_SECONDS)
    
    weight = source_trust * grouping_factor * decay_factor
    
    logger.debug(
        f"Event weight: trust={source_trust:.2f}, docs={num_related_docs}, "
        f"age={age_seconds:.0f}s → weight={weight:.4f}"
    )
    
    return weight


def compute_event_points(event_weight: float, quick_score: float) -> float:
    """
    Compute event impact points.
    
    event_points = clamp(event_weight × quick_score × 100, -DELTA_CAP, +DELTA_CAP)
    
    Args:
        event_weight: Computed event weight
        quick_score: Quick scorer output (-1 to 1)
    
    Returns:
        Impact points clamped to ±DELTA_CAP
    """
    raw_points = event_weight * quick_score * 100
    
    # Clamp to DELTA_CAP
    clamped = max(-constants.DELTA_CAP, min(constants.DELTA_CAP, raw_points))
    
    # Round to 2 decimals
    points = round(clamped, 2)
    
    logger.debug(f"Event points: {raw_points:.2f} → {points:.2f} (capped at ±{constants.DELTA_CAP})")
    
    return points


def build_event(
    event_id: str,
    stocks: List[str],
    quick_score: float,
    grouped_docs: List[Dict],
    llm_output: Dict = None
) -> Dict:
    """
    Build complete event payload for publishing.
    
    Args:
        event_id: Unique event UUID
        stocks: List of affected stock symbols
        quick_score: Quick scorer output
        grouped_docs: List of grouped article dicts
        llm_output: Optional LLM analysis output
    
    Returns:
        Event dict ready for HMAC signing and publishing
    """
    # Compute event weight
    # Use first source's trust (or average if multiple)
    source_trust = grouped_docs[0].get('source_trust', 0.8)
    num_related_docs = len(grouped_docs)
    
    # Compute age (assume most recent doc)
    age_seconds = 0.0  # Fresh event
    if 'publish_date' in grouped_docs[0] and grouped_docs[0]['publish_date']:
        pub_date = grouped_docs[0]['publish_date']
        if isinstance(pub_date, datetime):
            age_seconds = (datetime.utcnow() - pub_date).total_seconds()
    
    event_weight = compute_event_weight(source_trust, num_related_docs, age_seconds)
    
    # Compute impact points
    impact_points = compute_event_points(event_weight, quick_score)
    
    # Prepare sources list
    sources = []
    for doc in grouped_docs:
        sources.append({
            "id": doc.get('source_id', 'unknown'),
            "url": doc.get('url', ''),
            "trust": doc.get('source_trust', 0.8)
        })
    
    # Use LLM summary if available, otherwise use first article title
    if llm_output:
        summary = llm_output.get('summary', '')
        llm_mode = 'tiny'
    else:
        summary = grouped_docs[0].get('title', 'News event')
        llm_mode = None
    
    # Count independent sources (unique source_ids)
    unique_sources = len(set(doc.get('source_id') for doc in grouped_docs))
    
    # Build event
    event = {
        "event_id": event_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "stocks": stocks,
        "quick_score": round(quick_score, 3),
        "impact_points": impact_points,
        "summary": summary[:2000],  # Truncate to max length
        "sources": sources,
        "num_independent_sources": unique_sources,
        "llm_mode": llm_mode,
        "raw_meta": {
            "event_weight": round(event_weight, 4),
            "num_docs": num_related_docs,
            "age_seconds": round(age_seconds, 0)
        }
    }
    
    logger.info(
        f"Built event {event_id}: {len(stocks)} stocks, "
        f"impact={impact_points:.2f}, sources={unique_sources}"
    )
    
    return event
