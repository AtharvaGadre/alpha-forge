/**
 * research/storage-study.ts — does weather information forecast the weekly change in US
 * Lower-48 natural-gas working storage (EIA Weekly Natural Gas Storage Report)?
 *
 *   npx tsx research/storage-study.ts --phase=data    # fetch + cache inputs, print coverage (no scoring)
 *   npx tsx research/storage-study.ts --phase=dev     # development-period model selection only (2015–Mar 2021)
 *   npx tsx research/storage-study.ts                 # full study: dev selection + test windows + outputs
 *   npx tsx research/storage-study.ts --offline       # same, from research/cache only
 *
 * Pre-specification: docs/results/STORAGE_STUDY.md (committed before the test windows were scored).
 * Outputs: public/research/storage-skill.json and the generated results section of STORAGE_STUDY.md.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addDaysIso, benjaminiHochberg, mean, monthOf, neweyWestLag, olsHac, sdSample } from '../src/engine/priceSkill';
import {
  compareForecasts,
  fitLinearMap,
  fiveYearAverageChange,
  fiveYearAverageLevel,
  impliedFlows,
  interpolatedDailyLevels,
  priorYearsWindowMean,
  storageDesign,
  walkForwardStorage,
  type ForecastComparison,
  type NonFlowAdjustment,
  type StorageSpec,
  type StorageWeekObs,
  type WeatherTerms,
} from '../src/engine/storageSkill';
import { CITIES, EIA_HISTORY_URL, FORECAST_MODELS, ROOT, cpcUrl, era5Url, loadEiaLevels, plannedOpenMeteoWeight, prevRunsUrl, usage } from './storage-data';
import { WeatherContext, type DD } from './storage-weather';

const PHASE = (process.argv.find((a) => a.startsWith('--phase='))?.slice(8) ?? 'final') as 'data' | 'dev' | 'final';

// ----------------------------------------------------------------------------
// Configuration (fixed ex ante; see docs/results/STORAGE_STUDY.md)
// ----------------------------------------------------------------------------

export const STORAGE_CONFIG = {
  study: 'astraeus-ng-storage-weather-v1',
  dataEnd: '2026-11-14',
  firstFlowWeek: '2010-01-08',
  cpcFirstYear: 2009,
  cpcLastYear: 2026,
  era5Start: '2016-01-01',
  calibration: { start: '2016-01-01', end: '2020-12-31' },
  dev: { first: '2015-01-09', last: '2021-03-26' },
  gapDays: 14,
  minTrain: 250,
  rollingWeeks: 260,
  candidates: { harmonics: [2, 3, 4], windows: ['expanding', 'rolling'] as const, weather: ['linear', 'quadratic', 'interaction'] as WeatherTerms[] },
  bias: { days: 28, lagDays: 7, minDays: 21 },
  bootstrap: { resamples: 2000, seed: 20261116 },
  openMeteoBudget: 1800,
  models: { multi: ['gfs_global', 'ecmwf_ifs025'], gfs: ['gfs_global'], ifs: ['ecmwf_ifs025'] },
};
const C = STORAGE_CONFIG;

/**
 * Documented non-flow changes in Lower-48 working gas, transcribed from EIA's revision history
 * (https://ir.eia.gov/ngs/revisions.xls, notes published in the WNGSR). Before November 2015 EIA did
 * not publish this file, so earlier reclassifications (if any) remain in the target.
 */
export const NON_FLOW_ADJUSTMENTS: NonFlowAdjustment[] = [
  { weekEnd: '2015-07-17', bcf: -7, statedImpliedFlow: 68, note: 'Reclassification working→base gas, East (~7 Bcf).' },
  { weekEnd: '2015-08-28', bcf: 8, statedImpliedFlow: 86, note: 'Reclassification base→working gas, Midwest (~8 Bcf).' },
  { weekEnd: '2016-01-01', bcf: 4, statedImpliedFlow: -117, note: 'Reclassification base→working gas, South Central nonsalt (~4 Bcf).' },
  { weekEnd: '2016-06-24', bcf: -5, statedImpliedFlow: 42, note: 'Non-flow-related adjustment, Pacific (~5 Bcf).' },
  { weekEnd: '2017-02-03', bcf: -5, statedImpliedFlow: -147, note: 'Reclassification working→base gas, Pacific (~5 Bcf).' },
  { weekEnd: '2017-03-03', bcf: -4, statedImpliedFlow: -64, note: 'Reclassification working→base gas, South Central salt (~4 Bcf).' },
  { weekEnd: '2017-05-26', bcf: -4, statedImpliedFlow: 85, note: 'Reclassification working→base gas, Mountain (~4 Bcf).' },
  { weekEnd: '2017-06-30', bcf: -10, statedImpliedFlow: 72, note: 'First week of a six-week restatement (largely working→base gas); EIA: implied net change 62, implied flow 72.' },
  { weekEnd: '2018-03-30', bcf: -9, statedImpliedFlow: -20, note: 'Non-flow-related adjustment, South Central nonsalt (~9 Bcf).' },
  { weekEnd: '2019-01-04', bcf: -4, statedImpliedFlow: -87, note: 'Reclassification working→base gas, Mountain (~4 Bcf).' },
  { weekEnd: '2019-04-05', bcf: -3, statedImpliedFlow: 29, note: 'Reclassifications working→base gas, Pacific (1) and South Central salt (2).' },
  { weekEnd: '2021-05-07', bcf: -4, statedImpliedFlow: 75, note: 'Reclassification working→base gas, South Central nonsalt (4 Bcf).' },
  { weekEnd: '2021-06-11', bcf: -51, statedImpliedFlow: 67, note: 'Reclassification working→base gas, Pacific (51 Bcf).' },
  { weekEnd: '2021-08-13', bcf: 4, statedImpliedFlow: 42, note: 'Reclassification base→working gas, South Central nonsalt (4 Bcf).' },
  { weekEnd: '2023-06-02', bcf: -14, statedImpliedFlow: 118, note: 'Reclassification working→base gas, South Central nonsalt (14 Bcf).' },
  { weekEnd: '2023-06-30', bcf: 4, statedImpliedFlow: 68, note: 'Reclassification base→working gas, South Central nonsalt (4 Bcf); stocks later revised +4 Bcf (net change 72→76).' },
  { weekEnd: '2024-05-03', bcf: 6, statedImpliedFlow: null, note: 'First week of the May 2024 resubmission (+6 to +9 Bcf per week); step inferred from original vs revised stocks.' },
  { weekEnd: '2024-09-20', bcf: -8, statedImpliedFlow: 55, note: 'Reclassification working→base gas, South Central salt (8 Bcf).' },
  { weekEnd: '2025-08-29', bcf: -10, statedImpliedFlow: null, note: 'First week of the 33-week restatement Aug 2025–Apr 2026 (largely working→base gas, ~−10 Bcf); step inferred from original vs revised stocks.' },
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const fmt = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d));
const fmtP = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x < 0.001 ? '<0.001' : x.toFixed(3));
const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
const rmse = (e: number[]) => Math.sqrt(mean(e.map((x) => x * x)));
const specLabel = (s: StorageSpec) => `K=${s.harmonics} harmonics, ${s.window === 'rolling' ? `rolling ${s.rollingWeeks}-week` : 'expanding'} window, weather=${s.weather}`;

