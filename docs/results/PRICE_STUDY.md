# Does weather information predict commodity futures returns?

*Astraeus price study (`astraeus-weather-price-walkforward-v1`). Generated 2026-11-15T23:53:54.093Z from `npx tsx research/price-study.ts`. Machine-readable results: `public/research/price-skill.json`.*

## Question

Weather shocks move agricultural and energy supply and demand, and futures prices react to weather news (Roll 1984; Roberts & Schlenker 2013; Mu 2007). The forecasting question is narrower: **given only information available at the close on Friday, do weather variables improve out-of-sample forecasts of the next 1-week or 4-week futures return** relative to (i) a no-change random walk, (ii) the expanding historical mean, and (iii) a market-only model?

## Design

- **Instruments:** Corn (ZC=F), Soybeans (ZS=F), Wheat (Chicago SRW) (ZW=F), Arabica coffee (KC=F), Natural gas (Henry Hub) (NG=F), Cocoa (CC=F). Daily closes from the Yahoo Finance chart endpoint, continuous front-month series, sampled at the last session of each Friday-ending week. Target: log return from origin close to the close h weeks later.
- **Weather:** ERA5 reanalysis (Hersbach et al. 2020) daily values via Open-Meteo at representative production or demand coordinates (equal-weighted). Extreme degree-days use single-sine within-day interpolation (Baskerville & Emin 1969) above 29 °C (corn) / 30 °C (soybeans, wheat), following the non-linear yield response in Schlenker & Roberts (2009). Natural gas uses heating + cooling degree-days at base 18 °C. Anomalies are standardised against the same calendar window in up to 10 **prior** years (minimum 5). Crop features are season-gated (zero outside the stated months).
- **Three information sets (tiers):**
  1. **Realised, lagged** (2005-01-07 onward): ERA5 windows ending 7 days before the origin (ERA5 publication latency is about five days). Tradable information.
  2. **ORACLE** (same period): realised ERA5 over the *target* window (origin + 1 … origin + 7h days). This is look-ahead **by design**: it measures how much of the return a perfect weather forecast could explain, an upper bound for any forecast-based signal. It is not a forecast and is never mixed into the forecastable family.
  3. **NWP forecast** (2024-03-08 onward): ECMWF IFS (and GFS for natural gas) archived forecasts from the Open-Meteo Previous Runs API. Features are the anomaly of days +1…+6 taken from runs initialised at least one day before the origin (lead k+1 for day k), and the forecast revision (newest admissible lead minus the lead-7 forecast for the same target days).
- **Models:** RW (zero return); HM (expanding historical mean); MKT (ridge on 1-week return, 4-week return and 12-week realised volatility); WX (MKT + tier weather features, nesting MKT). Ridge penalty λ = 0.1 × n_train on standardised predictors, fixed ex ante. Predictors are standardised with training-window statistics only.
- **Walk-forward:** expanding window refit every week; a training example is admissible only once its target return is fully realised before the origin, so overlapping 4-week targets cannot leak. Minimum training: 156 weeks (long tiers), 52 weeks (NWP tier).
- **Evaluation:** out-of-sample R² vs HM (Campbell & Thompson 2008); RMSE ratio vs RW; Diebold–Mariano (1995) test of WX vs RW with Newey–West HAC variance and the Harvey, Leybourne & Newbold (1997) correction; Clark & West (2007) test of WX vs nested MKT (the primary test of whether weather adds information); Pesaran & Timmermann (1992) directional test; circular moving-block bootstrap 95% interval for R²os (1000 resamples, seed 20261115). All p-values are one-sided (H1: the weather model is better). **Benjamini & Hochberg (1995) q-values** are computed across the forecastable family (lagged + NWP rows) and separately for the oracle family.

## Results — forecastable information

