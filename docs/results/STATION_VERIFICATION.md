# Station verification

Generated 2026-11-16T10:09:36.399Z · astraeus-station-verification-v1 · suite final · headline method astraeus-v2

This study answers the first weakness of the ERA5 benchmark: ERA5 is a ~31 km reanalysis, so it rewards smooth forecasts — including ECMWF AIFS, which is trained on it. The same frozen methods are verified against weather-station observations in two modes:

- **(a) as deployed** — methods trained on ERA5 (6-day lag), verified on the station;
- **(b) station-trained** — the same methods trained on the station’s own observations with the same lag (the realistic upper bound for site-specific calibration).

A third run scores ERA5 truth on exactly the station site-days, so the change from the published headline splits into a site-subset effect (ERA5, 16 sites → ERA5, station site-days) and a truth effect (ERA5 → station). Forecasts are the cached grid-point forecasts at the benchmark coordinates; the station distance is part of the result.

## Stations

Rules: ≤ 40 km from the benchmark grid point; ≥ 80% of days 2025-07-01 → 2026-11-08 with an accepted value (GHCN: blank quality flag; Meteostat: observation-sourced only); nearest GHCN-Daily station usable for both Tmax and precipitation; else per variable the nearest usable GHCN-Daily station, then Meteostat. Alignment: shift ∈ {0, −1} maximising Pearson r with ERA5 at the site over 2025-07-01 → 2026-03-31 (development period only), then frozen.

| Site | Variable | Station | Source | Distance | Elev. diff | Coverage Tmax / Tmin / PRCP | Shift | r (shift 0 / −1) | Climatology |
|---|---|---|---|---|---|---|---|---|---|
| Iowa · US Corn Belt | Tmax | USW00094989 AMES MUNI AP | GHCN-Daily | 4.4 km | -5 m | 100% / 100% / 100% | 0 | 0.982 / 0.888 | station 2019–2024 |
| Iowa · US Corn Belt | Precip. | USW00094989 AMES MUNI AP | GHCN-Daily | 4.4 km | -5 m | 100% / 100% / 100% | 0 | 0.763 / 0.007 | station 2019–2024 |
| Kansas · US Plains | Tmax | USW00003919 SALINA MUNI AP | GHCN-Daily | 7.3 km | +9 m | 100% / 100% / 100% | 0 | 0.977 / 0.849 | station 2019–2024 |
| Kansas · US Plains | Precip. | USW00003919 SALINA MUNI AP | GHCN-Daily | 7.3 km | +9 m | 100% / 100% / 100% | 0 | 0.437 / -0.002 | station 2019–2024 |
| Córdoba · Argentina | Tmax | 87344 Cordoba Aerodrome | Meteostat | 11.8 km | +83 m | 90% / 90% / 0% | 0 | 0.947 / 0.784 | ERA5 grid point |
| New South Wales · Australia | Tmax | ASN00065070 DUBBO AIRPORT AWS | GHCN-Daily | 4 km | +21 m | 99% / 99% / 99% | 0 | 0.991 / 0.897 | station 2019–2024 |
| New South Wales · Australia | Precip. | ASN00065070 DUBBO AIRPORT AWS | GHCN-Daily | 4 km | +21 m | 99% / 99% / 99% | −1 | 0.098 / 0.563 | station 2019–2024 |
| Texas · United States | Tmax | USW00013960 DALLAS FAA AP | GHCN-Daily | 7.3 km | +18 m | 100% / 100% / 100% | 0 | 0.983 / 0.864 | station 2019–2024 |
| Texas · United States | Precip. | USW00013960 DALLAS FAA AP | GHCN-Daily | 7.3 km | +18 m | 100% / 100% / 100% | 0 | 0.592 / 0.109 | station 2019–2024 |
| Northeast · United States | Tmax | USW00094728 NY CITY CNTRL PARK | GHCN-Daily | 8.4 km | +16 m | 100% / 100% / 100% | 0 | 0.991 / 0.932 | station 2019–2024 |
| Northeast · United States | Precip. | USW00094728 NY CITY CNTRL PARK | GHCN-Daily | 8.4 km | +16 m | 100% / 100% / 100% | 0 | 0.666 / -0.033 | station 2019–2024 |
| Northwest Europe · Netherlands | Tmax | NLE00152485 SCHIPHOL | GHCN-Daily | 9.6 km | -14 m | 92% / 92% / 92% | 0 | 0.996 / 0.933 | station 2019–2024 |
| Northwest Europe · Netherlands | Precip. | NLE00152485 SCHIPHOL | GHCN-Daily | 9.6 km | -14 m | 92% / 92% / 92% | 0 | 0.667 / 0.284 | station 2019–2024 |

Elevation difference = station elevation − Copernicus GLO-90 DEM height at the benchmark coordinate. Coverage = share of days 2025-07-01 → 2026-11-08 with an accepted value. r = Pearson correlation of the re-dated station series with ERA5 at the site on development days only.

**Excluded (no usable station):**

- mato-grosso — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 86645 Sorriso, 1.1 km, 2%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 86645 Sorriso, 1.1 km, 0%)
- parana — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat SBCA0 Cascavel / Chiba, 6.9 km, 0%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat SBCA0 Cascavel / Chiba, 6.9 km, 0%)
- cordoba — precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 87345 Cordoba Observatori / San Vicente, 2.3 km, 44%)
- minas — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 86848 Varginha, 3.2 km, 3%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 86848 Varginha, 3.2 km, 0%)
- daloa — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 65560 Daloa, 2.4 km, 10%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 65560 Daloa, 2.4 km, 10%)
- punjab — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 42099 Ludhiana, 7.9 km, 5%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 42099 Ludhiana, 7.9 km, 5%)
- beauce — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 07143 Chartres, 2.7 km, 0%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 07143 Chartres, 2.7 km, 0%)
- odesa — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 33837 Odesa, 5.9 km, 11%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 33837 Odesa, 5.9 km, 0%)
- jilin — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 54172 Jilin, 1.1 km, 0%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 54172 Jilin, 1.1 km, 0%)
- mekong — Tmax: no station within 40 km with ≥ 80% observational TMAX coverage (best: meteostat 48910 Vinh Long, 31.2 km, 0%); precipitation: no station within 40 km with ≥ 80% observational PRCP coverage (best: meteostat 48910 Vinh Long, 31.2 km, 0%)

Licences: GHCN-Daily — NOAA NCEI GHCN-Daily v3 — U.S. data public domain; some non-U.S. data are restricted to non-commercial use (WMO Resolution 40). Cite Menne et al. (2012), doi:10.1175/JTECH-D-11-00103.1. Meteostat — data © Meteostat contributors, CC BY-NC 4.0 (https://meteostat.net); used for Córdoba Tmax only.

## Results — confirmation period (test days > 2026-03-31)

CRPS skill of Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) over the zero-training Gaussian (raw-gauss) and the raw ensemble, 95% block-bootstrap interval, Diebold–Mariano p (largest over bandwidths), and 80% central-interval coverage from the PIT (v2 / raw-gauss / raw ensemble).

### Daily maximum temperature

| Lead | Truth | Cases | CRPS v2 | Skill vs raw-gauss (95% CI) | DM p | Skill vs raw ensemble (95% CI) | DM p | 80% coverage v2 / gauss / raw | v2 bias |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ERA5 · all 16 grid points (published benchmark) | 2910 | 0.544 | 14.8% (12.1%, 17.5%) | <0.001 | 17.2% (14.5%, 20.1%) | <0.001 | 76% / 85% / 88% | 0.1 |
| 1 | ERA5 · station sites, station-observed days | 1222 | 0.539 | 9.4% (3.7%, 15.1%) | 0.025 | 11.8% (6.8%, 17.3%) | 0.004 | 74% / 84% / 87% | 0.123 |
| 1 | Stations · trained on ERA5 (as deployed) | 1222 | 0.97 | 1.1% (-2.4%, 4.3%) | 0.641 | 3.7% (0.7%, 6.6%) | 0.070 | 50% / 63% / 70% | -0.088 |
| 1 | Stations · trained on stations | 1222 | 0.872 | 11.1% (7.4%, 14.7%) | <0.001 | 13.5% (9.9%, 17.0%) | <0.001 | 78% / 63% / 70% | 0.218 |
| 3 | ERA5 · all 16 grid points (published benchmark) | 3209 | 0.713 | 11.3% (8.4%, 14.2%) | <0.001 | 14.8% (11.8%, 17.7%) | <0.001 | 78% / 82% / 86% | 0.128 |
| 3 | ERA5 · station sites, station-observed days | 1333 | 0.716 | 6.8% (2.6%, 11.3%) | 0.022 | 9.9% (5.4%, 14.3%) | 0.002 | 78% / 82% / 86% | 0.208 |
| 3 | Stations · trained on ERA5 (as deployed) | 1333 | 1.114 | 3.6% (0.0%, 7.4%) | 0.192 | 7.0% (3.8%, 10.5%) | 0.006 | 59% / 66% / 75% | -0.001 |
| 3 | Stations · trained on stations | 1333 | 1.035 | 10.4% (7.1%, 13.7%) | <0.001 | 13.6% (10.5%, 16.7%) | <0.001 | 80% / 66% / 75% | 0.274 |
| 5 | ERA5 · all 16 grid points (published benchmark) | 3216 | 0.946 | 7.4% (3.3%, 11.0%) | 0.012 | 11.0% (7.2%, 14.3%) | <0.001 | 76% / 77% / 83% | 0.197 |
| 5 | ERA5 · station sites, station-observed days | 1340 | 0.975 | 5.1% (0.8%, 8.7%) | 0.046 | 9.0% (4.8%, 12.4%) | <0.001 | 78% / 77% / 83% | 0.287 |
| 5 | Stations · trained on ERA5 (as deployed) | 1340 | 1.292 | 4.7% (1.4%, 7.7%) | 0.015 | 8.2% (5.2%, 11.2%) | <0.001 | 64% / 66% / 76% | 0.071 |
| 5 | Stations · trained on stations | 1340 | 1.245 | 8.2% (4.6%, 11.3%) | <0.001 | 11.6% (8.4%, 14.4%) | <0.001 | 80% / 66% / 76% | 0.32 |
| 7 | ERA5 · all 16 grid points (published benchmark) | 3328 | 1.277 | 4.5% (1.5%, 7.9%) | 0.021 | 8.7% (5.7%, 11.8%) | <0.001 | 76% / 73% / 82% | 0.252 |
| 7 | ERA5 · station sites, station-observed days | 1389 | 1.45 | 0.5% (-3.7%, 5.1%) | 0.854 | 4.5% (0.4%, 8.8%) | 0.089 | 77% / 71% / 82% | 0.452 |
| 7 | Stations · trained on ERA5 (as deployed) | 1389 | 1.715 | 2.5% (-0.8%, 6.3%) | 0.228 | 6.7% (3.4%, 10.4%) | 0.001 | 70% / 63% / 77% | 0.24 |
| 7 | Stations · trained on stations | 1389 | 1.663 | 5.4% (1.5%, 9.8%) | 0.025 | 9.5% (5.7%, 13.7%) | <0.001 | 78% / 63% / 77% | 0.49 |

