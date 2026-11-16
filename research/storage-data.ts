/**
 * research/storage-data.ts — cached data loaders shared by research/storage-study.ts and
 * research/price-revisions.ts.
 *
 * Every raw provider response is reduced to the values the studies use and cached under
 * research/cache/ (gitignored) keyed by the exact request URL, so reruns are offline and exact.
 * Open-Meteo usage is weighted with the provider's documented rule
 * (weight = nLocations × nDays/14 × nVariables/10, minimum 1 per request), paced, and the run stops
 * immediately on HTTP 429.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYahooDaily } from '../src/engine/forecastBacktest';
import { addDaysIso, type DailySeries, type PriceBar } from '../src/engine/priceSkill';
import { parseCpcDailyFile, parseEiaWeeklyHistoryHtml, type WeeklyLevel } from '../src/engine/storageSkill';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_DIR = path.join(ROOT, 'research', 'cache');
export const OFFLINE = process.argv.includes('--offline');

const UA_OPEN_METEO = 'Astraeus-StorageStudy/1.0 (non-commercial research)';
const UA_PUBLIC = 'Mozilla/5.0 (compatible; Astraeus-Research/1.0)';
export const LOCAL_TZ = 'America/Chicago';
export const LEADS = [1, 2, 3, 4, 5, 6, 7];

// ----------------------------------------------------------------------------
// Cities: one representative point per US census division (CPC region codes 1–9)
// ----------------------------------------------------------------------------

export interface City { id: string; label: string; division: string; divisionName: string; lat: number; lng: number }

/** Chosen near each division's gas-customer / population centre of mass, inland where possible. */
export const CITIES: City[] = [
  { id: 'worcester', label: 'Worcester, MA', division: '1', divisionName: 'New England', lat: 42.27, lng: -71.8 },
  { id: 'allentown', label: 'Allentown, PA', division: '2', divisionName: 'Middle Atlantic', lat: 40.6, lng: -75.49 },
  { id: 'fortWayne', label: 'Fort Wayne, IN', division: '3', divisionName: 'East North Central', lat: 41.08, lng: -85.14 },
  { id: 'desMoines', label: 'Des Moines, IA', division: '4', divisionName: 'West North Central', lat: 41.59, lng: -93.62 },
  { id: 'charlotte', label: 'Charlotte, NC', division: '5', divisionName: 'South Atlantic', lat: 35.23, lng: -80.84 },
  { id: 'nashville', label: 'Nashville, TN', division: '6', divisionName: 'East South Central', lat: 36.16, lng: -86.78 },
  { id: 'dallas', label: 'Dallas, TX', division: '7', divisionName: 'West South Central', lat: 32.78, lng: -96.8 },
  { id: 'denver', label: 'Denver, CO', division: '8', divisionName: 'Mountain', lat: 39.74, lng: -104.99 },
  { id: 'losAngeles', label: 'Los Angeles, CA', division: '9', divisionName: 'Pacific', lat: 34.05, lng: -118.24 },
];

// ----------------------------------------------------------------------------
// HTTP: pacing, budget accounting, cache
// ----------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const usage: { openMeteoPlanned: number; openMeteoFetched: number; publicFetches: number; lastOpenMeteoHeaders: Record<string, string> } = { openMeteoPlanned: 0, openMeteoFetched: 0, publicFetches: 0, lastOpenMeteoHeaders: {} };
const recent: Array<{ at: number; w: number }> = [];
async function pace(w: number) {
  const PER_MINUTE = 300;
  for (;;) {
    const now = Date.now();
    while (recent.length && now - recent[0].at > 61_000) recent.shift();
    const sum = recent.reduce((a, r) => a + r.w, 0);
    if (!recent.length || sum + w <= PER_MINUTE) break;
    await sleep(Math.max(500, 61_000 - (now - recent[0].at)));
  }
  recent.push({ at: Date.now(), w });
}

