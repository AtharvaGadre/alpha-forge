# Astraeus weather benchmark

Generated 2026-11-15T23:53:48.467Z · astraeus-weather-benchmark-v1 · suite dev · development period (test days ≤ 2026-03-31)

Sites: 16 commodity regions · models: 7 · leads: 1, 3, 5, 7 days · training window 40 days (refit every 7 days, ERA5 lag 6 days).

## Daily mean 2 m temperature (°C)

| Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 2816 | 1.938 | 0.0% | -347.6% (-374.2%, -321.1%) | 2.728 | -0.062 | 75.5% | 0.0% |
| 1 | Raw multi-model ensemble | 2816 | 0.433 | 77.7% | 0.0% (0.0%, 0.0%) | 0.574 | 0.025 | 79.6% | 71.7% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2816 | 0.381 | 80.4% | 12.1% (11.3%, 13.0%) | 0.516 | 0.007 | 88.8% | 74.7% |
| 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2816 | 0.38 | 80.4% | 12.2% (8.9%, 15.5%) | 0.527 | -0.013 | 73.7% | 73.2% |
| 1 | Skill-weighted NGR, 40-day window | 2816 | 0.345 | 82.2% | 20.4% (17.7%, 23.4%) | 0.477 | -0.009 | 73.3% | 75.1% |
| 1 | Skill-weighted NGR, 60-day window | 2816 | 0.341 | 82.4% | 21.2% (18.9%, 23.9%) | 0.472 | -0.019 | 74.6% | 76.1% |
| 1 | Skill-weighted NGR, 90-day window | 2816 | 0.339 | 82.5% | 21.8% (20.0%, 24.0%) | 0.47 | -0.033 | 76.3% | 76.9% |
| 1 | Skill-weighted NGR + climatology predictor, 60-day window | 2816 | 0.358 | 81.5% | 17.3% (13.5%, 20.7%) | 0.498 | -0.024 | 72.2% | 75.1% |
| 1 | Skill-weighted NGR + climatology predictor, 90-day window | 2816 | 0.345 | 82.2% | 20.5% (17.8%, 23.2%) | 0.48 | -0.034 | 73.7% | 76.3% |
| 1 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2816 | 0.354 | 81.7% | 18.2% (15.5%, 21.1%) | 0.472 | -0.024 | 75.6% | 76.1% |
| 1 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2816 | 0.36 | 81.4% | 16.9% (14.5%, 19.4%) | 0.479 | -0.043 | 77.8% | 75.3% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 2784 | 1.94 | 0.0% | -244.8% (-267.5%, -225.4%) | 2.731 | -0.067 | 75.6% | 0.0% |
| 3 | Raw multi-model ensemble | 2784 | 0.563 | 71.0% | 0.0% (0.0%, 0.0%) | 0.728 | 0.124 | 75.5% | 63.0% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2784 | 0.497 | 74.4% | 11.7% (10.9%, 12.8%) | 0.672 | 0.099 | 84.4% | 67.0% |
| 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2784 | 0.527 | 72.8% | 6.3% (3.0%, 9.8%) | 0.726 | 0.028 | 71.9% | 65.5% |
| 3 | Skill-weighted NGR, 40-day window | 2784 | 0.488 | 74.8% | 13.2% (10.7%, 16.2%) | 0.673 | 0.01 | 71.7% | 67.3% |
| 3 | Skill-weighted NGR, 60-day window | 2784 | 0.475 | 75.5% | 15.6% (13.3%, 18.1%) | 0.659 | -0.007 | 73.6% | 68.7% |
| 3 | Skill-weighted NGR, 90-day window | 2784 | 0.474 | 75.5% | 15.7% (13.9%, 17.9%) | 0.659 | -0.027 | 74.1% | 69.0% |
| 3 | Skill-weighted NGR + climatology predictor, 60-day window | 2784 | 0.499 | 74.3% | 11.3% (8.4%, 14.2%) | 0.692 | -0.024 | 70.4% | 67.0% |
| 3 | Skill-weighted NGR + climatology predictor, 90-day window | 2784 | 0.482 | 75.1% | 14.3% (12.2%, 16.8%) | 0.669 | -0.055 | 73.2% | 67.7% |
| 3 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2784 | 0.491 | 74.7% | 12.7% (10.6%, 14.9%) | 0.651 | -0.032 | 74.0% | 67.8% |
| 3 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2784 | 0.498 | 74.3% | 11.5% (9.6%, 13.5%) | 0.659 | -0.048 | 75.4% | 67.5% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 2752 | 1.945 | 0.0% | -156.6% (-173.1%, -143.0%) | 2.737 | -0.07 | 75.6% | 0.0% |
| 5 | Raw multi-model ensemble | 2752 | 0.758 | 61.0% | 0.0% (0.0%, 0.0%) | 0.983 | 0.114 | 71.7% | 53.7% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2752 | 0.692 | 64.4% | 8.7% (7.7%, 9.5%) | 0.94 | 0.116 | 80.8% | 57.8% |
| 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2752 | 0.759 | 61.0% | -0.1% (-4.2%, 3.9%) | 1.043 | 0.061 | 72.3% | 56.8% |
| 5 | Skill-weighted NGR, 40-day window | 2752 | 0.724 | 62.8% | 4.5% (0.8%, 8.3%) | 0.992 | 0.049 | 72.6% | 58.4% |
| 5 | Skill-weighted NGR, 60-day window | 2752 | 0.701 | 64.0% | 7.5% (4.6%, 10.4%) | 0.965 | 0.014 | 73.5% | 59.2% |
| 5 | Skill-weighted NGR, 90-day window | 2752 | 0.692 | 64.4% | 8.7% (6.7%, 10.9%) | 0.956 | -0.013 | 73.7% | 59.1% |
| 5 | Skill-weighted NGR + climatology predictor, 60-day window | 2752 | 0.753 | 61.3% | 0.6% (-5.0%, 5.7%) | 1.03 | 0.038 | 70.5% | 56.2% |
| 5 | Skill-weighted NGR + climatology predictor, 90-day window | 2752 | 0.709 | 63.5% | 6.4% (2.8%, 9.9%) | 0.975 | -0.018 | 72.2% | 57.0% |
| 5 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2752 | 0.713 | 63.4% | 6.0% (3.6%, 8.2%) | 0.936 | -0.034 | 72.3% | 57.6% |
| 5 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2752 | 0.712 | 63.4% | 6.0% (4.3%, 7.8%) | 0.942 | -0.067 | 74.0% | 55.0% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | 2720 | 1.952 | 0.0% | -74.2% (-84.9%, -65.1%) | 2.746 | -0.067 | 75.5% | 0.0% |
| 7 | Raw multi-model ensemble | 2720 | 1.12 | 42.6% | 0.0% (0.0%, 0.0%) | 1.452 | 0.105 | 61.4% | 40.0% |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2720 | 1.039 | 46.8% | 7.2% (6.4%, 7.9%) | 1.413 | 0.125 | 75.8% | 43.9% |
| 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2720 | 1.154 | 40.9% | -3.0% (-7.2%, 1.3%) | 1.584 | 0.172 | 70.7% | 39.5% |
| 7 | Skill-weighted NGR, 40-day window | 2720 | 1.118 | 42.7% | 0.1% (-4.6%, 4.4%) | 1.528 | 0.141 | 70.1% | 41.3% |
| 7 | Skill-weighted NGR, 60-day window | 2720 | 1.071 | 45.1% | 4.3% (0.4%, 8.3%) | 1.477 | 0.069 | 73.1% | 42.8% |
| 7 | Skill-weighted NGR, 90-day window | 2720 | 1.055 | 45.9% | 5.8% (2.9%, 8.7%) | 1.455 | 0.03 | 72.2% | 42.4% |
| 7 | Skill-weighted NGR + climatology predictor, 60-day window | 2720 | 1.164 | 40.3% | -3.9% (-10.8%, 2.4%) | 1.582 | 0.177 | 67.5% | 35.5% |
| 7 | Skill-weighted NGR + climatology predictor, 90-day window | 2720 | 1.092 | 44.1% | 2.5% (-1.3%, 5.9%) | 1.498 | 0.044 | 69.9% | 38.1% |
| 7 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2720 | 1.095 | 43.9% | 2.2% (-1.1%, 5.3%) | 1.418 | -0.054 | 67.8% | 40.6% |
| 7 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2720 | 1.08 | 44.7% | 3.6% (1.1%, 5.8%) | 1.402 | -0.082 | 67.6% | 40.7% |

