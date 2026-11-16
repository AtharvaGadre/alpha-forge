/**
 * storageSkill.ts — deterministic statistics for the weather → US natural-gas storage study.
 *
 * Pure functions only (no I/O, no wall clock). Reuses the ridge/OLS, Diebold–Mariano, Newey–West
 * and block-bootstrap machinery of priceSkill.ts without changing it.
 *
 * Contents
 *  - Parsers for the EIA weekly storage history table (dnav HTML) and the NOAA CPC daily
 *    weighted degree-day files.
 *  - EIA "implied flow" (net change minus documented non-flow reclassifications) and the EIA
 *    five-year average computed with EIA's daily-interpolation method.
 *  - Storage-week calendar (stocks are measured at 09:00 Central on Fridays).
 *  - Seasonal and weather design matrices, walk-forward refits with a publication gap.
 *  - Forecast comparison: RMSE, MAE, MSE skill with block-bootstrap CI, Diebold–Mariano on
 *    squared and absolute loss (Newey–West HAC + Harvey–Leybourne–Newbold).
 *  - Trailing-window bias estimates and linear maps used to put city forecasts on the CPC basis.
 */
import {
  addDaysIso,
  blockBootstrapOosR2,
  dieboldMariano,
  fitRidge,
  mean,
  neweyWestLag,
  neweyWestLongRunVariance,
  predictRidge,
  shiftYearsIso,
  studentTCdf,
  type DailySeries,
  type RidgeModel,
  type TestResult,
} from './priceSkill';

// ----------------------------------------------------------------------------
// Units
// ----------------------------------------------------------------------------

export const DD_BASE_F = 65;
export const cToF = (c: number): number => (c * 9) / 5 + 32;
/** Heating degree-days (°F·day) for a daily mean temperature in °F, base 65 °F (NOAA convention). */
export const hddF = (tF: number): number => Math.max(0, DD_BASE_F - tF);
/** Cooling degree-days (°F·day) for a daily mean temperature in °F, base 65 °F. */
export const cddF = (tF: number): number => Math.max(0, tF - DD_BASE_F);

const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

// ----------------------------------------------------------------------------
// EIA weekly working-gas history
// ----------------------------------------------------------------------------

export interface WeeklyLevel {
  /** Report week ending (Friday, ISO date). */
  weekEnd: string;
  /** Working gas in storage, Bcf. */
  level: number;
}

/**
 * Parses the EIA dnav history table (e.g. https://www.eia.gov/dnav/ng/hist/nw2_epg0_swo_r48_bcfw.htm):
 * one row per month labelled "YYYY-Mon", then (MM/DD, value) cell pairs. Returns date-sorted levels.
 */
export function parseEiaWeeklyHistoryHtml(html: string): WeeklyLevel[] {
  const out: WeeklyLevel[] = [];
  for (const chunk of html.split(/<tr>/i)) {
    const label = /<td class='B6'>(?:&nbsp;|\s)*(\d{4})-([A-Za-z]{3})\s*<\/td>/.exec(chunk);
    if (!label) continue;
    const year = label[1];
    const pair = /<td class='B5'>([^<]*)<\/td>\s*<td class='B3'>([^<]*)<\/td>/g;
    for (let m = pair.exec(chunk); m; m = pair.exec(chunk)) {
      const date = m[1].replace(/&nbsp;/g, '').trim();
      const value = m[2].replace(/&nbsp;/g, '').replace(/,/g, '').trim();
      const dm = /^(\d{2})\/(\d{2})$/.exec(date);
      if (!dm || value === '' || !Number.isFinite(Number(value))) continue;
      if (MONTHS[label[2]] !== dm[1]) throw new Error(`EIA row ${year}-${label[2]} contains date ${date}`);
      out.push({ weekEnd: `${year}-${dm[1]}-${dm[2]}`, level: Number(value) });
    }
  }
  out.sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
  for (let i = 1; i < out.length; i++) {
    if (addDaysIso(out[i - 1].weekEnd, 7) !== out[i].weekEnd) throw new Error(`EIA history is not weekly between ${out[i - 1].weekEnd} and ${out[i].weekEnd}`);
  }
  return out;
}

