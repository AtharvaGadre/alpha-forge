import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  clearLivePipelineCache,
  extractCoordinates,
  extractPlaceCandidates,
  hourlyToDaily,
  inverseMseWeights,
  LIVE_MODEL_SPECS,
  pearsonWithP,
  pickGeocodeResult,
  runLiveAtmospherePipeline,
  shiftYears,
  toArgonInvestigation,
  type FetchJson,
} from './liveAtmospherePipeline.ts';
import { generateArgonScientificReport } from './argonAtmosphereEngine.ts';

// ---------------------------------------------------------------------------
// Offline mock of every external API. "Truth" is a deterministic function of
// (date, location); each model = truth × (1 + bias) + noise, so the verification
// experiment has a known answer (GFS and ICON are the worst models).
// ---------------------------------------------------------------------------

const NOW = new Date('2026-11-08T12:00:00Z');
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
};
const truthPrecip = (d: string, li: number) => {
  const u = hash(`p${d}${li}`);
  return u < 0.45 ? 0 : 25 * (u - 0.45) ** 1.5;
};
const truthTemp = (d: string, li: number) => 20 + 4 * Math.sin(Date.parse(d) / 8.64e8) + li;
const BIAS: Record<string, number> = {
  ecmwf_ifs025: 0, ecmwf_aifs025_single: 0.05, gfs_seamless: 0.6, icon_seamless: -0.45,
  ukmo_seamless: 0.1, meteofrance_seamless: 0, jma_seamless: 0.2, gem_seamless: 0.3,
};
const modelPrecip = (m: string, d: string, li: number) =>
  Math.max(0, truthPrecip(d, li) * (1 + BIAS[m]) + (hash(`n${m}${d}${li}`) - 0.5) * (m.startsWith('ecmwf') ? 0.5 : 3));
const modelTemp = (m: string, d: string, li: number) => truthTemp(d, li) + BIAS[m] * 2;

const days = (a: string, b: string) => {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
};

