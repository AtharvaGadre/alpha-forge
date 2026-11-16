# Astraeus v3: fixing v2's temperature over-confidence

Sections 1–5 are the **pre-specification**. They were written and committed on 2026-11-16, before any candidate method was run. Results are appended in later sections, and Sections 1–5 are not edited afterwards.

## 1. The problem, and why the confirmation period cannot be used to fix it

The published confirmation scores (`public/research/weather-skill.json`, test days 2026-04-01 … 2026-11-08) show v2's temperature forecasts are over-confident and too warm:

| Variable | Lead | 80% coverage (PIT) | below p10 | above p90 | bias (°C) |
|---|---|---|---|---|---|
| Tmean | 1 / 3 / 5 / 7 | 73.5 / 75.4 / 75.0 / 74.4% | 15.6 / 13.8 / 14.1 / 14.6% | 11.0 / 10.8 / 10.9 / 10.9% | +0.068 / +0.070 / +0.105 / +0.162 |
| Tmax | 1 / 3 / 5 / 7 | 75.5 / 77.7 / 76.3 / 76.2% | 14.1 / 12.9 / 13.6 / 13.8% | 10.4 / 9.4 / 10.0 / 10.1% | +0.100 / +0.128 / +0.197 / +0.252 |
| Pooled temperature | all | 75.5% | 14.0% | 10.4% | +0.137 |

Pooled temperature PIT deciles (confirmation): 14.0, 10.2, 9.8, 9.7, 9.7, 9.4, 9.0, 9.0, 8.6, 10.4%.

The problem was found on the confirmation period, so that period is not clean for choosing a fix. Candidates are selected on the development period only. The confirmation period is scored once, for the frozen winner. The only clean test is prospective: forecasts for days after 2026-11-16, which can first be scored around 22 Nov 2026 once ERA5 is published.

## 2. Diagnosis of v2 on the development period

Run: `npx tsx research/weather-benchmark.ts --suite final --period dev --offline`. Output archived as `public/research/archive/weather-v2-dev-diagnosis.json`. Test days run from early October 2025 to 2026-03-31 (170–176 days per lead), 16 sites, 22,144 temperature cases.

| Variable | Lead | CRPS (°C) | 80% coverage | below p10 | above p90 | bias (°C) |
|---|---|---|---|---|---|---|
| Tmean | 1 | 0.339 | 76.3% | 10.3% | 13.5% | −0.033 |
| Tmean | 3 | 0.474 | 74.1% | 12.9% | 13.0% | −0.027 |
| Tmean | 5 | 0.692 | 73.7% | 13.4% | 12.9% | −0.013 |
| Tmean | 7 | 1.055 | 72.2% | 14.8% | 13.0% | +0.030 |
| Tmax | 1 | 0.594 | 76.0% | 12.9% | 11.1% | +0.051 |
| Tmax | 3 | 0.782 | 73.9% | 14.4% | 11.7% | +0.031 |
| Tmax | 5 | 1.021 | 74.0% | 14.0% | 12.0% | +0.046 |
| Tmax | 7 | 1.422 | 73.8% | 14.8% | 11.4% | +0.119 |
| **Pooled temperature** | | **0.79382** | **74.3%** | **13.4%** | **12.3%** | **+0.025** |

Pooled temperature PIT deciles (development): 13.4, 8.8, 8.6, 8.3, 9.0, 9.8, 9.8, 9.9, 10.0, 12.3%. Precipitation (v2 = skill-weighted ensemble) covers 81.3 / 81.3 / 81.2 / 80.0% at leads 1 / 3 / 5 / 7, so it is not part of this problem.

**Does the problem exist on dev? The over-confidence does; the warm bias mostly does not.**

- Every temperature cell is under-covered (72–76%), with excess in both tails.
- On dev the tails are nearly symmetric (13.4% vs 12.3%), and the mean bias is small (+0.025 °C). On confirmation the cold tail dominates (14.0% vs 10.4%) and the bias is +0.137 °C. The warm bias therefore looks seasonal: it appears in April–November and not in October–March. A fix chosen on dev may correct the dispersion and still leave that bias, and the confirmation scoring must say so if it does.
- The PIT histogram is inflated only in its outer deciles; the eight inner deciles are 8.3–10.0%. A Gaussian that is uniformly too narrow by the needed factor (σ about 14% too small to give 74% coverage) would show a graded U of about 13.0, 10.0, 9.3, 8.9, 8.8%. The observed shape points to errors with heavier tails than a Gaussian, which a minimum-CRPS Gaussian fit trades away for a sharp centre (Gebetsberger et al., 2018).
- If the errors were Gaussian, correcting a 14% σ deficit would lower CRPS by only about 0.4%. The CRPS stakes are small; coverage is the visible defect.

