from fastapi import FastAPI
from app.routes.ai import router

app = FastAPI(
    title="AI Knowledge Vault AI Service",
    version="1.0.0"
)

app.include_router(router, prefix="/api/ai")


@app.get("/")
def home():
    return {
        "message": "AI Service is running 🚀"
    }