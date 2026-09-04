# Production Deployment Guide (Render)

This document provides instructions for deploying the AI Knowledge Vault application to [Render](https://render.com).

> [!IMPORTANT]
> **SECURITY NOTICE**: NEVER commit actual API keys, database connection URIs, or secret tokens into git repositories or documentation. Configure all secrets directly inside the Render Dashboard under **Environment Variables**.

---

## 1. Backend Web Service Deployment

### Service Settings
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Root Directory**: `backend`

### Required Environment Variables on Render

Configure the following key-value pairs in **Render Dashboard -> Backend Service -> Environment Variables**:

| Variable Name | Description | Example / Recommended Value |
| --- | --- | --- |
| `PORT` | Backend HTTP Port | `3000` |
| `MONGO_URI` | MongoDB Atlas Connection String | `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/knowledge_vault` |
| `JWT_SECRET` | Secret key for JWT auth token signing | `<random-secure-64-char-string>` |
| `AI_SERVICE_URL` | URL of deployed Python AI FastAPI Service | `http://localhost:8000` (or `https://your-ai-service.onrender.com`) |
| `FRONTEND_URL` | Domain URL of deployed React Frontend | `https://your-frontend.onrender.com` |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit Account Public Key | `public_...` |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit Account Private Key (Server-side only) | `private_...` |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit Delivery URL Endpoint | `https://ik.imagekit.io/<your_imagekit_id>` |

---

## 2. Python AI Service Deployment

### Service Settings
- **Environment**: `Python`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Root Directory**: `service`

### Required Environment Variables on Render
| Variable Name | Description | Recommended Value |
| --- | --- | --- |
| `PRIMARY_AI_PROVIDER` | Primary LLM Provider | `mistral` |
| `SECONDARY_AI_PROVIDER` | Secondary Fallback Provider | `gemini` |
| `MISTRAL_API_KEY` | Mistral AI API Key | `<your_mistral_api_key>` |
| `MISTRAL_MODEL` | Mistral Model Name | `open-mistral-7b` |
| `GEMINI_API_KEY` | Google Gemini API Key | `<your_gemini_api_key>` |

---

## 3. ImageKit Cloud Storage Configuration

1. Log into your [ImageKit Dashboard](https://imagekit.io).
2. Go to **Developer Options** -> **API Keys**.
3. Copy **Public Key**, **Private Key**, and **URL Endpoint**.
4. Paste these 3 values into the **Backend Web Service Environment Variables** on Render.
5. Uploaded PDFs will automatically be stored under ImageKit folder `/knowledge/pdfs/` and served over HTTPS CDN.