function mockFetch(opts: { failForecast?: boolean } = {}): FetchJson {
  return async (url: string) => {
    const u = new URL(url);
    const q = (k: string) => u.searchParams.get(k) ?? '';
    const lats = q('latitude').split(',').filter(Boolean);
    const wrap = (locs: any[]) => (locs.length === 1 ? locs[0] : locs);
    const today = NOW.toISOString().slice(0, 10);

    if (u.host.startsWith('geocoding-api')) {
      const name = q('name');
      if (name === 'Texas') {
        return { results: [
          { name: 'Texas', feature_code: 'PPL', country_code: 'MX', country: 'Mexico', latitude: 20, longitude: -99, population: 500 },
          { name: 'Texas', feature_code: 'ADM1', country_code: 'US', country: 'United States', latitude: 31, longitude: -99, population: 29000000 },
        ] };
      }
      if (name === 'Nairobi') return { results: [{ name: 'Nairobi', feature_code: 'PPLC', country_code: 'KE', country: 'Kenya', admin1: 'Nairobi County', latitude: -1.28, longitude: 36.82, population: 2750000 }] };
      return { results: [] };
    }
    if (u.host === 'api.open-meteo.com' && u.pathname.startsWith('/data/')) {
      const metaId = u.pathname.split('/')[2];
      const ageH = metaId === 'cmc_gem_gdps' ? 400 : metaId === 'jma_gsm' ? 44 : 6;
      return { last_run_initialisation_time: Math.floor((NOW.getTime() - ageH * 3.6e6) / 1000) };
    }
    if (u.host === 'api.open-meteo.com') {
      if (opts.failForecast) throw new Error('HTTP 500');
      const dates = days(addDays(today, -7), addDays(today, 6));
      return wrap(lats.map((_, li) => {
        const daily: any = { time: dates };
        for (const m of q('models').split(',')) {
          // Météo-France ARPEGE only covers 4 forecast days, as in reality
          const ok = (d: string) => m !== 'meteofrance_seamless' || d <= addDays(today, 3);
          daily[`precipitation_sum_${m}`] = dates.map((d) => (ok(d) ? modelPrecip(m, d, li) : null));
          daily[`temperature_2m_mean_${m}`] = dates.map((d) => (ok(d) ? modelTemp(m, d, li) : null));
          daily[`temperature_2m_max_${m}`] = dates.map((d) => (ok(d) ? modelTemp(m, d, li) + 6 : null));
          daily[`wind_speed_10m_mean_${m}`] = dates.map((d) => (ok(d) ? 3 + hash(`w${d}${li}`) : null));
        }
        return { daily };
      }));
    }
    if (u.host.startsWith('ensemble-api')) {
      const dates = days(today, addDays(today, 7));
      return wrap(lats.map((_, li) => {
        const daily: any = { time: dates };
        for (let k = 0; k <= 50; k++) daily[`precipitation_sum${k ? `_member${String(k).padStart(2, '0')}` : ''}_ecmwf_ifs025_ensemble`] = dates.map((d) => modelPrecip('ecmwf_ifs025', d, li) * (0.7 + 0.6 * hash(`e${k}${d}`)));
        for (let k = 0; k <= 30; k++) daily[`precipitation_sum${k ? `_member${String(k).padStart(2, '0')}` : ''}_ncep_gefs025`] = dates.map((d) => modelPrecip('gfs_seamless', d, li) * (0.7 + 0.6 * hash(`g${k}${d}`)));
        return { daily };
      }));
    }
    if (u.host.startsWith('archive-api')) {
      const dates = days(q('start_date'), q('end_date'));
      return wrap(lats.map((_, li) => ({
        daily: {
          time: dates,
          precipitation_sum: dates.map((d) => truthPrecip(d, li)),
          temperature_2m_mean: dates.map((d) => truthTemp(d, li)),
          temperature_2m_max: dates.map((d) => truthTemp(d, li) + 6),
          wind_speed_10m_mean: dates.map((d) => 3 + hash(`w${d}${li}`)),
        },
      })));
    }
    if (u.host.startsWith('previous-runs-api')) {
      const dates = days(q('start_date'), q('end_date'));
      const time = dates.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
      return wrap(lats.map((_, li) => {
        const hourly: any = { time };
        for (const m of q('models').split(',')) {
          for (const lead of [1, 3, 5]) {
            const missing = m === 'meteofrance_seamless' && lead === 5;
            hourly[`precipitation_previous_day${lead}_${m}`] = time.map((t) => (missing ? null : modelPrecip(m, t.slice(0, 10), li) / 24));
            hourly[`temperature_2m_previous_day${lead}_${m}`] = time.map((t) => (missing ? null : modelTemp(m, t.slice(0, 10), li)));
          }
        }
        return { hourly };
      }));
    }
    if (u.host === 'power.larc.nasa.gov') {
      const series: Record<string, number> = {};
      for (let y = 2015; y <= 2025; y++) {
        for (let m = 1; m <= 13; m++) series[`${y}${String(m).padStart(2, '0')}`] = 3 + 2 * Math.sin(m) + hash(`pw${y}${m}`);
      }
      return { properties: { parameter: { PRECTOTCORR: series, T2M: series } } };
    }
    if (u.host.includes('finance.yahoo.com')) {
      const monthly = q('interval') === '1mo';
      const n = monthly ? 120 : 40;
      const step = monthly ? 30.44 * 86400 : 86400;
      const t0 = Math.floor(NOW.getTime() / 1000) - n * step;
      return { chart: { result: [{ meta: { currency: 'USX' }, timestamp: Array.from({ length: n }, (_, i) => Math.floor(t0 + i * step)), indicators: { quote: [{ close: Array.from({ length: n }, (_, i) => 300 * Math.exp(0.02 * Math.sin(i) + 0.001 * i)) }] } }] } };
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

test('Query parsing: coordinates, place candidates, demonyms and exact-match geocoding', () => {
  assert.deepEqual(extractCoordinates('rain at -21.55, -45.43 next week'), { lat: -21.55, lng: -45.43 });
  assert.equal(extractCoordinates('next 7 days in 2026'), null);
  assert.ok(extractPlaceCandidates('What will the weather in London mean for gas?').includes('London'));
  assert.ok(extractPlaceCandidates('Brazilian weather this week').includes('Brazil'));
  const pick = pickGeocodeResult(
    [
      { name: 'Texas', feature_code: 'PPL', country_code: 'MX', population: 500 },
      { name: 'Texas', feature_code: 'ADM1', country_code: 'US', population: 29e6 },
      { name: 'Brazilian Island', feature_code: 'ISL', country_code: 'US', population: 0 },
    ],
    'Texas'
  );
  assert.equal(pick.country_code, 'US');
  assert.equal(pickGeocodeResult([{ name: 'Brazilian Island', feature_code: 'ISL' }], 'Brazilian'), null);
});

test('Statistics helpers: correlation p-values, inverse-MSE weights, hourly→daily, leap years', () => {
  const x = Array.from({ length: 60 }, (_, i) => i);
  const perfect = pearsonWithP(x, x.map((v) => 2 * v + 1));
  assert.ok(perfect.r > 0.999 && perfect.p < 1e-6);
  const noise = pearsonWithP(x, x.map((i) => hash(`z${i}`)));
  assert.ok(Math.abs(noise.r) < 0.4 && noise.p > 0.001);

  const w = inverseMseWeights([1, 4, 16]);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(w[0] > w[1] && w[1] > w[2] && w[2] > 0.5 / 3 - 1e-12, 'shrinkage keeps every weight ≥ half of equal');

  const daily = hourlyToDaily(
    Array.from({ length: 48 }, (_, h) => `2026-01-0${1 + Math.floor(h / 24)}T${String(h % 24).padStart(2, '0')}:00`),
    Array.from({ length: 48 }, () => 0.5),
    'sum'
  );
  assert.equal(daily.get('2026-01-01'), 12);
  assert.equal(shiftYears('2028-02-29', -1), '2027-02-28');
});

test('Live pipeline (mocked APIs): predict → verify → consequences → explain for the coffee belt', async () => {
  clearLivePipelineCache();
  const r = await runLiveAtmospherePipeline({ query: 'What happens if Brazilian rainfall forecasts change for coffee?', fetchJson: mockFetch(), now: NOW });

  assert.equal(r.target.presetId, 'BRAZIL_COFFEE_BELT');
  assert.equal(r.target.points.length, 3);

  // Provenance: stale GEM/JMA and short-horizon ARPEGE are excluded, with reasons
  const byName = Object.fromEntries(r.modelForecasts.map((m) => [m.modelId, m]));
  assert.equal(byName.ECCC_GEM.includedInEnsemble, false);
  assert.match(byName.ECCC_GEM.exclusionReason!, /stale/);
  assert.equal(byName.JMA_GSM.includedInEnsemble, false);
  assert.match(byName.METEOFRANCE_ARPEGE.exclusionReason!, /horizon/);
  assert.equal(r.modelInputs.length, 5);

  // Ensemble maths
  const wsum = r.modelInputs.reduce((a, m) => a + m.weight, 0);
  assert.ok(Math.abs(wsum - 1) < 1e-3);
  const manual = r.modelInputs.reduce((a, m) => a + m.weight * m.predictedPrecipitationMm, 0) / wsum;
  assert.ok(Math.abs(manual - r.ensemble.ensemblePrecipitationMm) < 0.05);
  assert.equal(r.ensembleMembers.ecmwfMembers, 51);
  assert.equal(r.ensembleMembers.gefsMembers, 31);
  for (const m of r.modelInputs) assert.ok(m.probExceedance20Mm >= 0 && m.probExceedance20Mm <= 1);

  // Verification: chronological, disjoint, and it should learn that GFS/ICON are worst
  const v = r.verification!;
  assert.ok(v, 'verification experiment ran');
  assert.ok(v.trainWindow.split('…')[1] < v.testWindow.split('…')[0], 'train strictly precedes test');
  assert.ok(v.nTest >= 30);
  const tw = Object.fromEntries(v.trainedWeights.map((x) => [x.modelId, x.weight]));
  assert.ok(tw.ECMWF_IFS > tw.NOAA_GFS && tw.ECMWF_IFS > tw.DWD_ICON);
  assert.equal(v.verdict, 'SKILL_WEIGHTING_IMPROVED');
  assert.ok(v.skillWeighted.crps < v.equalWeight.crps);
  assert.ok(r.skillByLead.some((s) => s.leadDays === 1) && r.skillByLead.some((s) => s.leadDays === 5));

  // Climatology + signals
  assert.equal(r.climatology.years, 10);
  assert.ok(r.signals.find((s) => s.id === 'PRECIP_NEXT7'));

  // Consequences: coffee futures chain with observed move and a historical test
  const kc = r.consequences.find((c) => c.exposure.symbol === 'KC=F')!;
  assert.ok(kc && kc.observedMove && kc.historical);
  assert.ok(kc.historical!.months >= 24);
  assert.ok(['LOW', 'MODERATE', 'HIGH'].includes(kc.confidence));

  // Explanation and reproducibility
  assert.ok(r.epistemic.A_whatWeatherOccurred.length && r.epistemic.F_whatRemainsUncertainOrUnverified.length);
  assert.equal(r.steps.length, 10);
  assert.equal(r.reproducibility.reconciliationPassed, true);
  assert.match(r.reproducibility.inputsSha256, /^[0-9a-f]{64}$/);
  assert.ok(r.dataLog.every((d) => d.ok), 'all mocked fetches succeed: ' + r.dataLog.filter((d) => !d.ok).map((d) => d.source + ' ' + d.note).join('; '));
});

test('Live pipeline: geocodes any place, adapts to ARGON shape, and the report uses live provenance', async () => {
  clearLivePipelineCache();
  const r = await runLiveAtmospherePipeline({ query: 'Hey ARGON, what is the weather outlook for Nairobi?', fetchJson: mockFetch(), now: NOW });
  assert.equal(r.target.resolution, 'GEOCODED');
  assert.equal(r.target.countryCode, 'KE');
  assert.equal(r.consequences.length, 0);
  assert.match(r.briefingBasic, /physical forecast only/);

  const inv = toArgonInvestigation(r);
  assert.equal(inv.dataMode, 'LIVE_OPEN_DATA');
  assert.equal(inv.modelComparison.modelInputs.length, r.modelInputs.length);
  assert.equal(inv.workflowSteps.length, 10);
  const report = generateArgonScientificReport(inv);
  assert.equal(report.sections28.length, 28);
  assert.match(report.sections28.find((s) => s.sectionNumber === 27)!.content, /api\/v2\/atmosphere\/investigate/);
  assert.ok(!report.sections28.find((s) => s.sectionNumber === 5)!.content.includes('NASA GPM IMERG'));
});

test('Live pipeline: throws when forecasts are unreachable so the server can fall back explicitly', async () => {
  clearLivePipelineCache();
  await assert.rejects(
    runLiveAtmospherePipeline({ query: 'Weather in Texas for power demand', fetchJson: mockFetch({ failForecast: true }), now: NOW }),
    /Live forecast unavailable/
  );
  assert.equal(LIVE_MODEL_SPECS.length, 8);
});


test('Commodity target override keeps coordinates and symbols instead of resolving a coffee preset', async () => {
  clearLivePipelineCache();
  const { COMMODITIES, commodityTarget, buildCommodityForecast } = await import('./commodityForecastEngine.ts');
  const c = COMMODITIES.find(c => c.id === 'wheat')!;
  const region = c.regions[0];
  const target = commodityTarget(c, region);
  const result = await runLiveAtmospherePipeline({ query: 'coffee', target, now: NOW, fetchJson: mockFetch() });
  assert.equal(result.target.label, region.name);
  assert.equal(result.target.points[0].lat, region.lat);
  assert.equal(result.target.exposures[0].symbol, 'ZW=F');
  assert.equal(result.consequences[0].historical, null);
  const forecast = buildCommodityForecast(c, region, result);
  assert.equal(forecast.commodityId, 'wheat');
  assert.equal(forecast.evidence.priceModelValidated, false);
});
