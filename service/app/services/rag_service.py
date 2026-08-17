from google import genai
import os

from dotenv import load_dotenv

from app.services.vector_service import search_knowledge


load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

def ask_knowledge(
    question,
    user_id
):

    results = search_knowledge(
        query=question,
        user_id=user_id,
        limit=5
    )

    documents = results.get(
        "documents",
        [[]]
    )[0]

    metadatas = results.get(
        "metadatas",
        [[]]
    )[0]

    if not documents:

        return {
            "answer": (
                "I couldn't find relevant "
                "information in your knowledge vault."
            ),
            "sources": []
        }

    context_parts = []

    for index, document in enumerate(documents):

        title = metadatas[index].get(
            "title",
            "Unknown"
        )

        context_parts.append(
            f"""
SOURCE {index + 1}

Title:
{title}

Content:
{document}
"""
        )

    context = "\n\n---\n\n".join(
        context_parts
    )

    prompt = f"""
You are a Personal Knowledge Assistant.

Answer ONLY using the provided knowledge.

Do not invent information.

Knowledge:

{context}

Question:

{question}

Give a clear and concise answer.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    sources = []

    for metadata in metadatas:

        sources.append({
            "knowledgeId":
                metadata.get("knowledgeId"),

            "title":
                metadata.get("title"),

            "sourceType":
                metadata.get("sourceType"),

            "sourceUrl":
                metadata.get("sourceUrl")
        })

    return {
        "answer": response.text,
        "sources": sources
    }