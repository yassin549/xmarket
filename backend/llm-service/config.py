import os

# Model configuration - Using lightweight TinyLlama for impact estimation
MODEL_NAME = os.getenv("MODEL_NAME", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
PORT = int(os.getenv("PORT", "8001"))
CACHE_DIR = os.getenv("TRANSFORMERS_CACHE", "/app/cache")

# Inference settings
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "200"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
TOP_P = float(os.getenv("TOP_P", "0.9"))

# Quantization settings (not needed for TinyLlama)
USE_4BIT = os.getenv("USE_4BIT", "false").lower() == "true"
DEVICE_MAP = os.getenv("DEVICE_MAP", "auto")
