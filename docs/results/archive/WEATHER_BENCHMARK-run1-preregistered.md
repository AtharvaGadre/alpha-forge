# Astraeus weather benchmark

Generated 2026-11-15T23:48:39.778Z · astraeus-weather-benchmark-v1

Sites: 16 commodity regions · models: 7 · leads: 1, 3, 5, 7 days · training window 40 days (refit every 7 days, ERA5 lag 6 days).

## Daily mean 2 m temperature (°C)

| Lead | Method | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 1.716 | 0.0% | -305.5% (-333.2%, -287.0%) | 2.41 | -0.132 | 76.1% | 0.0% |
| 1 | Raw 7-model ensemble | 0.423 | 75.3% | 0.0% (0.0%, 0.0%) | 0.56 | 0.085 | 78.4% | 70.2% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 0.371 | 78.4% | 12.3% (11.5%, 12.7%) | 0.505 | 0.059 | 87.2% | 73.7% |
| 1 | Bias-corrected ensemble | 0.375 | 78.1% | 11.3% (8.6%, 12.8%) | 0.502 | -0.001 | 74.2% | 73.0% |
| 1 | EMOS (Gneiting et al. 2005; censored for rain) | 0.377 | 78.1% | 11.0% (7.8%, 13.1%) | 0.52 | 0.025 | 71.4% | 73.1% |
| 1 | EMOS with learned model weights | 0.366 | 78.7% | 13.5% (10.3%, 15.6%) | 0.504 | 0.024 | 71.0% | 73.7% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 1.719 | 0.0% | -212.5% (-226.3%, -196.9%) | 2.418 | -0.115 | 75.9% | 0.0% |
| 3 | Raw 7-model ensemble | 0.55 | 68.0% | 0.0% (0.0%, 0.0%) | 0.727 | 0.16 | 74.8% | 61.8% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 0.491 | 71.5% | 10.8% (10.2%, 11.4%) | 0.67 | 0.123 | 83.8% | 65.6% |
| 3 | Bias-corrected ensemble | 0.512 | 70.2% | 6.9% (4.7%, 9.0%) | 0.688 | -0.001 | 69.1% | 65.2% |
| 3 | EMOS (Gneiting et al. 2005; censored for rain) | 0.524 | 69.5% | 4.8% (1.4%, 8.0%) | 0.721 | 0.06 | 71.7% | 64.7% |
| 3 | EMOS with learned model weights | 0.514 | 70.1% | 6.6% (3.1%, 9.7%) | 0.707 | 0.057 | 71.0% | 65.2% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 1.726 | 0.0% | -139.9% (-150.4%, -127.8%) | 2.429 | -0.159 | 75.8% | 0.0% |
| 5 | Raw 7-model ensemble | 0.719 | 58.3% | 0.0% (0.0%, 0.0%) | 0.953 | 0.164 | 71.0% | 52.6% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 0.662 | 61.6% | 7.9% (7.2%, 8.6%) | 0.908 | 0.144 | 80.2% | 56.1% |
| 5 | Bias-corrected ensemble | 0.703 | 59.3% | 2.3% (0.3%, 4.1%) | 0.942 | -0.01 | 65.9% | 55.1% |
| 5 | EMOS (Gneiting et al. 2005; censored for rain) | 0.715 | 58.6% | 0.7% (-1.9%, 3.5%) | 0.981 | 0.068 | 72.1% | 56.3% |
| 5 | EMOS with learned model weights | 0.707 | 59.0% | 1.7% (-0.8%, 4.5%) | 0.97 | 0.064 | 71.6% | 56.8% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | null | — | — (—, —) | null | null | — | — |
| 7 | Raw 7-model ensemble | null | — | — (—, —) | null | null | — | — |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | null | — | — (—, —) | null | null | — | — |
| 7 | Bias-corrected ensemble | null | — | — (—, —) | null | null | — | — |
| 7 | EMOS (Gneiting et al. 2005; censored for rain) | null | — | — (—, —) | null | null | — | — |
| 7 | EMOS with learned model weights | null | — | — (—, —) | null | null | — | — |

