# Production-weighted area verification

Generated 2026-11-16T09:58:29.626Z · astraeus-area-verification-v1 · suite final · confirmation period (test days > 2026-03-31), scored once after the method was frozen

This study answers the second weakness of the ERA5 benchmark: each commodity region is one grid point, not the production-weighted area that drives supply or demand. For four regions the producing counties / municipalities were clustered into four points (production-weighted k-medoids), each weighted by the share of production — population for heating demand — nearest to it. Every model’s daily forecast and ERA5 were averaged over the points with those weights, and the frozen methods were run unchanged on the area means. The single grid point is scored on the same days with the same climatology years for comparison.

## Areas and points

### Iowa corn belt — corn for grain production, 2022

97 counties with published production, total 2,470,000,000 bushels (14,192,000 bushels suppressed at county level and not allocated); production-weighted mean distance to the assigned point 70.7 km; compared with benchmark site `iowa`.

| Point | Medoid unit | Lat | Lon | Weight | Units assigned |
|---|---|---|---|---|---|
| iowa-corn-1 | Linn County, IA | 42.078 | -91.5977 | 29.6% | 33 |
| iowa-corn-2 | Franklin County, IA | 42.7365 | -93.2714 | 29.4% | 22 |
| iowa-corn-3 | Audubon County, IA | 41.6792 | -94.9043 | 22.2% | 26 |
| iowa-corn-4 | Cherokee County, IA | 42.7427 | -95.6333 | 18.7% | 16 |

