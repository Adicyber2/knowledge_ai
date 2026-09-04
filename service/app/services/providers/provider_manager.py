"""
provider_manager.py — Central AI Provider Manager with Automatic Fallback
"""

from typing import Tuple, Any
from pydantic import BaseModel

from app.config import PRIMARY_AI_PROVIDER, SECONDARY_AI_PROVIDER
from app.schemas.ai_schema import AIContentResult, RelationshipsResult
from app.services.providers.base_provider import BaseAIProvider
from app.services.providers.gemini_provider import GeminiProvider
from app.services.providers.mistral_provider import MistralProvider


class AllProvidersFailedError(Exception):
    """Raised when both primary and fallback AI providers fail."""
    pass


class ProviderManager:

    def __init__(self):
        self.providers = {
            "gemini": GeminiProvider(),
            "mistral": MistralProvider(),
        }

        primary_name = PRIMARY_AI_PROVIDER.lower()
        secondary_name = SECONDARY_AI_PROVIDER.lower()

        self.primary: BaseAIProvider = self.providers.get(primary_name) or self.providers["mistral"]
        self.secondary: BaseAIProvider = self.providers.get(secondary_name) or self.providers["gemini"]

        # Ensure primary and secondary are distinct if possible
        if self.primary.provider_name == self.secondary.provider_name:
            alt_name = "gemini" if self.primary.provider_name == "mistral" else "mistral"
            self.secondary = self.providers[alt_name]

    def _execute_with_fallback(self, method_name: str, *args, **kwargs) -> Tuple[Any, dict]:
        """
        Execute an AI action on the Primary provider.
        If Primary fails, fall back to Secondary provider.
        Returns tuple of (result, provider_metadata).
        """
        print(f"[PROVIDER MANAGER] Primary provider: {self.primary.provider_name}")
        primary_err_msg = ""

        # 1. Primary Attempt
        try:
            primary_method = getattr(self.primary, method_name)
            result = primary_method(*args, **kwargs)
            metadata = {
                "provider": self.primary.provider_name,
                "model": self.primary.model_name,
                "status": "success",
            }
            return result, metadata

        except Exception as primary_err:
            err_msg = str(primary_err)
            primary_err_msg = err_msg.split("API_KEY=")[0].split("Authorization")[0][:200]
            print(f"[{self.primary.provider_name.upper()}] Failed: {primary_err_msg}")
            print(f"[PROVIDER MANAGER] Primary provider '{self.primary.provider_name}' failed: {primary_err_msg}")
            print(f"[PROVIDER MANAGER] Activating fallback provider '{self.secondary.provider_name}'...")

        # 2. Secondary/Fallback Attempt
        try:
            secondary_method = getattr(self.secondary, method_name)
            result = secondary_method(*args, **kwargs)
            metadata = {
                "provider": self.secondary.provider_name,
                "model": self.secondary.model_name,
                "status": "fallback",
            }
            return result, metadata

        except Exception as secondary_err:
            err_msg = str(secondary_err)
            secondary_err_msg = err_msg.split("API_KEY=")[0].split("Authorization")[0][:200]
            print(f"[{self.secondary.provider_name.upper()}] Failed: {secondary_err_msg}")
            print(f"[PROVIDER MANAGER] Fallback provider '{self.secondary.provider_name}' also failed: {secondary_err_msg}")
            raise AllProvidersFailedError(
                f"Both AI providers failed. Primary ({self.primary.provider_name}): {primary_err_msg} | Fallback ({self.secondary.provider_name}): {secondary_err_msg}"
            )

    def process_content(
        self,
        title: str,
        content: str,
        source_type: str = "article",
        source_url: str = None
    ) -> Tuple[AIContentResult, dict]:
        return self._execute_with_fallback(
            "process_content",
            title=title,
            content=content,
            source_type=source_type,
            source_url=source_url,
        )

    def analyze_relationships(
        self,
        new_title: str,
        new_summary: str,
        new_tags: list[str],
        new_topics: list[str],
        new_entities: list[str],
        candidates: list[dict]
    ) -> Tuple[RelationshipsResult, dict]:
        return self._execute_with_fallback(
            "analyze_relationships",
            new_title=new_title,
            new_summary=new_summary,
            new_tags=new_tags,
            new_topics=new_topics,
            new_entities=new_entities,
            candidates=candidates,
        )

    def generate_rag_answer(
        self,
        question: str,
        context: str
    ) -> Tuple[str, dict]:
        return self._execute_with_fallback(
            "generate_rag_answer",
            question=question,
            context=context,
        )

    def ocr_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg"
    ) -> Tuple[str, dict]:
        return self._execute_with_fallback(
            "ocr_image",
            image_base64=image_base64,
            mime_type=mime_type,
        )


# Global ProviderManager singleton instance
provider_manager = ProviderManager()


def get_provider_manager() -> ProviderManager:
    return provider_manager
