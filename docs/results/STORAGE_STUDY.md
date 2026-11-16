# Does weather information forecast US natural-gas storage changes?

*Astraeus fundamentals study (`astraeus-ng-storage-weather-v1`). Code: `research/storage-study.ts`, `research/storage-weather.ts`, `research/storage-data.ts`, statistics in `src/engine/storageSkill.ts` (unit-tested). Results: `public/research/storage-skill.json`.*

## Pre-specification

**Status:** this section was written and committed **before any test-window week was scored**. The development-period selection in §5 used only weeks ending on or before 2021-03-26. The city-to-CPC calibration in §3 used only 2016–2020. Neither overlaps a test window. Before the commit, the only thing computed in the test windows was data coverage (which weeks have complete inputs). Results are appended below the marker by the script. Nothing above the marker is edited afterwards.

### 1. Question

The price study (`PRICE_STUDY.md`) found that weather information almost never improves weekly futures-return forecasts, because markets price the forecast. Weather should instead predict the **physical fundamentals** it drives. This study asks whether the weekly change in US Lower-48 working gas can be forecast better than the industry benchmark (EIA five-year average) and a seasonal statistical model. The forecasts use only weather forecasts available before the storage week starts.

### 2. Target

- **EIA Weekly Natural Gas Storage Report (WNGSR)**, Lower-48 working gas in underground storage, Bcf. Levels come from the EIA history table `https://www.eia.gov/dnav/ng/hist/nw2_epg0_swo_r48_bcfw.htm` (series NW2_EPG0_SWO_R48_BCF, weekly from 2010-01-01; EIA data are public domain). Stocks are measured **as of 09:00 CST on Friday** (Form EIA-912). The report is released the following Thursday at 10:30 ET, or a day later in holiday weeks.
- **Target = implied flow** = level difference minus documented non-flow changes. Those are reclassifications between base and working gas and non-flow adjustments, transcribed with EIA's notes from `https://ir.eia.gov/ngs/revisions.xls`: 19 weeks between 2015-07-17 and 2025-08-29, listed with sources in `NON_FLOW_ADJUSTMENTS` in `research/storage-study.ts`. The largest is −51 Bcf (Pacific, week ending 2021-06-11). For multi-week restatements (2017, May 2024, Aug 2025–Apr 2026), only the first week's level step is removed. Recomputed implied flows match 12 of the 17 EIA-stated values exactly. The other five (2015-07-17, 2015-08-28, 2019-04-05, 2023-06-30, 2024-09-20) differ by 1–4 Bcf. The causes are later level revisions (confirmed for 2023-06-30 and 2024-09-20) and EIA's rounded "approximately N Bcf" reclassification amounts. EIA does not document reclassifications before November 2015; any in 2010–2015 remain in the training target.
- History used: report weeks ending 2010-01-08 … 2026-11-06 (879 weeks).

### 3. Weather

- **Truth (training and oracle):** NOAA CPC daily **CONUS gas-home-heating-customer-weighted HDD** (`UtilityGas.Heating.txt`) and **population-weighted CDD** (`Population.Cooling.txt`), °F·day, base 65 °F. Source: `https://ftp.cpc.ncep.noaa.gov/htdocs/degree_days/weighted/daily_data/{YEAR}/` (US Government, public domain), 2009–2026.
- **Weather week** for the report week ending Friday F: local (Central) days Friday F−7 … Thursday F−1. This leads the EIA storage week (09:00 CST Friday to Friday) by nine hours.
- **Forecasts:** Open-Meteo Previous Runs API, hourly `temperature_2m_previous_day1…7`, `timezone=America/Chicago`. Models `gfs_global` (NOAA GFS; archive starts with the 2021-03-23 00 UTC run) and `ecmwf_ifs025` (ECMWF IFS 0.25°; starts with the 2024-02-03 00 UTC run). Probes showed that the API exposes at most `previous_day7`, and that `previous_dayN` at valid hour h comes from a run initialised no later than h − 24N hours. Daily value = (Tmax + Tmin)/2 of the local day (≥ 20 hourly values), the CPC convention.
- **Points:** one city per census division, near its gas-customer/population centre: Worcester MA, Allentown PA, Fort Wayne IN, Des Moines IA, Charlotte NC, Nashville TN, Dallas TX, Denver CO, Los Angeles CA.
- **Issue cut-off:** day i of the weather week (i = 0 Friday … 6 Thursday) uses `previous_day(i+1)`. Every forecast value therefore comes from a run initialised **no later than Thursday 23:00 CT**: the Friday 00 UTC cycle at the latest, published by about 04:30 UTC (GFS) and 08:00 UTC (IFS). That is before the week's first gas day starts at 09:00 CT Friday (14:00–15:00 UTC). Leads 1–7 cover all seven days, so no actual days are mixed in.
- **Bias correction:** for each city, model and lead, subtract the mean (forecast − ERA5) daily temperature over the 28 local days ending 7 days before the week starts. At least 21 days are required; ERA5 is published with a ~5-day delay. ERA5 comes from the Open-Meteo archive API (`models=era5`, hourly, same time zone).
- **Mapping to the CPC basis:** for each division d, CPC division DD = a_d + b_d × city DD, fitted by OLS on ERA5 city DD for 2016-01-01 … 2020-12-31. CONUS = Σ_d w_d × max(0, mapped DD_d), where w_d are CPC's division weights, recovered by least squares of CPC CONUS on CPC divisions over the same period (R² 0.9994 HDD, 0.9957 CDD). On ERA5 the nine-city index reproduces daily CPC CONUS HDD with R² 0.982 and CDD with R² 0.970 (2016–2020).
- **Multi-model forecast:** mean of the bias-corrected IFS and GFS temperatures at each city, then degree days.