### Daily precipitation

| Lead | Truth | Cases | CRPS v2 | Skill vs raw-gauss (95% CI) | DM p | Skill vs raw ensemble (95% CI) | DM p | 80% coverage v2 / gauss / raw | v2 bias |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ERA5 · all 16 grid points (published benchmark) | 3222 | 1.16 | 4.9% (3.0%, 6.9%) | <0.001 | 2.3% (1.4%, 3.2%) | <0.001 | 83% / 79% / 83% | 0.225 |
| 1 | ERA5 · station sites, station-observed days | 1165 | 1.126 | 6.3% (2.5%, 10.9%) | 0.009 | 1.9% (0.3%, 3.9%) | 0.057 | 83% / 77% / 82% | 0.175 |
| 1 | Stations · trained on ERA5 (as deployed) | 1165 | 2.052 | 3.8% (0.9%, 7.0%) | 0.025 | -0.3% (-1.9%, 1.1%) | 0.707 | 73% / 64% / 73% | 0.058 |
| 1 | Stations · trained on stations | 1165 | 2.04 | 4.3% (1.5%, 7.5%) | 0.012 | 0.2% (-1.2%, 1.5%) | 0.731 | 74% / 64% / 73% | 0.045 |
| 3 | ERA5 · all 16 grid points (published benchmark) | 3248 | 1.459 | 3.1% (1.4%, 4.8%) | 0.001 | 1.8% (1.1%, 2.5%) | <0.001 | 82% / 76% / 83% | 0.198 |
| 3 | ERA5 · station sites, station-observed days | 1174 | 1.469 | -0.5% (-3.0%, 2.3%) | 0.743 | 0.3% (-0.9%, 1.5%) | 0.669 | 81% / 74% / 81% | -0.092 |
| 3 | Stations · trained on ERA5 (as deployed) | 1174 | 2.229 | 0.7% (-0.8%, 2.4%) | 0.415 | -0.4% (-1.1%, 0.3%) | 0.363 | 74% / 65% / 74% | -0.246 |
| 3 | Stations · trained on stations | 1174 | 2.219 | 1.1% (-0.3%, 2.8%) | 0.157 | 0.1% (-0.5%, 0.6%) | 0.797 | 74% / 65% / 74% | -0.24 |
| 5 | ERA5 · all 16 grid points (published benchmark) | 3296 | 1.724 | 4.2% (2.9%, 5.7%) | <0.001 | 1.2% (0.4%, 2.1%) | 0.008 | 79% / 73% / 81% | 0.163 |
| 5 | ERA5 · station sites, station-observed days | 1192 | 1.778 | 3.5% (1.6%, 5.9%) | 0.002 | 0.0% (-1.0%, 1.2%) | 0.943 | 79% / 73% / 80% | -0.115 |
| 5 | Stations · trained on ERA5 (as deployed) | 1192 | 2.374 | 3.9% (2.5%, 5.5%) | <0.001 | 0.4% (-0.5%, 1.4%) | 0.428 | 76% / 64% / 76% | -0.29 |
| 5 | Stations · trained on stations | 1192 | 2.374 | 4.0% (2.5%, 5.5%) | <0.001 | 0.5% (-0.4%, 1.3%) | 0.316 | 76% / 64% / 76% | -0.302 |
| 7 | ERA5 · all 16 grid points (published benchmark) | 3328 | 2.019 | 4.4% (2.9%, 5.8%) | <0.001 | 1.1% (0.5%, 1.9%) | 0.008 | 80% / 70% / 81% | 0.102 |
| 7 | ERA5 · station sites, station-observed days | 1204 | 2.217 | 3.9% (1.9%, 6.2%) | <0.001 | 0.6% (-0.2%, 1.5%) | 0.308 | 80% / 69% / 80% | -0.208 |
| 7 | Stations · trained on ERA5 (as deployed) | 1204 | 2.759 | 4.0% (2.3%, 6.0%) | <0.001 | 0.6% (-0.1%, 1.5%) | 0.160 | 74% / 59% / 76% | -0.344 |
| 7 | Stations · trained on stations | 1204 | 2.748 | 4.3% (2.5%, 6.5%) | <0.001 | 1.0% (0.3%, 2.0%) | 0.046 | 75% / 59% / 76% | -0.37 |

### Station-trained (b) over as-deployed (a), paired on identical station cases

| Method | Variable | Lead | Cases | CRPS (a) | CRPS (b) | Skill of (b) over (a) (95% CI) | DM p | 80% coverage (a) / (b) |
|---|---|---|---|---|---|---|---|---|
| astraeus-v1 | tmax | 1 | 1222 | 0.968 | 0.941 | 2.8% (1.3%, 4.1%) | 0.024 | 59% / 73% |
| astraeus-v1 | tmax | 3 | 1333 | 1.137 | 1.126 | 0.9% (0.2%, 1.7%) | 0.056 | 62% / 73% |
| astraeus-v1 | tmax | 5 | 1340 | 1.337 | 1.325 | 0.9% (0.2%, 1.7%) | 0.057 | 62% / 71% |
| astraeus-v1 | tmax | 7 | 1389 | 1.735 | 1.724 | 0.6% (-0.1%, 1.1%) | 0.199 | 65% / 72% |
| astraeus-v1 | precip | 1 | 1165 | 2.137 | 2.181 | -2.1% (-4.6%, 0.1%) | 0.142 | 63% / 70% |
| astraeus-v1 | precip | 3 | 1174 | 2.241 | 2.265 | -1.1% (-3.2%, 0.7%) | 0.392 | 66% / 71% |
| astraeus-v1 | precip | 5 | 1192 | 2.455 | 2.492 | -1.5% (-3.7%, 0.3%) | 0.146 | 68% / 71% |
| astraeus-v1 | precip | 7 | 1204 | 2.877 | 2.891 | -0.5% (-1.8%, 1.1%) | 0.512 | 66% / 69% |
| emos | tmax | 1 | 1222 | 1.001 | 0.877 | 12.4% (8.6%, 16.4%) | <0.001 | 50% / 76% |
| emos | tmax | 3 | 1333 | 1.158 | 1.06 | 8.5% (5.5%, 11.4%) | <0.001 | 57% / 77% |
| emos | tmax | 5 | 1340 | 1.362 | 1.292 | 5.1% (2.5%, 8.0%) | 0.003 | 63% / 77% |
| emos | tmax | 7 | 1389 | 1.764 | 1.699 | 3.7% (1.3%, 5.8%) | 0.025 | 67% / 76% |
| emos | precip | 1 | 1165 | 2.244 | 2.629 | -17.2% (-60.3%, 8.9%) | 0.417 | 69% / 76% |
| emos | precip | 3 | 1174 | 2.413 | 2.328 | 3.5% (-6.2%, 17.4%) | 0.667 | 71% / 75% |
| emos | precip | 5 | 1192 | 2.791 | 2.729 | 2.2% (-18.4%, 18.8%) | 0.845 | 74% / 78% |
| emos | precip | 7 | 1204 | 2.712 | 2.844 | -4.9% (-9.1%, 0.6%) | 0.112 | 76% / 77% |
| astraeus-v2 | tmax | 1 | 1222 | 0.97 | 0.872 | 10.1% (5.1%, 15.0%) | 0.024 | 50% / 78% |
| astraeus-v2 | tmax | 3 | 1333 | 1.114 | 1.035 | 7.1% (3.7%, 10.3%) | 0.003 | 59% / 80% |
| astraeus-v2 | tmax | 5 | 1340 | 1.292 | 1.245 | 3.7% (1.1%, 6.2%) | 0.010 | 64% / 80% |
| astraeus-v2 | tmax | 7 | 1389 | 1.715 | 1.663 | 3.1% (0.6%, 5.5%) | 0.060 | 70% / 78% |
| astraeus-v2 | precip | 1 | 1165 | 2.052 | 2.04 | 0.5% (-0.3%, 1.4%) | 0.275 | 73% / 74% |
| astraeus-v2 | precip | 3 | 1174 | 2.229 | 2.219 | 0.4% (-0.2%, 1.1%) | 0.201 | 74% / 74% |
| astraeus-v2 | precip | 5 | 1192 | 2.374 | 2.374 | 0.0% (-0.9%, 0.9%) | 0.949 | 76% / 76% |
| astraeus-v2 | precip | 7 | 1204 | 2.759 | 2.748 | 0.4% (-0.2%, 0.9%) | 0.260 | 74% / 75% |
| astraeus-v3 | tmax | 1 | 1222 | 0.956 | 0.858 | 10.2% (5.4%, 14.8%) | 0.014 | 53% / 79% |
| astraeus-v3 | tmax | 3 | 1333 | 1.11 | 1.033 | 6.9% (3.7%, 10.1%) | 0.003 | 62% / 80% |
| astraeus-v3 | tmax | 5 | 1340 | 1.292 | 1.247 | 3.5% (0.7%, 6.1%) | 0.031 | 67% / 82% |
| astraeus-v3 | tmax | 7 | 1389 | 1.693 | 1.648 | 2.6% (0.3%, 4.8%) | 0.087 | 73% / 81% |
| astraeus-v3 | precip | 1 | 1165 | 2.052 | 2.04 | 0.5% (-0.3%, 1.4%) | 0.275 | 73% / 74% |
| astraeus-v3 | precip | 3 | 1174 | 2.229 | 2.219 | 0.4% (-0.2%, 1.1%) | 0.201 | 73% / 73% |
| astraeus-v3 | precip | 5 | 1192 | 2.374 | 2.374 | 0.0% (-0.9%, 0.9%) | 0.949 | 74% / 74% |
| astraeus-v3 | precip | 7 | 1204 | 2.759 | 2.748 | 0.4% (-0.2%, 0.9%) | 0.260 | 77% / 77% |

