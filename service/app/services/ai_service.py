import os
from dotenv import load_dotenv

from app.schemas.ai_schema import AIContentResult, RelationshipsResult
from app.services.embedding_service import generate_embedding
from app.services.vector_service import store_embedding
from app.services.providers.provider_manager import get_provider_manager, AllProvidersFailedError

load_dotenv()

# Relationship types the AI can assign
VALID_RELATIONSHIP_TYPES = {
    "RELATED_TO", "PART_OF", "EXTENDS", "SIMILAR_TO",
    "PREREQUISITE_OF", "EXPLAINS", "USES", "ABOUT", "DEPENDS_ON",
    "BUILT_WITH", "USED_FOR"
}

# Generic titles to reject — if AI returns one of these, fall back to original
GENERIC_TITLES = {
    "article", "web page", "webpage", "website", "google search",
    "untitled", "unknown", "page", "document", "content",
    "note", "reading", "link", "url", "saved page", "new tab",
    "tab", "text", "result", "search result"
}


def _is_generic_title(title: str) -> bool:
    """Return True if the title is too generic to use."""
    if not title:
        return True
    cleaned = title.strip().lower()
    if cleaned in GENERIC_TITLES:
        return True
    if len(cleaned.split()) < 2:
        return True
    return False


def process_content(
    knowledge_id,
    user_id,
    title,
    content,
    source_type,
    source_url
):
    """
    Analyze content with AI Provider Manager (Gemini Primary + Mistral Secondary).
    Returns tuple of (AIContentResult, provider_metadata).
    Also embeds into ChromaDB if knowledge_id and user_id are provided.
    """
    provider_mgr = get_provider_manager()

    result, metadata = provider_mgr.process_content(
        title=title,
        content=content,
        source_type=source_type or "article",
        source_url=source_url or None,
    )

    # Validate AI title — fall back to original if AI returned something generic
    if result and _is_generic_title(result.title):
        result.title = title

    # Generate Embedding + Store Vector (independent of LLM provider)
    if knowledge_id and user_id:
        embedding = generate_embedding(content)

        store_embedding(
            knowledge_id=knowledge_id,
            text=content,
            embedding=embedding,
            metadata={
                "knowledgeId": knowledge_id,
                "userId": user_id,
                "title": result.title if result else title,
                "sourceType": source_type or "note",
                "sourceUrl": source_url or ""
            }
        )

    return result, metadata


def analyze_relationships(
    new_knowledge_id: str,
    new_title: str,
    new_summary: str,
    new_tags: list,
    new_topics: list,
    new_entities: list,
    candidates: list
):
    """
    Ask AI Provider Manager to determine relationships between new knowledge
    and candidates.
    Returns tuple of (RelationshipsResult, provider_metadata).
    """
    if not candidates:
        return RelationshipsResult(relationships=[]), {"provider": "none", "model": "none"}

    provider_mgr = get_provider_manager()
    return provider_mgr.analyze_relationships(
        new_title=new_title,
        new_summary=new_summary,
        new_tags=new_tags,
        new_topics=new_topics,
        new_entities=new_entities,
        candidates=candidates,
    )
