import os

# Model configuration
MODEL_NAME = os.getenv("MODEL_NAME", "mistralai/Mistral-7B-Instruct-v0.2")
PORT = int(os.getenv("PORT", "8001"))
CACHE_DIR = os.getenv("TRANSFORMERS_CACHE", "/app/cache")

# Inference settings
MAX_NEW_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "200"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
TOP_P = float(os.getenv("TOP_P", "0.9"))

# Quantization settings
USE_4BIT = os.getenv("USE_4BIT", "true").lower() == "true"
DEVICE_MAP = os.getenv("DEVICE_MAP", "auto")
