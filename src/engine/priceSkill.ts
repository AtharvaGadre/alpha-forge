/**
 * priceSkill.ts — deterministic statistics for the weather → commodity-returns walk-forward study.
 *
 * Pure functions only: no I/O, no wall clock. Randomness (bootstrap) comes from an explicitly
 * seeded PRNG, so every number is reproducible from the same inputs.
 *
 * Methods (see docs/results/PRICE_STUDY.md for full references):
 *  - Expanding-window ridge regression, standardised on the training window only.
 *  - Out-of-sample R² against the expanding historical mean (Campbell & Thompson 2008).
 *  - Diebold–Mariano (1995) with Newey–West HAC long-run variance and the
 *    Harvey–Leybourne–Newbold (1997) small-sample correction.
 *  - Clark–West (2007) MSPE-adjusted test for nested models.
 *  - Pesaran–Timmermann (1992) test of directional accuracy.
 *  - Circular moving-block bootstrap percentile intervals.
 *  - Benjamini–Hochberg (1995) false-discovery-rate adjustment.
 */
import { SeededRNG } from './prng';

// ----------------------------------------------------------------------------
// Dates (ISO yyyy-mm-dd, UTC)
// ----------------------------------------------------------------------------

export const DAY_MS = 86_400_000;
const pad2 = (n: number) => String(n).padStart(2, '0');

