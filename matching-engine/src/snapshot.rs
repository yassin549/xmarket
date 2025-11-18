use crate::orderbook::OrderbookSnapshot;
use crate::types::Event;
use anyhow::{Context, Result};
use bincode::{deserialize, serialize};
use tokio::fs;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Snapshot of orderbook state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub market_id: String,
    pub sequence_number: i64,
    pub timestamp_ns: i64,
    pub orderbook: OrderbookSnapshot,
    pub active_orders: Vec<crate::types::Order>,
}

/// Snapshot manager for persisting and loading snapshots
pub struct SnapshotManager {
    snapshot_dir: PathBuf,
}

impl SnapshotManager {
    pub fn new<P: AsRef<Path>>(snapshot_dir: P) -> Self {
        Self {
            snapshot_dir: snapshot_dir.as_ref().to_path_buf(),
        }
    }

    /// Save snapshot to disk
    pub async fn save(&self, snapshot: &Snapshot) -> Result<PathBuf> {
        // Create snapshot directory if it doesn't exist
        fs::create_dir_all(&self.snapshot_dir).await?;

        // Generate snapshot filename
        let filename = format!(
            "snapshot_{}_{}.bin",
            snapshot.market_id, snapshot.sequence_number
        );
        let file_path = self.snapshot_dir.join(filename);

        // Serialize and write
        let bytes = serialize(snapshot)?;
        fs::write(&file_path, bytes).await?;

        Ok(file_path)
    }

    /// Load snapshot from disk
    pub async fn load<P: AsRef<Path>>(&self, path: P) -> Result<Snapshot> {
        let bytes = fs::read(path).await?;
        let snapshot: Snapshot = deserialize(&bytes)?;
        Ok(snapshot)
    }

    /// Find latest snapshot for a market
    pub async fn find_latest(&self, market_id: &str) -> Result<Option<Snapshot>> {
        let mut latest: Option<Snapshot> = None;
        let mut latest_seq = i64::MIN;

        let mut entries = fs::read_dir(&self.snapshot_dir).await?;
        
        while let Some(entry) = entries.next().await {
            let entry = entry?;
            let path = entry.path();
            
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                if filename.starts_with(&format!("snapshot_{}_", market_id))
                    && filename.ends_with(".bin")
                {
                    if let Ok(snapshot) = self.load(&path).await {
                        if snapshot.sequence_number > latest_seq {
                            latest_seq = snapshot.sequence_number;
                            latest = Some(snapshot);
                        }
                    }
                }
            }
        }

        Ok(latest)
    }

    /// Save snapshot to S3-compatible storage
    pub async fn save_to_s3(
        &self,
        snapshot: &Snapshot,
        bucket: &str,
        s3_client: &aws_sdk_s3::Client,
    ) -> Result<String> {
        let key = format!(
            "snapshots/{}/{}_{}.bin",
            snapshot.market_id, snapshot.market_id, snapshot.sequence_number
        );

        let bytes = serialize(snapshot)?;

        s3_client
            .put_object()
            .bucket(bucket)
            .key(&key)
            .body(aws_sdk_s3::primitives::ByteStream::from(bytes))
            .send()
            .await
            .context("Failed to upload snapshot to S3")?;

        Ok(key)
    }

    /// Load snapshot from S3-compatible storage
    pub async fn load_from_s3(
        &self,
        bucket: &str,
        key: &str,
        s3_client: &aws_sdk_s3::Client,
    ) -> Result<Snapshot> {
        let response = s3_client
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .context("Failed to download snapshot from S3")?;

        let bytes = response
            .body
            .collect()
            .await
            .context("Failed to read S3 response body")?
            .into_bytes();

        let snapshot: Snapshot = deserialize(&bytes)?;
        Ok(snapshot)
    }
}

