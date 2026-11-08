# API_CONTRACTS.md — Shared Web & Native Mobile API Contracts

The OpenAPI 3.1 specification is stored at `packages/api_contracts/openapi.yaml`. Both the React/TypeScript web platform and the Flutter/Dart native mobile applications consume the same REST and WebSocket endpoints:

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Platform health, dataset snapshot ID, and API key availability status |
| `/api/v1/weather/current` | `GET` | Live Open-Meteo / deterministic point weather telemetry for `lat`, `lng`, `country` |
| `/api/v1/forecasts/compare` | `GET` | Multi-model weather comparison (ECMWF, GFS, GraphCast, WeatherNext, JMA, CPTEC) |
| `/api/v1/trade-ideas` | `GET` | Research-backed weather-to-market trade ideas & prediction market probabilities |
| `/api/v1/prediction-markets` | `GET` | Alias for `/api/v1/trade-ideas` returning prediction market contracts and affected tickers |
| `/api/v1/news-trade-ideas` | `GET` | Verified regional meteorological/macro news and derived trade ideas |
| `/api/v1/ai-summary` | `GET` | Bottom AI executive synthesis of predicted weather effects on financial markets |
| `/api/v1/demo-presets` | `GET` | Instant `[DEMO ACCESS]` workspace presets for Web and Mobile |
| `/api/v1/argon/query` | `POST` | Full ARGON weather-to-market investigation and 28-section report generator |
| `/api/v1/argon/tts` | `POST` | Server-side Gemini 3.8 Flash Lite TTS synthesis (`Zephyr`, `Kore`, `Puck`, `Charon`, `Fenrir`) |
| `/api/v1/argon/live-ws` | `WS` | Bidirectional Gemini Live API voice streaming (`gemini-3.8-live` / `gemini-3.8-live-extended-thinking`) |
