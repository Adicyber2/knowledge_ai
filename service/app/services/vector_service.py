import chromadb

from app.services.embedding_service import generate_embedding


client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = client.get_or_create_collection(
    name="knowledge_v2"
)


def store_embedding(
    knowledge_id,
    text,
    embedding,
    metadata
):
    """Store or update a knowledge embedding in ChromaDB."""

    # Sanitize metadata — ChromaDB only accepts str, int, float, bool
    clean_metadata = {}
    for k, v in (metadata or {}).items():
        if v is None:
            clean_metadata[k] = ""
        else:
            clean_metadata[k] = str(v)

    # Use upsert so updating a knowledge item replaces its old embedding
    collection.upsert(
        ids=[str(knowledge_id)],
        documents=[text],
        embeddings=[embedding],
        metadatas=[clean_metadata]
    )


def delete_embedding(knowledge_id):
    """Remove a knowledge item's embedding from ChromaDB."""
    try:
        collection.delete(ids=[str(knowledge_id)])
    except Exception:
        pass


def search_knowledge(
    query,
    user_id="",
    limit=5
):
    """
    Semantic vector search.
    If user_id is provided, filter results to that user.
    """

    query_embedding = generate_embedding(query)

    # Build where clause
    where = None
    if user_id:
        where = {"userId": str(user_id)}

    kwargs = dict(
        query_embeddings=[query_embedding],
        n_results=limit,
        include=[
            "documents",
            "metadatas",
            "distances",
        ]
    )

    if where:
        kwargs["where"] = where

    try:
        results = collection.query(**kwargs)
    except Exception as e:
        # If collection is empty or no results match, return empty
        if "does not have enough elements" in str(e) or "no results" in str(e).lower():
            return {
                "ids": [[]],
                "documents": [[]],
                "metadatas": [[]],
                "distances": [[]],
            }
        raise

    return results