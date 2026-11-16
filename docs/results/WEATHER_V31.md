# Astraeus v3.1: removing v3's pull toward the training window's mean temperature

Sections 1–5 are the **pre-specification**. They were written and committed on 2026-11-16, before either candidate was run on any period. Results are appended in later sections, and Sections 1–5 are not edited afterwards.

## 1. The problem

On 16 Nov 2026 the live outlook's local check was switched to a rolling design: weekly refits, each using only data available at issue time (ERA5 lag 6 days). It showed v3 doing worse than the raw multi-model ensemble on mean temperature in Texas (−6 to −33% CRPS skill, leads 1–6) and Lubbock (−2 to −38%). It also showed losses at several Arkansas, Iowa and Kansas leads. Each cell is 45 test days (2 Oct – 15 Nov 2026).

Decomposition of the same check (mean error, °C; `b` is v3's fitted slope, averaged over the weekly refits):

| Region | Variable | Lead | Skill vs raw | Mean error, raw ensemble | Mean error, v3 | b |
|---|---|---|---|---|---|---|
| Texas | Tmean | 1 / 3 / 5 | −6 / −28 / −18% | +0.09 / +0.16 / +0.13 | +0.32 / +0.63 / +0.73 | 0.93 / 0.88 / 0.86 |
| Texas | Tmax | 1 / 3 / 5 | +4 / −5 / −14% | −0.39 / −0.64 / −0.83 | +0.44 / +0.90 / +1.04 | 0.92 / 0.83 / 0.79 |
| Lubbock | Tmean | 1 / 3 / 5 | −18 / −38 / −29% | −0.08 / −0.09 / −0.07 | +0.38 / +0.34 / +0.57 | 0.96 / 0.97 / 0.95 |
| Arkansas | Tmax | 1 / 3 / 5 | −13 / −12 / −28% | −0.15 / 0.00 / −0.11 | +0.23 / +0.21 / +0.82 | 0.92 / 0.87 / 0.82 |

The raw ensemble mean is close to unbiased; v3 is 0.2–1.0 °C too warm. The per-model additive bias corrections are small (+0.0 to +0.7 °C). The warm error comes from the regression location μ = a + b·m̄ with b < 1. This pulls every forecast toward the mean temperature of the training window, which in autumn is the warmer late-summer weeks. In spring the pull runs the other way (too cold). In the Southern Hemisphere the seasons are reversed. Pooled over sites and seasons the errors partly cancel. That fits what Section 2 of `WEATHER_V3.md` found: a small pooled dev bias, and an April–November warm bias on confirmation.

These autumn 2026 days fall in the confirmation period (to 2026-11-08) and just after it. The confirmation period therefore motivated this fix and is not a clean test of it. The development period (test days October 2025 – March 2026) contains last autumn's transition and the late-winter warming, so the choice is made there. The clean test is prospective.

## 2. Why v3's pre-specification set this idea aside, and why it is tested now

`WEATHER_V3.md` Section 3 did not test anomalies from a day-of-year climatology, for three reasons. Each is answered here:

1. *"The closest variant, NGR with a climatology predictor, was worse on dev."* That variant adds a free coefficient g on (c − m̄). Within a 90-day window, c and m̄ move together through the seasonal cycle, so g is poorly identified and adds variance. Candidate D2 adds no parameter: it fixes g = 1 − b, which is exactly NGR fitted on anomalies.
2. *"The dev problem is in the tails."* v3 addressed the tails. The live problem is the location.
3. *"The live outlook has no day-of-year climatology for its training days."* True. If D2 wins, the live pipeline needs one new ERA5 climatology fetch per region (Section 5).

## 3. Candidates (temperature only; two)

Both are v3 (C6) unchanged in every other respect: logistic law, skill weights shrunk 25% toward equal on per-member bias-corrected members, 35-day recency half-life, κ from 5-fold blocked CV, the 90-day window, ERA5 lag 6 days, weekly refit. The κ refits use the candidate's own location model. With the location option at its default ('free'), the code must reproduce v3 bit for bit; a unit test checks this.

| ID | Candidate | Location μ | Parameters |
|---|---|---|---|
| D1 | `v31d1-unit-slope` | a + m̄ (b ≡ 1) | a, c, d (scale as v3) |
| D2 | `v31d2-clim-anchor` | a + b·m̄ + (1 − b)·c_t | a, b, c, d, the same count as v3 |

- **c_t**, the climatology of target date t, is the benchmark's existing climatology reference. It is the mean ERA5 daily value (`models=era5`, GMT days) over 2019–2024 for all days whose day of year is within ±7 days of t's. It is computed from data that predate every training and test day.
- **D2 is NGR on anomalies.** Subtracting c_t from members and truth leaves the per-member biases, skill weights, spread and CRPS objective unchanged and turns a + b·(m̄ − c) + c into the D2 location. A unit test checks the equivalence.
- **D1** removes the pull entirely. It needs no climatology, but it gives up the useful shrinkage toward normal at long leads, where model anomalies are noisy.
- **Rationale and prior work.** Fitting post-processing on anomalies from climatology, so that the seasonal cycle is not mistaken for forecast error, is standard. Examples are Scheuerer and Büermann (2014) and Dabernig et al. (2017), who use standardized anomalies. Lang et al. (2020) compare ways to adapt training to the season.
- **Precipitation is unchanged** (v2/v3 skill-weighted ensemble). The Arkansas rain losses in the same check rest on 8 wet days in 45. One of four leads reaches p < 0.05 (lead 5, p = 0.045, Diebold–Mariano), and none survives a multiplicity correction. On the confirmation period the same rain method beats the equal-weight raw ensemble (lead 1: −0.027 mm, p < 0.001). No rain candidate is run.

## 4. Selection rule (development period only)

Run: `npx tsx research/weather-benchmark.ts --suite v31dev --period dev --offline`.

1. **Metric.** Pooled dev temperature CRPS over the same cases as the v3 selection (Tmean and Tmax, leads 1/3/5/7, 16 sites, test days ≤ 2026-03-31). It is the days-weighted mean of the per-site/variable/lead mean CRPS (`bySite`). v3's value must reproduce 0.78946 °C in the same run.
2. **Eligibility.** Pooled dev PIT coverage in [77%, 83%].
3. **Winner.** The eligible candidate with the lowest pooled dev CRPS, provided it is lower than v3's by more than 0.0001 °C.
4. **Tie.** If D1 and D2 both qualify and differ by ≤ 0.0001 °C, D1 is chosen, because it needs no climatology.
5. **Otherwise keep v3.** No `astraeus-v3.1` is created, and the live outlook keeps v3 with the problem disclosed.
6. **No early look.** No candidate's confirmation number is computed before the freeze commit. Only the frozen winner is scored on confirmation, once, by appending it to the `final` suite with its own PIT stream; every existing method's confirmation numbers must reproduce `weather-skill.json` exactly.
7. **Reported, not used for selection.** Each cell's dev CRPS, coverage, tail shares and bias.

## 5. Live-adoption rule (written before the confirmation scoring)

The live outlook switches from v3 to v3.1 only if both of these hold, pooled over the eight temperature cells of the confirmation period:

- CRPS(v3.1) ≤ CRPS(v3) = 0.74099 °C; and
- |coverage(v3.1) − 80%| ≤ |coverage(v3) − 80%| + 0.5 pp. v3 covers 78.1%, so v3.1 must cover at least 77.6%, or no more than 82.4%.

If D2 is adopted, the live pipeline fetches ERA5 2019–2024 daily Tmean and Tmax at the region's sample points once, stores the series and builds c_t exactly as above, as the areal mean over the points. The outlook's `version` field names the method actually used. The rolling local check on the saved live inputs (Texas, Lubbock, Arkansas, Iowa, Kansas, Mato Grosso, Minas Gerais, Saskatchewan, Florida; 16 Nov) is reported for v3 and v3.1. These are the data that motivated the change, so they illustrate the fix and do not test it.

## References

- Dabernig, M., Mayr, G. J., Messner, J. W. and Zeileis, A. (2017). Spatial ensemble post-processing with standardized anomalies. *Quarterly Journal of the Royal Meteorological Society* 143, 909–916. https://doi.org/10.1002/qj.2975
- Lang, M. N., Lerch, S., Mayr, G. J., Simon, T., Stauffer, R. and Zeileis, A. (2020). Remember the past: a comparison of time-adaptive training schemes for non-homogeneous regression. *Nonlinear Processes in Geophysics* 27, 23–34. https://doi.org/10.5194/npg-27-23-2020
- Scheuerer, M. and Büermann, L. (2014). Spatially adaptive post-processing of ensemble forecasts for temperature. *Journal of the Royal Statistical Society C* 63, 405–422. https://doi.org/10.1111/rssc.12040