## Daily maximum 2 m temperature (°C)

| Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 2816 | 2.314 | 0.0% | -229.5% (-245.4%, -211.8%) | 3.262 | -0.131 | 75.0% | 0.0% |
| 1 | Raw multi-model ensemble | 2816 | 0.702 | 69.6% | 0.0% (0.0%, 0.0%) | 0.957 | -0.259 | 70.3% | 65.7% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2816 | 0.646 | 72.1% | 8.0% (7.2%, 9.0%) | 0.9 | -0.234 | 82.0% | 68.0% |
| 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2816 | 0.621 | 73.2% | 11.6% (7.3%, 15.5%) | 0.864 | 0.02 | 74.9% | 69.7% |
| 1 | Skill-weighted NGR, 40-day window | 2816 | 0.59 | 74.5% | 16.0% (12.0%, 20.3%) | 0.819 | 0.025 | 73.5% | 70.3% |
| 1 | Skill-weighted NGR, 60-day window | 2816 | 0.59 | 74.5% | 16.1% (12.5%, 20.1%) | 0.821 | 0.043 | 75.4% | 70.7% |
| 1 | Skill-weighted NGR, 90-day window | 2816 | 0.594 | 74.3% | 15.4% (12.2%, 19.2%) | 0.829 | 0.051 | 76.0% | 71.0% |
| 1 | Skill-weighted NGR + climatology predictor, 60-day window | 2816 | 0.616 | 73.4% | 12.3% (8.1%, 17.4%) | 0.855 | 0.048 | 71.6% | 69.3% |
| 1 | Skill-weighted NGR + climatology predictor, 90-day window | 2816 | 0.605 | 73.8% | 13.8% (10.5%, 17.9%) | 0.844 | 0.064 | 74.1% | 70.4% |
| 1 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2816 | 0.606 | 73.8% | 13.7% (10.8%, 17.7%) | 0.813 | -0.017 | 74.3% | 70.6% |
| 1 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2816 | 0.616 | 73.4% | 12.3% (9.4%, 16.0%) | 0.824 | -0.045 | 75.5% | 69.9% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 2784 | 2.312 | 0.0% | -162.7% (-176.1%, -149.9%) | 3.261 | -0.142 | 75.0% | 0.0% |
| 3 | Raw multi-model ensemble | 2784 | 0.88 | 61.9% | 0.0% (0.0%, 0.0%) | 1.173 | -0.175 | 67.9% | 52.8% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2784 | 0.814 | 64.8% | 7.5% (6.5%, 8.4%) | 1.125 | -0.181 | 77.8% | 57.7% |
| 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2784 | 0.836 | 63.8% | 4.9% (0.9%, 9.3%) | 1.156 | 0.045 | 73.5% | 60.1% |
| 3 | Skill-weighted NGR, 40-day window | 2784 | 0.801 | 65.4% | 9.0% (5.1%, 13.4%) | 1.105 | 0.024 | 72.6% | 61.7% |
| 3 | Skill-weighted NGR, 60-day window | 2784 | 0.781 | 66.2% | 11.2% (8.3%, 14.6%) | 1.085 | 0.027 | 73.2% | 61.9% |
| 3 | Skill-weighted NGR, 90-day window | 2784 | 0.782 | 66.2% | 11.1% (8.6%, 14.4%) | 1.087 | 0.031 | 73.9% | 62.0% |
| 3 | Skill-weighted NGR + climatology predictor, 60-day window | 2784 | 0.814 | 64.8% | 7.4% (4.0%, 11.9%) | 1.131 | 0.044 | 70.5% | 61.0% |
| 3 | Skill-weighted NGR + climatology predictor, 90-day window | 2784 | 0.793 | 65.7% | 9.9% (7.5%, 13.2%) | 1.104 | 0.034 | 73.1% | 61.6% |
| 3 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2784 | 0.807 | 65.1% | 8.3% (6.1%, 11.3%) | 1.065 | -0.038 | 71.4% | 60.1% |
| 3 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2784 | 0.811 | 64.9% | 7.8% (5.6%, 10.8%) | 1.072 | -0.067 | 73.2% | 59.7% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 2752 | 2.315 | 0.0% | -110.2% (-120.7%, -100.3%) | 3.265 | -0.151 | 74.9% | 0.0% |
| 5 | Raw multi-model ensemble | 2752 | 1.101 | 52.4% | 0.0% (0.0%, 0.0%) | 1.468 | -0.182 | 64.5% | 46.0% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2752 | 1.034 | 55.3% | 6.1% (5.2%, 6.9%) | 1.424 | -0.182 | 75.8% | 48.7% |
| 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2752 | 1.098 | 52.6% | 0.3% (-4.1%, 4.6%) | 1.514 | 0.087 | 71.7% | 50.6% |
| 5 | Skill-weighted NGR, 40-day window | 2752 | 1.064 | 54.0% | 3.4% (-0.7%, 7.3%) | 1.465 | 0.074 | 71.5% | 51.5% |
| 5 | Skill-weighted NGR, 60-day window | 2752 | 1.021 | 55.9% | 7.3% (5.1%, 10.6%) | 1.418 | 0.053 | 73.7% | 52.0% |
| 5 | Skill-weighted NGR, 90-day window | 2752 | 1.021 | 55.9% | 7.3% (5.3%, 10.1%) | 1.415 | 0.046 | 74.0% | 52.0% |
| 5 | Skill-weighted NGR + climatology predictor, 60-day window | 2752 | 1.082 | 53.2% | 1.7% (-1.9%, 6.3%) | 1.5 | 0.074 | 70.4% | 49.8% |
| 5 | Skill-weighted NGR + climatology predictor, 90-day window | 2752 | 1.045 | 54.9% | 5.1% (1.9%, 9.0%) | 1.448 | 0.053 | 71.7% | 51.0% |
| 5 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2752 | 1.044 | 54.9% | 5.2% (3.3%, 7.6%) | 1.381 | -0.032 | 71.2% | 50.1% |
| 5 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2752 | 1.044 | 54.9% | 5.2% (3.4%, 7.8%) | 1.382 | -0.078 | 71.7% | 50.1% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | 2720 | 2.321 | 0.0% | -51.5% (-57.8%, -45.0%) | 3.272 | -0.15 | 74.8% | 0.0% |
| 7 | Raw multi-model ensemble | 2720 | 1.532 | 34.0% | 0.0% (0.0%, 0.0%) | 2.01 | -0.233 | 58.4% | 30.9% |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2720 | 1.427 | 38.5% | 6.9% (6.1%, 7.5%) | 1.971 | -0.229 | 74.5% | 35.5% |
| 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2720 | 1.515 | 34.7% | 1.1% (-3.0%, 5.7%) | 2.082 | 0.233 | 71.4% | 33.1% |
| 7 | Skill-weighted NGR, 40-day window | 2720 | 1.487 | 35.9% | 2.9% (-1.0%, 7.1%) | 2.04 | 0.216 | 70.6% | 33.9% |
| 7 | Skill-weighted NGR, 60-day window | 2720 | 1.424 | 38.6% | 7.0% (3.7%, 10.8%) | 1.966 | 0.153 | 73.7% | 35.8% |
| 7 | Skill-weighted NGR, 90-day window | 2720 | 1.422 | 38.7% | 7.2% (4.7%, 10.5%) | 1.964 | 0.119 | 73.8% | 36.3% |
| 7 | Skill-weighted NGR + climatology predictor, 60-day window | 2720 | 1.524 | 34.3% | 0.5% (-3.3%, 4.8%) | 2.092 | 0.206 | 68.4% | 30.5% |
| 7 | Skill-weighted NGR + climatology predictor, 90-day window | 2720 | 1.452 | 37.4% | 5.2% (1.9%, 9.5%) | 2.003 | 0.079 | 72.1% | 33.7% |
| 7 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2720 | 1.478 | 36.3% | 3.5% (1.4%, 5.7%) | 1.924 | -0.089 | 66.9% | 34.6% |
| 7 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2720 | 1.469 | 36.7% | 4.1% (2.3%, 5.9%) | 1.907 | -0.133 | 67.1% | 34.8% |

