/**
 * research/price-study.ts — walk-forward study: does weather information predict commodity
 * futures returns?
 *
 *   npx tsx research/price-study.ts            # fetch (cached) data, run study, write outputs
 *   npx tsx research/price-study.ts --offline  # use the cache only; fail on a cache miss
 *
 * Outputs: public/research/price-skill.json and docs/results/PRICE_STUDY.md.
 * Raw provider responses are aggregated to daily values before caching in research/cache/.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYahooDaily } from '../src/engine/forecastBacktest';
import {
  addDaysIso,
  barForWeekEnding,
  benjaminiHochberg,
  evaluateSkill,
  forecastRevision,
  forecastWindowValue,
  fridays,
  laggedWindowAnomaly,
  monthOf,
  neweyWestLag,
  olsHac,
  oracleWindowAnomaly,
  priorYearsNormal,
  sdSample,
  seasonGate,
  singleSineDegreeDays,
  walkForward,
  type DailySeries,
  type LeadSeries,
  type NormalSpec,
  type PriceBar,
  type SkillMetrics,
  type StudyRow,
} from '../src/engine/priceSkill';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = path.join(ROOT, 'research', 'cache');
const OFFLINE = process.argv.includes('--offline');

// ----------------------------------------------------------------------------
// Configuration (fixed ex ante; nothing below is tuned on out-of-sample results)
// ----------------------------------------------------------------------------

const TODAY = new Date().toISOString().slice(0, 10);
const CONFIG = {
  study: 'astraeus-weather-price-walkforward-v1',
  priceStart: '2004-06-01',
  era5Start: '2000-01-01',
  longTierFirstOrigin: '2005-01-07',
  forecastTierStart: '2024-03-01',
  forecastTierFirstOrigin: '2024-03-08',
  era5LagDays: 7,
  normal: { normalYears: 10, minYears: 5 },
  minTrainLong: 156,
  minTrainForecast: 52,
  lambdaPerObs: 0.1,
  horizonsWeeks: [1, 4],
  forecastDays: { first: 1, last: 6, leadOffset: 1, revisionDays: 5, revisionOldLead: 7 },
  bootstrap: { resamples: 1000, seed: 20261115 },
  degreeDayBaseC: 18,
  openMeteoWeightBudget: 2500,
};

const UA_OPEN_METEO = 'Astraeus-PriceStudy/1.0 (non-commercial research)';
const UA_YAHOO = 'Mozilla/5.0 (compatible; Astraeus-Research/1.0)';

// ----------------------------------------------------------------------------
// Points (representative coordinates from src/engine/commodityRegions.ts and
// commodityForecastEngine.ts; equal-weighted, NOT production-share weighted)
// ----------------------------------------------------------------------------

type Era5Var = 'temperature_2m_max' | 'temperature_2m_min' | 'temperature_2m_mean' | 'precipitation_sum';
interface Point { id: string; label: string; lat: number; lng: number; era5: Era5Var[]; forecast?: { models: string[]; vars: Array<'temperature_2m' | 'precipitation'> } }

const TRIPLE: Era5Var[] = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'];
const POINTS: Record<string, Point> = {
  iowa: { id: 'iowa', label: 'Iowa, US Corn Belt', lat: 42.03, lng: -93.62, era5: TRIPLE, forecast: { models: ['ecmwf_ifs025'], vars: ['temperature_2m', 'precipitation'] } },
  illinois: { id: 'illinois', label: 'Illinois, US', lat: 40.11, lng: -88.24, era5: TRIPLE, forecast: { models: ['ecmwf_ifs025'], vars: ['temperature_2m', 'precipitation'] } },
  nebraska: { id: 'nebraska', label: 'Nebraska, US', lat: 40.81, lng: -96.7, era5: TRIPLE },
  kansas: { id: 'kansas', label: 'Kansas, US Plains', lat: 38.84, lng: -97.61, era5: TRIPLE, forecast: { models: ['ecmwf_ifs025'], vars: ['temperature_2m', 'precipitation'] } },
  matoGrosso: { id: 'matoGrosso', label: 'Mato Grosso, Brazil', lat: -12.54, lng: -55.72, era5: ['precipitation_sum'] },
  beauce: { id: 'beauce', label: 'Beauce, France', lat: 48.45, lng: 1.49, era5: ['precipitation_sum'] },
  minas: { id: 'minas', label: 'Sul de Minas Gerais, Brazil', lat: -21.55, lng: -45.43, era5: ['temperature_2m_min', 'precipitation_sum'], forecast: { models: ['ecmwf_ifs025'], vars: ['temperature_2m', 'precipitation'] } },
  daloa: { id: 'daloa', label: 'Daloa, Côte d’Ivoire', lat: 6.88, lng: -6.45, era5: ['precipitation_sum'] },
  kumasi: { id: 'kumasi', label: 'Kumasi, Ghana', lat: 6.69, lng: -1.62, era5: ['precipitation_sum'] },
  chicago: { id: 'chicago', label: 'Chicago (Midwest gas demand)', lat: 41.88, lng: -87.63, era5: ['temperature_2m_mean'], forecast: { models: ['ecmwf_ifs025', 'gfs_seamless'], vars: ['temperature_2m'] } },
  newYork: { id: 'newYork', label: 'New York (Northeast gas demand)', lat: 40.71, lng: -74.01, era5: ['temperature_2m_mean'], forecast: { models: ['ecmwf_ifs025', 'gfs_seamless'], vars: ['temperature_2m'] } },
  boston: { id: 'boston', label: 'Boston (New England gas demand)', lat: 42.36, lng: -71.06, era5: ['temperature_2m_mean'], forecast: { models: ['ecmwf_ifs025', 'gfs_seamless'], vars: ['temperature_2m'] } },
  dallas: { id: 'dallas', label: 'Dallas (Texas gas/power demand)', lat: 32.78, lng: -96.8, era5: ['temperature_2m_mean'], forecast: { models: ['ecmwf_ifs025', 'gfs_seamless'], vars: ['temperature_2m'] } },
};

// ----------------------------------------------------------------------------
// HTTP: pacing (Open-Meteo weighted calls), bounded concurrency, retry, cache
// ----------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let weightUsed = 0;
let weightFetched = 0;
const recent: Array<{ at: number; w: number }> = [];
async function pace(w: number) {
  const PER_MINUTE = 350;
  for (;;) {
    const now = Date.now();
    while (recent.length && now - recent[0].at > 61_000) recent.shift();
    const sum = recent.reduce((a, r) => a + r.w, 0);
    if (!recent.length || sum + w <= PER_MINUTE) break;
    await sleep(Math.max(500, 61_000 - (now - recent[0].at)));
  }
  recent.push({ at: Date.now(), w });
}

let active = 0;
const queue: Array<() => void> = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

/** Open-Meteo documented weighting: >10 variables or >2 weeks of data count as multiple calls. */
function openMeteoWeight(nVars: number, nDays: number): number {
  return Math.max(1, (nVars / 10) * (nDays / 14));
}