### What changes against stations (confirmation period)

- Tmax day 1: skill over raw-gauss 14.8% (ERA5, 16 sites) → 9.4% (ERA5, station site-days) → 1.1% (stations, as deployed; p 0.641) → 11.1% (stations, station-trained; p <0.001); v2 80% coverage 74% (ERA5, station site-days) → 50% (as deployed) → 78% (station-trained).
- Tmax day 3: skill over raw-gauss 11.3% (ERA5, 16 sites) → 6.8% (ERA5, station site-days) → 3.6% (stations, as deployed; p 0.192) → 10.4% (stations, station-trained; p <0.001); v2 80% coverage 78% (ERA5, station site-days) → 59% (as deployed) → 80% (station-trained).
- Tmax day 5: skill over raw-gauss 7.4% (ERA5, 16 sites) → 5.1% (ERA5, station site-days) → 4.7% (stations, as deployed; p 0.015) → 8.2% (stations, station-trained; p <0.001); v2 80% coverage 78% (ERA5, station site-days) → 64% (as deployed) → 80% (station-trained).
- Tmax day 7: skill over raw-gauss 4.5% (ERA5, 16 sites) → 0.5% (ERA5, station site-days) → 2.5% (stations, as deployed; p 0.228) → 5.4% (stations, station-trained; p 0.025); v2 80% coverage 77% (ERA5, station site-days) → 70% (as deployed) → 78% (station-trained).
- Precipitation day 1: skill over the raw ensemble 2.3% (ERA5, 16 sites) → 1.9% (ERA5, station site-days) → -0.3% (stations, as deployed; p 0.707) → 0.2% (station-trained; p 0.731).
- Precipitation day 3: skill over the raw ensemble 1.8% (ERA5, 16 sites) → 0.3% (ERA5, station site-days) → -0.4% (stations, as deployed; p 0.363) → 0.1% (station-trained; p 0.797).
- Precipitation day 5: skill over the raw ensemble 1.2% (ERA5, 16 sites) → 0.0% (ERA5, station site-days) → 0.4% (stations, as deployed; p 0.428) → 0.5% (station-trained; p 0.316).
- Precipitation day 7: skill over the raw ensemble 1.1% (ERA5, 16 sites) → 0.6% (ERA5, station site-days) → 0.6% (stations, as deployed; p 0.160) → 1.0% (station-trained; p 0.046).
- Against station rainfall the climatology reference beats astraeus-v2 at lead(s) 7 (CRPSS vs climatology < 0 in the as-deployed run).

## Single-model ranking: ERA5 vs station truth (confirmation period)

Mean absolute error of each raw model on identical cases (station site-days). “Site-debiased” removes each model’s mean error at each site over the period (an in-sample diagnostic separating systematic grid-vs-station offsets from day-to-day skill).

### Daily maximum temperature

| Lead | Rank on ERA5 (MAE) | Rank on stations (MAE) | Rank on stations (site-debiased MAE) |
|---|---|---|---|
| 1 | AIFS 0.814 · ICON 1.084 · IFS 1.128 · GEM 1.195 · GFS 1.256 · UM 1.279 · GSM 1.884 | AIFS 1.413 · ICON 1.418 · GFS 1.467 · GEM 1.548 · UM 1.593 · IFS 1.599 · GSM 2.379 | AIFS 1.17 · ICON 1.293 · IFS 1.367 · GEM 1.373 · GFS 1.376 · UM 1.429 · GSM 1.781 |
| 3 | AIFS 1.059 · IFS 1.382 · ICON 1.42 · GEM 1.596 · GFS 1.84 · GSM 2.098 | AIFS 1.625 · ICON 1.707 · IFS 1.8 · GEM 2.039 · GFS 2.079 · GSM 2.568 | AIFS 1.365 · IFS 1.613 · ICON 1.625 · GEM 1.875 · GFS 1.908 · GSM 2.011 |
| 5 | AIFS 1.44 · IFS 1.855 · GEM 1.957 · ICON 2.092 · GFS 2.28 · GSM 2.398 | AIFS 1.901 · IFS 2.209 · GEM 2.285 · ICON 2.337 · GFS 2.503 · GSM 2.804 | AIFS 1.667 · IFS 2.075 · GEM 2.121 · ICON 2.234 · GFS 2.336 · GSM 2.362 |
| 7 | AIFS 2.051 · GEM 2.47 · IFS 2.564 · GSM 2.824 · GFS 3.065 | AIFS 2.466 · GEM 2.788 · IFS 2.917 · GSM 3.146 · GFS 3.255 | AIFS 2.289 · GEM 2.657 · IFS 2.758 · GSM 2.806 · GFS 3.104 |

### Daily precipitation

| Lead | Rank on ERA5 (MAE) | Rank on stations (MAE) | Rank on stations (site-debiased MAE) |
|---|---|---|---|
| 1 | AIFS 1.546 · IFS 1.845 · ICON 2.229 · UM 2.231 · GSM 2.398 · GFS 2.758 · GEM 2.865 | AIFS 2.67 · IFS 2.926 · ICON 3.058 · GSM 3.116 · UM 3.156 · GFS 3.462 · GEM 3.763 | AIFS 2.845 · IFS 3.145 · UM 3.414 · GSM 3.445 · ICON 3.478 · GFS 4.075 · GEM 4.261 |
| 3 | AIFS 2.039 · GEM 2.471 · IFS 2.558 · ICON 2.602 · GFS 2.623 · GSM 2.833 | AIFS 2.954 · GFS 3.215 · ICON 3.276 · GEM 3.28 · IFS 3.416 · GSM 3.467 | AIFS 3.158 · ICON 3.527 · IFS 3.56 · GEM 3.571 · GFS 3.578 · GSM 3.841 |
| 5 | AIFS 2.526 · GFS 2.943 · IFS 2.973 · ICON 3.167 · GSM 3.324 · GEM 3.326 | GFS 3.265 · AIFS 3.297 · IFS 3.568 · ICON 3.732 · GSM 3.993 · GEM 4.042 | AIFS 3.579 · IFS 3.814 · GFS 3.921 · ICON 4.088 · GEM 4.373 · GSM 4.448 |
| 7 | AIFS 3.067 · GFS 3.162 · IFS 3.729 · GEM 3.973 · GSM 4.051 | GFS 3.476 · AIFS 3.885 · IFS 4.376 · GEM 4.389 · GSM 4.588 | AIFS 4.095 · GFS 4.301 · IFS 4.721 · GEM 4.778 · GSM 5.103 |

