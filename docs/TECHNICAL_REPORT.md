# Calibrated multi-model weather forecasts for commodity regions, and what they can and cannot tell us about futures returns

*Astraeus Technical Report AR-2026-01 (revision 2) · Astraeus Research*

- Results generated 2026-11-16
- Weather benchmark astraeus-weather-benchmark-v1 · final/confirm
- Price study astraeus-weather-price-walkforward-v1
- Code: research/weather-benchmark.ts · research/price-study.ts · src/engine/weatherPostprocessing.ts

## Abstract

We verify daily forecasts from seven global weather prediction systems — ECMWF IFS and the machine-learning AIFS, NOAA GFS, DWD ICON, the UK Met Office Unified Model, JMA GSM and ECCC GEM — at 16 commodity-producing and demand regions against ERA5 reanalysis, and develop the post-processing behind the Astraeus commodity platform. Candidate methods were compared on development-period test days (October 2025 to 2026-03-31); the selected scheme, Astraeus v2 — bias-corrected, skill-weighted non-homogeneous Gaussian regression for temperature and a skill-weighted multi-model ensemble for precipitation, both trained on trailing 90-day windows — was then frozen and scored on a later confirmation period (209 days, 38,420 forecast–observation pairs). Against a zero-training Gaussian forecast built from the same models, Astraeus v2 reduced the continuous ranked probability score (CRPS) of daily maximum temperature by 14.8% at day 1 and 4.5% at day 7, and of daily mean temperature by 15.0% and 2.7% (significant in 6 of 8 temperature cells at p < 0.05). Against the raw ensemble scored as its empirical distribution the reductions are larger (17.2% and 8.7% for maximum temperature), partly because a 7- to 5-member ensemble carries a finite-ensemble penalty. For precipitation, where v2 is itself a weighted ensemble, the like-for-like gain over the raw ensemble was 2.3% at day 1 and 1.1% at day 7 (significant at every lead). The gains come from bias correction and skill weighting rather than from better dispersion: v2’s central 80% intervals covered 76%–78% of maximum-temperature observations, whereas the raw ensemble is over-dispersive at short leads. An exploratory first run had also covered the confirmation days, so a strictly prospective test on forecasts issued after 2026-11-16 is specified alongside. In a walk-forward study of weekly futures returns for 6 weather-sensitive commodities, weather information improved out-of-sample forecasts over a market-only model in 6 of 34 commodity–information–horizon cells (point estimates); after Benjamini–Hochberg correction the only surviving cell is Natural gas (Henry Hub) with NWP forecasts known at origin at 1 week (R² gain over the market-only model +6.7%, Clark–West q = 0.004), which nevertheless did not significantly beat a no-change forecast (Diebold–Mariano p = 0.210; out-of-sample R² +7.1%, 95% CI -3.3% to +22.2%) and rests on 88 weeks. Calibrated weather information is a reliable physical input; weekly price predictability from weather is narrow and should be claimed only where it survives out-of-sample testing.

**Keywords:** ensemble post-processing · EMOS · CRPS · ERA5 · AIFS · commodity futures · out-of-sample predictability

## 1. Introduction

Weather is a first-order driver of commodity supply and demand. Extreme heat above roughly 29–30 °C sharply reduces US corn and soybean yields (Schlenker and Roberts, 2009), weather-driven yield shocks identify the supply response of staple crops (Roberts and Schlenker, 2013), temperature shocks move natural-gas returns and volatility through heating and cooling demand and storage (Mu, 2007), and frost risk is visible in orange-juice futures (Roll, 1984; Boudoukh et al., 2007).

Medium-range forecasting has improved steadily (Bauer et al., 2015; Haiden et al., 2026) and machine-learning models trained on reanalysis now rival or exceed physics-based systems on many headline scores (Lam et al., 2023; Price et al., 2025; Bi et al., 2023; Lang et al., 2024). Raw model output is nonetheless biased, so operational centres apply statistical post-processing (Gneiting et al., 2005; Raftery et al., 2005; Vannitsem et al., 2021).

This report documents the weather engine behind Astraeus and asks two questions. How accurate are freely available global forecasts at the places commodities are grown and consumed, and how much does post-processing help? And does weather information measurably improve forecasts of weekly commodity futures returns once evaluated out of sample?

- A reproducible, 16-region verification of seven global models (including ECMWF’s AIFS) against ERA5 at leads of 1, 3, 5, 7 days.
- A development/confirmation protocol, a zero-training baseline that separates learned skill from the finite-ensemble penalty, and calibration judged consistently from the probability integral transform.
- A closed-form CRPS for the zero-censored Gaussian, derived and verified numerically, alongside skill-weighted NGR and weighted-ensemble predictors.
- A walk-forward test of weather information in futures returns with nested-model tests and multiple-testing control.

## 2. Data

Forecasts. Daily forecasts were reconstructed from the Open-Meteo Previous Runs API, which archives each model’s hourly output as issued N days before the target day. Hourly values were aggregated to UTC days (all 24 hours required) as the mean and maximum of 2 m temperature and the sum of precipitation. Leads of 1, 3, 5, 7 days were used. A model enters at a region and lead when it is available on at least 90% of archive days — a rule that uses no truth or skill information — giving 7–7 models at day 1, 6–6 models at day 3, 6–6 models at day 5, 5–5 models at day 7.

Truth. ERA5 reanalysis (Hersbach et al., 2020) from the Open-Meteo archive, aggregated identically. ERA5 is published with a lag of about five days; only days at least 6 days before issue time are treated as known.

Climatology. Reference forecasts are the empirical distribution of ERA5 values within ±7 days of the calendar date over 2019–2024, years that do not overlap the evaluation.

**Table 1. Verification regions (representative grid points) and models available at leads 1 / 3 / 5 / 7 days.**

