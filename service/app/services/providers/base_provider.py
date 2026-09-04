"""
base_provider.py — Abstract Base Class for AI Providers
"""

from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel

from app.schemas.ai_schema import AIContentResult, RelationshipsResult


class BaseAIProvider(ABC):
    """
    Abstract interface that all AI providers (Gemini, Mistral, etc.) must implement.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider identifier (e.g. 'gemini', 'mistral')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return configured model identifier (e.g. 'gemini-3.6-flash', 'mistral-small-latest')."""
        pass

    @abstractmethod
    def process_content(
        self,
        title: str,
        content: str,
        source_type: str = "article",
        source_url: str = None
    ) -> AIContentResult:
        """Analyze knowledge content and return structured AIContentResult."""
        pass

    @abstractmethod
    def analyze_relationships(
        self,
        new_title: str,
        new_summary: str,
        new_tags: list[str],
        new_topics: list[str],
        new_entities: list[str],
        candidates: list[dict]
    ) -> RelationshipsResult:
        """Determine relationships between new knowledge and candidates."""
        pass

    @abstractmethod
    def generate_rag_answer(
        self,
        question: str,
        context: str
    ) -> str:
        """Synthesize RAG answer grounded in context."""
        pass

    @abstractmethod
    def ocr_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg"
    ) -> str:
        """Extract text or visual summary from image."""
        pass
