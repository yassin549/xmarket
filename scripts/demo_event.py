"""
Demo script - simulate a positive news event.
"""
import requests
import json
import hmac
import hashlib
from datetime import datetime

def publish_demo_event():
    """Publish a demo positive event."""
    event = {
        "event_id": f"demo-positive-{int(datetime.now().timestamp())}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "stocks": ["ELON"],
        "quick_score": 0.75,
        "impact_points": 15.0,
        "summary": "Tesla announces major breakthrough in autonomous driving AI, stock sentiment surges positively",
        "sources": [
            {"id": "reuters", "url": "https://reuters.com/tech/tesla-ai-breakthrough", "trust": 0.95}
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
        print("✅ Demo event published successfully!")
        print(f"   Event ID: {event['event_id']}")
        print(f"   Impact: +{event['impact_points']} points")
        print(f"   Status: {result.get('status')}")
        print("\n📊 Check the dashboard to see the price update!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to backend")
        print("   Make sure backend is running on port 8000")
    except requests.exceptions.HTTPError as e:
        print(f"❌ Error: {e}")
        print(f"   Response: {e.response.text}")

if __name__ == "__main__":
    publish_demo_event()
