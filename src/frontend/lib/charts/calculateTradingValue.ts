/**
 * Chart Blender - Calculate Trading Values
 * 
 * Blends Reality Chart and Market Chart to create the Trading Chart.
 * Formula: Trading Value = mean(Reality Value, Market Value)
 */

import { query } from '@/lib/infra/db/pool';

interface Variable {
    variable_id: string;
    symbol: string;
    reality_value: number | null;
    market_value: number | null;
    trading_value: number | null;
    initial_value: number;
}

interface TradingValueUpdate {
    variableId: string;
    symbol: string;
    realityValue: number;
    marketValue: number;
    tradingValue: number;
    previousTradingValue: number | null;
    change: number;
    changePercent: number;
}

/**
 * Calculate market value from orderbook
 * Returns mid-price between best bid and best ask
 */
export async function calculateMarketValue(variableId: string): Promise<number | null> {
    // Get best bid and ask from orderbook
    const result = await query<{ best_bid: number | null; best_ask: number | null }>(
        `SELECT 
      MAX(CASE WHEN side = 'buy' THEN price END) as best_bid,
      MIN(CASE WHEN side = 'sell' THEN price END) as best_ask
    FROM orders
    WHERE variable_id = $1 
      AND status IN ('pending', 'partially_filled')
      AND order_type = 'limit'`,
        [variableId]
    );

    const { best_bid, best_ask } = result.rows[0] || {};

    if (!best_bid && !best_ask) {
        // No orders in orderbook
        return null;
    }

    if (!best_bid) {
        // Only asks, return lowest ask
        return best_ask!;
    }

    if (!best_ask) {
        // Only bids, return highest bid
        return best_bid;
    }

    // Both exist, return mid-price
    return (best_bid + best_ask) / 2;
}

/**
 * Calculate trading value (blended value)
 * If market value doesn't exist (no orders), use reality value only
 */
export async function calculateTradingValue(
    variableId: string
): Promise<TradingValueUpdate> {
    // Get variable
    const varResult = await query<Variable>(
        `SELECT 
      variable_id,
      symbol,
      reality_value,
      market_value,
      trading_value,
      initial_value
    FROM variables
    WHERE variable_id = $1`,
        [variableId]
    );

    const variable = varResult.rows[0];
    if (!variable) {
        throw new Error(`Variable ${variableId} not found`);
    }

    // Get current market price from orderbook
    const marketValue = await calculateMarketValue(variableId);

    // Use reality value or initial value as fallback
    const realityValue = variable.reality_value || variable.initial_value;

    // Calculate blended trading value
    let tradingValue: number;

    if (marketValue === null) {
        // No market activity, use reality value only
        tradingValue = realityValue;
    } else {
        // Blend reality and market (simple mean)
        tradingValue = (realityValue + marketValue) / 2;
    }

    // Update variable in database
    await query(
        `UPDATE variables
    SET 
      market_value = $1,
      trading_value = $2,
      updated_at = NOW()
    WHERE variable_id = $3`,
        [marketValue, tradingValue, variableId]
    );

    // Store historical snapshot
    await saveHistoricalSnapshot(variableId, realityValue, marketValue, tradingValue);

    // Calculate change
    const previousTradingValue = variable.trading_value;
    const change = previousTradingValue ? tradingValue - previousTradingValue : 0;
    const changePercent = previousTradingValue ? (change / previousTradingValue) * 100 : 0;

    return {
        variableId,
        symbol: variable.symbol,
        realityValue,
        marketValue: marketValue || realityValue, // Show reality if no market
        tradingValue,
        previousTradingValue,
        change,
        changePercent
    };
}

/**
 * Save historical snapshot for charting
 */
async function saveHistoricalSnapshot(
    variableId: string,
    realityValue: number,
    marketValue: number | null,
    tradingValue: number
): Promise<void> {
    await query(
        `INSERT INTO historical_values (
      variable_id,
      reality_value,
      market_value,
      trading_value,
      timestamp
    ) VALUES ($1, $2, $3, $4, NOW())`,
        [variableId, realityValue, marketValue, tradingValue]
    );
}

/**
 * Update all variables' trading values
 */
export async function updateAllTradingValues(): Promise<TradingValueUpdate[]> {
    console.log('[Chart Blender] Updating trading values for all variables...');

    // Get all active variables
    const result = await query<{ variable_id: string }>(
        `SELECT variable_id
    FROM variables
    WHERE status = 'active' AND is_tradeable = true`
    );

    const variables = result.rows;
    console.log(`[Chart Blender] Found ${variables.length} variables to update`);

    const updates: TradingValueUpdate[] = [];

    for (const variable of variables) {
        try {
            const update = await calculateTradingValue(variable.variable_id);
            updates.push(update);
        } catch (error) {
            console.error(`[Chart Blender] Failed to update ${variable.variable_id}:`, error);
        }
    }

    console.log(`[Chart Blender] Updated ${updates.length}/${variables.length} variables`);

    return updates;
}

/**
 * Get three-chart data for a variable
 */
export async function getThreeChartData(variableId: string, timeRange: '1h' | '24h' | '7d' | '30d' = '24h') {
    // Convert time range to SQL interval
    const intervals = {
        '1h': '1 hour',
        '24h': '24 hours',
        '7d': '7 days',
        '30d': '30 days'
    };

    const result = await query(
        `SELECT 
      reality_value,
      market_value,
      trading_value,
      timestamp
    FROM historical_values
    WHERE variable_id = $1
      AND timestamp >= NOW() - INTERVAL '${intervals[timeRange]}'
    ORDER BY timestamp ASC`,
        [variableId]
    );

    return result.rows;
}
