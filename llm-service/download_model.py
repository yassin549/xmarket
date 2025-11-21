from transformers import AutoTokenizer, AutoModelForCausalLM
import os
from config import MODEL_NAME, CACHE_DIR

def download_model():
    """Download and cache the model"""
    
    print(f"Downloading model: {MODEL_NAME}")
    print(f"Cache directory: {CACHE_DIR}")
    
    # Set cache directory
    os.environ["TRANSFORMERS_CACHE"] = CACHE_DIR
    
    # Download tokenizer
    print("Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, cache_dir=CACHE_DIR)
    
    # Download model
    print("Downloading model...")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        cache_dir=CACHE_DIR,
        low_cpu_mem_usage=True
    )
    
    print("Model downloaded and cached successfully!")
    print(f"Cache location: {CACHE_DIR}")

if __name__ == "__main__":
    download_model()
