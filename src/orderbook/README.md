# Orderbook Service

Low-latency matching engine with Write-Ahead Log (WAL) for durability.

## Features

- **Price-Time Priority Matching**: Orders matched by best price, then timestamp
- **Write-Ahead Log**: Crash recovery with configurable fsync
- **Snapshot Recovery**: Periodic state saves for faster startup
- **REST API**: Simple HTTP endpoints for order management

## API Endpoints

### POST /order
Place a new order.

**Request:**
```json
{
  "user_id": "alice",
  "symbol": "BTC-USD",
  "side": "buy",
  "type": "limit",
  "price": 50000,
  "quantity": 1.5
}
```

**Response:**
```json
{
  "server_order_id": "uuid",
  "status": "filled",
  "matched": true,
  "trades": [...],
  "sequence_number": 12345
}
```

### POST /cancel
Cancel an existing order.

**Request:**
```json
{
  "order_id": "uuid",
  "symbol": "BTC-USD"
}
```

### GET /snapshot?symbol=BTC-USD
Get current orderbook state.

**Response:**
```json
{
  "symbol": "BTC-USD",
  "bids": [[50000, 1.5], [49999, 2.0]],
  "asks": [[50001, 1.0]],
  "last_sequence": 12345
}
```

### GET /health
Health check endpoint.

## Configuration

Environment variables:

```bash
ORDERBOOK_PORT=3001
ORDERBOOK_WAL_PATH=/var/data/wal/orderbook.wal
FSYNC_EVERY_N=1  # production (sync every write)
SNAPSHOT_INTERVAL_MS=10000  # 10 seconds
```

## Running Locally

```bash
npm install
npm run dev
```

## Running Tests

```bash
npm test
```

## Deployment (Render)

1. Push code to GitHub
2. Create new Web Service on Render
3. Configure persistent disk at `/var/data` (10GB)
4. Set environment variables
5. Deploy

See `render.yaml` for full configuration.