| Region | Commodities | Lat, lon | Models by lead |
|---|---|---|---|
| Iowa · US Corn Belt | corn, soybeans, hogs | 42.03, -93.62 | 7 / 6 / 6 / 5 |
| Kansas · US Plains | wheat | 38.84, -97.61 | 7 / 6 / 6 / 5 |
| Mato Grosso · Brazil | soybeans, cotton | -12.54, -55.72 | 7 / 6 / 6 / 5 |
| Paraná · Brazil | corn, soybeans | -24.95, -53.46 | 7 / 6 / 6 / 5 |
| Córdoba · Argentina | corn, soybeans | -31.42, -64.19 | 7 / 6 / 6 / 5 |
| Minas Gerais · Brazil | coffee | -21.55, -45.43 | 7 / 6 / 6 / 5 |
| Daloa · Côte d’Ivoire | cocoa | 6.88, -6.45 | 7 / 6 / 6 / 5 |
| Punjab · India | wheat, rice | 30.90, 75.86 | 7 / 6 / 6 / 5 |
| Beauce · France | wheat | 48.45, 1.49 | 7 / 6 / 6 / 5 |
| Odesa · Ukraine | wheat, corn | 46.48, 30.73 | 7 / 6 / 6 / 5 |
| New South Wales · Australia | wheat | -32.25, 148.60 | 7 / 6 / 6 / 5 |
| Jilin · China | corn | 43.84, 126.55 | 7 / 6 / 6 / 5 |
| Mekong Delta · Vietnam | rice | 10.05, 105.75 | 7 / 6 / 6 / 5 |
| Texas · United States | natural-gas | 32.78, -96.80 | 7 / 6 / 6 / 5 |
| Northeast · United States | natural-gas, heating-oil | 40.71, -74.01 | 7 / 6 / 6 / 5 |
| Northwest Europe · Netherlands | natural-gas | 52.37, 4.90 | 7 / 6 / 6 / 5 |

Prices. Friday-to-Friday weekly log returns of continuous front-month futures from the Yahoo Finance chart endpoint. Continuous contracts contain roll jumps, so returns are research proxies rather than executable P&L.

## 3. Methods

3.1 Scoring. Forecasts are judged with the continuous ranked probability score, a strictly proper score that rewards calibration and sharpness jointly (Gneiting and Raftery, 2007; Hersbach, 2000):

```
CRPS(F, y) = ∫ (F(x) − 𝟙{x ≥ y})² dx    (1)
```

For a Gaussian N(μ, σ²) it has the closed form of Gneiting et al. (Gneiting et al., 2005); for an m-member ensemble it is E|X − y| − ½E|X − X′|, computed exactly by sorting. For a Gaussian left-censored at zero we use

```
CRPS_c0(μ, σ; y) = CRPS_N(μ, σ; y) − σ [ ℓΦ(ℓ)² + 2φ(ℓ)Φ(ℓ) − Φ(ℓ√2)/√π ],   ℓ = −μ/σ    (2)
```

which follows from removing the integral of Φ² below zero; it agrees with numerical integration to 10⁻⁸ in the unit tests and is consistent with the censored-distribution formulas of scoringRules (Jordan et al., 2019). Skill is CRPSS = 1 − ΣCRPS / ΣCRPS_ref over identical cases. Calibration is judged from the randomised probability integral transform (PIT; rank-based for ensembles, with a weighted analogue for weighted ensembles that reduces to the rank when weights are equal) (Hamill, 2001; Gneiting et al., 2007); central 80% coverage is the share of PIT values in [0.1, 0.9], so a calibrated forecast covers 80% whatever its representation. Events (precipitation ≥ 1 mm; temperature above the local 80th climatological percentile) are scored with the Brier score and its decomposition.

3.2 Methods compared. All trained methods are refitted every seven days on trailing windows containing only information available at issue time.

- Raw ensemble: the m available model forecasts (m = 7, 6, 6, 5 at days 1, 3, 5, 7) as equally weighted members.
- Zero-training Gaussian: N(member mean, member sd²), zero-censored for precipitation. It isolates the effect of turning a few point forecasts into a smooth distribution from the effect of learning from past errors.
- Astraeus v1 (the previous production method): inverse-MSE model weights shrunk 50% toward equal weights and a Gaussian whose spread is inflated by the training RMSE/spread ratio.
- Classical EMOS (Gneiting et al., 2005) on 40-day windows: Y ~ N(a + b·m̄, c² + d²s²) on additively bias-corrected, equally weighted members, fitted by minimum CRPS; for precipitation a zero-censored Gaussian with variance c² + d²·MD + g²·m̄ (Scheuerer and Hamill, 2015; Thorarinsdottir and Gneiting, 2010).
- Skill-weighted NGR: members are bias-corrected, combined with inverse-MSE weights shrunk 25% toward equal (cf. superensemble weighting (Krishnamurti et al., 1999)), then Y ~ N(a + b·m̄_w, c² + d²·s²_w) is fitted by minimum CRPS — four parameters regardless of the number of models.
- Skill-weighted ensemble: the members with the same weights (bias-corrected for temperature), scored with the weighted-ensemble CRPS.
- Development-only candidates: power-censored Gaussians for precipitation on √ and ∛ scales fitted by maximum likelihood (Messner et al., 2014; Gebetsberger et al., 2018), and NGR with a climatology predictor.

```
w_i ∝ (1 − λ)·MSE_i⁻¹ / Σ_j MSE_j⁻¹ + λ/K,   λ = 0.25;   Y | x ~ N(a + b Σ w_i (x_i − β_i),  c² + d² Σ w_i (x_i − β_i − m̄_w)²)    (3)
```