/** A documented change in working gas that is not a physical injection/withdrawal (EIA revisions.xls). */
export interface NonFlowAdjustment {
  weekEnd: string;
  /** Lower-48 effect on working gas (Bcf; negative = working gas reclassified to base gas). */
  bcf: number;
  /** Implied flow stated by EIA in the report note, when one was published. */
  statedImpliedFlow: number | null;
  note: string;
}

export interface WeeklyFlow {
  weekEnd: string;
  level: number;
  /** Level difference vs the previous week (EIA "net change"). */
  netChange: number;
  /** Net change minus documented non-flow adjustments (EIA "implied flow"). */
  impliedFlow: number;
  adjustment: number;
}

export function impliedFlows(levels: WeeklyLevel[], adjustments: NonFlowAdjustment[]): WeeklyFlow[] {
  const adj = new Map<string, number>();
  for (const a of adjustments) adj.set(a.weekEnd, (adj.get(a.weekEnd) ?? 0) + a.bcf);
  const out: WeeklyFlow[] = [];
  for (let i = 1; i < levels.length; i++) {
    const netChange = levels[i].level - levels[i - 1].level;
    const a = adj.get(levels[i].weekEnd) ?? 0;
    out.push({ weekEnd: levels[i].weekEnd, level: levels[i].level, netChange, impliedFlow: netChange - a, adjustment: a });
  }
  return out;
}

/**
 * EIA daily interpolation (WNGSR methodology, "Computing the Five-Year Averages…"):
 * I_t = E_s + (t − s)·(E_{s+7} − E_s)/7 for the most recent report day s ≤ t.
 */
export function interpolatedDailyLevels(levels: WeeklyLevel[]): DailySeries {
  const out: DailySeries = new Map();
  for (let i = 0; i < levels.length; i++) {
    const s = levels[i];
    out.set(s.weekEnd, s.level);
    const next = levels[i + 1];
    if (!next) continue;
    const rate = (next.level - s.level) / 7;
    for (let k = 1; k <= 6; k++) out.set(addDaysIso(s.weekEnd, k), s.level + k * rate);
  }
  return out;
}

/** Mean of the interpolated level on the same calendar day in each of the preceding `years` years. */
export function fiveYearAverageLevel(daily: DailySeries, date: string, years = 5): number | null {
  const vals: number[] = [];
  for (let k = 1; k <= years; k++) {
    const v = daily.get(shiftYearsIso(date, -k));
    if (v === undefined) return null;
    vals.push(v);
  }
  return mean(vals);
}

/** EIA five-year-average net change for the report week ending `weekEnd`. */
export function fiveYearAverageChange(daily: DailySeries, weekEnd: string, years = 5): number | null {
  const a = fiveYearAverageLevel(daily, weekEnd, years);
  const b = fiveYearAverageLevel(daily, addDaysIso(weekEnd, -7), years);
  return a === null || b === null ? null : a - b;
}

// ----------------------------------------------------------------------------
// NOAA CPC daily weighted degree days
// ----------------------------------------------------------------------------

/**
 * Parses a CPC daily weighted degree-day file
 * (https://ftp.cpc.ncep.noaa.gov/htdocs/degree_days/weighted/daily_data/YYYY/<Weights>.<Heating|Cooling>.txt):
 * header lines, then "Region|YYYYMMDD|…" and one "name|v|v…" row per region (1–9 = census divisions, CONUS).
 */
export function parseCpcDailyFile(text: string): Map<string, DailySeries> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hi = lines.findIndex((l) => l.startsWith('Region|'));
  if (hi < 0) throw new Error('CPC file without a Region header');
  const dates = lines[hi].split('|').slice(1).map((d) => {
    if (!/^\d{8}$/.test(d)) throw new Error(`Bad CPC date ${d}`);
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  });
  const out = new Map<string, DailySeries>();
  for (const line of lines.slice(hi + 1)) {
    const cells = line.split('|');
    if (cells.length !== dates.length + 1) continue;
    const s: DailySeries = new Map();
    cells.slice(1).forEach((c, i) => {
      const v = Number(c);
      if (c !== '' && Number.isFinite(v) && v > -900) s.set(dates[i], v);
    });
    out.set(cells[0], s);
  }
  return out;
}

