import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  GENESIS, bandBins, era5DailyTruth, ledgerEntry, matchMembers, membersMatchBand, outlookForecast, parseLedger, pinball,
  quantileScore, scoreCase, summariseScores, verifyLedger, type ScoredRow, type SnapshotCase,
} from './trackRecord';
import { PhiInv, crpsEnsemble, crpsNormal, crpsOf, rawGaussian } from './weatherPostprocessing';
import type { OutlookBand } from './calibratedOutlook';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const r2 = (x: number) => Math.round(x * 100) / 100;

function bandFrom(members: number[], extra: Partial<OutlookBand> = {}): OutlookBand {
  const m = members.reduce((a, b) => a + b, 0) / members.length;
  return { rawMean: r2(m), rawMin: r2(Math.min(...members)), rawMax: r2(Math.max(...members)), mean: r2(m), p10: r2(m - 1), p50: r2(m), p90: r2(m + 1), calibrated: true, members: members.length, ...extra };
}

test('matchMembers recovers the models behind a band from its raw count, mean, min and max', () => {
  const values = { A: 20.1, B: 21.4, C: 19.8, D: 25.0, E: null };
  const band = bandFrom([20.1, 21.4, 19.8]);
  assert.ok(membersMatchBand([20.1, 21.4, 19.8], band));
  assert.deepEqual(matchMembers(values, band, ['A', 'B', 'C']), { A: 20.1, B: 21.4, C: 19.8 });
  // the outlook's model list is a union across leads; the subset search finds the members actually used
  assert.deepEqual(matchMembers(values, band, ['A', 'B', 'C', 'D']), { A: 20.1, B: 21.4, C: 19.8 });
  assert.equal(matchMembers(values, bandFrom([30, 31])), null);
});

test('outlookForecast rebuilds the Gaussian of a calibrated temperature band and the raw ensemble of an uncalibrated band', () => {
  const mu = 24.3, sigma = 1.7, z = PhiInv(0.9);
  const band: OutlookBand = { rawMean: 24, rawMin: 23, rawMax: 25, mean: mu, p10: r2(mu - z * sigma), p50: mu, p90: r2(mu + z * sigma), calibrated: true, members: 3 };
  const fc = outlookForecast({ band, members: { A: 23, B: 24, C: 25 } }, 'tmax');
  assert.equal(fc?.kind, 'normal');
  close(crpsOf(fc!, 26), crpsNormal(mu, sigma, 26), 0.01);
  const raw = outlookForecast({ band: { ...band, calibrated: false }, members: { A: 23, B: 24, C: 25 } }, 'tmax');
  assert.deepEqual(raw, { kind: 'ensemble', members: [23, 24, 25] });
  // a calibrated rain band is a skill-weighted ensemble whose weights are not stored: no exact CRPS
  assert.equal(outlookForecast({ band, members: { A: 1, B: 2, C: 3 } }, 'precip'), null);
  // a skewed calibrated band is not treated as Gaussian
  assert.equal(outlookForecast({ band: { ...band, p90: band.p90 + 2 }, members: null }, 'tmean'), null);
});

test('quantile score is twice the mean pinball loss and matches hand calculation', () => {
  close(pinball(10, 12, 0.9), 0.9 * 2);
  close(pinball(10, 8, 0.9), 0.1 * 2);
  close(quantileScore([1, 2, 3], 2), (2 / 3) * (0.1 * 1 + 0 + 0.1 * 1));
  // for a Gaussian, the three-quantile score is a close (coarse) proxy of the CRPS
  const z = PhiInv(0.9);
  const qs = quantileScore([-z, 0, z], 0.3);
  assert.ok(Math.abs(qs - crpsNormal(0, 1, 0.3)) < 0.25);
});

test('band PIT bins: one bin for interior outcomes, spread over ties, always summing to one', () => {
  assert.deepEqual(bandBins([10, 12, 14], 9), [1, 0, 0, 0]);
  assert.deepEqual(bandBins([10, 12, 14], 11), [0, 1, 0, 0]);
  assert.deepEqual(bandBins([10, 12, 14], 13), [0, 0, 1, 0]);
  assert.deepEqual(bandBins([10, 12, 14], 15), [0, 0, 0, 1]);
  const dry = bandBins([0, 0, 2], 0); // dry day at a point mass: PIT uniform on [0, 0.9]
  close(dry[0], 0.1 / 0.9); close(dry[1], 0.4 / 0.9); close(dry[2], 0.4 / 0.9); close(dry[3], 0);
  for (const y of [0, 0.5, 2, 3]) close(bandBins([0, 0, 2], y).reduce((a, b) => a + b, 0), 1);
});

