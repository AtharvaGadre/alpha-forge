/**
 * Astraeus weather-forecast benchmark.
 *
 * Question: across the world's key commodity regions, how accurate are the raw global models,
 * and how much does statistical post-processing (bias correction, EMOS) improve the forecasts
 * that feed the commodity signals?
 *
 * Design (all choices fixed before looking at results):
 *  - 16 commodity sites from src/engine/commodityRegions.ts, 7 global models via Open-Meteo's
 *    Previous Runs API (forecasts as issued 1, 3, 5 and 7 days before the target day).
 *  - Truth: ERA5 reanalysis (Hersbach et al. 2020), aggregated to UTC days exactly like the forecasts.
 *  - Rolling-origin evaluation. Post-processing is refitted every 7 days on the 40 most recent target
 *    days whose ERA5 truth was already published at issue time (6-day lag). No test-day information
 *    is ever used in fitting.
 *  - Scores: CRPS (proper), MAE/RMSE/bias of the point forecast, PIT histogram, 80 % interval
 *    coverage, Brier score + reliability for events. Reference forecasts: climatology (ERA5 2019–2024,
 *    ±7 days) and the raw multi-model ensemble. Significance: Diebold–Mariano (HAC, HLN) on the
 *    daily cross-site mean loss differential, moving-block bootstrap CI.
 *
 * Usage:  npx tsx research/weather-benchmark.ts            (fetch what is missing, then evaluate)
 *         npx tsx research/weather-benchmark.ts --offline  (evaluate from cache only)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  crpsOf, pointOf, pitOf, exceedanceOf, quantileOf, histogram, reliabilityBins, brierDecomposition,
  dieboldMariano, blockBootstrapMeanCI, seededRandom,
  fitEmosNormal, predictEmosNormal, fitEmosCensored, predictEmosCensored, fitNgrSkill, predictNgrSkill, skillWeights, fitCensoredPower, predictCensoredPower,
  fitAstraeusV1, predictAstraeusV1, biasCorrectedEnsemble, applyBiasCorrection,
  type PredictiveForecast, type TrainingRow, type VariableKind,
} from '../src/engine/weatherPostprocessing';

// ---------------------------------------------------------------------------
// Configuration (pre-registered)
// ---------------------------------------------------------------------------

const CONFIG = {
  version: 'astraeus-weather-benchmark-v1',
  forecastStart: '2025-07-01',
  forecastEnd: '2026-11-08',
  climatologyYears: [2019, 2024] as [number, number],
  climatologyHalfWindowDays: 7,
  leads: [1, 3, 5, 7],
  trainingWindowDays: 40,
  era5LagDays: 6,
  refitEveryDays: 7,
  minModelAvailability: 0.9,
  precipEventMm: 1,
  temperatureEventPercentile: 0.8,
};

const MODELS = [
  { api: 'ecmwf_ifs025', name: 'ECMWF IFS', kind: 'physics' },
  { api: 'ecmwf_aifs025_single', name: 'ECMWF AIFS', kind: 'machine learning' },
  { api: 'gfs_seamless', name: 'NOAA GFS', kind: 'physics' },
  { api: 'icon_seamless', name: 'DWD ICON', kind: 'physics' },
  { api: 'ukmo_seamless', name: 'UK Met Office UM', kind: 'physics' },
  { api: 'jma_seamless', name: 'JMA GSM', kind: 'physics' },
  { api: 'gem_seamless', name: 'ECCC GEM', kind: 'physics' },
];

const SITES = [
  { id: 'iowa', name: 'Iowa · US Corn Belt', lat: 42.03, lng: -93.62, commodities: ['corn', 'soybeans', 'hogs'] },
  { id: 'kansas', name: 'Kansas · US Plains', lat: 38.84, lng: -97.61, commodities: ['wheat'] },
  { id: 'mato-grosso', name: 'Mato Grosso · Brazil', lat: -12.54, lng: -55.72, commodities: ['soybeans', 'cotton'] },
  { id: 'parana', name: 'Paraná · Brazil', lat: -24.95, lng: -53.46, commodities: ['corn', 'soybeans'] },
  { id: 'cordoba', name: 'Córdoba · Argentina', lat: -31.42, lng: -64.19, commodities: ['corn', 'soybeans'] },
  { id: 'minas', name: 'Minas Gerais · Brazil', lat: -21.55, lng: -45.43, commodities: ['coffee'] },
  { id: 'daloa', name: 'Daloa · Côte d’Ivoire', lat: 6.88, lng: -6.45, commodities: ['cocoa'] },
  { id: 'punjab', name: 'Punjab · India', lat: 30.9, lng: 75.86, commodities: ['wheat', 'rice'] },
  { id: 'beauce', name: 'Beauce · France', lat: 48.45, lng: 1.49, commodities: ['wheat'] },
  { id: 'odesa', name: 'Odesa · Ukraine', lat: 46.48, lng: 30.73, commodities: ['wheat', 'corn'] },
  { id: 'nsw', name: 'New South Wales · Australia', lat: -32.25, lng: 148.6, commodities: ['wheat'] },
  { id: 'jilin', name: 'Jilin · China', lat: 43.84, lng: 126.55, commodities: ['corn'] },
  { id: 'mekong', name: 'Mekong Delta · Vietnam', lat: 10.05, lng: 105.75, commodities: ['rice'] },
  { id: 'texas', name: 'Texas · United States', lat: 32.78, lng: -96.8, commodities: ['natural-gas'] },
  { id: 'northeast', name: 'Northeast · United States', lat: 40.71, lng: -74.01, commodities: ['natural-gas', 'heating-oil'] },
  { id: 'northwest-europe', name: 'Northwest Europe · Netherlands', lat: 52.37, lng: 4.9, commodities: ['natural-gas'] },
];

type Variable = 'tmean' | 'tmax' | 'precip';
const VARIABLES: Array<{ id: Variable; label: string; unit: string; kind: VariableKind }> = [
  { id: 'tmean', label: 'Daily mean 2 m temperature', unit: '°C', kind: 'temperature' },
  { id: 'tmax', label: 'Daily maximum 2 m temperature', unit: '°C', kind: 'temperature' },
  { id: 'precip', label: 'Daily precipitation', unit: 'mm', kind: 'precipitation' },
];

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, 'research', 'cache', 'weather');
const OUT_JSON = path.join(ROOT, 'public', 'research', 'weather-skill.json');
const OUT_MD = path.join(ROOT, 'docs', 'results', 'WEATHER_BENCHMARK.md');
const USER_AGENT = 'Astraeus-Research/1.0 (+https://github.com/AtharvaGadre/alpha-forge)';
const OFFLINE = process.argv.includes('--offline');

// ---------------------------------------------------------------------------
// Polite cached fetching
// ---------------------------------------------------------------------------

let spent = 0;
async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const cost = Number(res.headers.get('x-ratelimit-cost') ?? 0);
    const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? 600);
    if (res.status === 429) {
      const wait = 15_000 * (attempt + 1);
      console.warn(`  429 — waiting ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
    spent += cost;
    if (remaining < 120) await new Promise((r) => setTimeout(r, 30_000));
    return res.json();
  }
  throw new Error('rate limited repeatedly');
}

function cachePath(key: string) {
  return path.join(CACHE, `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`);
}

async function cachedDaily(key: string, build: () => Promise<any>): Promise<any> {
  const p = cachePath(key);
  if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8'));
  if (OFFLINE) throw new Error(`offline and missing cache for ${key}`);
  const data = await build();
  writeFileSync(p, JSON.stringify(data));
  return data;
}

/** Aggregate hourly series to UTC days; requires all 24 hours (no silent gap filling). */
function toDaily(times: string[], values: Array<number | null> | undefined, mode: 'mean' | 'max' | 'sum'): Record<string, number> {
  const out: Record<string, number> = {};
  if (!values) return out;
  const groups = new Map<string, number[]>();
  times.forEach((t, i) => {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    const d = t.slice(0, 10);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(v);
  });
  for (const [d, xs] of groups) {
    if (xs.length !== 24) continue;
    out[d] = mode === 'sum' ? xs.reduce((a, b) => a + b, 0) : mode === 'max' ? Math.max(...xs) : xs.reduce((a, b) => a + b, 0) / 24;
  }
  return out;
}

