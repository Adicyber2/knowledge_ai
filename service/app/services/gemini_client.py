"""
gemini_client.py — Centralized Gemini Client, Retry Handler & Error Handling
"""

import time
import random
from typing import Callable, Any
from google import genai
from google.genai import types
from google.genai.errors import APIError, ServerError, ClientError

from app.config import (
    DEFAULT_MODEL,
    GEMINI_API_KEY,
    MAX_RETRIES,
    INITIAL_RETRY_DELAY,
    BACKOFF_FACTOR,
)


class GeminiUnavailableError(Exception):
    """Raised when Gemini service is temporarily unavailable (503/429) after retries."""
    pass


class GeminiConfigError(Exception):
    """Raised when Gemini fails due to authentication or invalid API key (401/403)."""
    pass


class GeminiInvalidRequestError(Exception):
    """Raised when request payload or parameters are invalid (400)."""
    pass


# Shared GenAI Client instance
client = genai.Client(api_key=GEMINI_API_KEY)


def get_genai_client() -> genai.Client:
    """Return the central GenAI client instance."""
    return client


def get_default_config(
    response_mime_type: str = None,
    response_schema: Any = None,
) -> types.GenerateContentConfig:
    """
    Construct GenerateContentConfig with Automatic Function Calling (AFC) explicitly disabled.
    This resolves the AFC recommendation warning when tools/functions are not needed.
    """
    kwargs = {
        "automatic_function_calling": types.AutomaticFunctionCallingConfig(disable=True)
    }

    if response_mime_type:
        kwargs["response_mime_type"] = response_mime_type
    if response_schema:
        kwargs["response_schema"] = response_schema

    return types.GenerateContentConfig(**kwargs)


def is_transient_error(e: Exception) -> bool:
    """
    Determine if an error is transient (e.g. 503 Unavailable, 429 Rate Limit, 500/502/504 Server Error).
    """
    code = getattr(e, "code", None) or getattr(e, "status_code", None)
    err_str = str(e).lower()

    # Check status codes
    if code in (503, 429, 500, 502, 504):
        return True

    # Check ServerError type
    if isinstance(e, ServerError):
        return True

    # Check error text keywords
    transient_keywords = [
        "503",
        "429",
        "unavailable",
        "high demand",
        "spikes in demand",
        "rate limit",
        "resource_exhausted",
        "temporarily unavailable",
        "try again later",
    ]

    for kw in transient_keywords:
        if kw in err_str:
            return True

    return False


def call_gemini_with_retry(
    fn: Callable[[], Any],
    max_retries: int = MAX_RETRIES,
    initial_delay: float = INITIAL_RETRY_DELAY,
    backoff_factor: float = BACKOFF_FACTOR,
) -> Any:
    """
    Execute a Gemini API call with exponential backoff for transient errors (503, 429).
    Does NOT retry permanent errors (400, 401, 403, 404).
    """
    delay = initial_delay
    print("[AI SERVICE] Gemini request started")

    for attempt in range(1, max_retries + 1):
        try:
            result = fn()
            print("[AI SERVICE] Gemini request succeeded")
            return result
        except Exception as e:
            if not is_transient_error(e):
                # Permanent error — do not retry
                code = getattr(e, "code", None) or getattr(e, "status_code", None)
                print(f"[AI SERVICE] Non-transient Gemini error ({code or type(e).__name__}): {e}")

                if code in (401, 403) or "unauthorized" in str(e).lower() or "api_key" in str(e).lower():
                    raise GeminiConfigError(f"Gemini authentication or configuration error: {e}")
                elif code == 400:
                    raise GeminiInvalidRequestError(f"Invalid request to Gemini: {e}")
                raise e

            # Transient error — print log and attempt backoff retry
            code_str = getattr(e, "code", None) or "503/transient"
            print(f"[AI SERVICE] Gemini returned {code_str} (attempt {attempt}/{max_retries})")

            if attempt == max_retries:
                print(f"[AI SERVICE] All {max_retries} retries exhausted for Gemini request")
                raise GeminiUnavailableError(
                    "Gemini service temporarily unavailable due to high demand (503)"
                )

            jitter = random.uniform(0.1, 0.4)
            sleep_time = delay + jitter
            print(f"[AI SERVICE] Retrying request ({attempt}/{max_retries}) in {sleep_time:.1f}s...")
            time.sleep(sleep_time)
            delay *= backoff_factor
