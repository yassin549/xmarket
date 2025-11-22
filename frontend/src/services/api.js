/**
 * API Service
 * ===========
 * 
 * Handles all API calls to backend and orderbook services.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const ORDERBOOK_URL = import.meta.env.VITE_ORDERBOOK_URL || 'http://localhost:8001';

/**
 * Fetch all stocks
 */
export async function fetchStocks() {
  const response = await fetch(`${BACKEND_URL}/api/v1/stocks`);
  if (!response.ok) {
    throw new Error('Failed to fetch stocks');
  }
  return response.json();
}

/**
 * Fetch score for a symbol
 */
export async function fetchScore(symbol) {
  const response = await fetch(`${BACKEND_URL}/api/v1/scores/${symbol}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch score for ${symbol}`);
  }
  return response.json();
}

/**
 * Fetch recent events for a symbol
 */
export async function fetchEvents(symbol, limit = 20) {
  const response = await fetch(`${BACKEND_URL}/api/v1/events/${symbol}?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch events for ${symbol}`);
  }
  return response.json();
}

/**
 * Fetch market pressure
 */
export async function fetchMarketPressure(symbol) {
  const response = await fetch(`${ORDERBOOK_URL}/market/${symbol}/pressure`);
  if (!response.ok) {
    throw new Error(`Failed to fetch market pressure for ${symbol}`);
  }
  return response.json();
}

/**
 * Fetch orderbook snapshot
 */
export async function fetchOrderbook(symbol) {
  const response = await fetch(`${ORDERBOOK_URL}/market/${symbol}/snapshot`);
  if (!response.ok) {
    throw new Error(`Failed to fetch orderbook for ${symbol}`);
  }
  return response.json();
}

/**
 * Place an order
 */
export async function placeOrder(order) {
  const response = await fetch(`${ORDERBOOK_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(order),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to place order');
  }
  
  return response.json();
}

/**
 * Cancel an order
 */
export async function cancelOrder(symbol, orderId) {
  const response = await fetch(`${ORDERBOOK_URL}/cancel?symbol=${symbol}&order_id=${orderId}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error('Failed to cancel order');
  }
  
  return response.json();
}

/**
 * Fetch score history (for charts)
 */
export async function fetchScoreHistory(symbol, hours = 24) {
  const response = await fetch(`${BACKEND_URL}/api/v1/scores/${symbol}/history?hours=${hours}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch score history for ${symbol}`);
  }
  return response.json();
}