3.3 Protocol. An exploratory first run evaluated five methods over the whole archive with 40-day windows; because it covered the later confirmation days too, those days are held out from tuning but not unseen. Replaying that run on development days only reproduces its diagnostics (EMOS day-1 coverage 74% and 74% for mean and maximum temperature; censored-EMOS precipitation CRPSS -13%, -11%, -19%, -22% at days 1, 3, 5, 7), so the redesign would have followed from development data alone. New candidates were then compared only on test days up to 2026-03-31. The selection rule was the highest mean CRPSS against the raw ensemble, pooled over both temperature variables and all leads for temperature, and over all leads for precipitation. Astraeus v2 was frozen before the confirmation period was scored, and the scoring corrections made after an independent code review (Section 6) changed only how forecasts are scored, not the method. A strictly prospective evaluation covers forecasts for days after 2026-11-16 (--period prospective).

3.4 Inference. Confidence intervals for CRPSS come from a 7-day moving-block bootstrap over days that recomputes the pooled ratio from the resampled cases. Diebold–Mariano tests (Diebold and Mariano, 1995) use the case-weighted daily loss differential with a Newey–West bandwidth of 14 days and the Harvey–Leybourne–Newbold correction (Harvey et al., 1997); reported p-values are the largest across bandwidths of the lead, 7, 14 and 21 days. Regions are not independent, so the effective sample size is the number of days.

3.5 Price study. Weekly log returns at 1- and 4-week horizons are forecast with expanding-window ridge regressions: a market-only model (recent returns and realised volatility) and a nested model adding weather features — season-gated extreme degree days and precipitation in production regions (Schlenker and Roberts, 2009), frost indicators for coffee, and heating/cooling degree-day anomalies for natural gas (Mu, 2007). Three information sets are tested: realised weather with a publication lag, a look-ahead diagnostic using the weather that occurred during the holding period (not tradable, and not an upper bound because forecastable weather is already priced at the origin), and NWP forecasts known at the origin (2024–2026). Out-of-sample R² follows Campbell and Thompson (Campbell and Thompson, 2008); nested models are compared with the Clark–West test (Clark and West, 2007), direction with Pesaran–Timmermann (Pesaran and Timmermann, 1992), and p-values are controlled for false discovery with Benjamini–Hochberg (Benjamini and Hochberg, 1995).

## 4. Results

4.1 First run. Every post-processing method improved temperature forecasts at short leads, but classical EMOS on 40-day windows was under-dispersive and censored-Gaussian EMOS degraded precipitation (development-only figures in Section 3.3). Requiring every model to be present also left day 7 empty, because not every model publishes 7-day-old runs; availability is therefore assessed per lead.

4.2 Development period. Table 2 lists the four best candidates per variable by mean CRPSS against the raw ensemble across leads. Pooled over both temperature variables, Skill-weighted NGR (90 d) led (+11.6%, next Skill-weighted NGR (60 d) +11.3%); for maximum temperature alone Skill-weighted NGR (60 d) was marginally ahead (+10.4% vs +10.3%). For precipitation, Skill-weighted ensemble (90 d) led (+1.9%); none of the parametric censored models beat the raw ensemble on average.

**Table 2. Development period (test days to 2026-03-31): CRPSS vs the raw ensemble by lead and the mean across leads.**

| Variable | Method | Day 1 | Day 3 | Day 5 | Day 7 | Mean |
|---|---|---|---|---|---|---|
| Max temp. | Skill-weighted NGR (60 d) | +16.1% | +11.2% | +7.3% | +7.0% | +10.4% |
|  | Skill-weighted NGR (90 d) | +15.4% | +11.1% | +7.3% | +7.2% | +10.3% |
|  | Skill NGR + clim. (90 d) | +13.8% | +9.9% | +5.1% | +5.2% | +8.5% |
|  | Skill-weighted NGR (40 d) | +16.0% | +9.0% | +3.4% | +2.9% | +7.8% |
| Mean temp. | Skill-weighted NGR (90 d) | +21.8% | +15.7% | +8.7% | +5.8% | +13.0% |
|  | Skill-weighted NGR (60 d) | +21.2% | +15.6% | +7.5% | +4.3% | +12.2% |
|  | Skill NGR + clim. (90 d) | +20.5% | +14.3% | +6.4% | +2.5% | +10.9% |
|  | Astraeus v1 | +12.1% | +11.7% | +8.7% | +7.2% | +9.9% |
| Precip. | Skill-weighted ensemble (90 d) | +3.4% | +2.5% | +1.1% | +0.4% | +1.9% |
|  | Skill-weighted ensemble (40 d) | +2.6% | +1.6% | +1.4% | +0.7% | +1.6% |
|  | Raw ensemble | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% |
|  | Astraeus v1 | -0.2% | -0.6% | +0.4% | -0.9% | -0.3% |

4.3 Confirmation period. Table 3 is the headline result. Against the zero-training Gaussian, Astraeus v2 reduced CRPS for maximum temperature by 14.8%, 11.3%, 7.4%, 4.5% and for mean temperature by 15.0%, 12.5%, 5.5%, 2.7% at days 1, 3, 5, 7; 6 of 8 temperature cells are significant at p < 0.05 under every bandwidth. Against the raw ensemble the improvement is significant in 12 of 12 cells, including precipitation at every lead. Against the previous production method it was significantly better in 7 of 12 cells, significantly worse in 0, and statistically indistinguishable in 5 (max temp. day 5, max temp. day 7, mean temp. day 3, mean temp. day 5, mean temp. day 7), where v1’s simpler Gaussian is about as good.

**Table 3. Confirmation period. CRPS of the raw ensemble, the zero-training Gaussian and Astraeus v2; CRPSS of v2 with 95% block-bootstrap intervals and Diebold–Mariano p-values (largest across bandwidths) against each reference; and PIT-based 80% coverage of v2.**

