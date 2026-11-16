import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRNG } from './prng';
import {
  addDaysIso,
  barForWeekEnding,
  benjaminiHochberg,
  blockBootstrapOosR2,
  clarkWest,
  dieboldMariano,
  evaluateSkill,
  fitRidge,
  forecastRevision,
  forecastWindowValue,
  fridays,
  incompleteBeta,
  issueDate,
  laggedWindowAnomaly,
  neweyWestLongRunVariance,
  normalCdf,
  oosR2,
  olsHac,
  oracleWindowAnomaly,
  pesaranTimmermann,
  predictRidge,
  singleSineDegreeDays,
  studentTCdf,
  walkForward,
  type DailySeries,
  type LeadSeries,
  type StudyRow,
} from './priceSkill';

const close = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);

test('normal and Student-t distribution functions match textbook quantiles', () => {
  close(normalCdf(0), 0.5, 2e-7); // erfcc accuracy ~1.2e-7
  close(normalCdf(1.959964), 0.975, 1e-6);
  close(normalCdf(-1.644854), 0.05, 1e-6);
  close(studentTCdf(2.228139, 10), 0.975, 1e-5); // t(0.975, 10)
  close(studentTCdf(1.812461, 10), 0.95, 1e-5); // t(0.95, 10)
  close(1 - studentTCdf(2.0, 10), 0.036694, 1e-5);
  close(studentTCdf(-2.0, 10), 0.036694, 1e-5);
  close(studentTCdf(1.959964, 1e6), 0.975, 1e-5); // converges to the normal
  close(incompleteBeta(0.5, 2, 2), 0.5, 1e-9);
});

test('ridge recovers noiseless coefficients and standardises with training statistics only', () => {
  const X = Array.from({ length: 50 }, (_, i) => [Math.sin(i), i % 7]);
  const y = X.map(([a, b]) => 1 + 2 * a - 3 * b);
  const m = fitRidge(X, y, 1e-9);
  close(predictRidge(m, [0.3, 4]), 1 + 0.6 - 12, 1e-5);
  // A constant column is ignored rather than producing NaN.
  const withConst = fitRidge(X.map((r) => [...r, 5]), y, 1e-9);
  close(predictRidge(withConst, [0.3, 4, 999]), 1 + 0.6 - 12, 1e-5);
  // Heavy shrinkage pulls the forecast toward the training mean.
  const shrunk = fitRidge(X, y, 1e9);
  close(predictRidge(shrunk, [0.3, 4]), y.reduce((a, b) => a + b, 0) / y.length, 1e-3);
});

function weeklyRows(n: number, seed: number, signal: number, horizon = 1): StudyRow[] {
  const rng = new SeededRNG(seed);
  const rows: StudyRow[] = [];
  for (let i = 0; i < n; i++) {
    const w = rng.nextNormal();
    const m1 = rng.nextNormal();
    const m2 = rng.nextNormal();
    const origin = addDaysIso('2010-01-01', 7 * i);
    rows.push({ origin, labelDate: addDaysIso(origin, 7 * horizon), y: signal * w + rng.nextNormal(), market: [m1, m2], weather: [w] });
  }
  return rows;
}

test('walk-forward never trains on labels realised after the origin', () => {
  const rows = weeklyRows(120, 3, 0.4, 4);
  const base = walkForward(rows, { minTrain: 30, lambdaPerObs: 0.1 });
  const cutoff = base[20].origin;
  // Change every outcome whose label is not yet realised at the cutoff origin.
  const altered = rows.map((r) => (r.labelDate > cutoff ? { ...r, y: r.y + 50 } : r));
  const again = walkForward(altered, { minTrain: 30, lambdaPerObs: 0.1 });
  for (let i = 0; i <= 20; i++) {
    assert.equal(again[i].origin, base[i].origin);
    if (base[i].origin <= cutoff) {
      close(again[i].wx, base[i].wx, 1e-12);
      close(again[i].mkt, base[i].mkt, 1e-12);
      close(again[i].hm, base[i].hm, 1e-12);
    }
  }
  // With 4-week overlapping targets, the 3 most recent origins are excluded from training.
  const firstTestIdx = rows.findIndex((r) => r.origin === base[0].origin);
  assert.equal(base[0].nTrain, firstTestIdx - 3);
});

test('planted weather signal is detected out of sample', () => {
  const preds = walkForward(weeklyRows(400, 11, 0.6), { minTrain: 100, lambdaPerObs: 0.1 });
  const m = evaluateSkill(preds, 1, { resamples: 400, seed: 1 })!;
  assert.ok(m.oosR2Wx > 0.15, `oosR2 ${m.oosR2Wx}`);
  assert.ok(m.cwWxVsMkt!.p < 0.001, `CW p ${m.cwWxVsMkt!.p}`);
  assert.ok(m.dmWxVsRw!.p < 0.01, `DM p ${m.dmWxVsRw!.p}`);
  assert.ok(m.ptWx!.p < 0.01, `PT p ${m.ptWx!.p}`);
  assert.ok(m.oosR2WxCi95.lo > 0 && m.oosR2WxCi95.lo <= m.oosR2Wx && m.oosR2Wx <= m.oosR2WxCi95.hi);
});