AIFS ranks first in 8 of 8 variable–lead cells on ERA5 (station site-days), 6 of 8 on station MAE and 8 of 8 on site-debiased station MAE (development period: 7, 3 and 7).

AIFS's MAE advantage over the best other model (Tmax): day 1 24.9% on ERA5 vs 0.4% on stations; day 3 23.4% on ERA5 vs 4.8% on stations; day 5 22.4% on ERA5 vs 13.9% on stations; day 7 17.0% on ERA5 vs 11.5% on stations (negative = another model is better).

## Per site (all leads pooled, confirmation period)

| Site | Variable | Cases | astraeus-v2 skill vs raw-gauss: ERA5 / as deployed / station-trained | 80% coverage: ERA5 / as deployed / station-trained |
|---|---|---|---|---|
| iowa | tmax | 793 | -3.4% / -3.2% / -2.1% | 76% / 63% / 80% |
| iowa | precip | 813 | 1.9% / 0.0% / 0.2% | 79% / 69% / 69% |
| kansas | tmax | 789 | 9.3% / 0.1% / 2.0% | 78% / 57% / 80% |
| kansas | precip | 817 | 5.7% / 5.9% / 6.1% | 82% / 74% / 76% |
| cordoba | tmax | 698 | 0.5% / -3.9% / 0.8% | 75% / 62% / 73% |
| nsw | tmax | 772 | 9.4% / 22.6% / 38.1% | 79% / 53% / 80% |
| nsw | precip | 801 | 2.7% / 1.2% / 1.9% | 81% / 74% / 75% |
| texas | tmax | 789 | 10.5% / -0.2% / 4.4% | 74% / 61% / 80% |
| texas | precip | 817 | 2.3% / 7.1% / 9.1% | 81% / 78% / 79% |
| northeast | tmax | 793 | 2.9% / -0.3% / 0.9% | 78% / 66% / 80% |
| northeast | precip | 817 | 5.6% / 4.5% / 3.9% | 80% / 74% / 74% |
| northwest-europe | tmax | 650 | 2.3% / 10.1% / 20.5% | 77% / 68% / 80% |
| northwest-europe | precip | 670 | -0.2% / 0.5% / 0.5% | 82% / 76% / 77% |

## Development period (test days ≤ 2026-03-31)

CRPS skill of Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) over the zero-training Gaussian (raw-gauss) and the raw ensemble, 95% block-bootstrap interval, Diebold–Mariano p (largest over bandwidths), and 80% central-interval coverage from the PIT (v2 / raw-gauss / raw ensemble).

### Daily maximum temperature

| Lead | Truth | Cases | CRPS v2 | Skill vs raw-gauss (95% CI) | DM p | Skill vs raw ensemble (95% CI) | DM p | 80% coverage v2 / gauss / raw | v2 bias |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ERA5 · all 16 grid points (final suite, development days) | 2816 | 0.594 | 13.8% (11.0%, 17.0%) | <0.001 | 15.4% (12.1%, 18.7%) | <0.001 | 76% / 81% / 85% | 0.051 |
| 1 | ERA5 · station sites, station-observed days | 1215 | 0.609 | 10.1% (6.2%, 14.5%) | <0.001 | 11.6% (7.5%, 16.2%) | <0.001 | 75% / 83% / 86% | 0.016 |
| 1 | Stations · trained on ERA5 (as deployed) | 1215 | 1.234 | 1.6% (-1.2%, 5.4%) | 0.487 | 3.2% (0.6%, 6.8%) | 0.143 | 50% / 57% / 67% | -0.104 |
| 1 | Stations · trained on stations | 1215 | 1.045 | 16.7% (13.6%, 20.5%) | <0.001 | 18.1% (14.9%, 21.8%) | <0.001 | 77% / 57% / 67% | 0.255 |
| 3 | ERA5 · all 16 grid points (final suite, development days) | 2784 | 0.782 | 8.3% (5.8%, 10.9%) | <0.001 | 11.1% (8.5%, 13.7%) | <0.001 | 74% / 79% / 84% | 0.031 |
| 3 | ERA5 · station sites, station-observed days | 1201 | 0.833 | 5.9% (2.0%, 9.9%) | 0.039 | 9.2% (5.7%, 13.1%) | <0.001 | 74% / 80% / 84% | 0.025 |
| 3 | Stations · trained on ERA5 (as deployed) | 1201 | 1.411 | 2.4% (-0.1%, 5.5%) | 0.244 | 5.1% (2.8%, 7.9%) | 0.007 | 56% / 60% / 71% | -0.093 |
| 3 | Stations · trained on stations | 1201 | 1.268 | 12.2% (9.0%, 15.7%) | <0.001 | 14.7% (11.7%, 18.1%) | <0.001 | 75% / 60% / 71% | 0.28 |
| 5 | ERA5 · all 16 grid points (final suite, development days) | 2752 | 1.021 | 4.0% (1.8%, 6.7%) | 0.040 | 7.3% (5.4%, 9.8%) | <0.001 | 74% / 75% / 82% | 0.046 |
| 5 | ERA5 · station sites, station-observed days | 1187 | 1.186 | 1.6% (-1.5%, 5.5%) | 0.494 | 4.9% (2.0%, 8.5%) | 0.038 | 72% / 74% / 80% | 0.024 |
| 5 | Stations · trained on ERA5 (as deployed) | 1187 | 1.673 | 0.2% (-2.2%, 3.2%) | 0.914 | 3.3% (1.0%, 6.2%) | 0.097 | 60% / 60% / 71% | -0.094 |
| 5 | Stations · trained on stations | 1187 | 1.575 | 6.0% (2.9%, 9.8%) | 0.032 | 8.9% (6.0%, 12.5%) | 0.001 | 73% / 60% / 71% | 0.243 |
| 7 | ERA5 · all 16 grid points (final suite, development days) | 2720 | 1.422 | 2.0% (-0.6%, 5.0%) | 0.311 | 7.2% (4.6%, 10.1%) | <0.001 | 74% / 73% / 81% | 0.119 |
| 7 | ERA5 · station sites, station-observed days | 1173 | 1.761 | -1.0% (-4.5%, 2.9%) | 0.714 | 5.1% (2.0%, 8.8%) | 0.051 | 72% / 69% / 80% | 0.144 |
| 7 | Stations · trained on ERA5 (as deployed) | 1173 | 2.144 | 0.9% (-2.2%, 4.5%) | 0.721 | 5.7% (2.8%, 9.2%) | 0.029 | 65% / 61% / 77% | 0.027 |
| 7 | Stations · trained on stations | 1173 | 2.097 | 3.1% (-1.5%, 8.3%) | 0.444 | 7.8% (3.3%, 12.7%) | 0.052 | 70% / 61% / 77% | 0.383 |

### Daily precipitation

| Lead | Truth | Cases | CRPS v2 | Skill vs raw-gauss (95% CI) | DM p | Skill vs raw ensemble (95% CI) | DM p | 80% coverage v2 / gauss / raw | v2 bias |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ERA5 · all 16 grid points (final suite, development days) | 2816 | 0.898 | 5.6% (2.9%, 8.2%) | <0.001 | 3.4% (1.9%, 5.0%) | <0.001 | 81% / 78% / 83% | 0.107 |
| 1 | ERA5 · station sites, station-observed days | 1056 | 0.524 | 3.2% (-0.7%, 6.8%) | 0.115 | 3.0% (0.1%, 5.9%) | 0.065 | 80% / 77% / 82% | 0.003 |
| 1 | Stations · trained on ERA5 (as deployed) | 1056 | 1.021 | 0.7% (-1.2%, 2.5%) | 0.539 | -0.5% (-2.0%, 0.8%) | 0.588 | 75% / 69% / 75% | -0.044 |
| 1 | Stations · trained on stations | 1056 | 1.015 | 1.4% (-0.4%, 3.2%) | 0.171 | 0.2% (-0.5%, 1.0%) | 0.731 | 76% / 69% / 75% | -0.041 |
| 3 | ERA5 · all 16 grid points (final suite, development days) | 2784 | 1.118 | 3.8% (2.5%, 6.4%) | 0.001 | 2.5% (1.7%, 3.8%) | <0.001 | 81% / 76% / 81% | 0.185 |
| 3 | ERA5 · station sites, station-observed days | 1044 | 0.746 | 1.2% (-1.5%, 3.9%) | 0.465 | 0.4% (-0.9%, 1.7%) | 0.573 | 79% / 74% / 80% | -0.038 |
| 3 | Stations · trained on ERA5 (as deployed) | 1044 | 1.123 | 0.4% (-1.7%, 2.5%) | 0.698 | -1.0% (-2.2%, 0.3%) | 0.232 | 76% / 67% / 76% | -0.097 |
| 3 | Stations · trained on stations | 1044 | 1.112 | 1.4% (-0.8%, 3.5%) | 0.273 | 0.0% (-1.1%, 1.2%) | 0.969 | 77% / 67% / 76% | -0.078 |
| 5 | ERA5 · all 16 grid points (final suite, development days) | 2752 | 1.282 | 2.1% (-0.1%, 3.6%) | 0.050 | 1.1% (0.1%, 1.8%) | 0.032 | 81% / 75% / 81% | -0.065 |
| 5 | ERA5 · station sites, station-observed days | 1032 | 0.966 | 0.3% (-2.9%, 4.1%) | 0.904 | -1.1% (-2.5%, 0.2%) | 0.197 | 82% / 73% / 80% | -0.068 |
| 5 | Stations · trained on ERA5 (as deployed) | 1032 | 1.256 | 1.7% (-1.1%, 5.1%) | 0.351 | -1.1% (-2.8%, 0.5%) | 0.310 | 79% / 67% / 78% | -0.132 |
| 5 | Stations · trained on stations | 1032 | 1.24 | 2.9% (0.8%, 5.7%) | 0.032 | 0.2% (-1.0%, 1.2%) | 0.755 | 79% / 67% / 78% | -0.144 |
| 7 | ERA5 · all 16 grid points (final suite, development days) | 2720 | 1.602 | 2.3% (0.2%, 4.7%) | 0.075 | 0.4% (-0.5%, 1.7%) | 0.594 | 80% / 70% / 79% | -0.08 |
| 7 | ERA5 · station sites, station-observed days | 1020 | 1.333 | 2.6% (-0.3%, 6.5%) | 0.278 | -1.1% (-2.5%, 0.5%) | 0.219 | 79% / 68% / 79% | -0.169 |
| 7 | Stations · trained on ERA5 (as deployed) | 1020 | 1.492 | 3.7% (1.5%, 6.8%) | 0.002 | -0.4% (-1.7%, 0.9%) | 0.530 | 78% / 64% / 78% | -0.223 |
| 7 | Stations · trained on stations | 1020 | 1.481 | 4.4% (2.1%, 7.7%) | 0.002 | 0.3% (-0.7%, 1.5%) | 0.665 | 77% / 64% / 78% | -0.22 |

