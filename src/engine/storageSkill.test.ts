import test from 'node:test';
import assert from 'node:assert/strict';
import { SeededRNG } from './prng';
import { addDaysIso, type DailySeries } from './priceSkill';
import {
  admissibleTraining,
  cddF,
  compareForecasts,
  cToF,
  dayOfYear,
  dieboldMarianoLoss,
  fitLinearMap,
  fiveYearAverageChange,
  fiveYearAverageLevel,
  hddF,
  impliedFlows,
  interpolatedDailyLevels,
  leadWindowSum,
  leastSquares,
  parseCpcDailyFile,
  parseEiaWeeklyHistoryHtml,
  priorYearsWindowMean,
  storageDesign,
  storageWeekDays,
  storageWeekSum,
  trailingMeanDifference,
  walkForwardStorage,
  type StorageSpec,
  type StorageWeekObs,
  type WeeklyLevel,
} from './storageSkill';

const close = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);

test('degree-day helpers use the NOAA 65 °F base', () => {
  close(cToF(0), 32, 1e-12);
  close(cToF(18.3333333), 65, 1e-6);
  assert.equal(hddF(40), 25);
  assert.equal(hddF(70), 0);
  assert.equal(cddF(80), 15);
  assert.equal(cddF(60), 0);
});

test('EIA dnav history table parses into a weekly series and rejects inconsistent rows', () => {
  const html = `<table><tr> <td class='B6'>&nbsp;&nbsp;2010-Jan</td> <td class='B5'>01/01&nbsp;</td> <td class='B3'>3,117&nbsp;&nbsp;&nbsp;</td> <td class='B5'>01/08&nbsp;</td> <td class='B3'>2,850&nbsp;&nbsp;&nbsp;</td> <td class='B5'>&nbsp;</td> <td class='B3'>&nbsp;&nbsp;&nbsp;</td> </tr>
  <tr> <td class='B6'>&nbsp;&nbsp;2010-Jan</td> <td class='B5'>01/15&nbsp;</td> <td class='B3'>2,607&nbsp;&nbsp;&nbsp;</td> </tr></table>`;
  const levels = parseEiaWeeklyHistoryHtml(html);
  assert.deepEqual(levels, [
    { weekEnd: '2010-01-01', level: 3117 },
    { weekEnd: '2010-01-08', level: 2850 },
    { weekEnd: '2010-01-15', level: 2607 },
  ]);
  assert.throws(() => parseEiaWeeklyHistoryHtml(`<tr><td class='B6'>2010-Feb</td><td class='B5'>01/01</td><td class='B3'>1</td></tr>`));
  assert.throws(() => parseEiaWeeklyHistoryHtml(`<tr><td class='B6'>2010-Jan</td><td class='B5'>01/01</td><td class='B3'>1</td><td class='B5'>01/15</td><td class='B3'>2</td></tr>`));
});

test('implied flow removes documented non-flow adjustments from the net change', () => {
  const levels: WeeklyLevel[] = [
    { weekEnd: '2021-06-04', level: 2300 },
    { weekEnd: '2021-06-11', level: 2316 },
    { weekEnd: '2021-06-18', level: 2371 },
  ];
  const flows = impliedFlows(levels, [{ weekEnd: '2021-06-11', bcf: -51, statedImpliedFlow: 67, note: 'Pacific reclassification' }]);
  assert.equal(flows.length, 2);
  assert.equal(flows[0].netChange, 16);
  assert.equal(flows[0].impliedFlow, 67);
  assert.equal(flows[1].impliedFlow, 55);
  assert.equal(flows[1].adjustment, 0);
});

test('daily interpolation and five-year averages follow the EIA method', () => {
  // Levels rise 7 Bcf per week (1 Bcf/day) from 2010; every year identical except an offset.
  const levels: WeeklyLevel[] = [];
  for (let i = 0; i < 52 * 7; i++) levels.push({ weekEnd: addDaysIso('2010-01-01', 7 * i), level: 1000 + 7 * i });
  const daily = interpolatedDailyLevels(levels);
  close(daily.get('2010-01-04')!, 1003, 1e-12);
  // Five-year average change for a week away from 29 February is 7 Bcf (linear stocks).
  close(fiveYearAverageChange(daily, '2016-06-03')!, 7, 1e-9);
  // Calendar-day matching: 26 Feb → 4 Mar spans 6 days in non-leap years (2011, 2013–2015), 7 in 2012.
  close(fiveYearAverageChange(daily, '2016-03-04')!, (6 + 6 + 7 + 6 + 6) / 5, 1e-9);
  // Level average: mean over the five preceding years of the interpolated level.
  const d = '2016-03-04';
  const expect = [1, 2, 3, 4, 5].map((k) => daily.get(`${2016 - k}-03-04`)!).reduce((a, b) => a + b, 0) / 5;
  close(fiveYearAverageLevel(daily, d)!, expect, 1e-9);
  // Not enough history → null.
  assert.equal(fiveYearAverageChange(daily, '2014-06-06'), null);
});

