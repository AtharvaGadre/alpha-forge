# Astraeus

**Calibrated weather intelligence for commodity markets.**

Astraeus combines seven global weather models, calibrates them against the ERA5 reanalysis record, and traces each physical shock — heat at corn pollination, frost in Brazilian coffee, heating demand in the US Northeast — to the commodity markets that feel it first. Every accuracy claim in the product is measured out of sample and published with its data.

> AlphaForge is the engine and repository name; Astraeus is the product.

## What is in the box

| | |
|---|---|
| **Landing page** (`#home`) | Scroll-driven story with a live NOAA GFS 10 m wind globe, verified skill numbers and the evidence base. |
| **Global explorer** (`#globe`) | Natural Earth globe with 160+ commodity production, processing and demand regions, live precipitation and wind layers. |
| **Market overview** (`#markets`) | 28 commodities, opened with the **daily precomputed outlooks** (issued after 06:30 UTC); a live regional analysis returns conditional price pressure plus a **calibrated 7-day outlook** (80% intervals, event probabilities, local held-out check). |
| **Forecast skill** (`#accuracy`) | The public verification dashboard: CRPS by lead, skill vs climatology, reliability, PIT histograms, model leaderboard, per-region skill, full tables — and the **live track record** of hash-chained daily forecasts scored against ERA5 as it arrives. |
| **Technical report** (`#report`) | A data-driven paper (also `docs/TECHNICAL_REPORT.md`) with methods, results, limitations and 39 DOI-linked references; prints to PDF. |
| **Forecast lab / Weather & evidence** | Transmission maps, scenario lab, price backtests, mechanism explorer and literature workbench. |

## Headline results

Confirmation period (April–November 2026), 16 commodity regions, 7 models, truth = ERA5. The method was selected on a separate development period and frozen before this period was scored; an exploratory first run had also covered it, so a strictly prospective test (`--period prospective`, forecasts after 16 Nov 2026) is specified. The benchmark was independently code-reviewed; the report's revision history lists every correction.

CRPS reduction of **Astraeus v2** (higher is better):

| | Day 1 | Day 3 | Day 5 | Day 7 |
|---|---|---|---|---|
| Max temperature vs no-training Gaussian of the same models | 14.8% | 11.3% | 7.4% | 4.5% |
| Mean temperature vs no-training Gaussian | 15.0% | 12.5% | 5.5% | 2.7% (n.s.) |
| Max temperature vs raw ensemble (5–7 members) | 17.2% | 14.8% | 11.0% | 8.7% |
| Rainfall vs raw ensemble (like-for-like) | 2.3% | 1.8% | 1.2% | 1.1% |

Significance: Diebold–Mariano on case-weighted daily losses, largest p across Newey–West bandwidths; 95% block-bootstrap intervals in `public/research/weather-skill.json`. The gains come from bias correction and skill weighting; v2 is mildly under-dispersive (80% intervals cover ~74–78% of temperature outcomes), while the raw ensemble is over-dispersive at short leads. The development comparison and the first run replayed on development days are archived in `docs/results/archive/`.

**Astraeus v3** (live since 16 Nov 2026) corrects part of that over-confidence: a logistic, recency-weighted, cross-validation-recalibrated NGR, chosen among six pre-specified candidates on development days only and frozen (commit `9b99959`) before it was scored. On the confirmation period it beats v2 in every temperature cell (max temperature 15.6% → 5.9% vs the no-training Gaussian at days 1 → 7; 80% coverage 78–79%). That period is where the over-confidence was spotted, so this is a consistency check; the live track record is the real test (`docs/results/WEATHER_V3.md`).

**Against weather stations the picture is weaker.** At the 7 regions with a usable GHCN-Daily or Meteostat station, the ERA5-trained forecasts gain only 1–5% over the no-training Gaussian for max temperature and their 80% intervals hold just 50–70% of station values; training the same method on the station's own record restores ~11% at day 1 and ~80% coverage. Production-weighted area means keep the day-1 gain but lose about 4 points at days 3–7. Skill figures above are for ~30 km grid boxes, not points (`docs/results/STATION_VERIFICATION.md`, `AREA_VERIFICATION.md`).

A companion walk-forward study (`docs/results/PRICE_STUDY.md`, 6 commodities, 2008–2026) finds that weather information almost never improves out-of-sample weekly futures-return forecasts. The single cell surviving Benjamini–Hochberg correction — natural-gas weather forecasts at a 1-week horizon — beats a market-only model (Clark–West q = 0.004) but not a no-change forecast (Diebold–Mariano p = 0.21) on 88 weeks, so it is reported as a hypothesis to monitor, not a signal.

## The weather engine

`src/engine/weatherPostprocessing.ts` — pure, deterministic, unit-tested:

- Proper scoring: closed-form CRPS for Gaussian, zero-censored Gaussian (derived here and verified to 10⁻⁸), ensemble and weighted-ensemble forecasts; Brier score and decomposition; randomised PIT; reliability bins.
- Post-processing: EMOS/NGR (Gneiting et al., 2005), skill-weighted NGR, skill-weighted ensembles, censored and power-censored precipitation models.
- Inference: Diebold–Mariano with Newey–West variance and Harvey–Leybourne–Newbold correction; moving-block bootstrap.

**Astraeus v2** = bias-corrected, inverse-MSE-weighted NGR for temperature and a skill-weighted ensemble for precipitation, trained on trailing 90-day windows of previous-run forecasts verified against ERA5. **Astraeus v3** keeps the precipitation model and replaces the temperature model with a logistic NGR trained with recency weights and a cross-validated scale. v3 runs live in `src/engine/calibratedOutlook.ts` for every regional analysis, trained on the same ERA5 truth (models=era5, 24-hour UTC days) as the benchmark.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (Express + Vite)
npm test             # 100+ deterministic unit tests (offline)
npm run lint         # TypeScript
npm run build        # production bundle
npm start            # production server (daily precompute + track record on; see DEPLOYMENT.md)
```

Live track record (data/track-record is committed; first snapshot 2026-11-16):

```bash
npx tsx research/track-record.ts snapshot   # today's outlooks → snapshot + ledger line (after 06:30 UTC)
npx tsx research/track-record.ts score      # ERA5 truth for snapshot days ≥ ~6 days old → summary.json
npx tsx research/track-record.ts verify     # recompute every sha256 and the hash chain
```

Reproduce the research (Open-Meteo free tier; raw responses cached in `research/cache/`):

```bash
npx tsx research/weather-benchmark.ts --suite run1  --period all       # pre-registered run
npx tsx research/weather-benchmark.ts --suite dev   --period dev       # method development
npx tsx research/weather-benchmark.ts --suite final --period confirm   # headline result (v2 + v3)
npx tsx research/weather-benchmark.ts --suite v3dev --period dev --offline          # v3 candidates
npx tsx research/weather-benchmark.ts --suite final --period prospective            # after forecasts issued from 16 Nov verify
npx tsx research/weather-benchmark.ts --suite final --period confirm --offline --truth stations --train era5   # station truth
npx tsx research/verification-report.ts                                 # station + area summaries
npx tsx research/price-study.ts                                         # price study
npx tsx research/build-report.ts                                        # docs/TECHNICAL_REPORT.md
```

## Data and licences

Forecasts and reanalysis via [Open-Meteo](https://open-meteo.com) (ECMWF, NOAA, DWD, Met Office, JMA, ECCC; ERA5 © Copernicus Climate Change Service). Station observations from NOAA GHCN-Daily and Meteostat. Coastlines © Natural Earth (public domain). Market prices from the Yahoo Finance chart endpoint (unofficial). Free Open-Meteo and Yahoo endpoints are for non-commercial research; commercial deployment needs the corresponding licences, and Met Office data are share-alike. See [`docs/DATA_LICENSING.md`](docs/DATA_LICENSING.md) for every source, its terms and a pre-launch checklist. The repository itself has no licence yet.

## Honest limits

ERA5 is a ~31 km reanalysis and favours smooth models — including ECMWF's AIFS, which is trained on it; against stations most of AIFS's lead and most of the short-range calibration gain disappear unless the calibration is trained on station data. Station truth exists for only 7 of 16 regions, all mid-latitude. Most regions are single representative grid points; production-weighted areas were tested for four. Continuous futures contain roll jumps. Astraeus reports conditional physical pressure, not price targets or trading advice.

## Repository map

```
src/engine/weatherPostprocessing.ts   scoring + post-processing (tests alongside)
src/engine/calibratedOutlook.ts       live Astraeus outlook (v3; v2 selectable)
src/engine/liveAtmospherePipeline.ts  multi-model fetch, provenance gates, climatology, signals
src/engine/priceSkill.ts              walk-forward return-forecast statistics
src/engine/researchLibrary.ts         72 references (71 verified)
src/engine/technicalReport.ts         data-driven report (web + Markdown)
src/components/landing/               landing page and hero globe
src/engine/trackRecord.ts             live track-record scoring + hash chain (tests alongside)
src/components/ForecastSkill.tsx      verification dashboard
server/                               outbound cache + Open-Meteo budget, security, precompute, track record
research/                             benchmark, station/area verification, price study, report builder, track-record CLI
data/track-record/                    committed daily snapshots, ledger, ERA5 truth, summary
public/research/                      published results (JSON)
docs/                                 report, results, references, project history
```

Earlier milestones (ARGON assistant, quant/slippage laboratory, mobile app) are documented in `docs/PROJECT_HISTORY.md`.
