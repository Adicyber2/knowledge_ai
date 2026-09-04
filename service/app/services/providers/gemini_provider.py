"""
gemini_provider.py — Primary Google Gemini Provider Implementation
"""

import base64
from google.genai import types

from app.config import GEMINI_MODEL
from app.schemas.ai_schema import AIContentResult, RelationshipsResult
from app.services.providers.base_provider import BaseAIProvider
from app.services.gemini_client import (
    get_genai_client,
    get_default_config,
    call_gemini_with_retry,
)


class GeminiProvider(BaseAIProvider):

    def __init__(self):
        self.client = get_genai_client()
        self._model = GEMINI_MODEL

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model

    def process_content(
        self,
        title: str,
        content: str,
        source_type: str = "article",
        source_url: str = None
    ) -> AIContentResult:

        prompt = f"""You are an AI assistant for a personal Knowledge Vault.

Analyze the content below and produce structured output.

ORIGINAL TITLE (do NOT simply copy this):
{title}

SOURCE TYPE: {source_type or 'article'}
SOURCE URL: {source_url or 'N/A'}

CONTENT:
{content[:6000]}

INSTRUCTIONS:
1. TITLE: Generate a concise, meaningful 3-8 word title that captures the ACTUAL subject matter of the content. 
   - Do NOT copy the original title.
   - Do NOT use generic names like "Article", "Web Page", "Google Search", "Untitled", "Document".
   - The title should help a human immediately understand what this knowledge is about.
   - Examples of GOOD titles: "React Hooks & Component Lifecycle", "RAG & Vector Database Fundamentals", "Python Async Programming Patterns"
   - Examples of BAD titles: "Article", "Google Search", "Web Development", "JavaScript"

2. SUMMARY: Write a concise 1-3 sentence summary explaining what the content is about. Do not hallucinate.

3. CATEGORY: Pick a single primary category. Choose from: 'Frontend Development', 'Backend Development', 'AI & Machine Learning', 'Database', 'DevOps', 'Security', 'Mobile Development', 'General'.

4. TAGS: Generate 3-8 short, technically meaningful tags. Normalize capitalization (e.g., "React" not "react"). Avoid duplicates.

5. TOPICS: List 2-5 main conceptual topics covered.

6. ENTITIES: List key named entities (libraries, frameworks, tools, concepts, people) mentioned.
"""

        gen_config = get_default_config(
            response_mime_type="application/json",
            response_schema=AIContentResult,
        )

        def _call():
            return self.client.models.generate_content(
                model=self._model,
                contents=prompt,
                config=gen_config,
            )

        response = call_gemini_with_retry(_call)
        result = response.parsed
        return result

    def analyze_relationships(
        self,
        new_title: str,
        new_summary: str,
        new_tags: list[str],
        new_topics: list[str],
        new_entities: list[str],
        candidates: list[dict]
    ) -> RelationshipsResult:

        if not candidates:
            return RelationshipsResult(relationships=[])

        candidates_text = ""
        for i, c in enumerate(candidates):
            candidates_text += f"""
--- Candidate {i + 1} ---
ID: {c.get('id', '')}
Title: {c.get('title', '')}
Summary: {c.get('summary', '')}
Tags: {', '.join(c.get('tags', []))}
Topics: {', '.join(c.get('topics', []))}
Entities: {', '.join(c.get('entities', []))}
"""

        prompt = f"""You are an AI assistant analyzing relationships between knowledge items in a personal Knowledge Vault.

NEW KNOWLEDGE:
Title: {new_title}
Summary: {new_summary}
Tags: {', '.join(new_tags)}
Topics: {', '.join(new_topics)}
Entities: {', '.join(new_entities)}

EXISTING KNOWLEDGE CANDIDATES:
{candidates_text}

TASK:
For each candidate above, determine whether a MEANINGFUL relationship exists with the new knowledge.

Relationship types available:
- EXTENDS: New knowledge expands on / builds upon the candidate
- PART_OF: New knowledge is a component or subset of the candidate  
- PREREQUISITE_OF: Candidate knowledge is a prerequisite to understanding the new knowledge
- DEPENDS_ON: New knowledge requires understanding of the candidate
- SIMILAR_TO: Both cover the same topic from different angles
- RELATED_TO: General related topics
- EXPLAINS: New knowledge explains a concept from the candidate
- USES: New knowledge uses tools/frameworks from the candidate
- ABOUT: Both are about the same primary subject
- BUILT_WITH: Technology or tool used to build/implement the candidate
- USED_FOR: Use case or application of the candidate technology

IMPORTANT RULES:
- Only create a relationship if there is genuine semantic connection.
- Do NOT create a relationship just because two items share one generic tag (like "JavaScript" or "Python").
- Confidence must reflect how meaningful the relationship truly is.
- Only include relationships with confidence >= 0.60.
- If no meaningful relationship exists, return an empty relationships list.

Return only relationships that are genuinely meaningful and informative.
"""

        gen_config = get_default_config(
            response_mime_type="application/json",
            response_schema=RelationshipsResult,
        )

        def _call():
            return self.client.models.generate_content(
                model=self._model,
                contents=prompt,
                config=gen_config,
            )

        response = call_gemini_with_retry(_call)
        return response.parsed or RelationshipsResult(relationships=[])

    def generate_rag_answer(
        self,
        question: str,
        context: str
    ) -> str:

        prompt = f"""You are an AI assistant for a personal Knowledge Vault.

Answer the user's question directly, clearly, and naturally using ONLY the Knowledge Vault context provided below.

KNOWLEDGE VAULT CONTEXT:
{context}

USER QUESTION:
{question}

CRITICAL INSTRUCTIONS:
- Answer the question strictly using facts directly stated in the Knowledge Vault Context.
- Do NOT say "Based on the provided context" or "According to the context".
- Do NOT invent facts, citations, or draw from external knowledge.
- If the Knowledge Vault Context does not contain sufficient facts to answer the question, state:
  "I couldn't find enough information about this in your Knowledge Vault."
- Keep your answer clear, concise, and helpful.
"""

        gen_config = get_default_config()

        def _call():
            return self.client.models.generate_content(
                model=self._model,
                contents=prompt,
                config=gen_config,
            )

        response = call_gemini_with_retry(_call)
        return response.text or ""

    def ocr_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg"
    ) -> str:

        image_bytes = base64.b64decode(image_base64)
        gen_config = get_default_config()

        def _call_ocr():
            return self.client.models.generate_content(
                model=self._model,
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                    "Extract all text from this image. Return only the raw extracted text. If no text is present, respond exactly with 'NO_TEXT_FOUND'."
                ],
                config=gen_config,
            )

        response = call_gemini_with_retry(_call_ocr)
        text = (response.text or "").strip()

        if not text or text == "NO_TEXT_FOUND" or len(text) < 5:
            def _call_fallback():
                return self.client.models.generate_content(
                    model=self._model,
                    contents=[
                        types.Part.from_bytes(
                            data=image_bytes,
                            mime_type=mime_type,
                        ),
                        "Describe the contents, visual information, diagrams, or key details in this image so it can be saved as a knowledge entry in a knowledge vault."
                    ],
                    config=gen_config,
                )

            fallback_response = call_gemini_with_retry(_call_fallback)
            text = (fallback_response.text or "Visual content from uploaded image.").strip()

        return text
