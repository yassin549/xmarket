"""
Reality Engine - Prompt Template
================================

Handles formatting of prompts for the LLM to ensure consistent,
schema-compliant outputs.
"""

import json
from typing import List, Dict, Any

class PromptTemplate:
    """
    Manages the construction of prompts for the LLM.
    Enforces strict JSON output format.
    """
    
    SYSTEM_PROMPT = """You are a financial analyst AI. Your task is to analyze news articles and extract structured market impact data.
You must output ONLY valid JSON. No other text, no markdown formatting, no explanations outside the JSON.
"""

    USER_TEMPLATE = """Analyze the following news articles about {stocks} and determine the market impact.

CONTEXT:
- Quick Score: {quick_score} (Sentiment-based score from -1.0 to 1.0)
- Source Trust: {avg_trust:.2f} (0.0 to 1.0)

ARTICLES:
{articles_text}

INSTRUCTIONS:
1. Summarize the key events in under 1000 characters.
2. Estimate impact_suggestion (-100 to +100). Positive = bullish, Negative = bearish.
3. Provide a confidence score (0.0 to 1.0).
4. Provide a concise rationale.

REQUIRED OUTPUT FORMAT (JSON ONLY):
{{
  "summary": "string",
  "impact_suggestion": float,
  "confidence": float,
  "rationale": "string"
}}
"""

    @classmethod
    def format_prompt(cls, 
                      articles: List[Dict[str, Any]], 
                      stocks: List[str], 
                      quick_score: float) -> str:
        """
        Construct the full prompt from articles and metadata.
        
        Args:
            articles: List of article dicts (must have 'title' and 'summary' or 'content')
            stocks: List of stock symbols involved
            quick_score: Deterministic sentiment score
            
        Returns:
            Formatted prompt string
        """
        # Calculate average trust
        trust_sum = sum(a.get('source', {}).get('trust', 0.5) for a in articles)
        avg_trust = trust_sum / len(articles) if articles else 0.5
        
        # Format article texts (truncate to avoid context window overflow)
        # TinyLlama has 2048 context, so we need to be conservative
        formatted_articles = []
        for i, art in enumerate(articles, 1):
            title = art.get('title', 'No Title')
            # Prefer summary if available, else truncated content
            text = art.get('summary') or art.get('content', '') or ''
            text = text[:500] + "..." if len(text) > 500 else text
            formatted_articles.append(f"[{i}] {title}\n{text}")
            
        articles_text = "\n\n".join(formatted_articles)
        
        # Fill template
        return cls.USER_TEMPLATE.format(
            stocks=", ".join(stocks),
            quick_score=quick_score,
            avg_trust=avg_trust,
            articles_text=articles_text
        )

    @classmethod
    def get_chat_messages(cls, prompt: str) -> List[Dict[str, str]]:
        """
        Get messages formatted for chat models (TinyLlama-Chat).
        """
        return [
            {"role": "system", "content": cls.SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]