### Station-trained (b) over as-deployed (a), paired on identical station cases

| Method | Variable | Lead | Cases | CRPS (a) | CRPS (b) | Skill of (b) over (a) (95% CI) | DM p | 80% coverage (a) / (b) |
|---|---|---|---|---|---|---|---|---|
| astraeus-v1 | tmax | 1 | 1215 | 1.23 | 1.168 | 5.0% (3.5%, 6.2%) | <0.001 | 54% / 75% |
| astraeus-v1 | tmax | 3 | 1201 | 1.421 | 1.368 | 3.7% (2.6%, 4.6%) | <0.001 | 58% / 73% |
| astraeus-v1 | tmax | 5 | 1187 | 1.664 | 1.626 | 2.3% (1.5%, 3.0%) | <0.001 | 60% / 72% |
| astraeus-v1 | tmax | 7 | 1173 | 2.146 | 2.111 | 1.6% (1.1%, 2.2%) | <0.001 | 64% / 71% |
| astraeus-v1 | precip | 1 | 1056 | 1.045 | 0.999 | 4.4% (0.2%, 9.0%) | 0.132 | 67% / 72% |
| astraeus-v1 | precip | 3 | 1044 | 1.141 | 1.141 | 0.0% (-3.6%, 3.5%) | 0.996 | 72% / 76% |
| astraeus-v1 | precip | 5 | 1032 | 1.278 | 1.295 | -1.3% (-3.5%, 0.9%) | 0.320 | 69% / 73% |
| astraeus-v1 | precip | 7 | 1020 | 1.546 | 1.572 | -1.7% (-4.5%, 1.0%) | 0.368 | 66% / 68% |
| emos | tmax | 1 | 1215 | 1.246 | 1.08 | 13.3% (10.1%, 16.3%) | <0.001 | 50% / 73% |
| emos | tmax | 3 | 1201 | 1.437 | 1.314 | 8.5% (6.0%, 11.1%) | <0.001 | 58% / 73% |
| emos | tmax | 5 | 1187 | 1.682 | 1.613 | 4.1% (1.6%, 6.4%) | 0.010 | 63% / 74% |
| emos | tmax | 7 | 1173 | 2.16 | 2.105 | 2.5% (0.2%, 4.8%) | 0.052 | 65% / 71% |
| emos | precip | 1 | 1056 | 1.274 | 1.155 | 9.3% (-12.4%, 28.1%) | 0.477 | 72% / 79% |
| emos | precip | 3 | 1044 | 1.504 | 1.255 | 16.6% (-5.6%, 32.6%) | 0.337 | 72% / 76% |
| emos | precip | 5 | 1032 | 1.418 | 1.552 | -9.5% (-58.2%, 18.1%) | 0.672 | 75% / 76% |
| emos | precip | 7 | 1020 | 2.437 | 8.008 | -228.6% (-825.5%, 32.0%) | 0.366 | 76% / 75% |
| astraeus-v2 | tmax | 1 | 1215 | 1.234 | 1.045 | 15.3% (12.4%, 18.1%) | <0.001 | 50% / 77% |
| astraeus-v2 | tmax | 3 | 1201 | 1.411 | 1.268 | 10.1% (7.8%, 12.3%) | <0.001 | 56% / 75% |
| astraeus-v2 | tmax | 5 | 1187 | 1.673 | 1.575 | 5.8% (3.3%, 8.1%) | <0.001 | 60% / 73% |
| astraeus-v2 | tmax | 7 | 1173 | 2.144 | 2.097 | 2.2% (-0.2%, 4.6%) | 0.203 | 65% / 70% |
| astraeus-v2 | precip | 1 | 1056 | 1.021 | 1.015 | 0.7% (-0.4%, 2.0%) | 0.370 | 75% / 76% |
| astraeus-v2 | precip | 3 | 1044 | 1.123 | 1.112 | 1.0% (-0.1%, 2.0%) | 0.149 | 76% / 77% |
| astraeus-v2 | precip | 5 | 1032 | 1.256 | 1.24 | 1.3% (0.0%, 2.6%) | 0.115 | 79% / 79% |
| astraeus-v2 | precip | 7 | 1020 | 1.492 | 1.481 | 0.7% (-0.3%, 2.0%) | 0.208 | 78% / 77% |
| astraeus-v3 | tmax | 1 | 1215 | 1.209 | 1.035 | 14.4% (11.3%, 17.3%) | <0.001 | 53% / 77% |
| astraeus-v3 | tmax | 3 | 1201 | 1.393 | 1.261 | 9.4% (7.0%, 11.8%) | <0.001 | 58% / 77% |
| astraeus-v3 | tmax | 5 | 1187 | 1.653 | 1.568 | 5.1% (2.6%, 7.4%) | 0.001 | 63% / 76% |
| astraeus-v3 | tmax | 7 | 1173 | 2.118 | 2.076 | 2.0% (-0.5%, 4.3%) | 0.204 | 69% / 74% |
| astraeus-v3 | precip | 1 | 1056 | 1.021 | 1.015 | 0.7% (-0.4%, 2.0%) | 0.370 | 73% / 74% |
| astraeus-v3 | precip | 3 | 1044 | 1.123 | 1.112 | 1.0% (-0.1%, 2.0%) | 0.149 | 76% / 76% |
| astraeus-v3 | precip | 5 | 1032 | 1.256 | 1.24 | 1.3% (0.0%, 2.6%) | 0.115 | 78% / 78% |
| astraeus-v3 | precip | 7 | 1020 | 1.492 | 1.481 | 0.7% (-0.3%, 2.0%) | 0.208 | 75% / 76% |

## All methods on station truth (confirmation period)

### Stations · trained on ERA5 (as deployed)