test('scoreCase scores the outlook and both references on the same raw members', () => {
  const members = { A: 30.5, B: 31.5, C: 33.0, D: 32.0 };
  const vals = Object.values(members);
  const c: SnapshotCase = { band: { ...bandFrom(vals), prob: 0.4 }, members };
  const s = scoreCase('tmax', c, 32.4);
  assert.equal(s.outcome, true);
  close(s.outlook.brier!, (0.4 - 1) ** 2);
  close(s.raw!.crps!, crpsEnsemble(vals, 32.4));
  close(s.gaussian!.crps!, crpsOf(rawGaussian(vals, 'temperature'), 32.4));
  close(s.raw!.prob!, 0.5); // two of four members ≥ 32 °C
  assert.equal(scoreCase('tmean', c, 31).outlook.brier, null);
  const noMembers = scoreCase('precip', { band: bandFrom([1, 2]), members: null }, 0);
  assert.equal(noMembers.gaussian, null);
  assert.equal(noMembers.outlook.crps, null);
});

test('summariseScores compares on identical cases and picks CRPS only when every outlook case has it', () => {
  const mk = (variable: 'tmax' | 'precip', y: number, crps: number | null): ScoredRow => {
    const c: SnapshotCase = { band: bandFrom([20, 22, 24]), members: { A: 20, B: 22, C: 24 } };
    const score = scoreCase(variable, c, y);
    if (crps === null) score.outlook.crps = null;
    return { issueDate: '2026-11-16', region: 'x', date: '2026-11-16', lead: 0, variable, version: 'astraeus-v2', y, score };
  };
  const cells = summariseScores([mk('tmax', 21, 1), mk('tmax', 23, 1), mk('precip', 22, null)]);
  const t = cells.find((c) => c.variable === 'tmax')!;
  assert.equal(t.n, 2);
  assert.equal(t.metric, 'crps');
  close(t.skillVsGaussian!, Math.round((1 - t.outlook.crps! / t.gaussian.crps!) * 1e4) / 1e4, 1e-4);
  const p = cells.find((c) => c.variable === 'precip')!;
  assert.equal(p.metric, 'qs');
  assert.equal(p.outlook.crps, null);
  close(p.outlook.bins.reduce((a, b) => a + b, 0), 1, 1e-3);
});

test('era5DailyTruth needs all 24 UTC hours, like the live outlook', () => {
  const time = [...Array(24)].map((_, h) => `2026-11-10T${String(h).padStart(2, '0')}:00`).concat([...Array(23)].map((_, h) => `2026-11-11T${String(h).padStart(2, '0')}:00`));
  const temperature_2m = time.map((_, i) => (i < 24 ? 10 + (i % 12) : 5));
  const precipitation = time.map((_, i) => (i === 3 ? 1.2 : 0.1));
  const truth = era5DailyTruth({ hourly: { time, temperature_2m, precipitation } });
  assert.deepEqual([...truth.keys()], ['2026-11-10']);
  const d = truth.get('2026-11-10')!;
  assert.equal(d.tmax, 21);
  close(d.precip, 1.2 + 23 * 0.1, 1e-9);
  close(d.tmean, 15.5, 1e-9);
});

test('ledger chain: chain = sha256(prev + sha256), verification catches edits, reordering and gaps', () => {
  const files: Record<string, string> = { 'snapshots/2026-11-16.json': '{"a":1}\n', 'snapshots/2026-11-17.json': '{"b":2}\n' };
  const fileSha = (f: string) => (f in files ? sha(files[f]) : null);
  const e1 = ledgerEntry(GENESIS, '2026-11-16', 'snapshots/2026-11-16.json', fileSha('snapshots/2026-11-16.json')!, sha);
  const e2 = ledgerEntry(e1.chain, '2026-11-17', 'snapshots/2026-11-17.json', fileSha('snapshots/2026-11-17.json')!, sha);
  assert.equal(e1.chain, sha(GENESIS + e1.sha256));
  const entries = parseLedger([e1, e2].map((e) => JSON.stringify(e)).join('\n') + '\n');
  const ok = verifyLedger(entries, fileSha, sha);
  assert.equal(ok.ok, true);
  assert.equal(ok.head, e2.chain);
  files['snapshots/2026-11-16.json'] = '{"a":2}\n';
  assert.equal(verifyLedger(entries, fileSha, sha).ok, false);
  files['snapshots/2026-11-16.json'] = '{"a":1}\n';
  assert.equal(verifyLedger([e2, e1], fileSha, sha).ok, false);
  delete files['snapshots/2026-11-17.json'];
  assert.match(verifyLedger(entries, fileSha, sha).problems.join(' '), /missing/);
});