## Daily precipitation (mm)

| Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 2816 | 1.847 | 0.0% | -98.7% (-111.3%, -87.0%) | 3.096 | 0.193 | 89.0% | 0.0% |
| 1 | Raw multi-model ensemble | 2816 | 0.929 | 49.7% | 0.0% (0.0%, 0.0%) | 1.318 | 0.152 | 83.2% | 65.2% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2816 | 0.931 | 49.6% | -0.2% (-1.6%, 1.5%) | 1.367 | 0.27 | 90.7% | 64.4% |
| 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2816 | 1.04 | 43.7% | -11.9% (-24.5%, -3.1%) | 1.385 | -0.113 | 85.9% | 60.8% |
| 1 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2816 | 0.905 | 51.0% | 2.6% (0.9%, 4.3%) | 1.254 | 0.103 | 85.7% | 65.3% |
| 1 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2816 | 0.898 | 51.4% | 3.4% (2.0%, 4.9%) | 1.247 | 0.107 | 85.7% | 65.3% |
| 1 | √-censored Gaussian (ML), 40-day window | 2816 | 1.116 | 39.6% | -20.1% (-53.6%, -1.7%) | 1.531 | 0.239 | 85.4% | 65.2% |
| 1 | √-censored Gaussian (ML), 90-day window | 2816 | 1.046 | 43.4% | -12.5% (-27.6%, -2.5%) | 1.477 | 0.27 | 87.7% | 65.8% |
| 1 | Skill-weighted √-censored Gaussian (ML), 60-day window | 2816 | 0.93 | 49.6% | -0.1% (-2.9%, 3.2%) | 1.317 | 0.081 | 86.4% | 66.6% |
| 1 | Skill-weighted √-censored Gaussian (ML), 90-day window | 2816 | 0.944 | 48.9% | -1.6% (-5.0%, 1.8%) | 1.344 | 0.17 | 87.1% | 66.5% |
| 1 | Skill-weighted ∛-censored Gaussian (ML), 90-day window | 2816 | 1.004 | 45.6% | -8.0% (-18.6%, -0.7%) | 1.457 | 0.365 | 88.5% | 66.4% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 2784 | 1.834 | 0.0% | -60.0% (-68.9%, -52.5%) | 3.081 | 0.205 | 89.0% | 0.0% |
| 3 | Raw multi-model ensemble | 2784 | 1.146 | 37.5% | 0.0% (0.0%, 0.0%) | 1.622 | 0.227 | 79.0% | 52.3% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2784 | 1.153 | 37.1% | -0.6% (-2.7%, 0.8%) | 1.694 | 0.383 | 88.1% | 51.4% |
| 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2784 | 1.295 | 29.4% | -13.0% (-30.1%, -2.0%) | 1.714 | -0.087 | 85.7% | 48.4% |
| 3 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2784 | 1.128 | 38.5% | 1.6% (0.5%, 2.7%) | 1.577 | 0.182 | 83.6% | 51.9% |
| 3 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2784 | 1.118 | 39.0% | 2.5% (1.6%, 3.8%) | 1.56 | 0.185 | 84.0% | 51.6% |
| 3 | √-censored Gaussian (ML), 40-day window | 2784 | 1.234 | 32.7% | -7.7% (-20.2%, 2.5%) | 1.814 | 0.286 | 86.4% | 53.5% |
| 3 | √-censored Gaussian (ML), 90-day window | 2784 | 1.222 | 33.3% | -6.6% (-17.1%, 2.2%) | 1.84 | 0.394 | 88.3% | 54.2% |
| 3 | Skill-weighted √-censored Gaussian (ML), 60-day window | 2784 | 1.143 | 37.6% | 0.3% (-5.5%, 5.8%) | 1.67 | 0.224 | 87.8% | 55.2% |
| 3 | Skill-weighted √-censored Gaussian (ML), 90-day window | 2784 | 1.166 | 36.4% | -1.7% (-7.9%, 5.5%) | 1.738 | 0.337 | 88.3% | 55.2% |
| 3 | Skill-weighted ∛-censored Gaussian (ML), 90-day window | 2784 | 1.232 | 32.8% | -7.5% (-19.7%, 3.3%) | 1.852 | 0.519 | 87.1% | 55.5% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 2752 | 1.827 | 0.0% | -40.9% (-47.1%, -35.1%) | 3.073 | 0.211 | 89.0% | 0.0% |
| 5 | Raw multi-model ensemble | 2752 | 1.296 | 29.0% | 0.0% (0.0%, 0.0%) | 1.8 | 0.003 | 78.3% | 38.7% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2752 | 1.291 | 29.3% | 0.4% (-1.0%, 2.0%) | 1.888 | 0.208 | 87.6% | 36.4% |
| 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2752 | 1.457 | 20.3% | -12.4% (-19.4%, -6.7%) | 1.976 | -0.071 | 85.8% | 30.8% |
| 5 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2752 | 1.279 | 30.0% | 1.4% (0.2%, 2.2%) | 1.744 | -0.067 | 83.8% | 39.2% |
| 5 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2752 | 1.282 | 29.8% | 1.1% (0.1%, 1.9%) | 1.753 | -0.065 | 84.4% | 39.2% |
| 5 | √-censored Gaussian (ML), 40-day window | 2752 | 1.47 | 19.5% | -13.4% (-23.1%, -5.0%) | 2.184 | 0.363 | 85.1% | 38.4% |
| 5 | √-censored Gaussian (ML), 90-day window | 2752 | 1.43 | 21.7% | -10.3% (-22.8%, -2.3%) | 2.14 | 0.507 | 87.4% | 40.9% |
| 5 | Skill-weighted √-censored Gaussian (ML), 60-day window | 2752 | 1.333 | 27.0% | -2.8% (-7.0%, 0.9%) | 1.973 | 0.272 | 85.9% | 41.5% |
| 5 | Skill-weighted √-censored Gaussian (ML), 90-day window | 2752 | 1.342 | 26.6% | -3.5% (-8.5%, 1.0%) | 2.021 | 0.413 | 87.2% | 42.2% |
| 5 | Skill-weighted ∛-censored Gaussian (ML), 90-day window | 2752 | 1.466 | 19.8% | -13.1% (-27.0%, -3.6%) | 2.31 | 0.873 | 86.8% | 42.0% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | 2720 | 1.826 | 0.0% | -13.6% (-18.1%, -9.1%) | 3.069 | 0.209 | 89.0% | 0.0% |
| 7 | Raw multi-model ensemble | 2720 | 1.608 | 11.9% | 0.0% (0.0%, 0.0%) | 2.245 | 0.022 | 71.2% | 19.4% |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2720 | 1.622 | 11.2% | -0.9% (-2.4%, 1.0%) | 2.401 | 0.34 | 85.0% | 16.7% |
| 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2720 | 1.97 | -7.8% | -22.5% (-55.1%, -1.4%) | 2.671 | 0.257 | 86.1% | 19.1% |
| 7 | Skill-weighted ensemble (bias-corrected for temperature), 40-day window | 2720 | 1.597 | 12.5% | 0.7% (-0.5%, 2.1%) | 2.191 | -0.071 | 79.8% | 18.1% |
| 7 | Skill-weighted ensemble (bias-corrected for temperature), 90-day window | 2720 | 1.602 | 12.3% | 0.4% (-0.6%, 1.7%) | 2.197 | -0.08 | 79.9% | 18.6% |
| 7 | √-censored Gaussian (ML), 40-day window | 2720 | 2.011 | -10.1% | -25.1% (-50.2%, -7.1%) | 3.086 | 0.951 | 85.7% | 20.7% |
| 7 | √-censored Gaussian (ML), 90-day window | 2720 | 1.697 | 7.1% | -5.5% (-12.6%, 1.2%) | 2.757 | 0.782 | 88.4% | 24.8% |
| 7 | Skill-weighted √-censored Gaussian (ML), 60-day window | 2720 | 1.682 | 7.9% | -4.6% (-9.1%, -0.3%) | 2.7 | 0.594 | 87.0% | 24.1% |
| 7 | Skill-weighted √-censored Gaussian (ML), 90-day window | 2720 | 1.668 | 8.7% | -3.7% (-12.0%, 2.6%) | 2.643 | 0.656 | 87.8% | 25.0% |
| 7 | Skill-weighted ∛-censored Gaussian (ML), 90-day window | 2720 | 1.921 | -5.2% | -19.5% (-51.4%, -1.2%) | 3.248 | 1.443 | 87.4% | 25.7% |

## Caveats

- ERA5 is a ~31 km reanalysis, not station truth; grid-cell verification favours smooth models and understates local extremes.
- ECMWF AIFS is trained on ERA5, so verification against ERA5 is expected to favour it; its advantage against station observations may be smaller.
- Single grid points stand in for each region; production-weighted areal averages would score differently.
- Previous-Runs data stitch successive runs issued N days earlier, so a "day-3" forecast mixes run times within the target day.
- Diebold–Mariano tests use the cross-site daily mean loss; sites are not independent, so the effective sample is the number of days.