| Variable | Lead | N | m | CRPS raw | CRPS Gauss | CRPS v2 | vs Gauss (95% CI) | p | vs raw (95% CI) | p | vs v1 | p | Cov. 80% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Max temp. | Day 1 | 2910 | 7 | 0.658 | 0.639 | 0.544 | +14.8% (+12.1%, +17.5%) | <0.001 | +17.2% (+14.5%, +20.1%) | <0.001 | +8.9% | <0.001 | 76% |
| Max temp. | Day 3 | 3209 | 6 | 0.837 | 0.805 | 0.713 | +11.3% (+8.4%, +14.2%) | <0.001 | +14.8% (+11.8%, +17.7%) | <0.001 | +5.9% | 0.015 | 78% |
| Max temp. | Day 5 | 3216 | 6 | 1.063 | 1.021 | 0.946 | +7.4% (+3.3%, +11.0%) | 0.012 | +11.0% (+7.2%, +14.3%) | <0.001 | +3.4% | 0.199 | 76% |
| Max temp. | Day 7 | 3328 | 5 | 1.399 | 1.338 | 1.277 | +4.5% (+1.5%, +7.9%) | 0.021 | +8.7% (+5.7%, +11.8%) | <0.001 | +1.7% | 0.347 | 76% |
| Mean temp. | Day 1 | 2910 | 7 | 0.410 | 0.401 | 0.341 | +15.0% (+11.3%, +17.9%) | <0.001 | +16.9% (+13.4%, +19.8%) | <0.001 | +5.5% | 0.025 | 74% |
| Mean temp. | Day 3 | 3209 | 6 | 0.563 | 0.548 | 0.479 | +12.5% (+8.9%, +15.8%) | <0.001 | +14.8% (+11.4%, +18.0%) | <0.001 | +3.3% | 0.183 | 75% |
| Mean temp. | Day 5 | 3216 | 6 | 0.737 | 0.710 | 0.671 | +5.5% (+2.1%, +9.3%) | 0.078 | +8.9% (+5.8%, +12.6%) | 0.002 | -0.5% | 0.867 | 75% |
| Mean temp. | Day 7 | 3328 | 5 | 1.014 | 0.970 | 0.944 | +2.7% (+0.4%, +5.5%) | 0.163 | +6.9% (+4.7%, +9.5%) | <0.001 | -1.9% | 0.265 | 74% |
| Precip. | Day 1 | 3222 | 7 | 1.187 | 1.219 | 1.160 | +4.9% (+3.0%, +6.9%) | <0.001 | +2.3% (+1.4%, +3.2%) | <0.001 | +3.6% | 0.001 | 83% |
| Precip. | Day 3 | 3248 | 6 | 1.485 | 1.505 | 1.459 | +3.1% (+1.4%, +4.8%) | 0.001 | +1.8% (+1.1%, +2.5%) | <0.001 | +2.0% | 0.026 | 82% |
| Precip. | Day 5 | 3296 | 6 | 1.745 | 1.799 | 1.724 | +4.2% (+2.9%, +5.7%) | <0.001 | +1.2% (+0.4%, +2.1%) | 0.008 | +3.9% | <0.001 | 79% |
| Precip. | Day 7 | 3328 | 5 | 2.042 | 2.111 | 2.019 | +4.4% (+2.9%, +5.8%) | <0.001 | +1.1% (+0.5%, +1.9%) | 0.008 | +4.0% | <0.001 | 80% |

*Units: °C for temperature, mm for precipitation. m = members in the raw ensemble.*

> Figure 1. CRPS of daily maximum temperature by lead: Astraeus v2, the raw ensemble, the zero-training Gaussian and climatology (confirmation period). — interactive version in the app (`#report`).

4.4 Calibration. Judged consistently from the PIT, the raw ensemble is over-dispersive at short leads — its 80% interval held 88% of day-1 maximum-temperature observations, falling to 82% at day 7 — because model disagreement exceeds the error of the best models. Astraeus v2 is mildly under-dispersive: its 80% intervals covered 76%–78% (maximum) and 74%–75% (mean temperature), with 13%–14% of maximum-temperature observations below its 10th percentile, reflecting a small warm bias. Its gains therefore come from bias correction and skill weighting, not from better dispersion; a dispersion correction is the obvious next step and will be tested prospectively. For precipitation, v2’s coverage was 79%–83% and its Brier skill for rain ≥ 1 mm against climatology was 61% at day 1 and 22% at day 7.

**Table 4. Calibration: PIT-based central 80% coverage of the raw ensemble, the zero-training Gaussian and v2; share of observations below v2’s 10th and above its 90th percentile (10% each if calibrated); fair CRPS of the raw ensemble beside v2’s CRPS.**

| Variable | Lead | Cov. raw | Cov. Gauss | Cov. v2 | v2 < p10 | v2 > p90 | Fair CRPS raw | CRPS v2 |
|---|---|---|---|---|---|---|---|---|
| Max temp. | Day 1 | 88% | 85% | 76% | 14% | 10% | 0.545 | 0.544 |
| Max temp. | Day 3 | 86% | 82% | 78% | 13% | 9% | 0.678 | 0.713 |
| Max temp. | Day 5 | 83% | 77% | 76% | 14% | 10% | 0.883 | 0.946 |
| Max temp. | Day 7 | 82% | 73% | 76% | 14% | 10% | 1.138 | 1.277 |
| Mean temp. | Day 1 | 91% | 89% | 74% | 16% | 11% | 0.333 | 0.341 |
| Mean temp. | Day 3 | 86% | 83% | 75% | 14% | 11% | 0.452 | 0.479 |
| Mean temp. | Day 5 | 84% | 78% | 75% | 14% | 11% | 0.610 | 0.671 |
| Mean temp. | Day 7 | 81% | 72% | 74% | 15% | 11% | 0.829 | 0.944 |
| Precip. | Day 1 | 83% | 79% | 83% | 9% | 9% | 0.999 | 1.160 |
| Precip. | Day 3 | 83% | 76% | 82% | 9% | 9% | 1.248 | 1.459 |
| Precip. | Day 5 | 81% | 73% | 79% | 11% | 10% | 1.479 | 1.724 |
| Precip. | Day 7 | 81% | 70% | 80% | 11% | 9% | 1.694 | 2.019 |

