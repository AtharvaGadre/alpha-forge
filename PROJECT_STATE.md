## Antecedent root-zone soil-moisture context

Crop forecasts add a measured-from-reanalysis land-state signal alongside weather forcing: compute a weekly mean volumetric water content for the top 100 cm, depth-weighting ERA5 layers 0–7, 7–28 and 28–100 cm by their thickness. Compare the latest complete ERA5 7-day window (normally 6–12 days before issuance) against same-calendar 7-day ERA5 windows from ten prior years; only publish a standardized signal when at least eight complete years and all regional sample points are available. A material negative anomaly adds conditional in-season crop-supply pressure. This is lagged modelled reanalysis, not a forecast or field measurement, and does not resolve soil texture, irrigation, crop rooting stage or production weighting. Live soil-moisture availability was verified against Open-Meteo ECMWF forecasts and ERA5 archive; forecasts are intentionally not blended with the historical soil baseline because land-model biases differ.

## Selected-range numerical price timeline and news context

Price backtest now starts on the last 15 calendar days, with Last 15/30 days presets and daily (31 origins maximum) or weekly (12 origins maximum) sampling. Recent archived origins are allowed; incomplete outcome windows remain pending. Displayed actual closes are restricted to selected dates and completed Yahoo sessions. The prior weekly-only view had no actual price line and rejected recent dates.

A separate experimental expanding ridge model in quantEngine.ts reconstructs horizon-specific price targets using prior completed-close anchors, five-session momentum, twenty-session volatility and three seasonal weather z-scores. Up to 24 earlier weekly archive runs are fetched for calibration. Each fit uses only price labels completed strictly before that forecast origin, with training-only scaling, a fixed penalty of 10 and at least 12 training examples. Weather-plus-market, market-only and no-change errors are scored on identical completed targets; latest-origin duplicates are resolved deterministically. Target horizons can overlap; these are dependent exploratory reconstructions, not previously issued forecasts or causal weather attribution. Training-residual bands are explicitly uncalibrated. The chart includes interactive readouts, source-date context markers, weather-versus-normal readings, model settings and per-origin targets/outcomes.

When today's numerical forecast is generated, its first value per commodity/region/horizon/model/day is saved at the actual recording time in .astraeus-data/price-targets.json. First values are immutable, persist across restarts and cannot be backdated by refreshing. Actual recorded targets have a separate prospective outcome table/score; new targets remain pending. Directional rule-screen results remain a separate evaluation.

GET /api/v1/commodities/:id/context loads GDELT headline metadata and US Federal Register documents for the requested dates, falling back to public Google News RSS when GDELT is unavailable. Dates, original links, source failures and document types remain visible. Filters separate weather, tariffs/trade, regulation and official documents. Publication/first-seen dates are not necessarily legal effective dates; headlines are leads rather than evidence of a causal price effect. Context is not silently fitted into the price model and no numerical news effect is fabricated.

Real last-15-days smoke (Oct 29–Nov 12 2026): 15 corn origins, 23 prior weekly training origins, ten complete price sessions, five scored target dates and eight pending numerical outcomes. One missing training archive remained visible. Numerical MAE was 5.332 US cents vs market-only 5.543 and no-change 6.55 (3.8% descriptive improvement on five targets, not proof of skill). GDELT was unavailable; RSS fallback and official documents returned dated records. New leakage, date-boundary, safe-news-normalization and immutable numerical-ledger tests bring the suite to 66 passing tests; TypeScript/build and dark/light browser checks passed.

## Forecast-to-price backtests

Forecast lab now defaults to Price backtest. Historical rule replay supports corn (water/heat stress) and natural gas (temperature-based demand); issued-forecast evaluation supports all catalogue instruments when Yahoo prices are available. Replay requests individual GFS runs from Open-Meteo's Single Runs API, assuming eight hours after initialization for availability, and uses the next seven complete UTC forecast days. The initialization day's rainfall is incomplete and is deliberately excluded. Seasonal normals use matching seven-day windows from the prior ten years of ERA5 (at least eight complete windows required). Rules are fixed retrospective hypotheses, explicitly different from the live multi-model engine; no out-of-sample claim is made.

Yahoo daily OPEN/CLOSE bars are fetched server-side. Evaluation lives in quantEngine.ts: next-calendar-date open after signal availability, horizon-th session close, no overlapping windows, no use of today's provisional close, null metrics for empty samples, no filling of missing opens, and an optional single round-trip bps cost scenario. Continuous =F prices may contain roll jumps; signed percentage moves are research proxies, not executable futures P&L. Numerical prediction error is not reported because the live pressure engine predicts direction only.

