# ARCHITECTURE.md — Astraeus

Astraeus is one Node service: an Express server (`server.ts` + `server/*.ts`, run with `tsx`) that serves a small
JSON API and the React 19 / Vite single-page app. Every weather, market and literature request is made
server-side, so one outbound layer enforces caching, the Open-Meteo budget and provider etiquette.

```
 Browser (React 19 SPA, hash routes #home #globe #markets #watchlist #advanced #research #accuracy #report #methodology)
   │  same-origin JSON only
   ▼
 server.ts ── security headers, CSP, per-IP rate limits (server/security.ts)
   │          routes: catalogue · live forecast · outlooks · globe field · research · backtest · context · track record
   ├─ server/outbound.ts     TTL cache, in-flight de-duplication, Open-Meteo weight budget + 429 cool-down,
   │                         optional commercial key; archive / previous-runs days stored once (server/openMeteo.ts)
   ├─ server/precompute.ts   daily outlooks for the default regions → data/outlooks/latest.json(.gz)
   ├─ server/dailyJob.ts     scheduler: precompute → track-record snapshot → ERA5 scoring (after 06:30 UTC)
   └─ server/trackRecordStore.ts  hash-chained ledger, snapshots, ERA5 truth, summary (data/track-record/)
   │
   ▼
 src/engine/* (pure TypeScript, shared by server, client, CLI and tests)
   liveAtmospherePipeline   multi-model fetch (7 models via Open-Meteo), provenance gates, ERA5 / NASA POWER
                            climatology, signals, observed market move (Yahoo Finance)
   calibratedOutlook        live calibrated 7-day outlook (bias correction + skill-weighted NGR / ensembles)
   weatherPostprocessing    CRPS, Brier, PIT, reliability, EMOS/NGR, Diebold–Mariano, block bootstrap
   commodityForecastEngine  28 commodities, 160+ regions, mechanism rules → conditional pressure + evidence hashes
   commodityTransmissionEngine  economic transmission graph and scenario tracing
   forecastBacktest / priceSkill / marketContext   price evaluation, walk-forward statistics, dated context
   trackRecord              scoring and hash chain for the live track record
   technicalReport / researchLibrary / researchData   report content, 68 verified references, published results
```

## Front end (`src/`)

- `App.tsx` owns navigation (`engine/workspaceNavigation.ts`: every view has a stable hash; unknown hashes land on
  `#home`), view transitions, the watchlist (localStorage) and live-analysis state. Heavy views are lazy-loaded.
- Views: `components/landing/` (public landing page and hero globe), `GlobeLanding` + `globe/GlobeCanvas`
  (Natural Earth globe with GFS wind and precipitation layers), market overview and watchlist (in `App.tsx`),
  `ForecastLab` (backtests, transmission, scenarios, revisions, diagnostics), `CommodityResearchWorkbench`,
  `ForecastSkill` (verification dashboard and live track record), `TechnicalReport` (prints to PDF),
  `DataAttribution` (provider credits shown in every footer).
- Styling: design tokens in `astraeus.css` (colours checked against WCAG AA in both themes, type, radii, the
  always-dark globe stage), the shared workspace layer in `workspace.css`, per-feature sheets
  (`globe-landing.css`, `commodity.css`, `forecast-lab.css`, `research-workbench.css`), `landing.css`, `skill.css`,
  and chart tokens in `components/charts/charts.css`.

## Data flow of a live analysis

1. `GET /api/v1/commodities/{id}/forecast?region=` checks the cache and the Open-Meteo budget; over budget it
   serves the day's precomputed outlook (with a `notice`) or `503`.
2. `runLiveAtmospherePipeline` fetches forecasts, previous runs, ensembles and ERA5 / NASA POWER climatology
   through `server/outbound.ts`, rejects stale or mismatched inputs, and computes signals and the calibrated
   outlook.
3. `issueCommodityForecast` (`server/precompute.ts`) applies the commodity's mechanism rules and attaches hashes and
   provenance; the server appends the issued signal to the forecast ledger (`.astraeus-data/`) and caches the result
   for 15 minutes. The browser checks the commodity, region and input hash are present before showing it.

## Persistence

| Path | Contents | Tracked |
| :--- | :--- | :--- |
| `.astraeus-data/` | Issued-forecast ledger, Open-Meteo usage counter, stored archive days | No (mount a volume) |
| `data/outlooks/` | `latest.json(.gz)` and dated copies from the daily precompute | No |
| `data/track-record/` | Snapshots, `ledger.jsonl`, ERA5 truth, `summary.json` | Yes |
| `public/research/` | Published benchmark and price-study results | Yes |

## Research pipeline (`research/`)

CLI scripts reuse the same engines: `weather-benchmark.ts` (pre-registered benchmark), `price-study.ts`,
`build-report.ts` (writes `docs/TECHNICAL_REPORT.md`), `track-record.ts` (snapshot / score / verify),
`verification-report.ts`, `select-stations.ts`, `build-areas.ts`. Raw responses are cached in `research/cache/`.

## Tests and CI

- `npm test`: deterministic offline unit tests (node:test via tsx).
- `npm run test:e2e`: builds, starts the production server with no outbound weather calls and drives Chrome with
  puppeteer-core through every view, navigation, degraded states, accessible names and 390 px layouts.
- `.github/workflows/ci-research.yml` runs typecheck, unit tests, build and the e2e suite on every push and pull
  request; `track-record.yml` runs the daily job and commits `data/track-record/`.

## Other components

- `services/fastapi_service/` — optional Python companion (verification metrics), unchanged.
- `apps/mobile/` — Flutter app from an earlier milestone; it targets the removed legacy API (see its README).
- API reference: `API_CONTRACTS.md`, `packages/api_contracts/openapi.yaml`. Deployment: `DEPLOYMENT.md`.
