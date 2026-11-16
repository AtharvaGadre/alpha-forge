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

## Results

*Generated 2026-11-16T10:11:04.261Z by `npx tsx research/storage-study.ts`. Machine-readable: `public/research/storage-skill.json` (every number below is in that file). Inputs SHA-256 `3532261dcbaa4bd0…`.*

### Data actually used

- EIA Lower-48 weekly levels from `https://www.eia.gov/dnav/ng/hist/nw2_epg0_swo_r48_bcfw.htm` (fetched 2026-11-16T09:43:46.904Z); implied flow = net change minus 19 documented non-flow adjustments. Check against EIA's stated implied flows: 12 of 17 match exactly; differences: 2015-07-17 (66 vs stated 68); 2015-08-28 (88 vs stated 86); 2019-04-05 (28 vs stated 29); 2023-06-30 (72 vs stated 68); 2024-09-20 (56 vs stated 55).
- CPC daily CONUS gas-weighted HDD and population-weighted CDD 2009–2026.
- City→CPC maps (ERA5, 2016-01-01…2020-12-31, daily): CONUS HDD reproduced with R² 0.982 (RMSE 1.53 °F·day/day), CDD R² 0.970 (RMSE 0.78). CPC division weights reproduce CPC CONUS with R² 0.9994 (HDD) and 0.9957 (CDD).
- Test windows: IFS+GFS (primary) 2024-03-15…2026-11-06, **n = 139** weeks; GFS long 2021-05-07…2026-11-06, **n = 280** weeks. Calendar weeks missing from the GFS window because forecast inputs were incomplete (not because of outcomes): 2024-01-05, 2024-01-12, 2024-01-19, 2024-01-26, 2024-02-02, 2024-02-09, 2024-02-16, 2024-02-23.
- Open-Meteo weight for the full input set: 1643 weighted calls (fetched in this run: 0).

### Development-period model selection (2015-01-09…2021-03-26, n = 325, CPC actual weather)

Five-year-average RMSE on the same weeks: 43.7 Bcf.

| Candidate | RMSE (Bcf) | MAE (Bcf) |
|---|---:|---:|
| K=2 harmonics, expanding window, weather=none | 42.36 | 29.74 |
| K=2 harmonics, rolling 260-week window, weather=none | 43.62 | 31.07 |
| K=3 harmonics, expanding window, weather=none | 42.34 | 29.67 |
| K=3 harmonics, rolling 260-week window, weather=none | 43.83 | 31.08 |
| K=4 harmonics, expanding window, weather=none | 42.48 | 30.01 |
| K=4 harmonics, rolling 260-week window, weather=none | 44.11 | 31.32 |
| K=3 harmonics, expanding window, weather=linear | 22.50 | 17.90 |
| K=3 harmonics, rolling 260-week window, weather=linear | 25.36 | 20.76 |
| K=3 harmonics, expanding window, weather=quadratic | 20.66 | 16.84 |
| K=3 harmonics, rolling 260-week window, weather=quadratic | 23.88 | 19.75 |
| K=3 harmonics, expanding window, weather=interaction | 20.76 | 17.06 |
| K=3 harmonics, rolling 260-week window, weather=interaction | 24.12 | 20.04 |

Chosen: seasonal = K=3 harmonics, expanding window, weather=none; weather = K=3 harmonics, expanding window, weather=quadratic.

### Sanity check: weather sensitivity (in-sample, 2010-01-08…2021-03-26, descriptive)

- Full-year OLS with seasonal terms (K=3 harmonics, expanding window, weather=linear): **-1.61 Bcf per weekly gas-weighted HDD** (HAC SE 0.07, t -22.9) and -1.71 Bcf per weekly population-weighted CDD (HAC SE 0.15, t -11.6); R² 0.958.
- Winter (Dec–Feb) anomalies, flow minus five-year average vs HDD minus prior-five-year normal: slope -1.74 Bcf/HDD, R² 0.85, n 85. Winter HDD anomalies have SD 36.9 °F·day per week, which at that slope implies a weather-driven flow SD of 64.2 Bcf against an observed anomaly SD of 69.6 Bcf.
- Walk-forward weather model in the test window: median marginal effect in Dec–Feb -1.81 Bcf per HDD (n 57 weeks).