test('pure noise is not significant, and test size stays near nominal across seeds', () => {
  const one = evaluateSkill(walkForward(weeklyRows(300, 101, 0), { minTrain: 100, lambdaPerObs: 0.1 }), 1, { resamples: 300, seed: 1 })!;
  assert.ok(one.cwWxVsMkt!.p > 0.05, `CW p ${one.cwWxVsMkt!.p}`);
  assert.ok(one.dmWxVsRw!.p > 0.05, `DM p ${one.dmWxVsRw!.p}`);
  assert.ok(one.oosR2Wx < 0.02);
  let cw = 0, dm = 0, pt = 0;
  const seeds = 40;
  for (let s = 0; s < seeds; s++) {
    const preds = walkForward(weeklyRows(260, 1000 + s, 0), { minTrain: 80, lambdaPerObs: 0.1 });
    const y = preds.map((p) => p.y);
    const err = (f: number[]) => y.map((v, i) => v - f[i]);
    if (clarkWest(y, preds.map((p) => p.mkt), preds.map((p) => p.wx), 1)!.p < 0.05) cw++;
    if (dieboldMariano(err(preds.map((p) => p.rw)), err(preds.map((p) => p.wx)), 1)!.p < 0.05) dm++;
    const ptr = pesaranTimmermann(y, preds.map((p) => p.wx));
    if (ptr && ptr.p < 0.05) pt++;
  }
  assert.ok(cw / seeds <= 0.15, `CW rejection rate ${cw / seeds}`);
  assert.ok(dm / seeds <= 0.15, `DM rejection rate ${dm / seeds}`);
  assert.ok(pt / seeds <= 0.15, `PT rejection rate ${pt / seeds}`);
});

test('Diebold–Mariano is antisymmetric and neutral for identical errors', () => {
  const rng = new SeededRNG(5);
  const a = Array.from({ length: 80 }, () => rng.nextNormal());
  const b = Array.from({ length: 80 }, () => rng.nextNormal() * 1.1);
  const ab = dieboldMariano(a, b, 4)!;
  const ba = dieboldMariano(b, a, 4)!;
  close(ab.stat, -ba.stat, 1e-12);
  close(ab.p + ba.p, 1, 1e-9);
  assert.equal(dieboldMariano(a, a, 1)!.p, 0.5);
});

test('Newey–West variance equals the sample variance at lag 0 and grows with positive autocorrelation', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  close(neweyWestLongRunVariance(x, 0), 5.25, 1e-12); // population variance
  assert.ok(neweyWestLongRunVariance(x, 3) > 5.25);
});

test('Pesaran–Timmermann rewards sign accuracy and is undefined for constant forecasts', () => {
  const y = Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? -1 : 1) * (1 + (i % 5)));
  const perfect = pesaranTimmermann(y, y)!;
  assert.equal(perfect.hitRate, 1);
  assert.ok(perfect.p < 1e-6);
  assert.equal(pesaranTimmermann(y, y.map(() => 0.1)), null);
});

test('Benjamini–Hochberg matches a hand-computed example and skips nulls', () => {
  const q = benjaminiHochberg([0.01, 0.04, null, 0.03, 0.005]);
  assert.deepEqual(q.map((v) => (v === null ? null : Math.round(v * 1e6) / 1e6)), [0.02, 0.04, null, 0.04, 0.02]);
});

test('block bootstrap is deterministic for a seed', () => {
  const rng = new SeededRNG(9);
  const y = Array.from({ length: 100 }, () => rng.nextNormal());
  const f = y.map((v) => 0.5 * v);
  const z = y.map(() => 0);
  const a = blockBootstrapOosR2(y, f, z, 5, 200, 42);
  const b = blockBootstrapOosR2(y, f, z, 5, 200, 42);
  assert.deepEqual(a, b);
  assert.ok(a.lo <= oosR2(y, f, z) && oosR2(y, f, z) <= a.hi);
});

test('single-sine degree-days handle the three regimes', () => {
  assert.equal(singleSineDegreeDays(10, 25, 29), 0);
  close(singleSineDegreeDays(30, 34, 29), 3, 1e-12);
  close(singleSineDegreeDays(20, 30, 25), 5 / Math.PI, 1e-12);
  assert.ok(singleSineDegreeDays(20, 30, 29) < singleSineDegreeDays(20, 31, 29));
});