| Variable | Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | CRPSS vs raw-gauss (95% CI) | MAE | Bias | 80% coverage | PIT <0.1 / >0.9 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tmax | 1 | Climatology (station record; ERA5 where too short) | 1222 | 2.367 | 0.0% | -134.9% (-153.5%, -119.2%) | -141.3% (-160.1%, -125.6%) | 3.345 | -0.456 | 79.9% | 8% / 12% |
| tmax | 1 | Raw multi-model ensemble | 1222 | 1.008 | 57.4% | 0.0% (0.0%, 0.0%) | -2.7% (-3.4%, -2.1%) | 1.341 | -0.29 | 69.9% | 9% / 21% |
| tmax | 1 | Raw-ensemble Gaussian (no training) | 1222 | 0.981 | 58.6% | 2.7% (2.0%, 3.3%) | 0.0%  | 1.341 | -0.29 | 62.7% | 12% / 26% |
| tmax | 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1222 | 0.968 | 59.1% | 3.9% (3.2%, 4.8%) | 1.3% (0.5%, 2.1%) | 1.311 | -0.287 | 59.2% | 12% / 28% |
| tmax | 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1222 | 1.001 | 57.7% | 0.7% (-3.1%, 4.0%) | -2.0% (-6.2%, 1.5%) | 1.306 | -0.11 | 49.6% | 18% / 32% |
| tmax | 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1222 | 0.97 | 59.0% | 3.7% (0.7%, 6.6%) | 1.1% (-2.4%, 4.3%) | 1.269 | -0.088 | 50.4% | 18% / 32% |
| tmax | 1 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1222 | 0.956 | 59.6% | 5.1% (1.9%, 8.1%) | 2.5% (-1.1%, 5.8%) | 1.262 | -0.112 | 52.9% | 17% / 30% |
| tmax | 3 | Climatology (station record; ERA5 where too short) | 1333 | 2.396 | 0.0% | -99.9% (-113.7%, -86.7%) | -107.3% (-121.3%, -93.8%) | 3.403 | -0.399 | 79.1% | 8% / 13% |
| tmax | 3 | Raw multi-model ensemble | 1333 | 1.199 | 50.0% | 0.0% (0.0%, 0.0%) | -3.7% (-4.4%, -3.0%) | 1.576 | -0.303 | 74.6% | 8% / 18% |
| tmax | 3 | Raw-ensemble Gaussian (no training) | 1333 | 1.155 | 51.8% | 3.6% (2.9%, 4.2%) | 0.0%  | 1.576 | -0.303 | 65.6% | 10% / 24% |
| tmax | 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1333 | 1.137 | 52.5% | 5.1% (4.2%, 6.0%) | 1.6% (0.7%, 2.5%) | 1.54 | -0.321 | 61.8% | 11% / 27% |
| tmax | 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1333 | 1.158 | 51.7% | 3.4% (0.1%, 6.7%) | -0.2% (-3.8%, 3.2%) | 1.541 | -0.067 | 56.9% | 16% / 27% |
| tmax | 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1333 | 1.114 | 53.5% | 7.0% (3.8%, 10.5%) | 3.6% (0.0%, 7.4%) | 1.494 | -0.001 | 59.4% | 17% / 24% |
| tmax | 3 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1333 | 1.11 | 53.7% | 7.4% (4.3%, 10.7%) | 3.9% (0.5%, 7.6%) | 1.493 | -0.041 | 61.6% | 16% / 23% |
| tmax | 5 | Climatology (station record; ERA5 where too short) | 1340 | 2.375 | 0.0% | -68.7% (-81.3%, -57.7%) | -75.3% (-88.2%, -63.8%) | 3.373 | -0.413 | 78.3% | 9% / 13% |
| tmax | 5 | Raw multi-model ensemble | 1340 | 1.407 | 40.7% | 0.0% (0.0%, 0.0%) | -3.9% (-4.5%, -3.3%) | 1.854 | -0.272 | 75.8% | 7% / 17% |
| tmax | 5 | Raw-ensemble Gaussian (no training) | 1340 | 1.355 | 42.9% | 3.7% (3.2%, 4.3%) | 0.0%  | 1.854 | -0.272 | 65.6% | 11% / 24% |
| tmax | 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1340 | 1.337 | 43.7% | 5.0% (4.4%, 5.7%) | 1.3% (0.6%, 2.1%) | 1.82 | -0.312 | 62.2% | 12% / 26% |
| tmax | 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1340 | 1.362 | 42.6% | 3.2% (-0.2%, 6.0%) | -0.5% (-4.1%, 2.6%) | 1.861 | -0.074 | 63.1% | 15% / 22% |
| tmax | 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1340 | 1.292 | 45.6% | 8.2% (5.2%, 11.2%) | 4.7% (1.4%, 7.7%) | 1.766 | 0.071 | 64.2% | 16% / 20% |
| tmax | 5 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1340 | 1.292 | 45.6% | 8.2% (5.3%, 11.0%) | 4.7% (1.5%, 7.7%) | 1.772 | -0.004 | 67.4% | 14% / 19% |
| tmax | 7 | Climatology (station record; ERA5 where too short) | 1389 | 2.414 | 0.0% | -31.3% (-42.5%, -23.9%) | -37.3% (-48.7%, -29.3%) | 3.427 | -0.508 | 78.8% | 8% / 13% |
| tmax | 7 | Raw multi-model ensemble | 1389 | 1.838 | 23.9% | 0.0% (0.0%, 0.0%) | -4.5% (-5.1%, -3.8%) | 2.402 | -0.332 | 76.5% | 9% / 15% |
| tmax | 7 | Raw-ensemble Gaussian (no training) | 1389 | 1.758 | 27.1% | 4.3% (3.7%, 4.9%) | 0.0%  | 2.402 | -0.332 | 62.8% | 13% / 24% |
| tmax | 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1389 | 1.735 | 28.1% | 5.6% (4.8%, 6.2%) | 1.3% (0.6%, 1.8%) | 2.374 | -0.384 | 65.1% | 12% / 23% |
| tmax | 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1389 | 1.764 | 26.9% | 4.0% (-0.2%, 8.0%) | -0.3% (-4.8%, 3.8%) | 2.408 | 0.113 | 67.0% | 17% / 16% |
| tmax | 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1389 | 1.715 | 28.9% | 6.7% (3.4%, 10.4%) | 2.5% (-0.8%, 6.3%) | 2.359 | 0.24 | 69.9% | 16% / 14% |
| tmax | 7 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1389 | 1.693 | 29.8% | 7.9% (4.4%, 11.7%) | 3.7% (0.2%, 7.7%) | 2.325 | 0.163 | 73.3% | 14% / 12% |
| precip | 1 | Climatology (station record; ERA5 where too short) | 1165 | 2.607 | 0.0% | -27.5% (-38.3%, -14.8%) | -22.2% (-34.1%, -8.7%) | 4.393 | -0.146 | 79.1% | 11% / 10% |
| precip | 1 | Raw multi-model ensemble | 1165 | 2.045 | 21.5% | 0.0% (0.0%, 0.0%) | 4.1% (1.9%, 6.9%) | 2.872 | 0.088 | 73.1% | 16% / 11% |
| precip | 1 | Raw-ensemble Gaussian (no training) | 1165 | 2.133 | 18.2% | -4.3% (-7.4%, -1.9%) | 0.0%  | 3.025 | 0.309 | 63.9% | 25% / 11% |
| precip | 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1165 | 2.137 | 18.0% | -4.5% (-7.6%, -2.0%) | -0.2% (-2.0%, 1.5%) | 3.03 | 0.326 | 63.3% | 27% / 10% |
| precip | 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1165 | 2.244 | 13.9% | -9.7% (-20.1%, -2.4%) | -5.2% (-14.7%, 2.0%) | 2.885 | -0.245 | 69.0% | 17% / 14% |
| precip | 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1165 | 2.052 | 21.3% | -0.3% (-1.9%, 1.1%) | 3.8% (0.9%, 7.0%) | 2.8 | 0.058 | 73.1% | 16% / 11% |
| precip | 1 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1165 | 2.052 | 21.3% | -0.3% (-1.9%, 1.1%) | 3.8% (0.9%, 7.0%) | 2.8 | 0.058 | 72.7% | 16% / 12% |
| precip | 3 | Climatology (station record; ERA5 where too short) | 1174 | 2.692 | 0.0% | -21.2% (-32.7%, -10.1%) | -20.0% (-32.4%, -8.2%) | 4.469 | -0.249 | 79.2% | 10% / 11% |
| precip | 3 | Raw multi-model ensemble | 1174 | 2.221 | 17.5% | 0.0% (0.0%, 0.0%) | 1.0% (-0.3%, 2.7%) | 2.923 | -0.243 | 73.7% | 16% / 11% |
| precip | 3 | Raw-ensemble Gaussian (no training) | 1174 | 2.244 | 16.6% | -1.0% (-2.8%, 0.3%) | 0.0%  | 3.029 | -0.05 | 64.7% | 25% / 11% |
| precip | 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1174 | 2.241 | 16.8% | -0.9% (-3.4%, 0.8%) | 0.1% (-1.1%, 1.1%) | 3.1 | 0.061 | 66.3% | 25% / 9% |
| precip | 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1174 | 2.413 | 10.3% | -8.7% (-23.5%, 2.0%) | -7.5% (-21.7%, 2.8%) | 3.122 | -0.238 | 71.1% | 15% / 14% |
| precip | 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1174 | 2.229 | 17.2% | -0.4% (-1.1%, 0.3%) | 0.7% (-0.8%, 2.4%) | 2.911 | -0.246 | 73.5% | 17% / 9% |
| precip | 3 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1174 | 2.229 | 17.2% | -0.4% (-1.1%, 0.3%) | 0.7% (-0.8%, 2.4%) | 2.911 | -0.246 | 73.1% | 16% / 11% |
| precip | 5 | Climatology (station record; ERA5 where too short) | 1192 | 2.73 | 0.0% | -14.5% (-26.5%, -4.6%) | -10.5% (-22.4%, -0.6%) | 4.499 | -0.294 | 80.5% | 9% / 11% |
| precip | 5 | Raw multi-model ensemble | 1192 | 2.385 | 12.6% | 0.0% (0.0%, 0.0%) | 3.5% (2.4%, 4.8%) | 3.322 | -0.296 | 75.7% | 15% / 10% |
| precip | 5 | Raw-ensemble Gaussian (no training) | 1192 | 2.472 | 9.5% | -3.6% (-5.0%, -2.4%) | 0.0%  | 3.489 | -0.007 | 63.9% | 24% / 12% |
| precip | 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1192 | 2.455 | 10.1% | -2.9% (-5.0%, -1.6%) | 0.7% (-0.7%, 1.4%) | 3.558 | 0.151 | 67.5% | 23% / 10% |
| precip | 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1192 | 2.791 | -2.2% | -17.0% (-42.7%, -2.6%) | -12.9% (-37.6%, 1.2%) | 3.757 | 0.123 | 74.2% | 13% / 13% |
| precip | 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1192 | 2.374 | 13.0% | 0.4% (-0.5%, 1.4%) | 3.9% (2.5%, 5.5%) | 3.286 | -0.29 | 75.6% | 14% / 10% |
| precip | 5 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1192 | 2.374 | 13.0% | 0.4% (-0.5%, 1.4%) | 3.9% (2.5%, 5.5%) | 3.286 | -0.29 | 73.7% | 15% / 11% |
| precip | 7 | Climatology (station record; ERA5 where too short) | 1204 | 2.709 | 0.0% | 2.4% (-3.6%, 8.6%) | 5.7% (-1.1%, 12.5%) | 4.473 | -0.274 | 80.5% | 9% / 11% |
| precip | 7 | Raw multi-model ensemble | 1204 | 2.776 | -2.5% | 0.0% (0.0%, 0.0%) | 3.4% (1.8%, 5.2%) | 3.777 | -0.28 | 76.2% | 15% / 9% |
| precip | 7 | Raw-ensemble Gaussian (no training) | 1204 | 2.873 | -6.1% | -3.5% (-5.5%, -1.8%) | 0.0%  | 3.995 | 0.088 | 58.6% | 29% / 12% |
| precip | 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1204 | 2.877 | -6.2% | -3.6% (-6.8%, -0.9%) | -0.1% (-2.1%, 1.7%) | 4.188 | 0.389 | 66.0% | 24% / 10% |
| precip | 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1204 | 2.712 | -0.1% | 2.3% (-2.1%, 8.2%) | 5.6% (1.0%, 11.7%) | 3.876 | -0.482 | 75.9% | 12% / 12% |
| precip | 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1204 | 2.759 | -1.8% | 0.6% (-0.1%, 1.5%) | 4.0% (2.3%, 6.0%) | 3.729 | -0.344 | 74.3% | 16% / 9% |
| precip | 7 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1204 | 2.759 | -1.8% | 0.6% (-0.1%, 1.5%) | 4.0% (2.3%, 6.0%) | 3.729 | -0.344 | 77.3% | 14% / 9% |

