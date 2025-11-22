"""
Everything Market - Environment Variable Loader
================================================

Loads and validates environment variables required by the system.
Provides type-safe access to configuration from environment.

Security: Never commit .env files or expose secrets in logs.
"""

import os
from typing import Optional
from pathlib import Path

# Import constants for defaults
from config.constants import LLM_CALLS_PER_HOUR


class ConfigurationError(Exception):
    """Raised when required environment variables are missing or invalid."""
    pass


def load_env(env_path: Optional[Path] = None) -> None:
    """
    Load environment variables from .env file if it exists.
    
    Args:
        env_path: Optional path to .env file. Defaults to .env in project root.
    """
    try:
        from dotenv import load_dotenv
        if env_path:
            load_dotenv(env_path)
        else:
            load_dotenv()
    except ImportError:
        # python-dotenv not installed, rely on system environment
        pass


def get_env(key: str, required: bool = True, default: Optional[str] = None) -> str:
    """
    Get environment variable with validation.
    
    Args:
        key: Environment variable name
        required: If True, raises ConfigurationError when not found
        default: Default value if not found (only used when required=False)
        
    Returns:
        Environment variable value
        
    Raises:
        ConfigurationError: When required variable is missing
    """
    value = os.getenv(key)
    
    if value is None:
        if required:
            raise ConfigurationError(
                f"Required environment variable '{key}' is not set. "
                f"Please set it in your .env file or system environment."
            )
        return default or ""
    
    return value


def get_int_env(key: str, required: bool = True, default: Optional[int] = None) -> int:
    """
    Get environment variable as integer.
    
    Args:
        key: Environment variable name
        required: If True, raises ConfigurationError when not found
        default: Default value if not found
        
    Returns:
        Environment variable value as integer
        
    Raises:
        ConfigurationError: When variable is missing or not a valid integer
    """
    value_str = get_env(key, required=False)
    
    if not value_str:
        if required:
            raise ConfigurationError(
                f"Required environment variable '{key}' is not set."
            )
        return default or 0
    
    try:
        return int(value_str)
    except ValueError:
        raise ConfigurationError(
            f"Environment variable '{key}' must be an integer, got: {value_str}"
        )


# ============================================================================
# Required Environment Variables
# ============================================================================

def get_database_url() -> str:
    """Get PostgreSQL database URL (required)."""
    return get_env("DATABASE_URL")


def get_redis_url() -> str:
    """Get Redis connection URL (required)."""
    return get_env("REDIS_URL")


def get_reality_api_secret() -> str:
    """Get HMAC secret for reality-engine -> backend authentication (required)."""
    return get_env("REALITY_API_SECRET")


def get_admin_api_key() -> str:
    """Get admin API key for protected endpoints (required)."""
    return get_env("ADMIN_API_KEY")


# ============================================================================
# Optional Environment Variables (with defaults)
# ============================================================================

def get_poll_interval() -> int:
    """
    Get polling interval for reality-engine (in seconds).
    Default: 300 seconds (5 minutes)
    """
    return get_int_env("POLL_INTERVAL", required=False, default=300)


def get_llm_mode() -> str:
    """
    Get LLM mode configuration.
    Default: "tinyLLama"
    Options: "tinyLLama", "skipped", "disabled"
    """
    return get_env("LLM_MODE", required=False, default="tinyLLama")


def get_llm_calls_per_hour() -> int:
    """
    Get LLM rate limit (calls per hour).
    Default: from constants.LLM_CALLS_PER_HOUR (10)
    """
    return get_int_env("LLM_CALLS_PER_HOUR", required=False, default=LLM_CALLS_PER_HOUR)


def get_llm_device() -> str:
    """
    Get LLM device configuration.
    Default: "cpu"
    Options: "cpu", "cuda", "mps"
    """
    return get_env("LLM_DEVICE", required=False, default="cpu")


def get_llm_model_path() -> Optional[str]:
    """
    Get optional local path for LLM model.
    Default: None (uses HuggingFace cache)
    """
    val = get_env("LLM_MODEL_PATH", required=False)
    return val if val else None


# ============================================================================
# Configuration Class (optional convenience wrapper)
# ============================================================================

class Config:
    """
    Configuration container with all environment variables.
    Load once at application startup.
    """
    
    def __init__(self):
        """Initialize configuration by loading from environment."""
        load_env()
        
        # Required variables
        self.database_url = get_database_url()
        self.redis_url = get_redis_url()
        self.reality_api_secret = get_reality_api_secret()
        self.admin_api_key = get_admin_api_key()
        
        # Optional variables
        self.poll_interval = get_poll_interval()
        self.llm_mode = get_llm_mode()
        self.llm_calls_per_hour = get_llm_calls_per_hour()
        self.llm_device = get_llm_device()
        self.llm_model_path = get_llm_model_path()
    
    def validate(self) -> None:
        """
        Validate configuration values.
        Raises ConfigurationError if any values are invalid.
        """
        if not self.database_url.startswith(("postgresql://", "postgres://")):
            raise ConfigurationError(
                f"DATABASE_URL must be a PostgreSQL URL, got: {self.database_url[:20]}..."
            )
        
        if not self.redis_url.startswith("redis://"):
            raise ConfigurationError(
                f"REDIS_URL must be a Redis URL, got: {self.redis_url[:20]}..."
            )
        
        if self.poll_interval < 1:
            raise ConfigurationError(
                f"POLL_INTERVAL must be positive, got: {self.poll_interval}"
            )
        
        if self.llm_calls_per_hour < 0:
            raise ConfigurationError(
                f"LLM_CALLS_PER_HOUR must be non-negative, got: {self.llm_calls_per_hour}"
            )
        
        valid_llm_modes = {"tinyLLama", "skipped", "disabled"}
        if self.llm_mode not in valid_llm_modes:
            raise ConfigurationError(
                f"LLM_MODE must be one of {valid_llm_modes}, got: {self.llm_mode}"
            )
