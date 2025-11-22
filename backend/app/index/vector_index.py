import faiss
import numpy as np
from typing import List, Tuple, Dict
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class VectorIndex:
    """
    In-memory FAISS vector index with time-based eviction.
    Uses cosine similarity (inner product on normalized vectors).
    """
    
    def __init__(self, dim: int = 384):
        """
        Initialize FAISS index.
        
        Args:
            dim: Dimension of vectors (384 for all-MiniLM-L6-v2)
        """
        self.dim = dim
        # IndexFlatIP = Inner Product (equivalent to cosine for normalized vectors)
        self.index = faiss.IndexFlatIP(dim)
        self.id_map: List[str] = []  # Maps index position to ID
        self.timestamps: Dict[str, float] = {}  # ID -> timestamp
        
        logger.info(f"Initialized FAISS index with dimension {dim}")
    
    def add_vector(self, id: str, vector: np.ndarray, ts: float = None):
        """
        Add vector to index.
        
        Args:
            id: Unique identifier for this vector
            vector: Normalized embedding vector (dim,)
            ts: Timestamp (defaults to now)
        """
        if ts is None:
            ts = datetime.now(timezone.utc).timestamp()
        
        # Ensure vector is 2D for FAISS
        if vector.ndim == 1:
            vector = vector.reshape(1, -1)
        
        # Add to FAISS
        self.index.add(vector)
        self.id_map.append(id)
        self.timestamps[id] = ts
        
        logger.debug(f"Added vector {id} at timestamp {ts} (total: {self.index.ntotal})")
    
    def query_vector(self, vector: np.ndarray, k: int = 5) -> List[Tuple[str, float]]:
        """
        Query for similar vectors.
        
        Args:
            vector: Query vector (dim,)
            k: Number of results to return
            
        Returns:
            List of (id, similarity_score) tuples, sorted by similarity (descending)
        """
        if self.index.ntotal == 0:
            return []
        
        k = min(k, self.index.ntotal)
        
        # Ensure vector is 2D
        if vector.ndim == 1:
            vector = vector.reshape(1, -1)
        
        # Search (returns distances and indices)
        scores, indices = self.index.search(vector, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.id_map):  # Valid index
                results.append((self.id_map[idx], float(score)))
        
        return results
    
    def evict_older_than(self, seconds: int):
        """
        Remove vectors older than threshold.
        
        Args:
            seconds: Age threshold in seconds
        """
        now = datetime.now(timezone.utc).timestamp()
        cutoff = now - seconds
        
        # Find indices to keep
        keep_indices = []
        new_id_map = []
        
        for i, id in enumerate(self.id_map):
            if self.timestamps.get(id, 0) >= cutoff:
                keep_indices.append(i)
                new_id_map.append(id)
            else:
                # Remove from timestamps
                if id in self.timestamps:
                    del self.timestamps[id]
        
        evicted_count = len(self.id_map) - len(keep_indices)
        
        if evicted_count > 0:
            # Rebuild index with kept vectors only
            if len(keep_indices) > 0:
                # Reconstruct all vectors
                vectors = self.index.reconstruct_n(0, self.index.ntotal)
                kept_vectors = vectors[keep_indices]
                
                # Create new index
                self.index = faiss.IndexFlatIP(self.dim)
                self.index.add(kept_vectors)
            else:
                # No vectors to keep, reset index
                self.index = faiss.IndexFlatIP(self.dim)
            
            self.id_map = new_id_map
            
            logger.info(f"Evicted {evicted_count} old vectors (kept {len(keep_indices)})")
    
    def size(self) -> int:
        """Get current number of vectors in index"""
        return self.index.ntotal
    
    def clear(self):
        """Clear all vectors from index"""
        self.index = faiss.IndexFlatIP(self.dim)
        self.id_map.clear()
        self.timestamps.clear()
        logger.info("Vector index cleared")


# Global instance (singleton pattern)
_vector_index = None

def get_vector_index() -> VectorIndex:
    """Get or create the global vector index instance"""
    global _vector_index
    if _vector_index is None:
        _vector_index = VectorIndex()
    return _vector_index
