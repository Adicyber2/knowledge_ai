from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ai_service import process_content
from app.services.vector_service import search_knowledge
from app.services.rag_service import ask_knowledge

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
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
    sourceUrl: str | None = None


class KnowledgeRequest(BaseModel):
    title: str
    content: str


@router.post("/analyze")
async def analyze_knowledge(data: KnowledgeRequest):

    result = process_content(
        None,
        data.title,
        data.content,
        "text",
        None
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

    results = search_knowledge(
        data.query,
        data.limit
    )

    return results


@router.post("/ask")
def ask(data: AskRequest):
    print("QUESTION:", data.question)
    print("USER ID:", data.userId)
    print("CONTEXT:", data.context)

    return ask_knowledge(
        question=data.question,
        user_id=data.userId,
        context=data.context
    )