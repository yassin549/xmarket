"""
Tests for config module (constants and environment variables).
Tests Prompt #2 acceptance criteria from prompts.txt.
"""

import os
import pytest
from unittest.mock import patch

from config import constants
from config.env import (
    Config,
    ConfigurationError,
    get_env,
    get_int_env,
    get_database_url,
    get_redis_url,
    get_reality_api_secret,
    get_admin_api_key,
    get_poll_interval,
    get_llm_mode,
    get_llm_calls_per_hour,
)


# ============================================================================
# Test Constants
# ============================================================================

class TestConstants:
    """Test that all constants are defined and have correct values."""
    
    def test_similarity_thresholds(self):
        """Test similarity threshold constants."""
        assert constants.SIMILARITY_DUPLICATE == 0.88
        assert constants.SIMILARITY_GROUP == 0.78
        assert isinstance(constants.SIMILARITY_DUPLICATE, float)
        assert isinstance(constants.SIMILARITY_GROUP, float)
    
    def test_llm_constants(self):
        """Test LLM-related constants."""
        assert constants.LLM_QUICK_THRESHOLD == 0.45
        assert constants.LLM_CALLS_PER_HOUR == 10
        assert isinstance(constants.LLM_QUICK_THRESHOLD, float)
        assert isinstance(constants.LLM_CALLS_PER_HOUR, int)
    
    def test_time_windows(self):
        """Test time window constants."""
        assert constants.VECTOR_WINDOW_SECONDS == 6 * 3600
        assert constants.TAU_SECONDS == 48 * 3600
        assert isinstance(constants.VECTOR_WINDOW_SECONDS, int)
        assert isinstance(constants.TAU_SECONDS, int)
    
    def test_score_limits(self):
        """Test score limit constants."""
        assert constants.DELTA_CAP == 20
        assert constants.SUSPICIOUS_DELTA == 15
        assert isinstance(constants.DELTA_CAP, int)
        assert isinstance(constants.SUSPICIOUS_DELTA, int)
    
    def test_aggregation_params(self):
        """Test aggregation parameter constants."""
        assert constants.EWMA_ALPHA == 0.25
        assert constants.MIN_INDEP_SOURCES == 2
        assert isinstance(constants.EWMA_ALPHA, float)
        assert isinstance(constants.MIN_INDEP_SOURCES, int)
    
    def test_user_agent(self):
        """Test user agent string."""
        assert constants.USER_AGENT == "EverythingMarketBot/0.1 (+mailto:ops@yourdomain.com)"
        assert isinstance(constants.USER_AGENT, str)
        assert "EverythingMarketBot" in constants.USER_AGENT
    
    def test_constants_importable(self):
        """Test that constants can be imported."""
        from config.constants import (
            SIMILARITY_DUPLICATE,
            SIMILARITY_GROUP,
            LLM_QUICK_THRESHOLD,
            VECTOR_WINDOW_SECONDS,
            TAU_SECONDS,
            DELTA_CAP,
            EWMA_ALPHA,
            MIN_INDEP_SOURCES,
            LLM_CALLS_PER_HOUR,
            SUSPICIOUS_DELTA,
            USER_AGENT,
        )
        # If we got here without ImportError, test passes
        assert SIMILARITY_DUPLICATE is not None


# ============================================================================
# Test Environment Variable Loading
# ============================================================================