## 3. Candidates (temperature only; at most six)

**Common base (= v2 temperature).** Each candidate uses the rows of the same trailing 90-day window, ERA5 lag 6 days and weekly refit as v2. Rows are ordered newest first, and a row's age is its position in the window (0 = most recently verified day). Components:

- per-member additive bias β;
- skill weights w = 0.75·MSE⁻¹/ΣMSE⁻¹ + 0.25/K on bias-corrected members;
- location μ = a + b·m̄_w and scale √(c² + d²·s²_w + 10⁻⁶);
- (a, b, c, d) fitted by Nelder–Mead minimum mean CRPS from (0, 1, sd, 1) with the 10⁻⁴(b − 1)² penalty.

With every option switched off, the new code must reproduce v2's predictions to 10⁻⁹; a unit test checks this.

| ID | Candidate | Exact specification | Rationale |
|---|---|---|---|
| C1 | `v3c1-crossfit`: out-of-sample bias and skill weights | Split the window into K = 5 contiguous blocks (block = ⌊5j/n⌋ for position j). For rows in block k, estimate β and w from the other four blocks. Fit (a, b, c, d) on these out-of-sample predictors. Forecast with the full-window β and w and those (a, b, c, d). | In-sample β and w make the corrected mean look more accurate than it is out of sample, so c and d come out too small. This is stacking: fit the combiner on out-of-sample level-0 predictions (Wolpert, 1992), with blocked folds for serially dependent data (Bergmeir and Benítez, 2012). |
| C2 | `v3c2-kappa-cv`: σ recalibrated from blocked cross-validated standardized errors | Fit v2 on the full window. For each of K = 5 contiguous blocks, refit the whole v2 procedure on the other blocks and predict the block, giving z_j = (y_j − μ_j)/σ_j. κ = argmin over [0.5, 2.5] of Σ_j CRPS(N(μ_j, κ²σ_j²), y_j), found by golden-section search (60 iterations). Forecast σ is multiplied by κ. | A direct out-of-sample estimate of how far σ must be widened, chosen by the same proper score as the fit, so sharpness is kept wherever calibration allows (Gneiting et al., 2007). |
| C3 | `v3c3-kappa-trail`: σ recalibrated from trailing out-of-sample standardized errors | As C2, but the held-out rows are the 30 most recent: segments at positions 0–9, 10–19 and 20–29. Each segment is predicted by a v2 fit on positions ≥ segment start + 17. That leaves a 7-day gap after the segment's oldest day (ERA5 lag plus one lead day) and training lengths of about 73, 63 and 53 days. Same κ search. | A pseudo-operational replay: errors of forecasts that could have been issued, made across the same kind of gap, so bias drift since the training period is included. Interior CV blocks (C2) see data on both sides and miss that drift. |
| C4 | `v3c4-recency`: recency-weighted training | Case weights ω_j = 0.5^(age_j/35) in β, in the MSEs behind w, and in the CRPS objective (weighted mean). | Lets the bias track season transitions. A 35-day half-life matches the 2% decaying-average weight of NCEP's operational bias correction (Cui et al., 2012; 0.98³⁵ ≈ 0.49). Prior evidence cuts the other way: Lang et al. (2020) found that lowering estimation variance mattered more than adapting quickly, so this may lose. |
| C5 | `v3c5-logistic`: heavy-tailed NGR | Same four-parameter structure, but with a logistic predictive law L(μ, s), s = √(c² + d²·s²_w + 10⁻⁶). Fitted by minimum CRPS with the closed form CRPS = s·(z − 2 ln Λ(z) − 1), z = (y − μ)/s (as in scoringRules; Jordan et al., 2019); start (0, 1, 0.55·sd, 0.55). | The dev PIT is inflated only in the outer deciles. For temperature NGR, heavy-tailed logistic and Student-t laws improved sharpness and calibration over the Gaussian (Gebetsberger et al., 2018). |
| C6 | `v3c6-combo`: combination, defined by rule | v2 plus every component whose standalone candidate lowered pooled dev CRPS below v2's by more than 0.0001 °C: the logistic law if C5 qualifies, recency weights if C4 qualifies, and at most one dispersion fix (whichever of the qualifying C1–C3 has the lowest pooled dev CRPS). Each κ procedure refits the base with the same law, weights and cross-fitting. If fewer than two components qualify, C6 is not run. | Combines the fixes that work separately. C6's composition is fixed by this rule before any result is seen. |

