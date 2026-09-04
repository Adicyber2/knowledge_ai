# from sentence_transformers import SentenceTransformer


# model = SentenceTransformer(
#     "all-MiniLM-L6-v2"
# )


# def generate_embedding(text: str):

#     embedding = model.encode(text)

#     return embedding.tolist()



import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not configured")

client = genai.Client(api_key=GEMINI_API_KEY)


def generate_embedding(text: str):
    """
    Generate a lightweight embedding using Gemini Embedding API.
    """

    if not text or not text.strip():
        return []

    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=768
        )
    )

    return result.embeddings[0].values