class TestEnvironmentLoading:
    """Test environment variable loading and validation."""
    
    @patch.dict(os.environ, {}, clear=True)
    def test_missing_required_env_raises_error(self):
        """Test that missing required env variables raise ConfigurationError."""
        with pytest.raises(ConfigurationError) as exc_info:
            get_env("DATABASE_URL")
        assert "DATABASE_URL" in str(exc_info.value)
        assert "not set" in str(exc_info.value)
    
    @patch.dict(os.environ, {"TEST_VAR": "test_value"})
    def test_get_env_returns_value(self):
        """Test that get_env returns the correct value."""
        assert get_env("TEST_VAR") == "test_value"
    
    @patch.dict(os.environ, {}, clear=True)
    def test_optional_env_returns_default(self):
        """Test that optional env variables return defaults."""
        result = get_env("OPTIONAL_VAR", required=False, default="default_value")
        assert result == "default_value"
    
    @patch.dict(os.environ, {"INT_VAR": "42"})
    def test_get_int_env_converts_to_int(self):
        """Test that get_int_env converts string to integer."""
        result = get_int_env("INT_VAR")
        assert result == 42
        assert isinstance(result, int)
    
    @patch.dict(os.environ, {"INT_VAR": "not_a_number"})
    def test_get_int_env_invalid_value_raises_error(self):
        """Test that invalid integer values raise ConfigurationError."""
        with pytest.raises(ConfigurationError) as exc_info:
            get_int_env("INT_VAR")
        assert "must be an integer" in str(exc_info.value)
    
    @patch.dict(os.environ, {}, clear=True)
    def test_get_int_env_optional_returns_default(self):
        """Test that optional int env variables return defaults."""
        result = get_int_env("OPTIONAL_INT", required=False, default=100)
        assert result == 100


# ============================================================================
# Test Specific Environment Getters
# ============================================================================

class TestSpecificEnvGetters:
    """Test specific environment variable getter functions."""
    
    @patch.dict(os.environ, {"DATABASE_URL": "postgresql://localhost/test"})
    def test_get_database_url(self):
        """Test get_database_url function."""
        assert get_database_url() == "postgresql://localhost/test"
    
    @patch.dict(os.environ, {"REDIS_URL": "redis://localhost:6379"})
    def test_get_redis_url(self):
        """Test get_redis_url function."""
        assert get_redis_url() == "redis://localhost:6379"
    
    @patch.dict(os.environ, {"REALITY_API_SECRET": "secret123"})
    def test_get_reality_api_secret(self):
        """Test get_reality_api_secret function."""
        assert get_reality_api_secret() == "secret123"
    
    @patch.dict(os.environ, {"ADMIN_API_KEY": "admin_key_456"})
    def test_get_admin_api_key(self):
        """Test get_admin_api_key function."""
        assert get_admin_api_key() == "admin_key_456"
    
    @patch.dict(os.environ, {}, clear=True)
    def test_get_poll_interval_uses_default(self):
        """Test get_poll_interval uses default when not set."""
        assert get_poll_interval() == 300
    
    @patch.dict(os.environ, {"POLL_INTERVAL": "600"})
    def test_get_poll_interval_from_env(self):
        """Test get_poll_interval reads from environment."""
        assert get_poll_interval() == 600
    
    @patch.dict(os.environ, {}, clear=True)
    def test_get_llm_mode_uses_default(self):
        """Test get_llm_mode uses default when not set."""
        assert get_llm_mode() == "tinyLLama"
    
    @patch.dict(os.environ, {"LLM_MODE": "disabled"})
    def test_get_llm_mode_from_env(self):
        """Test get_llm_mode reads from environment."""
        assert get_llm_mode() == "disabled"
    
    @patch.dict(os.environ, {}, clear=True)
    def test_get_llm_calls_per_hour_uses_default(self):
        """Test get_llm_calls_per_hour uses default from constants."""
        assert get_llm_calls_per_hour() == constants.LLM_CALLS_PER_HOUR
    
    @patch.dict(os.environ, {"LLM_CALLS_PER_HOUR": "20"})
    def test_get_llm_calls_per_hour_from_env(self):
        """Test get_llm_calls_per_hour reads from environment."""
        assert get_llm_calls_per_hour() == 20


# ============================================================================
# Test Config Class
# ============================================================================