function dailySeries(start: string, days: number, seed: number): DailySeries {
  const rng = new SeededRNG(seed);
  const s: DailySeries = new Map();
  for (let i = 0; i < days; i++) s.set(addDaysIso(start, i), 10 + 5 * rng.nextNormal());
  return s;
}

test('realised-weather features at origin t read only data dated ≤ t − lag', () => {
  const series = dailySeries('2000-01-01', 365 * 12, 4);
  const origin = '2011-07-15';
  const lag = 7;
  const spec = { normalYears: 10, minYears: 5, sdFloor: 0.5 };
  const base = laggedWindowAnomaly(series, origin, lag, 28, 'sum', spec)!;
  assert.ok(base && base.years === 10);
  const poisoned: DailySeries = new Map([...series].map(([d, v]) => [d, d > addDaysIso(origin, -lag) ? v + 1e6 : v]));
  assert.deepEqual(laggedWindowAnomaly(poisoned, origin, lag, 28, 'sum', spec), base);
  // A value inside the window does move the feature.
  const inside = new Map(series);
  inside.set(addDaysIso(origin, -lag), 1e6);
  assert.notEqual(laggedWindowAnomaly(inside, origin, lag, 28, 'sum', spec)!.value, base.value);
  // Missing history inside the window → no feature rather than a fabricated value.
  const gap = new Map(series);
  gap.delete(addDaysIso(origin, -lag - 3));
  assert.equal(laggedWindowAnomaly(gap, origin, lag, 28, 'sum', spec), null);
  // The oracle tier deliberately reads the future target window (and is labelled as such).
  assert.notDeepEqual(oracleWindowAnomaly(poisoned, origin, 7, 'sum', spec), oracleWindowAnomaly(series, origin, 7, 'sum', spec));
});

test('NWP forecast features at origin t use only runs issued on or before t − 1', () => {
  const origin = '2025-01-10';
  const prev: LeadSeries = new Map();
  for (let lead = 1; lead <= 7; lead++) {
    const s: DailySeries = new Map();
    for (let k = -20; k <= 20; k++) s.set(addDaysIso(origin, k), lead * 100 + k);
    prev.set(lead, s);
  }
  const v = forecastWindowValue(prev, origin, 1, 6, 'sum', 1)!;
  // Day k must come from lead k + 1: Σ_{k=1..6} ((k+1)·100 + k).
  assert.equal(v, [1, 2, 3, 4, 5, 6].reduce((a, k) => a + (k + 1) * 100 + k, 0));
  const rev = forecastRevision(prev, origin, 5, 7, 1)!;
  assert.equal(rev, [1, 2, 3, 4, 5].reduce((a, k) => a + ((k + 1) * 100 - 700), 0) / 5);
  // Poison every value initialised after origin − 1: features must not change.
  const poisoned: LeadSeries = new Map([...prev].map(([lead, s]) => [lead, new Map([...s].map(([d, x]) => [d, issueDate(d, lead) > addDaysIso(origin, -1) ? x + 1e6 : x]))]));
  assert.equal(forecastWindowValue(poisoned, origin, 1, 6, 'sum', 1), v);
  assert.equal(forecastRevision(poisoned, origin, 5, 7, 1), rev);
});

test('weekly sampling picks the last session of each Friday-ending week', () => {
  const bars = [
    { date: '2024-01-02', close: 1 },
    { date: '2024-01-04', close: 2 },
    { date: '2024-01-11', close: 3 },
    { date: '2024-01-12', close: 4 },
  ];
  assert.deepEqual(fridays('2024-01-01', '2024-01-20'), ['2024-01-05', '2024-01-12', '2024-01-19']);
  assert.equal(barForWeekEnding(bars, '2024-01-05')!.close, 2);
  assert.equal(barForWeekEnding(bars, '2024-01-12')!.close, 4);
  assert.equal(barForWeekEnding(bars, '2024-01-19'), null);
});

test('HAC OLS at lag 0 reproduces the White heteroskedasticity-robust slope standard error', () => {
  const rng = new SeededRNG(21);
  const x = Array.from({ length: 200 }, () => rng.nextNormal());
  const y = x.map((v) => 0.5 + 0.8 * v + (1 + Math.abs(v)) * rng.nextNormal());
  const r = olsHac(x.map((v) => [v]), y, 0);
  const xb = x.reduce((a, b) => a + b, 0) / x.length;
  const sxx = x.reduce((a, v) => a + (v - xb) ** 2, 0);
  const e = y.map((v, i) => v - r.coef[0] - r.coef[1] * x[i]);
  const white = Math.sqrt(x.reduce((a, v, i) => a + (v - xb) ** 2 * e[i] ** 2, 0) / sxx ** 2);
  close(r.se[1], white, 1e-9);
  close(r.coef[1], 0.8, 0.25);
  assert.ok(r.p[1] < 0.001);
});
