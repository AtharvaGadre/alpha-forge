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

---

*Everything below was added after the pre-specification commit (87958e2, 2026-11-16T12:39:58Z).*

## 6. Development-period results and selection

**Run.** `npx tsx research/weather-benchmark.ts --suite v31dev --period dev --offline`, archived as `public/research/archive/weather-v31-dev.json` (generated 2026-11-16T12:41:01Z). v3 reproduces its published dev value exactly (0.78946 °C). No confirmation-period number of either candidate was computed.

**Pooled temperature, development period (22,144 cases):**

| Method | Pooled CRPS (°C) | Δ vs v3 | 80% coverage | below p10 | above p90 | bias (°C) |
|---|---|---|---|---|---|---|
| v3 (`astraeus-v3`) | 0.78946 | — | 77.4% | 11.6% | 11.0% | +0.033 |
| **D1 `v31d1-unit-slope`** | **0.76746** | **−0.02199 (−2.79%)** | **78.0%** | 10.9% | 11.1% | −0.020 |
| D2 `v31d2-clim-anchor` | 0.77111 | −0.01834 (−2.32%) | 78.0% | 11.0% | 11.0% | −0.013 |
| Zero-training Gaussian (reference) | 0.84939 | +0.05993 (+7.59%) | 80.0% | 8.8% | 11.1% | −0.060 |

**Per cell (CRPS °C / 80% coverage % / bias °C):**

| Cell | v3 | D1 | D2 |
|---|---|---|---|
| Tmean d1 | 0.337 / 78.6 / −0.024 | 0.338 / 78.4 / −0.024 | 0.339 / 78.1 / −0.015 |
| Tmean d3 | 0.472 / 76.9 / −0.016 | 0.465 / 77.0 / −0.025 | 0.473 / 77.3 / −0.024 |
| Tmean d5 | 0.692 / 77.3 / +0.006 | 0.670 / 77.8 / −0.022 | 0.682 / 77.9 / −0.029 |
| Tmean d7 | 1.058 / 76.4 / +0.051 | 1.016 / 77.5 / −0.029 | 1.033 / 76.9 / −0.017 |
| Tmax d1 | 0.580 / 78.3 / +0.040 | 0.575 / 79.0 / −0.001 | 0.573 / 79.4 / +0.013 |
| Tmax d3 | 0.775 / 77.2 / +0.028 | 0.757 / 78.2 / −0.013 | 0.759 / 78.4 / −0.009 |
| Tmax d5 | 1.017 / 77.5 / +0.053 | 0.983 / 78.4 / −0.014 | 0.984 / 78.0 / −0.018 |
| Tmax d7 | 1.415 / 77.1 / +0.133 | 1.364 / 77.9 / −0.031 | 1.355 / 77.8 / −0.006 |

**Selection (Section 4 rule).**

- Both candidates are eligible on coverage (78.0% each).
- Both lower pooled CRPS below v3's by far more than 0.0001 °C.
- D1's pooled CRPS is lower than D2's by 0.00365 °C, which is outside the 0.0001 °C tie band.
- **D1 is selected and frozen as `astraeus-v3.1`.** Its precipitation component is v3's (no rain candidate was run).

**What the dev numbers say, and do not say.**

- **The gain is at the longer leads.** Day 1 is unchanged (Tmean +0.3%, Tmax −0.9%). Days 5–7 improve by 3–4%: Tmean d7 1.058 → 1.016, Tmax d7 1.415 → 1.364. Why the gain grows with lead was not examined on dev.
- **The bias that grew with lead is gone.** v3's dev bias rose from +0.04 °C at Tmax day 1 to +0.13 °C at day 7. Under D1 it is between −0.03 and 0.00 °C at every lead.
- **Removing the pull beat redirecting it.** We expected D2 to win at long leads, where shrinking a noisy forecast toward normal usually helps. It won only at Tmax d1 and d7, and lost pooled. One reading is that a slope estimated from 90 recency-weighted days is itself too noisy to be useful. We did not test this.
- **For scale:** v3 gained 0.55% over v2 on dev and v3.1 gains 2.8% over v3. Both are dev-period numbers, and the candidates were chosen on dev.

