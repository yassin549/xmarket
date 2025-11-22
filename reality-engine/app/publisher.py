"""
Event publisher - signs and publishes events to backend.
"""
import httpx
import hmac
import hashlib
import json
from typing import Dict
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import env

logger = logging.getLogger(__name__)


class EventPublisher:
    """Publishes events to backend with HMAC signing."""
    
    def __init__(self):
        self.backend_url = env.BACKEND_URL
        self.api_secret = env.REALITY_API_SECRET
        logger.info(f"Event publisher initialized for {self.backend_url}")
    
    def sign_payload(self, payload: Dict) -> str:
        """
        Compute HMAC-SHA256 signature for payload.
        
        Args:
            payload: Event dict
        
        Returns:
            Hex-encoded signature
        """
        # Serialize payload to canonical JSON
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        
        # Compute HMAC
        signature = hmac.new(
            self.api_secret.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    async def publish_event(self, event: Dict) -> bool:
        """
        Publish event to backend.
        
        Args:
            event: Event dict from event_builder
        
        Returns:
            True if successful
        """
        # Sign payload
        signature = self.sign_payload(event)
        
        # Prepare request
        headers = {
            "X-Signature": signature,
            "Content-Type": "application/json"
        }
        
        url = f"{self.backend_url}/api/v1/reality/ingest"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    json=event,
                    headers=headers
                )
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Event {event['event_id']} published: {result.get('status')}")
                return True
                
        except httpx.HTTPError as e:
            logger.error(f"Failed to publish event {event['event_id']}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error publishing event: {e}")
            return False


# Global publisher
_publisher = None


def get_publisher() -> EventPublisher:
    """Get or create global publisher."""
    global _publisher
    if _publisher is None:
        _publisher = EventPublisher()
    return _publisher
