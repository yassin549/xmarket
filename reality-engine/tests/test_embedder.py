"""
Unit tests for embedder module.
"""
import pytest
import numpy as np
from reality_engine.app.embedder import Embedder
from config import constants


@pytest.fixture
def embedder():
    """Create Embedder instance."""
    return Embedder()


def test_embed_text_shape(embedder):
    """Test embedding output shape."""
    text = "This is a test sentence"
    embedding = embedder.embed_text(text)
    
    assert embedding.shape == (constants.EMBEDDING_DIM,)
    assert embedding.dtype == np.float32


def test_embed_text_normalized(embedder):
    """Test that embeddings are L2 normalized."""
    text = "Test sentence for normalization"
    embedding = embedder.embed_text(text)
    
    norm = np.linalg.norm(embedding)
    assert norm == pytest.approx(1.0, abs=0.01)  # L2 norm should be 1


def test_embed_batch(embedder):
    """Test batch embedding."""
    texts = ["First sentence", "Second sentence", "Third sentence"]
    embeddings = embedder.embed_batch(texts)
    
    assert embeddings.shape == (3, constants.EMBEDDING_DIM)
    assert embeddings.dtype == np.float32


def test_embedding_caching(embedder):
    """Test that embeddings are cached."""
    text = "Cache test sentence"
    
    # First call
    emb1 = embedder.embed_text(text)
    
    # Second call should use cache
    emb2 = embedder.embed_text(text)
    
    assert np.array_equal(emb1, emb2)


def test_compute_similarity(embedder):
    """Test cosine similarity computation."""
    text1 = "Tesla announces new electric vehicle"
    text2 = "Tesla reveals new EV model"
    text3 = "Apple releases new iPhone"
    
    emb1 = embedder.embed_text(text1)
    emb2 = embedder.embed_text(text2)
    emb3 = embedder.embed_text(text3)
    
    # Similar texts should have high similarity
    sim_similar = embedder.compute_similarity(emb1, emb2)
    assert sim_similar > 0.7
    
    # Different texts should have lower similarity
    sim_different = embedder.compute_similarity(emb1, emb3)
    assert sim_different < sim_similar


def test_deterministic_embeddings(embedder):
    """Test that same text produces same embedding."""
    text = "Deterministic test sentence"
    
    emb1 = embedder.embed_text(text)
    emb2 = embedder.embed_text(text)
    
    assert np.array_equal(emb1, emb2)
