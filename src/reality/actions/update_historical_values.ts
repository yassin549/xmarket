import { query } from '../../infra/db/pool';

/**
 * Update historical values with new reality value
 * Tracks reality value changes + buyer/seller pressure
 * 
 * @param variableId - Variable to update
 * @param realityValue - New reality value from LLM analysis
 */
export async function updateHistoricalValues(
  variableId: string,
  realityValue: number
): Promise<void> {
  // 1. Calculate buyer/seller metrics (for volume profile)
  // Since trades table doesn't have side, we join with orders to find unique users
  // Total volume is just sum of quantity (buy vol = sell vol in double auction)

  const volumeData = await query(`
    WITH recent_trades AS (
      SELECT buyer_order_id, seller_order_id, quantity
      FROM trades
      WHERE variable_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
    ),
    buyers AS (
      SELECT DISTINCT o.user_id
      FROM recent_trades t
      JOIN orders o ON t.buyer_order_id = o.order_id
    ),
    sellers AS (
      SELECT DISTINCT o.user_id
      FROM recent_trades t
      JOIN orders o ON t.seller_order_id = o.order_id
    )
    SELECT 
      COALESCE(SUM(quantity), 0) as total_volume,
      (SELECT COUNT(*) FROM buyers) as unique_buyers_24h,
      (SELECT COUNT(*) FROM sellers) as unique_sellers_24h,
      COUNT(*) as trade_count
    FROM recent_trades
  `, [variableId]);

  const vol = volumeData.rows[0];
  const totalVolume = parseFloat(vol.total_volume);

  // 2. Calculate price changes
  const changeData = await query(`
    SELECT 
      reality_value as prev_1h,
      (SELECT reality_value FROM historical_values 
       WHERE variable_id = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
       ORDER BY timestamp ASC LIMIT 1) as prev_24h,
      (SELECT reality_value FROM historical_values 
       WHERE variable_id = $1 AND timestamp >= NOW() - INTERVAL '7 days'
       ORDER BY timestamp ASC LIMIT 1) as prev_7d
    FROM historical_values
    WHERE variable_id = $1 AND timestamp >= NOW() - INTERVAL '1 hour'
    ORDER BY timestamp DESC LIMIT 1
  `, [variableId]);

  const prev = changeData.rows[0] || {};
  const change1h = prev.prev_1h ? ((realityValue - parseFloat(prev.prev_1h)) / parseFloat(prev.prev_1h)) * 100 : 0;
  const change24h = prev.prev_24h ? ((realityValue - parseFloat(prev.prev_24h)) / parseFloat(prev.prev_24h)) * 100 : 0;
  const change7d = prev.prev_7d ? ((realityValue - parseFloat(prev.prev_7d)) / parseFloat(prev.prev_7d)) * 100 : 0;

  // 3. Insert historical snapshot
  await query(`
    INSERT INTO historical_values (
      variable_id, reality_value,
      buy_volume_24h, sell_volume_24h,
      unique_buyers_24h, unique_sellers_24h,
      buy_orders_24h, sell_orders_24h,
      change_1h, change_24h, change_7d,
      snapshot_type, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'reality_update', NOW())
  `, [
    variableId, realityValue,
    totalVolume, totalVolume, // Buy vol = Sell vol
    vol.unique_buyers_24h, vol.unique_sellers_24h,
    vol.trade_count, vol.trade_count, // Using trade count as proxy for order count for now
    change1h, change24h, change7d
  ]);

  // 4. Update variable's current reality value
  await query(`
    UPDATE variables SET reality_value = $1, updated_at = NOW()
    WHERE variable_id = $2
  `, [realityValue, variableId]);

  console.log(`[HistoricalValues] Snapshot: Reality=${realityValue.toFixed(2)}, Vol=${totalVolume}`);
}
