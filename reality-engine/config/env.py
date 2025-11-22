"""
Environment variable configuration with fallbacks.
Loads from environment with sensible defaults from constants.py.
"""
import os
from typing import Optional
from . import constants


def get_env(key: str, default: Optional[str] = None, required: bool = False) -> str:
    """Get environment variable with optional default and required check."""
    value = os.getenv(key, default)
    if required and value is None:
        raise ValueError(f"Required environment variable {key} is not set")
    return value


# Database
DATABASE_URL = get_env("DATABASE_URL", "sqlite:///./everything_market.db")

# Security secrets
REALITY_API_SECRET = get_env("REALITY_API_SECRET", required=True)
ADMIN_API_KEY = get_env("ADMIN_API_KEY", required=True)
JWT_SECRET = get_env("JWT_SECRET", required=True)

# Service URLs (for inter-service communication)
BACKEND_URL = get_env("BACKEND_URL", "http://localhost:8000")
ORDERBOOK_URL = get_env("ORDERBOOK_URL", "http://localhost:8001")
FRONTEND_URL = get_env("FRONTEND_URL", "http://localhost:3000")

# Reality Engine config
POLL_INTERVAL = int(get_env("POLL_INTERVAL", str(constants.DEFAULT_POLL_INTERVAL)))
LLM_MODE = get_env("LLM_MODE", "heuristic")  # local, tiny, heuristic
LLM_CALLS_PER_HOUR = int(get_env("LLM_CALLS_PER_HOUR", str(constants.LLM_CALLS_PER_HOUR)))

# Server config
PORT = int(get_env("PORT", "8000"))
HOST = get_env("HOST", "0.0.0.0")
WORKERS = int(get_env("WORKERS", "1"))

# Logging
LOG_LEVEL = get_env("LOG_LEVEL", constants.LOG_LEVEL)
LOG_FORMAT = get_env("LOG_FORMAT", constants.LOG_FORMAT)

# Feature flags
ENABLE_LLM = get_env("ENABLE_LLM", "true").lower() == "true"
ENABLE_PLAYWRIGHT = get_env("ENABLE_PLAYWRIGHT", "false").lower() == "true"
ENABLE_METRICS = get_env("ENABLE_METRICS", "true").lower() == "true"

# Development mode
DEBUG = get_env("DEBUG", "false").lower() == "true"
ENVIRONMENT = get_env("ENVIRONMENT", "production")  # development, staging, production


def validate_config():
    """Validate critical configuration on startup."""
    errors = []
    
    # Check required secrets are not default values
    if REALITY_API_SECRET == "changeme":
        errors.append("REALITY_API_SECRET must be set to a secure value")
    
    if ADMIN_API_KEY == "changeme":
        errors.append("ADMIN_API_KEY must be set to a secure value")
    
    # Validate numeric ranges
    if not (1 <= LLM_CALLS_PER_HOUR <= 100):
        errors.append(f"LLM_CALLS_PER_HOUR must be between 1 and 100, got {LLM_CALLS_PER_HOUR}")
    
    if not (10 <= POLL_INTERVAL <= 3600):
        errors.append(f"POLL_INTERVAL must be between 10 and 3600 seconds, got {POLL_INTERVAL}")
    
    if errors:
        raise ValueError(f"Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors))


# Auto-validate on import in production
if ENVIRONMENT == "production":
    validate_config()
