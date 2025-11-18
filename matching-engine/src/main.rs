mod orderbook;
mod matching;
mod wal;
mod snapshot;
mod types;

use anyhow::Result;
use matching_engine::orderbook::OrderbookSnapshot;
use matching_engine::types::{Order, OrderSide, OrderType, SequenceGenerator, TimestampGenerator};
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tonic::{transport::Server, Request, Response, Status};
use tracing::{info, error};
use uuid::Uuid;

// Include generated protobuf code
pub mod proto {
    tonic::include_proto!("matching_engine");
}

use proto::order_service_server::{OrderService, OrderServiceServer};
use proto::*;

/// Main matching engine service
struct MatchingEngineService {
    engines: Arc<RwLock<HashMap<String, Arc<matching::MatchingEngine>>>>,
    wal: Arc<wal::WAL>,
    snapshot_manager: Arc<snapshot::SnapshotManager>,
}

impl MatchingEngineService {
    async fn new(wal_path: &str, snapshot_dir: &str) -> Result<Self> {
        Ok(Self {
            engines: Arc::new(RwLock::new(HashMap::new())),
            wal: Arc::new(wal::WAL::open(wal_path).await?),
            snapshot_manager: Arc::new(snapshot::SnapshotManager::new(snapshot_dir)),
        })
    }

    async fn get_or_create_engine(&self, market_id: &str) -> Arc<matching::MatchingEngine> {
        let mut engines = self.engines.write().await;
        
        if let Some(engine) = engines.get(market_id) {
            return engine.clone();
        }

        // Create new engine
        let engine = Arc::new(matching::MatchingEngine::new(
            market_id.to_string(),
            0, // Initial sequence
        ));
        engines.insert(market_id.to_string(), engine.clone());
        engine
    }

    fn order_to_proto(&self, order: &Order) -> OrderStatusResponse {
        OrderStatusResponse {
            order_id: order.id.to_string(),
            status: match order.status {
                types::OrderStatus::Pending => order_status::Status::Pending as i32,
                types::OrderStatus::PartiallyFilled => order_status::Status::PartiallyFilled as i32,
                types::OrderStatus::Filled => order_status::Status::Filled as i32,
                types::OrderStatus::Cancelled => order_status::Status::Cancelled as i32,
                types::OrderStatus::Rejected => order_status::Status::Rejected as i32,
            },
            remaining_quantity: order.remaining_quantity.to_string(),
            filled_quantity: order.filled_quantity.to_string(),
            average_fill_price: "0".to_string(), // TODO: Calculate average
            trades: vec![],
        }
    }
}

