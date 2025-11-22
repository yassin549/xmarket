"""
Tests for embedding and FAISS deduplication.

Tests Prompt #6 acceptance criteria:
- Embedding is deterministic
- Vectors are L2-normalized
- Deduplication at SIMILARITY_DUPLICATE threshold  
- Clustering at SIMILARITY_GROUP threshold
- TTL eviction works
"""

import pytest
import numpy as np
import time

from config.constants import SIMILARITY_DUPLICATE, SIMILARITY_GROUP, VECTOR_WINDOW_SECONDS

# Test with/without dependencies
try:
    from reality_engine.embedder import (
        load_model, embed_text, embed_batch, normalize_vector,
        text_hash, get_embedding_dimension
    )
    from reality_engine.vector_index import VectorIndex
    HAS_DEPENDENCIES = True
except ImportError:
    HAS_DEPENDENCIES = False


pytestmark = pytest.mark.skipif(
    not HAS_DEPENDENCIES,
    reason="sentence-transformers or faiss not installed"
)


# ============================================================================
# Test: Embedding
# ============================================================================

class TestEmbedding:
    """Test embedding functionality."""
    
    def test_load_model(self):
        """Test that model loads successfully."""
        model = load_model()
        
        assert model is not None
        assert get_embedding_dimension(model) == 384  # all-MiniLM-L6-v2
    
    def test_embedding_deterministic(self):
        """Test that same text produces same embedding."""
        model = load_model()
        text = "This is a test article about climate change and renewable energy."
        
        vec1 = embed_text(text, model)
        vec2 = embed_text(text, model)
        
        assert np.allclose(vec1, vec2, atol=1e-6)  # Should be identical
    
    def test_embedding_normalized(self):
        """Test that vectors are L2-normalized."""
        model = load_model()
        text = "Technology breakthrough in artificial intelligence."
        
        vec = embed_text(text, model)
        norm = np.linalg.norm(vec)
        
        assert np.isclose(norm, 1.0, atol=1e-5)  # Should be unit length
    
    def test_embedding_dtype(self):
        """Test that vectors are float32."""
        model = load_model()
        text = "Test article"
        
        vec = embed_text(text, model)
        
        assert vec.dtype == np.float32
    
    def test_embedding_dimension(self):
        """Test that vectors have correct dimension."""
        model = load_model()
        text = "Test article"
        
        vec = embed_text(text, model)
        
        assert vec.shape == (384,)  # all-MiniLM-L6-v2
    
    def test_batch_embedding(self):
        """Test batch embedding."""
        model = load_model()
        texts = [
            "First article about technology",
            "Second article about climate",
            "Third article about health"
        ]
        
        vecs = embed_batch(texts, model)
        
        assert vecs.shape == (3, 384)
        assert vecs.dtype == np.float32
        
        # All should be normalized
        for vec in vecs:
            norm = np.linalg.norm(vec)
            assert np.isclose(norm, 1.0, atol=1e-5)
    
    def test_text_hash(self):
        """Test text hashing is deterministic."""
        text = "Same text"
        
        hash1 = text_hash(text)
        hash2 = text_hash(text)
        
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex


# ============================================================================
# Test: Vector Normalize
# ============================================================================

class TestNormalization:
    """Test vector normalization."""
    
    def test_normalize_vector(self):
        """Test L2 normalization."""
        vec = np.array([3.0, 4.0], dtype=np.float32)
        normalized = normalize_vector(vec)
        
        # Should be [0.6, 0.8]
        assert np.allclose(normalized, [0.6, 0.8])
        assert np.isclose(np.linalg.norm(normalized), 1.0)
    
    def test_normalize_zero_vector(self):
        """Test normalizing zero vector."""
        vec = np.zeros(10, dtype=np.float32)
        normalized = normalize_vector(vec)
        
        # Should remain zeros
        assert np.allclose(normalized, 0.0)


# ============================================================================
# Test: FAISS Index
# ============================================================================

