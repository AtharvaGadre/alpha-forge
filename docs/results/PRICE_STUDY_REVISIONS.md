# Do changes in the weather forecast predict natural-gas futures returns?

*Astraeus price study, revisions family (`astraeus-ng-forecast-revisions-v1`). Companion to `docs/results/PRICE_STUDY.md` (levels family, unchanged) and `docs/results/STORAGE_STUDY.md` (physical fundamentals).*

## Pre-specification

**Status:** written and committed before any member of this family was scored. Nothing in this section is edited after that commit; results are appended below the marker by `research/price-revisions.ts`.

### Motivation

The walk-forward price study found that forecast *levels* of weather almost never improve weekly futures-return forecasts. Markets price what is already forecast. Its single surviving cell (natural gas, NWP tier, 1 week) beat a market-only model but not a no-change forecast (DM p = 0.21, n = 88). If prices already contain the forecast, the only weather information that could still move the *next* week's price is information the market has not yet absorbed: changes in the forecast, and weather surprises that will be revealed through the next EIA storage report. This family tests those candidates with the same machinery and the same baselines, and adds two level controls scaled into storage units.

### What the archive allows

The Open-Meteo Previous Runs API exposes `previous_day1` … `previous_day7` only, so the longest lead is 7 days. A week-on-week revision of a fixed target window (the forecast for days t+1…t+7 issued at t versus the forecast for the same days issued at t − 7) would need leads 8–14. **That proper weekly revision is impossible with this archive.** We test the longest revisions that are possible: a 1-day revision and the accumulated revision since the lead-7 forecast, both over days 0…+5 of the coming week.

### Instrument, sample and timing

- Return: weekly log return of Henry Hub natural-gas futures (`NG=F`, Yahoo Finance continuous front month), from the Friday close (origin t) to the close one week later. The same cached series as `public/research/price-skill.json` (data end 2026-11-14). An origin is used only if the session at t is a Friday (NYMEX holidays drop a few weeks).
- Weather index: CPC-basis CONUS gas-weighted HDD + population-weighted CDD (base 65 °F), exactly as constructed in `STORAGE_STUDY.md` §3. City forecasts are bias-corrected against ERA5, mapped to census-division averages and combined with CPC weights. **Primary forecasts: GFS (`gfs_global`) only**, because its archive starts in March 2021 and gives about 5.5 years. ECMWF IFS starts in February 2024, so IFS+GFS is used only as a robustness variant.
- Issue cut-off: at origin t, forecast day t + i (local Central day) uses `previous_day(i+1)`. Every value therefore comes from a run initialised no later than Thursday 23:00 CT, roughly 14 hours before the Friday settlement. Bias corrections use forecast and ERA5 days ending 7 days before t.
- Origins: Fridays 2021-04-30 … 2026-11-06 with complete inputs. Coverage was checked before scoring with `--phase=coverage`: 271 origins, 2021-05-07 … 2026-11-06. Eight weeks are dropped because the Friday was a NYMEX holiday and ten because inputs were missing (GFS archive gaps). The first out-of-sample origin, after 52 training weeks, is 2022-05-20, giving **n ≈ 219** out-of-sample weeks.

### Family (six tests)

Each test adds **one** feature to the market-only model.

| ID | Feature at origin t | Kind | Units |
|---|---|---|---|
| H1 | 1-day revision: Σ_{i=0..5} [TDD lead i+1 − TDD lead i+2] for day t+i | forecast change | °F·day |
| H2 | Accumulated revision: Σ_{i=0..5} [TDD lead i+1 − TDD lead 7] for day t+i | forecast change | °F·day |
| H3 | Weather surprise of the storage week just ended (days t−7…t−1, reported Thursday t+6): realised TDD minus the forecast issued at that week's start (`STORAGE_STUDY.md` model (3) inputs) | news to be revealed by the next report | °F·day |
| H4 | Same week, in storage units: weather model(realised DD) − weather model(week-start forecast DD) | news, scaled | Bcf |
| H5 | Same week: weather model(realised DD) − EIA five-year average change | anomaly vs normal at report time | Bcf |
| H6 | Coming storage week (days t…t+6): weather model(forecast DD issued at t) − five-year average | forecast level control | Bcf |

"Realised" for the just-ended week means CPC daily values for Friday–Wednesday plus the lead-1 forecast for Thursday t − 1, because CPC's Thursday value may not be published by the Friday close. The storage weather model is the one frozen by the storage study's development selection. It is refitted on report weeks ending ≤ t − 7, all published by Thursday t − 1.

### Models, tests and multiple testing (identical to `research/price-study.ts`)

- RW: zero return. HM: expanding historical mean. MKT: ridge on 1-week return, 4-week return and 12-week realised volatility. WX: MKT plus the family feature, which nests MKT. Ridge λ = 0.1 × n_train on standardised predictors. Expanding window refitted every week. A training row is admissible only once its return is realised. Minimum training 52 weeks.
- Out-of-sample R² vs HM (Campbell & Thompson 2008), with a circular moving-block bootstrap 95% CI (1,000 resamples, seed 20261117).
- **Primary test: Clark–West (2007), WX vs MKT** (does the feature add information?).
- Diebold–Mariano (Newey–West HAC + HLN), WX vs RW (does it beat no-change?).
- All p-values are one-sided. **Benjamini–Hochberg q-values within this six-test family**, separately for CW and DM. A member counts as evidence only at CW q < 0.10, and as a usable forecast only if DM q < 0.10 as well.
- Pre-declared robustness, run only for members with CW q < 0.10: λ ∈ {0.03, 0.3, 1} × n; IFS+GFS mean (shorter window); first and second halves of the out-of-sample window.
- Descriptive, outside the family: full-sample OLS of returns on each standardised feature (HAC t). A **contemporaneous** diagnostic regresses the return on the weather surprise that arrives *during* the holding week. It is not a forecast; it asks whether weather news is priced when it arrives.

### Expected outcome under efficient pricing

H3–H6 use information that is public at the origin, so it should already be priced. H1–H2 are the most recent forecast changes, made up to ~14 h before the close, and should also be priced. A positive CW result would mean slow absorption of forecast news. The contemporaneous diagnostic should be positive: colder than forecast should mean higher prices.

<!-- RESULTS: everything below this line is generated by research/price-revisions.ts -->
