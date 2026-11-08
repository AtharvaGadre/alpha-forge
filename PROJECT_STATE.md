# PROJECT_STATE.md — AlphaForge Atmosphere Production State

## Current Milestone: v4.0 — Synchronized 3D Globe, Weather-to-Market Trade Ideas Deck, ARGON Voice & Native Mobile Apps

### Completed Deliverables
1. **100% Lockstep-Synchronized 3D Earth (`src/components/globe/GlobeCanvas.tsx`)**:
   - CesiumJS and the High-Resolution Atmospheric Overlay Canvas share a single interpolated camera pose on every animation frame, pointer drag, and wheel zoom—eliminating any independent/double-globe movement.
2. **Predicted Weather Effects on Financial Markets & Research-Backed Trade Ideas (`src/engine/atmosphereIntelligenceDeckEngine.ts` + `src/App.tsx`)**:
   - Hero right-hand spotlight card and scrollable Under-the-Map Research Deck displaying:
     - **Section 1**: Explicit causal chain (*Observed vs. Predicted Weather Anomaly* → *Physical & Economic Transmission* → *Multi-Model Consensus*) + interactive **Prediction Market & Research-Backed Trade Idea Cards** (`KC=F` ICE Arabica Coffee for Brazil, `JKM-LNG` and `9101.T` for Japan/East Asia, `SSE.L` for UK/North Sea, `CORN`/`XLU` for US, `OMXS30` for Sweden, plus dynamic contracts for any selected country).
     - **Section 2**: **General Trade Ideas from the News & Verified Regional Advisories** mapping meteorological/macro headlines to actionable trade hypotheses and tickers.
     - **Section 3**: **AI Executive Summary at the Bottom** with 1-click ARGON voice narration and 1-click 28-Section Scientific Report generation.
3. **Instant `[DEMO ACCESS]` Workspace Presets**:
   - Top bar selector switching instantaneously between `Guest Explorer`, `Commodity Analyst`, `Weather Researcher`, and `Global Macro Analyst`.
4. **Native Mobile Application (`apps/mobile/` — Flutter + Dart + Swift + Kotlin)**:
   - Complete Flutter + Dart codebase (`lib/main.dart`, `lib/app/atmosphere_app.dart`, `lib/features/globe/native_globe_view.dart`, `lib/features/trade_ideas/trade_ideas_sheet.dart`, `lib/features/argon/argon_orb_sheet.dart`, `lib/features/reports/mobile_report_screen.dart`) with native iOS Swift `AVAudioSession` (`AppDelegate.swift`) and Android Kotlin `AudioManager` (`MainActivity.kt`) bridges.
5. **Shared Backend Services**:
   - Unified Node.js/Express gateway (`server.ts`), Python FastAPI companion microservice (`services/fastapi_service/main.py`), and OpenAPI 3.1 contract (`packages/api_contracts/openapi.yaml`).