| Commodity | Tier | h (wk) | OOS n | OOS window | R²os wx | 95% CI | R²os mkt | RMSE wx/RW | DM p (wx<RW) | q | CW p (wx>mkt) | q | Hit wx | Up-rate | PT p |
|---|---|---:|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Corn | Realised ERA5, 7-day lag | 1 | 980 | 2008-02-01…2026-11-06 | -2.63% | [-5.9, 0.2]% | -1.39% | 1.016 | 0.972 | 0.998 | 0.447 | 0.951 | 52.6% | 52.0% | 0.152 |
| Corn | Realised ERA5, 7-day lag | 4 | 974 | 2008-02-22…2026-10-16 | -6.42% | [-16.6, 1.4]% | -1.79% | 1.044 | 0.947 | 0.998 | 0.626 | 0.951 | 53.9% | 53.4% | 0.068 |
| Corn | NWP forecast + revision | 1 | 87 | 2025-03-07…2026-11-06 | -17.65% | [-35.5, -4.7]% | -5.76% | 1.091 | 0.984 | 0.998 | 0.802 | 0.951 | 46.0% | 49.4% | 0.775 |
| Corn | NWP forecast + revision | 4 | 81 | 2025-03-28…2026-10-16 | -29.00% | [-55.0, -7.5]% | -20.30% | 1.163 | 0.989 | 0.998 | 0.661 | 0.951 | 32.1% | 56.8% | 1.000 |
| Soybeans | Realised ERA5, 7-day lag | 1 | 980 | 2008-02-01…2026-11-06 | -3.49% | [-11.6, 2.5]% | -0.25% | 1.021 | 0.886 | 0.998 | 0.884 | 0.973 | 51.2% | 52.6% | 0.482 |
| Soybeans | Realised ERA5, 7-day lag | 4 | 974 | 2008-02-22…2026-10-16 | -13.83% | [-35.5, 1.4]% | -4.24% | 1.083 | 0.947 | 0.998 | 0.821 | 0.951 | 51.5% | 52.2% | 0.417 |
| Soybeans | NWP forecast + revision | 1 | 87 | 2025-03-07…2026-11-06 | -17.53% | [-38.4, 1.5]% | -2.20% | 1.094 | 0.950 | 0.998 | 0.715 | 0.951 | 44.8% | 59.8% | 0.696 |
| Soybeans | NWP forecast + revision | 4 | 81 | 2025-03-28…2026-10-16 | -27.08% | [-64.7, -1.0]% | 0.62% | 1.170 | 0.974 | 0.998 | 0.819 | 0.951 | 49.4% | 58.0% | 0.297 |
| Wheat (Chicago SRW) | Realised ERA5, 7-day lag | 1 | 980 | 2008-02-01…2026-11-06 | -1.69% | [-3.7, 0.0]% | -1.06% | 1.012 | 0.993 | 0.998 | 0.511 | 0.951 | 48.9% | 49.2% | 0.694 |
| Wheat (Chicago SRW) | Realised ERA5, 7-day lag | 4 | 974 | 2008-02-22…2026-10-16 | -6.10% | [-11.0, -1.7]% | -3.17% | 1.046 | 0.998 | 0.998 | 0.955 | 0.981 | 49.1% | 47.4% | 0.424 |
| Wheat (Chicago SRW) | NWP forecast + revision | 1 | 87 | 2025-03-07…2026-11-06 | -24.17% | [-45.7, -8.0]% | -1.81% | 1.120 | 0.994 | 0.998 | 0.386 | 0.951 | 46.0% | 50.6% | 0.774 |
| Wheat (Chicago SRW) | NWP forecast + revision | 4 | 81 | 2025-03-28…2026-10-16 | -14.87% | [-45.5, 9.9]% | 1.05% | 1.088 | 0.897 | 0.998 | 0.318 | 0.951 | 53.1% | 53.1% | 0.342 |
| Arabica coffee | Realised ERA5, 7-day lag | 1 | 980 | 2008-02-01…2026-11-06 | -1.20% | [-3.8, 0.9]% | 0.16% | 1.007 | 0.850 | 0.998 | 0.278 | 0.951 | 51.1% | 49.3% | 0.202 |
| Arabica coffee | Realised ERA5, 7-day lag | 4 | 974 | 2008-02-22…2026-10-16 | -1.44% | [-5.5, 2.6]% | 0.45% | 1.010 | 0.843 | 0.998 | 0.981 | 0.981 | 50.1% | 49.1% | 0.433 |
| Arabica coffee | NWP forecast + revision | 1 | 87 | 2025-03-07…2026-11-06 | -4.21% | [-13.7, 4.4]% | -2.33% | 1.047 | 0.926 | 0.998 | 0.624 | 0.951 | 54.0% | 42.5% | 0.087 |
| Arabica coffee | NWP forecast + revision | 4 | 81 | 2025-03-28…2026-10-16 | -16.66% | [-33.1, -0.1]% | -12.84% | 1.159 | 0.983 | 0.998 | 0.379 | 0.951 | 44.4% | 45.7% | 0.746 |
| Natural gas (Henry Hub) | Realised ERA5, 7-day lag | 1 | 983 | 2008-01-11…2026-11-06 | -0.29% | [-1.2, 0.7]% | -0.23% | 1.002 | 0.817 | 0.998 | 0.375 | 0.951 | 51.1% | 48.2% | 0.335 |
| Natural gas (Henry Hub) | Realised ERA5, 7-day lag | 4 | 977 | 2008-02-01…2026-10-16 | -0.38% | [-2.5, 1.9]% | -0.16% | 1.006 | 0.807 | 0.998 | 0.808 | 0.951 | 50.3% | 48.5% | 0.628 |
| Natural gas (Henry Hub) | NWP forecast + revision | 1 | 88 | 2025-03-07…2026-11-06 | 7.13% | [-3.3, 22.2]% | 0.46% | 0.976 | 0.210 | 0.998 | <0.001 | 0.004 | 58.0% | 39.8% | 0.027 |
| Natural gas (Henry Hub) | NWP forecast + revision | 4 | 82 | 2025-03-28…2026-10-16 | 9.80% | [-28.7, 36.5]% | 5.05% | 1.000 | 0.499 | 0.998 | 0.034 | 0.374 | 53.7% | 50.0% | 0.229 |
| Cocoa | Realised ERA5, 7-day lag | 1 | 980 | 2008-02-01…2026-11-06 | -2.26% | [-3.9, -0.5]% | -1.96% | 1.012 | 0.996 | 0.998 | 0.540 | 0.951 | 53.5% | 52.6% | 0.028 |
| Cocoa | Realised ERA5, 7-day lag | 4 | 974 | 2008-02-22…2026-10-16 | -4.46% | [-9.4, 0.5]% | -3.97% | 1.026 | 0.972 | 0.998 | 0.674 | 0.951 | 52.2% | 52.2% | 0.121 |