### Confirmatory tests (pre-specified; Benjamini–Hochberg across these four)

| ID | Window | Model | Reference | n | RMSE model | RMSE ref | MAE model | MAE ref | MSE skill | 95% CI | DM p (sq.) | DM p (abs.) | BH q |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|
| C1 | IFS+GFS | (3) Weather model, FORECAST degree days: ECMWF IFS + GFS mean, bias-corrected | (0) EIA five-year average | 139 | 20.6 | 40.7 | 16.3 | 28.1 | 74.3% | [56.7%, 82.8%] | 0.002 | <0.001 | 0.002 |
| C2 | IFS+GFS | (3) Weather model, FORECAST degree days: ECMWF IFS + GFS mean, bias-corrected | (1) Seasonal model, no weather | 139 | 20.6 | 44.4 | 16.3 | 30.8 | 78.4% | [62.5%, 85.4%] | 0.001 | <0.001 | 0.002 |
| C3 | GFS long | (3g) Weather model, FORECAST degree days: GFS, bias-corrected | (0) EIA five-year average | 280 | 20.7 | 40.4 | 16.0 | 28.4 | 73.8% | [61.4%, 80.9%] | <0.001 | <0.001 | <0.001 |
| C4 | GFS long | (3g) Weather model, FORECAST degree days: GFS, bias-corrected | (1) Seasonal model, no weather | 280 | 20.7 | 41.0 | 16.0 | 28.4 | 74.6% | [62.0%, 81.4%] | <0.001 | <0.001 | <0.001 |

### Oracle bound, components and variants (descriptive)

| ID | Window | Model | Reference | n | RMSE model | RMSE ref | MAE model | MAE ref | MSE skill | 95% CI | DM p (sq.) | DM p (abs.) | BH q |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|
| D1 | IFS+GFS | (2) Weather model, ACTUAL CPC degree days (oracle) | (0) EIA five-year average | 139 | 17.9 | 40.7 | 14.2 | 28.1 | 80.7% | [63.0%, 88.9%] | 0.002 | <0.001 | — |
| D2 | IFS+GFS | (2) Weather model, ACTUAL CPC degree days (oracle) | (1) Seasonal model, no weather | 139 | 17.9 | 44.4 | 14.2 | 30.8 | 83.8% | [69.8%, 90.1%] | 0.001 | <0.001 | — |
| D3 | IFS+GFS | (2) Weather model, ACTUAL CPC degree days (oracle) | (3) Weather model, FORECAST degree days: ECMWF IFS + GFS mean, bias-corrected | 139 | 17.9 | 20.6 | 14.2 | 16.3 | 25.0% | [0.7%, 43.3%] | 0.023 | 0.024 | — |
| D4 | IFS+GFS | (1) Seasonal model, no weather | (0) EIA five-year average | 139 | 44.4 | 40.7 | 30.8 | 28.1 | -18.9% | [-31.7%, -6.3%] | 0.993 | 0.995 | — |
| D5 | IFS+GFS | (3e) Weather model, FORECAST degree days: ECMWF IFS, bias-corrected | (1) Seasonal model, no weather | 139 | 21.1 | 44.4 | 16.8 | 30.8 | 77.4% | [60.0%, 85.1%] | 0.002 | <0.001 | — |
| D6 | IFS+GFS | (3g) Weather model, FORECAST degree days: GFS, bias-corrected | (1) Seasonal model, no weather | 139 | 20.9 | 44.4 | 16.2 | 30.8 | 77.8% | [63.3%, 84.6%] | 0.001 | <0.001 | — |
| D7 | IFS+GFS | (3r) Weather model, FORECAST degree days: IFS + GFS mean, no bias correction | (1) Seasonal model, no weather | 139 | 20.1 | 44.4 | 15.8 | 30.8 | 79.4% | [65.2%, 86.7%] | 0.001 | <0.001 | — |
| D8 | IFS+GFS | (2) Weather model, ACTUAL CPC degree days (oracle) | (2b) Weather model, ERA5 at the nine cities (representativeness oracle) | 139 | 17.9 | 19.0 | 14.2 | 15.4 | 11.7% | [-12.4%, 32.6%] | 0.163 | 0.111 | — |
| D9 | GFS long | (2) Weather model, ACTUAL CPC degree days (oracle) | (0) EIA five-year average | 280 | 18.5 | 40.4 | 14.8 | 28.4 | 79.0% | [67.1%, 85.2%] | <0.001 | <0.001 | — |
| D10 | GFS long | (2) Weather model, ACTUAL CPC degree days (oracle) | (1) Seasonal model, no weather | 280 | 18.5 | 41.0 | 14.8 | 28.4 | 79.6% | [68.8%, 86.4%] | <0.001 | <0.001 | — |
| D11 | GFS long | (2) Weather model, ACTUAL CPC degree days (oracle) | (3g) Weather model, FORECAST degree days: GFS, bias-corrected | 280 | 18.5 | 20.7 | 14.8 | 16.0 | 19.7% | [1.5%, 34.5%] | 0.019 | 0.060 | — |
| D12 | GFS long | (1) Seasonal model, no weather | (0) EIA five-year average | 280 | 41.0 | 40.4 | 28.4 | 28.4 | -3.2% | [-15.8%, 9.2%] | 0.693 | 0.490 | — |
| D13 | GFS long | (3gr) Weather model, FORECAST degree days: GFS, no bias correction | (1) Seasonal model, no weather | 280 | 23.5 | 41.0 | 17.5 | 28.4 | 67.3% | [52.2%, 76.8%] | <0.001 | <0.001 | — |
| D14 | GFS long | (2) Weather model, ACTUAL CPC degree days (oracle) | (2b) Weather model, ERA5 at the nine cities (representativeness oracle) | 280 | 18.5 | 18.9 | 14.8 | 15.1 | 3.9% | [-16.9%, 20.5%] | 0.337 | 0.334 | — |

