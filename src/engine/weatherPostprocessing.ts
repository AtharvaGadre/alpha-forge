/**
 * Astraeus statistical post-processing of multi-model weather forecasts.
 *
 * Raw numerical weather prediction (NWP) output is biased and its between-model spread is
 * usually under-dispersive. This module turns the raw forecasts of several global models into
 * calibrated predictive distributions with the methods that are standard in operational
 * meteorology, and scores them with strictly proper scoring rules.
 *
 *  - Additive / multiplicative bias correction over a trailing window (cf. Cui et al. 2012).
 *  - EMOS / non-homogeneous Gaussian regression for temperature, fitted by minimum CRPS
 *    (Gneiting, Raftery, Westveld & Goldman 2005, MWR 133:1098).
 *  - Zero-censored Gaussian EMOS for precipitation, so a probability mass sits at "no rain"
 *    (cf. Messner et al. 2014; Scheuerer & Hamill 2015), with spread driven by the ensemble
 *    mean absolute difference (Scheuerer 2014).
 *  - Closed-form CRPS for Gaussian and zero-censored Gaussian laws, and the ensemble CRPS
 *    (Hersbach 2000; Gneiting & Raftery 2007; Jordan, Krüger & Lerch 2019).
 *  - Verification tools: PIT histograms, reliability bins, Brier score, interval coverage,
 *    Diebold–Mariano with a HAC variance and a moving-block bootstrap.
 *
 * Everything is deterministic (seeded) and has no I/O, so it is unit-tested offline.
 */

// ---------------------------------------------------------------------------
// 1. Special functions
// ---------------------------------------------------------------------------

export const SQRT_PI = Math.sqrt(Math.PI);
const SQRT2 = Math.SQRT2;
const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

/**
 * Complementary error function to ~1e-14: Maclaurin series of erf for |x| < 2.5, and the
 * Laplace continued fraction (modified Lentz) for the tail, where cancellation would hurt.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  let r: number;
  if (z < 2.5) {
    let term = z;
    let sum = z;
    const z2 = z * z;
    for (let n = 1; n < 200; n++) {
      term *= -z2 / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    r = 1 - (2 / SQRT_PI) * sum;
  } else {
    // erfc(z) = exp(-z²)/√π · 1/(z + (1/2)/(z + 1/(z + (3/2)/(z + 2/(z + …)))))
    const tiny = 1e-300;
    let f = z;
    let C = z;
    let D = 0;
    for (let n = 1; n < 300; n++) {
      const a = n / 2;
      D = z + a * D;
      D = Math.abs(D) < tiny ? tiny : D;
      C = z + a / C;
      C = Math.abs(C) < tiny ? tiny : C;
      D = 1 / D;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    }
    r = Math.exp(-z * z) / (SQRT_PI * f);
  }
  return x >= 0 ? r : 2 - r;
}

/** Standard normal density φ. */
export const phi = (z: number): number => INV_SQRT_2PI * Math.exp(-0.5 * z * z);
/** Standard normal distribution function Φ. */
export const Phi = (z: number): number => 0.5 * erfc(-z / SQRT2);

