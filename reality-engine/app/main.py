"""
Reality Engine main loop.
Orchestrates scraping, deduplication, scoring, LLM analysis, and event publishing.
"""
import asyncio
import uuid
from datetime import datetime
from typing import List, Dict
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import env, constants

from .scraper import get_scraper
from .embedder import get_embedder
from .vector_index import get_vector_index
from .quick_scorer import get_quick_scorer
from .llm_runner import get_llm_runner
from .event_builder import build_event
from .publisher import get_publisher

# Configure logging
logging.basicConfig(
    level=getattr(logging, env.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RealityEngine:
    """Main reality engine orchestrator."""
    
    def __init__(self):
        self.scraper = get_scraper()
        self.embedder = get_embedder()
        self.vector_index = get_vector_index()
        self.quick_scorer = get_quick_scorer()
        self.llm_runner = get_llm_runner()
        self.publisher = get_publisher()
        
        logger.info("Reality Engine initialized")
    
    async def process_cycle(self):
        """Run one complete processing cycle."""
        logger.info("=" * 60)
        logger.info("Starting Reality Engine cycle")
        logger.info("=" * 60)
        
        # Step 1: Scrape articles
        logger.info("Step 1: Scraping news sources...")
        articles = self.scraper.scrape_all_sources()
        logger.info(f"Scraped {len(articles)} articles")
        
        if not articles:
            logger.warning("No articles scraped, ending cycle")
            return
        
        # Step 2: Embed and deduplicate
        logger.info("Step 2: Embedding and deduplicating...")
        unique_articles = []
        
        for article in articles:
            # Create article ID
            article_id = self.scraper.make_article_id(
                article['url'],
                article.get('publish_date')
            )
            article['id'] = article_id
            
            # Embed
            text = f"{article['title']} {article['text']}"
            embedding = self.embedder.embed_text(text)
            article['embedding'] = embedding
            
            # Check for duplicates
            similar = self.vector_index.query_vector(embedding, k=5)
            
            is_duplicate = False
            for sim_id, similarity in similar:
                if similarity > constants.SIMILARITY_DUPLICATE:
                    logger.info(f"Duplicate detected: {article_id} similar to {sim_id} ({similarity:.3f})")
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                # Add to index
                self.vector_index.add_vector(article_id, embedding)
                unique_articles.append(article)
        
        logger.info(f"Unique articles after deduplication: {len(unique_articles)}")
        
        # Step 3: Group similar articles
        logger.info("Step 3: Grouping similar articles...")
        groups = self._group_articles(unique_articles)
        logger.info(f"Formed {len(groups)} article groups")
        
        # Step 4: Process each group
        logger.info("Step 4: Processing groups...")
        for i, group in enumerate(groups, 1):
            logger.info(f"Processing group {i}/{len(groups)} ({len(group)} articles)")
            await self._process_group(group)
        
        # Step 5: Evict old vectors
        logger.info("Step 5: Evicting old vectors...")
        self.vector_index.evict_older_than(constants.VECTOR_WINDOW_SECONDS)
        
        logger.info("Cycle complete")
        logger.info("=" * 60)
    
    def _group_articles(self, articles: List[Dict]) -> List[List[Dict]]:
        """Group similar articles using clustering."""
        groups = []
        used = set()
        
        for article in articles:
            if article['id'] in used:
                continue
            
            # Start new group
            group = [article]
            used.add(article['id'])
            
            # Find similar articles
            for other in articles:
                if other['id'] in used:
                    continue
                
                similarity = self.embedder.compute_similarity(
                    article['embedding'],
                    other['embedding']
                )
                
                if similarity >= constants.SIMILARITY_GROUP:
                    group.append(other)
                    used.add(other['id'])
            
            groups.append(group)
        
        return groups
    
    async def _process_group(self, group: List[Dict]):
        """Process a group of similar articles."""
        # Combine text for scoring
        combined_text = " ".join(
            f"{article['title']} {article['text'][:500]}"
            for article in group
        )
        
        # Quick score
        # For demo, we'll assume articles mention "ELON" stock
        # In production, this would use NER to detect mentioned stocks
        target_entities = ["Tesla", "Elon Musk", "SpaceX"]
        quick_score = self.quick_scorer.compute_quick_score(
            combined_text,
            target_entities
        )
        
        logger.info(f"Quick score: {quick_score:.3f}")
        
        # Determine if LLM should run
        num_sources = len(set(article.get('source_id') for article in group))
        should_run_llm = self.llm_runner.should_run_llm(quick_score, num_sources)
        
        llm_output = None
        if should_run_llm:
            logger.info("Running LLM analysis...")
            llm_output = self.llm_runner.run_llm(group)
        
        # Build event
        event_id = str(uuid.uuid4())
        stocks = ["ELON"]  # Hardcoded for demo; would use NER in production
        
        event = build_event(
            event_id=event_id,
            stocks=stocks,
            quick_score=quick_score,
            grouped_docs=group,
            llm_output=llm_output
        )
        
        # Publish event
        logger.info(f"Publishing event {event_id}...")
        success = await self.publisher.publish_event(event)
        
        if success:
            logger.info(f"Event {event_id} published successfully")
        else:
            logger.error(f"Failed to publish event {event_id}")
    
    async def run_forever(self):
        """Run reality engine in continuous loop."""
        logger.info(f"Starting Reality Engine (poll interval: {env.POLL_INTERVAL}s)")
        
        while True:
            try:
                await self.process_cycle()
            except Exception as e:
                logger.error(f"Error in processing cycle: {e}", exc_info=True)
            
            # Wait for next cycle
            logger.info(f"Sleeping for {env.POLL_INTERVAL}s...")
            await asyncio.sleep(env.POLL_INTERVAL)


async def main():
    """Main entry point."""
    engine = RealityEngine()
    await engine.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