Share of the oracle's MSE gain over the seasonal model captured by the issued forecast: IFS+GFS 93.5%, GFS long window 93.7%.

### Forecast degree days vs CPC truth (weekly sums, °F·day)

| Window | Source | n | HDD RMSE | HDD bias | HDD corr. | CDD RMSE | CDD bias | Dec–Feb n | Dec–Feb HDD RMSE | Dec–Feb HDD bias |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| IFS+GFS | ERA5 at nine cities (mapped) | 139 | 10.1 | -1.1 | 0.996 | 4.4 | 1.0 | 26 | 12.5 | -11.0 |
| IFS+GFS | GFS, bias-corrected | 139 | 10.1 | -0.1 | 0.994 | 4.6 | 1.8 | 26 | 10.6 | -6.8 |
| IFS+GFS | GFS, raw | 139 | 14.2 | -4.0 | 0.992 | 7.1 | 4.9 | 26 | 20.3 | -18.5 |
| IFS+GFS | ECMWF IFS, bias-corrected | 139 | 11.2 | -0.8 | 0.992 | 5.7 | 1.5 | 26 | 12.4 | -8.3 |
| IFS+GFS | IFS + GFS mean, bias-corrected | 139 | 10.3 | -0.7 | 0.994 | 4.8 | 1.5 | 26 | 10.8 | -7.7 |
| IFS+GFS | IFS + GFS mean, raw | 139 | 10.2 | -0.6 | 0.994 | 5.3 | 3.1 | 26 | 11.6 | -8.6 |
| GFS long | ERA5 at nine cities (mapped) | 280 | 10.3 | -1.4 | 0.996 | 4.1 | 1.3 | 57 | 12.0 | -10.7 |
| GFS long | GFS, bias-corrected | 280 | 10.6 | -0.3 | 0.994 | 4.5 | 2.2 | 57 | 11.3 | -7.6 |
| GFS long | GFS, raw | 280 | 14.4 | -4.1 | 0.992 | 6.9 | 4.6 | 57 | 20.2 | -18.2 |

Correlations include the seasonal cycle and are therefore high for every source; RMSE is the informative column.

### Daily CONUS HDD error vs CPC by lead (Dec–Feb days, bias-corrected, °F·day)

