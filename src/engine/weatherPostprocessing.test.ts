import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Phi, PhiInv, erfc, crpsNormal, crpsCensoredNormal0, crpsEnsemble, crpsNumeric, nelderMead,
  fitEmosNormal, predictEmosNormal, fitEmosCensored, predictEmosCensored, fitAstraeusV1, predictAstraeusV1,
  crpsOf, pitOf, histogram, reliabilityBins, brierDecomposition, dieboldMariano, studentTCdf,
  blockBootstrapMeanCI, seededRandom, quantileOf, exceedanceOf, pointOf, calibrate, type TrainingRow,
  crpsWeightedEnsemble, skillWeights, fitNgrSkill, predictNgrSkill, fitCensoredPower, predictCensoredPower,
  crpsCensoredPower, powerCdf, insideCentral, rawGaussian,
  cdfOf, crpsLogistic, logisticCdf, fitNgrV3, predictNgrV3, fitScaleFactor,
  ASTRAEUS_V3_TEMPERATURE, fitAstraeusV3, predictAstraeusV3, type NgrV3Options, ASTRAEUS_V31_TEMPERATURE, fitAstraeusV31,
} from './weatherPostprocessing';
import { buildCalibratedOutlook, OUTLOOK_METHOD_VERSION } from './calibratedOutlook';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);

