import pytest
import numpy as np
from app.nlp.embed import get_embedding_service, EmbeddingService


def test_embedding_service_initialization():
    """Test that embedding service initializes correctly"""
    service = get_embedding_service()
    assert service is not None
    assert service.model is not None


def test_embed_text_shape():
    """Test that embeddings have correct shape and are normalized"""
    service = get_embedding_service()
    text = "This is a test article about artificial intelligence and machine learning."
    
    embedding = service.embed_text(text)
    
    # Check shape (all-MiniLM-L6-v2 produces 384-dimensional vectors)
    assert embedding.shape == (384,)
    assert embedding.dtype == np.float32
    
    # Check normalization (L2 norm should be ~1.0)
    norm = np.linalg.norm(embedding)
    assert abs(norm - 1.0) < 0.01, f"Expected norm ~1.0, got {norm}"


def test_embed_text_deterministic():
    """Test that same text produces same embedding"""
    service = get_embedding_service()
    text = "Deterministic test text"
    
    emb1 = service.embed_text(text)
    emb2 = service.embed_text(text)
    
    # Should be identical (cached)
    np.testing.assert_array_equal(emb1, emb2)


def test_embed_cache():
    """Test that caching works correctly"""
    service = EmbeddingService()  # Fresh instance
    text = "Cached text example"
    
    # First call
    emb1 = service.embed_text(text)
    assert text in service.cache
    
    # Second call should return cached version
    emb2 = service.embed_text(text)
    assert emb1 is emb2  # Same object reference


def test_embed_batch():
    """Test batch embedding"""
    service = get_embedding_service()
    texts = [
        "First article about AI",
        "Second article about machine learning",
        "Third article about neural networks"
    ]
    
    embeddings = service.embed_batch(texts)
    
    # Check shape
    assert embeddings.shape == (3, 384)
    assert embeddings.dtype == np.float32
    
    # Check each is normalized
    for i in range(3):
        norm = np.linalg.norm(embeddings[i])
        assert abs(norm - 1.0) < 0.01


def test_embed_different_texts():
    """Test that different texts produce different embeddings"""
    service = get_embedding_service()
    
    text1 = "Artificial intelligence is transforming technology"
    text2 = "The weather today is sunny and warm"
    
    emb1 = service.embed_text(text1)
    emb2 = service.embed_text(text2)
    
    # Embeddings should be different
    similarity = np.dot(emb1, emb2)  # Cosine similarity for normalized vectors
    assert similarity < 0.9, "Unrelated texts should have low similarity"


def test_embed_similar_texts():
    """Test that similar texts produce similar embeddings"""
    service = get_embedding_service()
    
    text1 = "Machine learning is a subset of artificial intelligence"
    text2 = "AI includes machine learning as a key component"
    
    emb1 = service.embed_text(text1)
    emb2 = service.embed_text(text2)
    
    # Similar texts should have high similarity
    similarity = np.dot(emb1, emb2)
    assert similarity > 0.5, f"Similar texts should have high similarity, got {similarity}"


def test_clear_cache():
    """Test cache clearing"""
    service = EmbeddingService()
    
    service.embed_text("Test 1")
    service.embed_text("Test 2")
    assert len(service.cache) == 2
    
    service.clear_cache()
    assert len(service.cache) == 0
