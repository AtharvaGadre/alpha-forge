import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMODITIES, SECTORS, buildCommodityForecast, commodityTarget } from './commodityForecastEngine.ts';
import type { ClimateSignal, LiveAtmosphereInvestigation } from './liveAtmospherePipeline.ts';

const commodity = (id: string) => COMMODITIES.find(c => c.id === id)!;
const signal = (id: ClimateSignal['id'], zScore: number, value = 10, normal = 5): ClimateSignal => ({ id, zScore, value, normal, anomaly: value - normal, anomalyPct: null, label: id, unit: 'test', percentileVsLast10Years: 50, materiality: 'MATERIAL' });
function live(signals: ClimateSignal[] = [], date = '2026-07-15T12:00:00Z'): LiveAtmosphereInvestigation {
  return { generatedAtUtc: date, signals, modelForecasts: [], climatology: { years: 10 }, verification: null, reproducibility: { inputsSha256: '0123456789abcdef' }, consequences: [], dataLog: [], windows: { forecastLabel: 'Next 7 days' }, target: commodityTarget(commodity('corn'), commodity('corn').regions[0]) } as unknown as LiveAtmosphereInvestigation;
}
function run(id: string, signals: ClimateSignal[], date?: string) {
  const c = commodity(id); return buildCommodityForecast(c, c.regions[0], live(signals, date));
}
test('Catalogue covers all six sectors with unique instruments, valid regional coordinates and no contract fields', () => {
  assert.equal(COMMODITIES.length, 28); assert.equal(SECTORS.length, 6);
  assert.equal(new Set(COMMODITIES.map(c => c.id)).size, 28);
  for (const c of COMMODITIES) {
    assert.ok(c.fundamentals.length >= 3);
    assert.ok(c.regions.length > 0);
    assert.equal(new Set(c.regions.map(r => r.id)).size, c.regions.length);
    for (const r of c.regions) { assert.ok(Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180); assert.equal(commodityTarget(c, r).exposures[0].symbol, c.symbol); }
  }
  assert.doesNotMatch(JSON.stringify(COMMODITIES), /impliedProbability|contractVolume|predictionContract/);
});
test('Drought and extreme rainfall flag crop pressure, ordinary rainfall does not invent bearish signals', () => {
  assert.equal(run('corn', [signal('PRECIP_NEXT7', -2)]).status, 'UPWARD_PRESSURE');
  assert.equal(run('corn', [signal('PRECIP_NEXT7', 2.5)]).status, 'UPWARD_PRESSURE');
  assert.equal(run('corn', [signal('PRECIP_NEXT7', 0.2)]).status, 'NO_MATERIAL_SIGNAL');
});
test('Season gate withholds directional crop signals outside the regional window', () => {
  const r = run('corn', [signal('PRECIP_NEXT7', -3)], '2026-12-01T00:00:00Z');
  assert.equal(r.seasonActive, false); assert.equal(r.status, 'NO_MATERIAL_SIGNAL');
});
test('Energy uses the dominant load and wind; opposing channels remain mixed', () => {
  assert.equal(run('natural-gas', [signal('HDD_NEXT7', 2, 30, 20), signal('CDD_NEXT7', -3, 0, 0)]).status, 'UPWARD_PRESSURE');
  assert.equal(run('natural-gas', [signal('CDD_NEXT7', 2, 40, 30), signal('HDD_NEXT7', 0, 0, 0), signal('WIND_NEXT7', 2)]).status, 'MIXED');
  assert.equal(run('natural-gas', [signal('HDD_NEXT7', -2, 10, 20)]).status, 'DOWNWARD_PRESSURE');
});
test('Missing, non-finite and unsupported drivers never produce a directional claim', () => {
  assert.equal(run('corn', []).status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(run('corn', [signal('PRECIP_NEXT7', NaN)]).status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(run('gold', [signal('PRECIP_NEXT7', -5)]).status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(run('aluminium', [signal('PRECIP_NEXT7', -5)]).status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(run('copper', [signal('PRECIP_NEXT7', -5)]).status, 'NO_MATERIAL_SIGNAL');
  assert.equal(run('copper', [signal('PRECIP_NEXT7', 3)]).status, 'UPWARD_PRESSURE');
});
test('Weekly temperatures do not claim to detect overnight frost', () => {
  const c = run('coffee', [signal('TEMP_NEXT7', -2, 7, 14)]);
  assert.equal(c.status, 'NO_MATERIAL_SIGNAL');
  assert.match(c.drivers.find(d => d.signalId === 'TEMP_NEXT7')!.caveat, /cannot detect overnight frost/);
});
test('Output preserves provenance, missing quotes, and separate price-validation status', () => {
  const r = run('coffee', [signal('PRECIP_NEXT7', -2)]);
  assert.equal(r.evidence.priceModelValidated, false); assert.equal(r.market, null);
  assert.equal(r.evidence.inputHash, '0123456789abcdef');
  assert.match(r.evidence.experimentId, /^CF-coffee-minas-/);
  assert.ok(r.limitations.some(s => s.includes('production-weighted')));
  assert.doesNotMatch(JSON.stringify(r), /impliedProbability|targetPrice|sharpeRatio/);
});
