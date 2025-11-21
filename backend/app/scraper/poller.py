import time
import os
import yaml
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Optional imports
try:
    from ..nlp.embed import get_embedder
    from ..index.vector_index import get_vector_index
    from ..nlp.quick_scorer import quick_score
    from ..nlp.llm_client import get_llm_client
    from ..scoring.reality_engine import get_reality_engine
    FULL_PIPELINE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Full pipeline not available: {e}")
    FULL_PIPELINE_AVAILABLE = False

from .scraper_utils import fetch_rss_items, extract_article_text, make_id
from ..models import Base, Event, LLMCall

# Database setup
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./data.db')
engine = sa.create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {}
)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(engine)

# Load sources
SOURCES = []
sources_path = os.path.join(os.path.dirname(__file__), 'sources.yaml')
with open(sources_path, 'r') as f:
    SOURCES = yaml.safe_load(f)

POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', '300'))
RECENT_IDS = set()

# Clustering threshold
CLUSTER_SIMILARITY_THRESHOLD = 0.78
LLM_TRIGGER_SCORE = 0.45
LLM_TRIGGER_SOURCES = 2


def process_source(src):
    """Process a single RSS source"""
    items = fetch_rss_items(src['url'])
    new_articles = []
    
    for it in items:
        uid = make_id(it['url'], it.get('published'))
        
        # Check if already processed
        if uid in RECENT_IDS:
            continue
            
        # Check DB
        session = Session()
        if session.query(Event).filter_by(id=uid).first():
            RECENT_IDS.add(uid)
            session.close()
            continue
        session.close()

        # Extract article text
        text = extract_article_text(it['url'], use_playwright=False)
        if not text or len(text) < 120:
            continue
        
        RECENT_IDS.add(uid)
        
        # Store article data for batch processing
        new_articles.append({
            'id': uid,
            'url': it['url'],
            'title': it['title'],
            'text': text,
            'published': it.get('published', datetime.now(timezone.utc)),
            'source_id': src['id'],
            'trust': src.get('trust', 0.5)
        })
    
    return new_articles


def process_articles_batch(articles):
    """Process batch of articles with full pipeline"""
    
    if not articles or not FULL_PIPELINE_AVAILABLE:
        # Fallback: simple insert
        for art in articles:
            insert_event(art, summary="No pipeline", impact=0.0)
        return
    
    logger.info(f"Processing {len(articles)} articles through full pipeline")
    
    # Step 1: Generate embeddings
    embedder = get_embedder()
    vector_index = get_vector_index()
    
    for art in articles:
        # Generate embedding
        embedding = embedder.embed(art['text'])
        
        # Calculate quick score
        art['quick_score'] = quick_score(art['text'], art['title'])
        
        # Check for duplicates in vector index
        similar = vector_index.search(embedding, k=5, threshold=0.88)
        if similar:
            logger.info(f"Skipping duplicate article: {art['title']}")
            continue
        
        # Add to vector index
        vector_index.add(art['id'], embedding, {
            'title': art['title'],
            'source_id': art['source_id'],
            'quick_score': art['quick_score'],
            'trust': art['trust']
        })
    
    # Step 2: Cluster similar articles
    clusters = cluster_articles(articles)
    logger.info(f"Found {len(clusters)} clusters")
    
    # Step 3: Process each cluster
    llm_client = get_llm_client()
    reality_engine = get_reality_engine()
    
    for cluster in clusters:
        # Check if we should call LLM
        should_call_llm = should_trigger_llm(cluster)
        
        if should_call_llm:
            logger.info(f"Hot event detected! Calling LLM for cluster of {len(cluster)} articles")
            
            # Call LLM for summarization
            llm_result = llm_client.summarize_group(cluster)
            
            # Log LLM call
            log_llm_call(cluster, llm_result)
            
            summary = llm_result['summary']
            impact = llm_result['impact_points']
        else:
            # Use heuristic
            summary = cluster[0]['title']
            avg_score = sum(a['quick_score'] for a in cluster) / len(cluster)
            avg_trust = sum(a['trust'] for a in cluster) / len(cluster)
            impact = avg_score * 10 * avg_trust
        
        # Insert events
        for art in cluster:
            insert_event(art, summary=summary, impact=impact)
            
            # Update reality score
            stock_id = extract_stock_id(art)
            if stock_id:
                reality_engine.apply_event(
                    stock_id=stock_id,
                    impact_points=impact,
                    source_trust=art['trust'],
                    num_related_docs=len(cluster),
                    num_independent_sources=len(set(a['source_id'] for a in cluster))
                )