## Results — ORACLE upper bound (not a forecast)

| Commodity | Tier | h (wk) | OOS n | OOS window | R²os wx | 95% CI | R²os mkt | RMSE wx/RW | DM p (wx<RW) | q | CW p (wx>mkt) | q | Hit wx | Up-rate | PT p |
|---|---|---:|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Corn | ORACLE (future weather) | 1 | 983 | 2008-01-04…2026-10-30 | -1.79% | [-4.1, 0.5]% | -1.31% | 1.011 | 0.962 | 0.989 | 0.223 | 0.383 | 52.9% | 52.1% | 0.099 |
| Corn | ORACLE (future weather) | 4 | 977 | 2008-01-25…2026-10-09 | -1.06% | [-6.9, 5.4]% | -1.69% | 1.016 | 0.807 | 0.989 | 0.108 | 0.223 | 53.8% | 53.6% | 0.090 |
| Soybeans | ORACLE (future weather) | 1 | 983 | 2008-01-04…2026-10-30 | 0.13% | [-4.3, 3.8]% | -0.37% | 1.002 | 0.587 | 0.989 | 0.015 | 0.113 | 55.4% | 52.5% | 0.001 |
| Soybeans | ORACLE (future weather) | 4 | 977 | 2008-01-25…2026-10-09 | -3.92% | [-13.0, 4.2]% | -4.01% | 1.033 | 0.951 | 0.989 | 0.026 | 0.113 | 53.1% | 52.3% | 0.070 |
| Wheat (Chicago SRW) | ORACLE (future weather) | 1 | 983 | 2008-01-04…2026-10-30 | -1.34% | [-3.5, 0.8]% | -1.12% | 1.010 | 0.959 | 0.989 | 0.111 | 0.223 | 49.5% | 49.1% | 0.495 |
| Wheat (Chicago SRW) | ORACLE (future weather) | 4 | 977 | 2008-01-25…2026-10-09 | -5.81% | [-12.7, 0.5]% | -3.21% | 1.043 | 0.989 | 0.989 | 0.618 | 0.742 | 48.6% | 47.6% | 0.595 |
| Arabica coffee | ORACLE (future weather) | 1 | 983 | 2008-01-04…2026-10-30 | -1.85% | [-4.6, 0.3]% | 0.15% | 1.010 | 0.939 | 0.989 | 0.917 | 0.917 | 49.5% | 49.3% | 0.576 |
| Arabica coffee | ORACLE (future weather) | 4 | 977 | 2008-01-25…2026-10-09 | -1.52% | [-5.8, 2.6]% | 0.56% | 1.011 | 0.836 | 0.989 | 0.597 | 0.742 | 51.4% | 49.3% | 0.175 |
| Natural gas (Henry Hub) | ORACLE (future weather) | 1 | 983 | 2008-01-04…2026-10-30 | -0.70% | [-1.7, 0.3]% | -0.23% | 1.004 | 0.938 | 0.989 | 0.904 | 0.917 | 50.9% | 48.2% | 0.417 |
| Natural gas (Henry Hub) | ORACLE (future weather) | 4 | 977 | 2008-01-25…2026-10-09 | -1.07% | [-5.3, 3.3]% | -0.17% | 1.009 | 0.779 | 0.989 | 0.028 | 0.113 | 53.5% | 48.5% | 0.021 |
| Cocoa | ORACLE (future weather) | 1 | 983 | 2008-01-04…2026-10-30 | -1.92% | [-3.5, -0.3]% | -1.92% | 1.010 | 0.988 | 0.989 | 0.416 | 0.624 | 53.7% | 52.7% | 0.021 |
| Cocoa | ORACLE (future weather) | 4 | 977 | 2008-01-25…2026-10-09 | -3.58% | [-8.8, 1.4]% | -4.10% | 1.021 | 0.942 | 0.989 | 0.111 | 0.223 | 53.4% | 52.4% | 0.028 |

