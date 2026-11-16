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

## Results

*Generated 2026-11-16T10:01:08.116Z by `npx tsx research/price-revisions.ts`. Machine-readable: `public/research/price-revisions.json`. Inputs SHA-256 `e36ab84ed21cca58…`. Origins dropped: 8 non-Friday closes, 10 with missing inputs.*

| Test | Kind | OOS n | OOS window | R²os wx | 95% CI | R²os mkt | R²os wx vs mkt | RMSE wx/RW | CW p (wx>mkt) | BH q | DM p (wx<RW) | BH q | In-sample % ret per SD (HAC t) |
|---|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| H1 1-day revision of the gas-weighted HDD+CDD forecast for days 0…+5 (lead k+1 minus lead k+2) | change | 219 | 2022-05-20…2026-11-06 | -6.10% | [-13.8, 0.7]% | -1.16% | -4.88% | 1.039 | 0.943 | 0.944 | 0.965 | 0.965 | -0.49 (-0.5) |
| H2 Accumulated revision for days 0…+5 (lead k+1 minus lead 7) | change | 219 | 2022-05-20…2026-11-06 | -2.33% | [-7.3, 3.1]% | -1.16% | -1.15% | 1.020 | 0.486 | 0.729 | 0.903 | 0.965 | 0.78 (1.1) |
| H3 Weather surprise of the storage week just ended: realised minus week-start forecast HDD+CDD | news | 219 | 2022-05-20…2026-11-06 | -0.74% | [-5.4, 3.4]% | -1.16% | 0.41% | 1.013 | 0.115 | 0.345 | 0.847 | 0.965 | 0.36 (0.7) |
| H4 Storage-model surprise of that week: model(realised DD) minus model(forecast DD), Bcf | news | 219 | 2022-05-20…2026-11-06 | -1.58% | [-6.1, 2.4]% | -1.16% | -0.41% | 1.017 | 0.944 | 0.944 | 0.918 | 0.965 | 0.08 (0.1) |
| H5 Weather-implied storage anomaly of that week vs the EIA five-year average, Bcf | level | 219 | 2022-05-20…2026-11-06 | 3.30% | [-4.2, 9.6]% | -1.16% | 4.41% | 0.992 | 0.039 | 0.233 | 0.352 | 0.965 | 2.18 (2.6) |
| H6 Forecast-implied storage anomaly of the coming week vs the five-year average, Bcf | level | 219 | 2022-05-20…2026-11-06 | -1.91% | [-8.1, 3.2]% | -1.16% | -0.74% | 1.018 | 0.452 | 0.729 | 0.875 | 0.965 | 1.08 (1.4) |

_No family member reached Clark–West q < 0.10, so no robustness grid was run._

### Contemporaneous diagnostic (not a forecast)

Weekly return regressed on the weather surprise that arrives during the holding week itself (realised minus origin-forecast HDD+CDD for the storage week starting at the origin), full sample with Newey–West HAC: 1.09% return per SD (HAC t 1.62, p 0.105, R² 0.012, n 271, 2021-05-07…2026-11-06). This uses information unavailable at the origin and measures whether weather news is priced when it arrives.

### Reading

- 0 of 6 family members show weather information adding to the market-only model at Benjamini–Hochberg q < 0.10 (Clark–West); 0 beat the no-change forecast at q < 0.10 (Diebold–Mariano).
- Lowest raw Clark–West p: H5_WKANOM_5Y (p 0.039, q 0.233; R²os 3.30%, 95% CI -4.2 to 9.6%; DM vs no-change p 0.352). After multiple-testing control it is not evidence. Its in-sample sign (2.18% per SD, HAC t 2.6) is also the opposite of the naive fundamental reading for H5 (a larger-than-normal weather-implied build preceding *higher* returns), so treat it as noise or a reversal effect to re-test, not a mechanism.
- Forecast *changes* (H1, H2), the weather news to be revealed by the next storage report (H3, H4) and the storage-scaled forecast level (H6) do not predict next-week returns out of sample. That is what an efficient market implies: the information is public at the Friday close and is priced.
- Contemporaneous diagnostic: the weather surprise arriving *during* the holding week has a positive but statistically weak association with that week's return (1.09% per SD, HAC t 1.62). Weekly returns are dominated by non-weather news, so even same-week weather news explains only ~1.2% of their variance.
- Taken with `STORAGE_STUDY.md`: weather forecasts strongly predict the physical storage change, but that predictability does not transfer to next-week futures returns.
- The Previous Runs API exposes previous_day1…previous_day7 only. A week-on-week revision of a fixed target window (issue t vs t − 7) needs leads 8–14 and is impossible; H1/H2 are the longest revisions the archive supports (1 day, and lead k+1 vs lead 7 for days 0…+5).