// ----------------------------------------------------------------------------
// Storage-week calendar
// ----------------------------------------------------------------------------

/**
 * Local (Central) calendar days of the weather week matched to the report week ending Friday
 * `weekEnd`: Friday weekEnd − 7 … Thursday weekEnd − 1. EIA stocks are measured at 09:00 CST on
 * Fridays, so this window leads the storage week by nine hours.
 */
export function storageWeekDays(weekEnd: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(weekEnd, i - 7));
}

/** Sum of a daily series over the storage-week days; null if any day is missing. */
export function storageWeekSum(series: DailySeries, weekEnd: string): number | null {
  let s = 0;
  for (const d of storageWeekDays(weekEnd)) {
    const v = series.get(d);
    if (v === undefined || !Number.isFinite(v)) return null;
    s += v;
  }
  return s;
}

/** Day of year (1–366) of an ISO date. */
export function dayOfYear(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((t - Date.parse(`${iso.slice(0, 4)}-01-01T00:00:00Z`)) / 86_400_000) + 1;
}

// ----------------------------------------------------------------------------
// Design matrices
// ----------------------------------------------------------------------------

export type WeatherTerms = 'none' | 'linear' | 'quadratic' | 'interaction';

export interface StorageSpec {
  /** Number of annual harmonics (sin/cos pairs) in the seasonal block. */
  harmonics: number;
  window: 'expanding' | 'rolling';
  /** Training weeks kept by a rolling window. */
  rollingWeeks: number;
  weather: WeatherTerms;
}

export const TREND_ORIGIN = '2010-01-01';

/** Angle of the storage week's mid-point in the annual cycle (radians). */
export function seasonAngle(weekEnd: string): number {
  return (2 * Math.PI * (dayOfYear(weekEnd) - 3.5)) / 365.25;
}

/**
 * Regressors for one week: linear trend (years since 2010), `harmonics` annual sin/cos pairs, and
 * the weather block — linear [HDD, CDD]; quadratic adds HDD², CDD²; interaction adds HDD·cos θ, HDD·sin θ.
 */
export function storageDesign(spec: StorageSpec, weekEnd: string, hdd: number, cdd: number): number[] {
  const trend = (Date.parse(`${weekEnd}T00:00:00Z`) - Date.parse(`${TREND_ORIGIN}T00:00:00Z`)) / (365.25 * 86_400_000);
  const th = seasonAngle(weekEnd);
  const x = [trend];
  for (let k = 1; k <= spec.harmonics; k++) x.push(Math.sin(k * th), Math.cos(k * th));
  if (spec.weather === 'none') return x;
  x.push(hdd, cdd);
  if (spec.weather === 'linear') return x;
  x.push((hdd * hdd) / 100, (cdd * cdd) / 100);
  if (spec.weather === 'quadratic') return x;
  x.push(hdd * Math.cos(th), hdd * Math.sin(th));
  return x;
}

// ----------------------------------------------------------------------------
// Walk-forward refits
// ----------------------------------------------------------------------------

export interface StorageWeekObs {
  weekEnd: string;
  /** Target: implied flow, Bcf. */
  y: number;
  /** Realised weather over the storage week (truth basis), °F·day. */
  hdd: number;
  cdd: number;
}

/** Ordinary least squares via the ridge solver with a negligible penalty (standardised regressors). */
export const OLS_LAMBDA = 1e-8;

export function fitStorage(train: StorageWeekObs[], spec: StorageSpec): RidgeModel {
  return fitRidge(train.map((o) => storageDesign(spec, o.weekEnd, o.hdd, o.cdd)), train.map((o) => o.y), OLS_LAMBDA);
}

export function predictStorage(model: RidgeModel, spec: StorageSpec, weekEnd: string, hdd: number, cdd: number): number {
  return predictRidge(model, storageDesign(spec, weekEnd, hdd, cdd));
}

/**
 * Training weeks admissible for a forecast of the week ending `targetWeekEnd`: report weeks ending
 * at least `gapDays` earlier (published before the forecast is issued), most recent
 * `spec.rollingWeeks` only when the window is rolling. `obs` must be sorted by weekEnd.
 */
