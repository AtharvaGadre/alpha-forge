/**
 * Weather-station truth for the Astraeus benchmark.
 *
 * Sources
 *  - NOAA NCEI GHCN-Daily (Menne et al. 2012), by_station CSV files. Values with a non-blank quality flag are
 *    dropped. U.S. data are public domain; some non-U.S. data carry WMO Resolution 40 non-commercial terms.
 *  - Meteostat daily data (https://meteostat.net, CC BY-NC 4.0) as the fallback where GHCN-Daily has no usable
 *    station. Meteostat gap-fills its daily files with model forecasts (DWD MOSMIX, MET Norway); every value
 *    carries a `<var>_source` tag and only values whose sources are all observational are accepted here.
 *
 * Station choice, day alignment and coverage are fixed in research/data/stations.json by
 * research/select-stations.ts (development-period data only); this module only loads and applies them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

export type StationElement = 'tmax' | 'tmin' | 'prcp';
export type DailySeries = Record<string, number>;
export interface StationDaily { tmax: DailySeries; tmin: DailySeries; prcp: DailySeries }

export const GHCN_BASE = 'https://www.ncei.noaa.gov/pub/data/ghcn/daily';
export const METEOSTAT_DAILY = 'https://data.meteostat.net/daily';
export const LICENCES = {
  ghcnd: 'NOAA NCEI GHCN-Daily v3 — U.S. data public domain; some non-U.S. data are restricted to non-commercial use (WMO Resolution 40). Cite Menne et al. (2012), doi:10.1175/JTECH-D-11-00103.1.',
  meteostat: 'Meteostat (https://meteostat.net), CC BY-NC 4.0 — attribution required, non-commercial use only. Only values whose source tags are observational are used.',
};

/** Meteostat source tags accepted as observations; anything else (dwd_mosmix, metno_forecast, …) is rejected. */
export const OBSERVATION_SOURCES = new Set(['ghcnd', 'ghcnh', 'isd_lite', 'metar', 'synop', 'dwd_poi', 'dwd_hourly', 'dwd_daily', 'eccc_hourly', 'eccc_daily', 'national']);

export interface StationChoice {
  source: 'ghcnd' | 'meteostat';
  id: string;
  name: string;
  lat: number;
  lon: number;
  elevationM: number | null;
  distanceKm: number;
  /** station elevation minus the Copernicus 90 m DEM elevation at the benchmark site (Open-Meteo elevation API) */
  elevationDiffM: number | null;
  /** fraction of days 2025-07-01 → end with an accepted value */
  coverage: Record<StationElement, number>;
  /** station value dated D is assigned to UTC day D + shift (0 or −1), chosen on development data only */
  shift: 0 | -1;
  alignment: { corrShift0: number | null; corrShiftMinus1: number | null; days: number; basis: string };
  climatology: { years: [number, number]; values: number; usable: boolean };
  licence: string;
  dataUrl: string;
  obsTime?: string | null;
}

export interface StationSite {
  site: string;
  name: string;
  lat: number;
  lng: number;
  siteElevationM: number | null;
  tmax: StationChoice | null;
  precip: StationChoice | null;
  notes: string[];
}

