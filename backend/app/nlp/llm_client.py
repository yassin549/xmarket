import os
import time
import requests
import hashlib
import json
from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """Token bucket rate limiter"""
    
    def __init__(self, calls_per_hour: int = 10):
        self.capacity = calls_per_hour
        self.tokens = calls_per_hour
        self.last_refill = time.time()
    
    def allow_call(self) -> bool:
        """Check if a call is allowed"""
        self._refill()
        
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        
        return False
    
    def _refill(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill
        
        # Refill rate: capacity tokens per hour
        refill = (elapsed / 3600) * self.capacity
        self.tokens = min(self.capacity, self.tokens + refill)
        self.last_refill = now
    
    def get_wait_time(self) -> float:
        """Get time to wait until next call is allowed"""
        if self.tokens >= 1:
            return 0.0
        
        if self.capacity == 0:
            return float('inf')  # Never refills if capacity is 0
        
        # Time to wait for 1 token
        tokens_needed = 1 - self.tokens
        return (tokens_needed / self.capacity) * 3600


class LLMClient:
    """
    LLM client with three modes: heuristic, railway, api
    """
    
    def __init__(self):
        self.mode = os.getenv("LLM_MODE", "heuristic")
        self.llm_service_url = os.getenv("LLM_SERVICE_URL", "http://localhost:8001")
        self.api_url = os.getenv("LLM_API_URL", "")
        self.api_key = os.getenv("LLM_API_KEY", "")
        
        # Rate limiter
        calls_per_hour = int(os.getenv("LLM_CALLS_PER_HOUR", "10"))
        self.rate_limiter = RateLimiter(calls_per_hour)
        
        logger.info(f"LLM Client initialized in {self.mode} mode")
    
    def summarize_group(self, group_docs: List[dict]) -> Dict:
        """
        Summarize a group of related documents.
        
        Args:
            group_docs: List of dicts with keys:
                - title: str
                - text: str
                - source_id: str
                - trust: float
                - quick_score: float
                - published: datetime
        
        Returns:
            {
                "summary": str,
                "impact_points": float,
                "rationale": str,
                "confidence": float
            }
        """
        
        if not group_docs:
            return self._empty_summary()
        
        # Check rate limit
        if self.mode in ["railway", "api"] and not self.rate_limiter.allow_call():
            wait_time = self.rate_limiter.get_wait_time()
            logger.warning(f"Rate limit exceeded, wait {wait_time:.0f}s. Falling back to heuristic.")
            return self._heuristic_summary(group_docs)
        
        # Route to appropriate mode
        if self.mode == "railway":
            return self._call_railway_llm(group_docs)
        elif self.mode == "api":
            return self._call_api_llm(group_docs)
        else:  # heuristic
            return self._heuristic_summary(group_docs)
    
    def _call_railway_llm(self, group_docs: List[dict]) -> Dict:
        """Call Railway-hosted LLM service"""
        
        try:
            # Prepare articles
            articles = [
                {
                    "title": doc.get("title", ""),
                    "text": doc.get("text", "")[:1000],  # Limit text length
                    "source_id": doc.get("source_id", "unknown"),
                    "trust": doc.get("trust", 0.5),
                    "quick_score": doc.get("quick_score", 0.0),
                    "published": doc.get("published", datetime.now()).isoformat() if isinstance(doc.get("published"), datetime) else str(doc.get("published", ""))
                }
                for doc in group_docs[:5]  # Limit to 5 articles
            ]
            
            # Call LLM service
            response = requests.post(
                f"{self.llm_service_url}/summarize",
                json={"articles": articles},
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Railway LLM returned impact: {result.get('impact_points', 0)}")
            
            return result
        
        except Exception as e:
            logger.error(f"Railway LLM service error: {e}, falling back to heuristic")
            return self._heuristic_summary(group_docs)
    
    def _call_api_llm(self, group_docs: List[dict]) -> Dict:
        """Call external API (OpenAI, Gemini, etc.)"""
        
        try:
            # Build prompt
            prompt = self._build_api_prompt(group_docs)
            
            # Call API (example for OpenAI-compatible)
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": os.getenv("LLM_MODEL", "gpt-4"),
                "messages": [
                    {"role": "system", "content": "You are analyzing news articles for impact assessment."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 200
            }
            
            response = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            # Parse response (OpenAI format)
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            # Parse JSON from content
            result = self._parse_json_response(content)
            logger.info(f"API LLM returned impact: {result.get('impact_points', 0)}")
            
            return result
        
        except Exception as e:
            logger.error(f"API LLM error: {e}, falling back to heuristic")
            return self._heuristic_summary(group_docs)
    
    def _heuristic_summary(self, group_docs: List[dict]) -> Dict:
        """Fallback heuristic mode - no LLM calls"""
        
        if not group_docs:
            return self._empty_summary()
        
        # Extract top sentences
        sentences = []
        for doc in group_docs[:3]:
            text = doc.get("text", "")
            # Simple sentence extraction
            doc_sentences = [s.strip() for s in text.split(".") if len(s.strip()) > 20]
            sentences.extend(doc_sentences[:2])
        
        summary = ". ".join(sentences[:3]) + "."
        
        # Compute impact heuristically
        avg_quick_score = sum(doc.get("quick_score", 0) for doc in group_docs) / len(group_docs)
        avg_trust = sum(doc.get("trust", 0.5) for doc in group_docs) / len(group_docs)
        
        impact_points = avg_quick_score * 10 * avg_trust
        impact_points = max(-100, min(100, impact_points))
        
        # Build rationale
        num_sources = len(set(doc.get("source_id", "") for doc in group_docs))
        rationale = f"Heuristic calculation based on {len(group_docs)} articles from {num_sources} sources. Average quick_score: {avg_quick_score:.2f}, average trust: {avg_trust:.2f}."
        
        return {
            "summary": summary[:500],
            "impact_points": round(impact_points, 2),
            "rationale": rationale,
            "confidence": 0.4  # Lower confidence for heuristic
        }
    
    def _build_api_prompt(self, group_docs: List[dict]) -> str:
        """Build prompt for API mode"""
        
        articles_text = "\n\n".join([
            f"Article {i+1}:\n"
            f"Source: {doc.get('source_id', 'unknown')} (Trust: {doc.get('trust', 0.5):.2f})\n"
            f"Title: {doc.get('title', '')}\n"
            f"Text: {doc.get('text', '')[:500]}...\n"
            f"Quick Score: {doc.get('quick_score', 0):.2f}"
            for i, doc in enumerate(group_docs[:5])
        ])
        
        prompt = f"""Analyze these news articles and provide:
1. A 2-3 sentence summary
2. An impact score from -100 to +100
3. Brief rationale
4. Confidence (0.0 to 1.0)

{articles_text}

Respond with JSON:
{{
  "summary": "...",
  "impact_points": 0.0,
  "rationale": "...",
  "confidence": 0.0
}}"""
        
        return prompt
    
    def _parse_json_response(self, text: str) -> Dict:
        """Parse JSON from LLM response"""
        
        try:
            # Find JSON block
            start = text.find("{")
            end = text.rfind("}") + 1
            
            if start == -1 or end == 0:
                raise ValueError("No JSON found")
            
            json_str = text[start:end]
            data = json.loads(json_str)
            
            # Validate
            return {
                "summary": data.get("summary", "")[:500],
                "impact_points": max(-100, min(100, float(data.get("impact_points", 0)))),
                "rationale": data.get("rationale", "")[:300],
                "confidence": max(0.0, min(1.0, float(data.get("confidence", 0.5))))
            }
        
        except Exception as e:
            logger.warning(f"Failed to parse JSON: {e}")
            return self._empty_summary()
    
    def _empty_summary(self) -> Dict:
        """Return empty summary"""
        return {
            "summary": "No articles to summarize.",
            "impact_points": 0.0,
            "rationale": "Empty input",
            "confidence": 0.0
        }
    
    def get_input_hash(self, group_docs: List[dict]) -> str:
        """Generate hash of input for caching/deduplication"""
        
        # Create deterministic string from docs
        doc_ids = sorted([
            f"{doc.get('title', '')}:{doc.get('source_id', '')}"
            for doc in group_docs
        ])
        
        input_str = "|".join(doc_ids)
        return hashlib.sha256(input_str.encode()).hexdigest()


# Global singleton
_llm_client: Optional[LLMClient] = None

def get_llm_client() -> LLMClient:
    """Get global LLM client instance"""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client
