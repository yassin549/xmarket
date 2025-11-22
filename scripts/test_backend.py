"""
Test script to verify backend API endpoints.
"""
import requests
import json
import hmac
import hashlib

BASE_URL = "http://localhost:8000"
ADMIN_KEY = "dev-admin-key-change-in-production"
REALITY_SECRET = "dev-reality-secret-change-in-production"

def test_health():
    """Test health endpoint."""
    print("\n1. Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    return response.status_code == 200

def test_list_stocks():
    """Test stock listing."""
    print("\n2. Testing stock listing...")
    response = requests.get(f"{BASE_URL}/api/v1/stocks")
    print(f"   Status: {response.status_code}")
    stocks = response.json()
    print(f"   Found {len(stocks)} stocks")
    for stock in stocks:
        print(f"     - {stock['symbol']}: {stock['name']}")
    return response.status_code == 200

def test_get_stock():
    """Test getting specific stock."""
    print("\n3. Testing get stock (ELON)...")
    response = requests.get(f"{BASE_URL}/api/v1/stocks/ELON")
    print(f"   Status: {response.status_code}")
    data = response.json()
    print(f"   Stock: {data['stock']['name']}")
    print(f"   Final Price: {data['score']['final_price']}")
    print(f"   Reality Score: {data['score']['reality_score']}")
    return response.status_code == 200

def test_create_stock():
    """Test creating a new stock (admin)."""
    print("\n4. Testing stock creation (admin)...")
    
    stock_data = {
        "symbol": "TEST",
        "name": "Test Stock",
        "description": "Test stock for API verification",
        "market_weight": 0.6,
        "reality_weight": 0.4,
        "initial_score": 50.0
    }
    
    response = requests.post(
        f"{BASE_URL}/api/v1/admin/stocks",
        json=stock_data,
        headers={"X-Admin-Key": ADMIN_KEY}
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        print(f"   Created: {response.json()['symbol']}")
        return True
    elif response.status_code == 400:
        print(f"   Stock already exists (OK)")
        return True
    else:
        print(f"   Error: {response.text}")
        return False

def test_reality_event():
    """Test reality event ingestion."""
    print("\n5. Testing reality event ingestion...")
    
    event = {
        "event_id": "test-event-001",
        "timestamp": "2025-11-22T09:00:00Z",
        "stocks": ["ELON"],
        "quick_score": 0.65,
        "impact_points": 12.5,
        "summary": "Test event: Positive AI development announced",
        "sources": [
            {"id": "test-source", "url": "https://example.com/article", "trust": 0.9}
        ],
        "num_independent_sources": 1,
        "llm_mode": "heuristic"
    }
    
    # Sign payload
    payload = json.dumps(event, sort_keys=True).encode()
    signature = hmac.new(
        REALITY_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    response = requests.post(
        f"{BASE_URL}/api/v1/reality/ingest",
        json=event,
        headers={"X-Signature": signature}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    return response.status_code == 200

def main():
    """Run all tests."""
    print("=" * 60)
    print("Backend API Test Suite")
    print("=" * 60)
    print(f"\nTesting against: {BASE_URL}")
    print("Make sure backend is running: uvicorn app.main:app --reload --port 8000")
    
    results = []
    
    try:
        results.append(("Health Check", test_health()))
        results.append(("List Stocks", test_list_stocks()))
        results.append(("Get Stock", test_get_stock()))
        results.append(("Create Stock (Admin)", test_create_stock()))
        results.append(("Reality Event", test_reality_event()))
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to backend.")
        print("   Make sure backend is running on port 8000")
        return
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    print("\n" + "=" * 60)
    print(f"Total: {passed_count}/{total_count} tests passed")
    print("=" * 60)

if __name__ == "__main__":
    main()