/** Open-Meteo documented weighting (one location). */
export function openMeteoWeight(nVars: number, nDays: number): number {
  return Math.max(1, (nVars / 10) * (nDays / 14));
}

async function fetchBody(url: string, ua: string, kind: 'json' | 'text', weight: number): Promise<any> {
  if (weight > 0) await pace(weight);
  else await sleep(700); // polite spacing for EIA / NOAA / Yahoo
  const delays = [5_000, 20_000];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(90_000) }).catch((e) => e as Error);
    if (!(res instanceof Error) && res.ok) {
      if (weight > 0) {
        usage.openMeteoFetched += weight;
        const h: Record<string, string> = {};
        res.headers.forEach((v, k) => { if (/ratelimit|weight|cost|quota|calls/i.test(k)) h[k] = v; });
        usage.lastOpenMeteoHeaders = h;
        if (process.env.STORAGE_LOG_HEADERS) console.log(`  [open-meteo] planned weight ${weight.toFixed(2)} headers ${JSON.stringify(h)}`);
      } else usage.publicFetches++;
      return kind === 'json' ? res.json() : res.text();
    }
    const status = res instanceof Error ? 0 : res.status;
    const body = res instanceof Error ? res.message : await res.text().catch(() => '');
    if (status === 429) throw new Error(`HTTP 429 (rate limit) for ${url}: ${body.slice(0, 200)} — stopping as instructed.`);
    if (attempt >= delays.length || (status >= 400 && status < 500)) throw new Error(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
    await sleep(delays[attempt]);
  }
}

export function cacheFile(kind: string, url: string): string {
  return path.join(CACHE_DIR, `${kind}-${createHash('sha256').update(url).digest('hex').slice(0, 20)}.json`);
}

export async function cached<T>(kind: string, url: string, opts: { ua: string; weight: number; body: 'json' | 'text' }, transform: (raw: any) => T): Promise<{ data: T; fetchedAt: string }> {
  const file = cacheFile(kind, url);
  usage.openMeteoPlanned += opts.weight;
  try {
    const hit = JSON.parse(await readFile(file, 'utf8'));
    if (hit.url === url) return { data: hit.data as T, fetchedAt: hit.fetchedAt };
  } catch {}
  if (OFFLINE) throw new Error(`Cache miss in --offline mode: ${url}`);
  const data = transform(await fetchBody(url, opts.ua, opts.body, opts.weight));
  const fetchedAt = new Date().toISOString();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify({ url, fetchedAt, data }));
  return { data, fetchedAt };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;

/** Fixed calendar chunks so cached history survives reruns with a later end date. */
export function chunks(start: string, end: string, boundaries: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let a = start;
  for (const b of [...boundaries.filter((x) => x > start && x <= end), addDaysIso(end, 1)]) {
    out.push([a, addDaysIso(b, -1)]);
    a = b;
  }
  return out.filter(([x, y]) => x <= y);
}

// ----------------------------------------------------------------------------
// EIA: Lower-48 working gas (dnav history table)
// ----------------------------------------------------------------------------

export const EIA_HISTORY_URL = 'https://www.eia.gov/dnav/ng/hist/nw2_epg0_swo_r48_bcfw.htm';

export async function loadEiaLevels(): Promise<{ levels: WeeklyLevel[]; fetchedAt: string }> {
  const r = await cached('eia', EIA_HISTORY_URL, { ua: UA_PUBLIC, weight: 0, body: 'text' }, (html: string) => parseEiaWeeklyHistoryHtml(html));
  return { levels: r.data, fetchedAt: r.fetchedAt };
}

// ----------------------------------------------------------------------------
// NOAA CPC daily weighted degree days (CONUS + census divisions)
// ----------------------------------------------------------------------------

export type CpcProduct = 'UtilityGas.Heating' | 'Population.Heating' | 'Population.Cooling';
export const cpcUrl = (year: number, product: CpcProduct) => `https://ftp.cpc.ncep.noaa.gov/htdocs/degree_days/weighted/daily_data/${year}/${product}.txt`;