/** Inverse standard normal CDF (Acklam's rational approximation, relative error < 1.2e-9). */
export function PhiInv(p: number): number {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Deterministic PRNG (mulberry32) so bootstraps and randomised PIT are reproducible. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const variance = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = avg(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
};

// ---------------------------------------------------------------------------
// 2. Proper scoring rules
// ---------------------------------------------------------------------------

/** CRPS of N(mu, sigma²) for observation y (Gneiting et al. 2005, eq. 5). */
export function crpsNormal(mu: number, sigma: number, y: number): number {
  const s = Math.max(sigma, 1e-9);
  const z = (y - mu) / s;
  return s * (z * (2 * Phi(z) - 1) + 2 * phi(z) - 1 / SQRT_PI);
}

/**
 * CRPS of a Gaussian left-censored at zero (point mass Φ(-mu/sigma) at 0), for y ≥ 0.
 * Derived as CRPS_N − σ∫_{-∞}^{l} Φ(t)² dt with l = −mu/sigma and
 * ∫_{-∞}^{a} Φ² = aΦ(a)² + 2φ(a)Φ(a) − Φ(a√2)/√π. Unit-tested against numerical integration.
 */
export function crpsCensoredNormal0(mu: number, sigma: number, y: number): number {
  const s = Math.max(sigma, 1e-9);
  const yy = Math.max(0, y);
  const l = -mu / s;
  const Pl = Phi(l);
  const tail = l * Pl * Pl + 2 * phi(l) * Pl - Phi(l * SQRT2) / SQRT_PI;
  return Math.max(0, crpsNormal(mu, s, yy) - s * tail);
}

/**
 * Ensemble CRPS E|X−y| − ½E|X−X'| using the sorted-member identity (O(m log m)).
 * `fair` gives the unbiased "fair" CRPS of Ferro (2014), which does not penalise small ensembles.
 */
export function crpsEnsemble(members: number[], y: number, fair = false): number {
  const x = members.filter(Number.isFinite).sort((a, b) => a - b);
  const m = x.length;
  if (!m) return NaN;
  let e1 = 0;
  for (const v of x) e1 += Math.abs(v - y);
  e1 /= m;
  // Σ_i Σ_j |x_i − x_j| = 2 Σ_i (2i − m + 1) x_(i) for 0-based sorted order
  let pair = 0;
  for (let i = 0; i < m; i++) pair += (2 * i - m + 1) * x[i];
  pair *= 2;
  const denom = fair ? (m > 1 ? 2 * m * (m - 1) : Infinity) : 2 * m * m;
  return e1 - pair / denom;
}

/**
 * Numerical CRPS ∫(F(x) − 1{x ≥ y})² dx on [lo, hi] with composite Simpson integration, split at y
 * and at any CDF jump points so the integrand is smooth on every panel. Used to verify closed forms.
 */
export function crpsNumeric(cdf: (x: number) => number, y: number, lo: number, hi: number, n = 20000, breaks: number[] = []): number {
  const cuts = [lo, ...[y, ...breaks].filter((b) => b > lo && b < hi), hi].sort((a, b) => a - b);
  const panels = Math.max(2, Math.floor(n / (cuts.length - 1)) & ~1);
  let total = 0;
  for (let c = 0; c < cuts.length - 1; c++) {
    const a = cuts[c];
    const b = cuts[c + 1];
    if (b <= a) continue;
    const mid = (a + b) / 2;
    const step = mid >= y ? 1 : 0; // indicator is constant inside a panel
    const g = (x: number) => (cdf(x) - step) ** 2;
    const h = (b - a) / panels;
    // evaluate just inside the panel edges so a jump at the edge is attributed to the correct side
    const eps = Math.min(1e-12, h * 1e-6);
    let s = g(a + eps) + g(b - eps);
    for (let i = 1; i < panels; i++) s += (i % 2 ? 4 : 2) * g(a + i * h);
    total += (s * h) / 3;
  }
  return total;
}

export const brierScore = (p: number, outcome: boolean) => (p - (outcome ? 1 : 0)) ** 2;

// ---------------------------------------------------------------------------
// 3. Derivative-free optimiser
// ---------------------------------------------------------------------------

/** Nelder–Mead simplex minimiser (Lagarias et al. 1998 coefficients). */
export function nelderMead(f: (x: number[]) => number, x0: number[], opts: { maxIter?: number; tol?: number; step?: number[] } = {}): { x: number[]; fx: number; iterations: number } {
  const n = x0.length;
  const maxIter = opts.maxIter ?? 400 * n;
  const tol = opts.tol ?? 1e-8;
  const simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    const st = opts.step?.[i] ?? (Math.abs(p[i]) > 1e-3 ? 0.1 * Math.abs(p[i]) : 0.1);
    p[i] += st;
    simplex.push(p);
  }
  let values = simplex.map((p) => f(p));
  let it = 0;
  for (; it < maxIter; it++) {
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    const s = order.map((i) => simplex[i]);
    const v = order.map((i) => values[i]);
    simplex.splice(0, simplex.length, ...s);
    values = v;
    if (Math.abs(values[n] - values[0]) <= tol * (Math.abs(values[0]) + 1e-12)) break;
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    const along = (t: number) => centroid.map((c, j) => c + t * (simplex[n][j] - c));
    const xr = along(-1);
    const fr = f(xr);
    if (fr < values[0]) {
      const xe = along(-2);
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; values[n] = fe; } else { simplex[n] = xr; values[n] = fr; }
    } else if (fr < values[n - 1]) {
      simplex[n] = xr; values[n] = fr;
    } else {
      const outside = fr < values[n];
      const xc = along(outside ? -0.5 : 0.5);
      const fc = f(xc);
      if (fc < (outside ? fr : values[n])) {
        simplex[n] = xc; values[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((x, j) => simplex[0][j] + 0.5 * (x - simplex[0][j]));
          values[i] = f(simplex[i]);
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i <= n; i++) if (values[i] < values[best]) best = i;
  return { x: simplex[best], fx: values[best], iterations: it };
}

// ---------------------------------------------------------------------------
// 4. Forecast representations
// ---------------------------------------------------------------------------

export type VariableKind = 'temperature' | 'precipitation';

export interface TrainingRow {
  /** Forecasts of each model in a fixed order (all finite). */
  f: number[];
  /** Verifying truth (ERA5). */
  y: number;
}

export type PredictiveForecast =
  | { kind: 'normal'; mu: number; sigma: number }
  | { kind: 'censored-normal'; mu: number; sigma: number }
  | { kind: 'ensemble'; members: number[] }
  | { kind: 'weighted-ensemble'; members: number[]; weights: number[] }
  | { kind: 'censored-power'; mu: number; sigma: number; power: number };

export function crpsOf(fc: PredictiveForecast, y: number): number {
  if (fc.kind === 'censored-power') return crpsCensoredPower(fc, y);
  if (fc.kind === 'weighted-ensemble') return crpsWeightedEnsemble(fc.members, fc.weights, y);
  if (fc.kind === 'normal') return crpsNormal(fc.mu, fc.sigma, y);
  if (fc.kind === 'censored-normal') return crpsCensoredNormal0(fc.mu, fc.sigma, y);
  return crpsEnsemble(fc.members, y);
}

/** Point forecast: mean for Gaussians, censored mean for zero-censored laws, ensemble mean. */
export function pointOf(fc: PredictiveForecast): number {
  if (fc.kind === 'censored-power') return powerMean(fc);
  if (fc.kind === 'weighted-ensemble') return weightedMean(fc.members, fc.weights);
  if (fc.kind === 'normal') return fc.mu;
  if (fc.kind === 'censored-normal') {
    const z = fc.mu / fc.sigma;
    return fc.mu * Phi(z) + fc.sigma * phi(z); // E[max(0, X)]
  }
  return avg(fc.members);
}

export function cdfOf(fc: PredictiveForecast, x: number): number {
  if (fc.kind === 'censored-power') return powerCdf(fc, x);
  if (fc.kind === 'weighted-ensemble') return fc.members.reduce((a, v, i) => a + (v <= x ? fc.weights[i] : 0), 0);
  if (fc.kind === 'normal') return Phi((x - fc.mu) / fc.sigma);
  if (fc.kind === 'censored-normal') return x < 0 ? 0 : Phi((x - fc.mu) / fc.sigma);
  const m = fc.members.length;
  return m ? fc.members.filter((v) => v <= x).length / m : NaN;
}

/** Probability that the variable exceeds `threshold` (e.g. ≥ 1 mm rain, ≥ 32 °C maximum temperature). */
export function exceedanceOf(fc: PredictiveForecast, threshold: number): number {
  if (fc.kind === 'censored-power') return powerExceedance(fc, threshold);
  if (fc.kind === 'weighted-ensemble') return fc.members.reduce((a, v, i) => a + (v >= threshold ? fc.weights[i] : 0), 0);
  if (fc.kind === 'ensemble') {
    const m = fc.members.length;
    return m ? fc.members.filter((v) => v >= threshold).length / m : NaN;
  }
  return 1 - cdfOf(fc, threshold);
}

export function quantileOf(fc: PredictiveForecast, p: number): number {
  if (fc.kind === 'censored-power') return powerQuantile(fc, p);
  if (fc.kind === 'weighted-ensemble') {
    const order = fc.members.map((v, i) => [v, fc.weights[i]] as const).sort((a, b) => a[0] - b[0]);
    let c = 0;
    for (const [v, w] of order) { c += w; if (c >= p - 1e-12) return v; }
    return order[order.length - 1][0];
  }
  if (fc.kind === 'normal') return fc.mu + fc.sigma * PhiInv(p);
  if (fc.kind === 'censored-normal') return Math.max(0, fc.mu + fc.sigma * PhiInv(p));
  const x = [...fc.members].sort((a, b) => a - b);
  if (!x.length) return NaN;
  const h = (x.length - 1) * p;
  const lo = Math.floor(h);
  return x[lo] + (h - lo) * ((x[Math.min(lo + 1, x.length - 1)] ?? x[lo]) - x[lo]);
}

/**
 * Probability integral transform, randomised at point masses (Czado, Gneiting & Held 2009); rank-based for
 * ensembles. Interval coverage is defined from this PIT for every forecast type (PIT ∈ [0.1, 0.9] ⇔ inside the
 * central 80 %), so a calibrated forecast covers 80 % regardless of its representation.
 */
export function pitOf(fc: PredictiveForecast, y: number, u: number): number {
  if (fc.kind === 'censored-power') return pitCensoredPower(fc, y, u);
  if (fc.kind === 'weighted-ensemble') {
    // Weighted analogue of the randomised rank: (m·F_w(y⁻) + u·(1 + m·w_tie)) / (m + 1). With equal
    // weights it reduces exactly to the rank PIT (rank + u)/(m + 1), so a calibrated ensemble is uniform.
    const m = fc.members.length;
    let below = 0;
    let at = 0;
    fc.members.forEach((v, i) => { if (v < y) below += fc.weights[i]; else if (v === y) at += fc.weights[i]; });
    return (m * below + u * (1 + m * at)) / (m + 1);
  }
  if (fc.kind === 'censored-normal' && y <= 0) return u * Phi(-fc.mu / fc.sigma);
  if (fc.kind === 'ensemble') {
    const x = fc.members;
    const below = x.filter((v) => v < y).length;
    const ties = x.filter((v) => v === y).length;
    return (below + u * (ties + 1)) / (x.length + 1);
  }
  return cdfOf(fc, y);
}

// ---------------------------------------------------------------------------
// 5. Post-processing methods
// ---------------------------------------------------------------------------

export interface EnsembleSummary { mean: number; variance: number; mad: number }

/** Mean, between-model variance and Gini mean absolute difference of the members. */
export function summarise(f: number[]): EnsembleSummary {
  const m = f.length;
  let mad = 0;
  if (m > 1) {
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) mad += Math.abs(f[i] - f[j]);
    mad /= m * m;
  }
  return { mean: avg(f), variance: variance(f), mad };
}

/** Per-model additive bias (temperature) over the training window: mean(f_i − y). */
export function additiveBias(rows: TrainingRow[]): number[] {
  const k = rows[0]?.f.length ?? 0;
  return Array.from({ length: k }, (_, i) => avg(rows.map((r) => r.f[i] - r.y)));
}

/** Per-model multiplicative ratio (precipitation): Σy / Σf_i, bounded to [0.25, 4]. */
export function multiplicativeRatio(rows: TrainingRow[]): number[] {
  const k = rows[0]?.f.length ?? 0;
  const sy = rows.reduce((a, r) => a + r.y, 0);
  return Array.from({ length: k }, (_, i) => {
    const sf = rows.reduce((a, r) => a + r.f[i], 0);
    return sf > 0.5 && sy > 0.5 ? Math.min(4, Math.max(0.25, sy / sf)) : 1;
  });
}

export interface EmosModel {
  method: 'emos-normal' | 'emos-censored';
  /** a, b: location; c, d: spread (σ² = c² + d²·spread). For precipitation `g` adds a mean term to the variance. */
  params: { a: number; b: number; c: number; d: number; g?: number };
  bias: number[];
  /** Member weights after shrinkage toward equal weights (sum to 1). */
  weights: number[];
  trainCrps: number;
  n: number;
  iterations: number;
}

function softmax(theta: number[]): number[] {
  const mx = Math.max(...theta);
  const e = theta.map((t) => Math.exp(t - mx));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export interface FitOptions {
  /** Learn member weights (softmax, L2-penalised toward equal weights). */
  learnWeights?: boolean;
  /** L2 penalty on the softmax logits (higher = closer to equal weights). */
  weightPenalty?: number;
}

function weightedMean(f: number[], w: number[]) {
  let s = 0;
  for (let i = 0; i < f.length; i++) s += w[i] * f[i];
  return s;
}

/**
 * Temperature EMOS / NGR (Gneiting et al. 2005): Y ~ N(a + b·m̄, c² + d²·s²), where m̄ is the
 * (optionally weighted) mean of bias-corrected members and s² their variance. Fitted by
 * minimising the mean CRPS of the training window.
 */
export function fitEmosNormal(rows: TrainingRow[], opts: FitOptions = {}): EmosModel | null {
  if (rows.length < 10) return null;
  const k = rows[0].f.length;
  const bias = additiveBias(rows);
  const corrected = rows.map((r) => ({ f: r.f.map((v, i) => v - bias[i]), y: r.y }));
  const learn = !!opts.learnWeights && k > 1;
  const lambda = opts.weightPenalty ?? 0.5;
  const sds = Math.sqrt(variance(corrected.map((r) => r.y - avg(r.f)))) || 1;
  const unpack = (x: number[]) => {
    const theta = learn ? [0, ...x.slice(4, 4 + k - 1)] : new Array(k).fill(0);
    return { a: x[0], b: x[1], c: x[2], d: x[3], w: softmax(theta), theta };
  };
  const objective = (x: number[]) => {
    const { a, b, c, d, w, theta } = unpack(x);
    let s = 0;
    for (const r of corrected) {
      const m = weightedMean(r.f, w);
      let v = 0;
      for (let i = 0; i < k; i++) v += w[i] * (r.f[i] - m) ** 2;
      const sigma = Math.sqrt(c * c + d * d * v + 1e-6);
      s += crpsNormal(a + b * m, sigma, r.y);
    }
    const pen = learn ? lambda * theta.reduce((acc, t) => acc + t * t, 0) * (sds / Math.sqrt(rows.length)) : 0;
    return s / corrected.length + pen + 1e-4 * (b - 1) ** 2;
  };
  const x0 = [0, 1, sds, 1, ...(learn ? new Array(k - 1).fill(0) : [])];
  const res = nelderMead(objective, x0, { maxIter: learn ? 3000 : 1200 });
  const { a, b, c, d, w } = unpack(res.x);
  return { method: 'emos-normal', params: { a, b, c: Math.abs(c), d: Math.abs(d) }, bias, weights: w, trainCrps: res.fx, n: rows.length, iterations: res.iterations };
}

export function predictEmosNormal(model: EmosModel, f: number[]): PredictiveForecast {
  const g = f.map((v, i) => v - model.bias[i]);
  const w = model.weights;
  const m = weightedMean(g, w);
  let v = 0;
  for (let i = 0; i < g.length; i++) v += w[i] * (g[i] - m) ** 2;
  const { a, b, c, d } = model.params;
  return { kind: 'normal', mu: a + b * m, sigma: Math.sqrt(c * c + d * d * v + 1e-6) };
}

/**
 * Precipitation EMOS: zero-censored Gaussian with location a + b·m̄ and variance
 * c² + d²·MD + g²·m̄, where MD is the members' mean absolute difference (Scheuerer 2014).
 * Fitted by minimum CRPS with the closed-form censored CRPS above.
 */
export function fitEmosCensored(rows: TrainingRow[], opts: FitOptions = {}): EmosModel | null {
  if (rows.length < 10) return null;
  const k = rows[0].f.length;
  const wetDays = rows.filter((r) => r.y >= 0.2).length;
  if (wetDays < 3) return null; // nothing to learn a wet-day distribution from
  const learn = !!opts.learnWeights && k > 1;
  const lambda = opts.weightPenalty ?? 0.5;
  const sdy = Math.sqrt(variance(rows.map((r) => r.y))) || 1;
  const unpack = (x: number[]) => {
    const theta = learn ? [0, ...x.slice(5, 5 + k - 1)] : new Array(k).fill(0);
    return { a: x[0], b: x[1], c: x[2], d: x[3], g: x[4], w: softmax(theta), theta };
  };
  const objective = (x: number[]) => {
    const { a, b, c, d, g, w, theta } = unpack(x);
    let s = 0;
    for (const r of rows) {
      const m = weightedMean(r.f, w);
      let md = 0;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) md += w[i] * w[j] * Math.abs(r.f[i] - r.f[j]);
      const sigma = Math.sqrt(c * c + d * d * md + g * g * Math.max(0, m) + 1e-6);
      s += crpsCensoredNormal0(a + b * m, sigma, r.y);
    }
    const pen = learn ? lambda * theta.reduce((acc, t) => acc + t * t, 0) * (sdy / Math.sqrt(rows.length)) : 0;
    return s / rows.length + pen;
  };
  const x0 = [0, 1, Math.max(0.3, 0.5 * sdy), 1, 0.5, ...(learn ? new Array(k - 1).fill(0) : [])];
  const res = nelderMead(objective, x0, { maxIter: learn ? 3000 : 1500 });
  const { a, b, c, d, g, w } = unpack(res.x);
  return { method: 'emos-censored', params: { a, b, c: Math.abs(c), d: Math.abs(d), g: Math.abs(g) }, bias: new Array(k).fill(0), weights: w, trainCrps: res.fx, n: rows.length, iterations: res.iterations };
}

export function predictEmosCensored(model: EmosModel, f: number[]): PredictiveForecast {
  const w = model.weights;
  const k = f.length;
  const m = weightedMean(f, w);
  let md = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) md += w[i] * w[j] * Math.abs(f[i] - f[j]);
  const { a, b, c, d, g = 0 } = model.params;
  return { kind: 'censored-normal', mu: a + b * m, sigma: Math.sqrt(c * c + d * d * md + g * g * Math.max(0, m) + 1e-6) };
}

