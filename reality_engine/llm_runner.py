"""
TinyLlama LLM runner for event summarization and impact assessment.

Uses TinyLlama-1.1B-Chat for:
- Summarizing grouped articles
- Suggesting impact scores
- Providing confidence and rationale

Implements strict JSON output validation per Appendix A.2.
"""

import json
import re
import os
from typing import List, Dict, Any, Optional, Tuple
import logging

# Import with error handling
try:
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
    import torch
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    logging.warning("transformers/torch not installed, LLM will be disabled")

from reality_engine.llm_schema import validate_llm_output, create_llm_fallback_output
from reality_engine.prompt_template import PromptTemplate
from config.env import get_llm_device, get_llm_model_path

logger = logging.getLogger(__name__)

# Global model cache
_MODEL_CACHE: Optional[Tuple] = None
_MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

def _get_model():
    """
    Lazy load model and tokenizer.
    Returns (model, tokenizer, pipeline) tuple.
    """
    global _MODEL_CACHE
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE

    if not HAS_TRANSFORMERS:
        raise ImportError("transformers library not available")

    logger.info(f"Loading LLM model: {_MODEL_NAME}...")
    
    device = get_llm_device()
    model_path = get_llm_model_path() or _MODEL_NAME
    
    # Determine torch dtype and device map
    torch_dtype = torch.float16 if device != "cpu" else torch.float32
    device_map = "auto" if device != "cpu" else None
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForCausalLM.from_pretrained(
            model_path, 
            torch_dtype=torch_dtype,
            device_map=device_map,
            trust_remote_code=False
        )
        
        # Create pipeline for easier generation
        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=512,
            do_sample=True,
            temperature=0.3,
            top_p=0.9,
            repetition_penalty=1.1
        )
        
        _MODEL_CACHE = (model, tokenizer, pipe)
        logger.info("LLM model loaded successfully")
        return _MODEL_CACHE
        
    except Exception as e:
        logger.error(f"Failed to load LLM model: {e}")
        raise

def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract JSON object from text, handling potential markdown blocks.
    """
    # Try to find JSON block in markdown
    json_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        text = json_match.group(1)
    else:
        # Try to find first { and last }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start:end+1]
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None

def analyze_impact(
    articles: List[Dict[str, Any]], 
    stocks: List[str], 
    quick_score: float
) -> Dict[str, Any]:
    """
    Run LLM analysis on a group of articles.
    
    Args:
        articles: List of article dicts
        stocks: List of stock symbols
        quick_score: Deterministic sentiment score
        
    Returns:
        Dict matching LLM output schema (summary, impact_suggestion, etc.)
        Returns fallback object if LLM fails.
    """
    if not HAS_TRANSFORMERS:
        return create_llm_fallback_output(quick_score, "LLM libraries missing")

    try:
        # Get model pipeline
        _, _, pipe = _get_model()
        
        # Format prompt
        prompt_text = PromptTemplate.format_prompt(articles, stocks, quick_score)
        messages = PromptTemplate.get_chat_messages(prompt_text)
        
        # Apply chat template
        prompt = pipe.tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        
        # Run inference
        logger.info(f"Running LLM inference for {stocks} (quick_score={quick_score:.2f})...")
        outputs = pipe(prompt)
        generated_text = outputs[0]["generated_text"]
        
        # Extract response part (remove prompt)
        # TinyLlama chat template usually ends with <|assistant|>
        response_text = generated_text
        if "<|assistant|>" in generated_text:
            response_text = generated_text.split("<|assistant|>")[-1].strip()
            
        # Parse JSON
        data = _extract_json(response_text)
        
        if not data:
            logger.warning("LLM output not valid JSON")
            logger.debug(f"Raw output: {response_text[:200]}...")
            return create_llm_fallback_output(quick_score, "Invalid JSON output")
            
        # Validate schema
        is_valid, error_msg = validate_llm_output(data)
        if is_valid:
            return data
        else:
            logger.warning(f"LLM JSON failed schema validation: {error_msg}")
            return create_llm_fallback_output(quick_score, f"Schema validation failed: {error_msg}")
            
    except Exception as e:
        logger.error(f"LLM inference failed: {e}")
        return create_llm_fallback_output(quick_score, f"Inference error: {str(e)}")

def clear_cache():
    """Clear model from memory (useful for tests)."""
    global _MODEL_CACHE
    _MODEL_CACHE = None
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