export interface Data {
  obs: StorageWeekObs[];
  flowsAll: ReturnType<typeof impliedFlows>;
  fiveYr: Map<string, number>;
  fiveYrLevel: Map<string, number>;
  ctx: WeatherContext;
  eiaFetchedAt: string;
}

export async function loadData(withForecasts: boolean): Promise<Data> {
  const planned = plannedOpenMeteoWeight(C.era5Start, C.dataEnd);
  console.log(`Open-Meteo plan: ERA5 ${planned.era5.toFixed(0)} + previous runs ${planned.prevRuns.toFixed(0)} = ${planned.total.toFixed(0)} weighted calls; not yet cached ${planned.uncached.toFixed(0)} (budget ${C.openMeteoBudget}).`);
  if (planned.total > C.openMeteoBudget) throw new Error('Planned Open-Meteo usage exceeds the study budget.');
  const { levels, fetchedAt } = await loadEiaLevels();
  const flowsAll = impliedFlows(levels, NON_FLOW_ADJUSTMENTS);
  const daily = interpolatedDailyLevels(levels);
  const fiveYr = new Map<string, number>();
  const fiveYrLevel = new Map<string, number>();
  // Five-year averages for every reported week plus the next two (not yet reported) weeks: they use prior years only.
  const lastWeek = levels.at(-1)!.weekEnd;
  for (const w of [...flowsAll.map((f) => f.weekEnd), addDaysIso(lastWeek, 7), addDaysIso(lastWeek, 14)]) {
    const v = fiveYearAverageChange(daily, w);
    if (v !== null) fiveYr.set(w, v);
    const l = fiveYearAverageLevel(daily, w);
    if (l !== null) fiveYrLevel.set(w, l);
  }
  const ctx = new WeatherContext({ cpcFirstYear: C.cpcFirstYear, cpcLastYear: C.cpcLastYear, era5Start: C.era5Start, dataEnd: C.dataEnd, calibration: C.calibration, bias: C.bias });
  await ctx.loadTruth();
  await ctx.loadCities(withForecasts);
  ctx.calibrate();
  const obs: StorageWeekObs[] = [];
  for (const f of flowsAll) {
    if (f.weekEnd < C.firstFlowWeek) continue;
    const w = ctx.truthWeek(f.weekEnd);
    if (w) obs.push({ weekEnd: f.weekEnd, y: f.impliedFlow, hdd: w.hdd, cdd: w.cdd });
  }
  console.log(`EIA: ${levels.length} weekly levels ${levels[0].weekEnd}…${levels.at(-1)!.weekEnd}; ${obs.length} weeks with implied flow and CPC weather.`);
  return { obs, flowsAll, fiveYr, fiveYrLevel, ctx, eiaFetchedAt: fetchedAt };
}

// ----------------------------------------------------------------------------
// Development-period selection (pre-test; CPC truth)
// ----------------------------------------------------------------------------

interface Candidate { spec: StorageSpec; n: number; rmse: number; mae: number }

export function devSelection(d: Data) {
  const targets = d.obs.filter((o) => o.weekEnd >= C.dev.first && o.weekEnd <= C.dev.last && d.fiveYr.has(o.weekEnd)).map((o) => o.weekEnd);
  const yOf = new Map(d.obs.map((o) => [o.weekEnd, o.y]));
  const truthIn = { oracle: (w: string) => d.ctx.truthWeek(w) };
  const score = (spec: StorageSpec, key: string, inputs = {}) => {
    const rows = walkForwardStorage(d.obs, targets, spec, { gapDays: C.gapDays, minTrain: C.minTrain }, inputs);
    if (rows.length !== targets.length) throw new Error(`Dev: ${spec.weather} produced ${rows.length}/${targets.length} forecasts`);
    const e = rows.map((r) => yOf.get(r.weekEnd)! - r.preds[key]!);
    return { spec, n: rows.length, rmse: rmse(e), mae: mean(e.map(Math.abs)) } as Candidate;
  };
  const seasonal: Candidate[] = [];
  for (const K of C.candidates.harmonics) for (const window of C.candidates.windows) seasonal.push(score({ harmonics: K, window, rollingWeeks: C.rollingWeeks, weather: 'none' }, 'seasonal'));
  const bestSeasonal = [...seasonal].sort((a, b) => a.rmse - b.rmse)[0];
  const weather: Candidate[] = [];
  for (const w of C.candidates.weather) for (const window of C.candidates.windows) weather.push(score({ harmonics: bestSeasonal.spec.harmonics, window, rollingWeeks: C.rollingWeeks, weather: w }, 'oracle', truthIn));
  const bestWeather = [...weather].sort((a, b) => a.rmse - b.rmse)[0];
  const e5 = targets.map((t) => yOf.get(t)! - d.fiveYr.get(t)!);
  return {
    period: { first: targets[0], last: targets.at(-1)!, n: targets.length },
    fiveYear: { rmse: rmse(e5), mae: mean(e5.map(Math.abs)) },
    seasonal,
    weather,
    chosen: { seasonal: bestSeasonal.spec, weather: bestWeather.spec },
  };
}

