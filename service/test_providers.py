"""
test_providers.py — Verification script for AI Provider Architecture
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.providers.provider_manager import get_provider_manager, ProviderManager
from app.services.providers.gemini_provider import GeminiProvider
from app.services.providers.mistral_provider import MistralProvider
from app.schemas.ai_schema import AIContentResult


def test_provider_manager_init():
    print("[TEST 1] Testing ProviderManager initialization...")
    pm = get_provider_manager()
    print(f"  Primary Provider: {pm.primary.provider_name} ({pm.primary.model_name})")
    print(f"  Secondary Provider: {pm.secondary.provider_name} ({pm.secondary.model_name})")
    assert pm.primary.provider_name == "mistral", "Primary provider should be mistral by default"
    assert pm.secondary.provider_name == "gemini", "Secondary provider should be gemini by default"
    print("  [PASS]: ProviderManager initialized correctly\n")


def test_fallback_mechanism():
    print("[TEST 2] Testing Fallback Mechanism (Primary Mistral Fails -> Secondary Gemini Activates)...")

    class FailingMistralProvider(MistralProvider):
        def process_content(self, *args, **kwargs):
            raise Exception("Simulated Mistral 503 Service Unavailable")

    class MockedGeminiProvider(GeminiProvider):
        def process_content(self, *args, **kwargs):
            return AIContentResult(
                title="React Hooks Overview",
                summary="React Hooks enable stateful logic in function components.",
                category="Frontend Development",
                tags=["React", "JavaScript", "Hooks"],
                topics=["React Development", "State Management"],
                entities=["React"]
            )

    pm = ProviderManager()
    pm.primary = FailingMistralProvider()
    pm.secondary = MockedGeminiProvider()

    test_content = "React Hooks allow functional components to use state and other React features."
    
    result, meta = pm.process_content(
        title="React Hooks Guide",
        content=test_content,
        source_type="article",
        source_url="https://react.dev"
    )

    print(f"  Fallback Provider Activated: {meta.get('provider')}")
    print(f"  Status: {meta.get('status')}")
    print(f"  Generated Title: '{result.title}'")
    print(f"  Generated Summary: '{result.summary}'")
    print(f"  Category: '{result.category}'")
    print(f"  Tags: {result.tags}")

    assert meta.get("provider") == "gemini", "Provider must be gemini after fallback"
    assert meta.get("status") == "fallback", "Status must be fallback"
    assert result.title == "React Hooks Overview", "Title must match secondary response"
    print("  [PASS]: Fallback mechanism executed seamlessly and returned normalized output!\n")


if __name__ == "__main__":
    print("========================================")
    print("AI PROVIDER ARCHITECTURE VERIFICATION")
    print("========================================\n")
    test_provider_manager_init()
    test_fallback_mechanism()
    print("========================================")
    print("ALL TESTS COMPLETED SUCCESSFULLY")
    print("========================================")