| Window | Models | Lead 1 | Lead 2 | Lead 3 | Lead 4 | Lead 5 | Lead 6 | Lead 7 | n per lead |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| IFS+GFS | gfs_global+ecmwf_ifs025 | 1.95 | 1.96 | 2.01 | 2.11 | 2.12 | 2.37 | 2.71 | 180 |
| IFS+GFS | ecmwf_ifs025 | 2.11 | 2.14 | 2.23 | 2.40 | 2.47 | 2.85 | 3.22 | 180 |
| GFS long | gfs_global | 1.92 | 1.93 | 2.01 | 2.18 | 2.33 | 2.65 | 3.04 | 402 |

### RMSE by season (Bcf)

| Window | Season | n | Five-year avg | Seasonal | Oracle | Forecast IFS+GFS | Forecast GFS |
|---|---|---:|---:|---:|---:|---:|---:|
| IFS+GFS | Heating season (Nov–Mar) | 47 | 63.7 | 69.7 | 18.9 | 24.4 | 25.5 |
| IFS+GFS | Injection season (Apr–Oct) | 92 | 20.7 | 22.2 | 17.3 | 18.4 | 18.1 |
| GFS long | Heating season (Nov–Mar) | 101 | 61.6 | 62.3 | 21.1 | — | 25.2 |
| GFS long | Injection season (Apr–Oct) | 179 | 20.2 | 21.1 | 16.9 | — | 17.6 |

### Post-hoc check: EIA's published five-year average (not pre-specified)

Source `https://ir.eia.gov/ngs/ngsstats.xls` (extracted 2026-11-16T09:58:59.576288+00:00 by `research/tools/eia_ngsstats.py`). On the test weeks, the recomputed five-year-average **level** differs from EIA's published value by 0.32 Bcf on average (max 2.5, n 280), and the five-year-average **change** by 0.36 Bcf on average (max 1.7, n 276). Re-scoring against the published benchmark:

| Window | Forecast | n | RMSE published five-year avg | RMSE recomputed (same weeks) | RMSE forecast | MSE skill vs published | 95% CI | DM p |
|---|---|---:|---:|---:|---:|---:|---|---:|
| IFS+GFS | IFS+GFS | 137 | 40.6 | 40.7 | 20.6 | 74.1% | [54.4%, 82.8%] | 0.003 |
| GFS long | GFS | 276 | 39.2 | 39.2 | 20.2 | 73.4% | [61.1%, 80.6%] | <0.001 |

### Reading

- **4 of 4 confirmatory comparisons are significant at BH q < 0.05.** Unlike futures returns, the physical storage change is strongly forecastable from weather information issued before the week starts.
- Issued IFS+GFS weather forecast vs the EIA five-year average: MSE skill 74.3% (95% CI 56.7% to 82.8%), RMSE 20.6 vs 40.7 Bcf, DM p 0.002, n 139.
- Issued IFS+GFS weather forecast vs the seasonal model: MSE skill 78.4% (95% CI 62.5% to 85.4%), RMSE 20.6 vs 44.4 Bcf, DM p 0.001, n 139.
- Issued GFS forecast vs the five-year average (long window): MSE skill 73.8% (95% CI 61.4% to 80.9%), RMSE 20.7 vs 40.4 Bcf, DM p <0.001, n 280.
- Issued GFS forecast vs the seasonal model (long window): MSE skill 74.6% (95% CI 62.0% to 81.4%), RMSE 20.7 vs 41.0 Bcf, DM p <0.001, n 280.
- Oracle bound: actual CPC weather vs the seasonal model (IFS+GFS window): MSE skill 83.8% (95% CI 69.8% to 90.1%), RMSE 17.9 vs 44.4 Bcf, DM p 0.001, n 139. The issued forecast is worse than the oracle (oracle vs forecast: MSE skill 25.0% (95% CI 0.7% to 43.3%), RMSE 17.9 vs 20.6 Bcf, DM p 0.023, n 139), but it keeps about 94% (IFS+GFS) and 94% (GFS) of the oracle's MSE gain over the seasonal model. The weekly forecast degree-day error against CPC is close to the error of the nine-city ERA5 index itself (verification table above), and daily error grows with lead as expected (lead table).
- The gain is concentrated in the heating season. In the GFS window, Nov–Mar RMSE is 61.6 Bcf for the five-year average, 25.2 for the GFS forecast model and 21.1 for the oracle (n 101). Apr–Oct it is 20.2, 17.6 and 16.9 (n 179): summer weather moves injections far less than winter weather moves withdrawals.
- The seasonal model alone does not beat the five-year average (IFS+GFS window: MSE skill -18.9% (95% CI -31.7% to -6.3%), RMSE 44.4 vs 40.7 Bcf, DM p 0.993, n 139; GFS window: MSE skill -3.2% (95% CI -15.8% to 9.2%), RMSE 41.0 vs 40.4 Bcf, DM p 0.693, n 280). All of the skill comes from weather.
- Bias correction mattered for GFS alone (raw GFS vs seasonal: MSE skill 67.3% (95% CI 52.2% to 76.8%), RMSE 23.5 vs 41.0 Bcf, DM p <0.001, n 280, against 74.6% corrected). For the IFS+GFS mean, the uncorrected variant was marginally better in this window (raw IFS+GFS vs seasonal: MSE skill 79.4% (95% CI 65.2% to 86.7%), RMSE 20.1 vs 44.4 Bcf, DM p 0.001, n 139, against 78.4% corrected). The pre-specified corrected version is the headline.
- Representing CPC's national index by nine cities costs little: CPC oracle vs nine-city ERA5 oracle (IFS+GFS window): MSE skill 11.7% (95% CI -12.4% to 32.6%), RMSE 17.9 vs 19.0 Bcf, DM p 0.163, n 139.
- Scope: this compares weather-driven forecasts with the five-year average and a seasonal model. It does **not** compare them with analyst or survey consensus, which uses pipeline-flow data and was not available here, so no claim is made about beating market expectations.

