"""
Text embedding module for reality-engine.

Uses sentence-transformers/all-MiniLM-L6-v2 for fast, deterministic embeddings.
- 384 dimensions
- L2 normalized for cosine similarity
- ~40ms per text on CPU
"""

import numpy as np
import hashlib
from typing import List, Optional
from functools import lru_cache
import logging

# Import with error handling
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    logging.warning("sentence-transformers not installed, embedding will be disabled")

logger = logging.getLogger(__name__)

# Global model cache (loaded once)
_MODEL_CACHE: Optional[SentenceTransformer] = None


def load_model(model_name: str = 'sentence-transformers/all-MiniLM-L6-v2') -> SentenceTransformer:
    """
    Load sentence-transformers model (cached globally).
    
    Args:
        model_name: Model identifier
        
    Returns:
        SentenceTransformer model
        
    Raises:
        RuntimeError: If sentence-transformers not installed
    """
    global _MODEL_CACHE
    
    if not HAS_SENTENCE_TRANSFORMERS:
        raise RuntimeError("sentence-transformers not installed. Install with: pip install sentence-transformers")
    
    if _MODEL_CACHE is None:
        logger.info(f"Loading embedding model: {model_name}")
        _MODEL_CACHE = SentenceTransformer(model_name)
        logger.info(f"Model loaded successfully (dimension={_MODEL_CACHE.get_sentence_embedding_dimension()})")
    
    return _MODEL_CACHE


def normalize_vector(vector: np.ndarray) -> np.ndarray:
    """
    L2 normalize vector for cosine similarity.
    
    Args:
        vector: Input vector
        
    Returns:
        L2-normalized vector
    """
    norm = np.linalg.norm(vector)
    if norm > 0:
        return vector / norm
    return vector


def embed_text(text: str, model: Optional[SentenceTransformer] = None) -> np.ndarray:
    """
    Embed single text into vector.
    
    Args:
        text: Input text
        model: Pre-loaded model (loads if None)
        
    Returns:
        L2-normalized float32 vector (384 dims for all-MiniLM-L6-v2)
    """
    if model is None:
        model = load_model()
    
    # Encode (returns numpy array)
    embedding = model.encode(text, convert_to_numpy=True, show_progress_bar=False)
    
    # Ensure float32
    embedding = embedding.astype(np.float32)
    
    # L2 normalize for cosine similarity
    embedding = normalize_vector(embedding)
    
    return embedding


def embed_batch(texts: List[str], model: Optional[SentenceTransformer] = None) -> np.ndarray:
    """
    Batch embed multiple texts for efficiency.
    
    Args:
        texts: List of texts
        model: Pre-loaded model (loads if None)
        
    Returns:
        Array of L2-normalized float32 vectors, shape (n, 384)
    """
    if not texts:
        return np.array([], dtype=np.float32)
    
    if model is None:
        model = load_model()
    
    # Batch encode
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False, batch_size=32)
    
    # Ensure float32
    embeddings = embeddings.astype(np.float32)
    
    # L2 normalize each vector
    for i in range(len(embeddings)):
        embeddings[i] = normalize_vector(embeddings[i])
    
    return embeddings


def text_hash(text: str) -> str:
    """
    Generate stable hash for text (for caching).
    
    Args:
        text: Input text
        
    Returns:
        SHA256 hash (hex)
    """
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


@lru_cache(maxsize=1000)
def embed_text_cached(text_hash_val: str, text: str) -> np.ndarray:
    """
    Cached embedding function using LRU cache.
    
    Note: text_hash_val must be first arg for lru_cache to work properly.
    
    Args:
        text_hash_val: Hash of text (for cache key)
        text: Actual text to embed
        
    Returns:
        Embedding vector
    """
    model = load_model()
    return embed_text(text, model)


def get_embedding_dimension(model: Optional[SentenceTransformer] = None) -> int:
    """
    Get embedding dimension.
    
    Args:
        model: Pre-loaded model (loads if None)
        
    Returns:
        Dimension (384 for all-MiniLM-L6-v2)
    """
    if model is None:
        model = load_model()
    
    return model.get_sentence_embedding_dimension()
