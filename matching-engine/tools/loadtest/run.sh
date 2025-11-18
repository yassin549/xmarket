#!/bin/bash

# Load test script for matching engine
# Tests 10k orders/sec throughput

set -e

ENGINE_ADDR="${ENGINE_ADDR:-localhost:50051}"
ORDERS_PER_SEC="${ORDERS_PER_SEC:-10000}"
DURATION_SEC="${DURATION_SEC:-10}"
MARKET_ID="${MARKET_ID:-test-market-1}"

echo "Starting load test..."
echo "  Engine: $ENGINE_ADDR"
echo "  Target: $ORDERS_PER_SEC orders/sec"
echo "  Duration: $DURATION_SEC seconds"
echo "  Market: $MARKET_ID"

# Check if loadtest tool exists
if ! command -v ghz &> /dev/null; then
    echo "Error: ghz (gRPC load testing tool) not found"
    echo "Install with: go install github.com/bojand/ghz@latest"
    exit 1
fi

# Run load test
ghz \
    --proto matching-engine/proto/orders.proto \
    --call matching_engine.OrderService.PlaceOrder \
    --insecure \
    --connections 10 \
    --concurrency 100 \
    --rps $ORDERS_PER_SEC \
    --duration ${DURATION_SEC}s \
    --data '{
        "order_id": "{{.RequestNumber}}",
        "market_id": "'"$MARKET_ID"'",
        "side": 0,
        "order_type": 0,
        "price": "50.0",
        "quantity": "1.0",
        "user_id": "user-{{.RequestNumber}}",
        "timestamp_ns": {{.UnixNano}}
    }' \
    $ENGINE_ADDR

echo "Load test completed!"