- **Benchmark check.** On dev, `astraeus-v3.1` reproduces D1 exactly in every temperature cell. Its precipitation CRPS, bias, MAE and RMSE equal v3's in every cell, with 0 differences in `bySite`. The only differences are precipitation PIT coverage at leads 1/3/5/7: 82.3 / 81.4 / 81.2 / 79.0% for v3.1 against 81.4 / 80.6 / 81.1 / 80.0% for v3. This is randomisation noise: v3.1 draws its own randomised-PIT numbers for dry days. Run: `--suite raw-ensemble,astraeus-v3,v31d1-unit-slope,astraeus-v3.1 --period dev`.

## 7. Freeze

`astraeus-v3.1` is implemented as `ASTRAEUS_V31_TEMPERATURE` and `fitAstraeusV31` in `src/engine/weatherPostprocessing.ts`, predicted with `predictAstraeusV3`, with unit tests in `weatherPostprocessing.test.ts`. It is registered as `astraeus-v3.1` in `research/weather-benchmark.ts` and appended to the `final` suite after v3, with its own randomised-PIT stream, so every other method's scores are unchanged by its presence.

- **Freeze commit:** `73d0d441953a5da30515838522c4a007665c9b88` ("freeze astraeus-v3.1: …"), committed **2026-11-16T12:43:41Z**.
- Recorded before the confirmation period was scored. That is also before any prospective outcome exists: the first prospective target day is 2026-11-17, and ERA5 for it is published around 2026-11-22.

## 8. Confirmation period: scored once, after the freeze

**Run.** `npx tsx research/weather-benchmark.ts --suite final --period confirm --offline`, from commit d60467a (the freeze plus the freeze record). The cache was complete: no fetch, API cost 0. Output: `public/research/weather-skill.json` and `docs/results/WEATHER_BENCHMARK.md`.

**Integrity check.** We removed the `astraeus-v3.1` rows (12 summary rows, 48 significance rows, its `bySite` column and its `methods` entry) and `generatedAt`. The new file is then identical to the previously committed `weather-skill.json`, with 0 differences in any key.

**Pooled temperature, confirmation period (25,326 cases):**

| Method | Pooled CRPS (°C) | 80% coverage | below p10 | above p90 | bias (°C) |
|---|---|---|---|---|---|
| v2 | 0.75005 | 75.5% | 14.0% | 10.4% | +0.137 |
| v3 | 0.74099 | 78.1% | 12.7% | 9.1% | +0.116 |
| **v3.1** | **0.73638 (−0.62% vs v3)** | **78.4%** | 11.7% | 9.9% | **+0.042** |

**Per cell.** Columns: CRPS v3 → v3.1 (°C); CRPSS against the zero-training Gaussian, v3 / v3.1 (95% interval for v3.1); coverage; share below p10 and above p90; bias (°C); v3.1 − v3 daily CRPS difference with Diebold–Mariano p (14-day bandwidth / largest over bandwidths).