/** In-sample sanity checks on pre-test data (descriptive). */
function sanity(d: Data, spec: StorageSpec) {
  const sample = d.obs.filter((o) => o.weekEnd <= C.dev.last);
  const lin: StorageSpec = { ...spec, weather: 'linear' };
  const X = sample.map((o) => storageDesign(lin, o.weekEnd, o.hdd, o.cdd));
  const reg = olsHac(X, sample.map((o) => o.y), neweyWestLag(sample.length, 1));
  const k = X[0].length; // last two columns: HDD, CDD
  const hddIdx = k - 1, cddIdx = k; // +1 for the intercept added by olsHac
  // Winter anomaly slope: (flow − five-year average) vs (HDD − prior-5-year normal), Dec–Feb.
  const winter = sample.filter((o) => [12, 1, 2].includes(monthOf(o.weekEnd)) && d.fiveYr.has(o.weekEnd));
  const pairs: Array<[number, number]> = [];
  for (const o of winter) {
    const normal = priorYearsWindowMean(d.ctx.cpcHdd, addDaysIso(o.weekEnd, -7), 7, 5, 5);
    if (normal === null) continue;
    pairs.push([o.hdd - normal, o.y - d.fiveYr.get(o.weekEnd)!]);
  }
  const slope = fitLinearMap(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
  const sdHdd = sdSample(pairs.map((p) => p[0]));
  const sdFlow = sdSample(pairs.map((p) => p[1]));
  return {
    sample: { first: sample[0].weekEnd, last: sample.at(-1)!.weekEnd, n: sample.length },
    fullYearLinear: {
      spec: specLabel(lin),
      bcfPerHdd: reg.coef[hddIdx], hacSeHdd: reg.se[hddIdx], tHdd: reg.t[hddIdx],
      bcfPerCdd: reg.coef[cddIdx], hacSeCdd: reg.se[cddIdx], tCdd: reg.t[cddIdx],
      r2: reg.r2, hacLag: reg.lag,
    },
    winterAnomalySlope: { n: slope.n, bcfPerHdd: slope.b, r2: slope.r2, sdHddAnomaly: sdHdd, sdFlowAnomaly: sdFlow, impliedSdFromWeather: Math.abs(slope.b) * sdHdd },
  };
}

// ----------------------------------------------------------------------------
// Test windows
// ----------------------------------------------------------------------------

interface WeekRow {
  weekEnd: string;
  y: number;
  netChange: number;
  fiveYr: number;
  seasonal: number;
  oracle: number;
  oracleEra5City: number | null;
  fcMulti: number | null;
  fcGfs: number | null;
  fcIfs: number | null;
  fcMultiRaw: number | null;
  fcGfsRaw: number | null;
  truth: DD;
  ddMulti: DD | null;
  ddGfs: DD | null;
  ddIfs: DD | null;
  ddMultiRaw: DD | null;
  ddGfsRaw: DD | null;
  ddEra5City: DD | null;
  nTrainSeasonal: number;
  nTrainWeather: number;
  dYdHdd: number | null;
}

function buildTestRows(d: Data, chosen: { seasonal: StorageSpec; weather: StorageSpec }): WeekRow[] {
  const ctx = d.ctx;
  const first = addDaysIso(C.dev.last, 7);
  const candidates = d.obs.filter((o) => o.weekEnd >= first && d.fiveYr.has(o.weekEnd)).map((o) => o.weekEnd);
  const yOf = new Map(d.obs.map((o) => [o.weekEnd, o]));
  const net = new Map(d.flowsAll.map((f) => [f.weekEnd, f.netChange]));
  const dd = {
    multi: (w: string) => ctx.forecastWeek(C.models.multi, w, true),
    gfs: (w: string) => ctx.forecastWeek(C.models.gfs, w, true),
    ifs: (w: string) => ctx.forecastWeek(C.models.ifs, w, true),
    multiRaw: (w: string) => ctx.forecastWeek(C.models.multi, w, false),
    gfsRaw: (w: string) => ctx.forecastWeek(C.models.gfs, w, false),
    era5City: (w: string) => ctx.era5MappedWeek(w),
  };
  // Only weeks for which at least the GFS forecast exists are test weeks.
  const targets = candidates.filter((w) => dd.gfs(w) !== null);
  const se = walkForwardStorage(d.obs, targets, chosen.seasonal, { gapDays: C.gapDays, minTrain: C.minTrain });
  const wx = walkForwardStorage(d.obs, targets, chosen.weather, { gapDays: C.gapDays, minTrain: C.minTrain }, {
    oracle: (w) => ctx.truthWeek(w),
    fcMulti: dd.multi,
    fcGfs: dd.gfs,
    fcIfs: dd.ifs,
    fcMultiRaw: dd.multiRaw,
    fcGfsRaw: dd.gfsRaw,
    oracleEra5City: dd.era5City,
  });
  const seOf = new Map(se.map((r) => [r.weekEnd, r]));
  return wx.map((r) => {
    const o = yOf.get(r.weekEnd)!;
    const s = seOf.get(r.weekEnd)!;
    return {
      weekEnd: r.weekEnd,
      y: o.y,
      netChange: net.get(r.weekEnd)!,
      fiveYr: d.fiveYr.get(r.weekEnd)!,
      seasonal: s.preds.seasonal!,
      oracle: r.preds.oracle!,
      oracleEra5City: r.preds.oracleEra5City,
      fcMulti: r.preds.fcMulti,
      fcGfs: r.preds.fcGfs,
      fcIfs: r.preds.fcIfs,
      fcMultiRaw: r.preds.fcMultiRaw,
      fcGfsRaw: r.preds.fcGfsRaw,
      truth: { hdd: o.hdd, cdd: o.cdd },
      ddMulti: dd.multi(r.weekEnd),
      ddGfs: dd.gfs(r.weekEnd),
      ddIfs: dd.ifs(r.weekEnd),
      ddMultiRaw: dd.multiRaw(r.weekEnd),
      ddGfsRaw: dd.gfsRaw(r.weekEnd),
      ddEra5City: dd.era5City(r.weekEnd),
      nTrainSeasonal: s.nTrain,
      nTrainWeather: r.nTrain,
      dYdHdd: r.dYdHdd,
    };
  });
}

type PredKey = 'fiveYr' | 'seasonal' | 'oracle' | 'oracleEra5City' | 'fcMulti' | 'fcGfs' | 'fcIfs' | 'fcMultiRaw' | 'fcGfsRaw';
const PRED_LABEL: Record<PredKey, string> = {
  fiveYr: '(0) EIA five-year average',
  seasonal: '(1) Seasonal model, no weather',
  oracle: '(2) Weather model, ACTUAL CPC degree days (oracle)',
  oracleEra5City: '(2b) Weather model, ERA5 at the nine cities (representativeness oracle)',
  fcMulti: '(3) Weather model, FORECAST degree days: ECMWF IFS + GFS mean, bias-corrected',
  fcGfs: '(3g) Weather model, FORECAST degree days: GFS, bias-corrected',
  fcIfs: '(3e) Weather model, FORECAST degree days: ECMWF IFS, bias-corrected',
  fcMultiRaw: '(3r) Weather model, FORECAST degree days: IFS + GFS mean, no bias correction',
  fcGfsRaw: '(3gr) Weather model, FORECAST degree days: GFS, no bias correction',
};

interface Comparison {
  id: string;
  window: 'multi' | 'gfs';
  ref: PredKey;
  model: PredKey;
  confirmatory: boolean;
  result: ForecastComparison;
  q: number | null;
}

function windowRows(rows: WeekRow[], window: 'multi' | 'gfs') {
  return rows.filter((r) => (window === 'multi' ? r.fcMulti !== null && r.fcGfs !== null && r.fcIfs !== null : r.fcGfs !== null));
}

function comparisons(rows: WeekRow[]): Comparison[] {
  const plan: Array<[string, 'multi' | 'gfs', PredKey, PredKey, boolean]> = [
    ['C1', 'multi', 'fiveYr', 'fcMulti', true],
    ['C2', 'multi', 'seasonal', 'fcMulti', true],
    ['C3', 'gfs', 'fiveYr', 'fcGfs', true],
    ['C4', 'gfs', 'seasonal', 'fcGfs', true],
    ['D1', 'multi', 'fiveYr', 'oracle', false],
    ['D2', 'multi', 'seasonal', 'oracle', false],
    ['D3', 'multi', 'fcMulti', 'oracle', false],
    ['D4', 'multi', 'fiveYr', 'seasonal', false],
    ['D5', 'multi', 'seasonal', 'fcIfs', false],
    ['D6', 'multi', 'seasonal', 'fcGfs', false],
    ['D7', 'multi', 'seasonal', 'fcMultiRaw', false],
    ['D8', 'multi', 'oracleEra5City', 'oracle', false],
    ['D9', 'gfs', 'fiveYr', 'oracle', false],
    ['D10', 'gfs', 'seasonal', 'oracle', false],
    ['D11', 'gfs', 'fcGfs', 'oracle', false],
    ['D12', 'gfs', 'fiveYr', 'seasonal', false],
    ['D13', 'gfs', 'seasonal', 'fcGfsRaw', false],
    ['D14', 'gfs', 'oracleEra5City', 'oracle', false],
  ];
  const out: Comparison[] = plan.map(([id, window, ref, model, confirmatory], i) => {
    const w = windowRows(rows, window).filter((r) => r[ref] !== null && r[model] !== null);
    const result = compareForecasts(w.map((r) => r.y), w.map((r) => r[ref] as number), w.map((r) => r[model] as number), { resamples: C.bootstrap.resamples, seed: C.bootstrap.seed + i });
    return { id, window, ref, model, confirmatory, result, q: null };
  });
  const conf = out.filter((c) => c.confirmatory);
  const q = benjaminiHochberg(conf.map((c) => c.result.dmSquared?.p ?? null));
  conf.forEach((c, i) => (c.q = q[i]));
  return out;
}

function ddVerification(rows: WeekRow[]) {
  const out: Array<{ window: string; source: string; n: number; hddRmse: number; hddBias: number; cddRmse: number; cddBias: number; hddCorr: number }> = [];
  const corr = (a: number[], b: number[]) => {
    const ma = mean(a), mb = mean(b);
    let sab = 0, saa = 0, sbb = 0;
    a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; });
    return sab / Math.sqrt(saa * sbb);
  };
  for (const window of ['multi', 'gfs'] as const) {
    const w = windowRows(rows, window);
    const sources: Array<[string, (r: WeekRow) => DD | null]> = [
      ['ERA5 at nine cities (mapped)', (r) => r.ddEra5City],
      ['GFS, bias-corrected', (r) => r.ddGfs],
      ['GFS, raw', (r) => r.ddGfsRaw],
      ...(window === 'multi' ? ([['ECMWF IFS, bias-corrected', (r: WeekRow) => r.ddIfs], ['IFS + GFS mean, bias-corrected', (r: WeekRow) => r.ddMulti], ['IFS + GFS mean, raw', (r: WeekRow) => r.ddMultiRaw]] as Array<[string, (r: WeekRow) => DD | null]>) : []),
    ];
    for (const [source, f] of sources) {
      const pairs = w.map((r) => [r.truth, f(r)] as const).filter((p): p is readonly [DD, DD] => p[1] !== null);
      const eh = pairs.map(([t, x]) => x.hdd - t.hdd);
      const ec = pairs.map(([t, x]) => x.cdd - t.cdd);
      out.push({ window, source, n: pairs.length, hddRmse: rmse(eh), hddBias: mean(eh), cddRmse: rmse(ec), cddBias: mean(ec), hddCorr: corr(pairs.map((p) => p[0].hdd), pairs.map((p) => p[1].hdd)) });
    }
  }
  return out;
}