export interface StationsFile {
  version: string;
  generatedAt: string;
  window: { start: string; end: string; devEnd: string };
  rules: Record<string, string>;
  sites: StationSite[];
  excluded: Array<{ site: string; variable: 'tmax' | 'precip'; reason: string }>;
  sources: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const iso = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/** GHCN-Daily by_station CSV: ID,YYYYMMDD,ELEMENT,VALUE,MFLAG,QFLAG,SFLAG,OBSTIME. Tenths of °C / mm. */
export function parseGhcnCsv(text: string, from = '1900-01-01'): StationDaily & { obsTime: Partial<Record<StationElement, string>> } {
  const out: StationDaily = { tmax: {}, tmin: {}, prcp: {} };
  const times: Record<string, Map<string, number>> = { tmax: new Map(), tmin: new Map(), prcp: new Map() };
  const fromKey = from.replace(/-/g, '');
  for (const line of text.split('\n')) {
    if (line.length < 20) continue;
    const c = line.split(',');
    const el = c[2] === 'TMAX' ? 'tmax' : c[2] === 'TMIN' ? 'tmin' : c[2] === 'PRCP' ? 'prcp' : null;
    if (!el || c[1] < fromKey) continue;
    if ((c[5] ?? '').trim() !== '') continue; // failed a quality check
    const v = Number(c[3]);
    if (!Number.isFinite(v) || v === -9999) continue;
    out[el][iso(c[1])] = v / 10;
    const t = (c[7] ?? '').trim();
    if (c[1] >= '20250701' && t) times[el].set(t, (times[el].get(t) ?? 0) + 1);
  }
  const mode = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { ...out, obsTime: { tmax: mode(times.tmax), tmin: mode(times.tmin), prcp: mode(times.prcp) } };
}

/** Meteostat yearly daily CSV (data.meteostat.net/daily/<year>/<id>.csv.gz) with per-value source tags. */
export function parseMeteostatDaily(text: string): StationDaily & { rejected: Record<StationElement, number> } {
  const out: StationDaily = { tmax: {}, tmin: {}, prcp: {} };
  const rejected: Record<StationElement, number> = { tmax: 0, tmin: 0, prcp: 0 };
  const [head, ...lines] = text.split('\n').filter((l) => l.trim().length);
  if (!head) return { ...out, rejected };
  const h = head.split(',');
  const ix = (k: string) => h.indexOf(k);
  const iy = ix('year'), im = ix('month'), id = ix('day');
  for (const l of lines) {
    const c = l.split(',');
    const date = `${c[iy]}-${String(c[im]).padStart(2, '0')}-${String(c[id]).padStart(2, '0')}`;
    for (const el of ['tmax', 'tmin', 'prcp'] as StationElement[]) {
      const raw = c[ix(el)];
      if (raw === undefined || raw === '') continue;
      const src = (c[ix(`${el}_source`)] ?? '').trim().split(/\s+/).filter(Boolean);
      if (!src.length || !src.every((s) => OBSERVATION_SOURCES.has(s))) { rejected[el]++; continue; }
      const v = Number(raw);
      if (Number.isFinite(v)) out[el][date] = v;
    }
  }
  return { ...out, rejected };
}

// ---------------------------------------------------------------------------
// Polite cached downloads (NOAA / Meteostat; no Open-Meteo budget involved)
// ---------------------------------------------------------------------------

const UA = 'research-client/1.0';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function cachedDownload(url: string, file: string, opts: { gz?: boolean; allow404?: boolean } = {}): Promise<string | null> {
  if (existsSync(file)) {
    const buf = readFileSync(file);
    if (buf.length === 0) return null; // cached 404
    return opts.gz ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  }
  mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 404 && opts.allow404) { writeFileSync(file, ''); return null; }
    if (!res.ok) { await sleep(3000 * (attempt + 1)); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(file, buf);
    await sleep(400);
    return opts.gz ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  }
  throw new Error(`download failed: ${url}`);
}

export function stationCacheDir(root: string) {
  return path.join(root, 'research', 'cache', 'stations');
}