class TestConfigClass:
    """Test the Config class wrapper."""
    
    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://localhost/testdb",
        "REDIS_URL": "redis://localhost:6379",
        "REALITY_API_SECRET": "secret",
        "ADMIN_API_KEY": "admin",
    }, clear=True)
    def test_config_initialization(self):
        """Test Config class initialization with required variables."""
        config = Config()
        assert config.database_url == "postgresql://localhost/testdb"
        assert config.redis_url == "redis://localhost:6379"
        assert config.reality_api_secret == "secret"
        assert config.admin_api_key == "admin"
        assert config.poll_interval == 300  # default
        assert config.llm_mode == "tinyLLama"  # default
        assert config.llm_calls_per_hour == 10  # default
    
    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://localhost/testdb",
        "REDIS_URL": "redis://localhost:6379",
        "REALITY_API_SECRET": "secret",
        "ADMIN_API_KEY": "admin",
        "POLL_INTERVAL": "500",
        "LLM_MODE": "skipped",
        "LLM_CALLS_PER_HOUR": "15",
    }, clear=True)
    def test_config_with_custom_values(self):
        """Test Config class with custom environment values."""
        config = Config()
        assert config.poll_interval == 500
        assert config.llm_mode == "skipped"
        assert config.llm_calls_per_hour == 15
    
    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://localhost/testdb",
        "REDIS_URL": "redis://localhost:6379",
        "REALITY_API_SECRET": "secret",
        "ADMIN_API_KEY": "admin",
    }, clear=True)
    def test_config_validation_passes(self):
        """Test Config validation with valid values."""
        config = Config()
        config.validate()  # Should not raise
    
    @patch.dict(os.environ, {
        "DATABASE_URL": "mysql://localhost/testdb",  # Wrong DB type
        "REDIS_URL": "redis://localhost:6379",
        "REALITY_API_SECRET": "secret",
        "ADMIN_API_KEY": "admin",
    }, clear=True)
    def test_config_validation_invalid_database_url(self):
        """Test Config validation fails with non-PostgreSQL URL."""
        config = Config()
        with pytest.raises(ConfigurationError) as exc_info:
            config.validate()
        assert "PostgreSQL" in str(exc_info.value)
    
    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://localhost/testdb",
        "REDIS_URL": "http://localhost:6379",  # Wrong protocol
        "REALITY_API_SECRET": "secret",
        "ADMIN_API_KEY": "admin",
    }, clear=True)
    def test_config_validation_invalid_redis_url(self):
        """Test Config validation fails with non-Redis URL."""
        config = Config()
        with pytest.raises(ConfigurationError) as exc_info:
            config.validate()
        assert "Redis" in str(exc_info.value)
    
    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://localhost/testdb",
        "REDIS_URL": "redis://localhost:6379",
        "REALITY_API_SECRET": "secret",
        "ADMIN_API_KEY": "admin",
        "POLL_INTERVAL": "-100",  # Invalid negative
    }, clear=True)
    def test_config_validation_negative_poll_interval(self):
        """Test Config validation fails with negative poll interval."""
        config = Config()
        with pytest.raises(ConfigurationError) as exc_info:
            config.validate()
        assert "POLL_INTERVAL" in str(exc_info.value)
        assert "positive" in str(exc_info.value)
    
    @patch.dict(os.environ, {
        "DATABASE_URL": "postgresql://localhost/testdb",
        "REDIS_URL": "redis://localhost:6379",
        "REALITY_API_SECRET": "secret",
        "ADMIN_API_KEY": "admin",
        "LLM_MODE": "invalid_mode",
    }, clear=True)
    def test_config_validation_invalid_llm_mode(self):
        """Test Config validation fails with invalid LLM mode."""
        config = Config()
        with pytest.raises(ConfigurationError) as exc_info:
            config.validate()
        assert "LLM_MODE" in str(exc_info.value)


# ============================================================================
# Test Package Imports
# ============================================================================

class TestPackageImports:
    """Test that package-level imports work correctly."""
    
    def test_import_from_package(self):
        """Test importing from config package."""
        from config import constants, env, Config, ConfigurationError
        assert constants is not None
        assert env is not None
        assert Config is not None
        assert ConfigurationError is not None
    
    def test_direct_constant_import(self):
        """Test direct import of specific constants."""
        from config.constants import SIMILARITY_DUPLICATE, USER_AGENT
        assert SIMILARITY_DUPLICATE == 0.88
        assert "EverythingMarketBot" in USER_AGENT