## Contemporaneous and lagged sensitivity (in-sample, descriptive, 1-week horizon)

Full-sample OLS of weekly log returns on season-gated, standardised weather features, with Newey–West HAC t-statistics. Coefficients are % return per one-standard-deviation anomaly. This describes association, not forecast skill.

| Commodity | Tier | Feature | % return per SD | HAC t | p (two-sided) |
|---|---|---|---:|---:|---:|
| Corn | Realised ERA5, 7-day lag | Extreme degree-days >29 °C (7-day) | 0.193 | 0.98 | 0.328 |
| Corn | Realised ERA5, 7-day lag | Precipitation (28-day) | 0.221 | 1.55 | 0.121 |
| Corn | ORACLE (future weather) | Extreme degree-days >29 °C (7-day) | 0.092 | 0.65 | 0.518 |
| Corn | ORACLE (future weather) | Precipitation (28-day) | -0.233 | -1.80 | 0.073 |
| Corn | NWP forecast + revision | Extreme degree-days >29 °C: forecast anomaly (days +1…+6) | -0.468 | -1.23 | 0.218 |
| Corn | NWP forecast + revision | Extreme degree-days >29 °C: forecast revision (lead k+1 minus lead 7) | 0.342 | 0.73 | 0.466 |
| Corn | NWP forecast + revision | Precipitation: forecast anomaly (days +1…+6) | -0.057 | -0.20 | 0.844 |
| Corn | NWP forecast + revision | Precipitation: forecast revision (lead k+1 minus lead 7) | -0.013 | -0.03 | 0.977 |
| Soybeans | Realised ERA5, 7-day lag | Extreme degree-days >30 °C (7-day, US) | 0.126 | 1.22 | 0.221 |
| Soybeans | Realised ERA5, 7-day lag | Precipitation (28-day, US) | 0.073 | 0.58 | 0.561 |
| Soybeans | Realised ERA5, 7-day lag | Precipitation (28-day, Mato Grosso) | 0.100 | 1.24 | 0.216 |
| Soybeans | ORACLE (future weather) | Extreme degree-days >30 °C (7-day, US) | 0.147 | 1.66 | 0.096 |
| Soybeans | ORACLE (future weather) | Precipitation (28-day, US) | -0.264 | -2.39 | 0.017 |
| Soybeans | ORACLE (future weather) | Precipitation (28-day, Mato Grosso) | 0.155 | 1.71 | 0.088 |
| Soybeans | NWP forecast + revision | Extreme degree-days >30 °C (US): forecast anomaly (days +1…+6) | 0.136 | 0.38 | 0.705 |
| Soybeans | NWP forecast + revision | Extreme degree-days >30 °C (US): forecast revision (lead k+1 minus lead 7) | -0.271 | -1.57 | 0.116 |
| Soybeans | NWP forecast + revision | Precipitation (US): forecast anomaly (days +1…+6) | -0.561 | -1.95 | 0.052 |
| Soybeans | NWP forecast + revision | Precipitation (US): forecast revision (lead k+1 minus lead 7) | 0.538 | 1.38 | 0.168 |
| Wheat (Chicago SRW) | Realised ERA5, 7-day lag | Precipitation (28-day, Kansas) | 0.035 | 0.24 | 0.809 |
| Wheat (Chicago SRW) | Realised ERA5, 7-day lag | Extreme degree-days >30 °C (7-day, Kansas) | -0.233 | -1.84 | 0.066 |
| Wheat (Chicago SRW) | Realised ERA5, 7-day lag | Precipitation (28-day, Beauce) | -0.059 | -0.37 | 0.713 |
| Wheat (Chicago SRW) | ORACLE (future weather) | Precipitation (28-day, Kansas) | -0.192 | -1.60 | 0.110 |
| Wheat (Chicago SRW) | ORACLE (future weather) | Extreme degree-days >30 °C (7-day, Kansas) | -0.375 | -2.21 | 0.027 |
| Wheat (Chicago SRW) | ORACLE (future weather) | Precipitation (28-day, Beauce) | -0.048 | -0.39 | 0.698 |
| Wheat (Chicago SRW) | NWP forecast + revision | Precipitation (Kansas): forecast anomaly (days +1…+6) | -0.574 | -1.34 | 0.179 |
| Wheat (Chicago SRW) | NWP forecast + revision | Precipitation (Kansas): forecast revision (lead k+1 minus lead 7) | -0.588 | -1.58 | 0.115 |
| Wheat (Chicago SRW) | NWP forecast + revision | Extreme degree-days >30 °C (Kansas): forecast anomaly (days +1…+6) | -0.136 | -0.69 | 0.492 |
| Wheat (Chicago SRW) | NWP forecast + revision | Extreme degree-days >30 °C (Kansas): forecast revision (lead k+1 minus lead 7) | 0.126 | 0.38 | 0.705 |
| Arabica coffee | Realised ERA5, 7-day lag | Cold degree-days below 6 °C Tmin (7-day) | -0.091 | -0.94 | 0.349 |
| Arabica coffee | Realised ERA5, 7-day lag | Precipitation (28-day) | 0.021 | 0.14 | 0.891 |
| Arabica coffee | ORACLE (future weather) | Cold degree-days below 6 °C Tmin (7-day) | 0.226 | 1.43 | 0.154 |
| Arabica coffee | ORACLE (future weather) | Precipitation (28-day) | -0.011 | -0.09 | 0.931 |
| Arabica coffee | NWP forecast + revision | Cold degree-days below 6 °C Tmin: forecast anomaly (days +1…+6) | -0.161 | -0.43 | 0.666 |
| Arabica coffee | NWP forecast + revision | Precipitation: forecast anomaly (days +1…+6) | -0.419 | -1.14 | 0.254 |
| Arabica coffee | NWP forecast + revision | Precipitation: forecast revision (lead k+1 minus lead 7) | -0.036 | -0.11 | 0.910 |
| Natural gas (Henry Hub) | Realised ERA5, 7-day lag | HDD+CDD base 18 °C (7-day) | -0.184 | -0.87 | 0.383 |
| Natural gas (Henry Hub) | ORACLE (future weather) | HDD+CDD base 18 °C (7-day) | -0.124 | -0.58 | 0.563 |
| Natural gas (Henry Hub) | NWP forecast + revision | HDD+CDD base 18 °C: forecast anomaly (days +1…+6) | -2.571 | -3.11 | 0.002 |
| Natural gas (Henry Hub) | NWP forecast + revision | HDD+CDD base 18 °C: forecast revision (lead k+1 minus lead 7) | 1.842 | 2.72 | 0.007 |
| Cocoa | Realised ERA5, 7-day lag | Precipitation (28-day, Daloa + Kumasi) | -0.060 | -0.41 | 0.685 |
| Cocoa | ORACLE (future weather) | Precipitation (28-day, Daloa + Kumasi) | -0.169 | -1.18 | 0.238 |

