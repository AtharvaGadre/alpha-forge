# Astraeus

**Calibrated weather intelligence for commodity markets.**

Astraeus combines seven global weather models, calibrates them against the ERA5 reanalysis record, and traces each physical shock — heat at corn pollination, frost in Brazilian coffee, heating demand in the US Northeast — to the commodity markets that feel it first. Every accuracy claim in the product is measured out of sample and published with its data.

> AlphaForge is the engine and repository name; Astraeus is the product.

## What is in the box

| | |
|---|---|
| **Landing page** (`#home`) | Scroll-driven story with a live NOAA GFS 10 m wind globe, verified skill numbers and the evidence base. |
| **Global explorer** (`#globe`) | Natural Earth globe with 160+ commodity production, processing and demand regions, live precipitation and wind layers. |
| **Market overview** (`#markets`) | 28 commodities; a live regional analysis returns conditional price pressure plus a **calibrated 7-day outlook** (80% intervals, event probabilities, local held-out check). |
| **Forecast skill** (`#accuracy`) | The public verification dashboard: CRPS by lead, skill vs climatology, reliability, PIT histograms, model leaderboard, per-region skill, full tables. |
| **Technical report** (`#report`) | A data-driven paper (also `docs/TECHNICAL_REPORT.md`) with methods, results, limitations and 36 DOI-linked references; prints to PDF. |
| **Forecast lab / Weather & evidence** | Transmission maps, scenario lab, price backtests, mechanism explorer and literature workbench. |

## Headline results

Held-out confirmation period (April–November 2026), 16 commodity regions, 7 models, truth = ERA5. The method was selected on a separate development period and scored once. CRPS skill of **Astraeus v2** relative to the raw multi-model ensemble:

| | Day 1 | Day 3 | Day 5 | Day 7 |
|---|---|---|---|---|
| Daily maximum temperature | +17.2% | +14.8% | +11.0% | +8.7% |
| Daily mean temperature | +16.9% | +14.8% | +8.9% | +6.9% |
| Daily precipitation | +2.3% | +1.8% | +1.2% | +1.1% |

All differences are significant (Diebold–Mariano with HAC/HLN correction, p < 0.01); 95% block-bootstrap intervals are in `public/research/weather-skill.json`. The pre-registered first run and the development comparison are archived in `docs/results/archive/`.

A companion walk-forward study (`docs/results/PRICE_STUDY.md`, 6 commodities, 2008–2026) finds that weather information almost never improves out-of-sample weekly futures-return forecasts. The single cell surviving Benjamini–Hochberg correction — natural-gas weather forecasts at a 1-week horizon — beats a market-only model (Clark–West q = 0.004) but not a no-change forecast (Diebold–Mariano p = 0.21) on 88 weeks, so it is reported as a hypothesis to monitor, not a signal.

## The weather engine

`src/engine/weatherPostprocessing.ts` — pure, deterministic, unit-tested:

- Proper scoring: closed-form CRPS for Gaussian, zero-censored Gaussian (derived here and verified to 10⁻⁸), ensemble and weighted-ensemble forecasts; Brier score and decomposition; randomised PIT; reliability bins.
- Post-processing: EMOS/NGR (Gneiting et al., 2005), skill-weighted NGR, skill-weighted ensembles, censored and power-censored precipitation models.
- Inference: Diebold–Mariano with Newey–West variance and Harvey–Leybourne–Newbold correction; moving-block bootstrap.

**Astraeus v2** = bias-corrected, inverse-MSE-weighted NGR for temperature and a skill-weighted ensemble for precipitation, trained on trailing 90-day windows of previous-run forecasts verified against ERA5. It runs live in `src/engine/calibratedOutlook.ts` for every regional analysis.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (Express + Vite)
npm test             # 100+ deterministic unit tests (offline)
npm run lint         # TypeScript
npm run build        # production bundle
```

Reproduce the research (Open-Meteo free tier; raw responses cached in `research/cache/`):

```bash
npx tsx research/weather-benchmark.ts --suite run1  --period all       # pre-registered run
npx tsx research/weather-benchmark.ts --suite dev   --period dev       # method development
npx tsx research/weather-benchmark.ts --suite final --period confirm   # headline result
npx tsx research/price-study.ts                                         # price study
npx tsx research/build-report.ts                                        # docs/TECHNICAL_REPORT.md
```

## Data and licences

Forecasts and reanalysis via [Open-Meteo](https://open-meteo.com) (ECMWF, NOAA, DWD, Met Office, JMA, ECCC; ERA5 © Copernicus Climate Change Service). Coastlines © Natural Earth (public domain). Market prices from the Yahoo Finance chart endpoint (unofficial). Free Open-Meteo and Yahoo endpoints are for non-commercial research; commercial deployment needs the corresponding licences.

## Honest limits

ERA5 is a ~31 km reanalysis, not station truth, and favours smooth models — including ECMWF's AIFS, which is trained on it. Regions are single representative grid points, not production-weighted areas. Continuous futures contain roll jumps. Astraeus reports conditional physical pressure, not price targets or trading advice.

## Repository map

```
src/engine/weatherPostprocessing.ts   scoring + post-processing (tests alongside)
src/engine/calibratedOutlook.ts       live Astraeus v2 outlook
src/engine/liveAtmospherePipeline.ts  multi-model fetch, provenance gates, climatology, signals
src/engine/priceSkill.ts              walk-forward return-forecast statistics
src/engine/researchLibrary.ts         68 verified references
src/engine/technicalReport.ts         data-driven report (web + Markdown)
src/components/landing/               landing page and hero globe
src/components/ForecastSkill.tsx      verification dashboard
research/                             benchmark, price study, report builder
public/research/                      published results (JSON)
docs/                                 report, results, references, project history
```

Earlier milestones (ARGON assistant, quant/slippage laboratory, mobile app) are documented in `docs/PROJECT_HISTORY.md`.
