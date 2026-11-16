# Deployment

Astraeus is a single Node service: Express serves the API and the built Vite bundle. Every weather, market and
literature request is made **server-side** (the browser only talks to its own origin), so one server-side budget
covers all Open-Meteo traffic.

```bash
npm ci && npm run build
PORT=3000 npm start            # NODE_ENV=production tsx server.ts
# or
docker build -t astraeus . && docker run -p 3000:3000 -v astraeus-data:/app/.astraeus-data astraeus
```

Health check: `GET /api/v1/health` (status, precompute issue time, track-record head, Open-Meteo budget).

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | Listen port. |
| `TRUST_PROXY` | unset | Set (e.g. `1`) behind a reverse proxy / Cloud Run so rate limits key on the client IP. Leave unset when exposed directly. |
| `OPEN_METEO_DAILY_BUDGET` | 5000 | Weighted Open-Meteo calls this server may make per UTC day. Over budget, live analyses fall back to the precomputed outlook or return 503; the globe serves its last field. |
| `OPEN_METEO_RESERVE` | 1500 | Part of the budget only scheduled jobs (precompute, scoring) may use. |
| `OPEN_METEO_PER_MINUTE` | 300 | Pacing; the free tier allows 600 per minute per IP. |
| `OPEN_METEO_API_KEY` | unset | Commercial key: calls go to the `customer-*.open-meteo.com` hosts with `apikey`. |
| `PRECOMPUTE` | on in production | Daily precomputed outlooks (after 06:30 UTC and at start-up when stale). |
| `PRECOMPUTE_ALLOWANCE` | 1500 | Maximum weight of one precompute run; regions beyond it are deferred to the next run. |
| `TRACK_RECORD` | on in production | Snapshot each precompute into `data/track-record` and score it against ERA5 daily. |
| `GLOBE_TTL_MIN` | 180 | Cache of the 144-point GFS globe field (≈144 weighted calls per refresh). |
| `RATE_LIMIT_API_PER_MIN` / `_BURST` | 120 / 120 | Per-IP token bucket on `/api/*`. |
| `RATE_LIMIT_EXPENSIVE_PER_MIN` / `_BURST` | 8 / 12 | Live analyses, backtests, news context, paper search, `/api/v2/atmosphere/investigate`. |

## Open-Meteo usage

Weights follow Open-Meteo's fair-use rule (per location: variables × models / 10 × days / 14, minimum 1) and are
measured per request by `server/outbound.ts`. One region analysed from scratch costs ≈ 103 (previous runs 61.7,
climatology 17.1, forecast 10.6, ensemble 8.2, ERA5 5.2). Archive and previous-runs days are stored once in
`.astraeus-data/om-days`, so a region analysed the day before costs ≈ 31. The daily precompute of the 24 distinct
default regions therefore costs ≈ 750 once warm; the first cold start is spread over two days by
`PRECOMPUTE_ALLOWANCE`. The globe costs ≈ 144 per refresh (≤ 8 a day at the default TTL). Free Open-Meteo, Yahoo
and NASA POWER endpoints are for non-commercial use; a commercial deployment needs their paid plans.

## Persistence

- `.astraeus-data/` (mount a volume): issued-forecast ledger, Open-Meteo usage counter, stored archive days.
- `data/outlooks/` (gitignored): `latest.json` (+ `.gz`) and a dated copy, rebuilt daily.
- `data/track-record/` (**committed**): snapshots, `ledger.jsonl`, ERA5 truth, `summary.json`. Choose one writer:
  the server (`TRACK_RECORD=1` with a persistent volume), `.github/workflows/track-record.yml` (commits daily), or
  the launchd template `deploy/launchd/com.astraeus.track-record.plist`. `npx tsx research/track-record.ts verify`
  recomputes the hash chain.

## Security

Production responses carry a Content-Security-Policy (self + Google Fonts; the inline theme script is allowed by
hash), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy` and a restrictive `Permissions-Policy`. JSON bodies are limited
to 64 kB. The legacy Gemini assistant, ARGON voice/TTS WebSocket, WorldPulse and quant laboratories were removed
with their routes (see `PROJECT_STATE.md`); no API keys other than the optional Open-Meteo key are used.

## Python FastAPI companion (optional, unchanged)

```bash
pip install -r services/fastapi_service/requirements.txt
uvicorn services.fastapi_service.main:app --host 0.0.0.0 --port 8000
```