async function fetchJson(url: string, ua: string, weight: number): Promise<any> {
  return limited(async () => {
    if (weight > 0) await pace(weight);
    const delays = [5_000, 15_000, 45_000, 90_000];
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { 'User-Agent': ua, Accept: 'application/json' }, signal: AbortSignal.timeout(60_000) }).catch((e) => e as Error);
      if (!(res instanceof Error) && res.ok) {
        weightFetched += weight;
        return res.json();
      }
      const status = res instanceof Error ? 0 : res.status;
      const body = res instanceof Error ? res.message : await res.text().catch(() => '');
      if (/daily|hourly/i.test(body) && status === 429) throw new Error(`Open-Meteo quota exhausted: ${body.slice(0, 200)}`);
      if (attempt >= delays.length || (status >= 400 && status < 500 && status !== 429)) throw new Error(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
      await sleep(delays[attempt]);
    }
  });
}

async function cachedJson<T>(kind: string, url: string, ua: string, weight: number, transform: (raw: any) => T): Promise<T> {
  const file = path.join(CACHE_DIR, `${kind}-${createHash('sha256').update(url).digest('hex').slice(0, 20)}.json`);
  weightUsed += weight;
  try {
    const hit = JSON.parse(await readFile(file, 'utf8'));
    if (hit.url === url) return hit.data as T;
  } catch {}
  if (OFFLINE) throw new Error(`Cache miss in --offline mode: ${url}`);
  const data = transform(await fetchJson(url, ua, weight));
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify({ url, fetchedAt: new Date().toISOString(), data }));
  return data;
}

// ----------------------------------------------------------------------------
// Data loaders
// ----------------------------------------------------------------------------

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;

/** Fixed calendar chunks so historical cache entries survive later reruns. */
function chunks(start: string, end: string, boundaries: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let a = start;
  for (const b of [...boundaries.filter((x) => x > start && x <= end), addDaysIso(end, 1)]) {
    out.push([a, addDaysIso(b, -1)]);
    a = b;
  }
  return out.filter(([x, y]) => x <= y);
}

type DailyBlock = Record<string, Record<string, number>>; // var → date → value

