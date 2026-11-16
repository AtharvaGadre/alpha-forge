/**
 * Chooses the verification station for each benchmark site and fixes its day alignment.
 *
 *   npx tsx research/select-stations.ts      →   research/data/stations.json
 *
 * Rules (fixed before any forecast was scored against stations):
 *  - Candidates within MAX_KM of the benchmark grid point. NOAA GHCN-Daily first; Meteostat daily (observation-
 *    sourced values only) where GHCN-Daily has no usable station.
 *  - A station is usable for a variable when ≥ MIN_COVERAGE of the days 2025-07-01 → END carry an accepted value.
 *    The nearest GHCN station usable for both Tmax and precipitation is preferred; otherwise each variable takes
 *    the nearest usable GHCN station, then the nearest usable Meteostat station.
 *  - Day alignment: benchmark days are UTC-day aggregates; station values are local observation days and GHCN PRCP is
 *    often the 24 h ending at a morning observation, dated on the observation day. For each chosen station and
 *    variable the shift (0 or −1 day) is the one with the higher Pearson correlation with ERA5 at the site over the
 *    development period only (2025-07-01 → 2026-03-31). It is then frozen.
 *  - Tmean is not verified on stations: (Tmax+Tmin)/2 is not the 24-hour mean the forecasts are aggregated to, and the
 *    cached forecasts hold no daily minimum to build a like-for-like (max+min)/2.
 *
 * Reads the ERA5 site series from the benchmark cache (research/cache/weather); downloads NOAA / Meteostat files into
 * research/cache/stations (gitignored). One Open-Meteo elevation request for the 16 site DEM heights.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import {
  GHCN_BASE, LICENCES, METEOSTAT_DAILY, cachedDownload, coverage, haversineKm, loadStationDaily, parseGhcnCsv, pearson, shiftSeries, stationCacheDir,
  type DailySeries, type StationChoice, type StationDaily, type StationElement, type StationSite, type StationsFile,
} from './lib/stations';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const START = '2025-07-01';
const END = '2026-11-08'; // CONFIG.forecastEnd of the benchmark
const DEV_END = '2026-03-31';
const MAX_KM = 40;
const MIN_COVERAGE = 0.8;
const CLIM_YEARS: [number, number] = [2019, 2024];

/** Must equal SITES in research/weather-benchmark.ts (the benchmark checks this when loading stations.json). */
const SITES = [
  { id: 'iowa', name: 'Iowa · US Corn Belt', lat: 42.03, lng: -93.62 },
  { id: 'kansas', name: 'Kansas · US Plains', lat: 38.84, lng: -97.61 },
  { id: 'mato-grosso', name: 'Mato Grosso · Brazil', lat: -12.54, lng: -55.72 },
  { id: 'parana', name: 'Paraná · Brazil', lat: -24.95, lng: -53.46 },
  { id: 'cordoba', name: 'Córdoba · Argentina', lat: -31.42, lng: -64.19 },
  { id: 'minas', name: 'Minas Gerais · Brazil', lat: -21.55, lng: -45.43 },
  { id: 'daloa', name: 'Daloa · Côte d’Ivoire', lat: 6.88, lng: -6.45 },
  { id: 'punjab', name: 'Punjab · India', lat: 30.9, lng: 75.86 },
  { id: 'beauce', name: 'Beauce · France', lat: 48.45, lng: 1.49 },
  { id: 'odesa', name: 'Odesa · Ukraine', lat: 46.48, lng: 30.73 },
  { id: 'nsw', name: 'New South Wales · Australia', lat: -32.25, lng: 148.6 },
  { id: 'jilin', name: 'Jilin · China', lat: 43.84, lng: 126.55 },
  { id: 'mekong', name: 'Mekong Delta · Vietnam', lat: 10.05, lng: 105.75 },
  { id: 'texas', name: 'Texas · United States', lat: 32.78, lng: -96.8 },
  { id: 'northeast', name: 'Northeast · United States', lat: 40.71, lng: -74.01 },
  { id: 'northwest-europe', name: 'Northwest Europe · Netherlands', lat: 52.37, lng: 4.9 },
];

const DIR = stationCacheDir(ROOT);
const chunks = (start: string, end: string, months: number): Array<[string, string]> => {
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
};

