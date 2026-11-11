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

# AlphaForge — Forecast-driven commodity intelligence

The web workspace covers 28 commodities across six sectors. Select a commodity and region, run a live seven-day weather analysis, and inspect conditional physical price pressure, fundamental offsets, provenance and observed market context.

This is a research screen, **not a calibrated price predictor**. Unsupported mechanisms and unavailable data remain visible. No price targets, probabilities, synthetic quotes or fictional backtest results are generated.

## Run and verify

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

The server defaults to http://localhost:3000. No AI API key is needed for commodity analysis. Public weather and unofficial market-data services must be reachable; requests can take about a minute. Results are cached for 15 minutes. Failed requests are not cached.

## Commodity API

- `GET /api/v1/commodities` — coverage and allowed regions.
- `GET /api/v1/commodities/:id/forecast?region=:regionId` — live analysis; 404 for unknown commodities, 400 for invalid regions, 502 when live forecasts cannot be obtained.
- `GET /api/v1/prediction-markets` — 410 (removed).
- Legacy `/api/v1/trade-ideas` now returns the commodity catalogue. Legacy fixture news/summary endpoints return 410.

The UI supports search, sector filtering, watchlists saved on the device, sequential watchlist analysis, source inspection and JSON export. Analysis results themselves remain session-local.

Coverage is a configurable catalogue, not a claim of production-weighted global coverage. To add a commodity, define its symbol, unit, representative regions, sensitivity months, mechanism rules and fundamental checklist in `src/engine/commodityForecastEngine.ts`. Price-model validation is deliberately separate from weather verification.

Native mobile clients still require migration from the retired deck endpoints. Existing historical components and engines remain in the repository but are not exposed by the web entry point.

---
## Historical platform documentation

# AlphaForge — Autonomous Quantitative Research Laboratory

**Repository:** `https://github.com/AtharvaGadre/alpha-forge`  
**Principal Architect Background:** MPhys Physics (University of Sheffield) · MSc Computational Finance (UCL) · Industrial experience in Azure Databricks, Data Factory, SQL, Python, C#, and algorithmic strategy optimization.

---

## 1. Project Motivation & Overview
AlphaForge is a production-grade, open-source autonomous quantitative research laboratory engineered to bridge the gap between theoretical signal discovery and institutional execution reality. Rather than relying on zero-cost or static slippage assumptions, AlphaForge subjects every factor hypothesis to **Monte Carlo microstructure execution simulations**, **Almgren-Chriss optimal liquidation trajectories**, **Square-Root market impact laws**, **Obizhaeva-Wang limit order book resilience decay**, and **Merton jump-diffusion tail shocks**.

## 2. Core Mathematical & Engineering Capabilities
1. **Monte Carlo Execution & Slippage Risk Laboratory (`src/engine/slippageMonteCarlo.ts`)**:
   - **Almgren-Chriss (2000) Optimal Trajectory**: Solves $x(t_k) = Q \frac{\sinh(\kappa(T-t_k))}{\sinh(\kappa T)}$ with urgency $\kappa = \sqrt{\frac{\lambda \sigma^2}{\eta}}$, benchmarked side-by-side against TWAP, U-profile VWAP, and dynamic POV schedules.
   - **Square-Root Market Impact Law**: $\Delta P / P = Y \cdot \sigma_{\text{daily}} \sqrt{Q / V_{\text{ADV}}}$.
   - **Stochastic Volatility & Jump Cascades**: Simulates $M \in [100, 2000]$ paths combining Heston mean-reverting volatility ($\xi$), Poisson jumps ($\lambda_J$), dynamic bid-ask spread widening, and transient order-book depth recovery ($\rho$).
   - **Tail-Risk Shortfall Analytics**: Full Implementation Shortfall histogram, $\text{VaR}_{95}$, $\text{CVaR}_{95}$ (Expected Shortfall), $\text{VaR}_{99}$, $\text{CVaR}_{99}$, and a **4-Regime Volatile Market Stress Matrix** (*Normal Equilibrium*, *Elevated Macro Volatility*, *Flash Crash / Jump Cascade*, and *Order Book Liquidity Drought*).