function chunks(start: string, end: string, months = 4): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  while (s <= e) {
    const n = new Date(s);
    n.setUTCMonth(n.getUTCMonth() + months);
    n.setUTCDate(n.getUTCDate() - 1);
    const stop = n < e ? n : e;
    out.push([s.toISOString().slice(0, 10), stop.toISOString().slice(0, 10)]);
    s = new Date(stop);
    s.setUTCDate(s.getUTCDate() + 1);
  }
  return out;
}

/** forecasts[var][lead][model][date] */
type ForecastStore = Record<Variable, Record<number, Record<string, Record<string, number>>>>;

async function loadForecasts(site: (typeof SITES)[number]): Promise<ForecastStore> {
  const store = { tmean: {}, tmax: {}, precip: {} } as ForecastStore;
  for (const v of VARIABLES) for (const l of CONFIG.leads) store[v.id][l] = Object.fromEntries(MODELS.map((m) => [m.api, {}]));
  const hourly = CONFIG.leads.flatMap((l) => [`temperature_2m_previous_day${l}`, `precipitation_previous_day${l}`]).join(',');
  for (const [a, b] of chunks(CONFIG.forecastStart, CONFIG.forecastEnd)) {
    const url = `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${site.lat}&longitude=${site.lng}&start_date=${a}&end_date=${b}&hourly=${hourly}&models=${MODELS.map((m) => m.api).join(',')}&timezone=GMT`;
    const daily = await cachedDaily(`fc|${site.id}|${a}|${b}|${MODELS.map((m) => m.api).join(',')}|${CONFIG.leads}`, async () => {
      const raw = await fetchJson(url);
      const t: string[] = raw.hourly?.time ?? [];
      const out: Record<string, Record<string, number>> = {};
      for (const m of MODELS) for (const l of CONFIG.leads) {
        out[`tmean|${l}|${m.api}`] = toDaily(t, raw.hourly?.[`temperature_2m_previous_day${l}_${m.api}`], 'mean');
        out[`tmax|${l}|${m.api}`] = toDaily(t, raw.hourly?.[`temperature_2m_previous_day${l}_${m.api}`], 'max');
        out[`precip|${l}|${m.api}`] = toDaily(t, raw.hourly?.[`precipitation_previous_day${l}_${m.api}`], 'sum');
      }
      return out;
    });
    for (const [key, series] of Object.entries(daily as Record<string, Record<string, number>>)) {
      const [vv, ll, mm] = key.split('|');
      Object.assign(store[vv as Variable][Number(ll)][mm], series);
    }
  }
  return store;
}

