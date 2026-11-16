# AGENTS.md — Persistent Autonomous Agent Instructions

## 1. Mission & Identity
Astraeus (repository and engine name: AlphaForge) is calibrated weather intelligence for commodity markets. It combines seven global weather models, calibrates them against ERA5, and verifies them against reanalysis, weather stations and production-weighted areas. It then links weather to the commodity fundamentals and prices it can measurably move. Every accuracy claim is measured out of sample and published with its data. The earlier quantitative-research laboratory (slippage Monte Carlo, QuantPhysics, ARGON/Gemini assistant) was retired in November 2026; see `docs/PROJECT_HISTORY.md`.

**Principal Architect Profile**:
- MPhys Physics (University of Sheffield) & MSc Computational Finance (UCL)
- Expertise in stochastic calculus, statistical mechanics, Azure Databricks/Data Factory, Python/C#/TypeScript numerical pipelines, and algorithmic execution optimization.

## 2. Core Engineering Principles
1. **Deterministic calculation invariant**: never let an LLM fabricate skill scores, backtest figures or statistics. Every number comes from deterministic code (`src/engine/weatherPostprocessing.ts`, `priceSkill.ts`, `trackRecord.ts`, `research/*.ts`) and the published result files in `public/research/`. The report (`src/engine/technicalReport.ts`) computes its text from those files.
2. **Pre-specify, freeze, then score**: tune methods only on the development period (test days ≤ 2026-03-31). Write candidates and selection rules down before running them. Freeze a method in its own commit before scoring held-out data. The confirmation period (after 2026-03-31) has been seen; only forecasts issued after 2026-11-16 (`--period prospective`, and the live track record) are unseen.
3. **Append-only track record**: `data/track-record/` holds hash-chained daily snapshots of what the site published. Never edit or delete a snapshot or ledger line; `npx tsx research/track-record.ts verify` must pass.
4. **Server-side data access**: all outbound requests go through `server/outbound.ts`, which applies the cache, the Open-Meteo daily budget and the optional commercial key. Respect the licences in `docs/DATA_LICENSING.md`.

## 3. Verification & Resume Protocol
- Unit tests: `npm test`; types and build: `npm run lint && npm run build`.
- After any result change, regenerate the report: `npx tsx research/build-report.ts`. The confirmation benchmark must still reproduce `public/research/weather-skill.json` exactly: `npx tsx research/weather-benchmark.ts --suite final --period confirm --offline --out <tmp>` and diff.
- Inspect `PROJECT_STATE.md` before starting any new milestone.