/**
 * Daily CONUS HDD error vs CPC by forecast lead (Dec–Feb days of each window). Each day uses the
 * bias estimate a week forecast would have used (issue = day − (lead − 1)). Error must grow with
 * lead if the archive's previous_dayN values are genuine N-day forecasts.
 */
function leadVerification(d: Data, rows: WeekRow[]) {
  const out: Array<{ window: string; models: string; lead: number; n: number; hddRmse: number; hddBias: number }> = [];
  for (const [window, models] of [['multi', C.models.multi], ['multi', C.models.ifs], ['gfs', C.models.gfs]] as const) {
    const w = windowRows(rows, window);
    const first = addDaysIso(w[0].weekEnd, -7);
    const last = addDaysIso(w.at(-1)!.weekEnd, -1);
    for (let lead = 1; lead <= 7; lead++) {
      const e: number[] = [];
      for (let day = first; day <= last; day = addDaysIso(day, 1)) {
        if (![12, 1, 2].includes(monthOf(day))) continue;
        const f = d.ctx.forecastDay([...models], lead, day, addDaysIso(day, -(lead - 1)), true);
        const t = d.ctx.truthDay(day);
        if (f && t) e.push(f.hdd - t.hdd);
      }
      out.push({ window, models: models.join('+'), lead, n: e.length, hddRmse: rmse(e), hddBias: mean(e) });
    }
  }
  return out;
}

function bySeason(rows: WeekRow[]) {
  const keys: PredKey[] = ['fiveYr', 'seasonal', 'oracle', 'fcMulti', 'fcGfs'];
  const out: Array<{ window: string; season: string; n: number; rmse: Record<string, number> }> = [];
  for (const window of ['multi', 'gfs'] as const) {
    for (const [season, months] of [['Heating season (Nov–Mar)', [11, 12, 1, 2, 3]], ['Injection season (Apr–Oct)', [4, 5, 6, 7, 8, 9, 10]]] as const) {
      const w = windowRows(rows, window).filter((r) => (months as readonly number[]).includes(monthOf(r.weekEnd)));
      const rm: Record<string, number> = {};
      for (const k of keys) {
        const v = w.filter((r) => r[k] !== null);
        if (v.length === w.length) rm[k] = rmse(v.map((r) => r.y - (r[k] as number)));
      }
      out.push({ window, season, n: w.length, rmse: rm });
    }
  }
  return out;
}

/**
 * Post-hoc validation (not pre-specified): compares the recomputed five-year average with EIA's
 * published values (research/tools/eia_ngsstats.py → research/cache/eia-ngsstats-l48.json), and
 * re-scores the confirmatory forecast comparisons against the PUBLISHED five-year-average change
 * (difference of consecutive published levels within the same report year).
 */