*The fair CRPS estimates the score of an unlimited ensemble drawn from the same distribution as the members [@ferro2014-fair-crps]. It is not an issuable forecast, and multi-model members are not exchangeable draws, so it is indicative only; by this measure the raw ensemble is comparable to v2 for temperature (day-1 maximum: 0.545 vs 0.544 °C).*

> Figure 2. Reliability of day-1 probability of precipitation ≥ 1 mm, Astraeus v2 vs the raw ensemble. — interactive version in the app (`#report`).

4.5 Regions. Gains are heterogeneous. For day-3 maximum temperature the largest improvements over the raw ensemble were at Mato Grosso · Brazil (+36%), Daloa · Côte d’Ivoire (+31%), New South Wales · Australia (+21%) and the smallest at Northeast · United States (+5%), Paraná · Brazil (+4%), Iowa · US Corn Belt (+1%); the pattern does not follow a simple terrain or coastline explanation and is not interpreted further. For precipitation, v2 was worse than the raw ensemble in 22 of 64 region–lead cells, so its small average gain is not uniform.

4.6 Individual models. ECMWF AIFS had the lowest mean absolute error in 12 of 12 variable–lead combinations (day-3 maximum temperature: ECMWF AIFS 1.12 °C, DWD ICON 1.38 °C, ECMWF IFS 1.44 °C). Because AIFS is trained on ERA5, verification against ERA5 is expected to favour it (Lang et al., 2024; Rasp et al., 2024); ECMWF reports AIFS ahead of IFS by roughly a third of a forecast day in its own verification (Haiden et al., 2026). Skill weighting lets v2 lean on such models when their recent record warrants it.

> Figure 3. Single-model mean absolute error, day-3 maximum temperature, confirmation period. — interactive version in the app (`#report`).

4.7 Weather information and futures returns. In a walk-forward study of weekly futures returns for 6 weather-sensitive commodities, weather information improved out-of-sample forecasts over a market-only model in 6 of 34 commodity–information–horizon cells (point estimates); after Benjamini–Hochberg correction the only surviving cell is Natural gas (Henry Hub) with NWP forecasts known at origin at 1 week (R² gain over the market-only model +6.7%, Clark–West q = 0.004), which nevertheless did not significantly beat a no-change forecast (Diebold–Mariano p = 0.210; out-of-sample R² +7.1%, 95% CI -3.3% to +22.2%) and rests on 88 weeks.

**Table 5. Walk-forward price study: out-of-sample R² of the weather model vs the historical-mean benchmark, R² gain over the nested market-only model, Clark–West p-value and its Benjamini–Hochberg q-value, Diebold–Mariano p-value against a no-change forecast, and directional hit rate.**

