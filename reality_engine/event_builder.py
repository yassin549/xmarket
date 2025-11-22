"""
Event builder for reality-engine.

Builds canonical event payloads matching backend's Appendix A.1 schema.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any
import logging

from reality_engine.quick_scorer import compute_quick_score
from reality_engine.compute_score import compute_event_points

logger = logging.getLogger(__name__)


def build_event(
    normalized_article: Dict[str, Any],
    feed_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Build canonical event payload per Appendix A.1.
    
    Args:
        normalized_article: Normalized article data
        feed_config: Feed configuration
        
    Returns:
        Event payload dict ready for signing and posting
    """
    # Generate unique event_id
    event_id = str(uuid.uuid4())
    
    # Get trust score from feed config
    trust = feed_config.get('trust', 0.75)
    
    # Compute quick_score using deterministic scorer (VADER + keywords + NER)
    quick_score = compute_quick_score(
        normalized_article['text'],
        normalized_article['stocks']
    )
    
    # Compute impact_points using the canonical formula
    # For a new event: num_related_docs=1, age_seconds=0
    impact_points = compute_event_points(
        quick_score=quick_score,
        source_trust=trust,
        num_related_docs=1,
        age_seconds=0.0
    )
    
    # Build sources list
    sources = [
        {
            "id": f"src-{feed_config['name']}-{event_id[:8]}",
            "url": normalized_article['source_url'],
            "trust": trust
        }
    ]
    
    # Build canonical event payload
    event = {
        "event_id": event_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        "stocks": normalized_article['stocks'],
        "quick_score": quick_score,
        "impact_points": impact_points,
        "summary": normalized_article['title'][:2000],  # Truncate to max length
        "sources": sources,
        "num_independent_sources": 1,  # Single source for now
        "llm_mode": "skipped",  # No LLM yet (future prompts)
        "meta": {
            "title": normalized_article['title'],
            "feed": feed_config['name'],
            "content_length": normalized_article.get('content_length', 0),
            "lang": normalized_article.get('lang', 'en')
        }
    }
    
    logger.info(f"Built event {event_id}: stocks={event['stocks']}, impact={impact_points}")
    return event