## Daily maximum 2 m temperature (°C)

| Lead | Method | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 2.101 | 0.0% | -210.2% (-233.7%, -199.4%) | 2.949 | -0.028 | 77.2% | 0.0% |
| 1 | Raw 7-model ensemble | 0.677 | 67.8% | 0.0% (0.0%, 0.0%) | 0.906 | -0.182 | 72.2% | 61.7% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 0.619 | 70.5% | 8.6% (8.0%, 9.2%) | 0.857 | -0.178 | 82.2% | 65.0% |
| 1 | Bias-corrected ensemble | 0.613 | 70.8% | 9.5% (6.7%, 10.9%) | 0.823 | -0.02 | 69.0% | 66.7% |
| 1 | EMOS (Gneiting et al. 2005; censored for rain) | 0.601 | 71.4% | 11.2% (7.2%, 12.7%) | 0.83 | 0.045 | 73.4% | 67.7% |
| 1 | EMOS with learned model weights | 0.591 | 71.9% | 12.8% (8.6%, 14.2%) | 0.815 | 0.042 | 72.5% | 68.0% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 2.099 | 0.0% | -146.2% (-155.9%, -135.9%) | 2.949 | -0.013 | 77.2% | 0.0% |
| 3 | Raw 7-model ensemble | 0.853 | 59.4% | 0.0% (0.0%, 0.0%) | 1.138 | -0.156 | 69.0% | 51.8% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 0.787 | 62.5% | 7.7% (7.1%, 8.2%) | 1.089 | -0.181 | 79.1% | 56.2% |
| 3 | Bias-corrected ensemble | 0.802 | 61.8% | 5.9% (4.1%, 7.7%) | 1.077 | -0.024 | 65.7% | 57.1% |
| 3 | EMOS (Gneiting et al. 2005; censored for rain) | 0.799 | 61.9% | 6.3% (3.5%, 8.9%) | 1.103 | 0.081 | 73.4% | 58.7% |
| 3 | EMOS with learned model weights | 0.79 | 62.4% | 7.4% (4.5%, 10.1%) | 1.089 | 0.076 | 72.7% | 59.1% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 2.112 | 0.0% | -99.9% (-107.5%, -91.7%) | 2.967 | -0.07 | 77.0% | 0.0% |
| 5 | Raw 7-model ensemble | 1.056 | 50.0% | 0.0% (0.0%, 0.0%) | 1.419 | -0.145 | 65.5% | 45.0% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 0.994 | 52.9% | 5.9% (5.2%, 6.6%) | 1.374 | -0.174 | 76.2% | 47.9% |
| 5 | Bias-corrected ensemble | 1.03 | 51.2% | 2.5% (1.0%, 3.9%) | 1.387 | -0.05 | 63.6% | 47.5% |
| 5 | EMOS (Gneiting et al. 2005; censored for rain) | 1.036 | 50.9% | 1.9% (-1.0%, 4.8%) | 1.43 | 0.097 | 71.8% | 48.4% |
| 5 | EMOS with learned model weights | 1.03 | 51.2% | 2.5% (-0.4%, 5.4%) | 1.42 | 0.092 | 70.9% | 48.6% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | null | — | — (—, —) | null | null | — | — |
| 7 | Raw 7-model ensemble | null | — | — (—, —) | null | null | — | — |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | null | — | — (—, —) | null | null | — | — |
| 7 | Bias-corrected ensemble | null | — | — (—, —) | null | null | — | — |
| 7 | EMOS (Gneiting et al. 2005; censored for rain) | null | — | — (—, —) | null | null | — | — |
| 7 | EMOS with learned model weights | null | — | — (—, —) | null | null | — | — |

## Daily precipitation (mm)