| Commodity | Information | Horizon | N weeks | R² (weather) | R² gain vs market | p (CW) | q (BH) | p (DM vs no-change) | Hit rate |
|---|---|---|---|---|---|---|---|---|---|
| Corn | realised weather, lagged | 1 wk | 980 | -2.63% | -1.22% | 0.447 | 0.951 | 0.972 | 52.6% |
| Corn | realised weather, lagged | 4 wk | 974 | -6.42% | -4.55% | 0.626 | 0.951 | 0.947 | 53.9% |
| Corn | look-ahead diagnostic (realised holding-period weather) | 1 wk | 983 | -1.79% | -0.47% | 0.223 | 0.383 | 0.962 | 52.9% |
| Corn | look-ahead diagnostic (realised holding-period weather) | 4 wk | 977 | -1.06% | +0.62% | 0.108 | 0.223 | 0.807 | 53.8% |
| Corn | NWP forecasts known at origin | 1 wk | 87 | -17.65% | -11.24% | 0.802 | 0.951 | 0.984 | 46.0% |
| Corn | NWP forecasts known at origin | 4 wk | 81 | -29.00% | -7.23% | 0.661 | 0.951 | 0.989 | 32.1% |
| Soybeans | realised weather, lagged | 1 wk | 980 | -3.49% | -3.23% | 0.884 | 0.973 | 0.886 | 51.2% |
| Soybeans | realised weather, lagged | 4 wk | 974 | -13.83% | -9.20% | 0.821 | 0.951 | 0.947 | 51.5% |
| Soybeans | look-ahead diagnostic (realised holding-period weather) | 1 wk | 983 | +0.13% | +0.50% | 0.015 | 0.113 | 0.587 | 55.4% |
| Soybeans | look-ahead diagnostic (realised holding-period weather) | 4 wk | 977 | -3.92% | +0.09% | 0.026 | 0.113 | 0.951 | 53.1% |
| Soybeans | NWP forecasts known at origin | 1 wk | 87 | -17.53% | -15.00% | 0.715 | 0.951 | 0.950 | 44.8% |
| Soybeans | NWP forecasts known at origin | 4 wk | 81 | -27.08% | -27.87% | 0.819 | 0.951 | 0.974 | 49.4% |
| Wheat (Chicago SRW) | realised weather, lagged | 1 wk | 980 | -1.69% | -0.63% | 0.511 | 0.951 | 0.993 | 48.9% |
| Wheat (Chicago SRW) | realised weather, lagged | 4 wk | 974 | -6.10% | -2.85% | 0.955 | 0.981 | 0.998 | 49.1% |
| Wheat (Chicago SRW) | look-ahead diagnostic (realised holding-period weather) | 1 wk | 983 | -1.34% | -0.21% | 0.111 | 0.223 | 0.959 | 49.5% |
| Wheat (Chicago SRW) | look-ahead diagnostic (realised holding-period weather) | 4 wk | 977 | -5.81% | -2.52% | 0.618 | 0.742 | 0.989 | 48.6% |
| Wheat (Chicago SRW) | NWP forecasts known at origin | 1 wk | 87 | -24.17% | -21.96% | 0.386 | 0.951 | 0.994 | 46.0% |
| Wheat (Chicago SRW) | NWP forecasts known at origin | 4 wk | 81 | -14.87% | -16.09% | 0.318 | 0.951 | 0.897 | 53.1% |
| Arabica coffee | realised weather, lagged | 1 wk | 980 | -1.20% | -1.36% | 0.278 | 0.951 | 0.850 | 51.1% |
| Arabica coffee | realised weather, lagged | 4 wk | 974 | -1.44% | -1.90% | 0.981 | 0.981 | 0.843 | 50.1% |
| Arabica coffee | look-ahead diagnostic (realised holding-period weather) | 1 wk | 983 | -1.85% | -2.00% | 0.917 | 0.917 | 0.939 | 49.5% |
| Arabica coffee | look-ahead diagnostic (realised holding-period weather) | 4 wk | 977 | -1.52% | -2.09% | 0.597 | 0.742 | 0.836 | 51.4% |
| Arabica coffee | NWP forecasts known at origin | 1 wk | 87 | -4.21% | -1.83% | 0.624 | 0.951 | 0.926 | 54.0% |
| Arabica coffee | NWP forecasts known at origin | 4 wk | 81 | -16.66% | -3.38% | 0.379 | 0.951 | 0.983 | 44.4% |
| Natural gas (Henry Hub) | realised weather, lagged | 1 wk | 983 | -0.29% | -0.06% | 0.375 | 0.951 | 0.817 | 51.1% |
| Natural gas (Henry Hub) | realised weather, lagged | 4 wk | 977 | -0.38% | -0.22% | 0.808 | 0.951 | 0.807 | 50.3% |
| Natural gas (Henry Hub) | look-ahead diagnostic (realised holding-period weather) | 1 wk | 983 | -0.70% | -0.47% | 0.904 | 0.917 | 0.938 | 50.9% |
| Natural gas (Henry Hub) | look-ahead diagnostic (realised holding-period weather) | 4 wk | 977 | -1.07% | -0.90% | 0.028 | 0.113 | 0.779 | 53.5% |
| Natural gas (Henry Hub) | NWP forecasts known at origin | 1 wk | 88 | +7.13% | +6.71% | <0.001 | 0.004 | 0.210 | 58.0% |
| Natural gas (Henry Hub) | NWP forecasts known at origin | 4 wk | 82 | +9.80% | +5.01% | 0.034 | 0.374 | 0.499 | 53.7% |
| Cocoa | realised weather, lagged | 1 wk | 980 | -2.26% | -0.29% | 0.540 | 0.951 | 0.996 | 53.5% |
| Cocoa | realised weather, lagged | 4 wk | 974 | -4.46% | -0.47% | 0.674 | 0.951 | 0.972 | 52.2% |
| Cocoa | look-ahead diagnostic (realised holding-period weather) | 1 wk | 983 | -1.92% | -0.00% | 0.416 | 0.624 | 0.988 | 53.7% |
| Cocoa | look-ahead diagnostic (realised holding-period weather) | 4 wk | 977 | -3.58% | +0.50% | 0.111 | 0.223 | 0.942 | 53.4% |

*Out-of-sample R² is measured against the expanding historical mean (Campbell and Thompson); negative values mean the model forecast worse than that benchmark. The look-ahead diagnostic uses weather that was not known at the forecast origin and is not a tradable signal.*

> Figure 4. R² gain of weather-augmented over market-only models (● = BH q < 0.10). — interactive version in the app (`#report`).

## 5. Discussion

Temperature benefits most from post-processing because its errors are dominated by persistent biases and by large differences in skill between models, both of which a 90-day window can estimate. Compared with classical EMOS, v2 differs in two ways at once — inverse-MSE rather than equal member weights, and a 90-day rather than 40-day window — and the development results suggest both matter; with seven models and 40 days, parameter-rich fits over-fit (Gneiting et al., 2005; Lerch and Baran, 2017; Hagedorn et al., 2012). Part of the headline improvement over the raw ensemble is simply the conversion of five to seven point forecasts into a smooth distribution, which is why the zero-training Gaussian is the fairer reference for temperature.

Precipitation is harder: it is intermittent and skewed, and parametric censored models need longer or spatially pooled training to beat a good raw ensemble (Scheuerer and Hamill, 2015; Lerch and Baran, 2017). Skill weighting gives small average gains that are not uniform across regions; semi-local pooling is the natural next step.

Price predictability from weather is narrow. Markets incorporate realised weather quickly (Roll, 1984), so lagged realised weather adds little to weekly return forecasts, and even the look-ahead diagnostic did not forecast returns in a linear model, consistent with the forecastable part of weather being priced at the origin. Where evidence exists in the literature it concerns forecast information and revisions — especially for natural gas (Hsu et al., 2026; Monteux et al., 2025). The natural-gas result here is suggestive rather than established: it beats a market-only model but not a no-change forecast, on 88 weeks of a short archive, and must be re-tested as the archive grows. Astraeus therefore presents weather as conditional physical pressure with explicit invalidation criteria.

Limitations. ERA5 is a ~31 km reanalysis rather than station truth and favours smooth models; single grid points stand in for production regions; the confirmation period had been covered by an exploratory run and spans a single realisation of each season; v2 is mildly under-dispersive; the forecast-tier price sample is short; continuous futures contain roll jumps; and the free data sources used are licensed for non-commercial research.

Future work. A prospective evaluation of forecasts issued after the method freeze; a dispersion-corrected v3 developed on the development period only; station verification (e.g. GHCN-Daily); production-weighted areal forecasts; semi-local precipitation post-processing; ensemble members (ECMWF ENS, GEFS) as predictors; and crop-stage-aware price features.