async function loadEra5(p: Point, end: string): Promise<Record<Era5Var, DailySeries>> {
  const bounds = ['2005-01-01', '2010-01-01', '2015-01-01', '2020-01-01', '2025-01-01'];
  const out = Object.fromEntries(p.era5.map((v) => [v, new Map<string, number>()])) as Record<Era5Var, DailySeries>;
  for (const [a, b] of chunks(CONFIG.era5Start, end, bounds)) {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${p.lat}&longitude=${p.lng}&start_date=${a}&end_date=${b}&daily=${p.era5.join(',')}&models=era5&timezone=GMT`;
    const block = await cachedJson<DailyBlock>('era5', url, UA_OPEN_METEO, openMeteoWeight(p.era5.length, daysBetween(a, b)), (raw) => {
      const d = raw?.daily;
      if (!d?.time) throw new Error(`ERA5 response without daily data for ${p.id}`);
      const res: DailyBlock = {};
      for (const v of p.era5) {
        res[v] = {};
        d.time.forEach((t: string, i: number) => {
          const x = d[v]?.[i];
          if (typeof x === 'number' && Number.isFinite(x)) res[v][t] = x;
        });
      }
      return res;
    });
    for (const v of p.era5) for (const [d, x] of Object.entries(block[v] ?? {})) out[v].set(d, x);
  }
  return out;
}

/** lead → date → aggregate; aggregates are UTC-day tmax/tmin/tmean/precip from hourly values. */
type LeadBlock = Record<string, Record<string, { tmax?: number; tmin?: number; tmean?: number; precip?: number }>>;
const LEADS = [2, 3, 4, 5, 6, 7];

async function loadPreviousRuns(p: Point, model: string, end: string): Promise<LeadBlock> {
  const vars = p.forecast!.vars;
  const hourly = vars.flatMap((v) => LEADS.map((l) => `${v}_previous_day${l}`));
  const bounds = ['2024-09-01', '2025-03-01', '2025-09-01', '2026-03-01', '2026-09-01'];
  const merged: LeadBlock = {};
  for (const [a, b] of chunks(CONFIG.forecastTierStart, end, bounds)) {
    const url = `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&start_date=${a}&end_date=${b}&hourly=${hourly.join(',')}&models=${model}&timezone=GMT`;
    const block = await cachedJson<LeadBlock>('prevruns', url, UA_OPEN_METEO, openMeteoWeight(hourly.length, daysBetween(a, b)), (raw) => {
      const h = raw?.hourly;
      if (!h?.time) throw new Error(`Previous-runs response without hourly data for ${p.id}/${model}`);
      const series = (name: string): Array<number | null> => h[name] ?? h[`${name}_${model}`] ?? [];
      const res: LeadBlock = {};
      for (const lead of LEADS) {
        const t = series(`temperature_2m_previous_day${lead}`);
        const pr = series(`precipitation_previous_day${lead}`);
        const byDay = new Map<string, { t: number[]; p: number[] }>();
        h.time.forEach((ts: string, i: number) => {
          const day = ts.slice(0, 10);
          const e = byDay.get(day) ?? { t: [], p: [] };
          if (typeof t[i] === 'number') e.t.push(t[i] as number);
          if (typeof pr[i] === 'number') e.p.push(pr[i] as number);
          byDay.set(day, e);
        });
        res[lead] = {};
        for (const [day, e] of byDay) {
          const agg: { tmax?: number; tmin?: number; tmean?: number; precip?: number } = {};
          if (vars.includes('temperature_2m') && e.t.length >= 20) {
            agg.tmax = Math.max(...e.t);
            agg.tmin = Math.min(...e.t);
            agg.tmean = e.t.reduce((x, y) => x + y, 0) / e.t.length;
          }
          if (vars.includes('precipitation') && e.p.length === 24) agg.precip = e.p.reduce((x, y) => x + y, 0);
          if (Object.keys(agg).length) res[lead][day] = agg;
        }
      }
      return res;
    });
    for (const [lead, days] of Object.entries(block)) merged[lead] = { ...(merged[lead] ?? {}), ...days };
  }
  return merged;
}

async function loadPrices(symbol: string, end: string): Promise<PriceBar[]> {
  const p1 = Math.floor(Date.parse(`${CONFIG.priceStart}T00:00:00Z`) / 1000);
  const p2 = Math.floor(Date.parse(`${end}T23:59:59Z`) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;
  return cachedJson<PriceBar[]>('yahoo', url, UA_YAHOO, 0, (raw) => parseYahooDaily(raw, symbol).map((b) => ({ date: b.date, close: b.close })));
}

// ----------------------------------------------------------------------------
// Derived daily series
// ----------------------------------------------------------------------------

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
/** Equal-weight average across series; a date is kept only when every series has it. */
function averageSeries(list: DailySeries[]): DailySeries {
  const out: DailySeries = new Map();
  for (const [d, v] of list[0]) {
    const vals = [v];
    for (const s of list.slice(1)) {
      const x = s.get(d);
      if (x === undefined) break;
      vals.push(x);
    }
    if (vals.length === list.length) out.set(d, mean(vals));
  }
  return out;
}
function combine(a: DailySeries, b: DailySeries, fn: (x: number, y: number) => number): DailySeries {
  const out: DailySeries = new Map();
  for (const [d, x] of a) {
    const y = b.get(d);
    if (y !== undefined) out.set(d, fn(x, y));
  }
  return out;
}
const mapSeries = (a: DailySeries, fn: (x: number) => number): DailySeries => new Map([...a].map(([d, x]) => [d, fn(x)]));

type Quantity = 'edd29' | 'edd30' | 'precip' | 'cold6' | 'dd18';
const BASE = CONFIG.degreeDayBaseC;

function eraQuantity(era: Record<string, Record<Era5Var, DailySeries>>, pointIds: string[], q: Quantity): DailySeries {
  const per = pointIds.map((id) => {
    const e = era[id];
    switch (q) {
      case 'edd29': return combine(e.temperature_2m_min, e.temperature_2m_max, (mn, mx) => singleSineDegreeDays(mn, mx, 29));
      case 'edd30': return combine(e.temperature_2m_min, e.temperature_2m_max, (mn, mx) => singleSineDegreeDays(mn, mx, 30));
      case 'precip': return e.precipitation_sum;
      case 'cold6': return mapSeries(e.temperature_2m_min, (t) => Math.max(0, 6 - t));
      case 'dd18': return mapSeries(e.temperature_2m_mean, (t) => Math.abs(t - BASE));
    }
  });
  return averageSeries(per);
}

type PrevRuns = Record<string, Record<string, LeadBlock>>; // point → model → block

function forecastQuantity(prev: PrevRuns, pointIds: string[], q: Quantity): LeadSeries {
  const out: LeadSeries = new Map();
  for (const lead of LEADS) {
    const per: DailySeries[] = [];
    for (const id of pointIds) {
      for (const [, block] of Object.entries(prev[id] ?? {})) {
        const days = block[lead] ?? {};
        const s: DailySeries = new Map();
        for (const [d, a] of Object.entries(days)) {
          let v: number | undefined;
          if (q === 'edd29' && a.tmin !== undefined && a.tmax !== undefined) v = singleSineDegreeDays(a.tmin, a.tmax, 29);
          else if (q === 'edd30' && a.tmin !== undefined && a.tmax !== undefined) v = singleSineDegreeDays(a.tmin, a.tmax, 30);
          else if (q === 'precip') v = a.precip;
          else if (q === 'cold6' && a.tmin !== undefined) v = Math.max(0, 6 - a.tmin);
          else if (q === 'dd18' && a.tmean !== undefined) v = Math.abs(a.tmean - BASE);
          if (v !== undefined && Number.isFinite(v)) s.set(d, v);
        }
        per.push(s);
      }
    }
    out.set(lead, per.length ? averageSeries(per) : new Map());
  }
  return out;
}

// ----------------------------------------------------------------------------
// Study design per commodity
// ----------------------------------------------------------------------------

interface FeatureDef {
  key: string;
  label: string;
  quantity: Quantity;
  points: string[];
  agg: 'sum' | 'mean';
  windowDays: number;
  months: number[] | null;
  sdFloor: number;
  /** Included in the NWP forecast tier (requires previous-runs data at all points). */
  forecast: boolean;
}
interface CommodityStudy {
  id: string;
  name: string;
  symbol: string;
  rationale: string;
  features: FeatureDef[];
}

const JJA = [6, 7, 8];
const STUDIES: CommodityStudy[] = [
  {
    id: 'corn', name: 'Corn', symbol: 'ZC=F',
    rationale: 'US Corn Belt summer heat (extreme degree-days above 29 °C, Schlenker & Roberts 2009) and rainfall around pollination/grain fill.',
    features: [
      { key: 'edd29', label: 'Extreme degree-days >29 °C (7-day)', quantity: 'edd29', points: ['iowa', 'illinois', 'nebraska'], agg: 'sum', windowDays: 7, months: JJA, sdFloor: 1, forecast: false },
      { key: 'precip', label: 'Precipitation (28-day)', quantity: 'precip', points: ['iowa', 'illinois', 'nebraska'], agg: 'sum', windowDays: 28, months: JJA, sdFloor: 5, forecast: false },
      { key: 'edd29_fc', label: 'Extreme degree-days >29 °C', quantity: 'edd29', points: ['iowa', 'illinois'], agg: 'sum', windowDays: 7, months: JJA, sdFloor: 1, forecast: true },
      { key: 'precip_fc', label: 'Precipitation', quantity: 'precip', points: ['iowa', 'illinois'], agg: 'sum', windowDays: 7, months: JJA, sdFloor: 3, forecast: true },
    ],
  },
  {
    id: 'soybeans', name: 'Soybeans', symbol: 'ZS=F',
    rationale: 'US July–August heat (>30 °C degree-days) and rainfall during pod set; Mato Grosso rainy-season rainfall (Nov–Feb).',
    features: [
      { key: 'edd30', label: 'Extreme degree-days >30 °C (7-day, US)', quantity: 'edd30', points: ['iowa', 'illinois'], agg: 'sum', windowDays: 7, months: [7, 8], sdFloor: 1, forecast: false },
      { key: 'precip_us', label: 'Precipitation (28-day, US)', quantity: 'precip', points: ['iowa', 'illinois'], agg: 'sum', windowDays: 28, months: [7, 8], sdFloor: 5, forecast: false },
      { key: 'precip_mt', label: 'Precipitation (28-day, Mato Grosso)', quantity: 'precip', points: ['matoGrosso'], agg: 'sum', windowDays: 28, months: [11, 12, 1, 2], sdFloor: 10, forecast: false },
      { key: 'edd30_fc', label: 'Extreme degree-days >30 °C (US)', quantity: 'edd30', points: ['iowa', 'illinois'], agg: 'sum', windowDays: 7, months: [7, 8], sdFloor: 1, forecast: true },
      { key: 'precip_fc', label: 'Precipitation (US)', quantity: 'precip', points: ['iowa', 'illinois'], agg: 'sum', windowDays: 7, months: [7, 8], sdFloor: 3, forecast: true },
    ],
  },
  {
    id: 'wheat', name: 'Wheat (Chicago SRW)', symbol: 'ZW=F',
    rationale: 'Kansas spring rainfall and May–June heat during grain fill; Beauce (France) spring rainfall. Kansas is a hard-red-winter region, a proxy for the SRW contract.',
    features: [
      { key: 'precip_ks', label: 'Precipitation (28-day, Kansas)', quantity: 'precip', points: ['kansas'], agg: 'sum', windowDays: 28, months: [3, 4, 5, 6], sdFloor: 5, forecast: false },
      { key: 'edd30_ks', label: 'Extreme degree-days >30 °C (7-day, Kansas)', quantity: 'edd30', points: ['kansas'], agg: 'sum', windowDays: 7, months: [5, 6], sdFloor: 1, forecast: false },
      { key: 'precip_fr', label: 'Precipitation (28-day, Beauce)', quantity: 'precip', points: ['beauce'], agg: 'sum', windowDays: 28, months: [4, 5, 6], sdFloor: 5, forecast: false },
      { key: 'precip_ks_fc', label: 'Precipitation (Kansas)', quantity: 'precip', points: ['kansas'], agg: 'sum', windowDays: 7, months: [3, 4, 5, 6], sdFloor: 3, forecast: true },
      { key: 'edd30_ks_fc', label: 'Extreme degree-days >30 °C (Kansas)', quantity: 'edd30', points: ['kansas'], agg: 'sum', windowDays: 7, months: [5, 6], sdFloor: 1, forecast: true },
    ],
  },
  {
    id: 'coffee', name: 'Arabica coffee', symbol: 'KC=F',
    rationale: 'Sul de Minas winter cold (frost risk, May–Sep) and rainfall during flowering/fruit set (Sep–Mar).',
    features: [
      { key: 'cold6', label: 'Cold degree-days below 6 °C Tmin (7-day)', quantity: 'cold6', points: ['minas'], agg: 'sum', windowDays: 7, months: [5, 6, 7, 8, 9], sdFloor: 0.5, forecast: false },
      { key: 'precip', label: 'Precipitation (28-day)', quantity: 'precip', points: ['minas'], agg: 'sum', windowDays: 28, months: [9, 10, 11, 12, 1, 2, 3], sdFloor: 10, forecast: false },
      { key: 'cold6_fc', label: 'Cold degree-days below 6 °C Tmin', quantity: 'cold6', points: ['minas'], agg: 'sum', windowDays: 7, months: [5, 6, 7, 8, 9], sdFloor: 0.5, forecast: true },
      { key: 'precip_fc', label: 'Precipitation', quantity: 'precip', points: ['minas'], agg: 'sum', windowDays: 7, months: [9, 10, 11, 12, 1, 2, 3], sdFloor: 3, forecast: true },
    ],
  },
  {
    id: 'natural-gas', name: 'Natural gas (Henry Hub)', symbol: 'NG=F',
    rationale: 'Heating + cooling degree-days (base 18 °C) at four US demand centres; NWP forecast level and week-on-week forecast revision (Mu 2007).',
    features: [
      { key: 'dd18', label: 'HDD+CDD base 18 °C (7-day)', quantity: 'dd18', points: ['chicago', 'newYork', 'boston', 'dallas'], agg: 'sum', windowDays: 7, months: null, sdFloor: 2, forecast: false },
      { key: 'dd18_fc', label: 'HDD+CDD base 18 °C', quantity: 'dd18', points: ['chicago', 'newYork', 'boston', 'dallas'], agg: 'sum', windowDays: 7, months: null, sdFloor: 2, forecast: true },
    ],
  },
  {
    id: 'cocoa', name: 'Cocoa', symbol: 'CC=F',
    rationale: 'West African (Côte d’Ivoire, Ghana) 28-day rainfall anomaly, all year. Long tier only.',
    features: [{ key: 'precip', label: 'Precipitation (28-day, Daloa + Kumasi)', quantity: 'precip', points: ['daloa', 'kumasi'], agg: 'sum', windowDays: 28, months: null, sdFloor: 10, forecast: false }],
  },
];

type Tier = 'REALISED_LAGGED' | 'ORACLE_TARGET_WINDOW' | 'NWP_FORECAST';

// ----------------------------------------------------------------------------
// Row construction
// ----------------------------------------------------------------------------

interface WeeklyPoint { friday: string; bar: PriceBar }

function weeklyPoints(bars: PriceBar[], lastDate: string): WeeklyPoint[] {
  return fridays(bars[0].date, lastDate).flatMap((f) => {
    const bar = barForWeekEnding(bars, f);
    return bar ? [{ friday: f, bar }] : [];
  });
}

function marketFeatures(bars: PriceBar[], friday: string): number[] | null {
  const closes: number[] = [];
  for (let k = 0; k <= 12; k++) {
    const b = barForWeekEnding(bars, addDaysIso(friday, -7 * k));
    if (!b) return null;
    closes.push(b.close);
  }
  const rets = closes.slice(0, 12).map((c, i) => Math.log(c / closes[i + 1]));
  return [rets[0], Math.log(closes[0] / closes[4]), sdSample(rets)];
}

interface Built { rows: StudyRow[]; featureLabels: string[] }

function buildRows(
  study: CommodityStudy,
  tier: Tier,
  horizon: number,
  bars: PriceBar[],
  eraQ: Map<string, DailySeries>,
  fcQ: Map<string, LeadSeries>,
): Built {
  const spec = (f: FeatureDef): NormalSpec => ({ ...CONFIG.normal, sdFloor: f.sdFloor });
  const feats = study.features.filter((f) => (tier === 'NWP_FORECAST' ? f.forecast : !f.forecast));
  const labels =
    tier === 'NWP_FORECAST' ? feats.flatMap((f) => [`${f.label}: forecast anomaly (days +1…+6)`, `${f.label}: forecast revision (lead k+1 minus lead 7)`]) : feats.map((f) => f.label);
  const first = tier === 'NWP_FORECAST' ? CONFIG.forecastTierFirstOrigin : CONFIG.longTierFirstOrigin;
  const rows: StudyRow[] = [];
  for (const wp of weeklyPoints(bars, bars[bars.length - 1].date)) {
    if (wp.friday < first) continue;
    const end = barForWeekEnding(bars, addDaysIso(wp.friday, 7 * horizon));
    if (!end || end.date <= wp.bar.date) continue;
    const market = marketFeatures(bars, wp.friday);
    if (!market) continue;
    const origin = wp.bar.date;
    const month = monthOf(origin);
    const weather: number[] = [];
    let ok = true;
    for (const f of feats) {
      const series = eraQ.get(f.key)!;
      if (tier === 'REALISED_LAGGED') {
        const a = laggedWindowAnomaly(series, origin, CONFIG.era5LagDays, f.windowDays, f.agg, spec(f));
        if (!a) { ok = false; break; }
        weather.push(seasonGate(a.z, month, f.months));
      } else if (tier === 'ORACLE_TARGET_WINDOW') {
        const a = oracleWindowAnomaly(series, origin, 7 * horizon, f.agg, spec(f));
        if (!a) { ok = false; break; }
        weather.push(seasonGate(a.z, month, f.months));
      } else {
        const lead = fcQ.get(f.key)!;
        const { first: d1, last: d2, leadOffset, revisionDays, revisionOldLead } = CONFIG.forecastDays;
        const value = forecastWindowValue(lead, origin, d1, d2, f.agg, leadOffset);
        const normal = priorYearsNormal(series, addDaysIso(origin, d2), d2 - d1 + 1, f.agg, spec(f));
        const rev = forecastRevision(lead, origin, revisionDays, revisionOldLead, leadOffset);
        if (value === null || !normal || rev === null) { ok = false; break; }
        weather.push(seasonGate((value - normal.mean) / normal.sd, month, f.months), seasonGate(rev, month, f.months));
      }
    }
    if (!ok) continue;
    rows.push({ origin, labelDate: end.date, y: Math.log(end.close / wp.bar.close), market, weather });
  }
  return { rows, featureLabels: labels };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

interface ResultRow {
  commodity: string;
  name: string;
  symbol: string;
  tier: Tier;
  horizonWeeks: number;
  features: string[];
  nRows: number;
  metrics: SkillMetrics | null;
  /** In-sample, full-sample OLS of returns on standardised weather features (HAC t-stats). Descriptive only. */
  sensitivity: Array<{ feature: string; pctReturnPerSd: number; t: number; p: number }> | null;
  qCwWxVsMkt: number | null;
  qDmWxVsRw: number | null;
}

const fmt = (x: number | null | undefined, d = 3) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d));
const fmtP = (x: number | null | undefined) => (x === null || x === undefined ? '—' : x < 0.001 ? '<0.001' : x.toFixed(3));

async function main() {
  const end = addDaysIso(TODAY, -1);
  // Budget check before any request.
  const era5Weight = Object.values(POINTS).reduce((a, p) => a + chunks(CONFIG.era5Start, end, ['2005-01-01', '2010-01-01', '2015-01-01', '2020-01-01', '2025-01-01']).reduce((s, [x, y]) => s + openMeteoWeight(p.era5.length, daysBetween(x, y)), 0), 0);
  const prevWeight = Object.values(POINTS).filter((p) => p.forecast).reduce((a, p) => a + p.forecast!.models.length * chunks(CONFIG.forecastTierStart, end, ['2024-09-01', '2025-03-01', '2025-09-01', '2026-03-01', '2026-09-01']).reduce((s, [x, y]) => s + openMeteoWeight(p.forecast!.vars.length * LEADS.length, daysBetween(x, y)), 0), 0);
  console.log(`Estimated Open-Meteo weight: ERA5 ${era5Weight.toFixed(0)} + previous runs ${prevWeight.toFixed(0)} = ${(era5Weight + prevWeight).toFixed(0)} (budget ${CONFIG.openMeteoWeightBudget})`);
  if (era5Weight + prevWeight > CONFIG.openMeteoWeightBudget) throw new Error('Planned Open-Meteo usage exceeds the budget.');

  const era: Record<string, Record<Era5Var, DailySeries>> = {};
  for (const p of Object.values(POINTS)) {
    era[p.id] = await loadEra5(p, end);
    console.log(`ERA5 ${p.id}: ${[...Object.values(era[p.id])[0].keys()].length} days`);
  }
  const prev: PrevRuns = {};
  for (const p of Object.values(POINTS).filter((x) => x.forecast)) {
    prev[p.id] = {};
    for (const m of p.forecast!.models) {
      prev[p.id][m] = await loadPreviousRuns(p, m, end);
      console.log(`Previous runs ${p.id}/${m}: lead-2 days ${Object.keys(prev[p.id][m]['2'] ?? {}).length}`);
    }
  }
  const prices: Record<string, PriceBar[]> = {};
  for (const s of STUDIES) {
    prices[s.symbol] = await loadPrices(s.symbol, end);
    console.log(`Prices ${s.symbol}: ${prices[s.symbol].length} sessions ${prices[s.symbol][0].date}…${prices[s.symbol].at(-1)!.date}`);
  }

  const results: ResultRow[] = [];
  const coverage: Record<string, unknown> = {};
  for (const study of STUDIES) {
    const eraQ = new Map(study.features.map((f) => [f.key, eraQuantity(era, f.points, f.quantity)]));
    const fcQ = new Map(study.features.filter((f) => f.forecast).map((f) => [f.key, forecastQuantity(prev, f.points, f.quantity)]));
    const tiers: Tier[] = study.features.some((f) => f.forecast) ? ['REALISED_LAGGED', 'ORACLE_TARGET_WINDOW', 'NWP_FORECAST'] : ['REALISED_LAGGED', 'ORACLE_TARGET_WINDOW'];
    for (const tier of tiers) {
      for (const h of CONFIG.horizonsWeeks) {
        const { rows, featureLabels } = buildRows(study, tier, h, prices[study.symbol], eraQ, fcQ);
        const preds = walkForward(rows, { minTrain: tier === 'NWP_FORECAST' ? CONFIG.minTrainForecast : CONFIG.minTrainLong, lambdaPerObs: CONFIG.lambdaPerObs });
        const metrics = evaluateSkill(preds, h, CONFIG.bootstrap);
        let sensitivity: ResultRow['sensitivity'] = null;
        if (rows.length >= 30) {
          const W = rows.map((r) => r.weather);
          const sds = W[0].map((_, j) => sdSample(W.map((w) => w[j])));
          const keep = sds.map((s, j) => (s > 1e-9 ? j : -1)).filter((j) => j >= 0);
          if (keep.length) {
            const X = W.map((w) => keep.map((j) => w[j] / sds[j]));
            const reg = olsHac(X, rows.map((r) => r.y), neweyWestLag(rows.length, h));
            sensitivity = keep.map((j, i) => ({ feature: featureLabels[j], pctReturnPerSd: reg.coef[i + 1] * 100, t: reg.t[i + 1], p: reg.p[i + 1] }));
          }
        }
        results.push({ commodity: study.id, name: study.name, symbol: study.symbol, tier, horizonWeeks: h, features: featureLabels, nRows: rows.length, metrics, sensitivity, qCwWxVsMkt: null, qDmWxVsRw: null });
        console.log(`${study.id} ${tier} h=${h}: rows ${rows.length}, OOS ${metrics?.n ?? 0}, R2os(wx) ${fmt(metrics?.oosR2Wx, 4)}, CW p ${fmtP(metrics?.cwWxVsMkt?.p)}`);
      }
    }
    coverage[study.id] = { firstPrice: prices[study.symbol][0].date, lastPrice: prices[study.symbol].at(-1)!.date };
  }

  // Benjamini–Hochberg across the forecastable rows (lagged + NWP); the oracle tier is a separate descriptive family.
  for (const family of [['REALISED_LAGGED', 'NWP_FORECAST'], ['ORACLE_TARGET_WINDOW']] as Tier[][]) {
    const members = results.filter((r) => family.includes(r.tier));
    const qCw = benjaminiHochberg(members.map((r) => r.metrics?.cwWxVsMkt?.p ?? null));
    const qDm = benjaminiHochberg(members.map((r) => r.metrics?.dmWxVsRw?.p ?? null));
    members.forEach((r, i) => { r.qCwWxVsMkt = qCw[i]; r.qDmWxVsRw = qDm[i]; });
  }

  const inputsSha256 = createHash('sha256').update(JSON.stringify({ CONFIG, prices, era: Object.fromEntries(Object.entries(era).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([vk, s]) => [vk, [...s]]))])), prev })).digest('hex');
  const caveats = [
    'Continuous front-month (=F) Yahoo series contain roll jumps; weekly log returns are research proxies, not executable futures P&L.',
    'Yahoo Finance chart endpoint is unofficial and may revise or omit sessions.',
    'Weather points are equal-weighted representative coordinates, not production- or population-share weights.',
    'ERA5 is reanalysis (modelled), lagged 7 days to respect publication latency; the ORACLE tier deliberately uses future realised weather and is an upper bound, not a forecast.',
    'NWP tier uses Open-Meteo Previous Runs (from March 2024 only): ~2.7 years, so out-of-sample samples are small and crop features are active in only one or two seasons.',
    'NWP anomalies are measured against ERA5 climatology without model-bias correction; the ridge intercept absorbs only a constant bias.',
    'Many commodity × tier × horizon tests are run; Benjamini–Hochberg q-values are reported and should be used instead of raw p-values.',
    'Sensitivity coefficients are full-sample, in-sample descriptive regressions, not forecasts.',
    'No transaction costs, position sizing or trading rules are evaluated.',
  ];
  const json = {
    study: CONFIG.study,
    generatedAt: new Date().toISOString(),
    config: CONFIG,
    provenance: {
      prices: 'https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}?period1={unix}&period2={unix}&interval=1d (unofficial endpoint, daily closes)',
      era5: 'https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}&start_date={start}&end_date={end}&daily={vars}&models=era5&timezone=GMT',
      forecasts: 'https://previous-runs-api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&start_date={start}&end_date={end}&hourly={var}_previous_day{2..7}&models={ecmwf_ifs025|gfs_seamless}&timezone=GMT',
      points: Object.values(POINTS).map(({ id, label, lat, lng, era5, forecast }) => ({ id, label, lat, lng, era5, forecast: forecast ?? null })),
      coverage,
      dataEnd: end,
      inputsSha256,
      estimatedOpenMeteoWeight: Math.round(era5Weight + prevWeight),
      openMeteoWeightFetchedThisRun: Math.round(weightFetched),
    },
    commodities: STUDIES.map(({ id, name, symbol, rationale, features }) => ({ id, name, symbol, rationale, features })),
    models: {
      rw: 'Zero-return random walk (no-change price forecast).',
      hm: 'Expanding historical mean of realised training returns (Campbell–Thompson benchmark).',
      mkt: 'Ridge on market features: 1-week return, 4-week return, 12-week realised volatility.',
      wx: 'Ridge on market features + weather features for the tier (nests mkt).',
    },
    rows: results,
    caveats,
  };
  await mkdir(path.join(ROOT, 'public', 'research'), { recursive: true });
  await writeFile(path.join(ROOT, 'public', 'research', 'price-skill.json'), JSON.stringify(json, null, 1));
  await mkdir(path.join(ROOT, 'docs', 'results'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs', 'results', 'PRICE_STUDY.md'), renderMarkdown(json));
  console.log(`Wrote public/research/price-skill.json and docs/results/PRICE_STUDY.md (fetched weight this run ≈ ${weightFetched.toFixed(0)}, planned ${weightUsed.toFixed(0)}).`);
}

// ----------------------------------------------------------------------------
// Markdown report
// ----------------------------------------------------------------------------

const TIER_LABEL: Record<Tier, string> = {
  REALISED_LAGGED: 'Realised ERA5, 7-day lag',
  ORACLE_TARGET_WINDOW: 'ORACLE (future weather)',
  NWP_FORECAST: 'NWP forecast + revision',
};

function renderMarkdown(json: any): string {
  const rows: ResultRow[] = json.rows;
  const table = (filter: (r: ResultRow) => boolean) =>
    [
      '| Commodity | Tier | h (wk) | OOS n | OOS window | R²os wx | 95% CI | R²os mkt | RMSE wx/RW | DM p (wx<RW) | q | CW p (wx>mkt) | q | Hit wx | Up-rate | PT p |',
      '|---|---|---:|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
      ...rows.filter(filter).map((r) => {
        const m = r.metrics;
        if (!m) return `| ${r.name} | ${TIER_LABEL[r.tier]} | ${r.horizonWeeks} | 0 | — | — | — | — | — | — | — | — | — | — | — | — |`;
        return `| ${r.name} | ${TIER_LABEL[r.tier]} | ${r.horizonWeeks} | ${m.n} | ${m.oosStart}…${m.oosEnd} | ${fmt(m.oosR2Wx * 100, 2)}% | [${fmt(m.oosR2WxCi95.lo * 100, 1)}, ${fmt(m.oosR2WxCi95.hi * 100, 1)}]% | ${fmt(m.oosR2Mkt * 100, 2)}% | ${fmt(m.rmseRatioWxVsRw, 3)} | ${fmtP(m.dmWxVsRw?.p)} | ${fmtP(r.qDmWxVsRw)} | ${fmtP(m.cwWxVsMkt?.p)} | ${fmtP(r.qCwWxVsMkt)} | ${fmt(m.hitRateWx * 100, 1)}% | ${fmt(m.baseRateUp * 100, 1)}% | ${fmtP(m.ptWx?.p)} |`;
      }),
    ].join('\n');
  const sens = rows
    .filter((r) => r.sensitivity && r.horizonWeeks === 1)
    .flatMap((r) => r.sensitivity!.map((s) => `| ${r.name} | ${TIER_LABEL[r.tier]} | ${s.feature} | ${fmt(s.pctReturnPerSd, 3)} | ${fmt(s.t, 2)} | ${fmtP(s.p)} |`));
  const sig = rows.filter((r) => r.tier !== 'ORACLE_TARGET_WINDOW' && r.qCwWxVsMkt !== null && r.qCwWxVsMkt < 0.1);
  return `# Does weather information predict commodity futures returns?

*Astraeus price study (\`${json.study}\`). Generated ${json.generatedAt} from \`npx tsx research/price-study.ts\`. Machine-readable results: \`public/research/price-skill.json\`.*

## Question

Weather shocks move agricultural and energy supply and demand, and futures prices react to weather news (Roll 1984; Roberts & Schlenker 2013; Mu 2007). The forecasting question is narrower: **given only information available at the close on Friday, do weather variables improve out-of-sample forecasts of the next 1-week or 4-week futures return** relative to (i) a no-change random walk, (ii) the expanding historical mean, and (iii) a market-only model?

## Design

- **Instruments:** ${json.commodities.map((c: any) => `${c.name} (${c.symbol})`).join(', ')}. Daily closes from the Yahoo Finance chart endpoint, continuous front-month series, sampled at the last session of each Friday-ending week. Target: log return from origin close to the close ${'h'} weeks later.
- **Weather:** ERA5 reanalysis (Hersbach et al. 2020) daily values via Open-Meteo at representative production or demand coordinates (equal-weighted). Extreme degree-days use single-sine within-day interpolation (Baskerville & Emin 1969) above 29 °C (corn) / 30 °C (soybeans, wheat), following the non-linear yield response in Schlenker & Roberts (2009). Natural gas uses heating + cooling degree-days at base 18 °C. Anomalies are standardised against the same calendar window in up to 10 **prior** years (minimum 5). Crop features are season-gated (zero outside the stated months).
- **Three information sets (tiers):**
  1. **Realised, lagged** (${json.config.longTierFirstOrigin} onward): ERA5 windows ending ${json.config.era5LagDays} days before the origin (ERA5 publication latency is about five days). Tradable information.
  2. **ORACLE** (same period): realised ERA5 over the *target* window (origin + 1 … origin + 7h days). This is look-ahead **by design**: it measures how much of the return a perfect weather forecast could explain, an upper bound for any forecast-based signal. It is not a forecast and is never mixed into the forecastable family.
  3. **NWP forecast** (${json.config.forecastTierFirstOrigin} onward): ECMWF IFS (and GFS for natural gas) archived forecasts from the Open-Meteo Previous Runs API. Features are the anomaly of days +1…+6 taken from runs initialised at least one day before the origin (lead k+1 for day k), and the forecast revision (newest admissible lead minus the lead-7 forecast for the same target days).
- **Models:** RW (zero return); HM (expanding historical mean); MKT (ridge on 1-week return, 4-week return and 12-week realised volatility); WX (MKT + tier weather features, nesting MKT). Ridge penalty λ = ${json.config.lambdaPerObs} × n_train on standardised predictors, fixed ex ante. Predictors are standardised with training-window statistics only.
- **Walk-forward:** expanding window refit every week; a training example is admissible only once its target return is fully realised before the origin, so overlapping 4-week targets cannot leak. Minimum training: ${json.config.minTrainLong} weeks (long tiers), ${json.config.minTrainForecast} weeks (NWP tier).
- **Evaluation:** out-of-sample R² vs HM (Campbell & Thompson 2008); RMSE ratio vs RW; Diebold–Mariano (1995) test of WX vs RW with Newey–West HAC variance and the Harvey, Leybourne & Newbold (1997) correction; Clark & West (2007) test of WX vs nested MKT (the primary test of whether weather adds information); Pesaran & Timmermann (1992) directional test; circular moving-block bootstrap 95% interval for R²os (${json.config.bootstrap.resamples} resamples, seed ${json.config.bootstrap.seed}). All p-values are one-sided (H1: the weather model is better). **Benjamini & Hochberg (1995) q-values** are computed across the forecastable family (lagged + NWP rows) and separately for the oracle family.

## Results — forecastable information

${table((r) => r.tier !== 'ORACLE_TARGET_WINDOW')}

## Results — ORACLE upper bound (not a forecast)

${table((r) => r.tier === 'ORACLE_TARGET_WINDOW')}

## Contemporaneous and lagged sensitivity (in-sample, descriptive, 1-week horizon)

Full-sample OLS of weekly log returns on season-gated, standardised weather features, with Newey–West HAC t-statistics. Coefficients are % return per one-standard-deviation anomaly. This describes association, not forecast skill.

| Commodity | Tier | Feature | % return per SD | HAC t | p (two-sided) |
|---|---|---|---:|---:|---:|
${sens.join('\n')}

## Interpretation

${interpretation(rows, sig)}

## Limitations

${json.caveats.map((c: string) => `- ${c}`).join('\n')}

## Reproduce

\`\`\`bash
npx tsx research/price-study.ts            # fetches missing data into research/cache/ (gitignored)
npx tsx research/price-study.ts --offline  # reruns from cache only
npx tsx --test src/engine/priceSkill.test.ts
\`\`\`

Provider URL patterns, coordinates, the configuration and a SHA-256 of all inputs (\`${json.provenance.inputsSha256.slice(0, 16)}…\`) are stored in \`public/research/price-skill.json\`.

## References

${REFERENCES.map((r) => `- ${r}`).join('\n')}
`;
}

function interpretation(rows: ResultRow[], sig: ResultRow[]): string {
  const forecastable = rows.filter((r) => r.tier !== 'ORACLE_TARGET_WINDOW' && r.metrics);
  const oracle = rows.filter((r) => r.tier === 'ORACLE_TARGET_WINDOW' && r.metrics);
  const posR2 = forecastable.filter((r) => r.metrics!.oosR2Wx > 0).length;
  const oracleBest = [...oracle].sort((a, b) => b.metrics!.oosR2Wx - a.metrics!.oosR2Wx).slice(0, 3);
  const lines = [
    `- Forecastable rows with positive out-of-sample R² for the weather model: **${posR2} of ${forecastable.length}**.`,
    sig.length
      ? `- Rows where weather adds information over the market-only model after Benjamini–Hochberg control (Clark–West q < 0.10): ${sig.map((r) => `${r.name} / ${TIER_LABEL[r.tier]} / ${r.horizonWeeks}w (q = ${fmtP(r.qCwWxVsMkt)})`).join('; ')}.`
      : '- **No forecastable row survives Benjamini–Hochberg control at q < 0.10** for the Clark–West test of weather over the market-only model.',
    `- ORACLE rows with the highest R²os: ${oracleBest.map((r) => `${r.name} ${r.horizonWeeks}w ${fmt(r.metrics!.oosR2Wx * 100, 2)}%`).join(', ')}. The gap between the oracle and the forecastable tiers bounds what better weather forecasts could add under this linear, equal-weighted design.`,
    '- Realised weather that is already a week old is public information when it is used; an efficient market should already price it, so a null result in that tier is the expected outcome rather than a failure of the method.',
    '- The NWP tier covers only about 2.7 years, so its confidence intervals are wide. Treat its point estimates as exploratory until more archived forecasts accumulate.',
  ];
  return lines.join('\n');
}

/** DOIs verified against the Crossref API (Nov 2026). Roll (1984) predates DOI registration for AER. */
const REFERENCES: string[] = [
  'Baskerville, G. L., & Emin, P. (1969). Rapid estimation of heat accumulation from maximum and minimum temperatures. *Ecology*, 50(3), 514–517. https://doi.org/10.2307/1933912',
  'Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate: A practical and powerful approach to multiple testing. *Journal of the Royal Statistical Society: Series B*, 57(1), 289–300. https://doi.org/10.1111/j.2517-6161.1995.tb02031.x',
  'Boudoukh, J., Richardson, M., Shen, Y., & Whitelaw, R. F. (2007). Do asset prices reflect fundamentals? Freshly squeezed evidence from the OJ market. *Journal of Financial Economics*, 83(2), 397–412. https://doi.org/10.1016/j.jfineco.2004.06.017',
  'Campbell, J. Y., & Thompson, S. B. (2008). Predicting excess stock returns out of sample: Can anything beat the historical average? *Review of Financial Studies*, 21(4), 1509–1531. https://doi.org/10.1093/rfs/hhm055',
  'Clark, T. E., & West, K. D. (2007). Approximately normal tests for equal predictive accuracy in nested models. *Journal of Econometrics*, 138(1), 291–311. https://doi.org/10.1016/j.jeconom.2006.05.023',
  'Diebold, F. X., & Mariano, R. S. (1995). Comparing predictive accuracy. *Journal of Business & Economic Statistics*, 13(3), 253–263. https://doi.org/10.1080/07350015.1995.10524599',
  'Harvey, D., Leybourne, S., & Newbold, P. (1997). Testing the equality of prediction mean squared errors. *International Journal of Forecasting*, 13(2), 281–291. https://doi.org/10.1016/S0169-2070(96)00719-4',
  'Hersbach, H., Bell, B., Berrisford, P., et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society*, 146(730), 1999–2049. https://doi.org/10.1002/qj.3803',
  'Künsch, H. R. (1989). The jackknife and the bootstrap for general stationary observations. *Annals of Statistics*, 17(3), 1217–1241. https://doi.org/10.1214/aos/1176347265',
  'Mu, X. (2007). Weather, storage, and natural gas price dynamics: Fundamentals and volatility. *Energy Economics*, 29(1), 46–63. https://doi.org/10.1016/j.eneco.2006.04.003',
  'Newey, W. K., & West, K. D. (1987). A simple, positive semi-definite, heteroskedasticity and autocorrelation consistent covariance matrix. *Econometrica*, 55(3), 703–708. https://doi.org/10.2307/1913610',
  'Newey, W. K., & West, K. D. (1994). Automatic lag selection in covariance matrix estimation. *Review of Economic Studies*, 61(4), 631–653. https://doi.org/10.2307/2297912',
  'Pesaran, M. H., & Timmermann, A. (1992). A simple nonparametric test of predictive performance. *Journal of Business & Economic Statistics*, 10(4), 461–465. https://doi.org/10.1080/07350015.1992.10509922',
  'Roberts, M. J., & Schlenker, W. (2013). Identifying supply and demand elasticities of agricultural commodities: Implications for the US ethanol mandate. *American Economic Review*, 103(6), 2265–2295. https://doi.org/10.1257/aer.103.6.2265',
  'Roll, R. (1984). Orange juice and weather. *American Economic Review*, 74(5), 861–880. (No DOI registered.)',
  'Schlenker, W., & Roberts, M. J. (2009). Nonlinear temperature effects indicate severe damages to U.S. crop yields under climate change. *Proceedings of the National Academy of Sciences*, 106(37), 15594–15598. https://doi.org/10.1073/pnas.0906865106',
];

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
