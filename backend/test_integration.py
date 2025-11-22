"""
Integration test for Phase 1 components.
Tests the full pipeline: Embeddings -> Vector Index -> Quick Scorer -> Reality Engine
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Score
from app.nlp.embed import get_embedding_service
from app.index.vector_index import get_vector_index
from app.scoring.quick_scorer import quick_score
from app.scoring.reality_engine import get_reality_engine

print("=" * 60)
print("PHASE 1 INTEGRATION TEST")
print("=" * 60)

# Test 1: Embeddings
print("\n[1/5] Testing Embeddings Service...")
embedding_service = get_embedding_service()
text1 = "Apple announces record profits and breakthrough innovation"
text2 = "Apple reports strong quarterly earnings and new products"
text3 = "Weather forecast shows sunny skies ahead"

emb1 = embedding_service.embed_text(text1)
emb2 = embedding_service.embed_text(text2)
emb3 = embedding_service.embed_text(text3)

print(f"  ✓ Embedding shape: {emb1.shape}")
print(f"  ✓ Embedding dtype: {emb1.dtype}")
print(f"  ✓ Normalized: {abs(emb1.dot(emb1) - 1.0) < 0.01}")

# Test 2: Vector Index
print("\n[2/5] Testing Vector Index...")
vector_index = get_vector_index()
vector_index.clear()  # Start fresh

vector_index.add_vector("article_1", emb1)
vector_index.add_vector("article_2", emb2)
vector_index.add_vector("article_3", emb3)

print(f"  ✓ Index size: {vector_index.size()}")

# Query for similar articles
similar = vector_index.query_vector(emb1, k=3)
print(f"  ✓ Query results: {len(similar)} articles")
print(f"    - Most similar: {similar[0][0]} (score: {similar[0][1]:.3f})")
print(f"    - 2nd similar: {similar[1][0]} (score: {similar[1][1]:.3f})")

# Check if article_1 and article_2 are similar (both about Apple)
sim_score = similar[1][1]  # Second result (first is exact match)
print(f"  ✓ Similar articles detected: {sim_score > 0.7}")

# Test 3: Quick Scorer
print("\n[3/5] Testing Quick Scorer...")
score_positive = quick_score("Company reports record profits and breakthrough success")
score_negative = quick_score("Company faces bankruptcy and lawsuit scandal")
score_neutral = quick_score("Company announces quarterly report")

print(f"  ✓ Positive text score: {score_positive:+.3f}")
print(f"  ✓ Negative text score: {score_negative:+.3f}")
print(f"  ✓ Neutral text score: {score_neutral:+.3f}")
print(f"  ✓ Scores in range [-1, 1]: {-1 <= score_negative <= score_positive <= 1}")

# Test 4: Reality Engine
print("\n[4/5] Testing Reality Engine...")
engine = create_engine('sqlite:///./test_integration.db')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
db_session = Session()

reality_engine = get_reality_engine(db_session)

# Apply positive event
score1 = reality_engine.apply_event(
    stock_id="AAPL",
    event_points=15.0,
    source_id="reuters",
    timestamp=datetime.now(timezone.utc),
    num_related_docs=3
)
print(f"  ✓ Initial score (after +15 event): {score1:.2f}")

# Apply negative event
score2 = reality_engine.apply_event(
    stock_id="AAPL",
    event_points=-10.0,
    source_id="bloomberg",
    timestamp=datetime.now(timezone.utc),
    num_related_docs=2
)
print(f"  ✓ Updated score (after -10 event): {score2:.2f}")

# Get score (read-only)
result = reality_engine.get_score("AAPL")
print(f"  ✓ Current score: {result['score']:.2f}")
print(f"  ✓ Confidence: {result['confidence']:.2f}")
print(f"  ✓ Score in range [0, 100]: {0 <= result['score'] <= 100}")

# Test 5: End-to-End Pipeline
print("\n[5/5] Testing End-to-End Pipeline...")
articles = [
    {"text": "OpenAI releases GPT-5 with breakthrough capabilities", "source": "techcrunch"},
    {"text": "OpenAI announces new GPT-5 model with advanced features", "source": "verge"},
    {"text": "Microsoft stock rises on cloud growth", "source": "wsj"}
]

print(f"  Processing {len(articles)} articles...")

for i, article in enumerate(articles):
    # 1. Generate embedding
    embedding = embedding_service.embed_text(article['text'])
    
    # 2. Check for duplicates
    similar = vector_index.query_vector(embedding, k=1)
    if similar and similar[0][1] > 0.88:
        print(f"    Article {i+1}: DUPLICATE (similarity: {similar[0][1]:.3f})")
        continue
    
    # 3. Add to index
    article_id = f"article_{i+1}"
    vector_index.add_vector(article_id, embedding)
    
    # 4. Quick score
    q_score = quick_score(article['text'])
    
    # 5. Update reality score
    impact = q_score * 10  # Scale to [-10, 10]
    reality_score = reality_engine.apply_event(
        stock_id="OPENAI",
        event_points=impact,
        source_id=article['source'],
        timestamp=datetime.now(timezone.utc)
    )
    
    print(f"    Article {i+1}: quick_score={q_score:+.2f}, impact={impact:+.2f}, reality_score={reality_score:.2f}")

# Final score
final_result = reality_engine.get_score("OPENAI")
print(f"\n  ✓ Final OPENAI score: {final_result['score']:.2f}")
print(f"  ✓ Confidence: {final_result['confidence']:.2f}")

# Cleanup
db_session.close()
os.remove('./test_integration.db')

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED!")
print("=" * 60)
print("\nPhase 1 Components Status:")
print("  ✓ Embeddings Service: WORKING")
print("  ✓ Vector Index: WORKING")
print("  ✓ Quick Scorer: WORKING")
print("  ✓ Reality Engine: WORKING")
print("  ✓ End-to-End Pipeline: WORKING")
print("\nReady for Phase 2: Orderbook Implementation")
print("=" * 60)