/** Raw daily series for one station (all years from `fromYear`), parsed and cached as JSON. */
export async function loadStationDaily(root: string, source: 'ghcnd' | 'meteostat', id: string, fromYear: number, toYear: number): Promise<StationDaily> {
  const dir = stationCacheDir(root);
  const parsed = path.join(dir, 'parsed', `${source}-${id}-${fromYear}-${toYear}.json`);
  if (existsSync(parsed)) return JSON.parse(readFileSync(parsed, 'utf8'));
  let data: StationDaily = { tmax: {}, tmin: {}, prcp: {} };
  if (source === 'ghcnd') {
    const txt = await cachedDownload(`${GHCN_BASE}/by_station/${id}.csv.gz`, path.join(dir, 'raw', 'ghcnd', `${id}.csv.gz`), { gz: true });
    const p = parseGhcnCsv(txt ?? '', `${fromYear}-01-01`);
    data = { tmax: p.tmax, tmin: p.tmin, prcp: p.prcp };
  } else {
    for (let y = fromYear; y <= toYear; y++) {
      const txt = await cachedDownload(`${METEOSTAT_DAILY}/${y}/${id}.csv.gz`, path.join(dir, 'raw', 'meteostat', `${id}-${y}.csv.gz`), { gz: true, allow404: true });
      if (!txt) continue;
      const p = parseMeteostatDaily(txt);
      for (const el of ['tmax', 'tmin', 'prcp'] as StationElement[]) Object.assign(data[el], p[el]);
    }
  }
  for (const el of ['tmax', 'tmin', 'prcp'] as StationElement[]) {
    data[el] = Object.fromEntries(Object.entries(data[el]).filter(([d]) => d >= `${fromYear}-01-01` && d <= `${toYear}-12-31`));
  }
  mkdirSync(path.dirname(parsed), { recursive: true });
  writeFileSync(parsed, JSON.stringify(data));
  return data;
}

// ---------------------------------------------------------------------------
// Helpers shared by selection and the benchmark
// ---------------------------------------------------------------------------

export const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Re-date a station series: the value dated D becomes the value for UTC day D + shift. */
export function shiftSeries(s: DailySeries, shift: number): DailySeries {
  if (!shift) return { ...s };
  return Object.fromEntries(Object.entries(s).map(([d, v]) => [addDays(d, shift), v]));
}

export function coverage(s: DailySeries, start: string, end: string): number {
  let n = 0;
  let k = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) { n++; if (s[d] !== undefined) k++; }
  return n ? k / n : 0;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 30) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

export function readStationsFile(root: string): StationsFile {
  const p = path.join(root, 'research', 'data', 'stations.json');
  if (!existsSync(p)) throw new Error('research/data/stations.json missing — run `npx tsx research/select-stations.ts` first.');
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Station truth for one benchmark site, aligned to UTC days, in the benchmark's variable names.
 * `tmean` is deliberately empty: station (Tmax+Tmin)/2 is not the 24-hour mean the forecasts are aggregated to.
 * Climatology: the station's own record for the configured years (usable only with ≥ 60 % of days present).
 */
export async function loadStationTruth(root: string, entry: StationSite, period: { start: string; end: string }, climYears: [number, number]) {
  const truth = { tmean: {} as DailySeries, tmax: {} as DailySeries, precip: {} as DailySeries };
  const clim = { tmean: {} as DailySeries, tmax: {} as DailySeries, precip: {} as DailySeries };
  const climUsable = { tmax: false, precip: false };
  for (const [v, el] of [['tmax', 'tmax'], ['precip', 'prcp']] as const) {
    const ch = entry[v];
    if (!ch) continue;
    const startYear = Math.min(climYears[0], Number(period.start.slice(0, 4)));
    const raw = await loadStationDaily(root, ch.source, ch.id, startYear, Number(period.end.slice(0, 4)));
    const s = shiftSeries(raw[el], ch.shift);
    truth[v] = Object.fromEntries(Object.entries(s).filter(([d]) => d >= period.start && d <= period.end));
    const c = Object.fromEntries(Object.entries(s).filter(([d]) => d >= `${climYears[0]}-01-01` && d <= `${climYears[1]}-12-31`));
    const days = (Date.UTC(climYears[1], 11, 31) - Date.UTC(climYears[0], 0, 1)) / 864e5 + 1;
    climUsable[v] = Object.keys(c).length >= 0.6 * days;
    clim[v] = c;
  }
  return { truth, clim, climUsable };
}