| Lead | Method | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 2.079 | 0.0% | -93.1% (-104.2%, -83.5%) | 3.312 | -0.019 | 87.1% | 0.0% |
| 1 | Raw 7-model ensemble | 1.076 | 48.2% | 0.0% (0.0%, 0.0%) | 1.534 | 0.184 | 83.1% | 62.4% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1.088 | 47.7% | -1.1% (-2.1%, 0.2%) | 1.605 | 0.346 | 90.5% | 61.8% |
| 1 | Bias-corrected ensemble | 1.13 | 45.6% | -5.0% (-8.2%, -2.1%) | 1.618 | 0.208 | 82.6% | 62.3% |
| 1 | EMOS (Gneiting et al. 2005; censored for rain) | 1.22 | 41.3% | -13.4% (-19.9%, -7.0%) | 1.611 | -0.076 | 84.7% | 58.0% |
| 1 | EMOS with learned model weights | 1.228 | 40.9% | -14.1% (-20.7%, -7.8%) | 1.616 | -0.061 | 84.3% | 58.0% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 2.101 | 0.0% | -59.5% (-66.4%, -52.2%) | 3.335 | -0.045 | 87.0% | 0.0% |
| 3 | Raw 7-model ensemble | 1.317 | 37.3% | 0.0% (0.0%, 0.0%) | 1.864 | 0.185 | 80.7% | 53.2% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1.333 | 36.6% | -1.2% (-2.5%, -0.1%) | 1.962 | 0.394 | 89.1% | 51.1% |
| 3 | Bias-corrected ensemble | 1.361 | 35.2% | -3.3% (-5.8%, -0.7%) | 1.939 | 0.208 | 80.7% | 53.0% |
| 3 | EMOS (Gneiting et al. 2005; censored for rain) | 1.564 | 25.6% | -18.7% (-30.8%, -9.4%) | 2.061 | 0.017 | 84.9% | 47.9% |
| 3 | EMOS with learned model weights | 1.911 | 9.1% | -45.1% (-78.3%, -20.9%) | 2.402 | 0.377 | 84.4% | 48.0% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 2.11 | 0.0% | -37.7% (-42.9%, -32.5%) | 3.346 | -0.053 | 87.1% | 0.0% |
| 5 | Raw 7-model ensemble | 1.531 | 27.4% | 0.0% (0.0%, 0.0%) | 2.183 | 0.057 | 79.9% | 40.8% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 1.567 | 25.7% | -2.3% (-3.7%, -1.0%) | 2.325 | 0.362 | 88.2% | 36.8% |
| 5 | Bias-corrected ensemble | 1.61 | 23.7% | -5.1% (-7.3%, -3.2%) | 2.396 | 0.349 | 79.3% | 39.4% |
| 5 | EMOS (Gneiting et al. 2005; censored for rain) | 2.065 | 2.1% | -34.8% (-59.3%, -17.9%) | 2.698 | 0.329 | 84.1% | 31.3% |
| 5 | EMOS with learned model weights | 2.427 | -15.1% | -58.5% (-110.1%, -24.1%) | 3.038 | 0.673 | 83.2% | 30.9% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | null | — | — (—, —) | null | null | — | — |
| 7 | Raw 7-model ensemble | null | — | — (—, —) | null | null | — | — |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | null | — | — (—, —) | null | null | — | — |
| 7 | Bias-corrected ensemble | null | — | — (—, —) | null | null | — | — |
| 7 | EMOS (Gneiting et al. 2005; censored for rain) | null | — | — (—, —) | null | null | — | — |
| 7 | EMOS with learned model weights | null | — | — (—, —) | null | null | — | — |

## Caveats

- ERA5 is a reanalysis at ~31 km resolution, not station truth; point forecasts are verified against the ERA5 grid cell, which favours smooth models and understates local extremes.
- Single grid points stand in for each region; production-weighted areal averages would score differently (areal averages are usually more predictable).
- Previous-Runs data are the stitched output of successive runs N days earlier, so a "day-3" forecast mixes run times within the target day.
- One year of evaluation covers one realisation of each season; skill differences between seasons and years are not resolved.
- Diebold–Mariano tests use the cross-site daily mean loss; sites are not independent, so the effective sample is the number of days.