def cluster_articles(articles):
    """Cluster similar articles together"""
    if not articles:
        return []
    
    vector_index = get_vector_index()
    clusters = []
    processed = set()
    
    for art in articles:
        if art['id'] in processed:
            continue
        
        # Find similar articles
        embedding = get_embedder().embed(art['text'])
        similar = vector_index.search(embedding, k=10, threshold=CLUSTER_SIMILARITY_THRESHOLD)
        
        # Build cluster
        cluster = [art]
        processed.add(art['id'])
        
        for sim_id, score in similar:
            sim_art = next((a for a in articles if a['id'] == sim_id), None)
            if sim_art and sim_art['id'] not in processed:
                cluster.append(sim_art)
                processed.add(sim_art['id'])
        
        clusters.append(cluster)
    
    return clusters


def should_trigger_llm(cluster):
    """Determine if cluster is hot enough for LLM call"""
    if not cluster:
        return False
    
    # Check quick score
    avg_score = sum(abs(a.get('quick_score', 0)) for a in cluster) / len(cluster)
    if avg_score >= LLM_TRIGGER_SCORE:
        return True
    
    # Check number of independent sources
    num_sources = len(set(a['source_id'] for a in cluster))
    if num_sources >= LLM_TRIGGER_SOURCES:
        return True
    
    return False


def extract_stock_id(article):
    """Extract stock ID from article (placeholder)"""
    # TODO: Implement entity extraction
    # For now, use a generic ID
    return "MARKET"


def insert_event(article, summary, impact):
    """Insert event into database"""
    try:
        session = Session()
        new_event = Event(
            id=article['id'],
            url=article['url'],
            title=article['title'],
            published=article['published'],
            source_id=article['source_id'],
            summary=summary,
            impact=impact
        )
        session.add(new_event)
        session.commit()
        logger.info(f"Inserted event: {article['id']} from {article['source_id']}")
    except sa.exc.IntegrityError:
        session.rollback()
        logger.warning(f"Duplicate event: {article['id']}")
    except Exception as e:
        logger.error(f"Error inserting event {article['id']}: {e}")
        session.rollback()
    finally:
        session.close()


def log_llm_call(cluster, llm_result):
    """Log LLM call to database"""
    try:
        session = Session()
        
        event_ids = [a['id'] for a in cluster]
        input_hash = get_llm_client().get_input_hash(cluster)
        
        llm_call = LLMCall(
            mode=os.getenv("LLM_MODE", "heuristic"),
            input_hash=input_hash,
            event_ids=str(event_ids),
            summary=llm_result['summary'],
            impact_points=llm_result['impact_points'],
            rationale=llm_result['rationale'],
            model_name=os.getenv("MODEL_NAME", "TinyLlama/TinyLlama-1.1B-Chat-v1.0"),
            tokens_used=None,
            cost_usd=None
        )
        session.add(llm_call)
        session.commit()
        logger.info(f"Logged LLM call for {len(cluster)} articles")
    except Exception as e:
        logger.error(f"Error logging LLM call: {e}")
        session.rollback()
    finally:
        session.close()


def run_loop():
    """Main polling loop"""
    logger.info(f"Starting poller with interval {POLL_INTERVAL}s...")
    logger.info(f"Full pipeline available: {FULL_PIPELINE_AVAILABLE}")
    logger.info(f"LLM mode: {os.getenv('LLM_MODE', 'heuristic')}")
    
    while True:
        all_articles = []
        
        for src in SOURCES:
            try:
                logger.info(f"Processing source: {src['id']}")
                articles = process_source(src)
                all_articles.extend(articles)
            except Exception as e:
                logger.error(f"Source error {src.get('id')}: {e}")
        
        # Process all articles in batch
        if all_articles:
            try:
                process_articles_batch(all_articles)
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
        
        logger.info(f"Sleeping for {POLL_INTERVAL}s...")
        time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    run_loop()