/** ERA5 UTC-day series at the site, from the benchmark's own cache (same keys as weather-benchmark.ts). */
function era5At(siteId: string): { tmax: DailySeries; precip: DailySeries } {
  const out = { tmax: {} as DailySeries, precip: {} as DailySeries };
  for (const [a, b] of chunks('2025-07-01', END, 6)) {
    const key = `era5|${siteId}|${a}|${b}`;
    const p = path.join(ROOT, 'research', 'cache', 'weather', `${createHash('sha1').update(key).digest('hex').slice(0, 16)}.json`);
    if (!existsSync(p)) throw new Error(`ERA5 cache missing for ${key} — run the benchmark once first`);
    const d = JSON.parse(readFileSync(p, 'utf8'));
    Object.assign(out.tmax, d.tmax);
    Object.assign(out.precip, d.precip);
  }
  return out;
}

interface Candidate { source: 'ghcnd' | 'meteostat'; id: string; name: string; lat: number; lon: number; elevationM: number | null; distanceKm: number; has?: { tmax: boolean; prcp: boolean }; obsTime?: Partial<Record<StationElement, string>>; data?: StationDaily; cov?: Record<StationElement, number> }

async function main() {
  mkdirSync(DIR, { recursive: true });
  // --- metadata -------------------------------------------------------------
  const stationsTxt = (await cachedDownload(`${GHCN_BASE}/ghcnd-stations.txt`, path.join(DIR, 'meta', 'ghcnd-stations.txt')))!;
  const inventoryTxt = (await cachedDownload(`${GHCN_BASE}/ghcnd-inventory.txt`, path.join(DIR, 'meta', 'ghcnd-inventory.txt')))!;
  const msBuf = path.join(DIR, 'meta', 'meteostat-stations-full.json.gz');
  await cachedDownload('https://bulk.meteostat.net/v2/stations/full.json.gz', msBuf);
  const meteostat: any[] = JSON.parse(gunzipSync(readFileSync(msBuf)).toString('utf8'));
  const ghcn = new Map<string, { id: string; lat: number; lon: number; elev: number; name: string }>();
  for (const l of stationsTxt.split('\n')) if (l.length > 40) ghcn.set(l.slice(0, 11), { id: l.slice(0, 11), lat: +l.slice(12, 20), lon: +l.slice(21, 30), elev: +l.slice(31, 37), name: l.slice(41, 71).trim() });
  const inv = new Map<string, Record<string, [number, number]>>();
  for (const l of inventoryTxt.split('\n')) {
    if (l.length < 44) continue;
    const id = l.slice(0, 11);
    if (!inv.has(id)) inv.set(id, {});
    inv.get(id)![l.slice(31, 35)] = [+l.slice(36, 40), +l.slice(41, 45)];
  }
  // --- site DEM elevations (one Open-Meteo request, cached) ------------------
  const elevFile = path.join(DIR, 'site-elevation.json');
  if (!existsSync(elevFile)) {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${SITES.map((s) => s.lat).join(',')}&longitude=${SITES.map((s) => s.lng).join(',')}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'research-client/1.0' } });
    if (!res.ok) throw new Error(`elevation API ${res.status}`);
    writeFileSync(elevFile, JSON.stringify(await res.json()));
  }
  const elevations: number[] = JSON.parse(readFileSync(elevFile, 'utf8')).elevation;

  const lastYear = Number(END.slice(0, 4));
  const sites: StationSite[] = [];
  const excluded: StationsFile['excluded'] = [];
  const candidatesBySite: Record<string, any[]> = {};

  for (const [si, site] of SITES.entries()) {
    console.log(`▸ ${site.name}`);
    const era5 = era5At(site.id);
    const near = (lat: number, lon: number) => haversineKm(site.lat, site.lng, lat, lon);
    const ghcnAll: Candidate[] = [];
    for (const s of ghcn.values()) {
      if (Math.abs(s.lat - site.lat) > 0.5 || Math.abs(s.lon - site.lng) > 0.8) continue;
      const d = near(s.lat, s.lon);
      if (d > MAX_KM) continue;
      const i = inv.get(s.id) ?? {};
      const has = (e: string) => !!i[e] && i[e][1] >= lastYear && i[e][0] <= 2025;
      if (!has('TMAX') && !has('PRCP')) continue;
      ghcnAll.push({ source: 'ghcnd', id: s.id, name: s.name, lat: s.lat, lon: s.lon, elevationM: s.elev > -999 ? s.elev : null, distanceKm: d, has: { tmax: has('TMAX'), prcp: has('PRCP') } });
    }
    ghcnAll.sort((a, b) => a.distanceKm - b.distanceKm);
    const both = ghcnAll.filter((c) => c.has?.tmax && c.has?.prcp).slice(0, 5);
    const msAll: Candidate[] = meteostat
      .filter((s) => s.location && Math.abs(s.location.latitude - site.lat) < 0.5 && Math.abs(s.location.longitude - site.lng) < 0.8)
      .map((s) => ({ source: 'meteostat' as const, id: s.id, name: s.name?.en ?? s.id, lat: s.location.latitude, lon: s.location.longitude, elevationM: s.location.elevation ?? null, distanceKm: near(s.location.latitude, s.location.longitude) }))
      .filter((c) => c.distanceKm <= MAX_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);

    const evaluate = async (c: Candidate) => {
      if (c.cov) return c;
      c.data = await loadStationDaily(ROOT, c.source, c.id, 2025, lastYear);
      c.cov = { tmax: coverage(c.data.tmax, START, END), tmin: coverage(c.data.tmin, START, END), prcp: coverage(c.data.prcp, START, END) };
      if (c.source === 'ghcnd') {
        const txt = await cachedDownload(`${GHCN_BASE}/by_station/${c.id}.csv.gz`, path.join(DIR, 'raw', 'ghcnd', `${c.id}.csv.gz`), { gz: true });
        c.obsTime = parseGhcnCsv(txt ?? '', '2025-07-01').obsTime;
      } else c.obsTime = undefined;
      console.log(`   ${c.source} ${c.id} ${c.name} ${c.distanceKm.toFixed(1)} km · Tmax ${(c.cov.tmax * 100).toFixed(0)}% Tmin ${(c.cov.tmin * 100).toFixed(0)}% PRCP ${(c.cov.prcp * 100).toFixed(0)}%`);
      return c;
    };
    for (const c of both) await evaluate(c);
    for (const c of msAll) await evaluate(c);
    const ok = (c: Candidate, el: 'tmax' | 'prcp') => !!c.cov && c.cov[el] >= MIN_COVERAGE;
    // second pass: single-element GHCN stations, only for a variable still without a usable station
    for (const el of ['tmax', 'prcp'] as const) {
      if ([...both, ...msAll].some((c) => ok(c, el))) continue;
      for (const c of ghcnAll.filter((x) => x.has?.[el] && !both.includes(x)).slice(0, 4)) await evaluate(c);
    }
    const evaluated = [...ghcnAll, ...msAll].filter((c) => c.cov);
    candidatesBySite[site.id] = evaluated.map((c) => ({ source: c.source, id: c.id, name: c.name, distanceKm: +c.distanceKm.toFixed(1), coverage: { tmax: +c.cov!.tmax.toFixed(3), tmin: +c.cov!.tmin.toFixed(3), prcp: +c.cov!.prcp.toFixed(3) } }));

    const pick = (el: 'tmax' | 'prcp'): Candidate | null => {
      const g = evaluated.filter((c) => c.source === 'ghcnd' && ok(c, 'tmax') && ok(c, 'prcp'));
      if (g.length) return g[0];
      return evaluated.find((c) => c.source === 'ghcnd' && ok(c, el)) ?? evaluated.find((c) => c.source === 'meteostat' && ok(c, el)) ?? null;
    };

    const entry: StationSite = { site: site.id, name: site.name, lat: site.lat, lng: site.lng, siteElevationM: elevations[si] ?? null, tmax: null, precip: null, notes: [] };
    for (const [v, el] of [['tmax', 'tmax'], ['precip', 'prcp']] as const) {
      const c = pick(el);
      if (!c) {
        const best = evaluated.slice().sort((a, b) => b.cov![el] - a.cov![el])[0];
        excluded.push({ site: site.id, variable: v, reason: best ? `no station within ${MAX_KM} km with ≥ ${MIN_COVERAGE * 100}% observational ${el.toUpperCase()} coverage (best: ${best.source} ${best.id} ${best.name}, ${best.distanceKm.toFixed(1)} km, ${(best.cov![el] * 100).toFixed(0)}%)` : `no GHCN-Daily or Meteostat station within ${MAX_KM} km reporting ${el.toUpperCase()} in 2025–2026` });
        continue;
      }
      // alignment on development days only
      const truth = v === 'tmax' ? era5.tmax : era5.precip;
      const corrFor = (shift: number) => {
        const s = shiftSeries(c.data![el], shift);
        const xs: number[] = [];
        const ys: number[] = [];
        for (const [d, y] of Object.entries(truth)) if (d >= START && d <= DEV_END && s[d] !== undefined) { xs.push(s[d]); ys.push(y); }
        return { r: pearson(xs, ys), n: xs.length };
      };
      const c0 = corrFor(0);
      const c1 = corrFor(-1);
      const shift: 0 | -1 = (c1.r ?? -2) > (c0.r ?? -2) ? -1 : 0;
      const full = await loadStationDaily(ROOT, c.source, c.id, CLIM_YEARS[0], lastYear);
      const climValues = Object.keys(full[el]).filter((d) => d >= `${CLIM_YEARS[0]}-01-01` && d <= `${CLIM_YEARS[1]}-12-31`).length;
      const climDays = (Date.UTC(CLIM_YEARS[1], 11, 31) - Date.UTC(CLIM_YEARS[0], 0, 1)) / 864e5 + 1;
      const choice: StationChoice = {
        source: c.source, id: c.id, name: c.name, lat: c.lat, lon: c.lon, elevationM: c.elevationM,
        distanceKm: +c.distanceKm.toFixed(1),
        elevationDiffM: c.elevationM !== null && elevations[si] !== undefined ? Math.round(c.elevationM - elevations[si]) : null,
        coverage: { tmax: +c.cov!.tmax.toFixed(3), tmin: +c.cov!.tmin.toFixed(3), prcp: +c.cov!.prcp.toFixed(3) },
        shift,
        alignment: { corrShift0: c0.r === null ? null : +c0.r.toFixed(4), corrShiftMinus1: c1.r === null ? null : +c1.r.toFixed(4), days: Math.max(c0.n, c1.n), basis: `Pearson r of station ${el.toUpperCase()} (re-dated by the shift) with ERA5 UTC-day ${v === 'tmax' ? 'Tmax' : 'precipitation'} at the site, ${START} → ${DEV_END}` },
        climatology: { years: CLIM_YEARS, values: climValues, usable: climValues >= 0.6 * climDays },
        licence: c.source === 'ghcnd' ? LICENCES.ghcnd : LICENCES.meteostat,
        dataUrl: c.source === 'ghcnd' ? `${GHCN_BASE}/by_station/${c.id}.csv.gz` : `${METEOSTAT_DAILY}/<year>/${c.id}.csv.gz`,
        obsTime: c.source === 'ghcnd' ? c.obsTime?.[el] ?? null : null,
      };
      entry[v] = choice;
      console.log(`   → ${v}: ${c.source} ${c.id} (${choice.distanceKm} km) shift ${shift} · r0 ${choice.alignment.corrShift0} r−1 ${choice.alignment.corrShiftMinus1} · clim ${climValues}/${climDays}`);
    }
    if (entry.tmax && entry.precip && entry.tmax.id !== entry.precip.id) entry.notes.push('Tmax and precipitation come from different stations.');
    if ((entry.tmax && !entry.tmax.climatology.usable) || (entry.precip && !entry.precip.climatology.usable)) entry.notes.push('Station record too short for a 2019–2024 climatology; the ERA5 grid-point climatology is used as the reference forecast for that variable.');
    sites.push(entry);
  }

  const file: StationsFile & { candidates: Record<string, any[]> } = {
    version: 'astraeus-stations-v1',
    generatedAt: new Date().toISOString(),
    window: { start: START, end: END, devEnd: DEV_END },
    rules: {
      distance: `≤ ${MAX_KM} km from the benchmark grid point`,
      coverage: `≥ ${MIN_COVERAGE * 100}% of days ${START} → ${END} with an accepted value (GHCN: blank quality flag; Meteostat: observation-sourced only)`,
      preference: 'nearest GHCN-Daily station usable for both Tmax and precipitation; else per variable the nearest usable GHCN-Daily station, then Meteostat',
      alignment: `shift ∈ {0, −1} maximising Pearson r with ERA5 at the site over ${START} → ${DEV_END} (development period only), then frozen`,
      tmean: 'not verified on stations (station (Tmax+Tmin)/2 ≠ 24-hour mean; no daily minimum in the forecast cache)',
      climatology: `station record ${CLIM_YEARS.join('–')} when ≥ 60% of days are present, else the ERA5 grid-point climatology`,
    },
    sites,
    excluded,
    candidates: candidatesBySite,
    sources: {
      ghcnd: `${GHCN_BASE}/ (ghcnd-stations.txt, ghcnd-inventory.txt, by_station/*.csv.gz)`,
      meteostat: `${METEOSTAT_DAILY}/<year>/<station>.csv.gz (Meteostat, CC BY-NC 4.0); station list https://bulk.meteostat.net/v2/stations/full.json.gz`,
      elevation: 'Open-Meteo elevation API (Copernicus DEM GLO-90) at the benchmark site coordinates',
    },
  };
  mkdirSync(path.join(ROOT, 'research', 'data'), { recursive: true });
  writeFileSync(path.join(ROOT, 'research', 'data', 'stations.json'), `${JSON.stringify(file, null, 2)}\n`);
  const nT = sites.filter((s) => s.tmax).length;
  const nP = sites.filter((s) => s.precip).length;
  console.log(`\nwrote research/data/stations.json · Tmax ${nT}/16 sites · precipitation ${nP}/16 sites`);
}

main().catch((e) => { console.error(e); process.exit(1); });