/**
 * Astraeus v1 baseline (the method shipped before this module): inverse-MSE weights shrunk 50 %
 * toward equal, Gaussian with the between-model spread inflated by the training RMSE/spread ratio.
 */
export function fitAstraeusV1(rows: TrainingRow[]): { weights: number[]; k: number } | null {
  if (rows.length < 8) return null;
  const n = rows[0].f.length;
  const mse = Array.from({ length: n }, (_, i) => avg(rows.map((r) => (r.f[i] - r.y) ** 2)));
  const inv = mse.map((v) => 1 / Math.max(1e-6, v));
  const s = inv.reduce((a, b) => a + b, 0);
  const weights = inv.map((v) => 0.5 * (v / s) + 0.5 / n);
  const pred = rows.map((r) => {
    const m = weightedMean(r.f, weights);
    const sd = Math.sqrt(r.f.reduce((a, v, i) => a + weights[i] * (v - m) ** 2, 0));
    return { m, sd };
  });
  const errs = pred.map((p, i) => (p.m - rows[i].y) ** 2);
  const sprs = pred.map((p) => p.sd ** 2);
  const k = Math.max(1, Math.sqrt(avg(errs) / Math.max(0.05, avg(sprs))));
  return { weights, k };
}

export function predictAstraeusV1(model: { weights: number[]; k: number }, f: number[], kind: VariableKind): PredictiveForecast {
  const m = weightedMean(f, model.weights);
  const sd = Math.sqrt(f.reduce((a, v, i) => a + model.weights[i] * (v - m) ** 2, 0));
  const sigma = Math.max(kind === 'precipitation' ? 0.3 : 0.3, model.k * sd);
  return kind === 'precipitation' ? { kind: 'censored-normal', mu: m, sigma } : { kind: 'normal', mu: m, sigma };
}