## 6. Reproducibility and revision history

- npx tsx research/weather-benchmark.ts --suite run1 --period dev --offline — the first run replayed on development days.
- npx tsx research/weather-benchmark.ts --suite dev --period dev --offline — development comparison.
- npx tsx research/weather-benchmark.ts --suite final --period confirm --offline — the confirmation result (public/research/weather-skill.json).
- npx tsx research/weather-benchmark.ts --suite final --period prospective — the prospective test, once forecasts after the freeze have verified.
- npx tsx research/price-study.ts --offline --end=2026-11-14 — the price study (public/research/price-skill.json).
- npm test — unit tests, including closed-form CRPS against numerical integration, PIT-based coverage of calibrated forecasts, and synthetic recovery tests for every method.
- npx tsx research/build-report.ts — regenerates this report as docs/TECHNICAL_REPORT.md from the same result files.

Revision 2 follows an independent code review of the benchmark. Interval coverage was previously read from interpolated ensemble quantiles, which understates coverage for small ensembles and had reversed the calibration conclusion; it is now taken from the PIT for every method. The bootstrap now resamples the pooled estimand, Diebold–Mariano tests weight days by their number of cases, a zero-training Gaussian baseline and fair CRPS were added, the live outlook was aligned with the benchmark (per-day leads 1–6, ≥ 90% availability, ≥ 60 training days), and several sentences were corrected. The forecasting method itself was not changed.

## References

