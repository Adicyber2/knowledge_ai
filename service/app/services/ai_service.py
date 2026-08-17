import os

from dotenv import load_dotenv
from google import genai

from app.schemas.ai_schema import AIContentResult

from app.services.embedding_service import generate_embedding
from app.services.vector_service import store_embedding


load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def process_content(
    knowledge_id,
    user_id,
    title,
    content,
    source_type,
    source_url
):

    # -------------------------
    # 1. Gemini AI Analysis
    # -------------------------

    prompt = f"""
Analyze this content.

Title:
{title}

Content:
{content}

Generate a short summary and 3 to 6 relevant tags.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": AIContentResult,
        },
    )

    result = response.parsed


    # -------------------------
    # 2. Generate Embedding
    # -------------------------

    embedding = generate_embedding(content)


    # -------------------------
    # 3. Store Vector
    # -------------------------

    store_embedding(
        knowledge_id=knowledge_id,
        text=content,
        embedding=embedding,
        metadata={
            "knowledgeId": knowledge_id,
            "userId": user_id,
            "title": title,
            "sourceType": source_type,
            "sourceUrl": source_url or ""
        }
    )


    # -------------------------
    # 4. Return AI Result
    # -------------------------

    return result