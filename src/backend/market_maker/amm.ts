/**
 * Automated Market Maker (AMM)
 * 
 * Seeds initial liquidity for new markets based on Impact Score.
 * Calculates initial price and places house orders.
 */

import { query } from '../../infra/db/pool';

interface OrderRequest {
    market_id: string;
    user_id: string;
    side: 'buy' | 'sell';
    type: 'limit';
    price: number;
    quantity: number;
    source: string;
}

/**
 * Seed a market with initial liquidity
 */
export async function seedMarket(
    marketId: string,
    symbol: string,
    impactScore: number
) {
    console.log(`[AMM] Seeding market ${symbol} (score: ${impactScore})...`);

    // Convert score (0-100) to normalized price (0.10 to 0.90)
    // Never go to extremes to ensure liquidity
    const normalizedScore = Math.max(10, Math.min(90, impactScore));
    const basePrice = normalizedScore / 100;

    // Spread configuration (50 basis points = 0.5%)
    const SPREAD_BPS = 50;
    const spread = basePrice * (SPREAD_BPS / 10000);

    const bidPrice = Number((basePrice - spread).toFixed(4));
    const askPrice = Number((basePrice + spread).toFixed(4));

    // Liquidity depth (scaled by score)
    const BASE_LIQUIDITY = 1000;
    const liquidityMultiplier = impactScore / 100;
    const liquidity = Math.floor(BASE_LIQUIDITY * liquidityMultiplier);

    // Ensure minimum liquidity
    const finalLiquidity = Math.max(liquidity, 100);

    // Place house bid order
    await placeOrder({
        market_id: marketId,
        user_id: 'system_mm',
        side: 'buy',
        type: 'limit',
        price: bidPrice,
        quantity: finalLiquidity,
        source: 'amm_seed'
    });

    // Place house ask order
    await placeOrder({
        market_id: marketId,
        user_id: 'system_mm',
        side: 'sell',
        type: 'limit',
        price: askPrice,
        quantity: finalLiquidity,
        source: 'amm_seed'
    });

    console.log(`[AMM] ✅ Seeded ${symbol}: Bid=${bidPrice}, Ask=${askPrice}, Qty=${finalLiquidity}`);
}

/**
 * Place an order in the orderbook
 */
async function placeOrder(order: OrderRequest) {
    await query(`
        INSERT INTO orders (
            market_id, user_id, side, type, 
            price, quantity, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
    `, [
        order.market_id,
        order.user_id,
        order.side,
        order.type,
        order.price,
        order.quantity,
        { source: order.source }
    ]);
}
