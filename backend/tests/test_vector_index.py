import pytest
import numpy as np
from datetime import datetime, timezone, timedelta
from app.index.vector_index import VectorIndex, get_vector_index


def test_vector_index_initialization():
    """Test that vector index initializes correctly"""
    index = VectorIndex(dim=384)
    assert index.dim == 384
    assert index.size() == 0


def test_add_vector():
    """Test adding a vector to the index"""
    index = VectorIndex(dim=384)
    
    vector = np.random.rand(384).astype(np.float32)
    vector = vector / np.linalg.norm(vector)  # Normalize
    
    index.add_vector("test_id_1", vector)
    
    assert index.size() == 1
    assert "test_id_1" in index.id_map
    assert "test_id_1" in index.timestamps


def test_query_vector_exact_match():
    """Test querying for exact match"""
    index = VectorIndex(dim=384)
    
    vector = np.random.rand(384).astype(np.float32)
    vector = vector / np.linalg.norm(vector)
    
    index.add_vector("exact_match", vector)
    
    # Query with same vector
    results = index.query_vector(vector, k=1)
    
    assert len(results) == 1
    assert results[0][0] == "exact_match"
    assert results[0][1] > 0.99  # Should be ~1.0 for exact match


def test_query_vector_similarity():
    """Test querying for similar vectors"""
    index = VectorIndex(dim=384)
    
    # Create base vector
    vec1 = np.random.rand(384).astype(np.float32)
    vec1 = vec1 / np.linalg.norm(vec1)
    
    # Create similar vector (add small noise)
    vec2 = vec1 + np.random.rand(384).astype(np.float32) * 0.1
    vec2 = vec2 / np.linalg.norm(vec2)
    
    # Create dissimilar vector
    vec3 = np.random.rand(384).astype(np.float32)
    vec3 = vec3 / np.linalg.norm(vec3)
    
    index.add_vector("similar", vec1)
    index.add_vector("dissimilar", vec3)
    
    # Query with vec2 (similar to vec1)
    results = index.query_vector(vec2, k=2)
    
    assert len(results) == 2
    # First result should be the similar vector
    assert results[0][0] == "similar"
    assert results[0][1] > 0.85  # High similarity


def test_query_multiple_results():
    """Test querying for multiple results"""
    index = VectorIndex(dim=384)
    
    # Add multiple vectors
    for i in range(5):
        vec = np.random.rand(384).astype(np.float32)
        vec = vec / np.linalg.norm(vec)
        index.add_vector(f"vec_{i}", vec)
    
    # Query
    query_vec = np.random.rand(384).astype(np.float32)
    query_vec = query_vec / np.linalg.norm(query_vec)
    
    results = index.query_vector(query_vec, k=3)
    
    assert len(results) == 3
    # Results should be sorted by similarity (descending)
    assert results[0][1] >= results[1][1]
    assert results[1][1] >= results[2][1]


def test_query_empty_index():
    """Test querying an empty index"""
    index = VectorIndex(dim=384)
    
    query_vec = np.random.rand(384).astype(np.float32)
    query_vec = query_vec / np.linalg.norm(query_vec)
    
    results = index.query_vector(query_vec, k=5)
    
    assert len(results) == 0


def test_evict_older_than():
    """Test time-based eviction"""
    index = VectorIndex(dim=384)
    
    now = datetime.now(timezone.utc).timestamp()
    old_time = now - 7200  # 2 hours ago
    recent_time = now - 1800  # 30 minutes ago
    
    # Add old vector
    vec1 = np.random.rand(384).astype(np.float32)
    vec1 = vec1 / np.linalg.norm(vec1)
    index.add_vector("old_vec", vec1, ts=old_time)
    
    # Add recent vector
    vec2 = np.random.rand(384).astype(np.float32)
    vec2 = vec2 / np.linalg.norm(vec2)
    index.add_vector("recent_vec", vec2, ts=recent_time)
    
    assert index.size() == 2
    
    # Evict vectors older than 1 hour (3600 seconds)
    index.evict_older_than(3600)
    
    # Should only have recent vector
    assert index.size() == 1
    assert "recent_vec" in index.id_map
    assert "old_vec" not in index.id_map


def test_evict_all():
    """Test evicting all vectors"""
    index = VectorIndex(dim=384)
    
    old_time = datetime.now(timezone.utc).timestamp() - 10000
    
    # Add vectors with old timestamp
    for i in range(3):
        vec = np.random.rand(384).astype(np.float32)
        vec = vec / np.linalg.norm(vec)
        index.add_vector(f"vec_{i}", vec, ts=old_time)
    
    assert index.size() == 3
    
    # Evict all (older than 1 second)
    index.evict_older_than(1)
    
    assert index.size() == 0


def test_clear():
    """Test clearing the index"""
    index = VectorIndex(dim=384)
    
    # Add vectors
    for i in range(5):
        vec = np.random.rand(384).astype(np.float32)
        vec = vec / np.linalg.norm(vec)
        index.add_vector(f"vec_{i}", vec)
    
    assert index.size() == 5
    
    index.clear()
    
    assert index.size() == 0
    assert len(index.id_map) == 0
    assert len(index.timestamps) == 0


def test_duplicate_detection():
    """Test using index for duplicate detection (similarity > 0.88)"""
    index = VectorIndex(dim=384)
    
    # Original article
    vec1 = np.random.rand(384).astype(np.float32)
    vec1 = vec1 / np.linalg.norm(vec1)
    index.add_vector("article_1", vec1)
    
    # Near-duplicate (very similar)
    vec2 = vec1 + np.random.rand(384).astype(np.float32) * 0.05
    vec2 = vec2 / np.linalg.norm(vec2)
    
    # Check similarity
    results = index.query_vector(vec2, k=1)
    
    assert len(results) == 1
    assert results[0][1] > 0.88  # Should be flagged as duplicate


def test_global_instance():
    """Test global instance singleton"""
    index1 = get_vector_index()
    index2 = get_vector_index()
    
    # Should be same instance
    assert index1 is index2
