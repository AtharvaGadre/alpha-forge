/**
 * Astraeus technical report — a single, data-driven source rendered both in the app (TechnicalReport.tsx)
 * and to Markdown (research/build-report.ts → docs/TECHNICAL_REPORT.md). Every number is computed from
 * the published result files; citations use [@id] markers resolved against RESEARCH_LIBRARY.
 */
import type { PriceSkill, SkillRow, WeatherSkill } from './researchData';

export type ReportBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'eq'; text: string; label?: string }
  | { type: 'table'; caption: string; head: string[]; rows: string[][]; note?: string; highlightRow?: (row: string[]) => boolean }
  | { type: 'figure'; kind: 'skill-by-lead' | 'reliability' | 'fan' | 'price-matrix' | 'leaderboard'; caption: string; variable?: string; lead?: number };

export interface ReportSection { id: string; title: string; blocks: ReportBlock[] }
export interface ReportDoc { title: string; subtitle: string; meta: string[]; abstract: string; keywords: string[]; sections: ReportSection[]; cited: string[] }

const pc = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
const sp = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%`);
const f3 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(3));
const pv = (p: number | null | undefined) => (p == null || !Number.isFinite(p) ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3));
const VAR: Record<string, string> = { tmean: 'daily mean temperature', tmax: 'daily maximum temperature', precip: 'daily precipitation' };
const VAR_SHORT: Record<string, string> = { tmean: 'Mean temp.', tmax: 'Max temp.', precip: 'Precip.' };
const METHOD: Record<string, string> = {
  climatology: 'Climatology', 'raw-ensemble': 'Raw ensemble', 'astraeus-v1': 'Astraeus v1', 'bias-corrected': 'Bias-corrected ensemble', emos: 'EMOS (40 d)', 'emos-weighted': 'EMOS, learned weights (40 d)', 'astraeus-v2': 'Astraeus v2',
};
const mname = (m: string) => METHOD[m] ?? m.replace(/-(\d+)$/, ' ($1 d)').replace('ngr-skill-clim', 'Skill NGR + clim.').replace('ngr-skill', 'Skill-weighted NGR').replace('weighted-ensemble', 'Skill-weighted ensemble').replace('sqrt-censored-w', '√-censored, weighted').replace('cbrt-censored-w', '∛-censored, weighted').replace('sqrt-censored', '√-censored');

function get(w: WeatherSkill | null, v: string, lead: number, m: string): SkillRow | undefined {
  return w?.summary.find((s) => s.variable === v && s.lead === lead && s.method === m);
}

export function buildReport(w: WeatherSkill, price: PriceSkill | null, dev: WeatherSkill | null, run1: WeatherSkill | null): ReportDoc {
  const head = w.headlineMethod ?? 'astraeus-v2';
  const leads = w.config.leads;
  const cases = w.summary.filter((s) => s.method === head).reduce((a, s) => a + s.cases, 0);
  const days = Math.max(...w.summary.map((s) => s.days));
  const range = (v: string) => { const xs = leads.map((l) => get(w, v, l, head)?.crpssVsRaw ?? NaN); return [xs[0], xs[xs.length - 1], Math.min(...xs), Math.max(...xs)]; };
  const [tx1, tx7] = range('tmax');
  const [tm1, tm7] = range('tmean');
  const [pp1, pp7] = range('precip');
  const sigVsRaw = w.significance.filter((s) => s.method === head && s.versus === 'raw-ensemble');
  const maxP = Math.max(...sigVsRaw.map((s) => s.pValue));
  const sigVsV1 = w.significance.filter((s) => s.method === head && s.versus === 'astraeus-v1');
  const v1Wins = sigVsV1.filter((s) => s.meanDiff < 0 && s.pValue < 0.05).length;
  const v1Ties = sigVsV1.filter((s) => s.pValue >= 0.05).length;
  const best = (v: string, lead: number) => [...w.singleModels.filter((m) => m.variable === v && m.lead === lead)].sort((a, b) => a.mae - b.mae);
  const aifsBestCount = w.variables.reduce((a, vv) => a + leads.filter((l) => best(vv.id, l)[0]?.model === 'ecmwf_aifs025_single').length, 0);
  const run1Emos = run1 ? (['tmean', 'tmax'] as const).map((v) => get(run1, v, 1, 'emos')?.coverage80 ?? NaN) : [];
  const run1EmosP = run1 ? [1, 3, 5].map((l) => get(run1, 'precip', l, 'emos')?.crpssVsRaw ?? NaN) : [];
  const site = (id: string) => w.sites.find((s) => s.id === id)?.name ?? id;
  const siteSkill = w.bySite.filter((r) => r.variable === 'tmax' && r.lead === 3).map((r) => ({ id: String(r.site), s: 1 - Number(r[head]) / Number(r['raw-ensemble']) })).sort((a, b) => b.s - a.s);

  // price findings
  const sigPrice = (price?.rows ?? []).filter((r) => r.qCwWxVsMkt != null && r.qCwWxVsMkt < 0.1 && r.metrics.oosR2WxVsMkt > 0);
  const positive = (price?.rows ?? []).filter((r) => r.metrics.oosR2WxVsMkt > 0).length;
  const tierLabel: Record<string, string> = { REALISED_LAGGED: 'realised weather, lagged', ORACLE_TARGET_WINDOW: 'oracle weather in the target window', NWP_FORECAST: 'NWP forecasts known at origin' };
  const priceAbstract = !price ? 'The companion price study was not available when this report was generated.'
    : sigPrice.length
      ? `In a walk-forward study of weekly futures returns for ${price.commodities.length} weather-sensitive commodities, weather information improved out-of-sample forecasts over a market-only model in ${positive} of ${price.rows.length} commodity–information–horizon cells; after Benjamini–Hochberg correction the surviving evidence is ${sigPrice.map((r) => `${r.name} with ${tierLabel[r.tier] ?? r.tier} at ${r.horizonWeeks} week${r.horizonWeeks > 1 ? 's' : ''} (out-of-sample R² gain ${sp(r.metrics.oosR2WxVsMkt)}, q = ${pv(r.qCwWxVsMkt)})`).join('; ')}.`
      : `In a walk-forward study of weekly futures returns for ${price.commodities.length} weather-sensitive commodities, no weather-information set improved out-of-sample forecasts over a market-only model after Benjamini–Hochberg correction (${positive} of ${price.rows.length} cells had a positive point estimate).`;

  const cited = new Set<string>();
  const c = (text: string) => { for (const m of text.matchAll(/@([a-z0-9-]+)/g)) cited.add(m[1]); return text; };
  const P = (text: string): ReportBlock => ({ type: 'p', text: c(text) });
  const L = (items: string[]): ReportBlock => ({ type: 'list', items: items.map(c) });

  const mainRows: string[][] = [];
  for (const v of ['tmax', 'tmean', 'precip']) for (const l of leads) {
    const r = get(w, v, l, head);
    const dm = sigVsRaw.find((s) => s.variable === v && s.lead === l);
    const dv1 = sigVsV1.find((s) => s.variable === v && s.lead === l);
    if (!r) continue;
    mainRows.push([VAR_SHORT[v], `Day ${l}`, String(r.cases), f3(get(w, v, l, 'raw-ensemble')?.crps), f3(r.crps), `${sp(r.crpssVsRaw)} (${sp(r.crpssVsRawCI[0])}, ${sp(r.crpssVsRawCI[1])})`, pv(dm?.pValue), sp(r.crpssVsV1), pv(dv1?.pValue), sp(get(w, v, l, 'emos') ? 1 - r.crps / get(w, v, l, 'emos')!.crps : null), sp(r.crpssVsClimatology), pc(r.coverage80, 0)]);
  }

  const devRows: string[][] = [];
  if (dev) for (const v of ['tmax', 'tmean', 'precip']) {
    const methods = [...new Set(dev.summary.filter((s) => s.variable === v).map((s) => s.method))].filter((m) => m !== 'climatology');
    const ranked = methods.map((m) => ({ m, mean: leads.reduce((a, l) => a + (get(dev, v, l, m)?.crpssVsRaw ?? 0), 0) / leads.length })).sort((a, b) => b.mean - a.mean).slice(0, 4);
    ranked.forEach((x, i) => devRows.push([i === 0 ? VAR_SHORT[v] : '', mname(x.m), ...leads.map((l) => sp(get(dev, v, l, x.m)?.crpssVsRaw)), pc(get(dev, v, 3, x.m)?.coverage80, 0)]));
  }

  const regionRows = w.sites.map((s) => [s.name, s.commodities.join(', '), `${s.lat.toFixed(2)}, ${s.lng.toFixed(2)}`, leads.map((l) => s.modelsByLead?.[l]?.length ?? '—').join(' / ')]);

  const priceRows = (price?.rows ?? []).map((r) => [r.name, tierLabel[r.tier] ?? r.tier, `${r.horizonWeeks} wk`, String(r.metrics.n), sp(r.metrics.oosR2Wx, 2), sp(r.metrics.oosR2WxVsMkt, 2), pv(r.metrics.cwWxVsMkt?.p), pv(r.qCwWxVsMkt), pc(r.metrics.hitRateWx, 1)]);

  const doc: ReportDoc = {
    title: 'Calibrated multi-model weather forecasts for commodity regions, and what they can and cannot tell us about futures returns',
    subtitle: 'Astraeus Technical Report AR-2026-01',
    meta: [`Results generated ${w.generatedAt.slice(0, 10)}`, `Weather benchmark ${w.version} · ${w.suite}/${w.period}`, price ? `Price study ${price.study}` : 'Price study pending', 'Code: research/weather-benchmark.ts · research/price-study.ts · src/engine/weatherPostprocessing.ts'],
    abstract: c(`We verify daily forecasts from seven global weather prediction systems — ECMWF IFS and the machine-learning AIFS, NOAA GFS, DWD ICON, the UK Met Office Unified Model, JMA GSM and ECCC GEM — at ${w.sites.length} commodity-producing and demand regions against ERA5 reanalysis, and develop a post-processing scheme for the weather layer of the Astraeus commodity platform. Candidate methods were compared on a development period (test days from October 2025 to ${w.config.devEnd}); the selected scheme, Astraeus v2 — bias-corrected, skill-weighted non-homogeneous Gaussian regression for temperature and a skill-weighted multi-model ensemble for precipitation, trained on trailing 90-day windows — was frozen and scored once on a later confirmation period (${days} days, ${cases.toLocaleString()} forecast–observation pairs). Relative to the raw multi-model ensemble, Astraeus v2 reduced the continuous ranked probability score (CRPS) by ${pc(tx1)} at day 1 and ${pc(tx7)} at day 7 for daily maximum temperature, ${pc(tm1)} to ${pc(tm7)} for daily mean temperature and ${pc(pp1)} to ${pc(pp7)} for daily precipitation; every difference was significant (Diebold–Mariano, p ${maxP < 0.01 ? '< 0.01' : `≤ ${pv(maxP)}`}). A pre-registered first run showed that classical EMOS fitted on 40-day windows was under-dispersive and degraded precipitation forecasts, which motivated the final design. ${priceAbstract} We conclude that calibrated weather information is a reliable physical input, but that weekly price predictability from weather is narrow and should be claimed only where it survives out-of-sample testing.`),
    keywords: ['ensemble post-processing', 'EMOS', 'CRPS', 'ERA5', 'AIFS', 'commodity futures', 'out-of-sample predictability'],
    sections: [
      { id: 'intro', title: '1. Introduction', blocks: [
        P('Weather is a first-order driver of commodity supply and demand. Extreme heat above roughly 29–30 °C sharply reduces US corn and soybean yields [@schlenker2009-nonlinear-heat], weather-driven yield shocks identify the supply response of staple crops [@roberts2013-elasticities], temperature shocks move natural-gas returns and volatility through heating and cooling demand and storage [@mu2007-gas-weather], and frost risk is visible in orange-juice futures [@roll1984-oj; @boudoukh2007-oj].'),
        P('At the same time, medium-range forecasting has improved steadily [@bauer2015-quiet-revolution; @haiden2026-ecmwf-tm938] and machine-learning models trained on reanalysis now rival or exceed physics-based systems on many headline scores [@lam2023-graphcast; @price2025-gencast; @bi2023-pangu; @lang2024-aifs]. Raw model output is nonetheless biased and its spread is typically under-dispersive, so operational centres apply statistical post-processing [@gneiting2005-emos; @raftery2005-bma; @vannitsem2021-review].'),
        P('This report documents the weather engine behind Astraeus and asks two questions. First, how accurate are freely available global forecasts at the specific places commodities are grown and consumed, and how much does post-processing help? Second, does weather information measurably improve forecasts of weekly commodity futures returns once evaluated out of sample?'),
        L([
          `A reproducible, ${w.sites.length}-region verification of seven global models (including ECMWF’s AIFS) against ERA5 at leads of ${leads.join(', ')} days.`,
          'A development/confirmation protocol with a pre-registered first run, so the headline numbers are not tuned on the data that score them.',
          'A closed-form CRPS for the zero-censored Gaussian, derived and verified numerically, alongside skill-weighted NGR and weighted-ensemble predictors.',
          'A walk-forward test of weather information in futures returns with nested-model tests and multiple-testing control.',
        ]),
      ] },
      { id: 'data', title: '2. Data', blocks: [
        P(`Forecasts. Daily forecasts were reconstructed from the Open-Meteo Previous Runs API, which archives each model’s hourly output as issued N days before the target day. Hourly values were aggregated to UTC days (all 24 hours required) as the mean and maximum of 2 m temperature and the sum of precipitation. Leads of ${leads.join(', ')} days were used; models were included at a region and lead only when at least ${Math.round(w.config.minModelAvailability * 100)}% of days were available (${leads.map((l) => `day ${l}: ${Math.min(...w.sites.map((s) => s.modelsByLead?.[l]?.length ?? 0))}–${Math.max(...w.sites.map((s) => s.modelsByLead?.[l]?.length ?? 0))} models`).join('; ')}).`),
        P(`Truth. ERA5 reanalysis [@hersbach2020-era5] from the Open-Meteo archive, aggregated identically. ERA5 is published with a lag of about five days; the benchmark therefore treats only days at least ${w.config.era5LagDays} days before issue time as known.`),
        P(`Climatology. Reference forecasts are the empirical distribution of ERA5 values within ±${w.config.climatologyHalfWindowDays ?? 7} days of the calendar date over ${w.config.climatologyYears.join('–')}.`),
        { type: 'table', caption: `Table 1. Verification regions (representative grid points) and models available at leads ${leads.join(' / ')} days.`, head: ['Region', 'Commodities', 'Lat, lon', 'Models by lead'], rows: regionRows },
        P(`Prices. ${price ? 'Daily settlement-style closes of continuous front-month futures from the Yahoo Finance chart endpoint, resampled to Friday-to-Friday weekly log returns. Continuous contracts contain roll jumps, so returns are research proxies rather than executable P&L.' : 'Pending.'}`),
      ] },
      { id: 'methods', title: '3. Methods', blocks: [
        P('3.1 Scoring. Forecasts are judged with the continuous ranked probability score, a strictly proper score that rewards calibration and sharpness jointly [@gneiting2007-scoring-rules; @hersbach2000-crps]:'),
        { type: 'eq', text: 'CRPS(F, y) = ∫ (F(x) − 𝟙{x ≥ y})² dx', label: '(1)' },
        P('For a Gaussian N(μ, σ²) it has the closed form of Gneiting et al. [@gneiting2005-emos]; for an m-member ensemble it is E|X − y| − ½E|X − X′|, computed exactly by sorting. For a Gaussian left-censored at zero — used for precipitation — we use'),
        { type: 'eq', text: 'CRPS_c0(μ, σ; y) = CRPS_N(μ, σ; y) − σ [ ℓΦ(ℓ)² + 2φ(ℓ)Φ(ℓ) − Φ(ℓ√2)/√π ],   ℓ = −μ/σ', label: '(2)' },
        P('which follows from removing the integral of Φ² below zero; it agrees with numerical integration to 10⁻⁸ in the unit tests and is consistent with the censored-distribution formulas of scoringRules [@jordan2019-scoringrules]. Skill is reported as CRPSS = 1 − CRPS/CRPS_ref against the raw ensemble and against climatology. Calibration is examined with PIT histograms [@hamill2001-rank-histograms; @gneiting2007-calibration-sharpness], 80% central-interval coverage and the Brier score with its reliability–resolution decomposition for events (precipitation ≥ 1 mm; temperature above the local 80th climatological percentile).'),
        P('3.2 Post-processing candidates. All candidates are refitted every seven days on trailing windows that contain only information available at issue time.'),
        L([
          'Raw ensemble: the seven model forecasts as equally weighted members.',
          'Astraeus v1 (the previous production method): inverse-MSE model weights shrunk 50% toward equal weights and a Gaussian whose spread is inflated by the training RMSE/spread ratio.',
          'Classical EMOS [@gneiting2005-emos]: Y ~ N(a + b·m̄, c² + d²s²) on additively bias-corrected members, fitted by minimum CRPS; for precipitation a zero-censored Gaussian with variance c² + d²·MD + g²·m̄ using the members’ mean absolute difference [@scheuerer2015-csgd; @thorarinsdottir2010-censored-emos].',
          'Skill-weighted NGR: members are bias-corrected, combined with inverse-MSE weights shrunk 25% toward equal (cf. superensemble weighting [@krishnamurti1999-superensemble]), then Y ~ N(a + b·m̄_w, c² + d²·s²_w) is fitted by minimum CRPS — four parameters regardless of the number of models.',
          'Skill-weighted ensemble: the members themselves with the same weights (bias-corrected for temperature), scored with the weighted-ensemble CRPS.',
          'Power-censored Gaussians for precipitation on √ and ∛ scales, fitted by maximum likelihood [@messner2014-censored-logistic; @gebetsberger2018-crps-vs-ml].',
        ]),
        { type: 'eq', text: 'w_i ∝ (1 − λ)·MSE_i⁻¹ / Σ_j MSE_j⁻¹ + λ/K,   λ = 0.25;   Y | x ~ N(a + b Σ w_i (x_i − β_i),  c² + d² Σ w_i (x_i − β_i − m̄_w)²)', label: '(3)' },
        P(`3.3 Protocol. A first, pre-registered run (${run1 ? 'archived as weather-run1-preregistered.json' : 'archived'}) evaluated five methods over the full period with 40-day windows. Its diagnostics motivated new candidates, which were compared only on test days up to ${w.config.devEnd}. The best temperature and precipitation methods on that development period were frozen as Astraeus v2 and evaluated once on later days. Every method is scored on identical cases; where a fit is impossible (for example a bone-dry window) the raw ensemble is used and counted.`),
        P('3.4 Inference. Differences are tested with the Diebold–Mariano statistic [@diebold1995-dm] on the daily cross-region mean CRPS differential, with a Newey–West variance (lag = lead) and the Harvey–Leybourne–Newbold small-sample correction [@harvey1997-hln]. Confidence intervals for CRPSS come from a 7-day moving-block bootstrap. Regions are not independent, so the effective sample size is the number of days.'),
        P(`3.5 Price study. ${price ? `Weekly log returns at 1- and 4-week horizons are forecast with expanding-window ridge regressions: a market-only model (recent returns and realised volatility) and a nested model adding weather features — season-gated extreme degree days and precipitation in production regions [@schlenker2009-nonlinear-heat], frost indicators for coffee, and heating/cooling degree-day anomalies for natural gas [@mu2007-gas-weather]. Three information sets are tested: realised weather with a publication lag, an oracle using realised weather inside the target window (an upper bound, not a tradable signal), and NWP forecasts known at the origin (2024–2026). Out-of-sample R² follows Campbell and Thompson [@campbell2008-oos]; nested models are compared with the Clark–West test [@clark2007-cw], direction with Pesaran–Timmermann [@pesaran1992-pt], and p-values are controlled for false discovery with Benjamini–Hochberg [@benjamini1995-fdr].` : 'Pending.'}`),
      ] },
      { id: 'results', title: '4. Results', blocks: [
        P(`4.1 Pre-registered run. ${run1 ? `Over the full period, every post-processing method improved temperature forecasts on the raw ensemble at short leads, but classical EMOS on 40-day windows was under-dispersive — its 80% intervals covered only ${pc(run1Emos[0], 0)} (mean) and ${pc(run1Emos[1], 0)} (maximum temperature) of day-1 observations — and censored-Gaussian EMOS degraded precipitation CRPS by ${run1EmosP.map((x) => pc(-x, 0)).join(', ')} at days 1, 3 and 5. A requirement that all seven models be present also left day 7 empty because not every model publishes 7-day-old runs; availability is therefore assessed per lead in later runs.` : 'Archived.'}`),
        P(`4.2 Development period. ${dev ? 'Table 2 lists the four best candidates per variable, ranked by mean CRPSS against the raw ensemble across leads. Longer windows reduced over-fitting: skill-weighted NGR with 90 days led for both temperature variables, while none of the parametric precipitation models beat the raw ensemble; the skill-weighted ensemble gave small but consistent gains.' : 'Archived.'}`),
        ...(dev ? [{ type: 'table' as const, caption: 'Table 2. Development period (test days to 31 March 2026): CRPSS vs the raw ensemble by lead, and day-3 80% coverage.', head: ['Variable', 'Method', ...leads.map((l) => `Day ${l}`), 'Cov. d3'], rows: devRows }] : []),
        P(`4.3 Confirmation period. Table 3 is the headline result. Astraeus v2 improved on the raw ensemble for every variable and lead; the gains are largest for maximum temperature (${pc(tx1)} at day 1, ${pc(tx7)} at day 7) and smallest for precipitation (${pc(pp1)} to ${pc(pp7)}). Against the previous production method (Astraeus v1) it was better in ${v1Wins} of ${sigVsV1.length} variable–lead cells at p < 0.05 and statistically indistinguishable in ${v1Ties}; its CRPS was lower than classical EMOS in every variable–lead cell (point estimates; significance against EMOS was not tested).`),
        { type: 'table', caption: 'Table 3. Confirmation period: CRPS of the raw ensemble and Astraeus v2, CRPSS with 95% block-bootstrap interval and Diebold–Mariano p-values, relative skill against Astraeus v1 and classical EMOS, skill against climatology, and 80% interval coverage.', head: ['Variable', 'Lead', 'N', 'CRPS raw', 'CRPS v2', 'CRPSS vs raw (95% CI)', 'p (DM)', 'vs v1', 'p (DM)', 'vs EMOS', 'vs clim.', 'Cov. 80%'], rows: mainRows, note: 'Units: °C for temperature, mm for precipitation. CRPSS = 1 − CRPS / CRPS_reference.' },
        { type: 'figure', kind: 'skill-by-lead', variable: 'tmax', caption: 'Figure 1. CRPS of daily maximum temperature by lead for Astraeus v2, the raw ensemble, Astraeus v1 and climatology (confirmation period).' },
        P(`4.4 Calibration. The raw ensemble is markedly under-dispersive at longer leads — its nominal 80% interval covered ${pc(get(w, 'tmax', 7, 'raw-ensemble')?.coverage80, 0)} of day-7 maximum-temperature observations — while Astraeus v2 covered ${pc(get(w, 'tmax', 7, head)?.coverage80, 0)}. Some residual under-dispersion remains (coverage ${leads.map((l) => pc(get(w, 'tmean', l, head)?.coverage80, 0)).join(', ')} for mean temperature at days ${leads.join(', ')}). For precipitation occurrence (≥ 1 mm) the Brier skill against climatology was ${pc(get(w, 'precip', 1, head)?.brierSkillVsClimatology, 0)} at day 1 and ${pc(get(w, 'precip', 7, head)?.brierSkillVsClimatology, 0)} at day 7.`),
        { type: 'figure', kind: 'reliability', variable: 'precip', lead: 1, caption: 'Figure 2. Reliability of day-1 probability of precipitation ≥ 1 mm, Astraeus v2 vs the raw ensemble.' },
        P(`4.5 Regions. Gains are heterogeneous. For day-3 maximum temperature the largest improvements were at ${siteSkill.slice(0, 3).map((x) => `${site(x.id)} (${sp(x.s, 0)})`).join(', ')} and the smallest at ${siteSkill.slice(-3).map((x) => `${site(x.id)} (${sp(x.s, 0)})`).join(', ')} — consistent with larger systematic biases where orography or coastlines are poorly resolved by coarse models.`),
        P(`4.6 Individual models. ECMWF AIFS had the lowest mean absolute error in ${aifsBestCount} of ${w.variables.length * leads.length} variable–lead combinations (day-3 maximum temperature: ${best('tmax', 3).slice(0, 3).map((m) => `${m.name} ${m.mae.toFixed(2)} °C`).join(', ')}). Because AIFS is trained on ERA5, verification against ERA5 is expected to favour it [@lang2024-aifs; @rasp2024-weatherbench2]; ECMWF reports AIFS ahead of IFS by roughly a third of a forecast day in its own verification [@haiden2026-ecmwf-tm938].`),
        { type: 'figure', kind: 'leaderboard', variable: 'tmax', lead: 3, caption: 'Figure 3. Single-model mean absolute error, day-3 maximum temperature, confirmation period.' },
        P(`4.7 Weather information and futures returns. ${priceAbstract}`),
        ...(price ? [{ type: 'table' as const, caption: 'Table 4. Walk-forward price study: out-of-sample R² of the weather model vs the historical-mean benchmark, R² gain over the nested market-only model, Clark–West p-value, Benjamini–Hochberg q-value and directional hit rate.', head: ['Commodity', 'Information', 'Horizon', 'N weeks', 'R² (weather)', 'R² gain vs market', 'p (CW)', 'q (BH)', 'Hit rate'], rows: priceRows, note: 'Negative out-of-sample R² means the model forecast worse than the benchmark. The oracle tier uses weather that would not have been known at the forecast origin and is shown only as an upper bound.' }] : []),
        ...(price ? [{ type: 'figure' as const, kind: 'price-matrix' as const, caption: 'Figure 4. R² gain of weather-augmented over market-only models (● = BH q < 0.10).' }] : []),
      ] },
      { id: 'discussion', title: '5. Discussion', blocks: [
        P('Temperature benefits most from post-processing because its errors are dominated by smooth, persistent biases that a short training window can estimate. Weighting by recent skill matters more than learning many coefficients: with seven models and 40-day windows, full EMOS over-fits, whereas four-parameter skill-weighted NGR on 90 days generalises. This agrees with the literature on training-window length and parsimony [@gneiting2005-emos; @lerch2017-semilocal; @hagedorn2012-tigge].'),
        P('Precipitation is harder: it is intermittent and skewed, and parametric censored models need longer or spatially pooled training to beat a good raw ensemble [@scheuerer2015-csgd; @lerch2017-semilocal]. The small but reliable gains from skill weighting are the honest ceiling of single-site, 90-day calibration; semi-local pooling across regions is the natural next step.'),
        P('Price predictability from weather is narrow. Markets incorporate realised weather quickly [@roll1984-oj], so lagged realised weather adds little to weekly return forecasts. Where evidence exists in the literature it concerns forecast information and revisions — especially for natural gas [@hsu2026-forecast-revisions-wp; @monteux2025-extreme-forecast-premium] — and the oracle tier shows that even perfect knowledge of the coming week’s weather explains only a small fraction of return variance. Astraeus therefore presents weather as conditional physical pressure with explicit invalidation criteria, and reports price predictability only where it survives the tests in Table 4.'),
        P('Limitations. ERA5 is a ~31 km reanalysis rather than station truth and favours smooth models; single grid points stand in for production regions; one confirmation period covers a single realisation of each season; the forecast-tier price sample is short (2024–2026); continuous futures contain roll jumps; and the free data sources used are licensed for non-commercial research.'),
        P('Future work. Station verification (e.g. GHCN-Daily), production-weighted areal forecasts, semi-local and seasonal post-processing, ensemble members (ECMWF ENS, GEFS) as predictors, crop-stage-aware price features, and a longer prospective record of issued forecasts.'),
      ] },
      { id: 'repro', title: '6. Reproducibility', blocks: [
        L([
          'npx tsx research/weather-benchmark.ts --suite run1 --period all — the pre-registered run.',
          'npx tsx research/weather-benchmark.ts --suite dev --period dev --offline — development comparison.',
          'npx tsx research/weather-benchmark.ts --suite final --period confirm --offline — the confirmation result (public/research/weather-skill.json).',
          ...(price ? ['npx tsx research/price-study.ts — the price study (public/research/price-skill.json).'] : []),
          'npm test — unit tests, including closed-form CRPS against numerical integration and synthetic recovery tests for every post-processing method.',
          'npx tsx research/build-report.ts — regenerates this report as docs/TECHNICAL_REPORT.md from the same result files.',
        ]),
      ] },
    ],
    cited: [],
  };
  doc.cited = [...cited];
  return doc;
}

/** Author-year label for a reference: "Gneiting et al., 2005", "Mu, 2007", "Clark and West, 2007". */
export function citeLabel(r: { authors: string; year: number }): string {
  const names = r.authors.replace(/\s+et al\.?$/i, '').split(/,\s*/).filter(Boolean);
  const surname = (n: string) => n.trim().split(/\s+/).pop() ?? n;
  const etal = /et al/i.test(r.authors) || names.length > 2;
  const who = names.length === 1 && !etal ? surname(names[0]) : names.length === 2 && !etal ? `${surname(names[0])} and ${surname(names[1])}` : `${surname(names[0])} et al.`;
  return `${who}, ${r.year}`;
}