/** Bias-corrected members kept as an ensemble (no distributional assumption). */
export function biasCorrectedEnsemble(rows: TrainingRow[], kind: VariableKind) {
  if (rows.length < 8) return null;
  return kind === 'temperature' ? { kind, shift: additiveBias(rows), scale: null as number[] | null } : { kind, shift: null as number[] | null, scale: multiplicativeRatio(rows) };
}

export function applyBiasCorrection(model: NonNullable<ReturnType<typeof biasCorrectedEnsemble>>, f: number[]): PredictiveForecast {
  if (model.shift) return { kind: 'ensemble', members: f.map((v, i) => v - model.shift![i]) };
  return { kind: 'ensemble', members: f.map((v, i) => Math.max(0, v * model.scale![i])) };
}

// ---------------------------------------------------------------------------
// 6. Verification summaries
// ---------------------------------------------------------------------------

export interface ReliabilityBin { lo: number; hi: number; n: number; meanForecast: number; observedFrequency: number }

export function reliabilityBins(probs: number[], outcomes: boolean[], nBins = 10): ReliabilityBin[] {
  const bins: ReliabilityBin[] = Array.from({ length: nBins }, (_, i) => ({ lo: i / nBins, hi: (i + 1) / nBins, n: 0, meanForecast: 0, observedFrequency: 0 }));
  probs.forEach((p, i) => {
    if (!Number.isFinite(p)) return;
    const b = Math.min(nBins - 1, Math.max(0, Math.floor(p * nBins)));
    bins[b].n++;
    bins[b].meanForecast += p;
    bins[b].observedFrequency += outcomes[i] ? 1 : 0;
  });
  return bins.map((b) => (b.n ? { ...b, meanForecast: b.meanForecast / b.n, observedFrequency: b.observedFrequency / b.n } : b));
}