export function admissibleTraining(obs: StorageWeekObs[], targetWeekEnd: string, spec: StorageSpec, gapDays: number): StorageWeekObs[] {
  const cut = addDaysIso(targetWeekEnd, -gapDays);
  const train = obs.filter((o) => o.weekEnd <= cut);
  return spec.window === 'rolling' ? train.slice(-spec.rollingWeeks) : train;
}

export type WeatherInput = (weekEnd: string) => { hdd: number; cdd: number } | null;

export interface StorageWalkForwardRow {
  weekEnd: string;
  nTrain: number;
  /** One prediction per named weather input (null when that input is missing for the week). */
  preds: Record<string, number | null>;
  /** Marginal effect of one extra weekly HDD at the input values of the first named input (Bcf per °F·day). */
  dYdHdd: number | null;
}

/**
 * Expanding- or rolling-window refit every target week. The model is fitted on admissible weeks
 * with REALISED (truth) weather, then applied to each named weather input (e.g. truth = oracle,
 * forecast = the issued forecast). For spec.weather = 'none', inputs are ignored and the single
 * prediction is stored under 'seasonal'.
 */
export function walkForwardStorage(
  obs: StorageWeekObs[],
  targets: string[],
  spec: StorageSpec,
  opts: { gapDays: number; minTrain: number },
  inputs: Record<string, WeatherInput> = {}
): StorageWalkForwardRow[] {
  const sorted = [...obs].sort((a, b) => a.weekEnd.localeCompare(b.weekEnd));
  const out: StorageWalkForwardRow[] = [];
  for (const t of targets) {
    const train = admissibleTraining(sorted, t, spec, opts.gapDays);
    if (train.length < opts.minTrain) continue;
    const model = fitStorage(train, spec);
    const preds: Record<string, number | null> = {};
    let dYdHdd: number | null = null;
    if (spec.weather === 'none') {
      preds.seasonal = predictStorage(model, spec, t, 0, 0);
    } else {
      for (const [name, f] of Object.entries(inputs)) {
        const w = f(t);
        preds[name] = w ? predictStorage(model, spec, t, w.hdd, w.cdd) : null;
        if (w && dYdHdd === null) dYdHdd = predictStorage(model, spec, t, w.hdd + 1, w.cdd) - preds[name]!;
      }
    }
    out.push({ weekEnd: t, nTrain: train.length, preds, dYdHdd });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Forecast comparison
// ----------------------------------------------------------------------------

/**
 * Diebold–Mariano on a general loss, H1: the model (lossModel) has lower expected loss than the
 * reference (lossRef). Newey–West variance (lag = neweyWestLag) and HLN correction, Student t(n − 1).
 */
export function dieboldMarianoLoss(lossRef: number[], lossModel: number[], horizon: number): TestResult | null {
  const n = lossRef.length;
  if (n < 10 || lossModel.length !== n) return null;
  const d = lossRef.map((l, i) => l - lossModel[i]);
  const lrv = neweyWestLongRunVariance(d, neweyWestLag(n, horizon));
  if (!(lrv > 0)) return { stat: 0, p: 0.5, n };
  const h = horizon;
  const hln = Math.sqrt(Math.max(1e-12, (n + 1 - 2 * h + (h * (h - 1)) / n) / n));
  const stat = (mean(d) / Math.sqrt(lrv / n)) * hln;
  return { stat, p: 1 - studentTCdf(stat, n - 1), n };
}

export interface ForecastComparison {
  n: number;
  rmseRef: number;
  rmseModel: number;
  maeRef: number;
  maeModel: number;
  /** Mean error (forecast − outcome) of each. */
  biasRef: number;
  biasModel: number;
  /** 1 − MSE(model)/MSE(ref). */
  skillMse: number;
  skillMseCi95: { lo: number; hi: number; median: number };
  /** 1 − MAE(model)/MAE(ref). */
  skillMae: number;
  /** One-sided DM (squared loss), H1: model more accurate. */
  dmSquared: TestResult | null;
  /** One-sided DM (absolute loss), H1: model more accurate. */
  dmAbsolute: TestResult | null;
  bootstrap: { resamples: number; blockLength: number; seed: number };
}

export function compareForecasts(y: number[], ref: number[], model: number[], bootstrap: { resamples: number; seed: number }): ForecastComparison {
  const n = y.length;
  if (ref.length !== n || model.length !== n) throw new Error('compareForecasts: length mismatch');
  const eRef = y.map((v, i) => v - ref[i]);
  const eMod = y.map((v, i) => v - model[i]);
  const rms = (e: number[]) => Math.sqrt(mean(e.map((x) => x * x)));
  const mae = (e: number[]) => mean(e.map((x) => Math.abs(x)));
  const blockLength = Math.max(1, Math.round(Math.cbrt(n)));
  return {
    n,
    rmseRef: rms(eRef),
    rmseModel: rms(eMod),
    maeRef: mae(eRef),
    maeModel: mae(eMod),
    biasRef: -mean(eRef),
    biasModel: -mean(eMod),
    skillMse: 1 - mean(eMod.map((x) => x * x)) / mean(eRef.map((x) => x * x)),
    skillMseCi95: blockBootstrapOosR2(y, model, ref, blockLength, bootstrap.resamples, bootstrap.seed),
    skillMae: 1 - mae(eMod) / mae(eRef),
    dmSquared: dieboldMariano(eRef, eMod, 1),
    dmAbsolute: dieboldMarianoLoss(eRef.map(Math.abs), eMod.map(Math.abs), 1),
    bootstrap: { resamples: bootstrap.resamples, blockLength, seed: bootstrap.seed },
  };
}

// ----------------------------------------------------------------------------
// Forecast construction helpers
// ----------------------------------------------------------------------------

/**
 * Mean of a(d) − b(d) over the `days` days ending `end` (inclusive) where both exist; null if
 * fewer than `minDays` pairs. Used for trailing-window forecast bias against verifying analyses.
 */
export function trailingMeanDifference(a: DailySeries, b: DailySeries, end: string, days: number, minDays: number): number | null {
  const diffs: number[] = [];
  for (let k = 0; k < days; k++) {
    const d = addDaysIso(end, -k);
    const x = a.get(d);
    const y = b.get(d);
    if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)) diffs.push(x - y);
  }
  return diffs.length >= minDays ? mean(diffs) : null;
}

