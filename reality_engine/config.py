"""
Configuration loader for reality-engine.

Loads sources.yaml and provides access to feed configurations and settings.
"""

import yaml
from pathlib import Path
from typing import Dict, List, Any


def load_sources() -> Dict[str, Any]:
    """
    Load sources.yaml configuration.
    
    Returns:
        Dictionary with 'feeds' and 'settings' keys
    """
    config_path = Path(__file__).parent / "sources.yaml"
    
    if not config_path.exists():
        raise FileNotFoundError(f"sources.yaml not found at {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # Validate required keys
    if 'feeds' not in config:
        raise ValueError("sources.yaml must contain 'feeds' key")
    if 'settings' not in config:
        raise ValueError("sources.yaml must contain 'settings' key")
    
    return config


def get_feed_by_name(name: str) -> Dict[str, Any]:
    """
    Get feed configuration by name.
    
    Args:
        name: Feed name
        
    Returns:
        Feed configuration dict
        
    Raises:
        ValueError: If feed not found
    """
    config = load_sources()
    
    for feed in config['feeds']:
        if feed['name'] == name:
            return feed
    
    raise ValueError(f"Feed '{name}' not found in sources.yaml")


def get_all_feeds() -> List[Dict[str, Any]]:
    """
    Get all feed configurations.
    
    Returns:
        List of feed configuration dicts
    """
    config = load_sources()
    return config['feeds']


def get_settings() -> Dict[str, Any]:
    """
    Get global settings.
    
    Returns:
        Settings dictionary
    """
    config = load_sources()
    return config['settings']
