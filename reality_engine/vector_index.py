"""
FAISS-based vector index for similarity search and deduplication.

Features:
- IndexFlatIP for cosine similarity (with normalized vectors)
- TTL-based eviction (remove old vectors)
- Duplicate detection (similarity > threshold)
- Clustering (find similar vectors)
"""

import numpy as np
import time
from typing import List, Tuple, Optional
import logging

# Import with error handling
try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False
    logging.warning("faiss not installed, vector indexing will be disabled")

logger = logging.getLogger(__name__)


class VectorMetadata:
    """Metadata for a vector in the index."""
    
    def __init__(self, event_id: str, text_hash: str, timestamp: float):
        self.event_id = event_id
        self.text_hash = text_hash
        self.timestamp = timestamp


class VectorIndex:
    """
    FAISS-based vector index with TTL eviction.
    
    Uses IndexFlatIP (inner product) which equals cosine similarity
    when vectors are L2-normalized.
    """
    
    def __init__(self, dimension: int = 384):
        """
        Initialize vector index.
       
        Args:
            dimension: Vector dimension (384 for all-MiniLM-L6-v2)
            
        Raises:
            RuntimeError: If faiss not installed
        """
        if not HAS_FAISS:
            raise RuntimeError("faiss not installed. Install with: pip install faiss-cpu")
        
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension)  # Inner product (cosine with normalized vecs)
        self.metadata: List[VectorMetadata] = []
        
        logger.info(f"Initialized FAISS index (dimension={dimension})")
    
    def add_vector(
        self,
        vector: np.ndarray,
        event_id: str,
        text_hash: str,
        timestamp: Optional[float] = None
    ) -> None:
        """
        Add vector to index with metadata.
        
        Args:
            vector: L2-normalized vector (float32, shape=(dimension,))
            event_id: Event identifier
            text_hash: Hash of source text
            timestamp: Unix timestamp (defaults to now)
        """
        if timestamp is None:
            timestamp = time.time()
        
        # Ensure correct shape
        if vector.ndim == 1:
            vector = vector.reshape(1, -1)
        
        # Add to FAISS index
        self.index.add(vector.astype(np.float32))
        
        # Store metadata
        metadata = VectorMetadata(event_id, text_hash, timestamp)
        self.metadata.append(metadata)
        
        logger.debug(f"Added vector for event {event_id} (total={self.index.ntotal})")
    
    def search_similar(
        self,
        query_vector: np.ndarray,
        k: int = 10,
        min_similarity: float = 0.0
    ) -> List[Tuple[float, str, str]]:
        """
        Search for similar vectors.
        
        Args:
            query_vector: Query vector (L2-normalized)
            k: Number of results
            min_similarity: Minimum similarity threshold
            
        Returns:
            List of (similarity, event_id, text_hash) tuples, sorted by similarity desc
        """
        if self.index.ntotal == 0:
            return []
        
        # Ensure correct shape
        if query_vector.ndim == 1:
            query_vector = query_vector.reshape(1, -1)
        
        # Search (returns distances=similarities and indices)
        similarities, indices = self.index.search(query_vector.astype(np.float32), min(k, self.index.ntotal))
        
        # Build results
        results = []
        for sim, idx in zip(similarities[0], indices[0]):
            if idx < 0:  # FAISS returns -1 for missing results
                continue
            
            if sim < min_similarity:
                continue
            
            metadata = self.metadata[idx]
            results.append((float(sim), metadata.event_id, metadata.text_hash))
        
        return results
    
    def check_duplicate(
        self,
        vector: np.ndarray,
        threshold: float = 0.88
    ) -> bool:
        """
        Check if vector is a duplicate of any existing vector.
        
        Args:
            vector: Query vector
            threshold: Similarity threshold for duplicate (default 0.88)
            
        Returns:
            True if duplicate found, False otherwise
        """
        results = self.search_similar(vector, k=1, min_similarity=threshold)
        return len(results) > 0
    
    def find_groups(
        self,
        vector: np.ndarray,
        threshold: float = 0.78,
        max_results: int = 10
    ) -> List[Tuple[float, str, str]]:
        """
        Find similar vectors for grouping/clustering.
        
        Args:
            vector: Query vector
            threshold: Similarity threshold for grouping (default 0.78)
            max_results: Maximum number of results
            
        Returns:
            List of (similarity, event_id, text_hash) tuples
        """
        return self.search_similar(vector, k=max_results, min_similarity=threshold)
    
    def evict_old_vectors(self, max_age_seconds: float) -> int:
        """
        Remove vectors older than max_age_seconds.
        
        Note: FAISS doesn't support efficient deletion, so we rebuild the index.
        
        Args:
            max_age_seconds: Maximum age in seconds
            
        Returns:
            Number of vectors evicted
        """
        current_time = time.time()
        cutoff_time = current_time - max_age_seconds
        
        # Find indices to keep
        keep_indices = []
        for i, meta in enumerate(self.metadata):
            if meta.timestamp >= cutoff_time:
                keep_indices.append(i)
        
        evicted_count = len(self.metadata) - len(keep_indices)
        
        if evicted_count == 0:
            return 0
        
        # Rebuild index with kept vectors
        old_total = self.index.ntotal
        
        # Extract vectors from old index
        vectors = []
        new_metadata = []
        
        for idx in keep_indices:
            # Reconstruct vector from index
            vector = self.index.reconstruct(int(idx))
            vectors.append(vector)
            new_metadata.append(self.metadata[idx])
        
        # Create new index
        self.index = faiss.IndexFlatIP(self.dimension)
        
        # Add kept vectors
        if vectors:
            vectors_array = np.array(vectors, dtype=np.float32)
            self.index.add(vectors_array)
        
        self.metadata = new_metadata
        
        logger.info(f"Evicted {evicted_count} vectors (kept {len(keep_indices)}/{old_total})")
        return evicted_count
    
    def size(self) -> int:
        """Get number of vectors in index."""
        return self.index.ntotal
    
    def clear(self) -> None:
        """Clear all vectors from index."""
        self.index.reset()
        self.metadata.clear()
        logger.info("Cleared vector index")