/** region → date → degree days, for the given years. */
export async function loadCpc(product: CpcProduct, firstYear: number, lastYear: number): Promise<{ regions: Map<string, DailySeries>; fetchedAt: Record<number, string> }> {
  const regions = new Map<string, DailySeries>();
  const fetchedAt: Record<number, string> = {};
  for (let y = firstYear; y <= lastYear; y++) {
    const r = await cached('cpc', cpcUrl(y, product), { ua: UA_PUBLIC, weight: 0, body: 'text' }, (txt: string) => {
      const m = parseCpcDailyFile(txt);
      return Object.fromEntries([...m].map(([k, s]) => [k, Object.fromEntries(s)]));
    });
    fetchedAt[y] = r.fetchedAt;
    for (const [region, days] of Object.entries(r.data as Record<string, Record<string, number>>)) {
      const s = regions.get(region) ?? new Map<string, number>();
      for (const [d, v] of Object.entries(days)) s.set(d, v);
      regions.set(region, s);
    }
  }
  return { regions, fetchedAt };
}

// ----------------------------------------------------------------------------
// Open-Meteo: ERA5 hourly 2 m temperature → local-day max/min/mean (America/Chicago days)
// ----------------------------------------------------------------------------

export interface DayTemps { tmax: number; tmin: number; tmean: number; n: number }
type DayBlock = Record<string, DayTemps>;