export function histogram(values: number[], nBins = 10, lo = 0, hi = 1): number[] {
  const out = new Array(nBins).fill(0);
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    out[Math.min(nBins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * nBins)))]++;
  }
  return out;
}

/** Brier-score decomposition (Murphy 1973): reliability − resolution + uncertainty. */
export function brierDecomposition(probs: number[], outcomes: boolean[], nBins = 10) {
  const bins = reliabilityBins(probs, outcomes, nBins);
  const n = bins.reduce((a, b) => a + b.n, 0) || 1;
  const base = outcomes.filter(Boolean).length / Math.max(1, outcomes.length);
  const reliability = bins.reduce((a, b) => a + b.n * (b.meanForecast - b.observedFrequency) ** 2, 0) / n;
  const resolution = bins.reduce((a, b) => a + b.n * (b.observedFrequency - base) ** 2, 0) / n;
  return { reliability, resolution, uncertainty: base * (1 - base), baseRate: base };
}

/** Moving-block bootstrap CI of the mean of a (possibly autocorrelated) series. */
export function blockBootstrapMeanCI(x: number[], opts: { block?: number; resamples?: number; seed?: number; alpha?: number } = {}) {
  const n = x.length;
  const block = Math.max(1, Math.min(n, opts.block ?? 7));
  const B = opts.resamples ?? 2000;
  const rnd = seededRandom(opts.seed ?? 20261115);
  const means: number[] = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    let c = 0;
    while (c < n) {
      const start = Math.floor(rnd() * (n - block + 1));
      for (let j = 0; j < block && c < n; j++, c++) s += x[start + j];
    }
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  const alpha = opts.alpha ?? 0.05;
  return { mean: avg(x), lo: means[Math.floor((alpha / 2) * B)], hi: means[Math.min(B - 1, Math.floor((1 - alpha / 2) * B))] };
}