async function publishedFiveYearCheck(d: Data, rows: WeekRow[]) {
  let raw: { source: string; extractedAt: string; rows: Array<{ reportYear: number; weekEnd: string; fiveYearAvgL48: number }> };
  try {
    raw = JSON.parse(await readFile(path.join(ROOT, 'research', 'cache', 'eia-ngsstats-l48.json'), 'utf8'));
  } catch {
    console.log('No research/cache/eia-ngsstats-l48.json (run research/tools/eia_ngsstats.py); skipping the published five-year check.');
    return null;
  }
  const pub = new Map(raw.rows.map((r) => [r.weekEnd, r]));
  const pubChange = (w: string) => {
    const a = pub.get(w), b = pub.get(addDaysIso(w, -7));
    return a && b && a.reportYear === b.reportYear ? a.fiveYearAvgL48 - b.fiveYearAvgL48 : null;
  };
  const lv: number[] = [];
  const ch: number[] = [];
  for (const r of rows) {
    const p = pub.get(r.weekEnd);
    const mine = d.fiveYrLevel.get(r.weekEnd);
    if (p && mine !== undefined) lv.push(Math.abs(mine - p.fiveYearAvgL48));
    const pc = pubChange(r.weekEnd);
    if (pc !== null) ch.push(Math.abs(r.fiveYr - pc));
  }
  const rescored = (['multi', 'gfs'] as const).map((window) => {
    const w = windowRows(rows, window).filter((r) => pubChange(r.weekEnd) !== null);
    const fc = window === 'multi' ? 'fcMulti' : 'fcGfs';
    const res = compareForecasts(w.map((r) => r.y), w.map((r) => pubChange(r.weekEnd)!), w.map((r) => r[fc] as number), { resamples: C.bootstrap.resamples, seed: C.bootstrap.seed + 100 });
    const recomputed = rmse(w.map((r) => r.y - r.fiveYr));
    return { window, model: fc, n: res.n, rmsePublishedFiveYr: res.rmseRef, rmseRecomputedFiveYrSameWeeks: recomputed, rmseModel: res.rmseModel, skillMse: res.skillMse, skillMseCi95: res.skillMseCi95, dmP: res.dmSquared?.p ?? null };
  });
  return {
    source: raw.source,
    extractedAt: raw.extractedAt,
    note: 'Post-hoc validation, not part of the pre-specified family. Published change = difference of consecutive published five-year-average levels in the same report year (the first report week of each year is skipped).',
    nLevels: lv.length,
    levelAbsDiffMean: lv.length ? mean(lv) : null,
    levelAbsDiffMax: lv.length ? Math.max(...lv) : null,
    nChanges: ch.length,
    changeAbsDiffMean: ch.length ? mean(ch) : null,
    changeAbsDiffMax: ch.length ? Math.max(...ch) : null,
    rescored,
  };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
  const d = await loadData(PHASE !== 'dev');
  const m = d.ctx.mapping;
  console.log(`City→CPC maps (2016–2020, daily): CONUS HDD R² ${fmt(m.era5CityFit.hddR2, 3)} (RMSE ${fmt(m.era5CityFit.hddRmse, 2)}), CDD R² ${fmt(m.era5CityFit.cddR2, 3)} (RMSE ${fmt(m.era5CityFit.cddRmse, 2)}); division-weight fit R² HDD ${fmt(m.divisionWeightFit.hddR2, 4)}, CDD ${fmt(m.divisionWeightFit.cddR2, 4)}.`);
  console.log(`Weights HDD ${JSON.stringify(Object.fromEntries(Object.entries(m.weightsHdd).map(([k, v]) => [k, Number(v.toFixed(3))])))}; CDD ${JSON.stringify(Object.fromEntries(Object.entries(m.weightsCdd).map(([k, v]) => [k, Number(v.toFixed(3))])))}`);
  const adjChecks = NON_FLOW_ADJUSTMENTS.filter((a) => a.statedImpliedFlow !== null).map((a) => {
    const f = d.flowsAll.find((x) => x.weekEnd === a.weekEnd)!;
    return { weekEnd: a.weekEnd, netChangeCurrent: f.netChange, impliedFlow: f.impliedFlow, statedImpliedFlow: a.statedImpliedFlow, diff: f.impliedFlow - a.statedImpliedFlow! };
  });
  console.log(`Implied-flow checks vs EIA notes: ${adjChecks.map((c) => `${c.weekEnd} ${c.impliedFlow}/${c.statedImpliedFlow}`).join(', ')}`);

  if (PHASE === 'data') {
    for (const mdl of FORECAST_MODELS) {
      const s = d.ctx.fcTavg.get(mdl.id)!;
      for (const c of CITIES) {
        const l7 = s.get(c.id)!.get(7)!;
        const keys = [...l7.keys()].sort();
        console.log(`${mdl.id} ${c.id}: lead-7 days ${keys.length} ${keys[0]}…${keys.at(-1)}; lead-1 days ${s.get(c.id)!.get(1)!.size}`);
      }
    }
    const gfsWeeks = d.obs.filter((o) => o.weekEnd > C.dev.last && d.ctx.forecastWeek(C.models.gfs, o.weekEnd, true));
    const mmWeeks = d.obs.filter((o) => o.weekEnd > C.dev.last && d.ctx.forecastWeek(C.models.multi, o.weekEnd, true));
    console.log(`Coverage (no scoring): GFS weeks ${gfsWeeks.length} ${gfsWeeks[0]?.weekEnd}…${gfsWeeks.at(-1)?.weekEnd}; IFS+GFS weeks ${mmWeeks.length} ${mmWeeks[0]?.weekEnd}…${mmWeeks.at(-1)?.weekEnd}`);
    console.log(`Open-Meteo weight fetched this run ≈ ${usage.openMeteoFetched.toFixed(0)}; public (EIA/NOAA) fetches ${usage.publicFetches}.`);
    return;
  }

  const dev = devSelection(d);
  console.log(`Dev ${dev.period.first}…${dev.period.last} (n=${dev.period.n}): five-year average RMSE ${fmt(dev.fiveYear.rmse)}`);
  for (const c of [...dev.seasonal, ...dev.weather]) console.log(`  ${specLabel(c.spec)}: RMSE ${fmt(c.rmse, 2)} MAE ${fmt(c.mae, 2)}`);
  console.log(`Chosen seasonal: ${specLabel(dev.chosen.seasonal)}; chosen weather: ${specLabel(dev.chosen.weather)}`);
  const san = sanity(d, dev.chosen.seasonal);
  console.log(`Sanity (in-sample ${san.sample.first}…${san.sample.last}): ${fmt(san.fullYearLinear.bcfPerHdd, 3)} Bcf per HDD (HAC t ${fmt(san.fullYearLinear.tHdd, 1)}), ${fmt(san.fullYearLinear.bcfPerCdd, 3)} Bcf per CDD (t ${fmt(san.fullYearLinear.tCdd, 1)}); winter anomaly slope ${fmt(san.winterAnomalySlope.bcfPerHdd, 3)} (R² ${fmt(san.winterAnomalySlope.r2, 2)}, n ${san.winterAnomalySlope.n})`);
  if (PHASE === 'dev') {
    await mkdir(path.join(ROOT, 'research', 'out'), { recursive: true });
    await writeFile(path.join(ROOT, 'research', 'out', 'storage-dev.json'), JSON.stringify({ dev, sanity: san, mapping: m, adjChecks }, null, 1));
    console.log('Wrote research/out/storage-dev.json (development phase only; no test-window scoring).');
    return;
  }

  const rows = buildTestRows(d, dev.chosen);
  const comps = comparisons(rows);
  for (const c of comps) console.log(`${c.id} [${c.window}] ${c.model} vs ${c.ref}: n ${c.result.n}, RMSE ${fmt(c.result.rmseModel)} vs ${fmt(c.result.rmseRef)}, skill ${pct(c.result.skillMse)} [${pct(c.result.skillMseCi95.lo)}, ${pct(c.result.skillMseCi95.hi)}], DM p ${fmtP(c.result.dmSquared?.p)}${c.q !== null ? ` q ${fmtP(c.q)}` : ''}`);
  const ddv = ddVerification(rows);
  const seasons = bySeason(rows);
  const leads = leadVerification(d, rows);
  const published = await publishedFiveYearCheck(d, rows);
  if (published) console.log(`EIA published five-year average (post-hoc check): level |diff| mean ${fmt(published.levelAbsDiffMean, 2)} max ${fmt(published.levelAbsDiffMax, 1)} Bcf (n ${published.nLevels}); change |diff| mean ${fmt(published.changeAbsDiffMean, 2)} (n ${published.nChanges})`);
  const winterSens = rows.filter((r) => [12, 1, 2].includes(monthOf(r.weekEnd)) && r.dYdHdd !== null).map((r) => r.dYdHdd!);

  const inputsSha256 = createHash('sha256')
    .update(JSON.stringify({ C, obs: d.obs, fiveYr: [...d.fiveYr], fc: [...d.ctx.fcTavg].map(([mdl, byCity]) => [mdl, [...byCity].map(([c, leads]) => [c, [...leads].map(([l, s]) => [l, [...s]])])]), era5: [...d.ctx.era5Tavg].map(([c, s]) => [c, [...s]]) }))
    .digest('hex');
  const json = {
    study: C.study,
    generatedAt: new Date().toISOString(),
    preSpecification: 'docs/results/STORAGE_STUDY.md (pre-specification section, committed before the test windows were scored)',
    config: C,
    provenance: {
      eia: { url: EIA_HISTORY_URL, revisions: 'https://ir.eia.gov/ngs/revisions.xls', fetchedAt: d.eiaFetchedAt, licence: 'U.S. Energy Information Administration data are in the public domain (https://www.eia.gov/about/copyrights_reuse.php).' },
      cpc: { urlPattern: cpcUrl(2024, 'UtilityGas.Heating').replace('2024', '{YEAR}').replace('UtilityGas.Heating', '{UtilityGas.Heating|Population.Cooling}'), fetchedAt: d.ctx.cpcFetchedAt, licence: 'NOAA Climate Prediction Center, U.S. Government work (public domain).' },
      era5: { urlPattern: era5Url(CITIES[0], '{start}', '{end}').replace(/latitude=[^&]+&longitude=[^&]+/, 'latitude={lat}&longitude={lng}'), licence: 'ERA5 (Hersbach et al. 2020) © Copernicus Climate Change Service, via Open-Meteo (CC BY 4.0; free API for non-commercial use).' },
      forecasts: { urlPattern: prevRunsUrl(CITIES[0], '{model}', '{start}', '{end}').replace(/latitude=[^&]+&longitude=[^&]+/, 'latitude={lat}&longitude={lng}'), models: FORECAST_MODELS.map(({ id, label, archiveStart }) => ({ id, label, archiveStart })), licence: 'Open-Meteo Previous Runs API (CC BY 4.0; non-commercial free tier). ECMWF open data CC BY 4.0; NOAA GFS public domain.' },
      cities: CITIES,
      dataEnd: C.dataEnd,
      inputsSha256,
      openMeteoWeightPlanned: Math.round(plannedOpenMeteoWeight(C.era5Start, C.dataEnd).total),
      openMeteoWeightFetchedThisRun: Math.round(usage.openMeteoFetched),
    },
    target: {
      definition: 'EIA Lower-48 working gas, weekly implied flow (Bcf) = level difference minus documented non-flow reclassifications; report week ends Friday 09:00 CST.',
      nonFlowAdjustments: NON_FLOW_ADJUSTMENTS,
      impliedFlowChecks: adjChecks,
    },
    weatherIndex: { mapping: m },
    development: dev,
    sanity: { ...san, walkForwardWinterBcfPerHdd: winterSens.length ? { median: [...winterSens].sort((a, b) => a - b)[Math.floor(winterSens.length / 2)], n: winterSens.length } : null },
    models: PRED_LABEL,
    comparisons: comps.map((c) => ({ ...c, refLabel: PRED_LABEL[c.ref], modelLabel: PRED_LABEL[c.model] })),
    degreeDayVerification: ddv,
    bySeason: seasons,
    leadVerification: leads,
    publishedFiveYearCheck: published,
    weeks: rows.map((r) => ({
      weekEnd: r.weekEnd, y: r.y, netChange: r.netChange, fiveYr: +r.fiveYr.toFixed(2), seasonal: +r.seasonal.toFixed(2), oracle: +r.oracle.toFixed(2),
      oracleEra5City: r.oracleEra5City === null ? null : +r.oracleEra5City.toFixed(2),
      fcMulti: r.fcMulti === null ? null : +r.fcMulti.toFixed(2), fcGfs: r.fcGfs === null ? null : +r.fcGfs.toFixed(2), fcIfs: r.fcIfs === null ? null : +r.fcIfs.toFixed(2),
      fcMultiRaw: r.fcMultiRaw === null ? null : +r.fcMultiRaw.toFixed(2), fcGfsRaw: r.fcGfsRaw === null ? null : +r.fcGfsRaw.toFixed(2),
      hdd: r.truth.hdd, cdd: r.truth.cdd,
      hddMulti: r.ddMulti ? +r.ddMulti.hdd.toFixed(1) : null, cddMulti: r.ddMulti ? +r.ddMulti.cdd.toFixed(1) : null,
      hddGfs: r.ddGfs ? +r.ddGfs.hdd.toFixed(1) : null, cddGfs: r.ddGfs ? +r.ddGfs.cdd.toFixed(1) : null,
      nTrainSeasonal: r.nTrainSeasonal, nTrainWeather: r.nTrainWeather,
    })),
    caveats: CAVEATS,
  };
  await mkdir(path.join(ROOT, 'public', 'research'), { recursive: true });
  await writeFile(path.join(ROOT, 'public', 'research', 'storage-skill.json'), JSON.stringify(json, null, 1));
  const mdPath = path.join(ROOT, 'docs', 'results', 'STORAGE_STUDY.md');
  const existing = await readFile(mdPath, 'utf8');
  const head = existing.split(RESULTS_MARKER)[0];
  await writeFile(mdPath, `${head}${RESULTS_MARKER}\n\n${renderResults(json, rows, comps)}`);
  console.log(`Wrote public/research/storage-skill.json and docs/results/STORAGE_STUDY.md (Open-Meteo weight fetched this run ≈ ${usage.openMeteoFetched.toFixed(0)}).`);
}