function gaussian(rnd: () => number) {
  const u = Math.max(1e-12, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

test('special functions match reference values', () => {
  close(Phi(0), 0.5, 1e-9);
  close(Phi(1.959963984540054), 0.975, 2e-7);
  close(Phi(-3), 0.0013498980316301, 1e-7);
  close(erfc(0.5), 0.4795001221869535, 1e-7);
  close(PhiInv(0.975), 1.959963984540054, 1e-8);
  close(erfc(3.2), 6.025761151762095e-6, 1e-17);
  close(Phi(-6), 9.865876450376946e-10, 1e-20);
  close(PhiInv(0.001), -3.090232306167813, 1e-6);
  close(studentTCdf(2.228138851986274, 10), 0.975, 1e-6);
  close(studentTCdf(0, 5), 0.5, 1e-12);
});

test('closed-form Gaussian CRPS equals numerical integration', () => {
  for (const [mu, s, y] of [[0, 1, 0], [2, 0.5, 3.1], [-1, 3, 4], [10, 2, 9.5]]) {
    const num = crpsNumeric((x) => Phi((x - mu) / s), y, mu - 12 * s, mu + 12 * s);
    close(crpsNormal(mu, s, y), num, 1e-8, `N(${mu},${s}) y=${y}`);
  }
  // known value: CRPS(N(0,1), 0) = 2φ(0) − 1/√π = 0.2336949...
  close(crpsNormal(0, 1, 0), 0.23369497725510913, 1e-7);
});

test('closed-form zero-censored Gaussian CRPS equals numerical integration', () => {
  for (const [mu, s, y] of [[1, 2, 0], [1, 2, 3], [-2, 1.5, 0], [-2, 1.5, 0.7], [5, 3, 12], [0.2, 0.4, 0]]) {
    const cdf = (x: number) => (x < 0 ? 0 : Phi((x - mu) / s));
    const num = crpsNumeric(cdf, y, -1, Math.max(mu, y) + 14 * s, 60000, [0]);
    close(crpsCensoredNormal0(mu, s, y), num, 1e-8, `cN0(${mu},${s}) y=${y}`);
  }
});

test('ensemble CRPS equals the integral of its empirical CDF', () => {
  const m = [0.3, 1.2, 1.2, 2.5, -0.4, 4.1];
  for (const y of [-1, 0.5, 1.2, 3, 6]) {
    const cdf = (x: number) => m.filter((v) => v <= x).length / m.length;
    close(crpsEnsemble(m, y), crpsNumeric(cdf, y, -3, 9, 20000, m), 1e-9, `y=${y}`);
  }
  // a single member reduces to absolute error
  close(crpsEnsemble([2], 5), 3, 1e-12);
});

test('Nelder–Mead minimises the Rosenbrock function', () => {
  const r = nelderMead(([x, y]) => (1 - x) ** 2 + 100 * (y - x * x) ** 2, [-1.2, 1], { maxIter: 5000, tol: 1e-14 });
  close(r.x[0], 1, 1e-3);
  close(r.x[1], 1, 2e-3);
});

/** Synthetic multi-model temperature: models share a signal, have their own bias, and are under-dispersive. */
function syntheticTemperature(n: number, seed: number): TrainingRow[] {
  const rnd = seededRandom(seed);
  const biases = [2.0, 1.2, 1.8, 2.6, 1.0]; // shared warm bias, as is typical of raw 2 m temperature
  return Array.from({ length: n }, (_, t) => {
    const signal = 15 + 8 * Math.sin((2 * Math.PI * t) / 365) + 2 * gaussian(rnd);
    const y = signal + 1.8 * gaussian(rnd);
    const f = biases.map((b) => signal + b + 0.4 * gaussian(rnd));
    return { f, y };
  });
}

test('temperature EMOS removes bias, restores calibration and beats the raw ensemble out of sample', () => {
  const rows = syntheticTemperature(400, 7);
  const train = rows.slice(0, 200);
  const testRows = rows.slice(200);
  const model = fitEmosNormal(train)!;
  assert.ok(model);
  const rnd = seededRandom(1);
  let crpsEmos = 0;
  let crpsRaw = 0;
  const pits: number[] = [];
  for (const r of testRows) {
    const fc = predictEmosNormal(model, r.f);
    crpsEmos += crpsOf(fc, r.y);
    crpsRaw += crpsEnsemble(r.f, r.y);
    pits.push(pitOf(fc, r.y, rnd()));
  }
  crpsEmos /= testRows.length;
  crpsRaw /= testRows.length;
  assert.ok(crpsEmos < 0.8 * crpsRaw, `EMOS ${crpsEmos} should clearly beat raw ${crpsRaw}`);
  // true predictive sd is ~1.8; the fitted sigma should be in that neighbourhood
  const sigma = (predictEmosNormal(model, testRows[0].f) as { sigma: number }).sigma;
  assert.ok(sigma > 1.4 && sigma < 2.3, `sigma ${sigma}`);
  // PIT roughly uniform: no decile holds more than twice its share
  const h = histogram(pits, 5);
  assert.ok(Math.max(...h) < (2 * testRows.length) / 5, `PIT ${h}`);
});

test('learned member weights favour the informative model', () => {
  const rnd = seededRandom(3);
  const rows: TrainingRow[] = Array.from({ length: 160 }, () => {
    const y = 20 + 4 * gaussian(rnd);
    return { y, f: [y + 0.5 * gaussian(rnd), y + 3 * gaussian(rnd), y + 3 * gaussian(rnd)] };
  });
  const model = fitEmosNormal(rows, { learnWeights: true, weightPenalty: 0.05 })!;
  assert.ok(model.weights[0] > 0.5, `weights ${model.weights}`);
});

function syntheticPrecip(n: number, seed: number): TrainingRow[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, () => {
    const latent = 1.2 + 4 * gaussian(rnd);
    const y = Math.max(0, latent + 2 * gaussian(rnd));
    const f = [0.6, 1.3, 0.9, 1.6].map((s) => Math.max(0, s * latent + 0.5 * gaussian(rnd)));
    return { f, y };
  });
}

test('censored precipitation EMOS beats the raw ensemble and gives sensible probabilities', () => {
  const rows = syntheticPrecip(500, 11);
  const train = rows.slice(0, 250);
  const testRows = rows.slice(250);
  const model = fitEmosCensored(train)!;
  assert.ok(model);
  let a = 0;
  let b = 0;
  const probs: number[] = [];
  const obs: boolean[] = [];
  for (const r of testRows) {
    const fc = predictEmosCensored(model, r.f);
    a += crpsOf(fc, r.y);
    b += crpsEnsemble(r.f, r.y);
    probs.push(exceedanceOf(fc, 1));
    obs.push(r.y >= 1);
    assert.ok(quantileOf(fc, 0.1) >= 0 && pointOf(fc) >= 0);
  }
  assert.ok(a < b, `EMOS ${a / testRows.length} vs raw ${b / testRows.length}`);
  const dec = brierDecomposition(probs, obs);
  assert.ok(dec.reliability < 0.02, `reliability term ${dec.reliability}`);
});

test('censored EMOS declines to fit a bone-dry window instead of inventing a distribution', () => {
  const rows: TrainingRow[] = Array.from({ length: 40 }, () => ({ f: [0, 0.1, 0], y: 0 }));
  assert.equal(fitEmosCensored(rows), null);
});

test('Astraeus v1 baseline is reproduced and EMOS is at least as good on biased models', () => {
  const rows = syntheticTemperature(300, 21);
  const v1 = fitAstraeusV1(rows.slice(0, 150))!;
  const emos = fitEmosNormal(rows.slice(0, 150))!;
  let c1 = 0;
  let c2 = 0;
  for (const r of rows.slice(150)) {
    c1 += crpsOf(predictAstraeusV1(v1, r.f, 'temperature'), r.y);
    c2 += crpsOf(predictEmosNormal(emos, r.f), r.y);
  }
  assert.ok(c2 < c1, `EMOS ${c2} vs v1 ${c1}`);
});

test('Diebold–Mariano: identical losses are not significant; a consistent gap is', () => {
  const rnd = seededRandom(5);
  const noise = Array.from({ length: 200 }, () => gaussian(rnd));
  assert.ok(dieboldMariano(noise, 3).pValue > 0.05);
  const gap = Array.from({ length: 200 }, () => 0.4 + gaussian(rnd));
  assert.ok(dieboldMariano(gap, 3).pValue < 0.001);
});

test('block bootstrap CI covers the mean and reliability bins count every forecast', () => {
  const rnd = seededRandom(8);
  const x = Array.from({ length: 300 }, () => 1 + gaussian(rnd));
  const ci = blockBootstrapMeanCI(x, { block: 7, resamples: 800 });
  assert.ok(ci.lo < ci.mean && ci.mean < ci.hi && ci.lo < 1 && ci.hi > 1);
  const bins = reliabilityBins([0.05, 0.15, 0.95, 1], [false, false, true, true]);
  assert.equal(bins.reduce((a, b) => a + b.n, 0), 4);
  assert.equal(bins[9].n, 2);
});

test('calibrate() returns quantiles in order and probabilities in [0,1]', () => {
  const rows = syntheticTemperature(80, 2);
  const out = calibrate('temperature', rows.slice(0, 60), rows.slice(60).map((r, i) => ({ date: `d${i}`, f: r.f })), 25)!;
  assert.ok(out);
  for (const d of out.days) {
    assert.ok(d.calibrated.p10 < d.calibrated.p50 && d.calibrated.p50 < d.calibrated.p90);
    assert.ok(d.calibrated.probAbove! >= 0 && d.calibrated.probAbove! <= 1);
  }
});

test('weighted-ensemble CRPS equals the integral of its weighted step CDF', () => {
  const m = [0.5, 2, 3.5, 3.5, 7];
  const w = [0.1, 0.4, 0.2, 0.1, 0.2];
  for (const y of [-1, 1, 3.5, 5, 9]) {
    const cdf = (x: number) => m.reduce((a, v, i) => a + (v <= x ? w[i] : 0), 0);
    close(crpsWeightedEnsemble(m, w, y), crpsNumeric(cdf, y, -3, 12, 20000, m), 1e-9, `y=${y}`);
  }
});

test('skill weights favour the accurate model and skill-weighted NGR beats equal-weight NGR', () => {
  const rnd = seededRandom(19);
  const rows = Array.from({ length: 300 }, () => {
    const y = 18 + 5 * gaussian(rnd);
    return { y, f: [y + 0.6 * gaussian(rnd) + 0.5, y + 2.5 * gaussian(rnd) - 1, y + 2.5 * gaussian(rnd) + 1, y + 3 * gaussian(rnd)] };
  });
  const w = skillWeights(rows.slice(0, 150), 0.25);
  assert.ok(w[0] > 0.6, `weights ${w}`);
  const sk = fitNgrSkill(rows.slice(0, 150))!;
  const eq = fitEmosNormal(rows.slice(0, 150))!;
  let a = 0;
  let b = 0;
  for (const r of rows.slice(150)) { a += crpsOf(predictNgrSkill(sk, r.f), r.y); b += crpsOf(predictEmosNormal(eq, r.f), r.y); }
  assert.ok(a < b, `skill ${a} vs equal ${b}`);
});

test('power-censored CRPS matches the closed-form censored Gaussian when power = 1', () => {
  for (const [mu, s, y] of [[1, 2, 0], [1, 2, 3], [-1, 1.5, 0.4]]) {
    close(crpsCensoredPower({ kind: 'censored-power', mu, sigma: s, power: 1 }, y), crpsCensoredNormal0(mu, s, y), 2e-4);
  }
  const fc = { kind: 'censored-power' as const, mu: 1, sigma: 0.8, power: 0.5 };
  assert.ok(powerCdf(fc, 0) > 0 && powerCdf(fc, 0) < 0.2);
  close(quantileOf(fc, powerCdf(fc, 4)), 4, 1e-6);
});

test('square-root censored model beats the raw ensemble on skewed synthetic rain', () => {
  const rnd = seededRandom(23);
  const rows = Array.from({ length: 500 }, () => {
    const latent = 0.6 + 1.1 * gaussian(rnd);
    const y = latent > 0 ? (latent + 0.5 * gaussian(rnd)) ** 2 * 3 : 0;
    const f = [1.3, 0.7, 1, 1.6].map((sc) => (latent > -0.2 ? Math.max(0, sc * 3 * (latent + 0.3 * gaussian(rnd)) ** 2) : 0));
    return { f, y: Math.max(0, y) };
  });
  const model = fitCensoredPower(rows.slice(0, 250), { weighted: true })!;
  assert.ok(model);
  let a = 0;
  let b = 0;
  for (const r of rows.slice(250)) { a += crpsOf(predictCensoredPower(model, r.f), r.y); b += crpsEnsemble(r.f, r.y); }
  assert.ok(a < b, `power ${a / 250} vs raw ${b / 250}`);
  const fc = predictCensoredPower(model, [4, 6, 5, 8]);
  assert.ok(exceedanceOf(fc, 1) > 0.5 && pointOf(fc) > 0);
});

test('PIT-based coverage is ~80% for calibrated forecasts of every representation', () => {
  const rnd = seededRandom(31);
  const n = 20000;
  const counts = { normal: 0, ensemble: 0, weighted: 0 };
  for (let i = 0; i < n; i++) {
    const y = gaussian(rnd);
    const members = Array.from({ length: 5 }, () => gaussian(rnd)); // exchangeable with y
    if (insideCentral(pitOf({ kind: 'normal', mu: 0, sigma: 1 }, y, rnd()))) counts.normal++;
    if (insideCentral(pitOf({ kind: 'ensemble', members }, y, rnd()))) counts.ensemble++;
    if (insideCentral(pitOf({ kind: 'weighted-ensemble', members, weights: members.map(() => 0.2) }, y, rnd()))) counts.weighted++;
  }
  for (const [k, c] of Object.entries(counts)) close(c / n, 0.8, 0.012, k);
});

test('raw Gaussian baseline uses the member mean and sample standard deviation', () => {
  const fc = rawGaussian([1, 2, 3], 'temperature') as { mu: number; sigma: number };
  close(fc.mu, 2, 1e-12);
  close(fc.sigma, 1, 1e-12);
  assert.equal(rawGaussian([0, 0, 1], 'precipitation').kind, 'censored-normal');
});

// ---------------------------------------------------------------------------
// Astraeus v3 machinery (docs/results/WEATHER_V3.md)
// ---------------------------------------------------------------------------

/** n rows, newest first: five biased, noisy models of a 15 °C ± 4 truth; `drift(age)` adds a time-varying bias. */
function syntheticWindow(seed: number, drift: (age: number) => number = () => 0, n = 90): TrainingRow[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: n }, (_, age) => {
    const y = 15 + 4 * gaussian(rnd);
    const f = [0.5, -0.8, 1.2, 0, 0.3].map((b, i) => y + b + drift(age) + [0.7, 1, 1.3, 1.6, 2][i] * gaussian(rnd));
    return { f, y };
  });
}

