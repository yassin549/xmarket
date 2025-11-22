"""
Embedding module - batch embedding with caching.
Uses sentence-transformers/all-MiniLM-L6-v2 for 384-dim vectors.
"""
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Dict
import hashlib
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import constants

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """In-memory cache for embeddings."""
    
    def __init__(self):
        self.cache: Dict[str, np.ndarray] = {}
    
    def get(self, text: str) -> np.ndarray:
        """Get cached embedding."""
        key = hashlib.md5(text.encode()).hexdigest()
        return self.cache.get(key)
    
    def set(self, text: str, embedding: np.ndarray):
        """Cache embedding."""
        key = hashlib.md5(text.encode()).hexdigest()
        self.cache[key] = embedding
    
    def clear(self):
        """Clear cache."""
        self.cache.clear()


class Embedder:
    """
    Embedding wrapper with batching and caching.
    Loads model once per process and reuses.
    """
    
    def __init__(self):
        logger.info(f"Loading embedding model: {constants.EMBEDDING_MODEL}")
        self.model = SentenceTransformer(constants.EMBEDDING_MODEL)
        self.cache = EmbeddingCache()
        logger.info(f"Model loaded. Embedding dimension: {constants.EMBEDDING_DIM}")
    
    def embed_text(self, text: str) -> np.ndarray:
        """
        Embed single text.
        
        Returns:
            Normalized float32 vector of shape (384,)
        """
        # Check cache
        cached = self.cache.get(text)
        if cached is not None:
            return cached
        
        # Encode
        embedding = self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True,  # L2 normalization
            show_progress_bar=False
        ).astype(np.float32)
        
        # Cache
        self.cache.set(text, embedding)
        
        return embedding
    
    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """
        Embed batch of texts.
        
        Returns:
            Normalized float32 array of shape (n, 384)
        """
        # Check cache for each text
        embeddings = []
        uncached_texts = []
        uncached_indices = []
        
        for i, text in enumerate(texts):
            cached = self.cache.get(text)
            if cached is not None:
                embeddings.append(cached)
            else:
                embeddings.append(None)
                uncached_texts.append(text)
                uncached_indices.append(i)
        
        # Encode uncached texts
        if uncached_texts:
            logger.debug(f"Encoding {len(uncached_texts)} uncached texts")
            new_embeddings = self.model.encode(
                uncached_texts,
                batch_size=constants.EMBEDDING_BATCH_SIZE,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False
            ).astype(np.float32)
            
            # Cache and insert
            for i, text in enumerate(uncached_texts):
                embedding = new_embeddings[i]
                self.cache.set(text, embedding)
                embeddings[uncached_indices[i]] = embedding
        
        return np.array(embeddings)
    
    def compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """
        Compute cosine similarity between two embeddings.
        Since embeddings are normalized, this is just dot product.
        
        Returns:
            Similarity score in [0, 1]
        """
        return float(np.dot(embedding1, embedding2))


# Global embedder instance (singleton)
_embedder = None


def get_embedder() -> Embedder:
    """Get or create global embedder instance."""
    global _embedder
    if _embedder is None:
        _embedder = Embedder()
    return _embedder