- Peter Bauer, Alan Thorpe, Gilbert Brunet (2015). The quiet revolution of numerical weather prediction. *Nature, 525(7567), 47–55*. https://doi.org/10.1038/nature14956
- Yoav Benjamini, Yosef Hochberg (1995). Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing. *Journal of the Royal Statistical Society Series B, 57(1), 289–300*. https://doi.org/10.1111/j.2517-6161.1995.tb02031.x
- Kaifeng Bi, Lingxi Xie, Hengheng Zhang, Xin Chen, Xiaotao Gu, Qi Tian (2023). Accurate medium-range global weather forecasting with 3D neural networks. *Nature, 619(7970), 533–538*. https://doi.org/10.1038/s41586-023-06185-3
- Jacob Boudoukh, Matthew Richardson, YuQing (Jeff) Shen, Robert F. Whitelaw (2007). Do asset prices reflect fundamentals? Freshly squeezed evidence from the OJ market. *Journal of Financial Economics, 83(2), 397–412*. https://doi.org/10.1016/j.jfineco.2004.06.017
- John Y. Campbell, Samuel B. Thompson (2008). Predicting Excess Stock Returns Out of Sample: Can Anything Beat the Historical Average?. *Review of Financial Studies, 21(4), 1509–1531*. https://doi.org/10.1093/rfs/hhm055
- Todd E. Clark, Kenneth D. West (2007). Approximately normal tests for equal predictive accuracy in nested models. *Journal of Econometrics, 138(1), 291–311*. https://doi.org/10.1016/j.jeconom.2006.05.023
- Francis X. Diebold, Roberto S. Mariano (1995). Comparing Predictive Accuracy. *Journal of Business & Economic Statistics, 13(3), 253–263*. https://doi.org/10.1080/07350015.1995.10524599
- Manuel Gebetsberger, Jakob W. Messner, Georg J. Mayr, Achim Zeileis (2018). Estimation Methods for Nonhomogeneous Regression Models: Minimum Continuous Ranked Probability Score versus Maximum Likelihood. *Monthly Weather Review, 146(12), 4323–4338*. https://doi.org/10.1175/MWR-D-17-0364.1
- Tilmann Gneiting, Adrian E. Raftery, Anton H. Westveld, Tom Goldman (2005). Calibrated Probabilistic Forecasting Using Ensemble Model Output Statistics and Minimum CRPS Estimation. *Monthly Weather Review, 133(5), 1098–1118*. https://doi.org/10.1175/MWR2904.1
- Tilmann Gneiting, Adrian E. Raftery (2007). Strictly Proper Scoring Rules, Prediction, and Estimation. *Journal of the American Statistical Association, 102(477), 359–378*. https://doi.org/10.1198/016214506000001437
- Tilmann Gneiting, Fadoua Balabdaoui, Adrian E. Raftery (2007). Probabilistic Forecasts, Calibration and Sharpness. *Journal of the Royal Statistical Society Series B, 69(2), 243–268*. https://doi.org/10.1111/j.1467-9868.2007.00587.x
- Renate Hagedorn, Roberto Buizza, Thomas M. Hamill, Martin Leutbecher, T. N. Palmer (2012). Comparing TIGGE multimodel forecasts with reforecast-calibrated ECMWF ensemble forecasts. *Quarterly Journal of the Royal Meteorological Society, 138(668), 1814–1827*. https://doi.org/10.1002/qj.1895
- Thomas Haiden, Martin Janousek, Frederic Vitart, Michael Maier-Gerber, Cathy Wing Yi Li, Fernando Prates, Matthieu Chevallier (2026). Evaluation of ECMWF forecasts. *ECMWF Technical Memorandum No. 938 (September 2026)*. https://www.ecmwf.int/sites/default/files/elibrary/092026/81748-evaluation-of-ecmwf-forecasts.pdf
- Thomas M. Hamill (2001). Interpretation of Rank Histograms for Verifying Ensemble Forecasts. *Monthly Weather Review, 129(3), 550–560*. https://doi.org/10.1175/1520-0493(2001)129<0550:IORHFV>2.0.CO;2
- David Harvey, Stephen Leybourne, Paul Newbold (1997). Testing the equality of prediction mean squared errors. *International Journal of Forecasting, 13(2), 281–291*. https://doi.org/10.1016/S0169-2070(96)00719-4
- Hans Hersbach (2000). Decomposition of the Continuous Ranked Probability Score for Ensemble Prediction Systems. *Weather and Forecasting, 15(5), 559–570*. https://doi.org/10.1175/1520-0434(2000)015<0559:DOTCRP>2.0.CO;2
- Hans Hersbach, Bill Bell, Paul Berrisford, Shoji Hirahara et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society, 146(730), 1999–2049*. https://doi.org/10.1002/qj.3803
- Kuang-Chun Hsu, Sohee Park, Zhen Zhu (2026). Weather Forecasts, Forecast Revisions, and Natural Gas Price Discovery. *SSRN working paper (not peer-reviewed; an earlier SSRN version is 10.2139/ssrn.6985300)*. https://doi.org/10.2139/ssrn.7411255
- Alexander Jordan, Fabian Krüger, Sebastian Lerch (2019). Evaluating Probabilistic Forecasts with scoringRules. *Journal of Statistical Software, 90(12)*. https://doi.org/10.18637/jss.v090.i12
- T. N. Krishnamurti, C. M. Kishtawal, Timothy E. LaRow, David R. Bachiochi et al. (1999). Improved Weather and Seasonal Climate Forecasts from Multimodel Superensemble. *Science, 285(5433), 1548–1550*. https://doi.org/10.1126/science.285.5433.1548
- Remi Lam, Alvaro Sanchez-Gonzalez, Matthew Willson, Peter Wirnsberger et al. (2023). Learning skillful medium-range global weather forecasting. *Science, 382(6677), 1416–1421*. https://doi.org/10.1126/science.adi2336
- Simon Lang, Mihai Alexe, Matthew Chantry, Jesper Dramsch et al. (2024). AIFS – ECMWF’s data-driven forecasting system. *arXiv preprint 2406.01465 (no journal version found as of 2026-11-15)*. https://doi.org/10.48550/arXiv.2406.01465
- Sebastian Lerch, Sándor Baran (2017). Similarity-Based Semilocal Estimation of Post-Processing Models. *Journal of the Royal Statistical Society Series C (Applied Statistics), 66(1), 29–51*. https://doi.org/10.1111/rssc.12153
- Jakob W. Messner, Georg J. Mayr, Daniel S. Wilks, Achim Zeileis (2014). Extending Extended Logistic Regression: Extended versus Separate versus Ordered versus Censored. *Monthly Weather Review, 142(8), 3003–3014*. https://doi.org/10.1175/MWR-D-13-00355.1
- Manou Monteux, Maria Cristina Arcuri, Gino Gandolfi, Stefano Caselli (2025). Can extreme weather forecasts lead to a risk premium? Evidence of a non-linear response in U.S. natural gas futures. *The North American Journal of Economics and Finance, 80, 102494*. https://doi.org/10.1016/j.najef.2025.102494
- Xiaoyi Mu (2007). Weather, storage, and natural gas price dynamics: Fundamentals and volatility. *Energy Economics, 29(1), 46–63*. https://doi.org/10.1016/j.eneco.2006.04.003
- M. Hashem Pesaran, Allan Timmermann (1992). A Simple Nonparametric Test of Predictive Performance. *Journal of Business & Economic Statistics, 10(4), 461–465*. https://doi.org/10.1080/07350015.1992.10509922
- Ilan Price, Alvaro Sanchez-Gonzalez, Ferran Alet, Tom R. Andersson et al. (2025). Probabilistic weather forecasting with machine learning. *Nature, 637(8044), 84–90 (published online 4 December 2024)*. https://doi.org/10.1038/s41586-024-08252-9
- Adrian E. Raftery, Tilmann Gneiting, Fadoua Balabdaoui, Michael Polakowski (2005). Using Bayesian Model Averaging to Calibrate Forecast Ensembles. *Monthly Weather Review, 133(5), 1155–1174*. https://doi.org/10.1175/MWR2906.1
- Stephan Rasp, Stephan Hoyer, Alexander Merose, Ian Langmore et al. (2024). WeatherBench 2: A Benchmark for the Next Generation of Data-Driven Global Weather Models. *Journal of Advances in Modeling Earth Systems, 16(6), e2023MS004019*. https://doi.org/10.1029/2023MS004019
- Michael J. Roberts, Wolfram Schlenker (2013). Identifying Supply and Demand Elasticities of Agricultural Commodities: Implications for the US Ethanol Mandate. *American Economic Review, 103(6), 2265–2295*. https://doi.org/10.1257/aer.103.6.2265
- Richard Roll (1984). Orange Juice and Weather. *American Economic Review, 74(5), 861–880 (JSTOR 549; no DOI)*. https://www.jstor.org/stable/549
- Michael Scheuerer, Thomas M. Hamill (2015). Statistical Postprocessing of Ensemble Precipitation Forecasts by Fitting Censored, Shifted Gamma Distributions. *Monthly Weather Review, 143(11), 4578–4596*. https://doi.org/10.1175/MWR-D-15-0061.1
- Wolfram Schlenker, Michael J. Roberts (2009). Nonlinear temperature effects indicate severe damages to U.S. crop yields under climate change. *Proceedings of the National Academy of Sciences, 106(37), 15594–15598*. https://doi.org/10.1073/pnas.0906865106
- Thordis L. Thorarinsdottir, Tilmann Gneiting (2010). Probabilistic Forecasts of Wind Speed: Ensemble Model Output Statistics by using Heteroscedastic Censored Regression. *Journal of the Royal Statistical Society Series A, 173(2), 371–388*. https://doi.org/10.1111/j.1467-985x.2009.00616.x
- Stéphane Vannitsem, John Bjørnar Bremnes, Jonathan Demaeyer, Gavin R. Evans et al. (2021). Statistical Postprocessing for Weather Forecasts: Review, Challenges, and Avenues in a Big Data World. *Bulletin of the American Meteorological Society, 102(3), E681–E699*. https://doi.org/10.1175/BAMS-D-19-0308.1