test('CPC daily weighted degree-day file parses regions and dates', () => {
  const txt = `Product: Daily Heating Degree Days\nRegions: CPC::Regions::CensusDivisions\nWeights: Utility Gas\nRegion|20240101|20240102|20240103\n1|30|35|34\nCONUS|28|29|-999\n`;
  const m = parseCpcDailyFile(txt);
  assert.equal(m.get('1')!.get('2024-01-02'), 35);
  assert.equal(m.get('CONUS')!.get('2024-01-01'), 28);
  assert.equal(m.get('CONUS')!.has('2024-01-03'), false);
});

test('storage week is Friday … Thursday before the Friday report date', () => {
  const days = storageWeekDays('2026-11-06');
  assert.equal(days[0], '2026-10-30');
  assert.equal(days[6], '2026-11-05');
  const s: DailySeries = new Map(days.map((d, i) => [d, i + 1]));
  assert.equal(storageWeekSum(s, '2026-11-06'), 28);
  s.delete('2026-11-02');
  assert.equal(storageWeekSum(s, '2026-11-06'), null);
  assert.equal(dayOfYear('2024-12-31'), 366);
  assert.equal(dayOfYear('2025-01-01'), 1);
});

test('design matrix has the declared blocks and annual periodicity', () => {
  const spec: StorageSpec = { harmonics: 3, window: 'expanding', rollingWeeks: 260, weather: 'interaction' };
  const x = storageDesign(spec, '2020-01-10', 200, 0);
  assert.equal(x.length, 1 + 6 + 2 + 2 + 2);
  const lin = storageDesign({ ...spec, weather: 'linear' }, '2020-01-10', 200, 3);
  assert.deepEqual(lin.slice(-2), [200, 3]);
  const none = storageDesign({ ...spec, weather: 'none' }, '2020-01-10', 200, 3);
  assert.equal(none.length, 7);
  // Same calendar position one year later differs only in trend (harmonics within 0.02 rad).
  const a = storageDesign({ ...spec, weather: 'none' }, '2021-01-08', 0, 0);
  const b = storageDesign({ ...spec, weather: 'none' }, '2022-01-07', 0, 0);
  for (let j = 1; j < 7; j++) close(a[j], b[j], 0.06);
});

function synthetic(n: number, seed: number, hddEffect: number): StorageWeekObs[] {
  const rng = new SeededRNG(seed);
  const out: StorageWeekObs[] = [];
  for (let i = 0; i < n; i++) {
    const weekEnd = addDaysIso('2010-01-08', 7 * i);
    const th = (2 * Math.PI * (dayOfYear(weekEnd) - 3.5)) / 365.25;
    const hddNormal = Math.max(0, 120 * Math.cos(th) + 60);
    const hdd = Math.max(0, hddNormal + 25 * rng.nextNormal());
    const cdd = Math.max(0, -60 * Math.cos(th) + 10 * rng.nextNormal());
    const y = 40 - 80 * Math.cos(th) - hddEffect * (hdd - hddNormal) - 0.5 * cdd + 8 * rng.nextNormal();
    out.push({ weekEnd, y, hdd, cdd });
  }
  return out;
}

test('walk-forward refits never use weeks published after the issue time', () => {
  const obs = synthetic(400, 7, 1.5);
  const spec: StorageSpec = { harmonics: 3, window: 'expanding', rollingWeeks: 260, weather: 'linear' };
  const targets = obs.slice(300).map((o) => o.weekEnd);
  const truth = new Map(obs.map((o) => [o.weekEnd, o]));
  const inputs = { oracle: (w: string) => truth.get(w) ?? null };
  const base = walkForwardStorage(obs, targets, spec, { gapDays: 14, minTrain: 200 }, inputs);
  // Poison every outcome that is not yet published for the first target; its forecast must not move.
  const t0 = targets[0];
  const poisoned = obs.map((o) => (o.weekEnd > addDaysIso(t0, -14) ? { ...o, y: o.y + 1e4 } : o));
  const again = walkForwardStorage(poisoned, [t0], spec, { gapDays: 14, minTrain: 200 }, inputs);
  close(again[0].preds.oracle!, base[0].preds.oracle!, 1e-9);
  assert.equal(base[0].nTrain, 299);
  const rolling = admissibleTraining(obs, t0, { ...spec, window: 'rolling', rollingWeeks: 100 }, 14);
  assert.equal(rolling.length, 100);
  assert.equal(rolling.at(-1)!.weekEnd, addDaysIso(t0, -14));
});

