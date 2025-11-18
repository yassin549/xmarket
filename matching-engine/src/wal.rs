use crate::types::Event;
use anyhow::{Context, Result};
use bincode::{deserialize, serialize};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufWriter};
use tokio::sync::Mutex;

/// Write-Ahead Log for deterministic event logging
pub struct WAL {
    file_path: PathBuf,
    writer: Mutex<BufWriter<File>>,
    sequence_number: Mutex<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WALEntry {
    sequence_number: i64,
    timestamp_ns: i64,
    event: Event,
    checksum: u32, // Simple checksum for integrity
}

impl WAL {
    /// Create or open WAL file
    pub async fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        
        // Create parent directory if it doesn't exist
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .await
            .with_context(|| format!("Failed to open WAL file: {:?}", path))?;

        let writer = BufWriter::new(file);
        
        // Determine initial sequence number from existing entries
        let initial_seq = Self::read_last_sequence(path).await.unwrap_or(0);

        Ok(Self {
            file_path: path.to_path_buf(),
            writer: Mutex::new(writer),
            sequence_number: Mutex::new(initial_seq),
        })
    }

    /// Read last sequence number from WAL file
    async fn read_last_sequence<P: AsRef<Path>>(path: P) -> Option<i64> {
        let file = tokio::fs::File::open(path).await.ok()?;
        let mut reader = tokio::io::BufReader::new(file);
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer).await.ok()?;

        // Read entries from end to find last sequence
        let mut pos = buffer.len();
        let mut last_seq = None;

        // Try to read last entry (simple approach: read from end)
        // In production, you'd want a more robust approach
        while pos > 0 {
            pos = pos.saturating_sub(1);
            if let Ok(entry) = deserialize::<WALEntry>(&buffer[pos..]) {
                last_seq = Some(entry.sequence_number);
                break;
            }
        }

        last_seq
    }

    /// Append event to WAL
    pub async fn append(&self, event: Event) -> Result<i64> {
        let mut seq = self.sequence_number.lock().await;
        *seq += 1;
        let sequence_number = *seq;

        let timestamp_ns = event.timestamp_ns();
        
        // Calculate simple checksum
        let event_bytes = serialize(&event)?;
        let checksum = crc32fast::hash(&event_bytes);

        let entry = WALEntry {
            sequence_number,
            timestamp_ns,
            event,
            checksum,
        };

        let entry_bytes = serialize(&entry)?;
        let len_bytes = (entry_bytes.len() as u64).to_le_bytes();

        let mut writer = self.writer.lock().await;
        
        // Write length prefix
        writer.write_all(&len_bytes).await?;
        // Write entry
        writer.write_all(&entry_bytes).await?;
        // Flush to ensure durability
        writer.flush().await?;

        Ok(sequence_number)
    }

    /// Read all events from WAL
    pub async fn read_all(&self) -> Result<Vec<WALEntry>> {
        let file = tokio::fs::File::open(&self.file_path).await?;
        let mut reader = tokio::io::BufReader::new(file);
        let mut entries = Vec::new();

        loop {
            // Read length prefix
            let mut len_bytes = [0u8; 8];
            match reader.read_exact(&mut len_bytes).await {
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
                Err(e) => return Err(e.into()),
            }

            let len = u64::from_le_bytes(len_bytes) as usize;
            
            // Read entry
            let mut entry_bytes = vec![0u8; len];
            reader.read_exact(&mut entry_bytes).await?;

            // Verify checksum
            let entry: WALEntry = deserialize(&entry_bytes)?;
            let event_bytes = serialize(&entry.event)?;
            let expected_checksum = crc32fast::hash(&event_bytes);
            
            if entry.checksum != expected_checksum {
                anyhow::bail!("Checksum mismatch for entry {}", entry.sequence_number);
            }

            entries.push(entry);
        }

        Ok(entries)
    }

    /// Get current sequence number
    pub async fn current_sequence(&self) -> i64 {
        *self.sequence_number.lock().await
    }
}

// Add crc32fast to Cargo.toml dependencies
// crc32fast = "1.3"