### Stations · trained on stations

| Variable | Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | CRPSS vs raw-gauss (95% CI) | MAE | Bias | 80% coverage | PIT <0.1 / >0.9 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tmax | 1 | Climatology (station record; ERA5 where too short) | 1222 | 2.367 | 0.0% | -134.9% (-153.5%, -119.2%) | -141.3% (-160.1%, -125.6%) | 3.345 | -0.456 | 79.9% | 8% / 12% |
| tmax | 1 | Raw multi-model ensemble | 1222 | 1.008 | 57.4% | 0.0% (0.0%, 0.0%) | -2.7% (-3.4%, -2.1%) | 1.341 | -0.29 | 69.9% | 9% / 21% |
| tmax | 1 | Raw-ensemble Gaussian (no training) | 1222 | 0.981 | 58.6% | 2.7% (2.0%, 3.3%) | 0.0%  | 1.341 | -0.29 | 62.7% | 12% / 26% |
| tmax | 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1222 | 0.941 | 60.2% | 6.6% (5.3%, 7.8%) | 4.1% (2.9%, 5.0%) | 1.301 | -0.248 | 73.1% | 10% / 17% |
| tmax | 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1222 | 0.877 | 62.9% | 13.0% (9.2%, 16.6%) | 10.6% (6.7%, 14.3%) | 1.204 | 0.127 | 75.9% | 13% / 12% |
| tmax | 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1222 | 0.872 | 63.2% | 13.5% (9.9%, 17.0%) | 11.1% (7.4%, 14.7%) | 1.195 | 0.218 | 78.2% | 13% / 9% |
| tmax | 1 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1222 | 0.858 | 63.7% | 14.8% (11.1%, 18.4%) | 12.5% (8.6%, 16.0%) | 1.176 | 0.194 | 79.4% | 12% / 8% |
| tmax | 3 | Climatology (station record; ERA5 where too short) | 1333 | 2.396 | 0.0% | -99.9% (-113.7%, -86.7%) | -107.3% (-121.3%, -93.8%) | 3.403 | -0.399 | 79.1% | 8% / 13% |
| tmax | 3 | Raw multi-model ensemble | 1333 | 1.199 | 50.0% | 0.0% (0.0%, 0.0%) | -3.7% (-4.4%, -3.0%) | 1.576 | -0.303 | 74.6% | 8% / 18% |
| tmax | 3 | Raw-ensemble Gaussian (no training) | 1333 | 1.155 | 51.8% | 3.6% (2.9%, 4.2%) | 0.0%  | 1.576 | -0.303 | 65.6% | 10% / 24% |
| tmax | 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1333 | 1.126 | 53.0% | 6.0% (5.1%, 6.9%) | 2.5% (1.6%, 3.4%) | 1.543 | -0.288 | 73.4% | 8% / 18% |
| tmax | 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1333 | 1.06 | 55.8% | 11.6% (7.9%, 14.9%) | 8.3% (4.5%, 11.9%) | 1.445 | 0.178 | 77.0% | 14% / 9% |
| tmax | 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1333 | 1.035 | 56.8% | 13.6% (10.5%, 16.7%) | 10.4% (7.1%, 13.7%) | 1.41 | 0.274 | 79.5% | 13% / 7% |
| tmax | 3 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1333 | 1.033 | 56.9% | 13.8% (10.3%, 17.0%) | 10.6% (7.0%, 14.0%) | 1.411 | 0.23 | 80.2% | 13% / 7% |
| tmax | 5 | Climatology (station record; ERA5 where too short) | 1340 | 2.375 | 0.0% | -68.7% (-81.3%, -57.7%) | -75.3% (-88.2%, -63.8%) | 3.373 | -0.413 | 78.3% | 9% / 13% |
| tmax | 5 | Raw multi-model ensemble | 1340 | 1.407 | 40.7% | 0.0% (0.0%, 0.0%) | -3.9% (-4.5%, -3.3%) | 1.854 | -0.272 | 75.8% | 7% / 17% |
| tmax | 5 | Raw-ensemble Gaussian (no training) | 1340 | 1.355 | 42.9% | 3.7% (3.2%, 4.3%) | 0.0%  | 1.854 | -0.272 | 65.6% | 11% / 24% |
| tmax | 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1340 | 1.325 | 44.2% | 5.8% (5.2%, 6.7%) | 2.2% (1.5%, 3.1%) | 1.823 | -0.283 | 71.3% | 10% / 19% |
| tmax | 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1340 | 1.292 | 45.6% | 8.2% (4.0%, 11.6%) | 4.6% (0.1%, 8.3%) | 1.785 | 0.187 | 77.2% | 13% / 10% |
| tmax | 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1340 | 1.245 | 47.6% | 11.6% (8.4%, 14.4%) | 8.2% (4.6%, 11.3%) | 1.711 | 0.32 | 80.0% | 12% / 8% |
| tmax | 5 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1340 | 1.247 | 47.5% | 11.4% (7.9%, 14.4%) | 8.0% (4.2%, 11.1%) | 1.72 | 0.251 | 81.6% | 11% / 7% |
| tmax | 7 | Climatology (station record; ERA5 where too short) | 1389 | 2.414 | 0.0% | -31.3% (-42.5%, -23.9%) | -37.3% (-48.7%, -29.3%) | 3.427 | -0.508 | 78.8% | 8% / 13% |
| tmax | 7 | Raw multi-model ensemble | 1389 | 1.838 | 23.9% | 0.0% (0.0%, 0.0%) | -4.5% (-5.1%, -3.8%) | 2.402 | -0.332 | 76.5% | 9% / 15% |
| tmax | 7 | Raw-ensemble Gaussian (no training) | 1389 | 1.758 | 27.1% | 4.3% (3.7%, 4.9%) | 0.0%  | 2.402 | -0.332 | 62.8% | 13% / 24% |
| tmax | 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1389 | 1.724 | 28.6% | 6.2% (5.1%, 6.8%) | 1.9% (0.8%, 2.7%) | 2.377 | -0.372 | 72.0% | 10% / 18% |
| tmax | 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1389 | 1.699 | 29.6% | 7.6% (2.4%, 12.1%) | 3.4% (-1.9%, 8.2%) | 2.322 | 0.341 | 76.2% | 15% / 9% |
| tmax | 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1389 | 1.663 | 31.1% | 9.5% (5.7%, 13.7%) | 5.4% (1.5%, 9.8%) | 2.281 | 0.49 | 78.3% | 14% / 8% |
| tmax | 7 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1389 | 1.648 | 31.7% | 10.3% (5.9%, 14.5%) | 6.3% (1.7%, 10.7%) | 2.247 | 0.407 | 80.6% | 13% / 6% |
| precip | 1 | Climatology (station record; ERA5 where too short) | 1165 | 2.607 | 0.0% | -27.5% (-38.3%, -14.8%) | -22.2% (-34.1%, -8.7%) | 4.393 | -0.146 | 79.1% | 11% / 10% |
| precip | 1 | Raw multi-model ensemble | 1165 | 2.045 | 21.5% | 0.0% (0.0%, 0.0%) | 4.1% (1.9%, 6.9%) | 2.872 | 0.088 | 73.1% | 16% / 11% |
| precip | 1 | Raw-ensemble Gaussian (no training) | 1165 | 2.133 | 18.2% | -4.3% (-7.4%, -1.9%) | 0.0%  | 3.025 | 0.309 | 63.9% | 25% / 11% |
| precip | 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1165 | 2.181 | 16.4% | -6.6% (-11.5%, -3.0%) | -2.2% (-5.0%, 0.2%) | 3.309 | 0.713 | 69.8% | 22% / 8% |
| precip | 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1165 | 2.629 | -0.9% | -28.6% (-74.8%, -0.5%) | -23.3% (-66.8%, 3.1%) | 3.483 | 0.362 | 76.3% | 12% / 12% |
| precip | 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1165 | 2.04 | 21.7% | 0.2% (-1.2%, 1.5%) | 4.3% (1.5%, 7.5%) | 2.805 | 0.045 | 73.9% | 15% / 11% |
| precip | 1 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1165 | 2.04 | 21.7% | 0.2% (-1.2%, 1.5%) | 4.3% (1.5%, 7.5%) | 2.805 | 0.045 | 73.7% | 15% / 11% |
| precip | 3 | Climatology (station record; ERA5 where too short) | 1174 | 2.692 | 0.0% | -21.2% (-32.7%, -10.1%) | -20.0% (-32.4%, -8.2%) | 4.469 | -0.249 | 79.2% | 10% / 11% |
| precip | 3 | Raw multi-model ensemble | 1174 | 2.221 | 17.5% | 0.0% (0.0%, 0.0%) | 1.0% (-0.3%, 2.7%) | 2.923 | -0.243 | 73.7% | 16% / 11% |
| precip | 3 | Raw-ensemble Gaussian (no training) | 1174 | 2.244 | 16.6% | -1.0% (-2.8%, 0.3%) | 0.0%  | 3.029 | -0.05 | 64.7% | 25% / 11% |
| precip | 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1174 | 2.265 | 15.9% | -2.0% (-6.0%, 0.9%) | -0.9% (-4.0%, 1.3%) | 3.35 | 0.442 | 70.7% | 21% / 8% |
| precip | 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1174 | 2.328 | 13.5% | -4.8% (-10.8%, 4.7%) | -3.8% (-9.3%, 5.8%) | 3.249 | -0.225 | 75.2% | 11% / 14% |
| precip | 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1174 | 2.219 | 17.6% | 0.1% (-0.5%, 0.6%) | 1.1% (-0.3%, 2.8%) | 2.914 | -0.24 | 74.3% | 16% / 9% |
| precip | 3 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1174 | 2.219 | 17.6% | 0.1% (-0.5%, 0.6%) | 1.1% (-0.3%, 2.8%) | 2.914 | -0.24 | 73.0% | 16% / 11% |
| precip | 5 | Climatology (station record; ERA5 where too short) | 1192 | 2.73 | 0.0% | -14.5% (-26.5%, -4.6%) | -10.5% (-22.4%, -0.6%) | 4.499 | -0.294 | 80.5% | 9% / 11% |
| precip | 5 | Raw multi-model ensemble | 1192 | 2.385 | 12.6% | 0.0% (0.0%, 0.0%) | 3.5% (2.4%, 4.8%) | 3.322 | -0.296 | 75.7% | 15% / 10% |
| precip | 5 | Raw-ensemble Gaussian (no training) | 1192 | 2.472 | 9.5% | -3.6% (-5.0%, -2.4%) | 0.0%  | 3.489 | -0.007 | 63.9% | 24% / 12% |
| precip | 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1192 | 2.492 | 8.7% | -4.5% (-7.8%, -2.4%) | -0.8% (-3.4%, 0.7%) | 3.813 | 0.563 | 71.0% | 20% / 9% |
| precip | 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1192 | 2.729 | 0.0% | -14.4% (-40.8%, -1.5%) | -10.4% (-35.7%, 2.2%) | 3.864 | 0.164 | 77.6% | 11% / 12% |
| precip | 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1192 | 2.374 | 13.1% | 0.5% (-0.4%, 1.3%) | 4.0% (2.5%, 5.5%) | 3.287 | -0.302 | 75.9% | 14% / 10% |
| precip | 5 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1192 | 2.374 | 13.1% | 0.5% (-0.4%, 1.3%) | 4.0% (2.5%, 5.5%) | 3.287 | -0.302 | 73.8% | 15% / 11% |
| precip | 7 | Climatology (station record; ERA5 where too short) | 1204 | 2.709 | 0.0% | 2.4% (-3.6%, 8.6%) | 5.7% (-1.1%, 12.5%) | 4.473 | -0.274 | 80.5% | 9% / 11% |
| precip | 7 | Raw multi-model ensemble | 1204 | 2.776 | -2.5% | 0.0% (0.0%, 0.0%) | 3.4% (1.8%, 5.2%) | 3.777 | -0.28 | 76.2% | 15% / 9% |
| precip | 7 | Raw-ensemble Gaussian (no training) | 1204 | 2.873 | -6.1% | -3.5% (-5.5%, -1.8%) | 0.0%  | 3.995 | 0.088 | 58.6% | 29% / 12% |
| precip | 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1204 | 2.891 | -6.7% | -4.1% (-7.1%, -1.2%) | -0.6% (-2.4%, 1.5%) | 4.365 | 0.665 | 69.3% | 22% / 9% |
| precip | 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 1204 | 2.844 | -5.0% | -2.4% (-8.4%, 5.5%) | 1.0% (-4.5%, 9.1%) | 4.227 | 0.039 | 76.7% | 11% / 12% |
| precip | 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 1204 | 2.748 | -1.5% | 1.0% (0.3%, 2.0%) | 4.3% (2.5%, 6.5%) | 3.72 | -0.37 | 74.9% | 16% / 9% |
| precip | 7 | Astraeus v3 (logistic skill-weighted NGR, recency-weighted, CV-recalibrated scale, for temperature; skill-weighted ensemble for rain; 90-day window) | 1204 | 2.748 | -1.5% | 1.0% (0.3%, 2.0%) | 4.3% (2.5%, 6.5%) | 3.72 | -0.37 | 77.4% | 14% / 8% |