| Cell | CRPS v3 → v3.1 | CRPSS v3 / v3.1 | Coverage | < p10 | > p90 | Bias | v3.1 − v3 |
|---|---|---|---|---|---|---|---|
| Tmax d1 | 0.539 → 0.546 | +15.6 / +14.5% (+12.2, +16.8) | 78.0 → 78.1% | 12.7 → 11.0% | 9.3 → 11.0% | +0.089 → +0.013 | +0.007; 0.25 / 0.25 |
| Tmax d3 | 0.707 → 0.711 | +12.1 / +11.6% (+9.1, +14.1) | 78.8 → 78.6% | 12.4 → 11.3% | 8.8 → 10.1% | +0.113 → +0.025 | +0.004; 0.61 / 0.65 |
| Tmax d5 | 0.940 → 0.944 | +8.0 / +7.6% (+4.9, +10.4) | 78.7 → 78.0% | 12.9 → 11.9% | 8.4 → 10.2% | +0.162 → +0.051 | +0.004; 0.72 / 0.75 |
| Tmax d7 | 1.259 → 1.257 | +5.9 / +6.0% (+3.6, +8.5) | 77.9 → 78.0% | 13.3 → 12.4% | 8.8 → 9.6% | +0.228 → +0.099 | −0.002; 0.89 / 0.89 |
| Tmean d1 | 0.334 → 0.329 | +16.8 / +17.9% (+15.6, +19.7) | 77.7 → 78.3% | 13.0 → 12.0% | 9.4 → 9.7% | +0.056 → +0.026 | −0.005; 0.27 / 0.33 |
| Tmean d3 | 0.473 → 0.465 | +13.7 / +15.1% (+12.4, +17.8) | 78.8 → 79.1% | 11.8 → 11.3% | 9.4 → 9.5% | +0.053 → +0.016 | −0.008; 0.13 / 0.14 |
| Tmean d5 | 0.663 → 0.649 | +6.7 / +8.6% (+6.2, +11.6) | 77.6 → 78.6% | 12.8 → 11.7% | 9.6 → 9.7% | +0.077 → +0.041 | −0.014; 0.08 / 0.13 |
| Tmean d7 | 0.930 → 0.909 | +4.1 / +6.3% (+4.6, +8.3) | 77.6 → 78.5% | 13.0 → 12.1% | 9.4 → 9.4% | +0.136 → +0.060 | −0.022; 0.024 / 0.037 |

- **Against v3 directly** (`public/research/archive/weather-v31-vs-v3-dm.json`; not pre-specified; reproduce with `--versus-extra astraeus-v3`).
  - On confirmation, v3.1 is better at p < 0.05 only at Tmean day 7 (largest p 0.037). That cell does not survive a Holm correction for 8 tests, whose first threshold is p < 0.00625.
  - On dev, it is better at p < 0.05 in 5 of 8 cells: Tmean d5/d7 and Tmax d3/d5/d7. Three of those survive Holm: Tmean d7, Tmax d5 and Tmax d7.
  - The re-run's confirmation summary was byte-identical to the published one.
- **Against the zero-training Gaussian**, v3.1 is significant at p < 0.001 in all eight temperature cells.
- **Precipitation** is identical to v3 in CRPS, bias and CRPSS in every cell.

## 9. Live adoption

The Section 5 rule was applied to the confirmation numbers above:

- pooled temperature CRPS 0.73638 ≤ 0.74099 °C ✓;
- |78.4% − 80%| = 1.6 pp ≤ |78.1% − 80%| + 0.5 pp = 2.4 pp ✓.

The rule asks only for no loss, and v3's confirmation warm bias was already known. Passing it was therefore likely, which makes it a consistency check, not a test.

**The live outlook therefore switches to v3.1** (`OUTLOOK_METHOD_VERSION = 'astraeus-v3.1'` in `src/engine/calibratedOutlook.ts`; v3 and v2 stay selectable). No new data fetch is needed, because D1 uses no climatology.

**The live data that motivated the change** (`public/research/archive/weather-v31-live-check.json`). The check is regenerated by `npx tsx research/v31-live-check.ts` from the archived training rows in `research/data/v31-live-rows.json`.

- It is the outlook's rolling check (`rollingHeldOut`), replaying v3 and v3.1 on the inputs stored on 16 Nov.
- It covers nine regions and temperature only. Test days run 26 Sep – 9 Nov 2026, 45 per cell, so all but 9 Nov fall inside the confirmation period.
- Weekly refits train on 34–81 rows, not the deployed 90.
- These data were seen before the candidates were written down, so they illustrate the change and do not test it.

| Region | v3 Tmean (leads 1–6) | v3.1 Tmean | v3 Tmax | v3.1 Tmax |
|---|---|---|---|---|
| Texas | −33 to −6% | +2 to +24% | −14 to +7% | +2 to +12% |
| Lubbock | −38 to −2% | −3 to +6% | −16 to −1% | +6 to +15% |
| Arkansas | −38 to +12% | +19 to +36% | −35 to −12% | −17 to +9% |
| Mato Grosso | −7 to +8% | −9 to +7% | +6 to +21% | −7 to +11% |
| Kansas | −8 to +13% | −5 to +11% | +11 to +19% | +8 to +12% |
| Iowa | −6 to +4% | 0 to +7% | −5 to +8% | −4 to +2% |

