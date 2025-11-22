"""
Event poster for reality-engine.

Signs events with HMAC and POSTs to backend /api/v1/reality/ingest endpoint.
"""

import requests
import json
import hmac
import hashlib
from typing import Dict, Any
import logging
import os

logger = logging.getLogger(__name__)


def sign_event(event: Dict[str, Any], secret: str) -> str:
    """
    Sign event payload with HMAC-SHA256.
    
    Uses canonical JSON (sorted keys, compact format) per Appendix B.
    
    Args:
        event: Event payload dict
        secret: REALITY_API_SECRET
        
    Returns:
        Hex digest of HMAC signature
    """
    # Canonical JSON: sorted keys, no whitespace
    canonical = json.dumps(event, separators=(",", ":"), sort_keys=True)
    
    # HMAC-SHA256
    mac = hmac.new(
        secret.encode('utf-8'),
        canonical.encode('utf-8'),
        hashlib.sha256
    )
    
    signature = mac.hexdigest()
    logger.debug(f"Generated signature for event {event['event_id']}: {signature[:16]}...")
    return signature


def post_event_to_backend(
    event: Dict[str, Any],
    backend_url: str,
    secret: str,
    dry_run: bool = False,
    timeout: int = 10
) -> Dict[str, Any]:
    """
    Post event to backend /api/v1/reality/ingest endpoint.
    
    Args:
        event: Event payload
        backend_url: Backend base URL
        secret: REALITY_API_SECRET for signing
        dry_run: If True, don't actually POST, just log
        timeout: Request timeout in seconds
        
    Returns:
        Response dict with status_code, response, event_id
    """
    # Sign event
    signature = sign_event(event, secret)
    
    # Dry run mode
    if dry_run:
        logger.info(f"[DRY RUN] Would POST event {event['event_id']} to {backend_url}")
        logger.info(f"[DRY RUN] Signature: {signature}")
        logger.info(f"[DRY RUN] Payload: {json.dumps(event, indent=2)[:200]}...")
        return {
            "status_code": 201,
            "response": {"status": "dry_run", "event_id": event['event_id']},
            "event_id": event['event_id']
        }
    
    # Actual POST
    endpoint = f"{backend_url}/api/v1/reality/ingest"
    headers = {"X-Reality-Signature": signature}
    
    try:
        logger.info(f"POSTing event {event['event_id']} to {endpoint}")
        
        response = requests.post(
            endpoint,
            json=event,
            headers=headers,
            timeout=timeout
        )
        
        result = {
            "status_code": response.status_code,
            "response": response.json() if response.headers.get('content-type', '').startswith('application/json') else {},
            "event_id": event['event_id']
        }
        
        # Log result
        if response.status_code == 201:
            logger.info(f"✓ Event {event['event_id']} created (201)")
        elif response.status_code == 200:
            logger.info(f"✓ Event {event['event_id']} already exists (200 - idempotent)")
        elif response.status_code == 202:
            logger.warning(f"⚠ Event {event['event_id']} pending review (202 - suspicious delta)")
        else:
            logger.error(f"✗ Event {event['event_id']} failed: {response.status_code} - {result['response']}")
        
        return result
    
    except requests.exceptions.Timeout:
        logger.error(f"Timeout POSTing event {event['event_id']}")
        return {
            "status_code": 0,
            "response": {"error": "Timeout"},
            "event_id": event['event_id']
        }
    
    except Exception as e:
        logger.error(f"Error POSTing event {event['event_id']}: {e}")
        return {
            "status_code": 0,
            "response": {"error": str(e)},
            "event_id": event['event_id']
        }


def get_reality_api_secret() -> str:
    """
    Get REALITY_API_SECRET from environment.
    
    Returns:
        Secret string
        
    Raises:
        ValueError: If secret not set
    """
    secret = os.getenv('REALITY_API_SECRET')
    if not secret:
        raise ValueError("REALITY_API_SECRET environment variable not set")
    return secret