test('planted weather sensitivity is recovered and beats the seasonal model out of sample', () => {
  const obs = synthetic(520, 11, 1.5);
  const targets = obs.slice(300).map((o) => o.weekEnd);
  const truth = new Map(obs.map((o) => [o.weekEnd, o]));
  const wx = walkForwardStorage(obs, targets, { harmonics: 3, window: 'expanding', rollingWeeks: 260, weather: 'linear' }, { gapDays: 14, minTrain: 200 }, { oracle: (w) => truth.get(w) ?? null });
  const se = walkForwardStorage(obs, targets, { harmonics: 3, window: 'expanding', rollingWeeks: 260, weather: 'none' }, { gapDays: 14, minTrain: 200 });
  close(wx.at(-1)!.dYdHdd!, -1.5, 0.15);
  const y = wx.map((r) => truth.get(r.weekEnd)!.y);
  const c = compareForecasts(y, se.map((r) => r.preds.seasonal!), wx.map((r) => r.preds.oracle!), { resamples: 300, seed: 1 });
  assert.ok(c.skillMse > 0.5, `skill ${c.skillMse}`);
  assert.ok(c.dmSquared!.p < 0.001);
  assert.ok(c.dmAbsolute!.p < 0.001);
  assert.ok(c.skillMseCi95.lo > 0.3 && c.skillMseCi95.lo <= c.skillMse && c.skillMse <= c.skillMseCi95.hi);
});

test('forecast comparison metrics are exact on a hand example and DM is one-sided', () => {
  const y = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const ref = y.map((v, i) => v + (i % 2 ? 6 : -6));
  const model = y.map((v, i) => v + (i % 2 ? 3 : -3));
  const c = compareForecasts(y, ref, model, { resamples: 100, seed: 3 });
  close(c.rmseRef, 6, 1e-12);
  close(c.rmseModel, 3, 1e-12);
  close(c.maeModel, 3, 1e-12);
  close(c.skillMse, 0.75, 1e-12);
  close(c.skillMae, 0.5, 1e-12);
  close(c.biasModel, 0, 1e-12);
  // The worse model as challenger gets p near 1.
  const rev = compareForecasts(y, model, ref, { resamples: 100, seed: 3 });
  assert.ok(rev.skillMse < 0);
  const lossA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  assert.equal(dieboldMarianoLoss(lossA, lossA, 1)!.p, 0.5);
  assert.equal(dieboldMarianoLoss([1, 2], [1, 2], 1), null);
});

test('size of the DM test stays near nominal for equally good forecasts', () => {
  let rej = 0;
  const seeds = 60;
  for (let s = 0; s < seeds; s++) {
    const rng = new SeededRNG(500 + s);
    const y: number[] = [], a: number[] = [], b: number[] = [];
    for (let i = 0; i < 150; i++) {
      const v = rng.nextNormal();
      y.push(v);
      a.push(v + rng.nextNormal());
      b.push(v + rng.nextNormal());
    }
    if (compareForecasts(y, a, b, { resamples: 10, seed: 1 }).dmSquared!.p < 0.05) rej++;
  }
  assert.ok(rej / seeds <= 0.12, `rejection rate ${rej / seeds}`);
});

test('trailing bias, linear maps, least squares and lead windows', () => {
  const a: DailySeries = new Map();
  const b: DailySeries = new Map();
  for (let k = 0; k < 40; k++) {
    const d = addDaysIso('2024-01-01', k);
    a.set(d, k + 2);
    b.set(d, k);
  }
  close(trailingMeanDifference(a, b, '2024-02-01', 28, 21)!, 2, 1e-12);
  b.delete('2024-01-31');
  close(trailingMeanDifference(a, b, '2024-02-01', 28, 21)!, 2, 1e-12);
  assert.equal(trailingMeanDifference(a, b, '2024-01-10', 28, 21), null);

  const m = fitLinearMap([1, 2, 3, 4], [3, 5, 7, 9]);
  close(m.a, 1, 1e-12);
  close(m.b, 2, 1e-12);
  close(m.r2, 1, 1e-12);

  const X = [[1, 0], [0, 1], [1, 1], [2, 1]];
  const coef = leastSquares(X, X.map(([p, q]) => 0.3 * p + 0.7 * q));
  close(coef[0], 0.3, 1e-12);
  close(coef[1], 0.7, 1e-12);

  const lead = (L: number, d: string) => (d >= '2024-01-05' ? L * 10 : undefined);
  assert.equal(leadWindowSum(lead, '2024-01-05', 3, (i) => i + 1), 10 + 20 + 30);
  assert.equal(leadWindowSum(lead, '2024-01-04', 3, (i) => i + 1), null);

  const s: DailySeries = new Map();
  for (let y = 2010; y <= 2020; y++) for (let k = 0; k < 7; k++) s.set(addDaysIso(`${y}-03-01`, k), y - 2000);
  // Window mean over the 10 prior years 2010…2019 of (y − 2000) × 7 days.
  close(priorYearsWindowMean(s, '2020-03-01', 7, 10, 5)!, 7 * 14.5, 1e-12);
  assert.equal(priorYearsWindowMean(s, '2012-03-01', 7, 10, 5), null);
});
