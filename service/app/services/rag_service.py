from google import genai
import os

from dotenv import load_dotenv

from app.services.vector_service import search_knowledge


load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def ask_knowledge(question, user_id, context=""):

    # --------------------------------
    # 1. Use selected knowledge context
    # --------------------------------

    if context and context.strip():

        prompt = f"""
You are an AI assistant for a personal knowledge vault.

Answer the user's question using ONLY the knowledge provided below.

KNOWLEDGE CONTEXT:
{context}

USER QUESTION:
{question}

Instructions:
- Use the knowledge context to answer the question.
- Give a clear and concise answer.
- Do not invent facts.
- If the answer is not available in the knowledge context,
  say that it is not found in the selected knowledge.
"""

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt
        )

        return {
            "answer": response.text,
            "sources": []
        }

    # --------------------------------
    # 2. Fallback to vector search
    # --------------------------------

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

    # --------------------------------
    # 3. Build context from vector search
    # --------------------------------

    context_parts = []

    for index, document in enumerate(documents):

        metadata = (
            metadatas[index]
            if index < len(metadatas)
            else {}
        )

        title = metadata.get(
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

    # --------------------------------
    # 4. Ask Gemini
    # --------------------------------

    prompt = f"""
You are an AI assistant for a personal knowledge vault.

Answer the user's question directly and naturally using the knowledge below.

KNOWLEDGE:
{context}

QUESTION:
{question}

Instructions:
- Give only the answer to the question.
- Do not say "Based on the provided context".
- Do not say "According to the provided context".
- Do not mention "the context", "knowledge context", or "knowledge vault".
- Do not explain where the information came from.
- Do not invent information.
- If the answer cannot be found in the knowledge, say:
  "I couldn't find this information in your selected knowledge."
- Keep the answer concise and natural.
"""

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt
    )

    # --------------------------------
    # 5. Sources
    # --------------------------------

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