**Precipitation.** No precipitation candidate is tested. Precipitation coverage is already 79–83%, so v3's precipitation component is v2's (skill-weighted ensemble, 90-day window). It changes only if a candidate improves pooled dev precipitation CRPS, and none is run.

**Not tested: anomalies from a day-of-year ERA5 climatology.** Three reasons:

1. With additive per-member bias correction, fitting on anomalies (f − c, y − c) changes only the shrinkage target of b < 1: from the training-window mean to the date's climatology. The closest existing variant, NGR with a climatology predictor, was already worse than v2 on dev (+8.5% vs +10.3% CRPSS for Tmax, +10.9% vs +13.0% for Tmean; Technical Report, Table 2).
2. The dev problem is in the tails, which anomaly fitting does not address.
3. The live outlook has no day-of-year climatology for its 90 training days, so a winning anomaly method could not be deployed without new data fetches.

## 4. Selection rule (development period only)

1. **Metric.** Pooled dev CRPS over all 22,144 temperature cases: Tmean and Tmax, leads 1/3/5/7, 16 sites, test days ≤ 2026-03-31, scored on identical cases. It is computed as the days-weighted mean of the benchmark's per-site/variable/lead mean CRPS (`bySite`, 128 cells), which resolves differences of about 10⁻⁴ °C.
2. **Eligibility.** Pooled dev PIT coverage (share of PIT values in [0.1, 0.9]) over the same cases must lie in [77%, 83%].
3. **Winner.** The eligible candidate with the lowest pooled dev CRPS, provided that CRPS is lower than v2's by more than 0.0001 °C. v2's CRPS comes from the same candidate run (0.79382 °C in the Section 2 run).
4. **Otherwise keep v2.** If no candidate qualifies, no `astraeus-v3` is created and this document reports "keep v2".
5. **No early look at confirmation.** No candidate's confirmation-period number is computed before the freeze commit. Only the frozen winner is scored on confirmation, once, by adding it to the `final` suite. The existing methods' confirmation numbers must reproduce the committed `weather-skill.json` exactly.
6. **Reporting.** For every candidate, the dev table reports CRPS, coverage, tail shares and bias for each cell and pooled. Significance is not part of selection: the dev period is for choosing, and confirmation and prospective scoring are for testing.

## 5. Live-adoption rule (written before the confirmation scoring)

The live 7-day outlook (`src/engine/calibratedOutlook.ts`) switches from v2 to v3 only if both hold on the confirmation period, pooled over the eight temperature cells:

- v3's pooled CRPS ≤ v2's pooled CRPS (0.75005 °C from the committed `weather-skill.json`, recomputed in the scoring run); **and**
- |coverage(v3) − 80%| < |coverage(v2) − 80%| (v2: 75.5%).

Otherwise the live outlook stays on v2. v3 is still kept in the `final` suite for the prospective test, and the outlook's `version` field always names the method actually used. `headlineMethod` in the benchmark output stays `astraeus-v2`; the integrator decides the headline.

---

*Everything below was added after the pre-specification commit (54d569e, 2026-11-16T09:27:07Z).*

## 6. Development-period results and selection

**Run.** `npx tsx research/weather-benchmark.ts --suite v3dev --period dev --offline`, archived as `public/research/archive/weather-v3-dev.json` (generated 2026-11-16T09:33:19Z). v2 reproduces Section 2 exactly (0.79382 °C). No confirmation-period number of any candidate was computed.

**Pooled temperature, development period (22,144 cases):**