- Over all nine regions, the temperature cells where the outlook is worse than the raw ensemble fall from 50 to 21 of 108.
- Pooled skill against the raw ensemble rises from −1.0% to +10.3% for mean temperature and from +3.2% to +6.1% for maximum temperature.
- **v3.1 is worse than v3 in three of the nine regions, mostly for maximum temperature:**
  - Mato Grosso: pooled +10.8% → +0.9%; Tmax worse at all 6 leads, Tmean at 5.
  - Kansas: +10.1% → +7.2%; Tmax worse at all 6 leads.
  - Iowa: +1.4% → +0.5%; Tmax worse at 5 of 6 leads.
- In Mato Grosso, v3's lower slope (mean b 0.65–0.84) happened to offset a warm error of the raw models. We did not investigate why.

## 10. Discussion

- **The confirmation period motivated this fix**, as it motivated v3, so its result is a consistency check, not independent evidence. Selection used dev data only. The first clean test is the prospective benchmark on target days after 2026-11-16, with the live track record as a check of the deployed product.
- **The largest change on confirmation is in bias, which was not tested formally.** Pooled bias falls from +0.116 to +0.042 °C, and Tmax day-7 bias from +0.228 to +0.099 °C. The CRPS gain is −0.62% pooled; only Tmean day 7 is at p < 0.05 against v3, and no cell survives a correction for 8 tests.
- **Maximum temperature at days 1–5 is slightly worse on confirmation** (+0.4 to +1.3% CRPS; p ≥ 0.25). The lower tail is now better covered (11.0% vs 12.7% below p10 at day 1), but the upper tail is now slightly too narrow (11.0% vs 9.3% above p90; 10% if calibrated).
- **Dev and confirmation disagree in size**, −2.8% against −0.6%. We do not know why. One untested guess is that the longer steady summer stretch in April–November gives the pull less to cost.
- **Not done:** no station or area re-verification of v3.1. The station and area archives still report v2 and v3.

## 11. Corrections after the independent review (16 Nov 2026)

An independent review found no leakage, look-ahead or error in applying the selection and adoption rules. Following it, these corrections were made. Sections 1–5 are left as committed, so their errors are listed here.

- **Section 1, test days.** They are 26 Sep – 9 Nov 2026, not 2 Oct – 15 Nov. The 16 Nov window is 12 Aug – 9 Nov, and ERA5 ends six days before issue. The motivating data therefore lie inside the confirmation period except 9 Nov, not "in and just after it".
- **Section 1, what was observed.** The warm errors come from replaying v3's method on inputs stored on 16 Nov, not from forecasts that were published. v3 was live only from 16 Nov, and the one published track-record snapshot is v2. The replay's weekly refits train on 34–81 rows, not the deployed 90, so the size of the effect may not carry over exactly.
- **Section 1 numbers are now reproducible.** The table and the mean slopes come from `research/v31-live-check.ts` → `public/research/archive/weather-v31-live-check.json`, built from `research/data/v31-live-rows.json`. That rerun matches the original computation in 215 of 216 cells. The exception is Kansas Tmean day 5, −8.5% vs −8%, from storing inputs to 4 decimals. With the archived rows, negative cells fall from 50 to 21, not 19, and pooled mean-temperature skill starts at −1.0%, not −1.1%.
- **Section 3 and significance.** The Arkansas rain losses were dismissed with a multiplicity correction. The same standard applied to the v3.1-versus-v3 tests leaves no confirmation cell significant, and Sections 8 and 10 now say so.
- **Regions where v3.1 is worse.** There are three (Mato Grosso, Kansas, Iowa), not one.
- **Selection threshold and rounding.** The 0.0001 °C threshold is finer than the 3-decimal rounding of the `bySite` cells it is computed from. Pooling the summary rows instead gives v3 0.78954 rather than 0.78946. This did not affect the choice: D1 led D2 by 0.0037 °C and v3 by 0.022 °C.

## References (added after the pre-specification)

None.