test('logistic CRPS equals numerical integration; quantiles invert the CDF; calibrated PIT covers 80%', () => {
  for (const [mu, s, y] of [[0, 1, 0], [2, 0.5, 3.1], [-1, 3, 4], [10, 2, -2]]) {
    const num = crpsNumeric((x) => logisticCdf((x - mu) / s), y, mu - 60 * s, mu + 60 * s, 40000);
    close(crpsLogistic(mu, s, y), num, 1e-7, `L(${mu},${s}) y=${y}`);
  }
  close(crpsLogistic(0, 1, 0), 2 * Math.log(2) - 1, 1e-12);
  close(crpsLogistic(0, 1, 800), 799, 1e-9); // no overflow in the far tail
  const fc = { kind: 'logistic' as const, mu: 3, scale: 0.7 };
  for (const p of [0.01, 0.1, 0.5, 0.9, 0.99]) close(cdfOf(fc, quantileOf(fc, p)), p, 1e-12);
  close(pointOf(fc), 3, 0);
  close(exceedanceOf(fc, 3), 0.5, 1e-12);
  const rnd = seededRandom(37);
  let inside = 0;
  for (let i = 0; i < 20000; i++) {
    const u = Math.min(1 - 1e-12, Math.max(1e-12, rnd()));
    inside += insideCentral(pitOf(fc, 3 + 0.7 * Math.log(u / (1 - u)), rnd())) ? 1 : 0;
  }
  close(inside / 20000, 0.8, 0.012);
});

