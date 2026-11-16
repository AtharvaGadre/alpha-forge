# Deployment

Astraeus is a single Node service: Express serves the API and the built Vite bundle.

```bash
npm ci && npm run build
PORT=3000 npm start            # NODE_ENV=production tsx server.ts
# or
docker build -t astraeus . && docker run -p 3000:3000 astraeus
```

Optional environment: `GEMINI_API_KEY` (narrative rephrasing only; all numbers are deterministic). The issued-forecast ledger is written to `.astraeus-data/` — mount a volume to keep it across restarts. Open-Meteo and Yahoo free endpoints are licensed for non-commercial use; a commercial deployment needs their paid plans.

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