export interface LinearMap {
  a: number;
  b: number;
  n: number;
  r2: number;
  rmse: number;
}

/** Simple OLS y = a + b·x. */
export function fitLinearMap(x: number[], y: number[]): LinearMap {
  const n = x.length;
  if (n < 3 || y.length !== n) throw new Error('fitLinearMap needs ≥ 3 paired points');
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  const sse = y.reduce((s, v, i) => s + (v - a - b * x[i]) ** 2, 0);
  return { a, b, n, r2: syy > 0 ? 1 - sse / syy : 0, rmse: Math.sqrt(sse / n) };
}

/** Least squares without intercept (normal equations, Gaussian elimination with partial pivoting). */
export function leastSquares(X: number[][], y: number[]): number[] {
  const p = X[0]?.length ?? 0;
  const A = Array.from({ length: p }, (_, i) => [...Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)), X.reduce((s, r, t) => s + r[i] * y[t], 0)]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    if (Math.abs(A[c][c]) < 1e-12) throw new Error('leastSquares: singular design');
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= p; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[p] / row[i]);
}

/**
 * Sum over days start … start + n − 1 of a lead-indexed daily quantity, where day i (0-based)
 * uses lead `leadFor(i)`. Null if any value is missing.
 */
export function leadWindowSum(get: (lead: number, day: string) => number | undefined, start: string, n: number, leadFor: (i: number) => number): number | null {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const v = get(leadFor(i), addDaysIso(start, i));
    if (v === undefined || !Number.isFinite(v)) return null;
    s += v;
  }
  return s;
}

/** Mean of the same calendar-day window in up to `years` prior years (min `minYears`). */
export function priorYearsWindowMean(series: DailySeries, start: string, n: number, years: number, minYears: number): number | null {
  const vals: number[] = [];
  for (let k = 1; k <= years; k++) {
    const s0 = shiftYearsIso(start, -k);
    let s = 0;
    let ok = true;
    for (let i = 0; i < n; i++) {
      const v = series.get(addDaysIso(s0, i));
      if (v === undefined) { ok = false; break; }
      s += v;
    }
    if (ok) vals.push(s);
  }
  return vals.length >= minYears ? mean(vals) : null;
}
