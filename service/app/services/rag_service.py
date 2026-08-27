from google import genai
import os
from dotenv import load_dotenv

from app.services.vector_service import search_knowledge

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

RELEVANCE_THRESHOLD = 1.40


def ask_knowledge(question: str, user_id: str, context: str = ""):
    """
    Automatic RAG pipeline with Gemini 2.5 Flash:
    1. If hybrid context is provided by Node backend, use it directly.
    2. Otherwise perform vector search in ChromaDB filtered strictly by user_id.
    3. Synthesize grounded answer with Gemini 2.5 Flash.
    4. Return answer + sources.
    """

    print(f"\n--- [PYTHON RAG SERVICE LOG] ---")
    print(f"User ID: {user_id}")
    print(f"Question: '{question}'")
    print(f"Incoming Context Provided: {bool(context and context.strip())}")

    # ----------------------------------------------------
    # Case 1: Hybrid Context provided by Node backend
    # ----------------------------------------------------
    if context and context.strip():
        print(f"Context Length: {len(context)} chars")

        prompt = f"""
You are an AI assistant for a personal Knowledge Vault.

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

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        answer_text = response.text or ""
        print(f"Gemini Answer Length: {len(answer_text)} chars")
        print(f"--- [END PYTHON RAG LOG] ---\n")

        return {
            "answer": answer_text,
            "sources": []
        }

    # ----------------------------------------------------
    # Case 2: Direct Vector Search in ChromaDB
    # ----------------------------------------------------
    results = search_knowledge(
        query=question,
        user_id=user_id,
        limit=8
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    print(f"ChromaDB Documents Returned: {len(documents)}")

    if not documents or len(documents) == 0:
        print(f"Result: No documents found in vector DB.")
        print(f"--- [END PYTHON RAG LOG] ---\n")
        return {
            "answer": "I couldn't find enough information about this in your Knowledge Vault.",
            "sources": []
        }

    min_distance = distances[0] if distances else 2.0
    print(f"Min Vector Distance: {min_distance}")

    if min_distance > RELEVANCE_THRESHOLD:
        print(f"Result: Distance {min_distance} > threshold {RELEVANCE_THRESHOLD}. Rejected.")
        print(f"--- [END PYTHON RAG LOG] ---\n")
        return {
            "answer": "I couldn't find enough information about this in your Knowledge Vault.",
            "sources": []
        }

    valid_docs = []
    sources = []
    seen_ids = set()

    for idx, doc in enumerate(documents):
        dist = distances[idx] if idx < len(distances) else 2.0
        if dist > RELEVANCE_THRESHOLD:
            continue

        meta = metadatas[idx] if idx < len(metadatas) else {}
        kn_id = meta.get("knowledgeId", "")
        title = meta.get("title", "Untitled")

        valid_docs.append(f"SOURCE {len(valid_docs) + 1} ({title}):\n{doc}")

        if kn_id and kn_id not in seen_ids:
            seen_ids.add(kn_id)
            sources.append({
                "knowledgeId": kn_id,
                "title": title,
                "sourceType": meta.get("sourceType", "note"),
                "sourceUrl": meta.get("sourceUrl", ""),
            })

    if not valid_docs:
        print(f"Result: No valid docs passed threshold.")
        print(f"--- [END PYTHON RAG LOG] ---\n")
        return {
            "answer": "I couldn't find enough information about this in your Knowledge Vault.",
            "sources": []
        }

    combined_context = "\n\n---\n\n".join(valid_docs)

    prompt = f"""
You are an AI assistant for a personal Knowledge Vault.

Answer the user's question directly, clearly, and naturally using ONLY the Knowledge Vault context below.

KNOWLEDGE VAULT CONTEXT:
{combined_context}

USER QUESTION:
{question}

CRITICAL INSTRUCTIONS:
- Answer the question strictly using facts directly stated in the Knowledge Vault Context.
- Do NOT say "Based on the provided context" or "According to the context".
- Do NOT invent facts or draw from external knowledge.
- If the Knowledge Vault Context does not contain sufficient facts to answer the question, state:
  "I couldn't find enough information about this in your Knowledge Vault."
- Keep your answer clear, natural, and helpful.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    answer_text = response.text or ""
    print(f"Gemini Answer Length: {len(answer_text)} chars")
    print(f"--- [END PYTHON RAG LOG] ---\n")

    return {
        "answer": answer_text,
        "sources": sources
    }