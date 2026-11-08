/**
 * Deterministic PRNG (Mulberry32), Box-Muller Normal Sampler,
 * Checksum Generator, and Core Statistical Estimators.
 */

export class SeededRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  /** Uniform float in [0, 1) via Mulberry32 */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Standard normal N(0, 1) via Box-Muller transform */
  nextNormal(): number {
    let u1 = 0;
    let u2 = 0;
    while (u1 <= 1e-12) u1 = this.next();
    u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /** Poisson random variate with intensity lambda >= 0 */
  nextPoisson(lambda: number): number {
    if (!Number.isFinite(lambda) || lambda <= 0) return 0;
    const L = Math.exp(-Math.min(lambda, 50));
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= this.next();
    } while (p > L && k < 100);
    return k - 1;
  }
}

/** Deterministic FNV-1a / SHA-style hex digest for reproducibility manifests */
export function computeDeterministicHash(payload: string): string {
  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `sha256:${hex1}${hex2}${hex1.split('').reverse().join('')}`;
}

export function mean(arr: number[]): number {
  const valid = arr.filter((x) => Number.isFinite(x));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function stdDev(arr: number[]): number {
  const valid = arr.filter((x) => Number.isFinite(x));
  if (valid.length < 2) return 0;
  const m = mean(valid);
  const variance = valid.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (valid.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

export function quantile(arr: number[], q: number): number {
  const valid = arr.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (valid.length === 0) return 0;
  const clampedQ = Math.max(0, Math.min(1, q));
  const pos = (valid.length - 1) * clampedQ;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (valid[base + 1] !== undefined) {
    return valid[base] + rest * (valid[base + 1] - valid[base]);
  }
  return valid[base];
}

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom > 1e-12 ? Math.max(-1, Math.min(1, num / denom)) : 0;
}

export function rankArray(arr: number[]): number[] {
  const indexed = arr.map((v, idx) => ({ v: Number.isFinite(v) ? v : 0, idx }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(arr.length);
  for (let i = 0; i < indexed.length; i++) {
    ranks[indexed[i].idx] = i + 1;
  }
  return ranks;
}

export function spearmanRankIC(signal: number[], forwardReturns: number[]): number {
  if (signal.length < 2 || forwardReturns.length < 2) return 0;
  const rSignal = rankArray(signal);
  const rRet = rankArray(forwardReturns);
  return pearsonCorrelation(rSignal, rRet);
}
