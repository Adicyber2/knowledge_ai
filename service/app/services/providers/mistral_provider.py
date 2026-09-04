"""
mistral_provider.py — Secondary Mistral AI Provider Implementation
"""

import json
import re
import time
import random
import httpx
from typing import Type, TypeVar
from pydantic import BaseModel

from app.config import (
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    MAX_RETRIES,
    INITIAL_RETRY_DELAY,
    BACKOFF_FACTOR,
)
from app.schemas.ai_schema import AIContentResult, RelationshipsResult
from app.services.providers.base_provider import BaseAIProvider

T = TypeVar("T", bound=BaseModel)


class MistralError(Exception):
    """Base exception for Mistral provider errors."""
    pass


class MistralUnavailableError(MistralError):
    """Raised when Mistral API is unavailable (503/429/500)."""
    pass


class MistralConfigError(MistralError):
    """Raised when Mistral authentication fails (401/403 or missing API key)."""
    pass


def _clean_json_text(text: str) -> str:
    """Extract clean JSON string from raw model text (strips markdown code blocks)."""
    if not text:
        return ""
    text = text.strip()
    # Strip markdown code blocks ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text


def _parse_and_validate(text: str, schema_class: Type[T]) -> T:
    """Safely parse JSON text and validate against a Pydantic schema class."""
    cleaned = _clean_json_text(text)
    data = json.loads(cleaned)
    if isinstance(data, list) and schema_class == RelationshipsResult:
        data = {"relationships": data}
    if hasattr(schema_class, "model_validate"):
        return schema_class.model_validate(data)
    else:
        return schema_class.parse_obj(data)


class MistralProvider(BaseAIProvider):

    def __init__(self):
        self._api_key = MISTRAL_API_KEY
        self._model = MISTRAL_MODEL or "open-mistral-7b"
        self.endpoint = "https://api.mistral.ai/v1/chat/completions"

    @property
    def provider_name(self) -> str:
        return "mistral"

    @property
    def model_name(self) -> str:
        return self._model

    def _call_api(self, messages: list[dict], response_format: dict = None) -> str:
        """Call Mistral Chat Completions API with exponential backoff for transient errors."""
        has_key = bool(self._api_key and self._api_key.strip())
        print(f"[MISTRAL] API key configured: {has_key}")

        if not self._api_key:
            print("[MISTRAL] Request failed: MISTRAL_API_KEY missing")
            print("[MISTRAL] Error message: MISTRAL_API_KEY is missing or empty in environment configuration.")
            raise MistralConfigError("MISTRAL_API_KEY is missing or empty in environment configuration.")

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": 0.2,
        }

        if response_format:
            payload["response_format"] = response_format

        delay = INITIAL_RETRY_DELAY
        print(f"[MISTRAL] Request started (model: {self._model})")

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                with httpx.Client(timeout=45.0) as client:
                    resp = client.post(self.endpoint, headers=headers, json=payload)

                if resp.status_code == 200:
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    print("[MISTRAL] Request succeeded")
                    return content
                elif resp.status_code in (401, 403):
                    print(f"[MISTRAL] Request failed: Authentication error")
                    print(f"[MISTRAL] HTTP status: {resp.status_code}")
                    print(f"[MISTRAL] Error message: HTTP {resp.status_code} Unauthorized / Authentication failure")
                    raise MistralConfigError(f"Mistral authentication error ({resp.status_code})")
                elif resp.status_code in (429, 500, 502, 503, 504):
                    try:
                        resp_data = resp.json()
                        err_detail = resp_data.get("message") or resp_data.get("object") or f"HTTP {resp.status_code}"
                    except Exception:
                        err_detail = f"HTTP {resp.status_code}"
                    print(f"[MISTRAL] Request failed (attempt {attempt}/{MAX_RETRIES})")
                    print(f"[MISTRAL] HTTP status: {resp.status_code}")
                    print(f"[MISTRAL] Error message: {err_detail}")
                    if attempt == MAX_RETRIES:
                        raise MistralUnavailableError(f"Mistral API error HTTP {resp.status_code}: {err_detail}")
                else:
                    print(f"[MISTRAL] Request failed")
                    print(f"[MISTRAL] HTTP status: {resp.status_code}")
                    print(f"[MISTRAL] Error message: HTTP {resp.status_code}")
                    raise MistralError(f"Mistral API returned HTTP {resp.status_code}")

            except (httpx.TimeoutException, httpx.NetworkError) as net_err:
                print(f"[MISTRAL] Request failed: Network/Timeout error (attempt {attempt}/{MAX_RETRIES})")
                print(f"[MISTRAL] Error message: {net_err}")
                if attempt == MAX_RETRIES:
                    raise MistralUnavailableError(f"Mistral connection timeout/failure: {net_err}")

            # Exponential backoff jitter
            jitter = random.uniform(0.1, 0.4)
            sleep_time = delay + jitter
            time.sleep(sleep_time)
            delay *= BACKOFF_FACTOR

        raise MistralUnavailableError("Mistral API call failed after retries.")

    def process_content(
        self,
        title: str,
        content: str,
        source_type: str = "article",
        source_url: str = None
    ) -> AIContentResult:

        prompt = f"""You are an AI assistant for a personal Knowledge Vault.

Analyze the content below and return a valid JSON object strictly matching the schema:

{{
  "title": "3-8 word title capturing actual subject matter",
  "summary": "1-3 sentence concise summary",
  "category": "One of: Frontend Development, Backend Development, AI & Machine Learning, Database, DevOps, Security, Mobile Development, General",
  "tags": ["tag1", "tag2", "tag3"],
  "topics": ["topic1", "topic2"],
  "entities": ["entity1", "entity2"]
}}

ORIGINAL TITLE: {title}
SOURCE TYPE: {source_type or 'article'}
SOURCE URL: {source_url or 'N/A'}

CONTENT:
{content[:6000]}

INSTRUCTIONS:
1. TITLE: 3-8 words. Do NOT simply copy the original title. Avoid generic words like 'Article', 'Document', 'Page', 'Google Search'.
2. SUMMARY: 1-3 concise sentences.
3. CATEGORY: Pick one category.
4. TAGS: 3-8 normalized technical tags.
5. TOPICS: 2-5 conceptual topics.
6. ENTITIES: Key named entities/tools/libraries.

Respond ONLY with valid JSON.
"""

        messages = [
            {"role": "system", "content": "You are a helpful knowledge analysis AI. Return ONLY JSON."},
            {"role": "user", "content": prompt}
        ]

        raw_response = self._call_api(messages, response_format={"type": "json_object"})
        try:
            return _parse_and_validate(raw_response, AIContentResult)
        except Exception as parse_err:
            print(f"[MISTRAL PROVIDER] Failed to parse structured output: {parse_err}")
            raise MistralError(f"Mistral returned invalid JSON output: {parse_err}")

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
"""

        prompt = f"""You are an AI assistant analyzing relationships between knowledge items in a personal Knowledge Vault.

