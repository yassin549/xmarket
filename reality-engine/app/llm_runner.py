"""
LLM runner for TinyLlama with rate limiting.
Supports local binary invocation with strict JSON output parsing.
"""
import subprocess
import json
import hashlib
from typing import Dict, Optional
from datetime import datetime, timedelta
import logging
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from config import env, constants

logger = logging.getLogger(__name__)


class TokenBucketLimiter:
    """Token bucket rate limiter for LLM calls."""
    
    def __init__(self, calls_per_hour: int):
        self.calls_per_hour = calls_per_hour
        self.tokens = calls_per_hour
        self.last_refill = datetime.utcnow()
    
    def acquire(self) -> bool:
        """Try to acquire a token. Returns True if allowed."""
        self._refill()
        
        if self.tokens > 0:
            self.tokens -= 1
            return True
        return False
    
    def _refill(self):
        """Refill tokens based on elapsed time."""
        now = datetime.utcnow()
        elapsed = (now - self.last_refill).total_seconds()
        
        # Refill rate: calls_per_hour tokens per hour
        tokens_to_add = (elapsed / 3600) * self.calls_per_hour
        
        if tokens_to_add >= 1:
            self.tokens = min(self.calls_per_hour, self.tokens + int(tokens_to_add))
            self.last_refill = now
    
    def available_tokens(self) -> int:
        """Get current available tokens."""
        self._refill()
        return int(self.tokens)


class LLMRunner:
    """
    LLM runner with rate limiting and JSON output parsing.
    Supports heuristic fallback when LLM is disabled.
    """
    
    def __init__(self):
        self.mode = env.LLM_MODE
        self.rate_limiter = TokenBucketLimiter(env.LLM_CALLS_PER_HOUR)
        logger.info(f"LLM Runner initialized in {self.mode} mode")
    
    def should_run_llm(self, quick_score: float, num_sources: int) -> bool:
        """
        Determine if LLM should be invoked based on thresholds.
        
        Args:
            quick_score: Quick scorer output
            num_sources: Number of independent sources
        
        Returns:
            True if LLM should run
        """
        if not env.ENABLE_LLM:
            return False
        
        # Check thresholds
        if abs(quick_score) >= constants.LLM_QUICK_THRESHOLD:
            return True
        
        if num_sources >= constants.MIN_INDEP_SOURCES:
            return True
        
        return False
    
    def run_llm(self, grouped_docs: list) -> Optional[Dict]:
        """
        Run LLM on grouped documents.
        
        Args:
            grouped_docs: List of article dicts
        
        Returns:
            {
                "summary": str,
                "impact_suggestion": float,
                "confidence": float,
                "rationale": str
            }
        """
        # Check rate limit
        if not self.rate_limiter.acquire():
            logger.warning("LLM rate limit exceeded")
            return None
        
        if self.mode == "heuristic":
            return self._heuristic_fallback(grouped_docs)
        elif self.mode in ["local", "tiny"]:
            return self._run_tinyllama(grouped_docs)
        else:
            logger.error(f"Unknown LLM mode: {self.mode}")
            return None
    
    def _heuristic_fallback(self, grouped_docs: list) -> Dict:
        """
        Heuristic fallback when LLM is disabled.
        Uses simple text aggregation.
        """
        # Combine titles and summaries
        titles = [doc.get('title', '') for doc in grouped_docs]
        summaries = [doc.get('text', '')[:200] for doc in grouped_docs]
        
        combined_summary = f"{len(grouped_docs)} sources report: " + "; ".join(titles[:3])
        
        return {
            "summary": combined_summary[:500],
            "impact_suggestion": 0.0,  # Neutral
            "confidence": 0.5,
            "rationale": "Heuristic mode - no LLM analysis"
        }
    
    def _run_tinyllama(self, grouped_docs: list) -> Optional[Dict]:
        """
        Run TinyLlama binary for analysis.
        
        This is a placeholder - actual implementation would invoke
        the TinyLlama binary with proper prompt engineering.
        """
        logger.info(f"Running TinyLlama on {len(grouped_docs)} documents")
        
        # Prepare input
        input_text = self._prepare_llm_input(grouped_docs)
        
        # For MVP, use heuristic fallback
        # In production, this would call the actual TinyLlama binary:
        # result = subprocess.run(['./tinyllama', '--prompt', prompt], capture_output=True)
        
        logger.warning("TinyLlama binary not implemented - using heuristic fallback")
        return self._heuristic_fallback(grouped_docs)
    
    def _prepare_llm_input(self, grouped_docs: list) -> str:
        """Prepare input prompt for LLM."""
        prompt = "Analyze the following news articles and provide:\n"
        prompt += "1. A concise summary (max 200 words)\n"
        prompt += "2. Impact suggestion (-1 to +1)\n"
        prompt += "3. Confidence score (0 to 1)\n"
        prompt += "4. Brief rationale\n\n"
        
        for i, doc in enumerate(grouped_docs[:5], 1):
            prompt += f"Article {i}:\n"
            prompt += f"Title: {doc.get('title', 'N/A')}\n"
            prompt += f"Text: {doc.get('text', '')[:500]}...\n\n"
        
        prompt += "\nProvide response as JSON with keys: summary, impact_suggestion, confidence, rationale"
        
        return prompt
    
    def parse_llm_output(self, output: str) -> Optional[Dict]:
        """
        Parse LLM JSON output with validation.
        
        Args:
            output: Raw LLM output string
        
        Returns:
            Parsed and validated dict or None
        """
        try:
            data = json.loads(output)
            
            # Validate required keys
            required = ["summary", "impact_suggestion", "confidence", "rationale"]
            if not all(key in data for key in required):
                logger.error("LLM output missing required keys")
                return None
            
            # Validate ranges
            if not (-1 <= data["impact_suggestion"] <= 1):
                logger.error("impact_suggestion out of range")
                return None
            
            if not (0 <= data["confidence"] <= 1):
                logger.error("confidence out of range")
                return None
            
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON output: {e}")
            return None


# Global LLM runner
_llm_runner = None


def get_llm_runner() -> LLMRunner:
    """Get or create global LLM runner."""
    global _llm_runner
    if _llm_runner is None:
        _llm_runner = LLMRunner()
    return _llm_runner