### Caveats

- The weather index is CPC CONUS degree days for truth, but forecasts come from nine city points mapped to CPC census-division averages; the representativeness oracle (2b) measures the loss from that mapping separately from forecast error.
- The weather week (Central local days Friday–Thursday) leads the EIA storage week (09:00 CST Friday to Friday) by nine hours.
- Forecasts use runs initialised no later than Thursday 23:00 CT (the Friday 00 UTC cycle at the latest) for the week whose first gas day starts Friday 09:00 CT; dissemination latency of that last cycle (~4–8 h) still precedes the week start.
- The 2010–June 2015 storage history consists of EIA-derived estimates; reclassifications before November 2015 are not documented in revisions.xls and remain in the target. Multi-week restatements (2017, 2024, 2025–26) are adjusted only in their first week.
- The EIA five-year average is recomputed from today’s revised history with EIA’s daily-interpolation method; EIA’s published values at release time used the history then available.
- Weekly weather explains demand-side variation only; production, LNG feed-gas outages, pipeline maintenance and price-driven fuel switching are left to the seasonal/trend terms.
- Previous Runs archives start in March 2021 (GFS) and February 2024 (ECMWF IFS), so the primary window is ~2.7 years; the longer GFS window is the better-powered test.
- The missing GFS block (listed above) is the January–February 2024 period, which includes the record withdrawal of the January 2024 Arctic outbreak; such weeks are where the five-year average errs most, so their absence more likely understates than overstates the forecast’s skill, but it is untested.
- Targets and training use today’s revised EIA history and CPC files (data vintage of the fetch date), not the values available in real time; two restatement steps (May 2024, Aug 2025) were inferred from original vs revised stocks.
- The nine-city index reads warm against CPC in winter: the Dec–Feb weekly HDD bias is negative for ERA5 at the cities and for every forecast in the verification table. It therefore comes from the pooled-season city→CPC linear map, not from the forecasts. It works against the forecast model (fitted on CPC truth), so it can only reduce the reported skill; a season-specific map is an obvious improvement for a future version.
- Open-Meteo free API: non-commercial research use only.

### Reproduce

```bash
npx tsx research/storage-study.ts --phase=data  # fetch EIA, CPC, ERA5 and Previous Runs into research/cache/ (~1,650 Open-Meteo weighted calls)
curl -L -o /tmp/ngsstats.xls https://ir.eia.gov/ngs/ngsstats.xls && python3 -I research/tools/eia_ngsstats.py /tmp/ngsstats.xls research/cache/eia-ngsstats-l48.json  # optional post-hoc check
npx tsx research/storage-study.ts --offline     # reruns this exact study from research/cache/
npx tsx --test src/engine/storageSkill.test.ts
```
