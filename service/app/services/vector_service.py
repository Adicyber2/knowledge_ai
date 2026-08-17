import chromadb

from app.services.embedding_service import generate_embedding


client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = client.get_or_create_collection(
    name="knowledge"
)


def store_embedding(
    knowledge_id,
    text,
    embedding,
    metadata
):
    collection.add(
        ids=[str(knowledge_id)],
        documents=[text],
        embeddings=[embedding],
        metadatas=[metadata]
    )


def search_knowledge(
    query,
    user_id,
    limit=5
):

    query_embedding = generate_embedding(query)

    results = collection.query(
        query_embeddings=[query_embedding],

        n_results=limit,

        where={
            "userId": user_id
        },

        include=[
            "documents",
            "metadatas",
            "distances"
        ]
    )

    return results
  

    