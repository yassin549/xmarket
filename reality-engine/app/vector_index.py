"""
FAISS vector index with TTL eviction.
Maintains windowed index of article embeddings for deduplication.
"""
import faiss
import numpy as np
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import constants

logger = logging.getLogger(__name__)


class VectorIndex:
    """
    FAISS index wrapper with time-to-live eviction.
    Stores vectors with timestamps and evicts old entries.
    """
    
    def __init__(self, dimension: int = constants.EMBEDDING_DIM):
        self.dimension = dimension
        
        # Create FAISS index (L2 distance, but we use normalized vectors so it's equivalent to cosine)
        self.index = faiss.IndexFlatL2(dimension)
        
        # Metadata storage
        self.ids: List[str] = []  # Document IDs
        self.timestamps: List[datetime] = []  # Insertion timestamps
        
        logger.info(f"Initialized FAISS index with dimension {dimension}")
    
    def add_vector(self, doc_id: str, vector: np.ndarray, timestamp: Optional[datetime] = None):
        """
        Add vector to index.
        
        Args:
            doc_id: Unique document identifier
            vector: Normalized embedding vector (384,)
            timestamp: Insertion timestamp (defaults to now)
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        # Ensure vector is 2D for FAISS
        if vector.ndim == 1:
            vector = vector.reshape(1, -1)
        
        # Add to index
        self.index.add(vector.astype(np.float32))
        self.ids.append(doc_id)
        self.timestamps.append(timestamp)
        
        logger.debug(f"Added vector for {doc_id} to index. Total: {len(self.ids)}")
    
    def query_vector(self, vector: np.ndarray, k: int = 5) -> List[Tuple[str, float]]:
        """
        Query index for similar vectors.
        
        Args:
            vector: Query vector (384,)
            k: Number of nearest neighbors
        
        Returns:
            List of (doc_id, similarity) tuples
        """
        if len(self.ids) == 0:
            return []
        
        # Ensure vector is 2D
        if vector.ndim == 1:
            vector = vector.reshape(1, -1)
        
        # Search
        k = min(k, len(self.ids))
        distances, indices = self.index.search(vector.astype(np.float32), k)
        
        # Convert L2 distances to cosine similarity
        # For normalized vectors: similarity = 1 - (L2_distance^2 / 2)
        similarities = 1 - (distances[0] ** 2 / 2)
        
        # Build results
        results = []
        for idx, sim in zip(indices[0], similarities):
            if idx < len(self.ids):  # Valid index
                results.append((self.ids[idx], float(sim)))
        
        return results
    
    def evict_older_than(self, seconds: int):
        """
        Evict vectors older than specified seconds.
        
        Args:
            seconds: Age threshold in seconds
        """
        cutoff = datetime.utcnow() - timedelta(seconds=seconds)
        
        # Find indices to keep
        keep_indices = [
            i for i, ts in enumerate(self.timestamps)
            if ts >= cutoff
        ]
        
        if len(keep_indices) == len(self.ids):
            return  # Nothing to evict
        
        evicted_count = len(self.ids) - len(keep_indices)
        
        # Rebuild index with kept vectors
        if keep_indices:
            # Extract vectors to keep
            all_vectors = faiss.rev_swig_ptr(self.index.get_xb(), self.index.ntotal * self.dimension)
            all_vectors = np.array(all_vectors).reshape(self.index.ntotal, self.dimension)
            
            kept_vectors = all_vectors[keep_indices]
            kept_ids = [self.ids[i] for i in keep_indices]
            kept_timestamps = [self.timestamps[i] for i in keep_indices]
            
            # Reset index
            self.index.reset()
            self.ids = []
            self.timestamps = []
            
            # Re-add kept vectors
            if len(kept_vectors) > 0:
                self.index.add(kept_vectors.astype(np.float32))
                self.ids = kept_ids
                self.timestamps = kept_timestamps
        else:
            # Evict all
            self.index.reset()
            self.ids = []
            self.timestamps = []
        
        logger.info(f"Evicted {evicted_count} vectors older than {seconds}s. Remaining: {len(self.ids)}")
    
    def size(self) -> int:
        """Get number of vectors in index."""
        return len(self.ids)
    
    def clear(self):
        """Clear entire index."""
        self.index.reset()
        self.ids = []
        self.timestamps = []
        logger.info("Cleared vector index")


# Global index instance
_vector_index = None


def get_vector_index() -> VectorIndex:
    """Get or create global vector index."""
    global _vector_index
    if _vector_index is None:
        _vector_index = VectorIndex()
    return _vector_index