/**
 * Diebold–Mariano test on a loss-differential series d_t (method A loss − method B loss) with a
 * Newey–West (Bartlett) long-run variance using `lag` autocovariances and the Harvey–Leybourne–
 * Newbold (1997) small-sample correction. Two-sided p-value from Student t (normal for large n).
 */
export function dieboldMariano(d: number[], lag = 0) {
  const n = d.length;
  if (n < 8) return { statistic: NaN, pValue: NaN, n, meanDiff: avg(d) };
  const m = avg(d);
  const gamma = (k: number) => {
    let s = 0;
    for (let t = k; t < n; t++) s += (d[t] - m) * (d[t - k] - m);
    return s / n;
  };
  let lrv = gamma(0);
  for (let k = 1; k <= lag; k++) lrv += 2 * (1 - k / (lag + 1)) * gamma(k);
  if (!(lrv > 0)) return { statistic: 0, pValue: 1, n, meanDiff: m };
  const h = lag + 1;
  const hln = Math.sqrt((n + 1 - 2 * h + (h * (h - 1)) / n) / n);
  const stat = (m / Math.sqrt(lrv / n)) * hln;
  return { statistic: stat, pValue: 2 * (1 - studentTCdf(Math.abs(stat), n - 1)), n, meanDiff: m };
}

/** Student-t CDF via the regularised incomplete beta function (continued fraction). */
export function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  if (df > 400) return Phi(t);
  const x = df / (df + t * t);
  const ib = incompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

function logGamma(z: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx: number, aa: number, bb: number) => {
    const FPMIN = 1e-300;
    let c = 1;
    let d = 1 - ((aa + bb) * xx) / (aa + 1);
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa2 = (m * (bb - m) * xx) / ((aa - 1 + m2) * (aa + m2));
      d = 1 + aa2 * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa2 / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa2 = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + 1 + m2));
      d = 1 + aa2 * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa2 / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}

// ---------------------------------------------------------------------------
// 7. One-call helper used by the live pipeline
// ---------------------------------------------------------------------------

export interface CalibratedDay {
  date: string;
  raw: { mean: number; min: number; max: number; members: number };
  calibrated: { mean: number; p10: number; p50: number; p90: number; sigma: number; probAbove?: number };
}

/**
 * Fit on `train` and return calibrated forecasts for `apply`. Falls back to `null` (caller keeps raw)
 * when the window is too short or degenerate — calibration is never faked.
 */
