# DEPLOYMENT.md — Cloud Run, Web & Cross-Platform Deployment Guide

## 1. Unified Web & API Gateway (`server.ts`)
AlphaForge Atmosphere runs as a single unified Node.js / Express + Vite production server on port `3000` (or `$PORT` on Google Cloud Run):

```bash
npm ci
npm run lint
npm run build
npm start
```

### Startup Resilience Invariant
- `server.ts` uses `type FunctionDeclaration` and `type LiveServerMessage` so Node.js ESM execution never fails on TypeScript interface erasure.
- If `GEMINI_API_KEY` or `GOOGLE_MAPS_PLATFORM_KEY` is absent, the platform degrades gracefully to deterministic weather-to-market calculations and Esri World Imagery satellite tiles without crashing.

## 2. Python FastAPI Companion Service (`services/fastapi_service/main.py`)
To run the standalone Python FastAPI verification service:

```bash
pip install -r services/fastapi_service/requirements.txt
uvicorn services.fastapi_service.main:app --host 0.0.0.0 --port 8000
```