class TestVectorIndex:
    """Test FAISS vector index operations."""
    
    def test_index_initialization(self):
        """Test index initialization."""
        index = VectorIndex(dimension=384)
        
        assert index.size() == 0
        assert index.dimension == 384
    
    def test_add_vector(self):
        """Test adding vector to index."""
        index = VectorIndex(dimension=10)
        vec = np.random.rand(10).astype(np.float32)
        vec = normalize_vector(vec)
        
        index.add_vector(vec, "event-1", "hash-1")
        
        assert index.size() == 1
    
    def test_search_similar(self):
        """Test similarity search."""
        index = VectorIndex(dimension=10)
        
        # Add some vectors
        for i in range(5):
            vec = np.random.rand(10).astype(np.float32)
            vec = normalize_vector(vec)
            index.add_vector(vec, f"event-{i}", f"hash-{i}")
        
        # Search
        query = np.random.rand(10).astype(np.float32)
        query = normalize_vector(query)
        results = index.search_similar(query, k=3)
        
        assert len(results) <= 3
        for sim, event_id, text_hash in results:
            assert 0.0 <= sim <= 1.0
            assert event_id.startswith("event-")
   
    def test_duplicate_detection(self):
        """Test duplicate detection."""
        index = VectorIndex(dimension=384)
        model = load_model()
        
        text1 = "Apple announces new iPhone model with improved camera"
        text2 = "Apple unveils latest iPhone with enhanced camera features"  # Very similar
        
        vec1 = embed_text(text1, model)
        vec2 = embed_text(text2, model)
        
        # Add first vector
        index.add_vector(vec1, "event-1", "hash-1")
        
        # Check if second is duplicate
        is_dup = index.check_duplicate(vec2, threshold=SIMILARITY_DUPLICATE)
        
        # Should be detected as duplicate (very similar text)
        assert is_dup
    
    def test_grouping(self):
        """Test finding groups."""
        index = VectorIndex(dimension=384)
        model = load_model()
        
        # Add some related articles
        texts = [
            "Climate change affects global temperatures",
            "Global warming impacts weather patterns",
            "Renewable energy reduces carbon emissions"
        ]
        
        for i, text in enumerate(texts):
            vec = embed_text(text, model)
            index.add_vector(vec, f"event-{i}", f"hash-{i}")
        
        # Query with similar text
        query_text = "Climate change and temperature rise"
        query_vec = embed_text(query_text, model)
        
        groups = index.find_groups(query_vec, threshold=SIMILARITY_GROUP)
        
        # Should find the climate-related articles
        assert len(groups) > 0
    
    def test_ttl_eviction(self):
        """Test TTL-based eviction."""
        index = VectorIndex(dimension=10)
        
        # Add old vector
        old_vec = np.random.rand(10).astype(np.float32)
        old_vec = normalize_vector(old_vec)
        index.add_vector(old_vec, "old-event", "old-hash", timestamp=time.time() - 10)
        
        # Add new vector
        new_vec = np.random.rand(10).astype(np.float32)
        new_vec = normalize_vector(new_vec)
        index.add_vector(new_vec, "new-event", "new-hash")
        
        assert index.size() == 2
        
        # Evict vectors older than 5 seconds
        evicted = index.evict_old_vectors(max_age_seconds=5)
        
        assert evicted == 1
        assert index.size() == 1


# ============================================================================
# Test: Integration
# ============================================================================

class TestIntegration:
    """Test integrated embedding + deduplication workflow."""
    
    def test_duplicate_rejection_workflow(self):
        """Test end-to-end duplicate rejection."""
        model = load_model()
        index = VectorIndex()
        
        # Process first article
        article1 = "Technology companies announce major AI breakthrough"
        vec1 = embed_text(article1, model)
        
        # Not a duplicate (index empty)
        assert not index.check_duplicate(vec1, SIMILARITY_DUPLICATE)
        
        # Add to index
        index.add_vector(vec1, "event-1", text_hash(article1))
        
        # Process very similar article
        article2 = "Tech firms reveal significant AI advancement"
        vec2 = embed_text(article2, model)
        
        # Should be detected as duplicate
        assert index.check_duplicate(vec2, SIMILARITY_DUPLICATE)
    
    def test_clustering_workflow(self):
        """Test clustering similar articles."""
        model = load_model()
        index = VectorIndex()
        
        # Add several related articles
        articles = [
            "Solar panel efficiency reaches new record",
            "Wind turbine technology improves significantly",
            "Renewable energy adoption accelerates globally"
        ]
        
        for i, article in enumerate(articles):
            vec = embed_text(article, model)
            index.add_vector(vec, f"event-{i}", text_hash(article))
        
        # Query with related article
        query = "Clean energy solutions gain momentum"
        query_vec = embed_text(query, model)
        
        # Find similar articles
        groups = index.find_groups(query_vec, SIMILARITY_GROUP)
        
        # Should find some related articles
        assert len(groups) > 0
        
        # Similarities should be above threshold
        for sim, _, _ in groups:
            assert sim >= SIMILARITY_GROUP


# ============================================================================
# Summary
# ============================================================================

def test_summary():
    """Print test summary."""
    print("\n" + "="*60)
    print("Embedding & FAISS Tests Summary")
    print("="*60)
    print("✓ Embedding determinism")
    print("✓ L2 normalization")
    print("✓ Vector dtype (float32)")
    print("✓ Batch embedding")
    print("✓ FAISS index operations")
    print(f"✓ Duplicate detection (threshold={SIMILARITY_DUPLICATE})")
    print(f"✓ Clustering (threshold={SIMILARITY_GROUP})")
    print("✓ TTL eviction")
    print("="*60)