#[tonic::async_trait]
impl OrderService for MatchingEngineService {
    async fn place_order(
        &self,
        request: Request<PlaceOrderRequest>,
    ) -> Result<Response<PlaceOrderResponse>, Status> {
        let req = request.into_inner();
        
        // Parse request
        let order_id = Uuid::parse_str(&req.order_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid order_id: {}", e)))?;
        
        let price = if req.price.is_empty() {
            None
        } else {
            Some(
                Decimal::from_str_exact(&req.price)
                    .map_err(|e| Status::invalid_argument(format!("Invalid price: {}", e)))?
            )
        };

        let quantity = Decimal::from_str_exact(&req.quantity)
            .map_err(|e| Status::invalid_argument(format!("Invalid quantity: {}", e)))?;

        let side = match req.side() {
            order_side::Side::Buy => OrderSide::Buy,
            order_side::Side::Sell => OrderSide::Sell,
        };

        let order_type = match req.order_type() {
            OrderType::Limit => OrderType::Limit,
            OrderType::Market => OrderType::Market,
            OrderType::Ioc => OrderType::IOC,
        };

        // Validate
        if order_type == OrderType::Limit && price.is_none() {
            return Err(Status::invalid_argument("Limit orders require price"));
        }

        // Create order
        let engine = self.get_or_create_engine(&req.market_id).await;
        let sequence = engine.current_sequence() + 1;
        
        let order = Order::new(
            order_id,
            req.market_id.clone(),
            req.user_id,
            side,
            order_type,
            price,
            quantity,
            req.timestamp_ns,
            sequence,
        );

        // Match order
        let (trades, remaining_order, events) = engine.match_order(order);

        // Write events to WAL
        for event in &events {
            if let Err(e) = self.wal.append(event.clone()).await {
                error!("Failed to write to WAL: {}", e);
                return Err(Status::internal("Failed to persist order"));
            }
        }

        // Convert trades to proto
        let proto_trades: Vec<Trade> = trades
            .iter()
            .map(|t| Trade {
                trade_id: t.id.to_string(),
                order_id: t.taker_order_id.to_string(),
                market_id: t.market_id.clone(),
                side: match t.side {
                    OrderSide::Buy => order_side::Side::Buy as i32,
                    OrderSide::Sell => order_side::Side::Sell as i32,
                },
                price: t.price.to_string(),
                quantity: t.quantity.to_string(),
                timestamp_ns: t.timestamp_ns,
                sequence_number: t.sequence_number,
                taker_order_id: t.taker_order_id.to_string(),
                maker_order_id: t.maker_order_id.to_string(),
            })
            .collect();

        let remaining_qty = remaining_order
            .as_ref()
            .map(|o| o.remaining_quantity.to_string())
            .unwrap_or_else(|| "0".to_string());

        let status = if remaining_order.is_none() {
            order_status::Status::Filled as i32
        } else if !proto_trades.is_empty() {
            order_status::Status::PartiallyFilled as i32
        } else {
            order_status::Status::Pending as i32
        };

        Ok(Response::new(PlaceOrderResponse {
            order_id: req.order_id,
            status,
            trades: proto_trades,
            remaining_quantity: remaining_qty,
            sequence_number: sequence,
        }))
    }

    async fn cancel_order(
        &self,
        request: Request<CancelOrderRequest>,
    ) -> Result<Response<CancelOrderResponse>, Status> {
        let req = request.into_inner();
        
        let order_id = Uuid::parse_str(&req.order_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid order_id: {}", e)))?;

        let engine = self.get_or_create_engine(&req.market_id).await;
        
        if let Some(event) = engine.cancel_order(order_id, &req.market_id) {
            // Write to WAL
            if let Err(e) = self.wal.append(event.clone()).await {
                error!("Failed to write to WAL: {}", e);
                return Err(Status::internal("Failed to persist cancellation"));
            }

            Ok(Response::new(CancelOrderResponse {
                order_id: req.order_id,
                success: true,
                message: "Order cancelled".to_string(),
                sequence_number: event.sequence_number(),
            }))
        } else {
            Ok(Response::new(CancelOrderResponse {
                order_id: req.order_id,
                success: false,
                message: "Order not found".to_string(),
                sequence_number: 0,
            }))
        }
    }

    async fn order_status(
        &self,
        request: Request<OrderStatusRequest>,
    ) -> Result<Response<OrderStatusResponse>, Status> {
        let req = request.into_inner();
        
        let order_id = Uuid::parse_str(&req.order_id)
            .map_err(|e| Status::invalid_argument(format!("Invalid order_id: {}", e)))?;

        let engine = self.get_or_create_engine(&req.market_id).await;
        
        if let Some(order) = engine.orderbook().get_order(&order_id) {
            Ok(Response::new(self.order_to_proto(&order)))
        } else {
            Err(Status::not_found("Order not found"))
        }
    }

    async fn snapshot(
        &self,
        request: Request<SnapshotRequest>,
    ) -> Result<Response<SnapshotResponse>, Status> {
        let req = request.into_inner();
        
        let engine = self.get_or_create_engine(&req.market_id).await;
        let snapshot = engine.orderbook().snapshot(20); // Top 20 levels

        let bids: Vec<OrderLevel> = snapshot
            .bids
            .iter()
            .map(|l| OrderLevel {
                price: l.price.to_string(),
                total_quantity: l.total_quantity.to_string(),
                order_count: l.order_count as i32,
            })
            .collect();

        let asks: Vec<OrderLevel> = snapshot
            .asks
            .iter()
            .map(|l| OrderLevel {
                price: l.price.to_string(),
                total_quantity: l.total_quantity.to_string(),
                order_count: l.order_count as i32,
            })
            .collect();

        Ok(Response::new(SnapshotResponse {
            market_id: req.market_id,
            sequence_number: engine.current_sequence(),
            bids,
            asks,
            timestamp_ns: TimestampGenerator::now_ns(),
        }))
    }

    type StreamUpdatesStream = tonic::codegen::futures_core::stream::BoxStream<'static, Result<OrderbookUpdate, Status>>;

    async fn stream_updates(
        &self,
        _request: Request<StreamUpdatesRequest>,
    ) -> Result<Response<Self::StreamUpdatesStream>, Status> {
        // TODO: Implement streaming updates
        Err(Status::unimplemented("Streaming not yet implemented"))
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let wal_path = std::env::var("WAL_PATH").unwrap_or_else(|_| "./data/wal.log".to_string());
    let snapshot_dir = std::env::var("SNAPSHOT_DIR").unwrap_or_else(|_| "./data/snapshots".to_string());
    let addr = std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:50051".to_string())
        .parse()
        .expect("Invalid address");

    info!("Starting matching engine server on {}", addr);
    info!("WAL path: {}", wal_path);
    info!("Snapshot dir: {}", snapshot_dir);

    let service = MatchingEngineService::new(&wal_path, &snapshot_dir).await?;

    Server::builder()
        .add_service(OrderServiceServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}