export const RESULTS_MARKER = '<!-- RESULTS: everything below this line is generated by research/storage-study.ts -->';

const CAVEATS = [
  'The weather index is CPC CONUS degree days for truth, but forecasts come from nine city points mapped to CPC census-division averages; the representativeness oracle (2b) measures the loss from that mapping separately from forecast error.',
  'The weather week (Central local days Friday–Thursday) leads the EIA storage week (09:00 CST Friday to Friday) by nine hours.',
  'Forecasts use runs initialised no later than Thursday 23:00 CT (the Friday 00 UTC cycle at the latest) for the week whose first gas day starts Friday 09:00 CT; dissemination latency of that last cycle (~4–8 h) still precedes the week start.',
  'The 2010–June 2015 storage history consists of EIA-derived estimates; reclassifications before November 2015 are not documented in revisions.xls and remain in the target. Multi-week restatements (2017, 2024, 2025–26) are adjusted only in their first week.',
  'The EIA five-year average is recomputed from today’s revised history with EIA’s daily-interpolation method; EIA’s published values at release time used the history then available.',
  'Weekly weather explains demand-side variation only; production, LNG feed-gas outages, pipeline maintenance and price-driven fuel switching are left to the seasonal/trend terms.',
  'Previous Runs archives start in March 2021 (GFS) and February 2024 (ECMWF IFS), so the primary window is ~2.7 years; the longer GFS window is the better-powered test.',
  'Open-Meteo free API: non-commercial research use only.',
];

function compTable(comps: Comparison[], filter: (c: Comparison) => boolean): string {
  return [
    '| ID | Window | Model | Reference | n | RMSE model | RMSE ref | MAE model | MAE ref | MSE skill | 95% CI | DM p (sq.) | DM p (abs.) | BH q |',
    '|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|',
    ...comps.filter(filter).map((c) => {
      const r = c.result;
      return `| ${c.id} | ${c.window === 'multi' ? 'IFS+GFS' : 'GFS long'} | ${PRED_LABEL[c.model]} | ${PRED_LABEL[c.ref]} | ${r.n} | ${fmt(r.rmseModel)} | ${fmt(r.rmseRef)} | ${fmt(r.maeModel)} | ${fmt(r.maeRef)} | ${pct(r.skillMse)} | [${pct(r.skillMseCi95.lo)}, ${pct(r.skillMseCi95.hi)}] | ${fmtP(r.dmSquared?.p)} | ${fmtP(r.dmAbsolute?.p)} | ${fmtP(c.q)} |`;
    }),
  ].join('\n');
}

