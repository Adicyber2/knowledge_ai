"""
config.py — Centralized configuration for Python AI Service
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Central Model Configuration
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# Provider Selection
PRIMARY_AI_PROVIDER = os.getenv("PRIMARY_AI_PROVIDER", "mistral").lower()
SECONDARY_AI_PROVIDER = os.getenv("SECONDARY_AI_PROVIDER", "gemini").lower()

# Gemini Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# Mistral Configuration
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "open-mistral-7b")

# Retry Configuration for Transient Errors (503, 429)
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # seconds
BACKOFF_FACTOR = 2.0       # exponential multiplier


def validate_environment():
    """Validate required environment variables on service startup."""
    if not MISTRAL_API_KEY or not MISTRAL_API_KEY.strip():
        err_msg = "MISTRAL_API_KEY is missing or empty in environment configuration."
        print(f"[AI SERVICE ERROR] {err_msg}")
        raise ValueError(err_msg)

