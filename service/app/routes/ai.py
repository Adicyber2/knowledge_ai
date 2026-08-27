from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.services.ai_service import process_content
from app.services.vector_service import search_knowledge
from app.services.rag_service import ask_knowledge
from app.services.ocr_service import ocr_image

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


class OcrRequest(BaseModel):
    imageBase64: str
    mimeType: str = "image/jpeg"


@router.post("/analyze")
async def analyze_knowledge(data: KnowledgeRequest):

    result = process_content(
        None,       # knowledge_id — not persisting to vector DB
        None,       # user_id
        data.title,
        data.content,
        "text",
        None        # source_url
    )

    return result


@router.post("/process")
def process(data: ContentRequest):

    result = process_content(
        data.knowledgeId,
        data.userId,
        data.title,
        data.content,
        data.sourceType,
        data.sourceUrl
    )

    return result


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

    return ask_knowledge(
        question=data.question,
        user_id=data.userId,
        context=data.context
    )


@router.post("/ocr")
async def ocr(data: OcrRequest):
    """
    OCR via Gemini Vision — extract text from image.
    """
    text = ocr_image(
        image_base64=data.imageBase64,
        mime_type=data.mimeType
    )

    return {"text": text}