## Interpretation

- Forecastable rows with positive out-of-sample R² for the weather model: **2 of 22**.
- Rows where weather adds information over the market-only model after Benjamini–Hochberg control (Clark–West q < 0.10): Natural gas (Henry Hub) / NWP forecast + revision / 1w (q = 0.004).
- ORACLE rows with the highest R²os: Soybeans 1w 0.13%, Natural gas (Henry Hub) 1w -0.70%, Corn 4w -1.06%. The gap between the oracle and the forecastable tiers bounds what better weather forecasts could add under this linear, equal-weighted design.
- Realised weather that is already a week old is public information when it is used; an efficient market should already price it, so a null result in that tier is the expected outcome rather than a failure of the method.
- The NWP tier covers only about 2.7 years, so its confidence intervals are wide. Treat its point estimates as exploratory until more archived forecasts accumulate.

## Limitations

- Continuous front-month (=F) Yahoo series contain roll jumps; weekly log returns are research proxies, not executable futures P&L.
- Yahoo Finance chart endpoint is unofficial and may revise or omit sessions.
- Weather points are equal-weighted representative coordinates, not production- or population-share weights.
- ERA5 is reanalysis (modelled), lagged 7 days to respect publication latency; the ORACLE tier deliberately uses future realised weather and is an upper bound, not a forecast.
- NWP tier uses Open-Meteo Previous Runs (from March 2024 only): ~2.7 years, so out-of-sample samples are small and crop features are active in only one or two seasons.
- NWP anomalies are measured against ERA5 climatology without model-bias correction; the ridge intercept absorbs only a constant bias.
- Many commodity × tier × horizon tests are run; Benjamini–Hochberg q-values are reported and should be used instead of raw p-values.
- Sensitivity coefficients are full-sample, in-sample descriptive regressions, not forecasts.
- No transaction costs, position sizing or trading rules are evaluated.

