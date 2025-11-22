from sentence_transformers import SentenceTransformer
import numpy as np
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating text embeddings using SentenceTransformers"""
    
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        logger.info(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.cache: Dict[str, np.ndarray] = {}
        logger.info("Embedding model loaded successfully")
    
    def embed_text(self, text: str) -> np.ndarray:
        """
        Embed text and return normalized vector.
        
        Args:
            text: Input text to embed
            
        Returns:
            Normalized 384-dimensional embedding vector (float32)
        """
        # Check cache first
        if text in self.cache:
            return self.cache[text]
        
        # Encode and normalize
        embedding = self.model.encode(text, normalize_embeddings=True)
        embedding = embedding.astype(np.float32)
        
        # Cache for identical texts (memory-efficient for duplicates)
        if len(self.cache) < 1000:  # Limit cache size
            self.cache[text] = embedding
        
        return embedding
    
    def embed_batch(self, texts: List[str], batch_size: int = 16) -> np.ndarray:
        """
        Batch embed multiple texts for efficiency.
        
        Args:
            texts: List of texts to embed
            batch_size: Batch size for encoding
            
        Returns:
            Array of normalized embeddings (N x 384)
        """
        embeddings = self.model.encode(
            texts, 
            normalize_embeddings=True, 
            batch_size=batch_size,
            show_progress_bar=False
        )
        return embeddings.astype(np.float32)
    
    def clear_cache(self):
        """Clear the embedding cache"""
        self.cache.clear()
        logger.info("Embedding cache cleared")


# Global instance (singleton pattern)
_embedding_service = None

def get_embedding_service() -> EmbeddingService:
    """Get or create the global embedding service instance"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