NEW KNOWLEDGE:
Title: {new_title}
Summary: {new_summary}
Tags: {', '.join(new_tags)}
Topics: {', '.join(new_topics)}

EXISTING KNOWLEDGE CANDIDATES:
{candidates_text}

TASK:
Determine meaningful relationships.
Return ONLY valid JSON matching this schema:
{{
  "relationships": [
    {{
      "target_knowledge_id": "candidate_id",
      "relationship_type": "EXTENDS|PART_OF|PREREQUISITE_OF|DEPENDS_ON|SIMILAR_TO|RELATED_TO|EXPLAINS|USES|ABOUT|BUILT_WITH|USED_FOR",
      "confidence": 0.85,
      "reason": "explanation of relationship"
    }}
  ]
}}

Only include relationships with confidence >= 0.60. Return empty array if none found.
"""

        messages = [
            {"role": "system", "content": "You are an AI graph analyzer. Return ONLY JSON."},
            {"role": "user", "content": prompt}
        ]

        raw_response = self._call_api(messages, response_format={"type": "json_object"})
        try:
            return _parse_and_validate(raw_response, RelationshipsResult)
        except Exception as parse_err:
            print(f"[MISTRAL PROVIDER] Failed to parse relationship output: {parse_err}")
            return RelationshipsResult(relationships=[])

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

        messages = [
            {"role": "system", "content": "You are a precise Knowledge Vault AI assistant."},
            {"role": "user", "content": prompt}
        ]

        return self._call_api(messages)

    def ocr_image(
        self,
        image_base64: str,
        mime_type: str = "image/jpeg"
    ) -> str:
        """
        Mistral OCR/Vision implementation.
        If using a vision-capable Mistral model (pixtral-12b-2409), send image payload.
        Otherwise provide fallback description request.
        """
        image_url = f"data:{mime_type};base64,{image_base64}"

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url}
                    },
                    {
                        "type": "text",
                        "text": "Extract all text from this image. If no text is present, describe the image content in detail."
                    }
                ]
            }
        ]

        try:
            # Use pixtral-12b-2409 for image requests if default model is pure text
            vision_model = "pixtral-12b-2409" if "pixtral" in self._model.lower() else "pixtral-12b-2409"
            orig_model = self._model
            self._model = vision_model
            result = self._call_api(messages)
            self._model = orig_model
            return result
        except Exception as e:
            print(f"[MISTRAL PROVIDER] Vision request failed: {e}")
            return "Visual content uploaded by user (OCR text extraction unavailable)."