export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Same calendar day `years` earlier/later; 29 Feb maps to 28 Feb. */
export function shiftYearsIso(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y + years}-${pad2(m)}-${pad2(m === 2 && d === 29 ? 28 : d)}`;
}

export const monthOf = (iso: string): number => Number(iso.slice(5, 7));
export const weekdayOf = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();

// ----------------------------------------------------------------------------
// Basic statistics and distributions
// ----------------------------------------------------------------------------

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Population standard deviation (divides by n). */
export function sdPop(xs: number[]): number {
  if (!xs.length) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

/** Sample standard deviation (divides by n - 1). */
export function sdSample(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Complementary error function (Numerical Recipes erfcc, |relative error| < 1.2e-7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? r : 2 - r;
}

export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betaContinuedFraction(a, b, x)) / a : 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Student-t CDF with `df` degrees of freedom. */
export function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

// ----------------------------------------------------------------------------
// Ridge regression (standardised on the training window only)
// ----------------------------------------------------------------------------

export interface RidgeModel {
  means: number[];
  sds: number[];
  coef: number[];
  intercept: number;
  lambda: number;
  n: number;
}

/** Solves A x = b for symmetric positive-definite A (Cholesky). */
function solveSpd(A: number[][], b: number[]): number[] {
  const p = b.length;
  const L = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-12));
      else L[i][j] = s / L[j][j];
    }
  }
  const z = new Array<number>(p).fill(0);
  for (let i = 0; i < p; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * z[k];
    z[i] = s / L[i][i];
  }
  const x = new Array<number>(p).fill(0);
  for (let i = p - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < p; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/**
 * Ridge with an unpenalised intercept. Each column is standardised with the TRAINING mean and
 * population SD; zero-variance columns contribute nothing. Penalty `lambda` applies to the
 * standardised coefficients: minimise Σ(y − ȳ − Zβ)² + λ‖β‖².
 */
export function fitRidge(X: number[][], y: number[], lambda: number): RidgeModel {
  const n = y.length;
  const p = n ? X[0].length : 0;
  const means = Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j])));
  const sds = Array.from({ length: p }, (_, j) => sdPop(X.map((r) => r[j])));
  const Z = X.map((r) => r.map((v, j) => (sds[j] > 1e-12 ? (v - means[j]) / sds[j] : 0)));
  const yMean = mean(y);
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Z.reduce((a, z) => a + z[i] * z[j], 0) + (i === j ? lambda : 0)));
  const b = Array.from({ length: p }, (_, i) => Z.reduce((a, z, k) => a + z[i] * (y[k] - yMean), 0));
  const coef = p ? solveSpd(A, b) : [];
  return { means, sds, coef, intercept: yMean, lambda, n };
}

export function predictRidge(m: RidgeModel, x: number[]): number {
  return m.intercept + m.coef.reduce((a, c, j) => a + (m.sds[j] > 1e-12 ? (c * (x[j] - m.means[j])) / m.sds[j] : 0), 0);
}

// ----------------------------------------------------------------------------
// Walk-forward evaluation
// ----------------------------------------------------------------------------

export interface StudyRow {
  /** Forecast origin (date of the last price used). */
  origin: string;
  /** Date on which the target return is fully realised (known at that day's close). */
  labelDate: string;
  /** Target: log return from origin close to labelDate close. */
  y: number;
  /** Market-only predictors known at the origin. */
  market: number[];
  /** Weather predictors known at the origin (or, for the oracle tier, deliberately not). */
  weather: number[];
}

export interface WalkForwardOptions {
  minTrain: number;
  /** Ridge penalty per training observation (λ = lambdaPerObs × nTrain), fixed ex ante. */
  lambdaPerObs: number;
}

export interface WalkForwardPrediction {
  origin: string;
  labelDate: string;
  y: number;
  nTrain: number;
  /** Zero-return random walk. */
  rw: number;
  /** Expanding historical mean of realised training targets. */
  hm: number;
  /** Market-only ridge. */
  mkt: number;
  /** Market + weather ridge (nests mkt). */
  wx: number;
}

/**
 * Expanding-window walk-forward. At origin t a training row s is admissible only when its label
 * is realised by t (labelDate_s ≤ t), so overlapping multi-week targets never leak.
 */
export function walkForward(rows: StudyRow[], opts: WalkForwardOptions): WalkForwardPrediction[] {
  const sorted = [...rows].sort((a, b) => a.origin.localeCompare(b.origin));
  const out: WalkForwardPrediction[] = [];
  for (const row of sorted) {
    const train = sorted.filter((r) => r.labelDate <= row.origin && r.origin < row.origin);
    if (train.length < opts.minTrain) continue;
    const ys = train.map((r) => r.y);
    const lambda = opts.lambdaPerObs * train.length;
    const mkt = fitRidge(train.map((r) => r.market), ys, lambda);
    const wx = fitRidge(train.map((r) => [...r.market, ...r.weather]), ys, lambda);
    out.push({
      origin: row.origin,
      labelDate: row.labelDate,
      y: row.y,
      nTrain: train.length,
      rw: 0,
      hm: mean(ys),
      mkt: predictRidge(mkt, row.market),
      wx: predictRidge(wx, [...row.market, ...row.weather]),
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Forecast-comparison tests
// ----------------------------------------------------------------------------

/** Newey–West (1994) rule-of-thumb lag, never below h − 1 for h-step overlapping targets. */
export function neweyWestLag(n: number, horizon: number): number {
  return Math.max(horizon - 1, Math.floor(4 * Math.pow(n / 100, 2 / 9)));
}

/** Bartlett-kernel long-run variance of a series (Newey & West 1987). */
export function neweyWestLongRunVariance(x: number[], lag: number): number {
  const n = x.length;
  const m = mean(x);
  const d = x.map((v) => v - m);
  const gamma = (j: number) => d.slice(j).reduce((a, v, i) => a + v * d[i], 0) / n;
  const g0 = gamma(0);
  let lrv = g0;
  for (let j = 1; j <= Math.min(lag, n - 1); j++) lrv += 2 * (1 - j / (lag + 1)) * gamma(j);
  return lrv > 0 ? lrv : g0;
}

export interface TestResult {
  stat: number;
  /** One-sided p-value for H1: the challenger is more accurate. */
  p: number;
  n: number;
}

/**
 * Diebold–Mariano test of equal squared-error loss, H1: model B (errB) beats model A (errA).
 * HAC variance (Bartlett, lag = neweyWestLag) and Harvey–Leybourne–Newbold correction with
 * Student-t(n − 1) reference distribution.
 */
export function dieboldMariano(errA: number[], errB: number[], horizon: number): TestResult | null {
  const n = errA.length;
  if (n < 10 || errB.length !== n) return null;
  const d = errA.map((e, i) => e * e - errB[i] * errB[i]);
  const lrv = neweyWestLongRunVariance(d, neweyWestLag(n, horizon));
  if (!(lrv > 0)) return { stat: 0, p: 0.5, n };
  const dm = mean(d) / Math.sqrt(lrv / n);
  const h = horizon;
  const hln = Math.sqrt(Math.max(1e-12, (n + 1 - 2 * h + (h * (h - 1)) / n) / n));
  const stat = dm * hln;
  return { stat, p: 1 - studentTCdf(stat, n - 1), n };
}

/**
 * Clark–West (2007) MSPE-adjusted test for nested models.
 * H0: the restricted model (fRestricted) is as accurate; H1: the unrestricted model adds information.
 */
export function clarkWest(y: number[], fRestricted: number[], fUnrestricted: number[], horizon: number): TestResult | null {
  const n = y.length;
  if (n < 10) return null;
  const f = y.map((v, i) => (v - fRestricted[i]) ** 2 - ((v - fUnrestricted[i]) ** 2 - (fRestricted[i] - fUnrestricted[i]) ** 2));
  const lrv = neweyWestLongRunVariance(f, neweyWestLag(n, horizon));
  if (!(lrv > 0)) return { stat: 0, p: 0.5, n };
  const stat = mean(f) / Math.sqrt(lrv / n);
  return { stat, p: 1 - normalCdf(stat), n };
}

export interface DirectionalResult extends TestResult {
  hitRate: number;
}

/**
 * Pesaran–Timmermann (1992) test of directional accuracy. Returns null when either the
 * forecasts or outcomes never change sign (the statistic is undefined).
 */
export function pesaranTimmermann(y: number[], f: number[]): DirectionalResult | null {
  const n = y.length;
  if (n < 10) return null;
  const up = y.map((v) => v > 0);
  const fup = f.map((v) => v > 0);
  const P = up.reduce((a, u, i) => a + (u === fup[i] ? 1 : 0), 0) / n;
  const py = up.filter(Boolean).length / n;
  const px = fup.filter(Boolean).length / n;
  const pStar = py * px + (1 - py) * (1 - px);
  const vP = (pStar * (1 - pStar)) / n;
  const vPStar = ((2 * py - 1) ** 2 * px * (1 - px)) / n + ((2 * px - 1) ** 2 * py * (1 - py)) / n + (4 * py * px * (1 - py) * (1 - px)) / (n * n);
  const v = vP - vPStar;
  if (!(v > 0) || px === 0 || px === 1 || py === 0 || py === 1) return null;
  const stat = (P - pStar) / Math.sqrt(v);
  return { stat, p: 1 - normalCdf(stat), n, hitRate: P };
}

export function hitRate(y: number[], f: number[]): number {
  return y.reduce((a, v, i) => a + ((v > 0) === (f[i] > 0) ? 1 : 0), 0) / y.length;
}

/** Campbell–Thompson out-of-sample R²: 1 − SSE(model) / SSE(benchmark). */
export function oosR2(y: number[], fModel: number[], fBench: number[]): number {
  const sm = y.reduce((a, v, i) => a + (v - fModel[i]) ** 2, 0);
  const sb = y.reduce((a, v, i) => a + (v - fBench[i]) ** 2, 0);
  return 1 - sm / sb;
}

export function rmse(y: number[], f: number[]): number {
  return Math.sqrt(y.reduce((a, v, i) => a + (v - f[i]) ** 2, 0) / y.length);
}

/**
 * Circular moving-block bootstrap (Künsch 1989; Politis & Romano 1992) percentile interval for
 * the out-of-sample R². Blocks keep forecast pairs together, preserving serial dependence.
 */
export function blockBootstrapOosR2(
  y: number[],
  fModel: number[],
  fBench: number[],
  blockLength: number,
  resamples: number,
  seed: number
): { lo: number; hi: number; median: number } {
  const n = y.length;
  const rng = new SeededRNG(seed);
  const em = y.map((v, i) => (v - fModel[i]) ** 2);
  const eb = y.map((v, i) => (v - fBench[i]) ** 2);
  const L = Math.max(1, Math.min(blockLength, n));
  const stats: number[] = [];
  for (let b = 0; b < resamples; b++) {
    let sm = 0, sb = 0, taken = 0;
    while (taken < n) {
      const start = Math.floor(rng.next() * n);
      for (let k = 0; k < L && taken < n; k++, taken++) {
        const i = (start + k) % n;
        sm += em[i];
        sb += eb[i];
      }
    }
    stats.push(1 - sm / sb);
  }
  stats.sort((a, b) => a - b);
  const q = (p: number) => stats[Math.min(stats.length - 1, Math.max(0, Math.round(p * (stats.length - 1))))];
  return { lo: q(0.025), hi: q(0.975), median: q(0.5) };
}

/** Benjamini–Hochberg (1995) adjusted q-values; nulls stay null and are excluded from the family. */
export function benjaminiHochberg(p: Array<number | null>): Array<number | null> {
  const idx = p.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null && Number.isFinite(x[0]));
  const m = idx.length;
  const sorted = [...idx].sort((a, b) => a[0] - b[0]);
  const q = new Array<number | null>(p.length).fill(null);
  let running = 1;
  for (let k = m - 1; k >= 0; k--) {
    running = Math.min(running, (sorted[k][0] * m) / (k + 1));
    q[sorted[k][1]] = Math.min(1, running);
  }
  return q;
}

export interface SkillMetrics {
  n: number;
  horizonWeeks: number;
  oosStart: string;
  oosEnd: string;
  nTrainFirst: number;
  /** Out-of-sample R² vs expanding historical mean (Campbell & Thompson 2008). */
  oosR2Wx: number;
  oosR2Mkt: number;
  /** 1 − MSE(wx)/MSE(mkt): incremental value of the weather block. */
  oosR2WxVsMkt: number;
  rmseRatioWxVsRw: number;
  rmseRatioMktVsRw: number;
  rmseRatioHmVsRw: number;
  dmWxVsRw: TestResult | null;
  dmWxVsHm: TestResult | null;
  cwWxVsMkt: TestResult | null;
  ptWx: DirectionalResult | null;
  hitRateWx: number;
  hitRateMkt: number;
  /** Share of origins where y > 0 (the "always up" hit rate). */
  baseRateUp: number;
  oosR2WxCi95: { lo: number; hi: number; median: number };
  bootstrap: { resamples: number; blockLength: number; seed: number };
}

export function evaluateSkill(preds: WalkForwardPrediction[], horizonWeeks: number, bootstrap: { resamples: number; seed: number }): SkillMetrics | null {
  if (preds.length < 20) return null;
  const y = preds.map((p) => p.y);
  const rw = preds.map((p) => p.rw);
  const hm = preds.map((p) => p.hm);
  const mkt = preds.map((p) => p.mkt);
  const wx = preds.map((p) => p.wx);
  const err = (f: number[]) => y.map((v, i) => v - f[i]);
  const n = y.length;
  const blockLength = Math.max(horizonWeeks, Math.round(Math.cbrt(n)));
  return {
    n,
    horizonWeeks,
    oosStart: preds[0].origin,
    oosEnd: preds[n - 1].origin,
    nTrainFirst: preds[0].nTrain,
    oosR2Wx: oosR2(y, wx, hm),
    oosR2Mkt: oosR2(y, mkt, hm),
    oosR2WxVsMkt: oosR2(y, wx, mkt),
    rmseRatioWxVsRw: rmse(y, wx) / rmse(y, rw),
    rmseRatioMktVsRw: rmse(y, mkt) / rmse(y, rw),
    rmseRatioHmVsRw: rmse(y, hm) / rmse(y, rw),
    dmWxVsRw: dieboldMariano(err(rw), err(wx), horizonWeeks),
    dmWxVsHm: dieboldMariano(err(hm), err(wx), horizonWeeks),
    cwWxVsMkt: clarkWest(y, mkt, wx, horizonWeeks),
    ptWx: pesaranTimmermann(y, wx),
    hitRateWx: hitRate(y, wx),
    hitRateMkt: hitRate(y, mkt),
    baseRateUp: y.filter((v) => v > 0).length / n,
    oosR2WxCi95: blockBootstrapOosR2(y, wx, hm, blockLength, bootstrap.resamples, bootstrap.seed),
    bootstrap: { resamples: bootstrap.resamples, blockLength, seed: bootstrap.seed },
  };
}

/** Gauss–Jordan inverse of a small square matrix. */
function invert(A: number[][]): number[][] {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-14) throw new Error('Singular design matrix.');
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((r) => r.slice(n));
}

export interface HacRegression {
  /** [intercept, slopes...] */
  coef: number[];
  se: number[];
  t: number[];
  /** Two-sided normal p-values. */
  p: number[];
  n: number;
  r2: number;
  lag: number;
}

/**
 * OLS with Newey–West HAC standard errors (descriptive, full sample). An intercept is added.
 * Used for the in-sample contemporaneous-sensitivity table only, never for forecast claims.
 */
export function olsHac(X: number[][], y: number[], lag: number): HacRegression {
  const n = y.length;
  const Z = X.map((r) => [1, ...r]);
  const k = Z[0].length;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => Z.reduce((a, z) => a + z[i] * z[j], 0)));
  const Xty = Array.from({ length: k }, (_, i) => Z.reduce((a, z, t) => a + z[i] * y[t], 0));
  const inv = invert(XtX);
  const coef = inv.map((row) => row.reduce((a, v, j) => a + v * Xty[j], 0));
  const e = y.map((v, t) => v - Z[t].reduce((a, z, j) => a + z * coef[j], 0));
  const g = Z.map((z, t) => z.map((v) => v * e[t]));
  const S = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let j = 0; j <= Math.min(lag, n - 1); j++) {
    const w = j === 0 ? 1 : 1 - j / (lag + 1);
    for (let t = j; t < n; t++) {
      for (let a = 0; a < k; a++) {
        for (let b = 0; b < k; b++) {
          const v = g[t][a] * g[t - j][b];
          S[a][b] += w * (j === 0 ? v : v + g[t - j][a] * g[t][b]) ;
        }
      }
    }
  }
  // V = (X'X)^-1 S (X'X)^-1 (S here is the unscaled sum, so no extra n factors are needed).
  const tmp = inv.map((row) => Array.from({ length: k }, (_, j) => row.reduce((a, v, m) => a + v * S[m][j], 0)));
  const V = tmp.map((row) => Array.from({ length: k }, (_, j) => row.reduce((a, v, m) => a + v * inv[m][j], 0)));
  const se = V.map((row, i) => Math.sqrt(Math.max(row[i], 0)));
  const t = coef.map((c, i) => (se[i] > 0 ? c / se[i] : 0));
  const ybar = mean(y);
  const r2 = 1 - e.reduce((a, v) => a + v * v, 0) / y.reduce((a, v) => a + (v - ybar) ** 2, 0);
  return { coef, se, t, p: t.map((z) => 2 * (1 - normalCdf(Math.abs(z)))), n, r2, lag };
}

// ----------------------------------------------------------------------------
// Weather feature construction (point-in-time)
// ----------------------------------------------------------------------------

export type DailySeries = Map<string, number>;

/**
 * Single-sine degree-days above `base` for one day (Baskerville & Emin 1969), the
 * within-day interpolation used for extreme-degree-day crop studies (e.g. Schlenker & Roberts 2009).
 */
export function singleSineDegreeDays(tmin: number, tmax: number, base: number): number {
  if (tmax < tmin) [tmin, tmax] = [tmax, tmin];
  if (tmax <= base) return 0;
  const m = (tmax + tmin) / 2;
  if (tmin >= base) return m - base;
  const w = (tmax - tmin) / 2;
  const theta = Math.asin((base - m) / w);
  return ((m - base) * (Math.PI / 2 - theta) + w * Math.cos(theta)) / Math.PI;
}

/** Sum or mean over [end − days + 1, end]; null if any day is missing. */
export function windowAggregate(series: DailySeries, end: string, days: number, agg: 'sum' | 'mean'): number | null {
  let s = 0;
  for (let k = days - 1; k >= 0; k--) {
    const v = series.get(addDaysIso(end, -k));
    if (v === undefined || !Number.isFinite(v)) return null;
    s += v;
  }
  return agg === 'sum' ? s : s / days;
}

export interface NormalSpec {
  normalYears: number;
  minYears: number;
  sdFloor: number;
}

export interface WindowAnomaly {
  value: number;
  normalMean: number;
  normalSd: number;
  z: number;
  years: number;
}

/** Same-calendar-window climatology from up to `normalYears` PRIOR years only. */
export function priorYearsNormal(series: DailySeries, end: string, days: number, agg: 'sum' | 'mean', spec: NormalSpec): { mean: number; sd: number; years: number } | null {
  const prior: number[] = [];
  for (let k = 1; k <= spec.normalYears; k++) {
    const v = windowAggregate(series, shiftYearsIso(end, -k), days, agg);
    if (v !== null) prior.push(v);
  }
  if (prior.length < spec.minYears) return null;
  return { mean: mean(prior), sd: Math.max(sdSample(prior), spec.sdFloor), years: prior.length };
}

export function anomalyVsNormal(value: number, normal: { mean: number; sd: number; years: number }): WindowAnomaly {
  return { value, normalMean: normal.mean, normalSd: normal.sd, z: (value - normal.mean) / normal.sd, years: normal.years };
}

/**
 * Realised-weather feature known at `origin`: the window ends `lagDays` before the origin, so
 * no value dated after origin − lagDays is read (ERA5 is published with a ~5-day delay).
 */
export function laggedWindowAnomaly(
  series: DailySeries,
  origin: string,
  lagDays: number,
  windowDays: number,
  agg: 'sum' | 'mean',
  spec: NormalSpec
): WindowAnomaly | null {
  const end = addDaysIso(origin, -lagDays);
  const value = windowAggregate(series, end, windowDays, agg);
  if (value === null) return null;
  const normal = priorYearsNormal(series, end, windowDays, agg, spec);
  return normal ? anomalyVsNormal(value, normal) : null;
}

/**
 * ORACLE (look-ahead by design): realised weather over the target window (origin + 1 …
 * origin + windowDays). Used only as an upper bound on the value of a perfect forecast.
 */
export function oracleWindowAnomaly(series: DailySeries, origin: string, windowDays: number, agg: 'sum' | 'mean', spec: NormalSpec): WindowAnomaly | null {
  const end = addDaysIso(origin, windowDays);
  const value = windowAggregate(series, end, windowDays, agg);
  if (value === null) return null;
  const normal = priorYearsNormal(series, end, windowDays, agg, spec);
  return normal ? anomalyVsNormal(value, normal) : null;
}

/** leadSeries.get(L).get(D) = daily value for target day D from the run issued L days before D. */
export type LeadSeries = Map<number, DailySeries>;

/** Issue (initialisation) day of a lead-L value for target day D. */
export const issueDate = (target: string, lead: number) => addDaysIso(target, -lead);

/**
 * NWP forecast window known at `origin`: target days origin+firstDay … origin+lastDay, each taken
 * from the run issued `leadOffset` day(s) before the origin (lead = k + leadOffset), so every
 * value was initialised on or before origin − leadOffset.
 */
export function forecastWindowValue(prev: LeadSeries, origin: string, firstDay: number, lastDay: number, agg: 'sum' | 'mean', leadOffset = 1): number | null {
  let s = 0;
  for (let k = firstDay; k <= lastDay; k++) {
    const v = prev.get(k + leadOffset)?.get(addDaysIso(origin, k));
    if (v === undefined || !Number.isFinite(v)) return null;
    s += v;
  }
  return agg === 'sum' ? s : s / (lastDay - firstDay + 1);
}

/**
 * Forecast revision known at `origin`: for target days origin+1 … origin+days, the newest
 * admissible run (lead k + leadOffset) minus the run issued `oldLead` days before the target.
 * Mean daily revision in the variable's units (positive = forecast moved up).
 */
export function forecastRevision(prev: LeadSeries, origin: string, days: number, oldLead: number, leadOffset = 1): number | null {
  const diffs: number[] = [];
  for (let k = 1; k <= days; k++) {
    if (k + leadOffset >= oldLead) break;
    const target = addDaysIso(origin, k);
    const fresh = prev.get(k + leadOffset)?.get(target);
    const old = prev.get(oldLead)?.get(target);
    if (fresh === undefined || old === undefined || !Number.isFinite(fresh) || !Number.isFinite(old)) return null;
    diffs.push(fresh - old);
  }
  return diffs.length ? mean(diffs) : null;
}

export function seasonGate(value: number, month: number, months: number[] | null): number {
  return months === null || months.includes(month) ? value : 0;
}

// ----------------------------------------------------------------------------
// Weekly price sampling
// ----------------------------------------------------------------------------

export interface PriceBar {
  date: string;
  close: number;
}

/** Last bar dated in (friday − 7, friday] of a date-sorted series; null when the week has no session. */
export function barForWeekEnding(bars: PriceBar[], friday: string): PriceBar | null {
  let lo = 0, hi = bars.length - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].date <= friday) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at >= 0 && bars[at].date > addDaysIso(friday, -7) ? bars[at] : null;
}

/** All Fridays in [start, end]. */
export function fridays(start: string, end: string): string[] {
  let d = start;
  while (weekdayOf(d) !== 5) d = addDaysIso(d, 1);
  const out: string[] = [];
  for (; d <= end; d = addDaysIso(d, 7)) out.push(d);
  return out;
}