| Candidate | Pooled CRPS (°C) | Δ vs v2 | 80% coverage | below p10 | above p90 | bias (°C) |
|---|---|---|---|---|---|---|
| v2 (`astraeus-v2`) | 0.79382 | — | 74.3% | 13.4% | 12.3% | +0.025 |
| C1 `v3c1-crossfit` | 0.80514 | +0.01131 (+1.43%) | 74.3% | 13.3% | 12.4% | +0.028 |
| C2 `v3c2-kappa-cv` | 0.79260 | −0.00122 (−0.15%) | 76.3% | 12.4% | 11.2% | +0.025 |
| C3 `v3c3-kappa-trail` | 0.79987 | +0.00604 (+0.76%) | **78.0%** | 11.3% | 10.7% | +0.025 |
| C4 `v3c4-recency` | 0.78983 | −0.00399 (−0.50%) | 74.2% | 13.5% | 12.3% | +0.032 |
| C5 `v3c5-logistic` | 0.79347 | −0.00036 (−0.04%) | 74.6% | 13.3% | 12.1% | +0.027 |
| **C6 `v3c6-combo`** | **0.78946** | **−0.00437 (−0.55%)** | **77.4%** | 11.6% | 11.0% | +0.033 |
| Zero-training Gaussian (reference) | 0.84939 | +0.05556 (+7.00%) | 80.0% | 8.8% | 11.1% | −0.060 |

**Per cell (CRPS °C / 80% coverage %):**

| Method | Tmean d1 | Tmean d3 | Tmean d5 | Tmean d7 | Tmax d1 | Tmax d3 | Tmax d5 | Tmax d7 |
|---|---|---|---|---|---|---|---|---|
| v2 | 0.339 / 76.3 | 0.474 / 74.1 | 0.692 / 73.7 | 1.055 / 72.2 | 0.594 / 76.0 | 0.782 / 73.9 | 1.021 / 74.0 | 1.422 / 73.8 |
| C1 | 0.343 / 76.0 | 0.480 / 73.9 | 0.702 / 74.0 | 1.073 / 72.9 | 0.604 / 75.5 | 0.792 / 74.1 | 1.031 / 74.4 | 1.444 / 73.9 |
| C2 | 0.339 / 77.9 | 0.474 / 75.8 | 0.691 / 76.1 | 1.052 / 75.3 | 0.593 / 77.6 | 0.782 / 75.7 | 1.020 / 76.2 | 1.420 / 75.8 |
| C3 | 0.342 / 79.3 | 0.478 / 77.9 | 0.697 / 78.3 | 1.062 / 77.5 | 0.599 / 79.9 | 0.789 / 77.6 | 1.027 / 77.0 | 1.434 / 76.6 |
| C4 | 0.336 / 75.2 | 0.471 / 74.1 | 0.692 / 74.4 | 1.061 / 72.9 | 0.580 / 75.5 | 0.775 / 74.2 | 1.016 / 73.4 | 1.417 / 73.5 |
| C5 | 0.339 / 76.6 | 0.474 / 74.3 | 0.692 / 73.9 | 1.054 / 72.6 | 0.594 / 76.4 | 0.782 / 74.4 | 1.020 / 74.4 | 1.421 / 74.1 |
| C6 | 0.337 / 78.6 | 0.472 / 76.9 | 0.692 / 77.3 | 1.058 / 76.4 | 0.580 / 78.3 | 0.775 / 77.2 | 1.017 / 77.5 | 1.415 / 77.1 |

**C6 composition (Section 3 rule, applied after C1–C5 were run).**

