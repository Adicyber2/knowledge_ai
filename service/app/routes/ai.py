from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.services.ai_service import process_content, analyze_relationships
from app.services.vector_service import search_knowledge
from app.services.rag_service import ask_knowledge
from app.services.ocr_service import ocr_image
from app.services.providers.provider_manager import AllProvidersFailedError

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    user_id: str = ""
    limit: int = 5


class AskRequest(BaseModel):
    question: str
    userId: str
    context: str = ""


class ContentRequest(BaseModel):
    knowledgeId: str
    title: str
    userId: str
    content: str
    sourceType: str = "text"
    sourceUrl: Optional[str] = None


class KnowledgeRequest(BaseModel):
    title: str
    content: str
    sourceType: Optional[str] = "article"
    sourceUrl: Optional[str] = None


class OcrRequest(BaseModel):
    imageBase64: str
    mimeType: str = "image/jpeg"


class CandidateKnowledge(BaseModel):
    id: str
    title: str
    summary: str = ""
    tags: list[str] = []
    topics: list[str] = []
    entities: list[str] = []


class RelationshipsRequest(BaseModel):
    newKnowledgeId: str
    newTitle: str
    newSummary: str = ""
    newTags: list[str] = []
    newTopics: list[str] = []
    newEntities: list[str] = []
    candidates: list[CandidateKnowledge] = []


@router.post("/analyze")
async def analyze_knowledge(data: KnowledgeRequest):
    """
    Analyze content and return AI-generated title, summary, tags, topics, entities + provider metadata.
    Does NOT store embedding (no knowledgeId provided).
    """
    try:
        result, metadata = process_content(
            None,       # knowledge_id — not persisting to vector DB
            None,       # user_id
            data.title,
            data.content,
            data.sourceType or "article",
            data.sourceUrl
        )

        if result:
            return {
                "title": result.title,
                "summary": result.summary,
                "category": result.category,
                "tags": result.tags,
                "topics": result.topics,
                "entities": result.entities,
                "provider": metadata.get("provider", "gemini"),
                "model": metadata.get("model", ""),
            }
        return {
            "title": data.title,
            "summary": "",
            "category": "General",
            "tags": [],
            "topics": [],
            "entities": [],
            "provider": metadata.get("provider", "gemini"),
            "model": metadata.get("model", ""),
        }

    except AllProvidersFailedError as e:
        print(f"[AI ROUTE] /analyze 503: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "error": "AI processing temporarily unavailable",
                "message": "Primary and secondary AI models are currently experiencing high demand. Please try again later.",
            },
        )
    except Exception as e:
        print(f"[AI ROUTE] /analyze error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "AI processing error",
                "message": str(e),
            },
        )


@router.post("/process")
def process(data: ContentRequest):
    """
    Process content: AI analysis + store embedding in ChromaDB.
    Returns AI-generated title, summary, tags, topics, entities + provider metadata.
    """
    try:
        result, metadata = process_content(
            data.knowledgeId,
            data.userId,
            data.title,
            data.content,
            data.sourceType,
            data.sourceUrl
        )

        if result:
            return {
                "title": result.title,
                "summary": result.summary,
                "category": result.category,
                "tags": result.tags,
                "topics": result.topics,
                "entities": result.entities,
                "provider": metadata.get("provider", "gemini"),
                "model": metadata.get("model", ""),
            }
        return {
            "title": data.title,
            "summary": "",
            "category": "General",
            "tags": [],
            "topics": [],
            "entities": [],
            "provider": metadata.get("provider", "gemini"),
            "model": metadata.get("model", ""),
        }

    except AllProvidersFailedError as e:
        print(f"[AI ROUTE] /process 503: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "AI processing temporarily unavailable",
                "message": "Primary and secondary AI models are currently experiencing high demand. Please try again later.",
            },
        )
    except Exception as e:
        print(f"[AI ROUTE] /process error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "AI processing error",
                "message": str(e),
            },
        )


@router.post("/relationships")
def find_relationships(data: RelationshipsRequest):
    """
    Ask AI Provider Manager to determine meaningful relationships.
    Returns list of { targetKnowledgeId, type, confidence, reason } + provider metadata.
    """
    candidates = [
        {
            "id": c.id,
            "title": c.title,
            "summary": c.summary,
            "tags": c.tags,
            "topics": c.topics,
            "entities": c.entities,
        }
        for c in data.candidates
    ]

    try:
        result, metadata = analyze_relationships(
            new_knowledge_id=data.newKnowledgeId,
            new_title=data.newTitle,
            new_summary=data.newSummary,
            new_tags=data.newTags,
            new_topics=data.newTopics,
            new_entities=data.newEntities,
            candidates=candidates,
        )

        relationships = []
        if result and result.relationships:
            for r in result.relationships:
                relationships.append({
                    "targetKnowledgeId": r.target_knowledge_id,
                    "type": r.relationship_type,
                    "confidence": r.confidence,
                    "reason": r.reason,
                })

        return {
            "success": True,
            "relationships": relationships,
            "provider": metadata.get("provider", "gemini"),
            "model": metadata.get("model", ""),
        }

    except AllProvidersFailedError as e:
        print(f"[AI ROUTE] /relationships 503: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "AI processing temporarily unavailable",
                "relationships": [],
            },
        )
    except Exception as e:
        print(f"[AI ROUTE] /relationships error: {e}")
        return {
            "success": False,
            "error": str(e),
            "relationships": [],
        }


@router.post("/search")
def search(data: SearchRequest):
    """
    Semantic vector search with optional user_id filtering.
    Returns ChromaDB raw result format.
    """
    results = search_knowledge(
        query=data.query,
        user_id=data.user_id,
        limit=data.limit
    )

    return results


@router.post("/ask")
def ask(data: AskRequest):
    print("QUESTION:", data.question)
    print("USER ID:", data.userId)

    try:
        return ask_knowledge(
            question=data.question,
            user_id=data.userId,
            context=data.context
        )
    except AllProvidersFailedError as e:
        print(f"[AI ROUTE] /ask 503: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "answer": "The AI service is temporarily unavailable due to high demand across AI providers. Please try again in a few moments.",
                "sources": [],
                "error": "AI processing temporarily unavailable",
            },
        )
    except Exception as e:
        print(f"[AI ROUTE] /ask error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "answer": "An error occurred while processing your request.",
                "sources": [],
                "error": str(e),
            },
        )


@router.post("/ocr")
async def ocr(data: OcrRequest):
    """
    OCR via AI Provider Manager — extract text or visual content from image.
    """
    try:
        text, metadata = ocr_image(
            image_base64=data.imageBase64,
            mime_type=data.mimeType
        )

        return {
            "text": text,
            "provider": metadata.get("provider", "gemini"),
            "model": metadata.get("model", ""),
        }
    except AllProvidersFailedError as e:
        print(f"[AI ROUTE] /ocr 503: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "text": "",
                "error": "AI processing temporarily unavailable",
            },
        )
    except Exception as e:
        print(f"[AI ROUTE] /ocr error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "text": "",
                "error": str(e),
            },
        )