export function calibrate(kind: VariableKind, train: TrainingRow[], apply: Array<{ date: string; f: number[] }>, threshold?: number): { model: EmosModel; days: CalibratedDay[] } | null {
  const model = kind === 'temperature' ? fitEmosNormal(train) : fitEmosCensored(train);
  if (!model) return null;
  const days = apply.map(({ date, f }) => {
    const fc = kind === 'temperature' ? predictEmosNormal(model, f) : predictEmosCensored(model, f);
    const sigma = 'sigma' in fc ? fc.sigma : NaN;
    return {
      date,
      raw: { mean: avg(f), min: Math.min(...f), max: Math.max(...f), members: f.length },
      calibrated: {
        mean: pointOf(fc),
        p10: quantileOf(fc, 0.1),
        p50: quantileOf(fc, 0.5),
        p90: quantileOf(fc, 0.9),
        sigma,
        ...(threshold !== undefined ? { probAbove: exceedanceOf(fc, threshold) } : {}),
      },
    };
  });
  return { model, days };
}

// ---------------------------------------------------------------------------
// 8. Second-generation methods (developed on the 2025-09…2026-03 development period only)
// ---------------------------------------------------------------------------

/** CRPS of a weighted ensemble: Σwᵢ|xᵢ−y| − ½ΣΣwᵢwⱼ|xᵢ−xⱼ| (weights sum to 1). */
export function crpsWeightedEnsemble(members: number[], weights: number[], y: number): number {
  let a = 0;
  let b = 0;
  for (let i = 0; i < members.length; i++) {
    a += weights[i] * Math.abs(members[i] - y);
    for (let j = 0; j < members.length; j++) b += weights[i] * weights[j] * Math.abs(members[i] - members[j]);
  }
  return a - 0.5 * b;
}

/** Inverse-MSE skill weights shrunk toward equal weights by `shrink` (0 = pure inverse-MSE). */
export function skillWeights(rows: TrainingRow[], shrink = 0.25, shift?: number[]): number[] {
  const k = rows[0]?.f.length ?? 0;
  const mse = Array.from({ length: k }, (_, i) => avg(rows.map((r) => (r.f[i] - (shift?.[i] ?? 0) - r.y) ** 2)));
  const inv = mse.map((v) => 1 / Math.max(1e-6, v));
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((v) => (1 - shrink) * (v / s) + shrink / k);
}

export interface SkillNgrModel {
  method: 'ngr-skill';
  bias: number[];
  weights: number[];
  params: { a: number; b: number; c: number; d: number; g: number };
  useClimatology: boolean;
  n: number;
}

/**
 * Skill-weighted NGR: members are bias-corrected, combined with inverse-MSE weights (shrunk toward
 * equal), then Y ~ N(a + b·m̄_w [+ g·climatological mean], c² + d²·s²_w) fitted by minimum CRPS.
 * Four or five parameters regardless of the number of models, which limits over-fitting on short windows.
 */
export function fitNgrSkill(rows: Array<TrainingRow & { clim?: number }>, opts: { shrink?: number; useClimatology?: boolean } = {}): SkillNgrModel | null {
  if (rows.length < 10) return null;
  const useClim = !!opts.useClimatology && rows.every((r) => Number.isFinite(r.clim));
  const bias = additiveBias(rows);
  const weights = skillWeights(rows, opts.shrink ?? 0.25, bias);
  const prepared = rows.map((r) => {
    const g = r.f.map((v, i) => v - bias[i]);
    const m = weightedMean(g, weights);
    let s2 = 0;
    for (let i = 0; i < g.length; i++) s2 += weights[i] * (g[i] - m) ** 2;
    return { m, s2, y: r.y, c: r.clim ?? 0 };
  });
  const sd = Math.sqrt(variance(prepared.map((p) => p.y - p.m))) || 1;
  const objective = (x: number[]) => {
    const [a, b, c, d, g] = x;
    let s = 0;
    for (const p of prepared) s += crpsNormal(a + b * p.m + (useClim ? g * (p.c - p.m) : 0), Math.sqrt(c * c + d * d * p.s2 + 1e-6), p.y);
    return s / prepared.length + 1e-4 * ((b - 1) ** 2 + (useClim ? g * g : 0));
  };
  const res = nelderMead(objective, [0, 1, sd, 1, 0], { maxIter: 1500 });
  const [a, b, c, d, g] = res.x;
  return { method: 'ngr-skill', bias, weights, params: { a, b, c: Math.abs(c), d: Math.abs(d), g: useClim ? g : 0 }, useClimatology: useClim, n: rows.length };
}

export function predictNgrSkill(model: SkillNgrModel, f: number[], clim?: number): PredictiveForecast {
  const g = f.map((v, i) => v - model.bias[i]);
  const m = weightedMean(g, model.weights);
  let s2 = 0;
  for (let i = 0; i < g.length; i++) s2 += model.weights[i] * (g[i] - m) ** 2;
  const { a, b, c, d, g: gc } = model.params;
  const mu = a + b * m + (model.useClimatology && Number.isFinite(clim) ? gc * ((clim as number) - m) : 0);
  return { kind: 'normal', mu, sigma: Math.sqrt(c * c + d * d * s2 + 1e-6) };
}

/**
 * Precipitation on a power scale: Z = Y^p (p = ½ by default) is modelled as a Gaussian left-censored at
 * zero with location a + b·mean(Xᵢ^p) and scale √(c² + d²·sd(Xᵢ^p)²), fitted by maximum likelihood
 * (Messner et al. 2014 use the same square-root censored family; Gebetsberger et al. 2018 compare ML
 * with minimum-CRPS estimation). Scores are always computed on the original mm scale.
 */