test('fitNgrV3 with default options reproduces Astraeus v2 (fitNgrSkill) exactly, in either row order', () => {
  const rows = syntheticWindow(41, (age) => 0.01 * age);
  const v2 = fitNgrSkill(rows)!;
  const v3 = fitNgrV3(rows)!;
  const oldestFirst = fitNgrV3(rows.map((r, age) => ({ ...r, age })).reverse())!;
  for (const f of [[14, 15, 16, 15.5, 13], [30, 29, 31, 28, 33], [0, -1, 1, 0.5, 2]]) {
    const a = predictNgrSkill(v2, f) as { mu: number; sigma: number };
    for (const b of [predictNgrV3(v3, f), predictNgrV3(oldestFirst, f)] as Array<{ kind: string; mu: number; sigma: number }>) {
      assert.equal(b.kind, 'normal');
      assert.equal(b.mu, a.mu);
      assert.equal(b.sigma, a.sigma);
    }
  }
  assert.equal(v3.kappa, 1);
});

test('scale factor search recovers a known dispersion error', () => {
  const rnd = seededRandom(43);
  const held = Array.from({ length: 20000 }, () => ({ mu: 0, scale: 1, y: 1.3 * gaussian(rnd), omega: 1 }));
  close(fitScaleFactor(held, 'normal'), 1.3, 0.03);
  close(fitScaleFactor([], 'normal'), 1, 0);
});

