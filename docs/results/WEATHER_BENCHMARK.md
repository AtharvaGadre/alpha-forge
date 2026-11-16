# Astraeus weather benchmark

Generated 2026-11-15T23:55:09.937Z · astraeus-weather-benchmark-v1 · suite final · confirmation period (test days > 2026-03-31), scored once after the method was frozen

Sites: 16 commodity regions · models: 7 · leads: 1, 3, 5, 7 days · training window 40 days (refit every 7 days, ERA5 lag 6 days).

## Daily mean 2 m temperature (°C)

| Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 2910 | 1.566 | 0.0% | -281.5% (-330.0%, -258.6%) | 2.197 | -0.352 | 76.4% | 0.0% |
| 1 | Raw multi-model ensemble | 2910 | 0.41 | 73.8% | 0.0% (0.0%, 0.0%) | 0.54 | 0.129 | 78.8% | 70.9% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2910 | 0.361 | 77.0% | 12.1% (10.6%, 12.7%) | 0.491 | 0.097 | 87.0% | 74.6% |
| 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2910 | 0.38 | 75.7% | 7.3% (2.3%, 10.4%) | 0.521 | 0.055 | 69.0% | 74.6% |
| 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 2910 | 0.341 | 78.2% | 16.9% (13.6%, 19.5%) | 0.476 | 0.068 | 73.5% | 76.2% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 3209 | 1.583 | 0.0% | -181.2% (-195.9%, -163.7%) | 2.226 | -0.342 | 75.9% | 0.0% |
| 3 | Raw multi-model ensemble | 3209 | 0.563 | 64.4% | 0.0% (0.0%, 0.0%) | 0.74 | 0.183 | 70.4% | 60.3% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3209 | 0.495 | 68.7% | 12.0% (10.4%, 12.7%) | 0.674 | 0.121 | 81.7% | 64.7% |
| 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3209 | 0.523 | 67.0% | 7.1% (1.5%, 11.5%) | 0.721 | 0.064 | 72.0% | 65.6% |
| 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3209 | 0.479 | 69.7% | 14.8% (11.0%, 17.8%) | 0.666 | 0.07 | 75.4% | 67.4% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 3216 | 1.572 | 0.0% | -113.2% (-123.5%, -99.9%) | 2.209 | -0.345 | 76.2% | 0.0% |
| 5 | Raw multi-model ensemble | 3216 | 0.737 | 53.1% | 0.0% (0.0%, 0.0%) | 0.974 | 0.185 | 66.4% | 49.4% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3216 | 0.668 | 57.5% | 9.4% (8.8%, 10.2%) | 0.917 | 0.127 | 78.4% | 53.8% |
| 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3216 | 0.721 | 54.1% | 2.2% (-2.6%, 7.2%) | 0.996 | 0.08 | 71.4% | 53.9% |
| 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3216 | 0.671 | 57.3% | 8.9% (5.7%, 12.6%) | 0.932 | 0.105 | 75.0% | 56.3% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | 3328 | 1.58 | 0.0% | -55.8% (-63.9%, -48.3%) | 2.221 | -0.369 | 76.6% | 0.0% |
| 7 | Raw multi-model ensemble | 3328 | 1.014 | 35.8% | 0.0% (0.0%, 0.0%) | 1.335 | 0.162 | 58.6% | 32.0% |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3328 | 0.927 | 41.4% | 8.7% (8.0%, 9.4%) | 1.274 | 0.106 | 75.5% | 39.1% |
| 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3328 | 0.992 | 37.3% | 2.3% (-1.1%, 5.8%) | 1.374 | 0.146 | 71.7% | 37.8% |
| 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3328 | 0.944 | 40.3% | 6.9% (4.8%, 9.5%) | 1.316 | 0.162 | 74.4% | 39.8% |

## Daily maximum 2 m temperature (°C)

| Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 2910 | 1.968 | 0.0% | -199.2% (-246.1%, -185.3%) | 2.75 | -0.12 | 78.3% | 0.0% |
| 1 | Raw multi-model ensemble | 2910 | 0.658 | 66.6% | 0.0% (0.0%, 0.0%) | 0.869 | -0.125 | 74.3% | 60.3% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 2910 | 0.598 | 69.6% | 9.1% (8.3%, 10.0%) | 0.823 | -0.139 | 82.9% | 64.5% |
| 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 2910 | 0.588 | 70.1% | 10.6% (3.0%, 12.5%) | 0.805 | 0.075 | 72.5% | 67.4% |
| 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 2910 | 0.544 | 72.3% | 17.2% (11.7%, 19.2%) | 0.756 | 0.1 | 75.5% | 69.2% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 3209 | 1.977 | 0.0% | -136.1% (-149.1%, -123.4%) | 2.764 | -0.12 | 78.0% | 0.0% |
| 3 | Raw multi-model ensemble | 3209 | 0.837 | 57.6% | 0.0% (0.0%, 0.0%) | 1.092 | -0.073 | 70.4% | 50.4% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3209 | 0.758 | 61.6% | 9.4% (7.7%, 10.1%) | 1.036 | -0.123 | 80.2% | 55.4% |
| 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3209 | 0.757 | 61.7% | 9.6% (5.0%, 13.2%) | 1.046 | 0.123 | 74.4% | 59.0% |
| 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3209 | 0.713 | 63.9% | 14.8% (11.1%, 17.6%) | 0.994 | 0.128 | 77.7% | 60.7% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 3216 | 1.959 | 0.0% | -84.3% (-93.6%, -74.5%) | 2.735 | -0.111 | 78.5% | 0.0% |
| 5 | Raw multi-model ensemble | 3216 | 1.063 | 45.7% | 0.0% (0.0%, 0.0%) | 1.412 | -0.061 | 65.5% | 41.1% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3216 | 0.979 | 50.0% | 7.9% (7.1%, 8.6%) | 1.357 | -0.12 | 77.0% | 46.2% |
| 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3216 | 1.01 | 48.4% | 5.0% (0.3%, 9.2%) | 1.4 | 0.153 | 73.3% | 47.5% |
| 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3216 | 0.946 | 51.7% | 11.0% (7.1%, 14.2%) | 1.314 | 0.197 | 76.3% | 50.7% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | 3328 | 1.963 | 0.0% | -40.3% (-47.0%, -34.8%) | 2.742 | -0.144 | 78.7% | 0.0% |
| 7 | Raw multi-model ensemble | 3328 | 1.399 | 28.7% | 0.0% (0.0%, 0.0%) | 1.835 | -0.095 | 59.3% | 25.6% |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3328 | 1.299 | 33.8% | 7.1% (6.4%, 7.7%) | 1.781 | -0.167 | 74.4% | 31.6% |
| 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3328 | 1.318 | 32.8% | 5.8% (2.7%, 8.9%) | 1.811 | 0.188 | 73.4% | 34.2% |
| 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3328 | 1.277 | 34.9% | 8.7% (5.8%, 11.8%) | 1.761 | 0.252 | 76.2% | 34.7% |