export interface PowerCensoredModel { method: 'censored-power'; power: number; weights: number[]; params: { a: number; b: number; c: number; d: number }; n: number }

export function fitCensoredPower(rows: TrainingRow[], opts: { power?: number; weighted?: boolean; shrink?: number } = {}): PowerCensoredModel | null {
  if (rows.length < 10) return null;
  if (rows.filter((r) => r.y >= 0.2).length < 3) return null;
  const p = opts.power ?? 0.5;
  const k = rows[0].f.length;
  const tr = (v: number) => Math.pow(Math.max(0, v), p);
  const tRows = rows.map((r) => ({ f: r.f.map(tr), y: tr(r.y) }));
  const weights = opts.weighted ? skillWeights(tRows, opts.shrink ?? 0.25) : new Array(k).fill(1 / k);
  const prepared = tRows.map((r) => {
    const m = weightedMean(r.f, weights);
    let s2 = 0;
    for (let i = 0; i < k; i++) s2 += weights[i] * (r.f[i] - m) ** 2;
    return { m, s: Math.sqrt(s2), y: r.y };
  });
  const sdy = Math.sqrt(variance(prepared.map((q) => q.y))) || 1;
  const negLogLik = (x: number[]) => {
    const [a, b, c, d] = x;
    let ll = 0;
    for (const q of prepared) {
      const mu = a + b * q.m;
      const sigma = Math.sqrt(c * c + d * d * q.s * q.s + 1e-4);
      if (q.y <= 0) ll += Math.log(Math.max(1e-300, Phi(-mu / sigma)));
      else ll += Math.log(Math.max(1e-300, phi((q.y - mu) / sigma) / sigma));
    }
    return -ll / prepared.length + 1e-4 * (b - 1) ** 2;
  };
  const res = nelderMead(negLogLik, [0, 1, Math.max(0.2, 0.5 * sdy), 1], { maxIter: 1500 });
  const [a, b, c, d] = res.x;
  return { method: 'censored-power', power: p, weights, params: { a, b, c: Math.abs(c), d: Math.abs(d) }, n: rows.length };
}

/** Predictive law of a power-censored model, evaluated on the original scale through its CDF. */
export interface PowerCensoredForecast { kind: 'censored-power'; mu: number; sigma: number; power: number }

export function predictCensoredPower(model: PowerCensoredModel, f: number[]): PowerCensoredForecast {
  const t = f.map((v) => Math.pow(Math.max(0, v), model.power));
  const m = weightedMean(t, model.weights);
  let s2 = 0;
  for (let i = 0; i < t.length; i++) s2 += model.weights[i] * (t[i] - m) ** 2;
  const { a, b, c, d } = model.params;
  return { kind: 'censored-power', mu: a + b * m, sigma: Math.sqrt(c * c + d * d * s2 + 1e-4), power: model.power };
}

export const powerCdf = (fc: PowerCensoredForecast, x: number) => (x < 0 ? 0 : Phi((Math.pow(x, fc.power) - fc.mu) / fc.sigma));
export const powerQuantile = (fc: PowerCensoredForecast, q: number) => Math.pow(Math.max(0, fc.mu + fc.sigma * PhiInv(q)), 1 / fc.power);
export const powerExceedance = (fc: PowerCensoredForecast, t: number) => 1 - powerCdf(fc, t);

/** E[Y] by quantile averaging (midpoint rule on 200 quantiles — ample for display and MAE). */
export function powerMean(fc: PowerCensoredForecast): number {
  let s = 0;
  for (let i = 0; i < 200; i++) s += powerQuantile(fc, (i + 0.5) / 200);
  return s / 200;
}

/** CRPS on the original scale by Simpson integration of the CDF (split at the observation). */
export function crpsCensoredPower(fc: PowerCensoredForecast, y: number): number {
  const hi = Math.max(y, powerQuantile(fc, 0.99995)) + 1;
  return crpsNumeric((x) => powerCdf(fc, x), y, 0, hi, 1600);
}

export function pitCensoredPower(fc: PowerCensoredForecast, y: number, u: number): number {
  return y <= 0 ? u * Phi(-fc.mu / fc.sigma) : powerCdf(fc, y);
}

/** Zero-training baseline: a Gaussian (zero-censored for rain) with the members' mean and standard deviation. */
export function rawGaussian(f: number[], kind: VariableKind): PredictiveForecast {
  const m = avg(f);
  const sd = Math.sqrt(f.reduce((a, v) => a + (v - m) ** 2, 0) / Math.max(1, f.length - 1));
  const sigma = Math.max(kind === 'precipitation' ? 0.1 : 0.05, sd);
  return kind === 'precipitation' ? { kind: 'censored-normal', mu: m, sigma } : { kind: 'normal', mu: m, sigma };
}

/** Coverage of the central interval [α, 1−α] judged from the (randomised) PIT — consistent across forecast types. */
export const insideCentral = (pit: number, alpha = 0.1) => pit >= alpha && pit <= 1 - alpha;
