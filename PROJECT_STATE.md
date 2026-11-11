## Real forecast weather layers

The globe starts with precipitation shading and animated 10 m wind. Independent toggles, opacity, and a 72-hour / 3-hour-step timeline control the layers. Commodity markers remain on top and retain their separate interpretation.

`GET /api/v1/weather/globe` requests NOAA GFS Global forecasts through Open-Meteo at 144 global sample points on a coarse 20° lattice (-70° to +70°). Precipitation values are totals for the preceding hour, not 3-hour accumulations. The map interpolates samples for visual context; it is not a high-resolution local weather or hazard product. Wind uses the meteorological FROM direction converted to flow vectors; animated streak timing is illustrative, not a real-time trajectory simulation.

The endpoint caches successful grids for 30 minutes and deduplicates in-flight fetches. Missing values, wrong units and timestamps remain absent. Insufficient grids and runs known to be older than 24 hours are rejected. Missing initialization metadata is explicitly disclosed. Source, retrieved time, model initialization, coverage warnings and SHA-256 provenance are available in the globe's source disclosure. Failed refreshes remove the weather layer rather than substitute fixtures.

## Globe-first landing and navigation

The default web landing page is the restored interactive globe, configured for the commodity catalogue. Hash navigation supports `#globe`, `#markets`, `#watchlist`, `#advanced`, and `#methodology`, including browser back/forward. The brand and Back to globe action return home. Selected commodity, region, analyses and session history remain shared across views.

The globe uses the existing canvas renderer with commodity-region markers, direct marker selection, searchable region cards, sector filters, pointer rotation, scroll zoom, keyboard camera controls and focus/reset buttons. It does not require Cesium, a WebGL context or external imagery downloads in commodity mode. This is a schematic geographic view; legacy synthetic weather fields, wind animation, alerts, buildings and unrelated market hubs are suppressed. Forecast pressure colors reflect retrieved analyses only.

A selected-exposure inspector runs regional live forecasts and opens the commodity dashboard or forecast lab for the same selection. Regions on the far side become visible by rotation or selecting their labelled cards. Several commodities can share a coordinate; the card list disambiguates these exposures.

## Forecast-focused advanced workspace

The active web UI now includes **Linked markets** and **Forecast lab**:
- Transmission map: upstream/downstream mechanism cards with source references, conditions and lags.
- Scenario lab: manual up/down price-pressure scenarios or an existing single-direction forecast seed, one to three steps. Input costs, demand, margins and price pressure retain separate meanings; context-only links do not propagate. No path weights or return targets are invented.
- Regional comparison: actual saved analyses across a commodity's sample regions, with a sequential refresh action.
- Forecast revisions: up to 12 distinct snapshots per commodity/region in the current session. Cache repeats do not count as revisions; different rule versions are not compared as forecast changes.
- Model diagnostics: actual model forecasts, inclusion decisions, initialization timestamps and available held-out rainfall verification. Weather skill is explicitly distinct from price-prediction skill.

`GET /api/v1/commodities/transmission` exposes the mechanism graph; `/api/v1/commodities/transmission/scenario?source=natural-gas&direction=UP&hops=2` traces a manual scenario. Mechanism links are curated hypotheses, not empirically fitted causal coefficients. Background sources are attached to each route. Transport and power transmission depend on local contracts, energy mix and pass-through.

Legacy quant-physics, execution/slippage and factor modules remain source history; they are not advanced navigation in the commodity forecast UI. Mobile migration remains separate.

# Current milestone — forecast-driven commodity research

The web entry point is now a commodity monitor rather than the globe/contract deck.

- 28 commodities across grains/oilseeds, softs, energy, industrial/precious metals and livestock.
- Explicit selectable regional sample points; seasonal crop gates and distinct crop, load, wind and disruption rules.
- Live analysis uses the existing multi-model pipeline with a validated target override. No fixture substitution in the new endpoint.
- /api/v1/commodities and /api/v1/commodities/:id/forecast; 15-minute successful-result cache and in-flight deduplication.
- Prediction-market endpoint returns 410. Legacy trade-idea endpoint returns the catalogue; fixture summaries/news decks return 410.
- Search, sector filters, local watchlist, sequential watchlist analysis, evidence/source inspection and JSON export.
- Price direction is conditional physical pressure, not a validated price forecast. No targets, returns or confidence probabilities are generated.

Limitations: only representative regional points; broad seasonal screens rather than crop phenology; no overnight-frost detection or direct cyclone model; free quotes can be unavailable. Gold/aluminium have no direct weather rule. A point-in-time fundamentals pipeline and walk-forward price model remain necessary for validated price predictions.

Existing globe/research/mobile source is retained for migration, but the web app no longer exposes the old deck. Native mobile still needs migration to the new commodity contract before release.

## Previous milestone (historical)

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
