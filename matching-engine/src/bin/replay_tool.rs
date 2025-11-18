use anyhow::{Context, Result};
use clap::Parser;
use matching_engine::wal::WAL;
use matching_engine::types::{Event, Order, OrderSide, OrderType};
use matching_engine::matching::MatchingEngine;
use matching_engine::orderbook::OrderbookSnapshot;
use rust_decimal::Decimal;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Parser)]
#[command(name = "replay-tool")]
#[command(about = "Replay WAL events to reconstruct orderbook state")]
struct Args {
    /// Path to WAL file
    #[arg(short, long)]
    wal: PathBuf,

    /// Path to snapshot file (optional, for comparison)
    #[arg(short, long)]
    snapshot: Option<PathBuf>,

    /// Market ID to replay
    #[arg(short, long)]
    market_id: String,

    /// Output reconstructed snapshot
    #[arg(short, long)]
    output: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    println!("Replaying WAL: {:?}", args.wal);
    println!("Market ID: {}", args.market_id);

    // Open WAL
    let wal = WAL::open(&args.wal).await?;
    let entries = wal.read_all().await?;

    println!("Found {} events in WAL", entries.len());

    // Create matching engine to replay events
    let engine = MatchingEngine::new(args.market_id.clone(), 0);

    // Replay all events
    let mut order_count = 0;
    let mut trade_count = 0;
    let mut cancel_count = 0;

    for entry in entries {
        match &entry.event {
            Event::OrderPlaced { order, .. } => {
                order_count += 1;
                let (trades, _, _) = engine.match_order(order.clone());
                trade_count += trades.len();
            }
            Event::OrderCancelled { order_id, .. } => {
                cancel_count += 1;
                engine.cancel_order(*order_id, &args.market_id);
            }
            Event::TradeExecuted { trade, .. } => {
                trade_count += 1;
                // Trade already executed, just verify
            }
        }
    }

    println!("\nReplay Summary:");
    println!("  Orders placed: {}", order_count);
    println!("  Orders cancelled: {}", cancel_count);
    println!("  Trades executed: {}", trade_count);
    println!("  Final sequence: {}", engine.current_sequence());

    // Get final orderbook snapshot
    let snapshot = engine.orderbook().snapshot(20);
    
    println!("\nFinal Orderbook State:");
    println!("  Bids: {} levels", snapshot.bids.len());
    println!("  Asks: {} levels", snapshot.asks.len());

    if let Some(best_bid) = engine.orderbook().best_bid() {
        println!("  Best bid: {}", best_bid);
    }
    if let Some(best_ask) = engine.orderbook().best_ask() {
        println!("  Best ask: {}", best_ask);
    }

    // Output snapshot if requested
    if let Some(output_path) = args.output {
        let snapshot_data = matching_engine::snapshot::Snapshot {
            market_id: args.market_id,
            sequence_number: engine.current_sequence(),
            timestamp_ns: chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0),
            orderbook: snapshot,
            active_orders: vec![], // TODO: Collect active orders
        };

        let bytes = bincode::serialize(&snapshot_data)?;
        tokio::fs::write(&output_path, bytes).await?;
        println!("\nSnapshot written to: {:?}", output_path);
    }

    // Compare with provided snapshot if given
    if let Some(snapshot_path) = args.snapshot {
        println!("\nComparing with snapshot: {:?}", snapshot_path);
        // TODO: Load and compare snapshots
        println!("  (Comparison not yet implemented)");
    }

    println!("\nReplay completed successfully!");
    Ok(())
}

