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
import { loadStationTruth, readStationsFile } from './lib/stations';
import { readAreasFile, weightedMeanNested } from './lib/areas';
import {
  crpsOf, pointOf, pitOf, exceedanceOf, quantileOf, histogram, reliabilityBins, brierDecomposition,
  dieboldMariano, seededRandom, insideCentral, rawGaussian, crpsEnsemble,
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
  const w = requestWeight(url);
  if (BUDGET && estimatedSpent + w > BUDGET) throw new Error(`Open-Meteo budget: ${estimatedSpent.toFixed(0)} + ${w.toFixed(1)} would exceed --budget ${BUDGET}`);
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const cost = Number(res.headers.get('x-ratelimit-cost') ?? 0);
    const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? 600);
    if (res.status === 429 && EXTENDED) throw new Error('HTTP 429 from Open-Meteo — stopping (shared daily budget)');
    if (res.ok) { estimatedSpent += w; console.log(`  fetched ${url.split('?')[0].split('/')[2]} · weight ≈ ${w.toFixed(1)} (header ${cost}) · run total ≈ ${estimatedSpent.toFixed(0)}`); }
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

/** Anything with coordinates: a benchmark site or one point of a production-weighted area. */
type SiteLike = { id: string; lat: number; lng: number };

async function loadForecasts(site: SiteLike, start = CONFIG.forecastStart): Promise<ForecastStore> {
  const store = { tmean: {}, tmax: {}, precip: {} } as ForecastStore;
  for (const v of VARIABLES) for (const l of CONFIG.leads) store[v.id][l] = Object.fromEntries(MODELS.map((m) => [m.api, {}]));
  const hourly = CONFIG.leads.flatMap((l) => [`temperature_2m_previous_day${l}`, `precipitation_previous_day${l}`]).join(',');
  for (const [a, b] of chunks(start, CONFIG.forecastEnd)) {
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

async function loadTruth(site: SiteLike, start = CONFIG.forecastStart): Promise<Record<Variable, Record<string, number>>> {
  const truth = { tmean: {}, tmax: {}, precip: {} } as Record<Variable, Record<string, number>>;
  for (const [a, b] of chunks(start, CONFIG.forecastEnd, 6)) {
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

async function loadClimatology(site: SiteLike, years: [number, number] = CONFIG.climatologyYears): Promise<Record<Variable, Record<string, number>>> {
  const [y0, y1] = years;
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

/** Zero-training reference: Gaussian (zero-censored for rain) with the members' mean and sd. */
V['raw-gauss'] = { id: 'raw-gauss', label: 'Raw-ensemble Gaussian (no training)', applies: 'both', window: 0, fit: (_t, k) => (f) => rawGaussian(f, k) };

const SUITES: Record<string, string[]> = {
  final: ['raw-ensemble', 'raw-gauss', 'astraeus-v1', 'emos', 'astraeus-v2'],
  run1: ['raw-ensemble', 'astraeus-v1', 'bias-corrected', 'emos', 'emos-weighted'],
  dev: ['raw-ensemble', 'astraeus-v1', 'emos',
    'ngr-skill-40', 'ngr-skill-60', 'ngr-skill-90', 'ngr-skill-clim-60', 'ngr-skill-clim-90', 'weighted-ensemble-40', 'weighted-ensemble-90',
    'sqrt-censored-40', 'sqrt-censored-90', 'sqrt-censored-w-60', 'sqrt-censored-w-90', 'cbrt-censored-w-90'],
};

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const PERIOD = arg('period', 'all') as 'dev' | 'confirm' | 'prospective' | 'all';
/** Forecasts issued after this date had not been seen by anyone when Astraeus v2 was frozen. */
const PROSPECTIVE_START = '2026-11-16';
const DM_LAG = 14; // Newey–West bandwidth (days); robustness reported at lead, 7 and 21
const BOOT_BLOCK = 7;
const SUITE = arg('suite', 'run1');
const DEV_END = '2026-03-31';
const MAX_WINDOW = 90;

// ---------------------------------------------------------------------------
// Verification extensions: station truth and production-weighted areas.
//   --truth era5|stations   verification truth (default era5)
//   --train era5|stations   with --truth stations: methods trained on ERA5 as deployed (default) or on the station
//   --sites benchmark|areas the 16 single grid points (default) or the areas in research/data/areas.json
//   --only a,b              restrict to these site ids        --mask stations  ERA5 truth on station-observed days only
//   --clim-years y0,y1      climatology years (subset of the cached 2019–2024 for benchmark sites)
//   --budget N              stop before the estimated Open-Meteo weight of this run would exceed N
// Every method of the selected suite is evaluated unchanged; only truth, training truth and sites differ.
// ---------------------------------------------------------------------------
const TRUTH = arg('truth', 'era5') as 'era5' | 'stations';
const TRAIN_ON = arg('train', 'era5') as 'era5' | 'stations';
const SITE_SET = arg('sites', 'benchmark') as 'benchmark' | 'areas';
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const MASK = arg('mask', '') as '' | 'stations';
const CLIM_YEARS = arg('clim-years', '') ? (arg('clim-years', '').split(',').map(Number) as [number, number]) : null;
const BUDGET = Number(arg('budget', '0')) || 0;
/** Area points are fetched from here: first confirmation test day minus the 90-day window, lag and lead, with margin. */
const AREA_START = '2025-12-15';
const EXTENDED = TRUTH !== 'era5' || SITE_SET !== 'benchmark' || !!ONLY || !!MASK || !!CLIM_YEARS;
let estimatedSpent = 0;
if (!['era5', 'stations'].includes(TRUTH) || !['era5', 'stations'].includes(TRAIN_ON) || !['benchmark', 'areas'].includes(SITE_SET)) throw new Error('bad --truth/--train/--sites');
if (TRAIN_ON === 'stations' && TRUTH !== 'stations') throw new Error('--train stations needs --truth stations');
if (MASK && (MASK !== 'stations' || TRUTH !== 'era5')) throw new Error('--mask stations applies to --truth era5 only');
if (SITE_SET === 'areas' && TRUTH !== 'era5') throw new Error('areas are verified against area-mean ERA5 only');
if (SITE_SET === 'areas' && !['confirm', 'prospective'].includes(PERIOD)) throw new Error(`area forecasts are fetched from ${AREA_START}; use --period confirm or prospective`);

/** Open-Meteo weight of a request: locations × (variables × models / 10) × (days / 14), at least 1 per location. */
function requestWeight(url: string): number {
  const q = new URL(url).searchParams;
  const vars = (q.get('hourly') ?? q.get('daily') ?? '').split(',').filter(Boolean).length;
  const models = Math.max(1, (q.get('models') ?? '').split(',').filter(Boolean).length);
  const start = q.get('start_date');
  const end = q.get('end_date');
  const days = start && end ? (Date.parse(end) - Date.parse(start)) / 864e5 + 1 : 14;
  const locations = (q.get('latitude') ?? '').split(',').length;
  return locations * Math.max(1, ((vars * models) / 10) * (days / 14));
}

const yearsOnly = (s: Record<Variable, Record<string, number>>, [y0, y1]: [number, number]) =>
  Object.fromEntries(Object.entries(s).map(([v, xs]) => [v, Object.fromEntries(Object.entries(xs).filter(([d]) => +d.slice(0, 4) >= y0 && +d.slice(0, 4) <= y1))])) as Record<Variable, Record<string, number>>;

type RunSite = { id: string; name: string; lat: number; lng: number; commodities: string[] };
function runSites(): RunSite[] {
  if (SITE_SET === 'areas') {
    return readAreasFile(ROOT).areas.filter((a) => !ONLY || ONLY.includes(a.id) || ONLY.includes(a.benchmarkSite)).map((a) => {
      const w = a.points.reduce((s, p) => s + p.weight, 0);
      return { id: a.id, name: a.name, lat: +(a.points.reduce((s, p) => s + p.weight * p.lat, 0) / w).toFixed(3), lng: +(a.points.reduce((s, p) => s + p.weight * p.lng, 0) / w).toFixed(3), commodities: [a.commodity] };
    });
  }
  let sites = SITES.filter((s) => !ONLY || ONLY.includes(s.id));
  if (TRUTH === 'stations' || MASK) {
    const st = readStationsFile(ROOT);
    sites = sites.filter((s) => st.sites.some((e) => e.site === s.id && (e.tmax || e.precip)));
  }
  return sites;
}

/**
 * Forecasts, verification truth, training truth and climatology for one run site.
 * allDays (ERA5 days) fixes model membership exactly as in the ERA5 benchmark.
 */
async function loadSiteData(site: RunSite) {
  type Series = Record<Variable, Record<string, number>>;
  if (SITE_SET === 'areas') {
    const area = readAreasFile(ROOT).areas.find((a) => a.id === site.id)!;
    const fcs: ForecastStore[] = [];
    const eras: Series[] = [];
    const clims: Series[] = [];
    for (const p of area.points) { // sequential: polite to the shared Open-Meteo budget
      const pt = { id: `area:${area.id}:${p.id}`, lat: p.lat, lng: p.lng };
      fcs.push(await loadForecasts(pt, AREA_START));
      eras.push(await loadTruth(pt, AREA_START));
      clims.push(await loadClimatology(pt, CLIM_YEARS ?? CONFIG.climatologyYears));
    }
    const w = area.points.map((p) => p.weight);
    const era5 = weightedMeanNested(eras, w, 1);
    return { fc: weightedMeanNested(fcs, w, 3), truth: era5, train: era5, clim: weightedMeanNested(clims, w, 1), allDays: Object.keys(era5.tmean).sort() };
  }
  const [fc, era5, climAll] = await Promise.all([loadForecasts(site), loadTruth(site), loadClimatology(site)]);
  const clim = CLIM_YEARS ? yearsOnly(climAll, CLIM_YEARS) : climAll;
  const allDays = Object.keys(era5.tmean).sort();
  if (TRUTH === 'era5' && !MASK) return { fc, truth: era5, train: era5, clim, allDays };
  const entry = readStationsFile(ROOT).sites.find((e) => e.site === site.id)!;
  if (Math.abs(entry.lat - site.lat) > 1e-9 || Math.abs(entry.lng - site.lng) > 1e-9) throw new Error(`stations.json coordinates for ${site.id} differ from SITES`);
  const st = await loadStationTruth(ROOT, entry, { start: CONFIG.forecastStart, end: CONFIG.forecastEnd }, CLIM_YEARS ?? CONFIG.climatologyYears);
  if (MASK) {
    // ERA5 truth, scored only on the site-days the station observed (identical cases to the station runs)
    const masked = { tmean: {}, tmax: {}, precip: {} } as Series;
    for (const v of ['tmax', 'precip'] as const) masked[v] = Object.fromEntries(Object.entries(era5[v]).filter(([d]) => st.truth[v][d] !== undefined));
    return { fc, truth: masked, train: era5, clim, allDays };
  }
  // station climatology as the reference forecast where the record is long enough, else ERA5 at the grid point
  const stClim = { tmean: clim.tmean, tmax: st.climUsable.tmax ? st.clim.tmax : clim.tmax, precip: st.climUsable.precip ? st.clim.precip : clim.precip } as Series;
  return { fc, truth: st.truth as Series, train: TRAIN_ON === 'stations' ? (st.truth as Series) : era5, clim: stClim, allDays };
}

/** Per-case CRPS of every method on the cases all methods share, grouped by variable, lead and site (for paired cross-run tests). */
function caseLosses(records: Record_[], methodsFor: (k: VariableKind) => string[]) {
  const out: Array<{ variable: Variable; lead: number; site: string; dates: string[]; crps: Record<string, number[]>; inside80: Record<string, number[]> }> = [];
  const groups = new Map<string, Map<string, Map<string, Record_>>>();
  for (const r of records) {
    const g = `${r.variable}|${r.lead}|${r.site}`;
    if (!groups.has(g)) groups.set(g, new Map());
    const byDate = groups.get(g)!;
    if (!byDate.has(r.date)) byDate.set(r.date, new Map());
    byDate.get(r.date)!.set(r.method, r);
  }
  for (const [g, byDate] of groups) {
    const [variable, lead, site] = g.split('|');
    const methods = methodsFor(VARIABLES.find((x) => x.id === variable)!.kind);
    const dates = [...byDate.keys()].filter((d) => methods.every((m) => byDate.get(d)!.has(m))).sort();
    out.push({
      variable: variable as Variable, lead: Number(lead), site, dates,
      crps: Object.fromEntries(methods.map((m) => [m, dates.map((d) => Math.round(byDate.get(d)!.get(m)!.crps * 1e5) / 1e5)])),
      inside80: Object.fromEntries(methods.map((m) => [m, dates.map((d) => (byDate.get(d)!.get(m)!.inside80 ? 1 : 0))])),
    });
  }
  return out;
}

function verificationMeta() {
  const st = TRUTH === 'stations' || MASK ? readStationsFile(ROOT) : null;
  const ar = SITE_SET === 'areas' ? readAreasFile(ROOT) : null;
  return {
    truth: TRUTH, train: TRUTH === 'stations' ? TRAIN_ON : 'era5', sites: SITE_SET, only: ONLY, mask: MASK || null,
    climatologyYears: CLIM_YEARS ?? CONFIG.climatologyYears,
    areaForecastStart: SITE_SET === 'areas' ? AREA_START : null,
    stationsFile: st ? { version: st.version, generatedAt: st.generatedAt } : null,
    areasFile: ar ? { version: ar.version, generatedAt: ar.generatedAt } : null,
    openMeteoWeightEstimate: Math.round(estimatedSpent),
    truthDescription: TRUTH === 'stations'
      ? `Station observations (research/data/stations.json; GHCN-Daily, Meteostat observation-sourced values), re-dated by the frozen per-station shift; methods trained on ${TRAIN_ON === 'stations' ? 'the same station observations' : 'ERA5 (as deployed)'} with the ${CONFIG.era5LagDays}-day lag. Tmean is not verified. Climatology: station record where ≥ 60% complete, else ERA5 at the grid point.`
      : SITE_SET === 'areas' ? 'Production-weighted area mean of ERA5 at the area points (research/data/areas.json); forecasts are area means of each model at the same points.'
        : MASK ? 'ERA5 at the grid point, scored only on site-days with a station observation (same cases as the station runs).' : 'ERA5 at the grid point.',
  };
}

interface Record_ {
  site: string; variable: Variable; lead: number; date: string; method: string; fallback: boolean;
  crps: number; crpsFair: number; members: number; err: number; pit: number; inside80: boolean; prob: number; event: boolean;
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
  const inPeriod = (d: string) => (PERIOD === 'dev' ? d <= DEV_END : PERIOD === 'confirm' ? d > DEV_END : PERIOD === 'prospective' ? d > PROSPECTIVE_START : true);

  const records: Record_[] = [];
  const singleModel: Array<{ site: string; variable: Variable; lead: number; model: string; date: string; err: number }> = [];
  const siteMeta: Array<{ id: string; name: string; lat: number; lng: number; commodities: string[]; modelsByLead: Record<number, string[]> }> = [];
  const rnd = seededRandom(20261115);
  const EXAMPLES = [{ site: 'iowa', variable: 'tmax', lead: 3 }, { site: 'northeast', variable: 'tmean', lead: 3 }, { site: 'minas', variable: 'precip', lead: 1 }];
  const examples: any[] = [];

  for (const site of runSites()) {
    console.log(`▸ ${site.name}`);
    const { fc, truth, train, clim, allDays } = await loadSiteData(site);
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
      const tTrain = train[v.id];
      const methods = methodsFor(v.kind);
      const variants = suite.filter((x) => x.applies === 'both' || x.applies === v.kind);
      for (const lead of CONFIG.leads) {
        const models = modelsByLead[lead];
        if (models.length < 2) continue;
        const series = fc[v.id][lead];
        const rowFor = (d: string, tt = t): Row | null => {
          if (tt[d] === undefined) return null;
          const f = models.map((m) => series[m][d]);
          return f.every((x) => x !== undefined && Number.isFinite(x)) ? { f: f as number[], y: tt[d], clim: climFor(v.id, d).mean } : null;
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
              const r = rowFor(addDays(lastTruth, -k), tTrain);
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
            const pit = pitOf(fcst, row.y, rnd());
            records.push({
              site: site.id, variable: v.id, lead, date: d, method: m, fallback,
              crps: crpsOf(fcst, row.y),
              // fair (finite-ensemble-unbiased) CRPS is recorded for the raw ensemble only (Ferro 2014)
              crpsFair: m === 'raw-ensemble' ? crpsEnsemble(row.f, row.y, true) : NaN,
              members: row.f.length,
              err: pointOf(fcst) - row.y, pit,
              // coverage from the PIT, identical in meaning for Gaussian, censored and ensemble forecasts
              inside80: insideCentral(pit),
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
    // per-day sums and counts: the pooled estimand is 1 − Σ CRPS_m / Σ CRPS_ref over all cases
    const daySum = (m: string) => dates.map((d) => keysByDate.get(d)!.reduce((a, k) => a + byMethod.get(m)!.get(k)!.crps, 0));
    const dayN = dates.map((d) => keysByDate.get(d)!.length);
    const nBar = avg(dayN);
    const sums = new Map(methods.map((m) => [m, daySum(m)] as const));
    const refs = { climatology: crpsMean('climatology'), raw: crpsMean('raw-ensemble'), gauss: methods.includes('raw-gauss') ? crpsMean('raw-gauss') : NaN, v1: methods.includes('astraeus-v1') ? crpsMean('astraeus-v1') : NaN };
    // moving-block bootstrap over days, recomputing the pooled ratio from resampled cases
    const rnd2 = seededRandom(424242 + lead);
    const B = 2000;
    const draws: number[][] = [];
    for (let b = 0; b < B; b++) {
      const pick: number[] = [];
      while (pick.length < dates.length) {
        const start = Math.floor(rnd2() * Math.max(1, dates.length - BOOT_BLOCK + 1));
        for (let j = 0; j < BOOT_BLOCK && pick.length < dates.length; j++) pick.push(Math.min(dates.length - 1, start + j));
      }
      draws.push(pick);
    }
    const ratioCI = (num: string, den: string): [number, number] => {
      const a = sums.get(num);
      const c = sums.get(den);
      if (!a || !c) return [NaN, NaN];
      const vals = draws.map((pick) => 1 - pick.reduce((x, i) => x + a[i], 0) / pick.reduce((x, i) => x + c[i], 0)).sort((x, y) => x - y);
      return [vals[Math.floor(0.025 * B)], vals[Math.min(B - 1, Math.floor(0.975 * B))]];
    };
    // case-weighted daily loss differential (Σ_cases Δ / n̄), so each case counts equally as in the point estimate
    const dmTest = (m: string, ref: string) => {
      const a = sums.get(m)!;
      const c = sums.get(ref)!;
      const d = a.map((x, i) => (x - c[i]) / nBar);
      const main = dieboldMariano(d, DM_LAG);
      const robust = [Math.max(1, lead), 7, 21].map((lag) => dieboldMariano(d, lag).pValue);
      return { ...main, robustMaxP: Math.max(main.pValue, ...robust) };
    };
    const climRows = common.map((k) => byMethod.get('climatology')!.get(k)!);
    const climBrier = avg(climRows.map((r) => (r.prob - (r.event ? 1 : 0)) ** 2));
    for (const m of methods) {
      const rows = common.map((k) => byMethod.get(m)!.get(k)!);
      const crps = avg(rows.map((r) => r.crps));
      const probs = rows.map((r) => r.prob);
      const events = rows.map((r) => r.event);
      const brier = avg(rows.map((r) => (r.prob - (r.event ? 1 : 0)) ** 2));
      const dec = brierDecomposition(probs, events);
      const ciRaw = m === 'raw-ensemble' ? [0, 0] : ratioCI(m, 'raw-ensemble');
      const ciGauss = m === 'raw-gauss' || !methods.includes('raw-gauss') ? [NaN, NaN] : ratioCI(m, 'raw-gauss');
      summary.push({
        variable: v.id, lead, method: m, label: m === 'climatology' ? `Climatology (ERA5 ${CONFIG.climatologyYears.join('–')}, ±${CONFIG.climatologyHalfWindowDays} d)` : V[m].label,
        window: m === 'climatology' ? null : V[m].window, cases: rows.length, days: dates.length, fallbacks: rows.filter((r) => r.fallback).length,
        members: r3(avg(rows.map((r) => r.members))), minSitesPerDay: Math.min(...dayN), maxSitesPerDay: Math.max(...dayN),
        crps: r3(crps), crpsFair: m === 'raw-ensemble' ? r3(avg(rows.map((r) => r.crpsFair))) : null,
        crpssVsClimatology: r3(1 - crps / refs.climatology), crpssVsRaw: r3(1 - crps / refs.raw), crpssVsRawGauss: r3(1 - crps / refs.gauss), crpssVsV1: r3(1 - crps / refs.v1),
        crpssVsRawCI: ciRaw.map(r3), crpssVsRawGaussCI: ciGauss.map(r3),
        mae: r3(avg(rows.map((r) => Math.abs(r.err)))), rmse: r3(Math.sqrt(avg(rows.map((r) => r.err ** 2)))), bias: r3(avg(rows.map((r) => r.err))),
        coverage80: r3(avg(rows.map((r) => (r.inside80 ? 1 : 0)))),
        pitLowest: r3(rows.filter((r) => r.pit < 0.1).length / rows.length), pitHighest: r3(rows.filter((r) => r.pit > 0.9).length / rows.length),
        brier: r3(brier), brierSkillVsClimatology: r3(1 - brier / climBrier),
        brierReliability: r3(dec.reliability), brierResolution: r3(dec.resolution), eventBaseRate: r3(dec.baseRate),
        pit: histogram(rows.map((r) => r.pit), 10).map((c) => r3(c / Math.max(1, rows.length))),
        reliability: reliabilityBins(probs, events, 10).map((b) => ({ p: r3(b.meanForecast), o: r3(b.observedFrequency), n: b.n })),
      });
      for (const versus of ['raw-ensemble', 'raw-gauss', 'astraeus-v1', 'climatology']) {
        if (versus === m || !methods.includes(versus)) continue;
        const res = dmTest(m, versus);
        significance.push({ variable: v.id, lead, method: m, versus, meanDiff: r3(res.meanDiff), statistic: r3(res.statistic), pValue: res.pValue, robustMaxP: res.robustMaxP, lag: DM_LAG, days: res.n });
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
    config: { ...CONFIG, maxWindowDays: MAX_WINDOW, devEnd: DEV_END, prospectiveStart: PROSPECTIVE_START, dmLagDays: DM_LAG, bootstrapBlockDays: BOOT_BLOCK, bootstrapResamples: 2000 },
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
      'Diebold–Mariano tests use the case-weighted daily loss differential with a 14-day Newey–West bandwidth (robustness at the lead, 7 and 21 days reported); sites are not independent, so the effective sample is the number of days, and a handful of calendar days with no complete cases are skipped.',
      'Raw-ensemble CRPS treats the m members (7 at day 1, 5–6 at longer leads) as an empirical distribution, which carries a finite-ensemble penalty; the zero-training Gaussian baseline and the fair CRPS isolate how much of the gain is learned from past errors.',
      'Model membership per region and lead is fixed from availability over the whole archive (no truth or skill information is used).',
      `An exploratory first run scored early methods over the whole period, including the confirmation days; only forecasts after ${PROSPECTIVE_START} are strictly unseen (--period prospective).`,
    ],
  };
  const tag = `${SUITE}-${PERIOD}${EXTENDED ? `-${SITE_SET === 'areas' ? 'areas' : TRUTH === 'stations' ? `stations-train-${TRAIN_ON}` : MASK ? 'era5-stationdays' : 'era5'}${ONLY ? `-${ONLY.join('+')}` : ''}${CLIM_YEARS ? `-clim${CLIM_YEARS.join('-')}` : ''}` : ''}`;
  if (EXTENDED) {
    // station / area runs never replace the published ERA5 benchmark
    Object.assign(result, {
      verification: verificationMeta(), caseLosses: caseLosses(records, methodsFor),
      singleModelErrors: singleModel.map((r) => [r.site, r.variable, r.lead, r.model, r.date, Math.round(r.err * 1000) / 1000]),
    });
    if (TRUTH === 'stations' || SITE_SET === 'areas') result.provenance.truth = verificationMeta().truthDescription;
  }
  const outJson = arg('out', '') || (SUITE === 'final' && PERIOD === 'confirm' && !EXTENDED ? OUT_JSON : path.join(ROOT, 'research', 'out', `weather-${tag}.json`));
  if (EXTENDED && path.resolve(outJson) === OUT_JSON) throw new Error('refusing to overwrite public/research/weather-skill.json with a station/area run');
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