Sources: [USDA NASS Iowa Ag News — 2023 Corn County Estimates (includes revised 2022 county production)](https://www.nass.usda.gov/sites/default/files/Statistics_by_State/Iowa/Publications/County_Estimates/2024/IA-CtyEst-Corn-02-24.pdf) — 2022 used: the 2023 column suppresses 13 counties (269 M bu in “Other counties”); [US Census Bureau 2024 Gazetteer — counties (internal points)](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip).

### Mato Grosso soybean belt — soybean (grain) quantity produced, 2024

131 producing municipalities, total 38,396,410 tonnes; production-weighted mean distance to the assigned point 133.5 km; compared with benchmark site `mato-grosso`.

| Point | Medoid unit | Lat | Lon | Weight | Units assigned |
|---|---|---|---|---|---|
| mato-grosso-soy-1 | Sorriso - MT | -12.668 | -55.723 | 41.2% | 34 |
| mato-grosso-soy-2 | Querência - MT | -12.1587 | -52.7434 | 22.6% | 26 |
| mato-grosso-soy-3 | Poxoréu - MT | -15.851 | -54.186 | 18.5% | 37 |
| mato-grosso-soy-4 | Sapezal - MT | -13.1544 | -58.6535 | 17.6% | 34 |

Sources: [IBGE Produção Agrícola Municipal 2024 — SIDRA table 1612 (lavouras temporárias), variable 214, product 2713 Soja (em grão)](https://apisidra.ibge.gov.br/values/t/1612/n6/in%20n3%2051/v/214/p/2024/c81/2713); [IBGE Malha Municipal 2024 — MT municipalities (polygon centroids)](https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/UFs/MT/MT_Municipios_2024.zip).

### Minas Gerais coffee regions — coffee (green bean, total) quantity produced, 2024

494 producing municipalities, total 1,687,329 tonnes; production-weighted mean distance to the assigned point 75 km; compared with benchmark site `minas`.

| Point | Medoid unit | Lat | Lon | Weight | Units assigned |
|---|---|---|---|---|---|
| minas-coffee-1 | Elói Mendes - MG | -21.6124 | -45.5973 | 29.0% | 126 |
| minas-coffee-2 | Manhuaçu - MG | -20.1953 | -42.1068 | 26.1% | 250 |
| minas-coffee-3 | Bom Jesus da Penha - MG | -21.0138 | -46.5291 | 22.4% | 50 |
| minas-coffee-4 | Patrocínio - MG | -18.9705 | -47.0513 | 22.4% | 68 |

Sources: [IBGE Produção Agrícola Municipal 2024 — SIDRA table 1613 (lavouras permanentes), variable 214, product 2723 Café (em grão) Total](https://apisidra.ibge.gov.br/values/t/1613/n6/in%20n3%2031/v/214/p/2024/c82/2723); [IBGE Malha Municipal 2024 — MG municipalities (polygon centroids)](https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/UFs/MG/MG_Municipios_2024.zip).

### US Northeast heating demand — resident population (heating-demand proxy), 2024

218 counties, total 57,832,935 persons; production-weighted mean distance to the assigned point 84.2 km; compared with benchmark site `northeast`.

| Point | Medoid unit | Lat | Lon | Weight | Units assigned |
|---|---|---|---|---|---|
| northeast-heating-1 | New York County, NY | 40.7766 | -73.9702 | 40.8% | 42 |
| northeast-heating-2 | Middlesex County, MA | 42.4817 | -71.3949 | 24.5% | 74 |
| northeast-heating-3 | Montgomery County, PA | 40.21 | -75.3702 | 20.5% | 39 |
| northeast-heating-4 | McKean County, PA | 41.8146 | -78.5725 | 14.1% | 63 |

Sources: [US Census Bureau county population totals, Vintage 2024 (co-est2024-alldata), Northeast region (REGION = 1)](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv); [US Census Bureau 2024 Gazetteer — counties (internal points)](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip).

Model membership differs between area and point for: iowa-corn (day 1: area 6 vs point 7 models); mato-grosso-soy (day 1: area 6 vs point 7 models); minas-coffee (day 1: area 6 vs point 7 models); northeast-heating (day 1: area 6 vs point 7 models).

Open-Meteo cost: 16 points × 159.8 weighted calls (forecasts 131.6, ERA5 4.7, climatology 23.5) = 2557 weighted calls.

## Area mean vs single point (pooled over the four regions)

Skill = pooled CRPSS of astraeus-v2 over the reference on paired region-days; the difference (area − point) has a 95% moving-block bootstrap interval over days.

### astraeus-v2 over raw-gauss

| Variable | Lead | Cases | CRPS area / point | Skill area | Skill point | Area − point (95% CI) | 80% coverage area / point |
|---|---|---|---|---|---|---|---|
| tmean | 1 | 726 | 0.262 / 0.359 | 17.0% | 15.4% | 1.5% (-3.5%, 5.9%) | 73% / 74% |
| tmean | 3 | 800 | 0.431 / 0.521 | 9.3% | 13.1% | -3.8% (-8.0%, -0.3%) | 74% / 73% |
| tmean | 5 | 804 | 0.622 / 0.704 | 3.4% | 7.0% | -3.6% (-6.9%, -0.7%) | 74% / 72% |
| tmean | 7 | 832 | 0.892 / 0.961 | 1.1% | 4.4% | -3.3% (-5.6%, -1.3%) | 71% / 72% |
| tmax | 1 | 726 | 0.42 / 0.584 | 15.8% | 14.3% | 1.5% (-2.9%, 6.3%) | 78% / 75% |
| tmax | 3 | 800 | 0.633 / 0.755 | 7.9% | 12.0% | -4.1% (-7.8%, -0.6%) | 78% / 80% |
| tmax | 5 | 804 | 0.832 / 0.948 | 6.4% | 10.4% | -4.0% (-6.3%, -1.7%) | 77% / 78% |
| tmax | 7 | 832 | 1.189 / 1.283 | 1.2% | 6.0% | -4.7% (-7.6%, -2.2%) | 73% / 76% |
| precip | 1 | 800 | 0.738 / 1.147 | 6.9% | 8.7% | -1.8% (-6.5%, 4.0%) | 83% / 83% |
| precip | 3 | 812 | 1.042 / 1.494 | 0.8% | 3.5% | -2.7% (-5.0%, 0.7%) | 80% / 81% |
| precip | 5 | 824 | 1.324 / 1.723 | -0.3% | 3.5% | -3.8% (-6.6%, -1.0%) | 80% / 77% |
| precip | 7 | 832 | 1.736 / 2.118 | 1.7% | 3.8% | -2.1% (-4.7%, 0.1%) | 78% / 80% |

### astraeus-v2 over raw-ensemble

| Variable | Lead | Cases | CRPS area / point | Skill area | Skill point | Area − point (95% CI) | 80% coverage area / point |
|---|---|---|---|---|---|---|---|
| tmean | 1 | 726 | 0.262 / 0.359 | 16.2% | 19.1% | -2.9% (-8.7%, 2.6%) | 73% / 74% |
| tmean | 3 | 800 | 0.431 / 0.521 | 11.3% | 15.0% | -3.8% (-7.9%, -0.1%) | 74% / 73% |
| tmean | 5 | 804 | 0.622 / 0.704 | 7.4% | 10.5% | -3.1% (-6.1%, -0.6%) | 74% / 72% |
| tmean | 7 | 832 | 0.892 / 0.961 | 6.1% | 8.7% | -2.7% (-4.8%, -0.7%) | 71% / 72% |
| tmax | 1 | 726 | 0.42 / 0.584 | 16.5% | 16.8% | -0.3% (-4.9%, 4.7%) | 78% / 75% |
| tmax | 3 | 800 | 0.633 / 0.755 | 10.5% | 14.5% | -4.0% (-7.6%, -0.7%) | 78% / 80% |
| tmax | 5 | 804 | 0.832 / 0.948 | 9.8% | 13.7% | -3.9% (-5.9%, -1.8%) | 77% / 78% |
| tmax | 7 | 832 | 1.189 / 1.283 | 5.2% | 9.9% | -4.6% (-7.2%, -2.1%) | 73% / 76% |
| precip | 1 | 800 | 0.738 / 1.147 | 5.1% | 4.4% | 0.6% (-1.9%, 3.8%) | 83% / 83% |
| precip | 3 | 812 | 1.042 / 1.494 | 2.2% | 1.1% | 1.1% (-0.2%, 2.6%) | 80% / 81% |
| precip | 5 | 824 | 1.324 / 1.723 | 0.7% | 1.2% | -0.5% (-2.0%, 1.0%) | 80% / 77% |
| precip | 7 | 832 | 1.736 / 2.118 | 1.0% | 0.9% | 0.1% (-1.1%, 1.0%) | 78% / 80% |

## By region

| Region | Variable | Lead | astraeus-v2 vs raw-gauss: area / point | Area − point (95% CI) | vs raw ensemble: area / point | vs climatology: area / point |
|---|---|---|---|---|---|---|
| Iowa corn belt | tmean | 1 | 17.9% / 12.4% | 5.5% (-5.2%, 17.2%) | 11.3% / 7.9% | 86.0% / 82.9% |
| Iowa corn belt | tmean | 5 | 2.8% / 1.6% | 1.2% (-1.2%, 4.1%) | 6.8% / 6.0% | 60.7% / 58.1% |
| Iowa corn belt | tmax | 1 | -1.2% / -5.2% | 4.0% (-9.8%, 20.4%) | 0.3% / -2.6% | 76.3% / 68.3% |
| Iowa corn belt | tmax | 5 | -4.2% / -1.2% | -3.0% (-7.6%, 2.4%) | 0.7% / 3.4% | 48.9% / 44.8% |
| Iowa corn belt | precip | 1 | 2.3% / 6.5% | -4.2% (-13.9%, 5.4%) | 2.5% / 3.5% | 66.0% / 48.6% |
| Iowa corn belt | precip | 5 | -0.5% / 1.1% | -1.7% (-5.2%, 1.4%) | 0.9% / -0.1% | 38.5% / 28.5% |
| Mato Grosso soybean belt | tmean | 1 | 22.4% / 13.6% | 8.8% (0.1%, 16.8%) | 21.7% / 22.2% | 66.1% / 47.2% |
| Mato Grosso soybean belt | tmean | 5 | 21.8% / 25.9% | -4.1% (-10.8%, 3.4%) | 24.3% / 27.9% | 41.6% / 21.4% |
| Mato Grosso soybean belt | tmax | 1 | 33.7% / 25.5% | 8.2% (2.2%, 14.7%) | 32.2% / 25.6% | 63.9% / 47.9% |
| Mato Grosso soybean belt | tmax | 5 | 29.8% / 35.1% | -5.4% (-8.6%, -0.7%) | 31.1% / 36.5% | 39.0% / 29.0% |
| Mato Grosso soybean belt | precip | 1 | 6.5% / 14.9% | -8.4% (-19.4%, -1.2%) | -1.3% / 5.0% | 38.5% / 16.6% |
| Mato Grosso soybean belt | precip | 5 | -9.1% / 2.2% | -11.3% (-20.3%, -4.5%) | -10.8% / -6.6% | 4.1% / -13.8% |
| Minas Gerais coffee regions | tmean | 1 | 10.9% / 22.2% | -11.3% (-22.2%, -2.3%) | 13.4% / 26.4% | 75.2% / 70.6% |
| Minas Gerais coffee regions | tmean | 5 | -17.0% / -2.5% | -14.5% (-30.3%, -4.4%) | -10.2% / 1.0% | 43.5% / 44.9% |
| Minas Gerais coffee regions | tmax | 1 | 16.4% / 17.5% | -1.1% (-7.5%, 4.7%) | 17.1% / 19.8% | 72.4% / 68.9% |
| Minas Gerais coffee regions | tmax | 5 | -3.3% / 5.6% | -9.0% (-17.3%, -2.4%) | -0.6% / 9.6% | 49.6% / 51.7% |
| Minas Gerais coffee regions | precip | 1 | 8.0% / 7.9% | 0.1% (-9.1%, 9.3%) | 8.9% / 6.0% | 57.1% / 41.8% |
| Minas Gerais coffee regions | precip | 5 | 3.5% / 5.4% | -1.8% (-8.0%, 4.8%) | 5.0% / 4.9% | 42.8% / 34.6% |
| US Northeast heating demand | tmean | 1 | 14.3% / 13.7% | 0.6% (-8.0%, 9.8%) | 17.9% / 18.6% | 87.2% / 80.0% |
| US Northeast heating demand | tmean | 5 | 1.3% / 0.0% | 1.3% (-6.8%, 8.2%) | 5.0% / 4.1% | 63.4% / 55.9% |
| US Northeast heating demand | tmax | 1 | 12.5% / 21.0% | -8.5% (-15.7%, -1.9%) | 16.0% / 26.3% | 81.6% / 75.1% |
| US Northeast heating demand | tmax | 5 | 3.3% / 1.4% | 1.9% (-5.0%, 8.8%) | 7.9% / 5.1% | 57.8% / 51.2% |
| US Northeast heating demand | precip | 1 | 12.8% / 10.8% | 2.0% (-7.5%, 13.6%) | 8.9% / 4.3% | 69.1% / 65.3% |
| US Northeast heating demand | precip | 5 | 1.4% / 6.3% | -4.9% (-9.8%, -0.9%) | 2.2% / 3.0% | 34.1% / 27.5% |

Leads 1 and 5 shown; all leads and methods are in `public/research/archive/weather-areas-confirm.json`.

## All methods on area-mean ERA5 (pooled)

| Variable | Lead | Method | Cases | CRPS | CRPSS vs clim. (ERA5 2022–2024) | CRPSS vs raw (95% CI) | CRPSS vs raw-gauss (95% CI) | Bias | 80% coverage |
|---|---|---|---|---|---|---|---|---|---|
| tmean | 1 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 862 | 1.437 | 0.0% | -352.8% (-391.2%, -316.5%) | -348.3% (-387.3%, -312.9%) | -0.25 | 77.0% |
| tmean | 1 | Raw multi-model ensemble | 862 | 0.317 | 77.9% | 0.0% (0.0%, 0.0%) | 1.0% (-0.9%, 2.6%) | 0.063 | 87.6% |
| tmean | 1 | Raw-ensemble Gaussian (no training) | 862 | 0.321 | 77.7% | -1.0% (-2.7%, 0.9%) | 0.0%  | 0.063 | 88.3% |
| tmean | 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 862 | 0.275 | 80.9% | 13.4% (11.9%, 14.9%) | 14.3% (12.6%, 15.7%) | 0.029 | 87.5% |
| tmean | 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 862 | 0.288 | 80.0% | 9.4% (3.8%, 15.1%) | 10.3% (4.1%, 16.1%) | 0.051 | 73.8% |
| tmean | 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 862 | 0.263 | 81.7% | 17.1% (12.6%, 21.5%) | 17.9% (12.8%, 22.7%) | 0.053 | 73.9% |
| tmean | 3 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 800 | 1.388 | 0.0% | -185.7% (-207.4%, -163.9%) | -192.1% (-214.4%, -170.0%) | -0.142 | 78.0% |
| tmean | 3 | Raw multi-model ensemble | 800 | 0.486 | 65.0% | 0.0% (0.0%, 0.0%) | -2.2% (-3.4%, -0.9%) | 0.198 | 86.6% |
| tmean | 3 | Raw-ensemble Gaussian (no training) | 800 | 0.475 | 65.8% | 2.2% (0.9%, 3.3%) | 0.0%  | 0.198 | 80.9% |
| tmean | 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 800 | 0.422 | 69.6% | 13.1% (11.5%, 14.7%) | 11.2% (9.6%, 12.7%) | 0.129 | 79.6% |
| tmean | 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 800 | 0.467 | 66.3% | 3.9% (-4.0%, 10.8%) | 1.7% (-6.3%, 8.8%) | 0.104 | 73.1% |
| tmean | 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 800 | 0.431 | 68.9% | 11.3% (5.3%, 17.1%) | 9.3% (3.5%, 15.1%) | 0.116 | 74.0% |
| tmean | 5 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 804 | 1.402 | 0.0% | -108.6% (-126.3%, -94.4%) | -117.6% (-136.3%, -102.1%) | -0.151 | 76.5% |
| tmean | 5 | Raw multi-model ensemble | 804 | 0.672 | 52.1% | 0.0% (0.0%, 0.0%) | -4.3% (-5.5%, -3.1%) | 0.255 | 83.3% |
| tmean | 5 | Raw-ensemble Gaussian (no training) | 804 | 0.644 | 54.0% | 4.1% (3.1%, 5.2%) | 0.0%  | 0.255 | 76.6% |
| tmean | 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 804 | 0.599 | 57.3% | 10.9% (9.4%, 12.8%) | 7.1% (5.7%, 8.8%) | 0.18 | 78.0% |
| tmean | 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 804 | 0.651 | 53.6% | 3.2% (-5.7%, 11.1%) | -1.0% (-10.3%, 7.1%) | 0.053 | 72.8% |
| tmean | 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 804 | 0.622 | 55.6% | 7.4% (0.8%, 13.7%) | 3.4% (-3.2%, 9.6%) | 0.124 | 73.9% |
| tmean | 7 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 832 | 1.432 | 0.0% | -50.7% (-68.5%, -39.0%) | -58.7% (-76.8%, -46.3%) | -0.211 | 76.9% |
| tmean | 7 | Raw multi-model ensemble | 832 | 0.95 | 33.6% | 0.0% (0.0%, 0.0%) | -5.3% (-6.5%, -4.1%) | 0.225 | 82.6% |
| tmean | 7 | Raw-ensemble Gaussian (no training) | 832 | 0.902 | 37.0% | 5.1% (4.0%, 6.1%) | 0.0%  | 0.225 | 73.9% |
| tmean | 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 832 | 0.862 | 39.8% | 9.3% (7.9%, 10.7%) | 4.5% (3.4%, 5.7%) | 0.152 | 75.4% |
| tmean | 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 832 | 0.914 | 36.2% | 3.8% (-2.5%, 10.1%) | -1.3% (-7.7%, 5.1%) | 0.236 | 70.3% |
| tmean | 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 832 | 0.892 | 37.7% | 6.1% (1.8%, 11.1%) | 1.1% (-3.0%, 6.2%) | 0.237 | 71.2% |
| tmax | 1 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 862 | 1.709 | 0.0% | -246.0% (-280.5%, -215.2%) | -248.8% (-283.0%, -218.5%) | 0.123 | 77.8% |
| tmax | 1 | Raw multi-model ensemble | 862 | 0.494 | 71.1% | 0.0% (0.0%, 0.0%) | -0.8% (-2.4%, 0.4%) | 0.085 | 92.0% |
| tmax | 1 | Raw-ensemble Gaussian (no training) | 862 | 0.49 | 71.3% | 0.8% (-0.4%, 2.3%) | 0.0%  | 0.085 | 91.3% |
| tmax | 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 862 | 0.436 | 74.5% | 11.7% (10.0%, 13.7%) | 11.0% (9.3%, 12.6%) | 0.025 | 89.3% |
| tmax | 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 862 | 0.463 | 72.9% | 6.3% (0.6%, 11.6%) | 5.5% (0.0%, 10.6%) | 0.137 | 76.9% |
| tmax | 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 862 | 0.425 | 75.1% | 13.8% (8.8%, 18.8%) | 13.2% (8.2%, 17.8%) | 0.168 | 77.5% |
| tmax | 3 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 800 | 1.658 | 0.0% | -134.6% (-156.7%, -116.2%) | -141.3% (-162.6%, -123.2%) | 0.294 | 78.8% |
| tmax | 3 | Raw multi-model ensemble | 800 | 0.707 | 57.4% | 0.0% (0.0%, 0.0%) | -2.9% (-4.2%, -1.2%) | 0.256 | 89.8% |
| tmax | 3 | Raw-ensemble Gaussian (no training) | 800 | 0.687 | 58.6% | 2.8% (1.2%, 4.0%) | 0.0%  | 0.256 | 86.3% |
| tmax | 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 800 | 0.625 | 62.3% | 11.5% (9.2%, 13.7%) | 9.0% (6.7%, 11.5%) | 0.151 | 84.3% |
| tmax | 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 800 | 0.679 | 59.1% | 4.0% (-5.3%, 11.7%) | 1.3% (-8.1%, 9.4%) | 0.223 | 75.9% |
| tmax | 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 800 | 0.633 | 61.8% | 10.5% (2.5%, 17.3%) | 7.9% (0.0%, 15.3%) | 0.263 | 78.0% |
| tmax | 5 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 804 | 1.666 | 0.0% | -80.7% (-98.2%, -65.3%) | -87.5% (-105.6%, -71.9%) | 0.258 | 77.7% |
| tmax | 5 | Raw multi-model ensemble | 804 | 0.922 | 44.6% | 0.0% (0.0%, 0.0%) | -3.8% (-5.0%, -2.4%) | 0.302 | 86.3% |
| tmax | 5 | Raw-ensemble Gaussian (no training) | 804 | 0.889 | 46.7% | 3.6% (2.4%, 4.8%) | 0.0%  | 0.302 | 82.1% |
| tmax | 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 804 | 0.824 | 50.5% | 10.6% (9.0%, 12.8%) | 7.2% (5.3%, 9.7%) | 0.19 | 79.9% |
| tmax | 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 804 | 0.864 | 48.1% | 6.3% (-2.7%, 13.5%) | 2.7% (-6.6%, 10.7%) | 0.181 | 76.5% |
| tmax | 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 804 | 0.832 | 50.1% | 9.8% (3.1%, 16.6%) | 6.4% (-1.1%, 13.7%) | 0.302 | 77.1% |
| tmax | 7 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 832 | 1.695 | 0.0% | -35.1% (-50.3%, -25.7%) | -40.8% (-56.3%, -31.1%) | 0.171 | 77.8% |
| tmax | 7 | Raw multi-model ensemble | 832 | 1.254 | 26.0% | 0.0% (0.0%, 0.0%) | -4.2% (-5.2%, -3.1%) | 0.307 | 84.7% |
| tmax | 7 | Raw-ensemble Gaussian (no training) | 832 | 1.203 | 29.0% | 4.1% (3.0%, 5.0%) | 0.0%  | 0.307 | 78.5% |
| tmax | 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 832 | 1.156 | 31.8% | 7.9% (6.2%, 9.2%) | 4.0% (2.3%, 5.5%) | 0.205 | 79.1% |
| tmax | 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 832 | 1.19 | 29.8% | 5.2% (0.0%, 11.0%) | 1.2% (-4.6%, 7.6%) | 0.44 | 71.5% |
| tmax | 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 832 | 1.189 | 29.9% | 5.2% (0.7%, 10.5%) | 1.2% (-3.8%, 7.2%) | 0.473 | 72.8% |
| precip | 1 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 872 | 1.997 | 0.0% | -157.8% (-183.8%, -135.5%) | -154.7% (-179.2%, -129.8%) | -0.639 | 76.1% |
| precip | 1 | Raw multi-model ensemble | 872 | 0.775 | 61.2% | 0.0% (0.0%, 0.0%) | 1.2% (-2.1%, 5.4%) | 0.218 | 84.5% |
| precip | 1 | Raw-ensemble Gaussian (no training) | 872 | 0.784 | 60.7% | -1.2% (-5.7%, 2.1%) | 0.0%  | 0.306 | 83.1% |
| precip | 1 | Astraeus v1 (inverse-MSE weights + spread inflation) | 872 | 0.747 | 62.6% | 3.6% (0.3%, 6.1%) | 4.8% (3.0%, 7.0%) | 0.242 | 81.0% |
| precip | 1 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 872 | 0.797 | 60.1% | -2.8% (-10.4%, 3.7%) | -1.6% (-8.8%, 5.7%) | -0.019 | 78.2% |
| precip | 1 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 872 | 0.739 | 63.0% | 4.7% (2.0%, 7.6%) | 5.8% (0.7%, 12.1%) | 0.119 | 84.3% |
| precip | 3 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 812 | 2.046 | 0.0% | -92.0% (-111.0%, -72.5%) | -94.8% (-114.1%, -74.2%) | -0.705 | 75.6% |
| precip | 3 | Raw multi-model ensemble | 812 | 1.066 | 47.9% | 0.0% (0.0%, 0.0%) | -1.5% (-3.1%, 0.8%) | 0.067 | 79.8% |
| precip | 3 | Raw-ensemble Gaussian (no training) | 812 | 1.05 | 48.7% | 1.4% (-0.8%, 3.0%) | 0.0%  | 0.148 | 75.6% |
| precip | 3 | Astraeus v1 (inverse-MSE weights + spread inflation) | 812 | 1.04 | 49.2% | 2.4% (-0.3%, 4.4%) | 1.0% (-0.2%, 2.2%) | 0.195 | 79.4% |
| precip | 3 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 812 | 1.177 | 42.5% | -10.4% (-22.9%, -1.1%) | -12.0% (-24.6%, -2.5%) | 0.08 | 79.1% |
| precip | 3 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 812 | 1.042 | 49.1% | 2.2% (0.5%, 3.8%) | 0.8% (-1.7%, 3.7%) | 0.047 | 80.4% |
| precip | 5 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 824 | 2.042 | 0.0% | -53.2% (-62.8%, -42.3%) | -54.7% (-64.6%, -43.4%) | -0.719 | 75.8% |
| precip | 5 | Raw multi-model ensemble | 824 | 1.333 | 34.7% | 0.0% (0.0%, 0.0%) | -1.0% (-2.3%, 0.6%) | -0.121 | 82.5% |
| precip | 5 | Raw-ensemble Gaussian (no training) | 824 | 1.321 | 35.3% | 1.0% (-0.6%, 2.3%) | 0.0%  | 0.009 | 75.0% |
| precip | 5 | Astraeus v1 (inverse-MSE weights + spread inflation) | 824 | 1.318 | 35.5% | 1.1% (-1.8%, 3.5%) | 0.2% (-1.6%, 2.0%) | 0.118 | 77.8% |
| precip | 5 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 824 | 1.386 | 32.2% | -3.9% (-10.7%, 1.9%) | -4.9% (-11.5%, 1.3%) | -0.049 | 77.2% |
| precip | 5 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 824 | 1.324 | 35.2% | 0.7% (-1.0%, 2.2%) | -0.3% (-2.0%, 1.6%) | -0.088 | 80.1% |
| precip | 7 | Climatology (area-mean ERA5 2022–2024, ±7 d) | 832 | 2.034 | 0.0% | -16.0% (-25.6%, -7.5%) | -15.2% (-25.2%, -6.9%) | -0.703 | 76.0% |
| precip | 7 | Raw multi-model ensemble | 832 | 1.753 | 13.8% | 0.0% (0.0%, 0.0%) | 0.7% (-1.1%, 2.2%) | -0.18 | 78.2% |
| precip | 7 | Raw-ensemble Gaussian (no training) | 832 | 1.766 | 13.2% | -0.7% (-2.3%, 1.1%) | 0.0%  | 0.002 | 70.6% |
| precip | 7 | Astraeus v1 (inverse-MSE weights + spread inflation) | 832 | 1.753 | 13.8% | 0.0% (-2.6%, 2.6%) | 0.7% (-1.0%, 2.4%) | 0.245 | 77.6% |
| precip | 7 | EMOS (Gneiting et al. 2005; censored Gaussian for rain) | 832 | 1.83 | 10.0% | -4.4% (-11.4%, 0.8%) | -3.7% (-11.1%, 1.7%) | 0.004 | 78.1% |
| precip | 7 | Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window) | 832 | 1.736 | 14.7% | 1.0% (0.2%, 1.8%) | 1.7% (-0.4%, 3.6%) | -0.198 | 78.2% |

## Caveats

- Confirmation period only (test days 2026-04-01 → 2026-11-08): area forecasts were fetched from 2025-12-15 to fit the Open-Meteo budget, which leaves no development-period history for the areas.
- Climatology uses ERA5 2022–2024 for both the areas and the single points in this comparison (3 years to fit the budget; the published benchmark uses 2019–2024), so CRPSS vs climatology here is not comparable with the published table.
- Four points per area: the area mean is a 4-point production-weighted average, not a full areal integral; it removes much but not all small-scale noise.
- Skill differences compare scores on different truths (area-mean ERA5 vs grid-point ERA5): the area mean is smoother and easier to forecast, so CRPS levels fall; the question is whether post-processing gains (CRPSS) survive, not whether CRPS is lower.
- Model membership is fixed per run from availability (≥ 90% of days) over each run’s own archive. UK Met Office day-1 forecasts have a gap of about six weeks in April–May 2026 in the Previous-Runs archive: over the single points’ full archive (from 2025-07-01) the model passes the rule, over the shorter area archive (from 2025-12-15) it does not, so day-1 area forecasts use 6 models and day-1 point forecasts 7. Leads 3–7 use identical models.
- ERA5 remains the truth here; production-weighted station networks would be the natural next step.

## Reproduce

```
npx tsx research/build-areas.ts                          # research/data/areas.json (points, weights, sources)
npx tsx research/weather-benchmark.ts --suite final --period confirm --sites areas --clim-years 2022,2024 [--offline]
npx tsx research/weather-benchmark.ts --suite final --period confirm --offline --only iowa,mato-grosso,minas,northeast --clim-years 2022,2024
npx tsx research/verification-report.ts
```
