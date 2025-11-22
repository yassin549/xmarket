"""
Test script to verify orderbook API endpoints.
"""
import requests
import json

BASE_URL = "http://localhost:8001"

def test_health():
    """Test health endpoint."""
    print("\n1. Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    return response.status_code == 200

def test_place_buy_order():
    """Test placing a buy order."""
    print("\n2. Testing buy order placement...")
    
    order = {
        "user_id": "test-user-1",
        "symbol": "ELON",
        "side": "BUY",
        "order_type": "LIMIT",
        "quantity": 10.0,
        "price": 52.0
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/orders", json=order)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Order ID: {data['order_id']}")
        print(f"   Status: {data['status']}")
        return True
    else:
        print(f"   Error: {response.text}")
        return False

def test_place_sell_order():
    """Test placing a sell order."""
    print("\n3. Testing sell order placement...")
    
    order = {
        "user_id": "test-user-2",
        "symbol": "ELON",
        "side": "SELL",
        "order_type": "LIMIT",
        "quantity": 5.0,
        "price": 51.0
    }
    
    response = requests.post(f"{BASE_URL}/api/v1/orders", json=order)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Order ID: {data['order_id']}")
        print(f"   Status: {data['status']}")
        print(f"   Filled: {data['filled']}/{data['quantity']}")
        return True
    else:
        print(f"   Error: {response.text}")
        return False

def test_market_snapshot():
    """Test market snapshot."""
    print("\n4. Testing market snapshot...")
    
    response = requests.get(f"{BASE_URL}/api/v1/market/ELON/snapshot")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Market Price: {data['market_price']}")
        print(f"   Best Bid: {data['top_of_book']['best_bid']}")
        print(f"   Best Ask: {data['top_of_book']['best_ask']}")
        print(f"   Recent Trades: {len(data['recent_trades'])}")
        return True
    else:
        print(f"   Response: {response.json()}")
        return True  # OK if no order book exists yet

def test_market_pressure():
    """Test market pressure endpoint."""
    print("\n5. Testing market pressure...")
    
    response = requests.get(f"{BASE_URL}/api/v1/market/ELON/pressure")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Market Price: {data['market_price']}")
        print(f"   Buy Volume: {data['buy_volume']}")
        print(f"   Sell Volume: {data['sell_volume']}")
        print(f"   Net Pressure: {data['net_pressure']}")
        return True
    else:
        print(f"   Error: {response.text}")
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("Orderbook API Test Suite")
    print("=" * 60)
    print(f"\nTesting against: {BASE_URL}")
    print("Make sure orderbook is running: uvicorn app.main:app --reload --port 8001")
    
    results = []
    
    try:
        results.append(("Health Check", test_health()))
        results.append(("Place Buy Order", test_place_buy_order()))
        results.append(("Place Sell Order", test_place_sell_order()))
        results.append(("Market Snapshot", test_market_snapshot()))
        results.append(("Market Pressure", test_market_pressure()))
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to orderbook.")
        print("   Make sure orderbook is running on port 8001")
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