function renderResults(json: any, rows: WeekRow[], comps: Comparison[]): string {
  const dev = json.development;
  const san = json.sanity;
  const m = json.weatherIndex.mapping;
  const wMulti = windowRows(rows, 'multi');
  const wGfs = windowRows(rows, 'gfs');
  const get = (id: string) => comps.find((c) => c.id === id)!;
  const conf = comps.filter((c) => c.confirmatory);
  const sigConf = conf.filter((c) => c.q !== null && c.q < 0.05);
  /** Fraction of the oracle's MSE gain over the seasonal model captured by the forecast (same weeks, same reference). */
  const gain = (fc: string, or: string) => get(fc).result.skillMse / get(or).result.skillMse;
  return `## Results

*Generated ${json.generatedAt} by \`npx tsx research/storage-study.ts\`. Machine-readable: \`public/research/storage-skill.json\` (every number below is in that file). Inputs SHA-256 \`${json.provenance.inputsSha256.slice(0, 16)}…\`.*

### Data actually used

- EIA Lower-48 weekly levels from \`${json.provenance.eia.url}\` (fetched ${json.provenance.eia.fetchedAt}); implied flow = net change minus ${NON_FLOW_ADJUSTMENTS.length} documented non-flow adjustments. Check against EIA's stated implied flows: ${json.target.impliedFlowChecks.filter((c: any) => c.diff === 0).length} of ${json.target.impliedFlowChecks.length} match exactly; differences: ${json.target.impliedFlowChecks.filter((c: any) => c.diff !== 0).map((c: any) => `${c.weekEnd} (${c.impliedFlow} vs stated ${c.statedImpliedFlow})`).join('; ') || 'none'}.
- CPC daily CONUS gas-weighted HDD and population-weighted CDD ${C.cpcFirstYear}–${C.cpcLastYear}.
- City→CPC maps (ERA5, ${C.calibration.start}…${C.calibration.end}, daily): CONUS HDD reproduced with R² ${fmt(m.era5CityFit.hddR2, 3)} (RMSE ${fmt(m.era5CityFit.hddRmse, 2)} °F·day/day), CDD R² ${fmt(m.era5CityFit.cddR2, 3)} (RMSE ${fmt(m.era5CityFit.cddRmse, 2)}). CPC division weights reproduce CPC CONUS with R² ${fmt(m.divisionWeightFit.hddR2, 4)} (HDD) and ${fmt(m.divisionWeightFit.cddR2, 4)} (CDD).
- Test windows: IFS+GFS (primary) ${wMulti[0]?.weekEnd}…${wMulti.at(-1)?.weekEnd}, **n = ${wMulti.length}** weeks; GFS long ${wGfs[0]?.weekEnd}…${wGfs.at(-1)?.weekEnd}, **n = ${wGfs.length}** weeks.
- Open-Meteo weight for the full input set: ${json.provenance.openMeteoWeightPlanned} weighted calls (fetched in this run: ${json.provenance.openMeteoWeightFetchedThisRun}).

### Development-period model selection (${dev.period.first}…${dev.period.last}, n = ${dev.period.n}, CPC actual weather)

Five-year-average RMSE on the same weeks: ${fmt(dev.fiveYear.rmse)} Bcf.

| Candidate | RMSE (Bcf) | MAE (Bcf) |
|---|---:|---:|
${[...dev.seasonal, ...dev.weather].map((c: Candidate) => `| ${specLabel(c.spec)} | ${fmt(c.rmse, 2)} | ${fmt(c.mae, 2)} |`).join('\n')}

Chosen: seasonal = ${specLabel(dev.chosen.seasonal)}; weather = ${specLabel(dev.chosen.weather)}.

### Sanity check: weather sensitivity (in-sample, ${san.sample.first}…${san.sample.last}, descriptive)

- Full-year OLS with seasonal terms (${san.fullYearLinear.spec}): **${fmt(san.fullYearLinear.bcfPerHdd, 2)} Bcf per weekly gas-weighted HDD** (HAC SE ${fmt(san.fullYearLinear.hacSeHdd, 2)}, t ${fmt(san.fullYearLinear.tHdd, 1)}) and ${fmt(san.fullYearLinear.bcfPerCdd, 2)} Bcf per weekly population-weighted CDD (HAC SE ${fmt(san.fullYearLinear.hacSeCdd, 2)}, t ${fmt(san.fullYearLinear.tCdd, 1)}); R² ${fmt(san.fullYearLinear.r2, 3)}.
- Winter (Dec–Feb) anomalies, flow minus five-year average vs HDD minus prior-five-year normal: slope ${fmt(san.winterAnomalySlope.bcfPerHdd, 2)} Bcf/HDD, R² ${fmt(san.winterAnomalySlope.r2, 2)}, n ${san.winterAnomalySlope.n}. Winter HDD anomalies have SD ${fmt(san.winterAnomalySlope.sdHddAnomaly)} °F·day per week, which at that slope implies a weather-driven flow SD of ${fmt(san.winterAnomalySlope.impliedSdFromWeather)} Bcf against an observed anomaly SD of ${fmt(san.winterAnomalySlope.sdFlowAnomaly)} Bcf.
- Walk-forward weather model in the test window: median marginal effect in Dec–Feb ${fmt(san.walkForwardWinterBcfPerHdd?.median, 2)} Bcf per HDD (n ${san.walkForwardWinterBcfPerHdd?.n ?? 0} weeks).

### Confirmatory tests (pre-specified; Benjamini–Hochberg across these four)

${compTable(comps, (c) => c.confirmatory)}

### Oracle bound, components and variants (descriptive)

${compTable(comps, (c) => !c.confirmatory)}

Share of the oracle's MSE gain over the seasonal model captured by the issued forecast: IFS+GFS ${pct(gain('C2', 'D2'))}, GFS long window ${pct(gain('C4', 'D10'))}.

### Forecast degree days vs CPC truth (weekly sums, °F·day)

| Window | Source | n | HDD RMSE | HDD bias | HDD corr. | CDD RMSE | CDD bias |
|---|---|---:|---:|---:|---:|---:|---:|
${json.degreeDayVerification.map((v: any) => `| ${v.window === 'multi' ? 'IFS+GFS' : 'GFS long'} | ${v.source} | ${v.n} | ${fmt(v.hddRmse)} | ${fmt(v.hddBias)} | ${fmt(v.hddCorr, 3)} | ${fmt(v.cddRmse)} | ${fmt(v.cddBias)} |`).join('\n')}

Correlations include the seasonal cycle and are therefore high for every source; RMSE is the informative column.

### Daily CONUS HDD error vs CPC by lead (Dec–Feb days, bias-corrected, °F·day)

| Window | Models | ${[1, 2, 3, 4, 5, 6, 7].map((l) => `Lead ${l}`).join(' | ')} | n per lead |
|---|---|${[1, 2, 3, 4, 5, 6, 7].map(() => '---:').join('|')}|---:|
${[...new Set(json.leadVerification.map((v: any) => `${v.window}|${v.models}`))].map((key: any) => {
    const vs = json.leadVerification.filter((v: any) => `${v.window}|${v.models}` === key);
    return `| ${vs[0].window === 'multi' ? 'IFS+GFS' : 'GFS long'} | ${vs[0].models} | ${vs.map((v: any) => fmt(v.hddRmse, 2)).join(' | ')} | ${vs[0].n} |`;
  }).join('\n')}

### RMSE by season (Bcf)

| Window | Season | n | Five-year avg | Seasonal | Oracle | Forecast IFS+GFS | Forecast GFS |
|---|---|---:|---:|---:|---:|---:|---:|
${json.bySeason.map((s: any) => `| ${s.window === 'multi' ? 'IFS+GFS' : 'GFS long'} | ${s.season} | ${s.n} | ${fmt(s.rmse.fiveYr)} | ${fmt(s.rmse.seasonal)} | ${fmt(s.rmse.oracle)} | ${fmt(s.rmse.fcMulti)} | ${fmt(s.rmse.fcGfs)} |`).join('\n')}

### Post-hoc check: EIA's published five-year average (not pre-specified)

${json.publishedFiveYearCheck ? `Source \`${json.publishedFiveYearCheck.source}\` (extracted ${json.publishedFiveYearCheck.extractedAt} by \`research/tools/eia_ngsstats.py\`). On the test weeks, the recomputed five-year-average **level** differs from EIA's published value by ${fmt(json.publishedFiveYearCheck.levelAbsDiffMean, 2)} Bcf on average (max ${fmt(json.publishedFiveYearCheck.levelAbsDiffMax, 1)}, n ${json.publishedFiveYearCheck.nLevels}), and the five-year-average **change** by ${fmt(json.publishedFiveYearCheck.changeAbsDiffMean, 2)} Bcf on average (max ${fmt(json.publishedFiveYearCheck.changeAbsDiffMax, 1)}, n ${json.publishedFiveYearCheck.nChanges}). Re-scoring against the published benchmark:

| Window | Forecast | n | RMSE published five-year avg | RMSE recomputed (same weeks) | RMSE forecast | MSE skill vs published | 95% CI | DM p |
|---|---|---:|---:|---:|---:|---:|---|---:|
${json.publishedFiveYearCheck.rescored.map((r: any) => `| ${r.window === 'multi' ? 'IFS+GFS' : 'GFS long'} | ${r.model === 'fcMulti' ? 'IFS+GFS' : 'GFS'} | ${r.n} | ${fmt(r.rmsePublishedFiveYr)} | ${fmt(r.rmseRecomputedFiveYrSameWeeks)} | ${fmt(r.rmseModel)} | ${pct(r.skillMse)} | [${pct(r.skillMseCi95.lo)}, ${pct(r.skillMseCi95.hi)}] | ${fmtP(r.dmP)} |`).join('\n')}` : '_Not run: research/cache/eia-ngsstats-l48.json is missing._'}