## Caveats

- Coverage is uneven: Tmax at 7 of 16 sites and precipitation at 6, all but one in the United States, Australia and the Netherlands. The tropical and Southern-Hemisphere crop sites (Mato Grosso, Paraná, Minas Gerais, Daloa, Mekong) and Punjab, Beauce, Odesa and Jilin have no usable station, so station results describe mid-latitude, data-rich sites only.
- GHCN-Daily records for the non-U.S. synoptic stations near these sites stop in August 2025; Meteostat fills its 2025–2026 daily files at the same stations with model forecasts (DWD MOSMIX, MET Norway), which are excluded here — verifying forecasts against model-filled “observations” would be circular.
- Representativeness: a station is a point 4–12 km from the grid point the forecasts were fetched for; station-minus-grid differences (elevation, coast, urban heat) are part of the station error and are not forecastable by the raw models. Forecasts were not refetched at station coordinates (Open-Meteo budget).
- Day conventions: forecasts and ERA5 are UTC days; station days are local (US ASOS midnight LST, Dubbo 9 am local for rainfall). The integer shift fixed on development data aligns the bulk of each day but cannot remove the 4–6-hour local-vs-UTC offset, which blurs precipitation more than Tmax.
- Tmean is not verified on stations: (Tmax+Tmin)/2 differs systematically from the 24-hour mean the forecasts are aggregated to, and the forecast cache holds no daily minimum to build a like-for-like (max+min)/2.
- Mode (b) trains on the same station it is verified on, with the same 6-day lag and windows as the ERA5-trained system; it is the realistic upper bound for site-specific calibration, not a deployable product for sites without a live station feed.
- Climatology reference: the station’s own 2019–2024 record where ≥ 60% complete; Córdoba Tmax (Meteostat METAR-derived, 47% complete) uses the ERA5 grid-point climatology instead.

## Reproduce

```
npx tsx research/select-stations.ts                      # research/data/stations.json (station choice, coverage, alignment)
npx tsx research/weather-benchmark.ts --suite final --period dev --offline                                  # ERA5, all 16 sites (dev reference)
npx tsx research/weather-benchmark.ts --suite final --period <dev|confirm> --offline --mask stations       # ERA5 on station site-days
npx tsx research/weather-benchmark.ts --suite final --period <dev|confirm> --offline --truth stations --train era5      # as deployed
npx tsx research/weather-benchmark.ts --suite final --period <dev|confirm> --offline --truth stations --train stations  # station-trained
npx tsx research/verification-report.ts
```

Archived results: `public/research/archive/weather-stations-dev.json`, `public/research/archive/weather-stations-confirm.json`. Station metadata: `research/data/stations.json`.
