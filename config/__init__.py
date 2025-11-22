"""
Everything Market - Configuration Package
==========================================

Single source of truth for system constants and environment variables.

Usage:
    # Import all constants
    from config import constants
    print(constants.SIMILARITY_DUPLICATE)  # 0.88
    
    # Or import specific constants
    from config.constants import SIMILARITY_DUPLICATE, LLM_QUICK_THRESHOLD
    
    # Load and access environment variables
    from config.env import Config
    config = Config()
    print(config.database_url)
    
    # Or use individual getters
    from config.env import get_database_url, get_poll_interval
    db_url = get_database_url()
"""

# Version
__version__ = "0.1.0"

# Make constants easily accessible
from config import constants
from config import env

# Convenience exports
from config.env import Config, ConfigurationError, load_env

__all__ = [
    "constants",
    "env",
    "Config",
    "ConfigurationError",
    "load_env",
]
