from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import torch
import json
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import config
from config import (
    MODEL_NAME, PORT, CACHE_DIR, MAX_NEW_TOKENS,
    TEMPERATURE, TOP_P, USE_4BIT, DEVICE_MAP
)

app = FastAPI(title="LLM Inference Service", version="1.0.0")

# Global model and tokenizer
model = None
tokenizer = None
model_loaded = False

class Article(BaseModel):
    title: str
    text: str
    source_id: str
    trust: float = 0.5
    quick_score: float = 0.0
    published: Optional[str] = None

class SummarizeRequest(BaseModel):
    articles: List[Article]
    max_length: int = MAX_NEW_TOKENS

class SummarizeResponse(BaseModel):
    summary: str
    impact_points: float
    rationale: str
    confidence: float

@app.on_event("startup")
async def load_model():
    """Load model on startup"""
    global model, tokenizer, model_loaded
    
    try:
        logger.info(f"Loading model: {MODEL_NAME}")
        logger.info(f"Cache directory: {CACHE_DIR}")
        logger.info(f"4-bit quantization: {USE_4BIT}")
        
        # Set cache directory
        os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
        
        from transformers import AutoTokenizer, AutoModelForCausalLM
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, cache_dir=CACHE_DIR)
        
        # Load model with optional quantization
        if USE_4BIT:
            try:
                from transformers import BitsAndBytesConfig
                
                quantization_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_use_double_quant=True
                )
                
                model = AutoModelForCausalLM.from_pretrained(
                    MODEL_NAME,
                    quantization_config=quantization_config,
                    device_map=DEVICE_MAP,
                    cache_dir=CACHE_DIR,
                    low_cpu_mem_usage=True
                )
                logger.info("Model loaded with 4-bit quantization")
            except Exception as e:
                logger.warning(f"4-bit quantization failed: {e}, loading without quantization")
                model = AutoModelForCausalLM.from_pretrained(
                    MODEL_NAME,
                    torch_dtype=torch.float16,
                    device_map=DEVICE_MAP,
                    cache_dir=CACHE_DIR,
                    low_cpu_mem_usage=True
                )
        else:
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                torch_dtype=torch.float16,
                device_map=DEVICE_MAP,
                cache_dir=CACHE_DIR,
                low_cpu_mem_usage=True
            )
        
        model_loaded = True
        logger.info("Model loaded successfully!")
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        model_loaded = False
        raise

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "LLM Inference Service",
        "model": MODEL_NAME,
        "status": "running" if model_loaded else "loading"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    return {
        "status": "healthy",
        "model_loaded": True,
        "model_name": MODEL_NAME
    }

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    """Summarize a group of articles"""
    
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    try:
        logger.info(f"Received summarization request for {len(request.articles)} articles")
        
        # Build prompt
        prompt = build_prompt(request.articles)
        
        # Tokenize
        inputs = tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=2048
        ).to(model.device)
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=request.max_length,
                temperature=TEMPERATURE,
                do_sample=True,
                top_p=TOP_P,
                pad_token_id=tokenizer.eos_token_id
            )
        
        # Decode
        response_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse JSON response
        result = parse_llm_output(response_text, request.articles)
        
        logger.info(f"Generated summary with impact: {result.impact_points}")
        
        return result
    
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def build_prompt(articles: List[Article]) -> str:
    """Build prompt for LLM"""
    
    articles_text = "\n\n".join([
        f"Article {i+1}:\n"
        f"Source: {art.source_id} (Trust: {art.trust:.2f})\n"
        f"Title: {art.title}\n"
        f"Text: {art.text[:500]}...\n"
        f"Quick Score: {art.quick_score:.2f}"
        for i, art in enumerate(articles[:5])  # Limit to 5 articles
    ])
    
    prompt = f"""[INST] You are analyzing news articles to determine their impact on a stock/entity.

{articles_text}

Task:
1. Summarize the key information in 2-3 sentences
2. Assign an impact score from -100 to +100 (negative = bad news, positive = good news, 0 = neutral)
3. Explain your reasoning briefly
4. Estimate confidence (0.0 to 1.0)

Respond ONLY with valid JSON in this exact format:
{{
  "summary": "your 2-3 sentence summary here",
  "impact_points": 75.0,
  "rationale": "brief explanation of the impact score",
  "confidence": 0.85
}}
[/INST]"""
    
    return prompt

def parse_llm_output(text: str, articles: List[Article]) -> SummarizeResponse:
    """Parse LLM output into structured response"""
    
    try:
        # Find JSON block in response
        start = text.find("{")
        end = text.rfind("}") + 1
        
        if start == -1 or end == 0:
            raise ValueError("No JSON found in response")
        
        json_str = text[start:end]
        data = json.loads(json_str)
        
        # Validate and clamp values
        impact_points = float(data.get("impact_points", 0))
        impact_points = max(-100, min(100, impact_points))
        
        confidence = float(data.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))
        
        return SummarizeResponse(
            summary=data.get("summary", "")[:500],  # Limit length
            impact_points=impact_points,
            rationale=data.get("rationale", "")[:300],
            confidence=confidence
        )
    
    except Exception as e:
        logger.warning(f"Failed to parse LLM output: {e}, using fallback")
        
        # Fallback: use heuristic
        avg_quick_score = sum(a.quick_score for a in articles) / len(articles) if articles else 0
        avg_trust = sum(a.trust for a in articles) / len(articles) if articles else 0.5
        
        return SummarizeResponse(
            summary=f"Summary of {len(articles)} articles about related events.",
            impact_points=avg_quick_score * 10 * avg_trust,
            rationale="Fallback heuristic calculation",
            confidence=0.3
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