### 4. Models (walk-forward, refitted every week)

| | Model | Inputs |
|---|---|---|
| (0) | **EIA five-year average** net change for the report week | Daily-interpolated levels (EIA WNGSR methodology), same calendar day in the five previous years; change = avg(F) − avg(F−7). Recomputed from current history. |
| (1) | **Seasonal**, no weather | OLS on linear trend + K annual harmonics |
| (2) | **Weather, ACTUAL degree days (oracle)** | Seasonal terms + weather terms, fitted on CPC truth and applied with CPC truth for the target week. An upper bound, not a forecast. |
| (3) | **Weather, FORECAST degree days** | The same fitted model (2) applied to the issued forecast degree days |

- Training for a target week ending F: report weeks ending ≤ F − 14 (all published by the Thursday before the week starts), from 2010-01-08. Minimum 250 weeks. Coefficients are always fitted on actual (CPC) degree days.
- Diagnostics outside the confirmatory family: (2b) oracle with ERA5 at the nine cities (cost of representing CPC by nine points); (3g) GFS only; (3e) IFS only; (3r) and (3gr) without bias correction.

### 5. Development-period selection (done before this commit; frozen)

Candidates were scored walk-forward on report weeks ending 2015-01-09 … 2021-03-26 (n = 325) with CPC actual weather. **Rule: lowest RMSE.** The seasonal model was chosen first from K ∈ {2, 3, 4} × {expanding, rolling 260-week}. The weather terms were then chosen from {linear: HDD, CDD; quadratic: + HDD², CDD²; interaction: quadratic + HDD·cos θ, HDD·sin θ} × {expanding, rolling}, using the selected K.

| Candidate | RMSE (Bcf) | MAE (Bcf) |
|---|---:|---:|
| Five-year average (reference) | 43.68 | 30.05 |
| K=2, expanding, no weather | 42.36 | 29.74 |
| K=2, rolling, no weather | 43.62 | 31.07 |
| **K=3, expanding, no weather** | **42.34** | 29.67 |
| K=3, rolling, no weather | 43.83 | 31.08 |
| K=4, expanding, no weather | 42.48 | 30.01 |
| K=4, rolling, no weather | 44.11 | 31.32 |
| K=3, expanding, linear | 22.50 | 17.90 |
| K=3, rolling, linear | 25.36 | 20.76 |
| **K=3, expanding, quadratic** | **20.66** | 16.84 |
| K=3, rolling, quadratic | 23.88 | 19.75 |
| K=3, expanding, interaction | 20.76 | 17.06 |
| K=3, rolling, interaction | 24.12 | 20.04 |

**Frozen:** seasonal model (1) = trend + 3 harmonics, expanding window. Weather model (2)/(3) = trend + 3 harmonics + HDD + CDD + HDD² + CDD², expanding window. The five-year average is the only rule-based model.

### 6. Test windows

No test week overlaps the development period or the mapping calibration.

- **Primary window, IFS+GFS:** every report week whose GFS and IFS forecasts are complete under §3. These run from 2024-03-15 to 2026-11-06, **n = 139** (no gaps).
- **Long window, GFS:** every report week with a complete GFS forecast. These run from 2021-05-07 to 2026-11-06, **n = 280** (8 of the 288 calendar weeks are lost because 28 lead-7 days are missing from the GFS archive).

### 7. Metrics and tests

- RMSE and MAE (Bcf); bias; **MSE skill = 1 − MSE(model)/MSE(reference)** with a circular moving-block bootstrap 95% CI (2,000 resamples, block = round(n^{1/3}), seed 20261116 + comparison index). MAE skill is also reported.
- **Diebold–Mariano**, one-sided (H1: the model is more accurate). Squared loss is primary and absolute loss secondary. Newey–West HAC variance (Bartlett, lag = ⌊4(n/100)^{2/9}⌋), Harvey–Leybourne–Newbold correction, Student t(n−1).
- **Confirmatory family (Benjamini–Hochberg across these four, significant at q < 0.05):**
  - C1: (3) IFS+GFS vs (0) five-year average, primary window
  - C2: (3) IFS+GFS vs (1) seasonal, primary window
  - C3: (3g) GFS vs (0) five-year average, long window
  - C4: (3g) GFS vs (1) seasonal, long window
- Descriptive (no multiplicity claim): oracle vs (0), (1) and (3); seasonal vs five-year average; single-model and raw variants; representativeness oracle; RMSE by heating/injection season; forecast-degree-day verification against CPC; the share of the oracle's MSE gain over the seasonal model that the issued forecast captures.

### 8. Sanity check (pre-test data, descriptive)

The OLS on report weeks 2010-01-08 … 2021-03-26 (trend + 3 harmonics + HDD + CDD, Newey–West HAC) gives **−1.61 Bcf per weekly gas-weighted HDD** (HAC t −22.9) and **−1.71 Bcf per weekly population-weighted CDD** (t −11.6). Both signs are as expected: heating raises withdrawals, and cooling raises power burn and so cuts injections. For Dec–Feb weeks, regressing the flow anomaly vs the five-year average on the HDD anomaly vs the prior five-year normal gives −1.74 Bcf/HDD with R² 0.85 (n 85). Weather therefore explains most winter deviations from the five-year average when it is known. The open question is how much survives when it must be forecast a week ahead.

### 9. Limitations known in advance

- Nine city points stand in for the CPC national index. The representativeness oracle (2b) quantifies the cost.
- Weather drives demand. Production, LNG feed-gas, outages and price-driven switching are left to the trend and seasonal terms, so weather-free errors remain.
- The primary window covers about 2.7 years. The GFS window (~5.5 years) is the better-powered test.
- Open-Meteo's free API is for non-commercial research only.

<!-- RESULTS: everything below this line is generated by research/storage-study.ts -->
