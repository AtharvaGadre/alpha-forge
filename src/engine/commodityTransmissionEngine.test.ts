import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMODITIES, type CommodityForecast } from './commodityForecastEngine';
import { TRANSMISSION_NODES, TRANSMISSION_LINKS, traceTransmission, linksForCommodity, directionFromForecast, compareForecasts, appendForecastSnapshot } from './commodityTransmissionEngine';

function snapshot(overrides: Partial<CommodityForecast> = {}): CommodityForecast {
  return { commodityId: 'corn', regionId: 'iowa', sourceGeneratedAtUtc: '2026-07-01T00:00:00Z', status: 'UPWARD_PRESSURE', evidence: { inputHash: 'first', engineVersion: 'v2' }, drivers: [{ label: 'Rain', signalId: 'PRECIP_NEXT7', zScore: -2 }], ...overrides } as CommodityForecast;
}
test('Every commodity is connected, with explicit measurement, conditions and mechanism evidence', () => {
  const ids = new Set(TRANSMISSION_NODES.map(n => n.id));
  assert.equal(ids.size, TRANSMISSION_NODES.length);
  assert.equal(new Set(TRANSMISSION_LINKS.map(l => l.id)).size, TRANSMISSION_LINKS.length);
  for (const c of COMMODITIES) { const links = linksForCommodity(c.id); assert.ok(links.incoming.length + links.outgoing.length > 0, c.name); }
  for (const l of TRANSMISSION_LINKS) {
    assert.ok(ids.has(l.from) && ids.has(l.to)); assert.notEqual(l.from, l.to);
    assert.ok(l.condition.length > 10 && l.lag.length > 5);
    assert.equal(l.evidence, 'MECHANISM_ONLY'); assert.match(l.source.url, /^https:\/\//);
  }
});
test('Gas transmits through nitrogen into crop costs, without creating crop price predictions', () => {
  const paths = traceTransmission('natural-gas', 'UP', 3);
  const corn = paths.find(p => p.nodes.join('/') === 'natural-gas/nitrogen/corn');
  assert.ok(corn); assert.equal(corn.measure, 'INPUT_COST'); assert.equal(corn.direction, 'UP');
  assert.ok(!paths.some(p => p.nodes.join('/').includes('nitrogen/corn/cattle')));
  assert.ok(!paths.some(p => p.target === 'corn' && p.measure === 'PRICE'));
});
test('Feed costs do not become livestock selling-price forecasts; input directions invert safely', () => {
  const up = traceTransmission('corn', 'UP');
  assert.equal(up.find(p => p.target === 'cattle')!.measure, 'INPUT_COST');
  assert.equal(up.find(p => p.target === 'ethanol')!.direction, 'DOWN');
  assert.equal(traceTransmission('corn', 'DOWN').find(p => p.target === 'ethanol')!.direction, 'UP');
  assert.equal(up.find(p => p.target === 'wheat')!.measure, 'DEMAND');
});
test('Multi-step oil routes preserve cost semantics and bounded depth without revisiting nodes', () => {
  const paths = traceTransmission('crude-oil', 'UP', 3);
  assert.ok(paths.some(p => p.nodes.join('/') === 'crude-oil/heating-oil/freight/corn' && p.measure === 'INPUT_COST'));
  for (const p of paths) { assert.ok(p.links.length <= 3); assert.equal(new Set(p.nodes).size, p.nodes.length); }
  assert.ok(traceTransmission('crude-oil','UP',1).every(p => p.links.length === 1));
});
test('Context-only crush links do not seed invented directional propagation', () => {
  assert.ok(linksForCommodity('soy-oil').outgoing.some(l => l.targetMeasure === 'CONTEXT'));
  assert.ok(!traceTransmission('soy-oil','UP',3).some(p => p.target === 'soy-meal'));
  assert.deepEqual(traceTransmission('gold','UP',3), []);
});
test('Invalid scenario inputs fail rather than silently selecting a scenario', () => {
  assert.throws(() => traceTransmission('unknown','UP'));
  for (const h of [0,4,1.5,NaN]) assert.throws(() => traceTransmission('corn','UP',h));
  assert.throws(() => traceTransmission('corn','FLAT' as any));
});
test('Missing, neutral and mixed forecasts cannot be used as a directional seed', () => {
  assert.equal(directionFromForecast(undefined), null);
  for (const status of ['MIXED','NO_MATERIAL_SIGNAL','INSUFFICIENT_EVIDENCE'] as const) assert.equal(directionFromForecast(snapshot({ status })),null);
  assert.equal(directionFromForecast(snapshot()),'UP');
  assert.equal(directionFromForecast(snapshot({ status:'DOWNWARD_PRESSURE' })),'DOWN');
});
test('Revision comparison refuses different regions, duplicate inputs and engine changes', () => {
  const a = snapshot();
  assert.equal(compareForecasts(a,snapshot({regionId:'parana'})).comparable,false);
  assert.equal(compareForecasts(a,snapshot()).comparable,false);
  assert.equal(compareForecasts(a,snapshot({sourceGeneratedAtUtc:'2026-07-02T00:00:00Z'})).comparable,false);
  const b = snapshot({sourceGeneratedAtUtc:'2026-07-02T00:00:00Z',evidence:{inputHash:'second',engineVersion:'v2'} as any,drivers:[{label:'Rain',signalId:'PRECIP_NEXT7',zScore:-1}] as any,status:'NO_MATERIAL_SIGNAL'});
  const r = compareForecasts(a,b);assert.equal(r.comparable,true);assert.equal(r.changes[0].deltaZ,1);assert.equal(r.pressureChanged,true);
  assert.equal(compareForecasts(a,snapshot({evidence:{inputHash:'second',engineVersion:'v3'} as any})).comparable,false);
});
test('History ignores cache repeats and bounds memory while preserving actual snapshots', () => {
  const a = snapshot();const history=[a];assert.equal(appendForecastSnapshot(history,a),history);
  assert.equal(appendForecastSnapshot(history,snapshot({sourceGeneratedAtUtc:'2026-07-02T00:00:00Z'})),history);
  let h: CommodityForecast[]=[];
  for(let i=0;i<20;i++)h=appendForecastSnapshot(h,snapshot({evidence:{inputHash:`input-${i}`,engineVersion:'v2'} as any}));
  assert.equal(h.length,12);assert.equal(h[0].evidence.inputHash,'input-8');
});
