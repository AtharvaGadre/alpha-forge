# API_CONTRACTS.md — Astraeus HTTP API

The routes the Astraeus server (`server.ts` + `server/*.ts`) actually serves. The machine-readable contract is
`packages/api_contracts/openapi.yaml` (OpenAPI 3.1). Everything is JSON over HTTPS on the server's own origin; the
browser never calls third-party data providers directly. There is no WebSocket API and no API key.

Legacy routes from earlier milestones (`/api/worldpulse/*`, `/api/v1/argon/*`, slippage and quant-physics
laboratories, `/api/backtest/run`, `/api/agents/*`, `/api/assistant/query`, `/api/research/experiments`,
`/api/v1/weather/current`, `/api/v1/forecasts/compare`, `/api/v1/demo-presets`) have been removed and return
`404 {"error":"Unknown API route."}`. The Flutter app in `apps/mobile` still targets them (see its README).

## Conventions

- **Errors** are `{"error": "<human-readable message>"}`; live-data failures add `"dataMode": "LIVE_UNAVAILABLE"`.
  No endpoint substitutes sample or demo data when a provider fails.
- **Rate limits** (per client IP, token bucket): every `/api/*` route 120 requests/min (burst 120); the expensive
  routes marked ⚡ below 8/min (burst 12). Responses carry `RateLimit-Policy`; over the limit the server answers
  `429` with `Retry-After`. Configurable with `RATE_LIMIT_*` (see `DEPLOYMENT.md`).
- **Open-Meteo budget**: weather calls are metered against a daily weighted budget (`OPEN_METEO_DAILY_BUDGET`).
  When it is spent, live analyses fall back to the precomputed outlook or return `503`.
- JSON bodies are limited to 64 kB. Unknown `/api/*` paths return `404`.

## Endpoints

