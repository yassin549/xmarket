# Matching Engine

High-performance, low-latency orderbook matching engine for Xmarket. Capable of handling 10k+ orders/sec with deterministic event logging and replay capabilities.

## Features

- **High Performance**: Lock-free data structures, atomic operations, optimized for low latency
- **Order Types**: Limit, Market, and IOC (Immediate or Cancel) orders
- **Deterministic Logging**: Write-Ahead Log (WAL) for complete audit trail
- **Snapshot Support**: Periodic snapshots to disk and S3-compatible storage
- **Replay Tool**: Reconstruct orderbook state from WAL for auditing
- **gRPC API**: High-performance gRPC interface for order placement and management
- **Horizontal Scaling**: Stateless design allows multiple instances

## Architecture

- **Orderbook**: Price-time priority orderbook using BTreeMap for efficient price level ordering
- **Matching Engine**: Deterministic matching logic with immediate execution
- **WAL**: Write-Ahead Log ensures all events are persisted before acknowledgment
- **Snapshots**: Periodic snapshots for fast recovery and state reconstruction

## Building

```bash
# Build the matching engine
cargo build --release

# Build the replay tool
cargo build --release --bin replay-tool
```

## Running

```bash
# Set environment variables
export WAL_PATH=./data/wal.log
export SNAPSHOT_DIR=./data/snapshots
export LISTEN_ADDR=0.0.0.0:50051

# Run the engine
cargo run --release
```

## Docker

```bash
# Build Docker image
docker build -t matching-engine .

# Run container
docker run -p 50051:50051 \
  -v $(pwd)/data:/app/data \
  matching-engine
```

## Kubernetes

```bash
# Install with Helm
helm install matching-engine ./helm-chart

# Or with custom values
helm install matching-engine ./helm-chart -f custom-values.yaml
```

## Load Testing

```bash
# Install ghz (gRPC load testing tool)
go install github.com/bojand/ghz@latest

# Run load test (10k orders/sec)
./tools/loadtest/run.sh

# Or manually
ghz --proto proto/orders.proto \
    --call matching_engine.OrderService.PlaceOrder \
    --insecure \
    --connections 10 \
    --concurrency 100 \
    --rps 10000 \
    --duration 10s \
    localhost:50051
```

## Replay Tool

Reconstruct orderbook state from WAL:

```bash
# Replay WAL and generate snapshot
cargo run --release --bin replay-tool \
  -- --wal ./data/wal.log \
  --market-id test-market-1 \
  --output ./data/reconstructed.bin

# Compare with existing snapshot
cargo run --release --bin replay-tool \
  -- --wal ./data/wal.log \
  --market-id test-market-1 \
  --snapshot ./data/snapshot.bin
```

## gRPC API

### PlaceOrder

Place a new order (limit, market, or IOC).

```protobuf
rpc PlaceOrder(PlaceOrderRequest) returns (PlaceOrderResponse);
```

### CancelOrder

Cancel an existing order.

```protobuf
rpc CancelOrder(CancelOrderRequest) returns (CancelOrderResponse);
```

### OrderStatus

Get status of an order.

```protobuf
rpc OrderStatus(OrderStatusRequest) returns (OrderStatusResponse);
```

### Snapshot

Get current orderbook snapshot.

```protobuf
rpc Snapshot(SnapshotRequest) returns (SnapshotResponse);
```

## Performance Targets

- **Throughput**: 10,000+ orders/sec per market
- **Latency**: Median < 10ms, p99 < 100ms
- **Determinism**: WAL replay reconstructs state byte-for-byte

## Testing

```bash
# Run unit tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_matching_logic
```

## Environment Variables

- `WAL_PATH`: Path to WAL file (default: `./data/wal.log`)
- `SNAPSHOT_DIR`: Directory for snapshots (default: `./data/snapshots`)
- `LISTEN_ADDR`: gRPC server address (default: `0.0.0.0:50051`)
- `AWS_ACCESS_KEY_ID`: AWS credentials for S3 (optional)
- `AWS_SECRET_ACCESS_KEY`: AWS credentials for S3 (optional)
- `AWS_REGION`: AWS region for S3 (optional)
- `S3_BUCKET`: S3 bucket for snapshots (optional)

## License

MIT