test('v3 options behave as specified on synthetic windows', () => {
  // stationary, well-specified: out-of-sample recalibration stays near 1
  const flat = syntheticWindow(47);
  for (const recalibrate of ['cv', 'trailing'] as const) {
    const k = fitNgrV3(flat, { recalibrate })!.kappa;
    assert.ok(k > 0.8 && k < 1.25, `${recalibrate} kappa ${k}`);
  }
  // model bias drifting toward the present: forecasts made across a gap are worse than the in-sample fit admits
  const drifting = syntheticWindow(53, (age) => 0.05 * (90 - age));
  const trail = fitNgrV3(drifting, { recalibrate: 'trailing' })!;
  assert.ok(trail.kappa > 1.05, `trailing kappa ${trail.kappa}`);
  // recency weights move the bias estimate toward the recent regime (a +2 °C step in the last 20 days)
  const step = syntheticWindow(59, (age) => (age < 20 ? 2 : 0));
  const eq = fitNgrV3(step)!;
  const rec = fitNgrV3(step, { halfLifeDays: 35 })!;
  const meanBias = (m: { bias: number[] }) => m.bias.reduce((a, b) => a + b, 0) / m.bias.length;
  assert.ok(meanBias(rec) > meanBias(eq) + 0.2, `recency ${meanBias(rec)} vs equal ${meanBias(eq)}`);
  // cross-fitted predictors carry estimation error, so the fitted spread is not narrower than the in-sample one
  const short = syntheticWindow(61, () => 0, 40);
  const probe = [15, 16, 14, 15.5, 15];
  const sIn = (predictNgrV3(fitNgrV3(short)!, probe) as { sigma: number }).sigma;
  const sCross = (predictNgrV3(fitNgrV3(short, { crossFit: true })!, probe) as { sigma: number }).sigma;
  assert.ok(sCross >= sIn * 0.98, `cross-fit sigma ${sCross} vs in-sample ${sIn}`);
  // the logistic family returns a logistic law with a positive scale
  const lg = predictNgrV3(fitNgrV3(flat, { family: 'logistic' })!, probe);
  assert.ok(lg.kind === 'logistic' && lg.scale > 0);
});