async function loadTruth(site: (typeof SITES)[number]): Promise<Record<Variable, Record<string, number>>> {
  const truth = { tmean: {}, tmax: {}, precip: {} } as Record<Variable, Record<string, number>>;
  for (const [a, b] of chunks(CONFIG.forecastStart, CONFIG.forecastEnd, 6)) {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${site.lat}&longitude=${site.lng}&start_date=${a}&end_date=${b}&hourly=temperature_2m,precipitation&models=era5&timezone=GMT`;
    const daily = await cachedDaily(`era5|${site.id}|${a}|${b}`, async () => {
      const raw = await fetchJson(url);
      const t: string[] = raw.hourly?.time ?? [];
      return {
        tmean: toDaily(t, raw.hourly?.temperature_2m, 'mean'),
        tmax: toDaily(t, raw.hourly?.temperature_2m, 'max'),
        precip: toDaily(t, raw.hourly?.precipitation, 'sum'),
      };
    });
    for (const v of VARIABLES) Object.assign(truth[v.id], daily[v.id]);
  }
  return truth;
}

async function loadClimatology(site: (typeof SITES)[number]): Promise<Record<Variable, Record<string, number>>> {
  const [y0, y1] = CONFIG.climatologyYears;
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${site.lat}&longitude=${site.lng}&start_date=${y0}-01-01&end_date=${y1}-12-31&daily=temperature_2m_mean,temperature_2m_max,precipitation_sum&models=era5&timezone=GMT`;
  return cachedDaily(`clim|${site.id}|${y0}|${y1}`, async () => {
    const raw = await fetchJson(url);
    const t: string[] = raw.daily.time;
    const pick = (arr: Array<number | null>) => Object.fromEntries(t.map((d, i) => [d, arr[i]]).filter(([, v]) => v !== null && Number.isFinite(v as number)));
    return { tmean: pick(raw.daily.temperature_2m_mean), tmax: pick(raw.daily.temperature_2m_max), precip: pick(raw.daily.precipitation_sum) };
  });
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const dayOfYear = (d: string) => {
  const x = new Date(`${d}T00:00:00Z`);
  return Math.floor((x.getTime() - Date.UTC(x.getUTCFullYear(), 0, 1)) / 86400000);
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

function climatologySample(clim: Record<string, number>, date: string): number[] {
  const doy = dayOfYear(date);
  const out: number[] = [];
  for (const [d, v] of Object.entries(clim)) {
    const diff = Math.abs(dayOfYear(d) - doy);
    if (Math.min(diff, 365 - diff) <= CONFIG.climatologyHalfWindowDays) out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Method registry. Each variant is refitted every CONFIG.refitEveryDays on its own trailing window.
// ---------------------------------------------------------------------------

type Row = TrainingRow & { clim: number };
type Predictor = (f: number[], clim: number) => PredictiveForecast | null;
interface Variant {
  id: string;
  label: string;
  applies: VariableKind | 'both';
  window: number;
  fit: (train: Row[], kind: VariableKind) => Predictor | null;
}

const V: Record<string, Variant> = {
  'raw-ensemble': { id: 'raw-ensemble', label: 'Raw multi-model ensemble', applies: 'both', window: 0, fit: () => (f) => ({ kind: 'ensemble', members: f }) },
  'astraeus-v1': { id: 'astraeus-v1', label: 'Astraeus v1 (inverse-MSE weights + spread inflation)', applies: 'both', window: 40, fit: (t, k) => { const m = fitAstraeusV1(t); return m ? (f) => predictAstraeusV1(m, f, k) : null; } },
  'bias-corrected': { id: 'bias-corrected', label: 'Bias-corrected ensemble', applies: 'both', window: 40, fit: (t, k) => { const m = biasCorrectedEnsemble(t, k); return m ? (f) => applyBiasCorrection(m, f) : null; } },
  emos: { id: 'emos', label: 'EMOS (Gneiting et al. 2005; censored Gaussian for rain)', applies: 'both', window: 40, fit: (t, k) => { const m = k === 'temperature' ? fitEmosNormal(t) : fitEmosCensored(t); return m ? (f) => (k === 'temperature' ? predictEmosNormal(m, f) : predictEmosCensored(m, f)) : null; } },
  'emos-weighted': { id: 'emos-weighted', label: 'EMOS with learned model weights', applies: 'both', window: 40, fit: (t, k) => { const m = k === 'temperature' ? fitEmosNormal(t, { learnWeights: true }) : fitEmosCensored(t, { learnWeights: true }); return m ? (f) => (k === 'temperature' ? predictEmosNormal(m, f) : predictEmosCensored(m, f)) : null; } },
};
for (const w of [40, 60, 90]) {
  V[`ngr-skill-${w}`] = { id: `ngr-skill-${w}`, label: `Skill-weighted NGR, ${w}-day window`, applies: 'temperature', window: w, fit: (t) => { const m = fitNgrSkill(t); return m ? (f) => predictNgrSkill(m, f) : null; } };
  V[`ngr-skill-clim-${w}`] = { id: `ngr-skill-clim-${w}`, label: `Skill-weighted NGR + climatology predictor, ${w}-day window`, applies: 'temperature', window: w, fit: (t) => { const m = fitNgrSkill(t, { useClimatology: true }); return m ? (f, c) => predictNgrSkill(m, f, c) : null; } };
  V[`weighted-ensemble-${w}`] = { id: `weighted-ensemble-${w}`, label: `Skill-weighted ensemble (bias-corrected for temperature), ${w}-day window`, applies: 'both', window: w, fit: (t, k) => {
    if (t.length < 10) return null;
    const shift = k === 'temperature' ? t[0].f.map((_, i) => t.reduce((a, r) => a + r.f[i] - r.y, 0) / t.length) : null;
    const w8 = skillWeights(t, 0.25, shift ?? undefined);
    return (f) => ({ kind: 'weighted-ensemble', members: shift ? f.map((v, i) => v - shift[i]) : f, weights: w8 });
  } };
  V[`sqrt-censored-${w}`] = { id: `sqrt-censored-${w}`, label: `√-censored Gaussian (ML), ${w}-day window`, applies: 'precipitation', window: w, fit: (t) => { const m = fitCensoredPower(t, { power: 0.5 }); return m ? (f) => predictCensoredPower(m, f) : null; } };
  V[`sqrt-censored-w-${w}`] = { id: `sqrt-censored-w-${w}`, label: `Skill-weighted √-censored Gaussian (ML), ${w}-day window`, applies: 'precipitation', window: w, fit: (t) => { const m = fitCensoredPower(t, { power: 0.5, weighted: true }); return m ? (f) => predictCensoredPower(m, f) : null; } };
  V[`cbrt-censored-w-${w}`] = { id: `cbrt-censored-w-${w}`, label: `Skill-weighted ∛-censored Gaussian (ML), ${w}-day window`, applies: 'precipitation', window: w, fit: (t) => { const m = fitCensoredPower(t, { power: 1 / 3, weighted: true }); return m ? (f) => predictCensoredPower(m, f) : null; } };
}

/**
 * Astraeus v2 — frozen on 2026-11-15 from the development period only: skill-weighted NGR (90-day window)
 * for temperature, skill-weighted raw ensemble (90-day window) for precipitation.
 */
V['astraeus-v2'] = {
  id: 'astraeus-v2', label: 'Astraeus v2 (skill-weighted NGR for temperature; skill-weighted ensemble for rain; 90-day window)', applies: 'both', window: 90,
  fit: (t, k) => (k === 'temperature' ? V['ngr-skill-90'] : V['weighted-ensemble-90']).fit(t, k),
};

const SUITES: Record<string, string[]> = {
  final: ['raw-ensemble', 'astraeus-v1', 'emos', 'astraeus-v2'],
  run1: ['raw-ensemble', 'astraeus-v1', 'bias-corrected', 'emos', 'emos-weighted'],
  dev: ['raw-ensemble', 'astraeus-v1', 'emos',
    'ngr-skill-40', 'ngr-skill-60', 'ngr-skill-90', 'ngr-skill-clim-60', 'ngr-skill-clim-90', 'weighted-ensemble-40', 'weighted-ensemble-90',
    'sqrt-censored-40', 'sqrt-censored-90', 'sqrt-censored-w-60', 'sqrt-censored-w-90', 'cbrt-censored-w-90'],
};

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const PERIOD = arg('period', 'all') as 'dev' | 'confirm' | 'all';
const SUITE = arg('suite', 'run1');
const DEV_END = '2026-03-31';
const MAX_WINDOW = 90;

interface Record_ {
  site: string; variable: Variable; lead: number; date: string; method: string; fallback: boolean;
  crps: number; err: number; pit: number; inside80: boolean; prob: number; event: boolean;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  mkdirSync(path.dirname(OUT_MD), { recursive: true });
  const suite = (SUITES[SUITE] ?? SUITE.split(',')).map((id) => {
    if (!V[id]) throw new Error(`unknown method ${id}`);
    return V[id];
  });
  const methodsFor = (k: VariableKind) => ['climatology', ...suite.filter((v) => v.applies === 'both' || v.applies === k).map((v) => v.id)];
  // every variant is scored on the same days: the first day on which the longest window is available
  const firstTestDay = (lead: number) => addDays(CONFIG.forecastStart, Math.max(...suite.map((v) => v.window), CONFIG.trainingWindowDays) + CONFIG.era5LagDays + lead + 1);
  const inPeriod = (d: string) => (PERIOD === 'dev' ? d <= DEV_END : PERIOD === 'confirm' ? d > DEV_END : true);

  const records: Record_[] = [];
  const singleModel: Array<{ site: string; variable: Variable; lead: number; model: string; date: string; err: number }> = [];
  const siteMeta: Array<{ id: string; name: string; lat: number; lng: number; commodities: string[]; modelsByLead: Record<number, string[]> }> = [];
  const rnd = seededRandom(20261115);
  const EXAMPLES = [{ site: 'iowa', variable: 'tmax', lead: 3 }, { site: 'northeast', variable: 'tmean', lead: 3 }, { site: 'minas', variable: 'precip', lead: 1 }];
  const examples: any[] = [];

  for (const site of SITES) {
    console.log(`▸ ${site.name}`);
    const [fc, truth, clim] = await Promise.all([loadForecasts(site), loadTruth(site), loadClimatology(site)]);
    const allDays = Object.keys(truth.tmean).sort();
    const modelsByLead: Record<number, string[]> = {};
    for (const lead of CONFIG.leads) {
      modelsByLead[lead] = MODELS.filter((m) => allDays.filter((d) => fc.tmean[lead][m.api][d] !== undefined).length >= CONFIG.minModelAvailability * allDays.length).map((m) => m.api);
    }
    siteMeta.push({ ...site, modelsByLead });
    const climMeanCache = new Map<string, Record<Variable, { sample: number[]; mean: number }>>();
    const climFor = (v: Variable, d: string) => {
      if (!climMeanCache.has(d)) {
        const o = {} as Record<Variable, { sample: number[]; mean: number }>;
        for (const vv of VARIABLES) { const sample = climatologySample(clim[vv.id], d); o[vv.id] = { sample, mean: avg(sample) }; }
        climMeanCache.set(d, o);
      }
      return climMeanCache.get(d)![v];
    };

    for (const v of VARIABLES) {
      const t = truth[v.id];
      const methods = methodsFor(v.kind);
      const variants = suite.filter((x) => x.applies === 'both' || x.applies === v.kind);
      for (const lead of CONFIG.leads) {
        const models = modelsByLead[lead];
        if (models.length < 2) continue;
        const series = fc[v.id][lead];
        const rowFor = (d: string): Row | null => {
          if (t[d] === undefined) return null;
          const f = models.map((m) => series[m][d]);
          return f.every((x) => x !== undefined && Number.isFinite(x)) ? { f: f as number[], y: t[d], clim: climFor(v.id, d).mean } : null;
        };
        const testDays = allDays.filter((d) => d >= firstTestDay(lead) && inPeriod(d));
        const fitted = new Map<string, { at: string; predict: Predictor | null }>();
        for (const d of testDays) {
          const row = rowFor(d);
          if (!row) continue;
          // information set at issue time d − lead: ERA5 published up to (d − lead − lag)
          const lastTruth = addDays(d, -lead - CONFIG.era5LagDays);
          for (const variant of variants) {
            const prev = fitted.get(variant.id);
            if (prev && d < addDays(prev.at, CONFIG.refitEveryDays)) continue;
            const train: Row[] = [];
            for (let k = 0; k < Math.max(1, variant.window); k++) {
              const r = rowFor(addDays(lastTruth, -k));
              if (r) train.push(r);
            }
            fitted.set(variant.id, { at: d, predict: variant.fit(train, v.kind) });
          }
          const c = climFor(v.id, d);
          const threshold = v.kind === 'precipitation' ? CONFIG.precipEventMm : quantileOf({ kind: 'ensemble', members: c.sample }, CONFIG.temperatureEventPercentile);
          const event = v.kind === 'precipitation' ? row.y >= threshold : row.y > threshold;
          const raw: PredictiveForecast = { kind: 'ensemble', members: row.f };
          for (const m of methods) {
            let fcst: PredictiveForecast | null;
            let fallback = false;
            if (m === 'climatology') fcst = c.sample.length >= 30 ? { kind: 'ensemble', members: c.sample } : null;
            else {
              fcst = fitted.get(m)?.predict?.(row.f, row.clim) ?? null;
              // Scored on identical cases: fall back to the raw ensemble only where a fit was impossible.
              if (!fcst) { fcst = raw; fallback = true; }
            }
            if (!fcst) continue;
            records.push({
              site: site.id, variable: v.id, lead, date: d, method: m, fallback,
              crps: crpsOf(fcst, row.y), err: pointOf(fcst) - row.y, pit: pitOf(fcst, row.y, rnd()),
              inside80: row.y >= quantileOf(fcst, 0.1) && row.y <= quantileOf(fcst, 0.9),
              prob: exceedanceOf(fcst, threshold + (v.kind === 'precipitation' ? 0 : 1e-9)), event,
            });
          }
          models.forEach((m, i) => singleModel.push({ site: site.id, variable: v.id, lead, model: m, date: d, err: row.f[i] - row.y }));
          if (EXAMPLES.some((e) => e.site === site.id && e.variable === v.id && e.lead === lead) && fitted.get('astraeus-v2')?.predict) {
            const fcst = fitted.get('astraeus-v2')!.predict!(row.f, row.clim)!;
            examples.push({ site: site.id, variable: v.id, lead, date: d, truth: r3(row.y), members: Object.fromEntries(models.map((m, i) => [m, r3(row.f[i])])), p10: r3(quantileOf(fcst, 0.1)), p50: r3(quantileOf(fcst, 0.5)), p90: r3(quantileOf(fcst, 0.9)), mean: r3(pointOf(fcst)) });
          }
        }
      }
    }
    console.log(`  models by lead: ${CONFIG.leads.map((l) => `${l}:${modelsByLead[l].length}`).join(' ')} · API cost so far ${spent.toFixed(0)}`);
  }

  // ---------------------------------------------------------------------------
  // Aggregation
  // ---------------------------------------------------------------------------
  const summary: any[] = [];
  const significance: any[] = [];
  for (const v of VARIABLES) for (const lead of CONFIG.leads) {
    const methods = methodsFor(v.kind);
    const sub = records.filter((r) => r.variable === v.id && r.lead === lead);
    const caseKey = (r: Record_) => `${r.site}|${r.date}`;
    const byMethod = new Map<string, Map<string, Record_>>();
    for (const r of sub) {
      if (!byMethod.has(r.method)) byMethod.set(r.method, new Map());
      byMethod.get(r.method)!.set(caseKey(r), r);
    }
    const common = [...(byMethod.get('climatology')?.keys() ?? [])].filter((k) => methods.every((m) => byMethod.get(m)?.has(k)));
    if (!common.length) continue;
    const keysByDate = new Map<string, string[]>();
    for (const k of common) {
      const d = k.split('|')[1];
      if (!keysByDate.has(d)) keysByDate.set(d, []);
      keysByDate.get(d)!.push(k);
    }
    const dates = [...keysByDate.keys()].sort();
    const crpsMean = (m: string) => avg(common.map((k) => byMethod.get(m)!.get(k)!.crps));
    const dailyMean = (m: string) => dates.map((d) => avg(keysByDate.get(d)!.map((k) => byMethod.get(m)!.get(k)!.crps)));
    const refs = { climatology: crpsMean('climatology'), raw: crpsMean('raw-ensemble'), v1: methods.includes('astraeus-v1') ? crpsMean('astraeus-v1') : NaN };
    const dRaw = dailyMean('raw-ensemble');
    const dV1 = methods.includes('astraeus-v1') ? dailyMean('astraeus-v1') : null;
    const dClim = dailyMean('climatology');
    const climRows = common.map((k) => byMethod.get('climatology')!.get(k)!);
    const climBrier = avg(climRows.map((r) => (r.prob - (r.event ? 1 : 0)) ** 2));
    for (const m of methods) {
      const rows = common.map((k) => byMethod.get(m)!.get(k)!);
      const crps = avg(rows.map((r) => r.crps));
      const probs = rows.map((r) => r.prob);
      const events = rows.map((r) => r.event);
      const brier = avg(rows.map((r) => (r.prob - (r.event ? 1 : 0)) ** 2));
      const dm = dailyMean(m);
      const diffRaw = dm.map((x, i) => x - dRaw[i]);
      const ciRaw = blockBootstrapMeanCI(diffRaw, { block: 7, resamples: 1000 });
      const dec = brierDecomposition(probs, events);
      summary.push({
        variable: v.id, lead, method: m, label: m === 'climatology' ? `Climatology (ERA5 ${CONFIG.climatologyYears.join('–')}, ±${CONFIG.climatologyHalfWindowDays} d)` : V[m].label,
        window: m === 'climatology' ? null : V[m].window, cases: rows.length, days: dates.length, fallbacks: rows.filter((r) => r.fallback).length,
        crps: r3(crps), crpssVsClimatology: r3(1 - crps / refs.climatology), crpssVsRaw: r3(1 - crps / refs.raw), crpssVsV1: r3(1 - crps / refs.v1),
        crpssVsRawCI: [r3(-ciRaw.hi / refs.raw), r3(-ciRaw.lo / refs.raw)],
        mae: r3(avg(rows.map((r) => Math.abs(r.err)))), rmse: r3(Math.sqrt(avg(rows.map((r) => r.err ** 2)))), bias: r3(avg(rows.map((r) => r.err))),
        coverage80: r3(avg(rows.map((r) => (r.inside80 ? 1 : 0)))),
        brier: r3(brier), brierSkillVsClimatology: r3(1 - brier / climBrier),
        brierReliability: r3(dec.reliability), brierResolution: r3(dec.resolution), eventBaseRate: r3(dec.baseRate),
        pit: histogram(rows.map((r) => r.pit), 10).map((c) => r3(c / Math.max(1, rows.length))),
        reliability: reliabilityBins(probs, events, 10).map((b) => ({ p: r3(b.meanForecast), o: r3(b.observedFrequency), n: b.n })),
      });
      const tests: Array<[string, number[] | null]> = [['raw-ensemble', dRaw], ['astraeus-v1', dV1], ['climatology', dClim]];
      for (const [versus, ref] of tests) {
        if (!ref || versus === m) continue;
        const res = dieboldMariano(dm.map((x, i) => x - ref[i]), Math.max(1, lead));
        significance.push({ variable: v.id, lead, method: m, versus, meanDiff: r3(res.meanDiff), statistic: r3(res.statistic), pValue: res.pValue, days: res.n });
      }
    }
  }

  const bySite: any[] = [];
  const index = new Map<string, Record_[]>();
  for (const r of records) {
    const k = `${r.site}|${r.variable}|${r.lead}`;
    if (!index.has(k)) index.set(k, []);
    index.get(k)!.push(r);
  }
  for (const site of SITES) for (const v of VARIABLES) for (const lead of CONFIG.leads) {
    const sub = index.get(`${site.id}|${v.id}|${lead}`) ?? [];
    const keys = new Set(sub.filter((r) => r.method === 'climatology').map((r) => r.date));
    if (!keys.size) continue;
    const row: any = { site: site.id, variable: v.id, lead, days: keys.size };
    for (const m of methodsFor(v.kind)) row[m] = r3(avg(sub.filter((r) => r.method === m && keys.has(r.date)).map((r) => r.crps)));
    bySite.push(row);
  }

  const models: any[] = [];
  for (const v of VARIABLES) for (const lead of CONFIG.leads) for (const m of MODELS) {
    const e = singleModel.filter((r) => r.variable === v.id && r.lead === lead && r.model === m.api).map((r) => r.err);
    if (e.length) models.push({ variable: v.id, lead, model: m.api, name: m.name, kind: m.kind, cases: e.length, mae: r3(avg(e.map(Math.abs))), rmse: r3(Math.sqrt(avg(e.map((x) => x * x)))), bias: r3(avg(e)) });
  }

  const periodLabel = PERIOD === 'dev' ? `development period (test days ≤ ${DEV_END})` : PERIOD === 'confirm' ? `confirmation period (test days > ${DEV_END}), scored once after the method was frozen` : 'full period';
  const result = {
    version: CONFIG.version, suite: SUITE, period: PERIOD, periodLabel,
    generatedAt: new Date().toISOString(),
    config: { ...CONFIG, maxWindowDays: MAX_WINDOW, devEnd: DEV_END },
    models: MODELS, sites: siteMeta, variables: VARIABLES,
    methods: [{ id: 'climatology', label: 'Climatology' }, ...suite.map((x) => ({ id: x.id, label: x.label, window: x.window, applies: x.applies }))],
    provenance: {
      forecasts: 'Open-Meteo Previous Runs API (https://previous-runs-api.open-meteo.com) — model output as issued N days before each target day, hourly, aggregated to UTC days (all 24 hours required).',
      truth: 'ERA5 reanalysis via Open-Meteo Archive API (models=era5), hourly, aggregated identically.',
      climatology: `ERA5 daily ${CONFIG.climatologyYears.join('–')}, all days within ±${CONFIG.climatologyHalfWindowDays} days of the target calendar day.`,
      apiCostUnits: Math.round(spent),
      reproducibility: `npx tsx research/weather-benchmark.ts --suite ${SUITE} --period ${PERIOD} --offline (from research/cache) — deterministic seeds.`,
    },
    headlineMethod: suite.some((x) => x.id === 'astraeus-v2') ? 'astraeus-v2' : null,
    summary, significance, bySite, singleModels: models,
    examples: EXAMPLES.map((e) => ({ ...e, days: examples.filter((x) => x.site === e.site && x.variable === e.variable && x.lead === e.lead).slice(-75) })),
    caveats: [
      'ERA5 is a ~31 km reanalysis, not station truth; grid-cell verification favours smooth models and understates local extremes.',
      'ECMWF AIFS is trained on ERA5, so verification against ERA5 is expected to favour it; its advantage against station observations may be smaller.',
      'Single grid points stand in for each region; production-weighted areal averages would score differently.',
      'Previous-Runs data stitch successive runs issued N days earlier, so a "day-3" forecast mixes run times within the target day.',
      'Diebold–Mariano tests use the cross-site daily mean loss; sites are not independent, so the effective sample is the number of days.',
    ],
  };
  const tag = `${SUITE}-${PERIOD}`;
  const outJson = arg('out', '') || (SUITE === 'final' && PERIOD === 'confirm' ? OUT_JSON : path.join(ROOT, 'research', 'out', `weather-${tag}.json`));
  mkdirSync(path.dirname(outJson), { recursive: true });
  writeFileSync(outJson, JSON.stringify(result));
  const outMd = outJson === OUT_JSON ? OUT_MD : outJson.replace(/\.json$/, '.md');
  writeFileSync(outMd, renderMarkdown(result));
  console.log(`\nwrote ${path.relative(ROOT, outJson)} · API cost ${spent.toFixed(0)}`);
}

function renderMarkdown(r: any): string {
  const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`);
  const lines: string[] = [];
  lines.push('# Astraeus weather benchmark', '', `Generated ${r.generatedAt} · ${r.version} · suite ${r.suite} · ${r.periodLabel}`, '');
  lines.push(`Sites: ${r.sites.length} commodity regions · models: ${r.models.length} · leads: ${r.config.leads.join(', ')} days · training window ${r.config.trainingWindowDays} days (refit every ${r.config.refitEveryDays} days, ERA5 lag ${r.config.era5LagDays} days).`, '');
  for (const v of r.variables) {
    lines.push(`## ${v.label} (${v.unit})`, '', '| Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | MAE | Bias | 80% coverage | BSS vs clim. |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const lead of r.config.leads) for (const s of r.summary.filter((x: any) => x.variable === v.id && x.lead === lead)) {
      lines.push(`| ${lead} | ${s.label} | ${s.cases} | ${s.crps} | ${pct(s.crpssVsClimatology)} | ${pct(s.crpssVsRaw)} (${pct(s.crpssVsRawCI[0])}, ${pct(s.crpssVsRawCI[1])}) | ${s.mae} | ${s.bias} | ${pct(s.coverage80)} | ${pct(s.brierSkillVsClimatology)} |`);
    }
    lines.push('');
  }
  lines.push('## Caveats', '', ...r.caveats.map((c: string) => `- ${c}`), '');
  return lines.join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