Live commodity analyses append deduplicated minimal events to .astraeus-data/forecast-events.json (gitignored). First server-recorded availability is preserved, writes are serialized/atomic, and history survives restarts. No forecasts are backdated. API: GET /api/v1/commodities/:id/backtest with region, mode=REPLAY|ISSUED, start, end, horizon and costBps. Public-provider requests have timeouts, bounded concurrency and caches; missing runs remain failures rather than sample results. Results export per-event evidence, parameters, source URLs and SHA-256 hashes.

Live smoke: June 1–August 17 2026, 12 weekly runs, five sessions: corn 1/4 directional matches (25%, always-up also 25%); natural gas 6/9 (66.7%, always-up 44.4%), with one overlapping event excluded. These are small, retrospectively selected exploratory samples and do not establish skill. A live corn forecast was persisted successfully. Added seven focused regression tests; 60 total tests, TypeScript and production build passed before final UI review.

## Astraeus interface refresh

The active application is now branded Astraeus (existing storage keys retained for compatibility). The visual system takes inspiration from pantheonofducks.com: black/ivory/gold, fine borders, editorial serif headings and compact mono labels. Light and dark palettes persist via astraeus-theme; a head script prevents a theme flash. The globe remains the landing page.

A native modal first-use guide introduces globe selection, weather interpretation, causal pathways and evidence checking; Quick tour replays it. Escape closes the modal and native dialog focus containment is retained. The globe also has a persistent short starting guide.

Rainfall now uses an inverse-orthographic continuous raster instead of 5-degree quadrilateral tiles. Source-frame scalar values blend during playback; missing values stay transparent. The raster caches samples by camera pose and refreshes pixel colours separately. This improves presentation, not model skill: the global layer still uses the explicitly labelled 20-degree samples; regional analysis uses the existing separate model pipeline. No local-accuracy or price-prediction guarantee is introduced.

Verification: TypeScript and production build passed; all 53 engine tests passed, including projection orientation, centre, limb and dateline checks. Browser visual review was unavailable in this session; theme layouts still need interactive visual inspection.

## Continuous forecast playback

Play now advances a fractional timeline with requestAnimationFrame rather than a three-hour interval timer. Rain values and colours blend between source frames, wind-flow geometry crossfades between cached paths, and the timestamp and scrubber reflect intermediate times. Source data are still three-hour samples: the UI explicitly labels interpolated views. Missing temporal endpoints are not converted into zero rain or calm winds. Pausing, fractional scrubbing, reduced-motion preference and stopping at the last available forecast remain supported. Background-tab time is not accumulated into a large resume jump.

## Regional coverage and weather evidence workspace

The catalogue now expands commodity production, processing, export and demand sample points using `commodityRegions.ts`. National/sector reference sources and representative-coordinate caveats are attached. These are curated regional anchors, not surveyed facilities, production weights or an exhaustive asset database. Export and processing samples use disruption screening rather than crop-yield rules; unsupported direct weather rules remain withheld. Foreign gas-demand points explicitly flag Henry Hub basis/proxy limitations.

`#research` opens Weather & evidence for the shared commodity/region selection. It includes selectable production/distribution/demand pathways, a deterministic illustrative supply-and-demand equilibrium chart with shock/buffer/elasticity sliders, and 20 publication records mapped with commodity-specific explanations across all 28 instruments. Publication metadata and editorial summaries distinguish production, distribution, demand and price evidence. Missing direct commodity-price evidence remains explicit, particularly for metals and co-products. Summaries are based on publication records/abstracts, not claims of full-text replication.

Each reviewed paper links to its DOI or author repository, a Google Scholar title search, its summary and limitations. A query box opens Google Scholar externally and searches Crossref in-app through `GET /api/v1/research/papers?q=...`. New search results are unreviewed publisher metadata; abstract excerpts (when supplied) are labelled, capped, and never invented. The backend validates query length, caches results for an hour, bounds cache size and reports provider failure/rate limits.

The semantic palette uses teal for selection/information, amber for upward price pressure, blue for downward pressure, violet for conflicting evidence, slate for unknown data and red for errors. Weather fields use separate labelled sequential scales. Labels and line styles accompany colors. The palette is informed by context-dependent color research and accessibility guidance; it makes no universal emotional or trading-performance claim.

Teaching-model values are user assumptions, not fitted elasticities, asset price targets or trading forecasts. The model solves Qs=(1-L)P^es and Qd=P^(-ed), with L equal to the hypothetical loss after buffering. It omits inventory dynamics, expectation updates and policy. Source studies are not used to fabricate live numeric forecasts.

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