2. **Point-in-Time Factor Research & Walk-Forward Backtesting (`src/engine/quantEngine.ts`)**:
   - 6 canonical and physics-inspired factor families with Rank IC, IC Decay curves, Quantile Q1–Q5 spreads, factor correlation matrices, and 60% Train / 20% Validation / 20% Locked Out-of-Sample Holdout walk-forward backtests.
3. **QuantPhysics SDE Extension (`src/components/QuantPhysicsLab.tsx`)**:
   - Interactive stochastic differential equation simulations for Ornstein-Uhlenbeck, Heston Stochastic Volatility, Langevin Anharmonic Potential, and GBM baselines with Hurst exponent ($H$) and Shannon entropy ($H_S$) diagnostics.
4. **13-Role Autonomous Research Agents, Improvement Engine & 30-Section Reports (`src/engine/researchOrchestrator.ts`)**:
   - Cooperating specialist agents backed by server-side Gemini (`@google/genai`) + deterministic validation guardrails, 15-field Improvement Cards (`PROPOSED → APPROVED → RUNNING → EVALUATED → ACCEPTED/REJECTED`), and an Exhaustive 30-Section Scientific Report Generator.

## 3. AlphaForge Atmosphere — Live Pipeline (`src/engine/liveAtmospherePipeline.ts`)
ARGON answers questions about **any place** ("Hey ARGON, what could next week's rainfall mean for Brazilian coffee?", "Nairobi", "-21.5, -45.4") with numbers computed from live public data — no fixtures:

| Stage | What runs | Data |
| :--- | :--- | :--- |
| **Resolve** | Region presets (coffee belt, Corn Belt, Texas, NW Europe, Asia, India, cocoa belt) or exact-match geocoding | Open-Meteo Geocoding |
| **Predict** | 8 global models (ECMWF IFS & AIFS, GFS, ICON, UKMO, ARPEGE, JMA, GEM) + ECMWF ENS (51) & GEFS (31) members; stale runs (> 24 h) and short-horizon models are excluded with a stated reason | Open-Meteo Forecast, Ensemble, model metadata |
| **Verify** | What each model forecast 1/3/5 days ahead over the last 40 days, scored against ERA5. Inverse-MSE weights + spread inflation are fitted on the older half and **kept only if they beat equal weights on the unseen newer half** (CRPS) | Open-Meteo Previous-Runs, ERA5 |
| **Model consequences** | 10-year same-week climatology → rainfall / temperature / degree-day / heat / wind anomalies (z-scores) → transmission chains to mapped instruments, observed 5-session price moves, and a 10-year monthly weather-vs-returns test (Pearson r, p) | ERA5, NASA POWER, Yahoo Finance chart endpoint (unofficial) |
| **Explain** | A–F matrix separating observed weather, forecasts, mechanisms, observed prices, conditional hypotheses (with invalidation criteria) and open uncertainties; Gemini may only rephrase these numbers | — |
| **Reproduce** | Ensemble re-computed from published inputs; SHA-256 of all inputs | — |

```bash
curl "http://localhost:3000/api/v2/atmosphere/investigate?q=Brazil%20coffee"   # full JSON incl. every source URL
npm run smoke:live -- "How will the weather in Texas affect power demand next week?"
```
If the live providers are unreachable, ARGON falls back to the built-in demo fixture and labels it **OFFLINE DEMO FIXTURE** in the UI. Free Open-Meteo/Yahoo endpoints are for non-commercial research use; commercial deployment needs the corresponding paid plans.

## 4. Reproducible Local Setup & Verification
```bash
npm install
npm test          # Deterministic maths + live-pipeline unit tests (offline, mocked APIs)
npm run lint      # Runs TypeScript strict check (tsc --noEmit)
npm run build     # Builds production bundle
npm run dev       # Launches Express + Vite full-stack server on http://localhost:3000
```
