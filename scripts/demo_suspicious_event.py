"""
Demo script - simulate a suspicious event that gets flagged.
"""
import requests
import json
import hmac
import hashlib
from datetime import datetime

def publish_suspicious_event():
    """Publish a suspicious event (high impact)."""
    event = {
        "event_id": f"demo-suspicious-{int(datetime.now().timestamp())}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "stocks": ["ELON"],
        "quick_score": 0.95,
        "impact_points": 18.0,  # Above SUSPICIOUS_DELTA (15)
        "summary": "BREAKING: Major announcement expected to significantly impact market sentiment",
        "sources": [
            {"id": "unknown-source", "url": "https://example.com/breaking-news", "trust": 0.7}
        ],
        "num_independent_sources": 1,
        "llm_mode": "heuristic"
    }
    
    # Sign payload
    payload = json.dumps(event, sort_keys=True).encode()
    signature = hmac.new(
        b"dev-reality-secret-change-in-production",
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Send to backend
    try:
        response = requests.post(
            "http://localhost:8000/api/v1/reality/ingest",
            json=event,
            headers={"X-Signature": signature},
            timeout=5
        )
        response.raise_for_status()
        
        result = response.json()
        print("⚠️  Suspicious event published!")
        print(f"   Event ID: {event['event_id']}")
        print(f"   Impact: +{event['impact_points']} points (above threshold of 15)")
        print(f"   Status: {result.get('status')}")
        
        if result.get('status') == 'pending_audit':
            print("\n🔍 Event flagged for admin review!")
            print("   Reason:", result.get('reason'))
            print("   Check /api/v1/admin/pending to see it")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend")
        print("   Make sure backend is running on port 8000")
    except requests.exceptions.HTTPError as e:
        print(f"❌ Error: {e}")
        print(f"   Response: {e.response.text}")

if __name__ == "__main__":
    publish_suspicious_event()
