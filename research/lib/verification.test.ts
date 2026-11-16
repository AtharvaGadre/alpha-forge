/**
 * Offline tests for the station / area helpers:  npx tsx --test research/lib/verification.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverage, parseGhcnCsv, parseMeteostatDaily, pearson, shiftSeries } from './stations';
import { weightedMean, weightedMeanNested } from './areas';

test('GHCN parser converts tenths, drops quality-flagged values and records the observation time', () => {
  const csv = [
    'USW00094989,20250701,TMAX,317,,,W,2400',
    'USW00094989,20250701,PRCP,25,,,W,2400',
    'USW00094989,20250702,TMAX,999,,X,W,2400', // failed QC
    'USW00094989,20250702,PRCP,0,T,,W,2400', // trace → 0
    'USW00094989,20250703,SNOW,0,,,W,2400',
  ].join('\n');
  const p = parseGhcnCsv(csv);
  assert.equal(p.tmax['2025-07-01'], 31.7);
  assert.equal(p.prcp['2025-07-01'], 2.5);
  assert.equal(p.tmax['2025-07-02'], undefined);
  assert.equal(p.prcp['2025-07-02'], 0);
  assert.equal(p.obsTime.tmax, '2400');
});

test('Meteostat parser keeps observation-sourced values only', () => {
  const csv = [
    'year,month,day,temp,temp_source,tmin,tmin_source,tmax,tmax_source,prcp,prcp_source',
    '2026,1,1,20,metar,15,metar,25.5,metar,1.0,dwd_mosmix',
    '2026,1,2,20,metar,15,metar,26.0,metar isd_lite,,',
    '2026,1,3,20,x,15,dwd_mosmix,27.0,metno_forecast metar,0.0,ghcnd',
  ].join('\n');
  const p = parseMeteostatDaily(csv);
  assert.equal(p.tmax['2026-01-01'], 25.5);
  assert.equal(p.tmax['2026-01-02'], 26);
  assert.equal(p.tmax['2026-01-03'], undefined, 'mixed model + observation source is rejected');
  assert.equal(p.prcp['2026-01-01'], undefined, 'model-filled precipitation is rejected');
  assert.equal(p.prcp['2026-01-03'], 0);
  assert.equal(p.rejected.tmax, 1);
  assert.equal(p.rejected.prcp, 1);
});

test('shiftSeries re-dates values and coverage counts present days', () => {
  const s = { '2025-07-02': 3, '2025-07-03': 4 };
  const t = shiftSeries(s, -1);
  assert.deepEqual(t, { '2025-07-01': 3, '2025-07-02': 4 });
  assert.equal(coverage(t, '2025-07-01', '2025-07-04'), 0.5);
  const xs = Array.from({ length: 40 }, (_, i) => i);
  assert.ok(Math.abs((pearson(xs, xs.map((x) => 2 * x + 1)) ?? 0) - 1) < 1e-12);
});

test('area means use the weights and drop days missing at any point', () => {
  const m = weightedMean([{ a: 1, b: 2 }, { a: 3 }], [0.25, 0.75]);
  assert.deepEqual(m, { a: 2.5 });
  const nested = weightedMeanNested([{ tmax: { 1: { gfs: { d: 10 } } } }, { tmax: { 1: { gfs: { d: 20 } } } }], [0.5, 0.5], 3);
  assert.equal(nested.tmax[1].gfs.d, 15);
});