function aggregateLocalDays(times: string[], values: Array<number | null>): DayBlock {
  const byDay = new Map<string, number[]>();
  times.forEach((ts, i) => {
    const v = values[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    const day = ts.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(v);
    byDay.set(day, arr);
  });
  const out: DayBlock = {};
  for (const [day, arr] of byDay) {
    if (arr.length < 20) continue; // local days have 23–25 hours; require near-complete coverage
    out[day] = { tmax: Math.max(...arr), tmin: Math.min(...arr), tmean: arr.reduce((a, b) => a + b, 0) / arr.length, n: arr.length };
  }
  return out;
}

export const ERA5_BOUNDS = ['2016-01-01', '2019-01-01', '2022-01-01', '2025-01-01', '2026-01-01'];
export const era5Url = (c: City, a: string, b: string) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${c.lat}&longitude=${c.lng}&start_date=${a}&end_date=${b}&hourly=temperature_2m&models=era5&timezone=${encodeURIComponent(LOCAL_TZ)}`;

export function era5Plan(start: string, end: string) {
  return chunks(start, end, ERA5_BOUNDS).map(([a, b]) => ({ a, b, weight: openMeteoWeight(1, daysBetween(a, b)) }));
}

export async function loadEra5(c: City, start: string, end: string): Promise<Map<string, DayTemps>> {
  const out = new Map<string, DayTemps>();
  for (const { a, b, weight } of era5Plan(start, end)) {
    const { data } = await cached<DayBlock>('era5h', era5Url(c, a, b), { ua: UA_OPEN_METEO, weight, body: 'json' }, (raw) => {
      if (!raw?.hourly?.time) throw new Error(`ERA5 response without hourly data for ${c.id}`);
      return aggregateLocalDays(raw.hourly.time, raw.hourly.temperature_2m ?? []);
    });
    for (const [d, v] of Object.entries(data)) out.set(d, v);
  }
  return out;
}

// ----------------------------------------------------------------------------
// Open-Meteo Previous Runs: hourly temperature_2m_previous_day{1..7} → local-day max/min per lead
// ----------------------------------------------------------------------------

export interface ForecastModel { id: string; label: string; archiveStart: string; bounds: string[] }
export const FORECAST_MODELS: ForecastModel[] = [
  { id: 'gfs_global', label: 'NOAA GFS', archiveStart: '2021-03-20', bounds: ['2021-09-01', '2022-03-01', '2022-09-01', '2023-03-01', '2023-09-01', '2024-03-01', '2024-09-01', '2025-03-01', '2025-09-01', '2026-03-01', '2026-09-01'] },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS 0.25°', archiveStart: '2024-02-01', bounds: ['2024-09-01', '2025-03-01', '2025-09-01', '2026-03-01', '2026-09-01'] },
];

export const prevRunsUrl = (c: City, model: string, a: string, b: string) =>
  `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&start_date=${a}&end_date=${b}&hourly=${LEADS.map((l) => `temperature_2m_previous_day${l}`).join(',')}&models=${model}&timezone=${encodeURIComponent(LOCAL_TZ)}`;

export function prevRunsPlan(m: ForecastModel, end: string) {
  return chunks(m.archiveStart, end, m.bounds).map(([a, b]) => ({ a, b, weight: openMeteoWeight(LEADS.length, daysBetween(a, b)) }));
}

/** lead → local date → day temperatures (°C). */
export type LeadTemps = Map<number, Map<string, DayTemps>>;

export async function loadPrevRuns(c: City, m: ForecastModel, end: string): Promise<LeadTemps> {
  const out: LeadTemps = new Map(LEADS.map((l) => [l, new Map<string, DayTemps>()]));
  for (const { a, b, weight } of prevRunsPlan(m, end)) {
    const { data } = await cached<Record<string, DayBlock>>('prevrunsh', prevRunsUrl(c, m.id, a, b), { ua: UA_OPEN_METEO, weight, body: 'json' }, (raw) => {
      const h = raw?.hourly;
      if (!h?.time) throw new Error(`Previous-runs response without hourly data for ${c.id}/${m.id}`);
      const res: Record<string, DayBlock> = {};
      for (const l of LEADS) res[l] = aggregateLocalDays(h.time, h[`temperature_2m_previous_day${l}`] ?? h[`temperature_2m_previous_day${l}_${m.id}`] ?? []);
      return res;
    });
    for (const l of LEADS) for (const [d, v] of Object.entries(data[l] ?? {})) out.get(l)!.set(d, v);
  }
  return out;
}

// ----------------------------------------------------------------------------
// Yahoo Finance daily closes (same URL pattern as research/price-study.ts so its cache is reused)
// ----------------------------------------------------------------------------

export async function loadPrices(symbol: string, start: string, end: string): Promise<PriceBar[]> {
  const p1 = Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000);
  const p2 = Math.floor(Date.parse(`${end}T23:59:59Z`) / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;
  // Same cache kind and transform as research/price-study.ts.
  const file = cacheFile('yahoo', url);
  try {
    const hit = JSON.parse(await readFile(file, 'utf8'));
    if (hit.url === url) return hit.data as PriceBar[];
  } catch {}
  if (OFFLINE) throw new Error(`Cache miss in --offline mode: ${url}`);
  const raw = await fetchBody(url, UA_PUBLIC, 'json', 0);
  const data = parseYahooDaily(raw, symbol).map((b) => ({ date: b.date, close: b.close }));
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify({ url, fetchedAt: new Date().toISOString(), data }));
  return data;
}

/** Planned Open-Meteo weight for the full data set (ERA5 + previous runs for all cities and models). */
export function plannedOpenMeteoWeight(era5Start: string, end: string): { era5: number; prevRuns: number; total: number; uncached: number } {
  let era5 = 0, prevRuns = 0, uncached = 0;
  for (const c of CITIES) {
    for (const p of era5Plan(era5Start, end)) {
      era5 += p.weight;
      if (!fileExistsSync(cacheFile('era5h', era5Url(c, p.a, p.b)))) uncached += p.weight;
    }
    for (const m of FORECAST_MODELS) {
      for (const p of prevRunsPlan(m, end)) {
        prevRuns += p.weight;
        if (!fileExistsSync(cacheFile('prevrunsh', prevRunsUrl(c, m.id, p.a, p.b)))) uncached += p.weight;
      }
    }
  }
  return { era5, prevRuns, total: era5 + prevRuns, uncached };
}

function fileExistsSync(f: string): boolean {
  return existsSync(f);
}
