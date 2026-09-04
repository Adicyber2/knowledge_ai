from app.services.vector_service import search_knowledge
from app.services.providers.provider_manager import get_provider_manager

RELEVANCE_THRESHOLD = 1.40


def ask_knowledge(question: str, user_id: str, context: str = ""):
    """
    Automatic RAG pipeline with AI Provider Manager (Gemini Primary + Mistral Secondary):
    1. If hybrid context is provided by Node backend, use it directly.
    2. Otherwise perform vector search in ChromaDB filtered strictly by user_id.
    3. Synthesize grounded answer using AI Provider Manager.
    4. Return answer + sources + provider metadata.
    """

    print(f"\n--- [PYTHON RAG SERVICE LOG] ---")
    print(f"User ID: {user_id}")
    print(f"Question: '{question}'")
    print(f"Incoming Context Provided: {bool(context and context.strip())}")

    provider_mgr = get_provider_manager()

    # ----------------------------------------------------
    # Case 1: Hybrid Context provided by Node backend
    # ----------------------------------------------------
    if context and context.strip():
        print(f"Context Length: {len(context)} chars")

        answer_text, metadata = provider_mgr.generate_rag_answer(
            question=question,
            context=context,
        )

        print(f"RAG Answer Length: {len(answer_text)} chars (Provider: {metadata.get('provider')})")
        print(f"--- [END PYTHON RAG LOG] ---\n")

        return {
            "answer": answer_text,
            "sources": [],
            "provider": metadata.get("provider", "gemini"),
            "model": metadata.get("model", ""),
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
            "sources": [],
            "provider": provider_mgr.primary.provider_name,
            "model": provider_mgr.primary.model_name,
        }

    min_distance = distances[0] if distances else 2.0
    print(f"Min Vector Distance: {min_distance}")

    if min_distance > RELEVANCE_THRESHOLD:
        print(f"Result: Distance {min_distance} > threshold {RELEVANCE_THRESHOLD}. Rejected.")
        print(f"--- [END PYTHON RAG LOG] ---\n")
        return {
            "answer": "I couldn't find enough information about this in your Knowledge Vault.",
            "sources": [],
            "provider": provider_mgr.primary.provider_name,
            "model": provider_mgr.primary.model_name,
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
            "sources": [],
            "provider": provider_mgr.primary.provider_name,
            "model": provider_mgr.primary.model_name,
        }

    combined_context = "\n\n---\n\n".join(valid_docs)

    answer_text, metadata = provider_mgr.generate_rag_answer(
        question=question,
        context=combined_context,
    )

    print(f"RAG Answer Length: {len(answer_text)} chars (Provider: {metadata.get('provider')})")
    print(f"--- [END PYTHON RAG LOG] ---\n")

    return {
        "answer": answer_text,
        "sources": sources,
        "provider": metadata.get("provider", "gemini"),
        "model": metadata.get("model", ""),
    }