| Method | Path | Purpose | Main status codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` (alias `/api/health`) | Service status, precompute issue time, track-record head, Open-Meteo budget | 200 |
| `GET` | `/api/v1/models/skill` | Summary of the published weather benchmark (`public/research/weather-skill.json`) | 200, 503 if not generated |
| `GET` | `/api/v1/commodities` (alias `/api/v1/trade-ideas`) | The 28-commodity catalogue with regions, rules and fundamentals | 200 |
| `GET` | `/api/v1/commodities/{id}/forecast?region=` ⚡ | Live regional analysis: conditional price pressure, drivers, calibrated 7-day outlook, evidence hashes | 200, 400, 404, 502, 503 |
| `GET` | `/api/v1/outlooks/latest` | Today's precomputed outlooks for the default regions (gzip when accepted) | 200, 404 before the first run |
| `GET` | `/api/v1/weather/globe` | 144-point NOAA GFS wind and precipitation field (via Open-Meteo) for the globe | 200 (possibly `stale`), 502, 503 |
| `GET` | `/api/v1/commodities/{id}/research` | Reviewed research profile and papers for a commodity | 200, 404 |
| `GET` | `/api/v1/research/papers?q=` ⚡ | Crossref paper search (3–180 characters, cached 1 h) | 200, 400, 502 |
| `GET` | `/api/v1/commodities/transmission` | Transmission graph: nodes, links, mechanisms, sources | 200 |
| `GET` | `/api/v1/commodities/transmission/scenario?source=&direction=&hops=` | Trace a manual UP/DOWN shock through the graph (no price targets) | 200, 400 |
| `GET` | `/api/v1/commodities/{id}/backtest?region=&mode=&start=&end=&horizon=&costBps=&cadence=` ⚡ | Forecast-direction vs subsequent futures moves (historical replay or issued forecasts) | 200, 429, 502 |
| `GET` | `/api/v1/commodities/{id}/context?start=&end=` ⚡ | Timestamped headlines and documents for a date range (GDELT, Google News RSS, Federal Register) | 200, 404, 502 |
| `GET`, `POST` | `/api/v2/atmosphere/investigate?q=` or `{"query": ""}` ⚡ | Full live pipeline output for any place or question (raw inputs, skill, consequences, data log) | 200, 400, 502, 503 |
| `GET` | `/api/v1/track-record` | Live track record summary: snapshots, hash-chain head, scored cells | 200, 500 |
| `GET` | `/api/v1/track-record/ledger` | The hash-chained ledger, `text/plain` JSON lines, byte-for-byte | 200, 404 |
| `GET` | `/api/v1/track-record/snapshots/{date}` | One daily snapshot (`YYYY-MM-DD`), byte-for-byte so its sha256 can be checked against the ledger | 200, 400, 404 |
| `GET` | `/api/v1/prediction-markets`, `/api/v1/news-trade-ideas`, `/api/v1/ai-summary` | Retired fixture endpoints | 410 |

Static research results are served next to the app: `/research/weather-skill.json`, `/research/price-skill.json`,
`/research/price-summary.json` (from `public/research/`).

## Details

### `GET /api/v1/commodities/{id}/forecast`

`region` is a region id from the commodity's catalogue entry (default: its first region). Results are cached for
15 minutes per commodity and region, concurrent identical requests share one pipeline run, and every issued
result is appended to the server's forecast ledger. The response is a `CommodityForecast`
(`src/engine/commodityForecastEngine.ts`):

| Field | Meaning |
| :--- | :--- |
| `commodityId`, `regionId`, `generatedAtUtc`, `sourceGeneratedAtUtc` | Identity and timestamps |
| `status` | `UPWARD_PRESSURE`, `DOWNWARD_PRESSURE`, `MIXED`, `NO_MATERIAL_SIGNAL` or `INSUFFICIENT_EVIDENCE`: conditional physical pressure, not a price forecast |
| `headline`, `weatherWindow`, `drivers[]` | Per-rule readings (`label`, `signalId`, `value`, `normal`, `anomaly`, `zScore`, `unit`, `sourceType`, `pressure`, `mechanism`, `caveat`) |
| `outlook` | Calibrated daily outlook (Astraeus method; 80% intervals, event probabilities, local held-out check); absent when calibration inputs were unavailable |
| `market` | Last observed futures close and 5-session return (Yahoo Finance, indicative), or `null` when unavailable |
| `evidence` | `inputHash`, `experimentId`, `engineVersion`, `parametersSha256`, `modelCount`, `climateYears`, `weatherVerification`, `priceModelValidated: false` |
| `diagnostics` | Per-model forecasts, verification, signals and provenance |
| `sources[]`, `limitations[]`, `fundamentals[]`, `seasonActive`, `target` | Data log, caveats, checklist, season flag, resolved location |
| `precomputed` | Present when the result came from the daily precompute (`issuedAtUtc`, `issueDate`, `job`) |
| `cached`, `notice` | `cached` is true for cache hits; `notice` explains a budget fallback to the precomputed outlook |

`400` unknown region · `404` unknown commodity · `503` budget spent or provider cooling down and no precomputed
outlook exists · `502` live providers failed.

### `GET /api/v1/outlooks/latest`

`{ schema: "astraeus-outlooks-v1", job, issueDate, issuedAtUtc, completedAtUtc, engineVersion, methodVersions[],
openMeteo{…}, regions[], results{ "<commodityId>:<regionId>": CommodityForecast } }`, rebuilt daily after
06:30 UTC (`server/precompute.ts`). `Cache-Control: public, max-age=300`.

### `GET /api/v1/weather/globe`

`GlobeWeatherField` (`src/engine/liveGlobeWeather.ts`): `version: "live-globe-weather-v1"`, `provider`, `model`,
`fetchedAtUtc`, `modelInitializedAtUtc`, `inputSha256`, `spacingDeg` (20), `frames[]` (3-hourly samples of
precipitation and 10 m wind), `availablePoints`, `totalPoints`, `warnings[]`, `sourceUrls[]`, plus `cached` and,
when the last good field is served after a failure, `stale: true`. A refresh costs about 144 weighted Open-Meteo
calls and is cached for `GLOBE_TTL_MIN` (default 180 minutes).

### `GET /api/v1/commodities/{id}/backtest`

| Parameter | Values |
| :--- | :--- |
| `region` | Catalogue region id |
| `mode` | `REPLAY` (archived GFS runs, corn and natural gas only) or `ISSUED` (forecasts this server recorded) |
| `start`, `end` | `YYYY-MM-DD`, ordered, at most one year apart, not in the future |
| `horizon` | Holding period in trading sessions (default 5) |
| `costBps` | Round-trip cost scenario in basis points (default 0) |
| `cadence` | `DAILY` (up to 31 origins) or `WEEKLY` (up to 12) |

Returns `version: "forecast-price-backtest-v1"`, the options, `forecastOrigins[]`, `prices[]`, `evaluation`,
`numerical`, `failures[]`, `sourceUrls[]`, `priceHash` and `inputHash`. Results are cached for 5 minutes; at most
two backtests run at once (`429` otherwise). Invalid parameters are currently reported as `502` with the
validation message.

### `GET /api/v1/track-record`

`TrackRecordSummary` (`server/trackRecordStore.ts`) plus `enabled`: `startDate`, `latestSnapshot`, `snapshots`,
`regionsLatest`, `ledger{ head, length, ok, problems[] }`, `cases{ total, scored, pending }`,
`nextScoresExpected`, `methodVersions`, `cells[]` (per variable and lead: the outlook, the no-training Gaussian and
the raw ensemble scored by CRPS or a three-quantile score on the same cases, with `skillVsGaussian` and `skillVsRaw`), and `verify` (the command that recomputes the chain). Rebuilt at most every
5 minutes from the committed files in `data/track-record/`.