test('v3.1 location models: unit slope holds b = 1; climatology anchoring equals NGR on anomalies', () => {
  const rnd = seededRandom(73);
  const rows = Array.from({ length: 90 }, (_, age) => {
    const clim = 10 + 0.15 * age + Math.sin(age / 9);
    const y = clim + 3 * gaussian(rnd);
    return { f: [0.5, -0.8, 1.2, 0, 0.3].map((b, i) => y + b + [2, 2.5, 3, 3.5, 4][i] * gaussian(rnd)), y, clim, age };
  });
  for (const base of [{}, { ...ASTRAEUS_V3_TEMPERATURE }] as NgrV3Options[]) {
    const unit = fitNgrV3(rows, { ...base, location: 'unit-slope' })!;
    assert.equal(unit.params.b, 1);
    const anch = fitNgrV3(rows, { ...base, location: 'climatology-anchored' })!;
    const anom = fitNgrV3(rows.map((r) => ({ ...r, f: r.f.map((v) => v - r.clim), y: r.y - r.clim, clim: undefined })), base)!;
    close(anch.kappa, anom.kappa, 1e-4, 'kappa');
    for (const [f, c] of [[[9, 11, 8, 10, 12], 9.5], [[20, 22, 19, 21, 18], 21]] as Array<[number[], number]>) {
      const a = predictNgrV3(anch, f, c) as { mu: number };
      const b = predictNgrV3(anom, f.map((v) => v - c)) as { mu: number };
      close(a.mu, b.mu + c, 1e-4, 'anchored location = anomaly fit + climatology');
      close(quantileOf(predictNgrV3(anch, f, c), 0.9) - a.mu, quantileOf(predictNgrV3(anom, f.map((v) => v - c)), 0.9) - b.mu, 1e-4, 'same spread');
    }
    // 'free' is the default and leaves v3 untouched
    assert.deepEqual(predictNgrV3(fitNgrV3(rows, { ...base, location: 'free' })!, [9, 11, 8, 10, 12]), predictNgrV3(fitNgrV3(rows, base)!, [9, 11, 8, 10, 12]));
  }
  // anchoring needs a climatology on every row and at prediction time
  assert.equal(fitNgrV3(rows.map((r, j) => (j === 3 ? { ...r, clim: undefined } : r)), { location: 'climatology-anchored' }), null);
  assert.throws(() => predictNgrV3(fitNgrV3(rows, { location: 'climatology-anchored' })!, [9, 11, 8, 10, 12]));
});