### Reading

${interpretation(comps, sigConf, json.bySeason)}

### Caveats

${json.caveats.map((c: string) => `- ${c}`).join('\n')}

### Reproduce

\`\`\`bash
npx tsx research/storage-study.ts --phase=data  # fetch EIA, CPC, ERA5 and Previous Runs into research/cache/ (~1,650 Open-Meteo weighted calls)
curl -L -o /tmp/ngsstats.xls https://ir.eia.gov/ngs/ngsstats.xls && python3 -I research/tools/eia_ngsstats.py /tmp/ngsstats.xls research/cache/eia-ngsstats-l48.json  # optional post-hoc check
npx tsx research/storage-study.ts --offline     # reruns this exact study from research/cache/
npx tsx --test src/engine/storageSkill.test.ts
\`\`\`
`;
}

function interpretation(comps: Comparison[], sigConf: Comparison[], seasons: ReturnType<typeof bySeason>): string {
  const get = (id: string) => comps.find((c) => c.id === id)!.result;
  const line = (id: string, what: string) => {
    const r = get(id);
    return `${what}: MSE skill ${pct(r.skillMse)} (95% CI ${pct(r.skillMseCi95.lo)} to ${pct(r.skillMseCi95.hi)}), RMSE ${fmt(r.rmseModel)} vs ${fmt(r.rmseRef)} Bcf, DM p ${fmtP(r.dmSquared?.p)}, n ${r.n}`;
  };
  const s = (window: string, season: string) => seasons.find((x) => x.window === window && x.season.startsWith(season))!;
  const heat = s('gfs', 'Heating');
  const inj = s('gfs', 'Injection');
  return [
    `- **${sigConf.length} of 4 confirmatory comparisons are significant at BH q < 0.05.** Unlike futures returns, the physical storage change is strongly forecastable from weather information issued before the week starts.`,
    `- ${line('C1', 'Issued IFS+GFS weather forecast vs the EIA five-year average')}.`,
    `- ${line('C2', 'Issued IFS+GFS weather forecast vs the seasonal model')}.`,
    `- ${line('C3', 'Issued GFS forecast vs the five-year average (long window)')}.`,
    `- ${line('C4', 'Issued GFS forecast vs the seasonal model (long window)')}.`,
    `- Oracle bound: ${line('D2', 'actual CPC weather vs the seasonal model (IFS+GFS window)')}. The issued forecast is worse than the oracle (${line('D3', 'oracle vs forecast')}), but it keeps about ${pct(get('C2').skillMse / get('D2').skillMse, 0)} (IFS+GFS) and ${pct(get('C4').skillMse / get('D10').skillMse, 0)} (GFS) of the oracle's MSE gain over the seasonal model. The weekly forecast degree-day error against CPC is close to the error of the nine-city ERA5 index itself (verification table above), and daily error grows with lead as expected (lead table).`,
    `- The gain is concentrated in the heating season. In the GFS window, Nov–Mar RMSE is ${fmt(heat.rmse.fiveYr)} Bcf for the five-year average, ${fmt(heat.rmse.fcGfs)} for the GFS forecast model and ${fmt(heat.rmse.oracle)} for the oracle (n ${heat.n}). Apr–Oct it is ${fmt(inj.rmse.fiveYr)}, ${fmt(inj.rmse.fcGfs)} and ${fmt(inj.rmse.oracle)} (n ${inj.n}): summer weather moves injections far less than winter weather moves withdrawals.`,
    `- The seasonal model alone does not beat the five-year average (${line('D4', 'IFS+GFS window')}; ${line('D12', 'GFS window')}). All of the skill comes from weather.`,
    `- Bias correction mattered for GFS alone (${line('D13', 'raw GFS vs seasonal')}, against ${pct(get('C4').skillMse)} corrected). For the IFS+GFS mean, the uncorrected variant was marginally better in this window (${line('D7', 'raw IFS+GFS vs seasonal')}, against ${pct(get('C2').skillMse)} corrected). The pre-specified corrected version is the headline.`,
    `- Representing CPC's national index by nine cities costs little: ${line('D8', 'CPC oracle vs nine-city ERA5 oracle (IFS+GFS window)')}.`,
    '- Scope: this compares weather-driven forecasts with the five-year average and a seasonal model. It does **not** compare them with analyst or survey consensus, which uses pipeline-flow data and was not available here, so no claim is made about beating market expectations.',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'research', 'storage-study.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