## Daily precipitation (mm)

| Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Climatology (ERA5 2019–2024, ±7 d) | 3222 | 2.227 | 0.0% | -87.5% (-101.3%, -70.6%) | 3.448 | -0.141 | 85.7% | 0.0% |
| 1 | Raw multi-model ensemble | 3222 | 1.187 | 46.7% | 0.0% (0.0%, 0.0%) | 1.713 | 0.238 | 83.1% | 60.1% |
| 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3222 | 1.203 | 46.0% | -1.3% (-2.8%, 0.3%) | 1.791 | 0.434 | 90.6% | 60.0% |
| 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3222 | 1.352 | 39.3% | -13.9% (-23.6%, -5.8%) | 1.788 | 0.081 | 84.4% | 56.5% |
| 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3222 | 1.16 | 47.9% | 2.3% (1.3%, 3.3%) | 1.654 | 0.225 | 86.8% | 60.7% |
| 3 | Climatology (ERA5 2019–2024, ±7 d) | 3248 | 2.27 | 0.0% | -52.9% (-62.9%, -42.1%) | 3.491 | -0.202 | 85.3% | 0.0% |
| 3 | Raw multi-model ensemble | 3248 | 1.485 | 34.6% | 0.0% (0.0%, 0.0%) | 2.119 | 0.219 | 78.7% | 52.4% |
| 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3248 | 1.488 | 34.4% | -0.2% (-1.9%, 1.4%) | 2.222 | 0.459 | 88.0% | 50.1% |
| 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3248 | 1.668 | 26.6% | -12.3% (-22.6%, -3.2%) | 2.223 | 0.08 | 84.6% | 47.6% |
| 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3248 | 1.459 | 35.7% | 1.8% (1.0%, 2.6%) | 2.042 | 0.198 | 84.0% | 51.8% |
| 5 | Climatology (ERA5 2019–2024, ±7 d) | 3296 | 2.273 | 0.0% | -30.2% (-37.7%, -22.3%) | 3.49 | -0.206 | 85.4% | 0.0% |
| 5 | Raw multi-model ensemble | 3296 | 1.745 | 23.2% | 0.0% (0.0%, 0.0%) | 2.503 | 0.187 | 76.4% | 37.6% |
| 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3296 | 1.794 | 21.1% | -2.8% (-3.9%, -1.7%) | 2.674 | 0.547 | 86.7% | 34.1% |
| 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3296 | 1.986 | 12.6% | -13.8% (-28.0%, -4.8%) | 2.668 | 0.234 | 83.6% | 32.8% |
| 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3296 | 1.724 | 24.2% | 1.2% (0.4%, 2.1%) | 2.434 | 0.163 | 82.0% | 37.6% |
| 7 | Climatology (ERA5 2019–2024, ±7 d) | 3328 | 2.271 | 0.0% | -11.2% (-16.0%, -6.2%) | 3.486 | -0.209 | 85.4% | 0.0% |
| 7 | Raw multi-model ensemble | 3328 | 2.042 | 10.1% | 0.0% (0.0%, 0.0%) | 2.887 | 0.165 | 70.2% | 21.0% |
| 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 3328 | 2.102 | 7.4% | -2.9% (-4.3%, -1.3%) | 3.171 | 0.686 | 85.9% | 17.2% |
| 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 3328 | 2.199 | 3.2% | -7.7% (-12.4%, -2.7%) | 3.07 | 0.016 | 84.6% | 15.9% |
| 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 3328 | 2.019 | 11.1% | 1.1% (0.5%, 1.9%) | 2.808 | 0.102 | 79.8% | 21.5% |

## Caveats

- ERA5 is a ~31 km reanalysis, not station truth; grid-cell verification favours smooth models and understates local extremes.
- ECMWF AIFS is trained on ERA5, so verification against ERA5 is expected to favour it; its advantage against station observations may be smaller.
- Single grid points stand in for each region; production-weighted areal averages would score differently.
- Previous-Runs data stitch successive runs issued N days earlier, so a "day-3" forecast mixes run times within the target day.
- Diebold–Mariano tests use the cross-site daily mean loss; sites are not independent, so the effective sample is the number of days.