## Reproduce

```bash
npx tsx research/price-study.ts            # fetches missing data into research/cache/ (gitignored)
npx tsx research/price-study.ts --offline  # reruns from cache only
npx tsx --test src/engine/priceSkill.test.ts
```

Provider URL patterns, coordinates, the configuration and a SHA-256 of all inputs (`5d8da2928c8c9d90…`) are stored in `public/research/price-skill.json`.

## References

- Baskerville, G. L., & Emin, P. (1969). Rapid estimation of heat accumulation from maximum and minimum temperatures. *Ecology*, 50(3), 514–517. https://doi.org/10.2307/1933912
- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: A practical and powerful approach to multiple testing. *Journal of the Royal Statistical Society: Series B*, 57(1), 289–300. https://doi.org/10.1111/j.2517-6161.1995.tb02031.x
- Boudoukh, J., Richardson, M., Shen, Y., & Whitelaw, R. F. (2007). Do asset prices reflect fundamentals? Freshly squeezed evidence from the OJ market. *Journal of Financial Economics*, 83(2), 397–412. https://doi.org/10.1016/j.jfineco.2004.06.017
- Campbell, J. Y., & Thompson, S. B. (2008). Predicting excess stock returns out of sample: Can anything beat the historical average? *Review of Financial Studies*, 21(4), 1509–1531. https://doi.org/10.1093/rfs/hhm055
- Clark, T. E., & West, K. D. (2007). Approximately normal tests for equal predictive accuracy in nested models. *Journal of Econometrics*, 138(1), 291–311. https://doi.org/10.1016/j.jeconom.2006.05.023
- Diebold, F. X., & Mariano, R. S. (1995). Comparing predictive accuracy. *Journal of Business & Economic Statistics*, 13(3), 253–263. https://doi.org/10.1080/07350015.1995.10524599
- Harvey, D., Leybourne, S., & Newbold, P. (1997). Testing the equality of prediction mean squared errors. *International Journal of Forecasting*, 13(2), 281–291. https://doi.org/10.1016/S0169-2070(96)00719-4
- Hersbach, H., Bell, B., Berrisford, P., et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society*, 146(730), 1999–2049. https://doi.org/10.1002/qj.3803
- Künsch, H. R. (1989). The jackknife and the bootstrap for general stationary observations. *Annals of Statistics*, 17(3), 1217–1241. https://doi.org/10.1214/aos/1176347265
- Mu, X. (2007). Weather, storage, and natural gas price dynamics: Fundamentals and volatility. *Energy Economics*, 29(1), 46–63. https://doi.org/10.1016/j.eneco.2006.04.003
- Newey, W. K., & West, K. D. (1987). A simple, positive semi-definite, heteroskedasticity and autocorrelation consistent covariance matrix. *Econometrica*, 55(3), 703–708. https://doi.org/10.2307/1913610
- Newey, W. K., & West, K. D. (1994). Automatic lag selection in covariance matrix estimation. *Review of Economic Studies*, 61(4), 631–653. https://doi.org/10.2307/2297912
- Pesaran, M. H., & Timmermann, A. (1992). A simple nonparametric test of predictive performance. *Journal of Business & Economic Statistics*, 10(4), 461–465. https://doi.org/10.1080/07350015.1992.10509922
- Roberts, M. J., & Schlenker, W. (2013). Identifying supply and demand elasticities of agricultural commodities: Implications for the US ethanol mandate. *American Economic Review*, 103(6), 2265–2295. https://doi.org/10.1257/aer.103.6.2265
- Roll, R. (1984). Orange juice and weather. *American Economic Review*, 74(5), 861–880. (No DOI registered.)
- Schlenker, W., & Roberts, M. J. (2009). Nonlinear temperature effects indicate severe damages to U.S. crop yields under climate change. *Proceedings of the National Academy of Sciences*, 106(37), 15594–15598. https://doi.org/10.1073/pnas.0906865106