test('in a falling season the free location runs warm; climatology anchoring does not', () => {
  const rnd = seededRandom(79);
  const climAt = (age: number) => 10 + 0.15 * age; // autumn: the window's older days are warmer
  const member = (y: number) => [0.5, -0.8, 1.2, 0, 0.3].map((b, i) => y + b + [2, 2.5, 3, 3.5, 4][i] * gaussian(rnd));
  const rows = Array.from({ length: 90 }, (_, age) => { const y = climAt(age) + 3 * gaussian(rnd); return { f: member(y), y, clim: climAt(age), age }; });
  const free = fitNgrV3(rows, ASTRAEUS_V3_TEMPERATURE)!;
  const anch = fitNgrV3(rows, { ...ASTRAEUS_V3_TEMPERATURE, location: 'climatology-anchored' })!;
  const target = climAt(-10); // forecast ten days after the newest verified day
  let eFree = 0;
  let eAnch = 0;
  const n = 4000;
  for (let k = 0; k < n; k++) {
    const y = target + 3 * gaussian(rnd);
    const f = member(y);
    eFree += (pointOf(predictNgrV3(free, f)) - y) / n;
    eAnch += (pointOf(predictNgrV3(anch, f, target)) - y) / n;
  }
  assert.ok(free.params.b < 0.97, `free slope ${free.params.b}`);
  assert.ok(eFree > 0.25, `free location bias ${eFree}`);
  assert.ok(Math.abs(eAnch) < 0.12, `anchored bias ${eAnch}`);
});

test('Astraeus v3 is the frozen C6 configuration for temperature and v2 for precipitation', () => {
  assert.deepEqual({ ...ASTRAEUS_V3_TEMPERATURE }, { family: 'logistic', halfLifeDays: 35, recalibrate: 'cv', shrink: 0.25 });
  assert.ok(Object.isFrozen(ASTRAEUS_V3_TEMPERATURE));
  const rows = syntheticWindow(67, (age) => 0.02 * (90 - age));
  const v3 = fitAstraeusV3(rows, 'temperature')!;
  const c6 = fitNgrV3(rows, { family: 'logistic', halfLifeDays: 35, recalibrate: 'cv' })!;
  const f = [15, 16, 14, 15.5, 17];
  const a = predictAstraeusV3(v3, f);
  assert.deepEqual(a, predictNgrV3(c6, f));
  assert.ok(a.kind === 'logistic');
  assert.ok(v3.kind === 'temperature' && v3.ngr.kappa >= 0.5 && v3.ngr.kappa <= 2.5);
  const q = [0.1, 0.5, 0.9].map((p) => quantileOf(a, p));
  assert.ok(q[0] < q[1] && q[1] < q[2], `quantiles ${q}`);
  // precipitation: v2's skill-weighted raw ensemble, unchanged
  const rain = rows.map((r) => ({ f: r.f.map((v) => Math.max(0, v - 14)), y: Math.max(0, r.y - 14) }));
  const pr = fitAstraeusV3(rain, 'precipitation')!;
  assert.deepEqual(predictAstraeusV3(pr, [0, 1, 2, 0.5, 3]), { kind: 'weighted-ensemble', members: [0, 1, 2, 0.5, 3], weights: skillWeights(rain, 0.25) });
  assert.equal(fitAstraeusV3(rows.slice(0, 9), 'temperature'), null);
});

test('Astraeus v3.1 is v3 with a unit slope (candidate D1) and leaves rain unchanged', () => {
  assert.deepEqual({ ...ASTRAEUS_V31_TEMPERATURE }, { family: 'logistic', halfLifeDays: 35, recalibrate: 'cv', shrink: 0.25, location: 'unit-slope' });
  assert.ok(Object.isFrozen(ASTRAEUS_V31_TEMPERATURE));
  const rows = syntheticWindow(83, (age) => 0.02 * (90 - age));
  const m = fitAstraeusV31(rows, 'temperature')!;
  assert.ok(m.kind === 'temperature' && m.ngr.params.b === 1);
  assert.deepEqual(predictAstraeusV3(m, [15, 16, 14, 15.5, 17]), predictNgrV3(fitNgrV3(rows, { ...ASTRAEUS_V3_TEMPERATURE, location: 'unit-slope' })!, [15, 16, 14, 15.5, 17]));
  const rain = rows.map((r) => ({ f: r.f.map((v) => Math.max(0, v - 14)), y: Math.max(0, r.y - 14) }));
  assert.deepEqual(fitAstraeusV31(rain, 'precipitation'), fitAstraeusV3(rain, 'precipitation'));
});

