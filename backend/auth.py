"""
HMAC signature authentication for reality-engine -> backend communication.

Implements Appendix B signing rules from plan.txt:
- HMAC-SHA256 over canonical JSON (sorted keys, UTF-8)
- Timing-safe comparison using hmac.compare_digest()
"""

import hmac
import hashlib
import json
from typing import Any

from fastapi import Request, HTTPException, Depends
from backend.models import RealityEventRequest
from config.env import get_reality_api_secret


# ============================================================================
# Signature Generation & Verification
# ============================================================================

def sign_payload(secret: str, payload: dict[str, Any]) -> str:
    """
    Generate HMAC-SHA256 signature from canonical JSON.
    
    Canonicalization per Appendix B:
    - Serialize with sorted keys
    - No whitespace: separators=(",", ":")
    - UTF-8 encoding
    
    Args:
        secret: REALITY_API_SECRET
        payload: Dictionary to sign
        
    Returns:
        Hex digest of HMAC-SHA256
    """
    # Canonical JSON: sorted keys, compact
    canonical = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    
    # HMAC-SHA256
    mac = hmac.new(
        secret.encode('utf-8'),
        canonical.encode('utf-8'),
        hashlib.sha256
    )
    
    return mac.hexdigest()


def verify_signature(payload: dict[str, Any], signature: str, secret: str) -> bool:
    """
    Verify HMAC signature using timing-safe comparison.
    
    Important: Uses hmac.compare_digest() to prevent timing attacks.
    
    Args:
        payload: Dictionary that was signed
        signature: Provided signature (hex)
        secret: REALITY_API_SECRET
        
    Returns:
        True if signature is valid, False otherwise
    """
    expected = sign_payload(secret, payload)
    return hmac.compare_digest(expected, signature)


# ============================================================================
# FastAPI Dependency for Signature Verification
# ============================================================================

async def verify_reality_signature(
    request: Request,
) -> dict[str, Any]:
    """
    FastAPI dependency to verify HMAC signature from X-Reality-Signature header.
    
    This dependency:
    1. Extracts signature from header
    2. Gets raw request body
    3. Verifies HMAC signature
    4. Returns validated JSON payload
    
    Raises:
        HTTPException 401: If signature is missing or invalid
        
    Usage:
        @app.post("/api/v1/reality/ingest")
        async def ingest(
            payload: dict = Depends(verify_reality_signature)
        ):
            # payload is verified and safe to use
            ...
    """
    # 1. Check signature header exists
    signature = request.headers.get("X-Reality-Signature")
    if not signature:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Reality-Signature header"
        )
    
    # 2. Get raw body and parse JSON
    try:
        body = await request.body()
        payload = json.loads(body.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON in request body"
        )
    
    # 3. Verify signature
    secret = get_reality_api_secret()
    if not verify_signature(payload, signature, secret):
        raise HTTPException(
            status_code=401,
            detail="Invalid signature"
        )
    
    return payload


# ============================================================================
# Helper to Sign Outgoing Requests (for testing)
# ============================================================================

def sign_request(payload: dict[str, Any], secret: str) -> str:
    """
    Helper to sign outgoing requests (useful for testing).
    
    Args:
        payload: Request payload dict
        secret: REALITY_API_SECRET
        
    Returns:
        Signature to include in X-Reality-Signature header
    """
    return sign_payload(secret, payload)
