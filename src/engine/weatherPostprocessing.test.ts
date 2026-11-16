import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Phi, PhiInv, erfc, crpsNormal, crpsCensoredNormal0, crpsEnsemble, crpsNumeric, nelderMead,
  fitEmosNormal, predictEmosNormal, fitEmosCensored, predictEmosCensored, fitAstraeusV1, predictAstraeusV1,
  crpsOf, pitOf, histogram, reliabilityBins, brierDecomposition, dieboldMariano, studentTCdf,
  blockBootstrapMeanCI, seededRandom, quantileOf, exceedanceOf, pointOf, calibrate, type TrainingRow,
  crpsWeightedEnsemble, skillWeights, fitNgrSkill, predictNgrSkill, fitCensoredPower, predictCensoredPower,
  crpsCensoredPower, powerCdf,
} from './weatherPostprocessing';

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