test('live outlook uses the method chosen by the adoption rule, reports it in `version`, and v2 stays selectable', () => {
  const rnd = seededRandom(71);
  const day = (k: number) => new Date(Date.UTC(2026, 7, 1) + k * 86_400_000).toISOString().slice(0, 10);
  const verifyDates = Array.from({ length: 90 }, (_, k) => day(k));
  const nextDates = Array.from({ length: 7 }, (_, k) => day(97 + k));
  const models = [{ apiId: 'm1', name: 'M1' }, { apiId: 'm2', name: 'M2' }, { apiId: 'm3', name: 'M3' }];
  const bias = [0.8, -0.5, 0.2];
  const truth = verifyDates.map((_, k) => ({ tm: 15 + 6 * Math.sin(k / 15) + 2 * gaussian(rnd), rain: Math.max(0, 3 * gaussian(rnd)) }));
  const eraLoc = { daily: { time: verifyDates, temperature_2m_mean: truth.map((t) => t.tm), temperature_2m_max: truth.map((t) => t.tm + 5), precipitation_sum: truth.map((t) => t.rain) } };
  const hourly: Record<string, unknown> = { time: verifyDates.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`)) };
  for (const lead of [1, 2, 3, 4, 5, 6]) models.forEach((m, i) => {
    const daily = truth.map((t) => ({ tm: t.tm + bias[i] + (0.6 + 0.2 * i) * gaussian(rnd), rain: Math.max(0, t.rain + gaussian(rnd)) }));
    // hourly profile with mean = daily mean and maximum = daily mean + 5
    hourly[`temperature_2m_previous_day${lead}_${m.apiId}`] = daily.flatMap((x) => Array.from({ length: 24 }, (_, h) => x.tm + (h === 12 ? 5 : -5 / 23)));
    hourly[`precipitation_previous_day${lead}_${m.apiId}`] = daily.flatMap((x) => Array.from({ length: 24 }, () => x.rain / 24));
  });
  const fcDaily: Record<string, unknown> = { time: nextDates };
  models.forEach((m, i) => {
    fcDaily[`temperature_2m_mean_${m.apiId}`] = nextDates.map(() => 16 + bias[i]);
    fcDaily[`temperature_2m_max_${m.apiId}`] = nextDates.map(() => 21 + bias[i]);
    fcDaily[`precipitation_sum_${m.apiId}`] = nextDates.map(() => 2 + i);
  });
  const input = { models, usable: [true, true, true], fcLocs: [{ daily: fcDaily }], prevLocs: [{ hourly }], eraLocs: [eraLoc], nextDates, verifyDates };
  assert.equal(OUTLOOK_METHOD_VERSION, 'astraeus-v3');
  const v3 = buildCalibratedOutlook(input)!;
  const v2 = buildCalibratedOutlook({ ...input, method: 'astraeus-v2' })!;
  assert.equal(v3.version, 'astraeus-v3');
  assert.equal(v2.version, 'astraeus-v2');
  assert.ok(v3.method.startsWith('Astraeus v3') && v2.method.startsWith('Astraeus v2'));
  for (const o of [v3, v2]) for (const d of o.days) for (const b of [d.tmean, d.tmax, d.precip]) {
    assert.ok(b && b.calibrated, `${o.version} ${d.date} calibrated`);
    assert.ok(b!.p10 <= b!.p50 && b!.p50 <= b!.p90, `${o.version} ${d.date} quantiles ${b!.p10} ${b!.p50} ${b!.p90}`);
  }
  // rain is the same skill-weighted ensemble in both versions; temperature differs
  assert.deepEqual(v3.days.map((d) => d.precip), v2.days.map((d) => d.precip));
  assert.notDeepEqual(v3.days.map((d) => d.tmean), v2.days.map((d) => d.tmean));
});