- Qualifying components (pooled dev CRPS below v2's by more than 0.0001 °C): C5 logistic (−0.00036) and C4 recency (−0.00399).
- Of the dispersion fixes, only C2 qualified (−0.00122); C1 (+0.01131) and C3 (+0.00604) were worse than v2.
- So C6 = logistic law + 35-day recency weights + blocked-CV scale recalibration, run once with no other change.

**Selection (Section 4 rule).**

- Eligible on coverage (77–83%): C3 (78.0%) and C6 (77.4%).
- C3's CRPS is above v2's, so it fails the improvement condition.
- C6's pooled CRPS (0.78946 °C) is 0.00437 °C below v2's. **C6 is selected and frozen as `astraeus-v3`.**
- Its precipitation component is v2's: no precipitation candidate was run.

**What the dev numbers say, and do not say.**

- **The improvement is small.** Pooled CRPS falls 0.55%. Per cell the change runs from −2.4% (Tmax day 1: 0.580 vs 0.594) to +0.3% (Tmean day 7: 1.058 vs 1.055); Tmean day 5 is unchanged.
- **Where the gains come from.** The CRPS gain comes almost entirely from recency weighting (C4 alone: −0.50%). The coverage gain comes mostly from the scale factor (C2: +2.0 pp; C6: +3.1 pp).
- **Coverage is still below 80%.** C6 covers 77.4% on dev, with 11.6% / 11.0% in the tails. A scale chosen by minimum CRPS does not widen enough to cover the heavy tails. The trailing replay (C3) widened more and reached 78.0%, but cost 0.76% CRPS, mostly at short leads.
- **Cross-fitted weights (C1) made things worse (+1.4%).** We did not investigate why.
- **Recency weighting helped on dev despite the prior.** The prior was negative (Lang et al., 2020). The dev period spans the October–March season transitions.
- **Dev mean bias was not reduced** (+0.033 vs +0.025 °C), but dev had little bias to remove. Whether C6 reduces the April–November warm bias can only be answered on the confirmation and prospective periods.
- **Implementation guards not stated in Section 3.** The trailing replay (C3) skips a segment with fewer than 30 training rows. Cross-fitting (C1) needs at least 10 rows. Both affect only windows with many missing days and do not touch C6.
- **Benchmark check.** On dev, `astraeus-v3` reproduces C6 exactly for temperature and v2's precipitation CRPS exactly (0 differences across all summary and per-site cells; run `--suite raw-ensemble,astraeus-v2,v3c6-combo,astraeus-v3 --period dev`).

## 7. Freeze

`astraeus-v3` is implemented as `ASTRAEUS_V3_TEMPERATURE`, `fitAstraeusV3` and `predictAstraeusV3` in `src/engine/weatherPostprocessing.ts`, with unit tests in `weatherPostprocessing.test.ts`. It is registered as `astraeus-v3` in `research/weather-benchmark.ts` and appended to the `final` suite. It draws its randomised-PIT numbers from its own stream, so its presence leaves every other method's scores unchanged. The freeze commit's hash and UTC time are recorded below, in a follow-up commit.

## References

- Bergmeir, C., Benítez, J. M. (2012). On the use of cross-validation for time series predictor evaluation. *Information Sciences* 191, 192–213. doi:10.1016/j.ins.2011.12.028 (verified via Crossref).
- Cui, B., Toth, Z., Zhu, Y., Hou, D. (2012). Bias correction for global ensemble forecast. *Weather and Forecasting* 27(2), 396–410. doi:10.1175/WAF-D-11-00011.1 (`researchLibrary.ts`: cui2012-naefs-bias).
- Gebetsberger, M., Messner, J. W., Mayr, G. J., Zeileis, A. (2018). Estimation methods for nonhomogeneous regression models: minimum CRPS versus maximum likelihood. *Monthly Weather Review* 146(12), 4323–4338. doi:10.1175/MWR-D-17-0364.1 (gebetsberger2018-crps-vs-ml).
- Gneiting, T., Raftery, A. E., Westveld, A. H., Goldman, T. (2005). Calibrated probabilistic forecasting using EMOS and minimum CRPS estimation. *MWR* 133(5), 1098–1118. doi:10.1175/MWR2904.1 (gneiting2005-emos).
- Gneiting, T., Balabdaoui, F., Raftery, A. E. (2007). Probabilistic forecasts, calibration and sharpness. *JRSS B* 69(2), 243–268. doi:10.1111/j.1467-9868.2007.00587.x (gneiting2007-calibration-sharpness).
- Jordan, A., Krüger, F., Lerch, S. (2019). Evaluating probabilistic forecasts with scoringRules. *J. Stat. Software* 90(12). doi:10.18637/jss.v090.i12 (jordan2019-scoringrules).
- Lang, M. N., Lerch, S., Mayr, G. J., Simon, T., Stauffer, R., Zeileis, A. (2020). Remember the past: a comparison of time-adaptive training schemes for non-homogeneous regression. *Nonlinear Processes in Geophysics* 27, 23–34. doi:10.5194/npg-27-23-2020 (verified via Crossref).
- Wolpert, D. H. (1992). Stacked generalization. *Neural Networks* 5(2), 241–259. doi:10.1016/S0893-6080(05)80023-1 (verified via Crossref).
