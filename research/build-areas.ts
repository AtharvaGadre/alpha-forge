/**
 * Builds the production-weighted benchmark areas.
 *
 *   npx tsx research/build-areas.ts      →   research/data/areas.json
 *
 * For each area the producing units (counties / municipalities) are clustered into K points by production-weighted
 * k-medoids (PAM: greedy BUILD then SWAP, great-circle distance). Each point is the medoid unit's centroid; its weight
 * is the share of production (population for heating demand) assigned to it. Sources:
 *  - Iowa corn for grain: USDA NASS Iowa County Estimates (2022 crop, released 23 Feb 2024), extracted to
 *    research/data/sources/nass-iowa-corn-county-2022-2023.csv; county internal points from the Census 2024 Gazetteer.
 *  - Mato Grosso soybeans and Minas Gerais coffee: IBGE Produção Agrícola Municipal 2024 (SIDRA tables 1612 / 1613,
 *    quantity produced), municipal polygons from the IBGE 2024 municipal mesh (centroid of each polygon).
 *  - US Northeast heating demand: US Census Bureau county population estimates (Vintage 2024), Census Northeast region,
 *    county internal points from the Census 2024 Gazetteer.
 * Downloads are cached in research/cache/areas (gitignored). No Open-Meteo calls.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cachedDownload, haversineKm } from './lib/stations';
import type { Area, AreaPoint, AreasFile } from './lib/areas';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'research', 'cache', 'areas');
const K = 4;

const URLS = {
  gazetteer: 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_counties_national.zip',
  pep: 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv',
  nassIowa: 'https://www.nass.usda.gov/sites/default/files/Statistics_by_State/Iowa/Publications/County_Estimates/2024/IA-CtyEst-Corn-02-24.pdf',
  sidraSoyMT: 'https://apisidra.ibge.gov.br/values/t/1612/n6/in%20n3%2051/v/214/p/2024/c81/2713',
  sidraCoffeeMG: 'https://apisidra.ibge.gov.br/values/t/1613/n6/in%20n3%2031/v/214/p/2024/c82/2723',
  meshMT: 'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/UFs/MT/MT_Municipios_2024.zip',
  meshMG: 'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/UFs/MG/MG_Municipios_2024.zip',
};

interface Unit { code: string; name: string; lat: number; lng: number; value: number }

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

async function unzipTo(url: string, name: string): Promise<string> {
  const zip = path.join(DIR, 'zip', `${name}.zip`);
  if (!existsSync(zip)) {
    mkdirSync(path.dirname(zip), { recursive: true });
    // large files over flaky links: curl with retries, written to a temp name and renamed when complete
    execFileSync('curl', ['-sS', '-f', '--retry', '4', '--retry-all-errors', '-A', 'research-client/1.0', '-o', `${zip}.part`, url]);
    execFileSync('mv', [`${zip}.part`, zip]);
  }
  const out = path.join(DIR, 'unzipped', name);
  if (!existsSync(out)) {
    mkdirSync(out, { recursive: true });
    execFileSync('unzip', ['-o', '-q', zip, '-d', out]);
  }
  return out;
}

function gazetteer(dir: string): Map<string, { usps: string; name: string; lat: number; lng: number }> {
  const file = readdirSync(dir).find((f) => f.endsWith('.txt'))!;
  const [head, ...lines] = readFileSync(path.join(dir, file), 'utf8').split('\n').filter((l) => l.trim());
  const h = head.split('\t').map((x) => x.trim());
  const out = new Map<string, { usps: string; name: string; lat: number; lng: number }>();
  for (const l of lines) {
    const c = l.split('\t').map((x) => x.trim());
    out.set(c[h.indexOf('GEOID')], { usps: c[h.indexOf('USPS')], name: c[h.indexOf('NAME')], lat: +c[h.indexOf('INTPTLAT')], lng: +c[h.indexOf('INTPTLONG')] });
  }
  return out;
}

/** ESRI shapefile polygons → area-weighted centroid per record (planar lon/lat; fine at municipal scale). */
function shpCentroids(shp: Buffer): Array<{ lat: number; lng: number } | null> {
  const out: Array<{ lat: number; lng: number } | null> = [];
  let off = 100;
  while (off + 8 <= shp.length) {
    const len = shp.readInt32BE(off + 4) * 2;
    const rec = off + 8;
    const type = shp.readInt32LE(rec);
    if (type === 5 || type === 15 || type === 25) {
      const nParts = shp.readInt32LE(rec + 36);
      const nPoints = shp.readInt32LE(rec + 40);
      const parts = Array.from({ length: nParts }, (_, i) => shp.readInt32LE(rec + 44 + 4 * i));
      const pts = rec + 44 + 4 * nParts;
      let a = 0, sx = 0, sy = 0;
      for (let p = 0; p < nParts; p++) {
        const s = parts[p];
        const e = p + 1 < nParts ? parts[p + 1] : nPoints;
        for (let j = s; j < e - 1; j++) {
          const x0 = shp.readDoubleLE(pts + 16 * j), y0 = shp.readDoubleLE(pts + 16 * j + 8);
          const x1 = shp.readDoubleLE(pts + 16 * (j + 1)), y1 = shp.readDoubleLE(pts + 16 * (j + 1) + 8);
          const cr = x0 * y1 - x1 * y0;
          a += cr / 2;
          sx += ((x0 + x1) * cr) / 6;
          sy += ((y0 + y1) * cr) / 6;
        }
      }
      out.push(a !== 0 ? { lng: sx / a, lat: sy / a } : null);
    } else out.push(null);
    off = rec + len;
  }
  return out;
}

function dbfRows(dbf: Buffer): Array<Record<string, string>> {
  const n = dbf.readUInt32LE(4);
  const hlen = dbf.readUInt16LE(8);
  const rlen = dbf.readUInt16LE(10);
  const fields: Array<{ name: string; len: number }> = [];
  for (let p = 32; dbf[p] !== 0x0d; p += 32) fields.push({ name: dbf.toString('latin1', p, p + 11).replace(/\0.*$/s, ''), len: dbf[p + 16] });
  const rows: Array<Record<string, string>> = [];
  for (let i = 0; i < n; i++) {
    let o = hlen + i * rlen + 1;
    const r: Record<string, string> = {};
    for (const f of fields) { r[f.name] = dbf.toString('utf8', o, o + f.len).trim(); o += f.len; }
    rows.push(r);
  }
  return rows;
}

async function municipalCentroids(url: string, uf: string) {
  const dir = await unzipTo(url, `${uf}_Municipios_2024`);
  const base = readdirSync(dir).find((f) => f.endsWith('.shp'))!.replace(/\.shp$/, '');
  const cents = shpCentroids(readFileSync(path.join(dir, `${base}.shp`)));
  const rows = dbfRows(readFileSync(path.join(dir, `${base}.dbf`)));
  if (cents.length !== rows.length) throw new Error(`${uf}: ${cents.length} shapes vs ${rows.length} records`);
  return new Map(rows.map((r, i) => [r.CD_MUN, { name: r.NM_MUN, ...cents[i]! }]));
}

async function sidraUnits(url: string, name: string, uf: string): Promise<{ units: Unit[]; total: number; unmatched: number }> {
  const txt = (await cachedDownload(url, path.join(DIR, 'sidra', `${name}.json`)))!;
  const rows: any[] = JSON.parse(txt).slice(1);
  const cents = await municipalCentroids(uf === 'MT' ? URLS.meshMT : URLS.meshMG, uf);
  let total = 0, unmatched = 0;
  const units: Unit[] = [];
  for (const r of rows) {
    const v = Number(r.V);
    if (!Number.isFinite(v) || v <= 0) continue;
    total += v;
    const c = cents.get(r.D1C);
    if (!c || !Number.isFinite(c.lat)) { unmatched += v; continue; }
    units.push({ code: r.D1C, name: r.D1N, lat: c.lat, lng: c.lng, value: v });
  }
  return { units, total, unmatched };
}

// ---------------------------------------------------------------------------
// Production-weighted k-medoids (PAM)
// ---------------------------------------------------------------------------

function kMedoids(units: Unit[], k: number) {
  const n = units.length;
  const D = Array.from({ length: n }, (_, i) => Float64Array.from(units, (u) => haversineKm(units[i].lat, units[i].lng, u.lat, u.lng)));
  const cost = (med: number[]) => units.reduce((acc, u, i) => acc + u.value * Math.min(...med.map((m) => D[i][m])), 0);
  const med: number[] = [];
  for (let s = 0; s < k; s++) {
    let best = -1, bestCost = Infinity;
    for (let c = 0; c < n; c++) {
      if (med.includes(c)) continue;
      const cc = cost([...med, c]);
      if (cc < bestCost) { bestCost = cc; best = c; }
    }
    med.push(best);
  }
  let current = cost(med);
  for (let iter = 0; iter < 100; iter++) {
    let improved = false;
    for (let mi = 0; mi < k; mi++) for (let c = 0; c < n; c++) {
      if (med.includes(c)) continue;
      const trial = med.slice();
      trial[mi] = c;
      const tc = cost(trial);
      if (tc < current - 1e-9) { med.splice(0, k, ...trial); current = tc; improved = true; }
    }
    if (!improved) break;
  }
  const assign = units.map((_, i) => med.reduce((b, m, j) => (D[i][m] < D[i][med[b]] ? j : b), 0));
  const total = units.reduce((a, u) => a + u.value, 0);
  const meanDistanceKm = units.reduce((a, u, i) => a + u.value * D[i][med[assign[i]]], 0) / total;
  return { med, assign, meanDistanceKm };
}

function toArea(base: Omit<Area, 'points' | 'meanDistanceKm' | 'units' | 'totalValue'> & { totalValue?: number }, units: Unit[]): Area {
  const { med, assign, meanDistanceKm } = kMedoids(units, K);
  const sum = units.reduce((a, u) => a + u.value, 0);
  const points: AreaPoint[] = med.map((m, j) => {
    const mine = units.filter((_, i) => assign[i] === j);
    const value = mine.reduce((a, u) => a + u.value, 0);
    return { id: `${base.id}-${j + 1}`, name: units[m].name, code: units[m].code, lat: +units[m].lat.toFixed(4), lng: +units[m].lng.toFixed(4), weight: +(value / sum).toFixed(4), unitsAssigned: mine.length, valueAssigned: value };
  }).sort((a, b) => b.weight - a.weight).map((p, j) => ({ ...p, id: `${base.id}-${j + 1}` }));
  // weights rounded to 4 dp; renormalise the last so they sum to exactly 1
  const wsum = points.reduce((a, p) => a + p.weight, 0);
  points[points.length - 1].weight = +(points[points.length - 1].weight + 1 - wsum).toFixed(4);
  return { ...base, totalValue: base.totalValue ?? sum, units: units.length, points, meanDistanceKm: +meanDistanceKm.toFixed(1) };
}

// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(DIR, { recursive: true });
  const gaz = gazetteer(await unzipTo(URLS.gazetteer, 'gazetteer_2024'));
  const areas: Area[] = [];

  // Iowa corn (NASS 2022 county production; 2023 suppresses 13 counties including Kossuth, the largest)
  {
    const csv = readFileSync(path.join(ROOT, 'research', 'data', 'sources', 'nass-iowa-corn-county-2022-2023.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
    const byName = new Map([...gaz.entries()].filter(([, g]) => g.usps === 'IA').map(([geoid, g]) => [g.name.replace(/ County$/, ''), { geoid, ...g }]));
    const units: Unit[] = [];
    let other = 0, stateTotal = 0;
    for (const [county, , p22] of csv) {
      if (county.startsWith('Other counties')) { other = Number(p22); continue; }
      if (county === 'State total') { stateTotal = Number(p22); continue; }
      if (!p22) continue;
      const g = byName.get(county);
      if (!g) throw new Error(`Iowa county not in gazetteer: ${county}`);
      units.push({ code: g.geoid, name: `${county} County, IA`, lat: g.lat, lng: g.lng, value: Number(p22) });
    }
    areas.push(toArea({
      id: 'iowa-corn', name: 'Iowa corn belt', benchmarkSite: 'iowa', commodity: 'corn', measure: 'corn for grain production', unit: 'bushels', year: 2022,
      totalValue: stateTotal, unallocatedValue: other,
      sources: [
        { title: 'USDA NASS Iowa Ag News — 2023 Corn County Estimates (includes revised 2022 county production)', url: URLS.nassIowa, note: '2022 used: the 2023 column suppresses 13 counties (269 M bu in “Other counties”)' },
        { title: 'US Census Bureau 2024 Gazetteer — counties (internal points)', url: URLS.gazetteer },
      ],
    }, units));
  }

  // Mato Grosso soybeans and Minas Gerais coffee (IBGE PAM 2024)
  for (const spec of [
    { id: 'mato-grosso-soy', name: 'Mato Grosso soybean belt', site: 'mato-grosso', commodity: 'soybeans', measure: 'soybean (grain) quantity produced', url: URLS.sidraSoyMT, uf: 'MT', table: 'SIDRA table 1612 (lavouras temporárias), variable 214, product 2713 Soja (em grão)' },
    { id: 'minas-coffee', name: 'Minas Gerais coffee regions', site: 'minas', commodity: 'coffee', measure: 'coffee (green bean, total) quantity produced', url: URLS.sidraCoffeeMG, uf: 'MG', table: 'SIDRA table 1613 (lavouras permanentes), variable 214, product 2723 Café (em grão) Total' },
  ]) {
    const { units, total, unmatched } = await sidraUnits(spec.url, spec.id, spec.uf);
    areas.push(toArea({
      id: spec.id, name: spec.name, benchmarkSite: spec.site, commodity: spec.commodity, measure: spec.measure, unit: 'tonnes', year: 2024,
      totalValue: total, unallocatedValue: unmatched,
      sources: [
        { title: `IBGE Produção Agrícola Municipal 2024 — ${spec.table}`, url: spec.url },
        { title: `IBGE Malha Municipal 2024 — ${spec.uf} municipalities (polygon centroids)`, url: spec.uf === 'MT' ? URLS.meshMT : URLS.meshMG },
      ],
    }, units));
  }

  // US Northeast heating demand (Census Northeast region, county population, Vintage 2024)
  {
    const pep = (await cachedDownload(URLS.pep, path.join(DIR, 'census', 'co-est2024-alldata.csv')))!;
    const [head, ...lines] = pep.split('\n').filter((l) => l.trim());
    const h = head.split(',');
    const units: Unit[] = [];
    let total = 0;
    for (const l of lines) {
      const c = l.split(',');
      if (c[h.indexOf('SUMLEV')] !== '050' || c[h.indexOf('REGION')] !== '1') continue;
      const geoid = `${c[h.indexOf('STATE')]}${c[h.indexOf('COUNTY')]}`;
      const pop = Number(c[h.indexOf('POPESTIMATE2024')]);
      total += pop;
      const g = gaz.get(geoid);
      if (!g) throw new Error(`county ${geoid} not in gazetteer`);
      units.push({ code: geoid, name: `${g.name}, ${g.usps}`, lat: g.lat, lng: g.lng, value: pop });
    }
    areas.push(toArea({
      id: 'northeast-heating', name: 'US Northeast heating demand', benchmarkSite: 'northeast', commodity: 'natural-gas / heating-oil demand', measure: 'resident population (heating-demand proxy)', unit: 'persons', year: 2024,
      totalValue: total, unallocatedValue: 0,
      sources: [
        { title: 'US Census Bureau county population totals, Vintage 2024 (co-est2024-alldata), Northeast region (REGION = 1)', url: URLS.pep },
        { title: 'US Census Bureau 2024 Gazetteer — counties (internal points)', url: URLS.gazetteer },
      ],
    }, units));
  }

  const file: AreasFile = {
    version: 'astraeus-areas-v1',
    generatedAt: new Date().toISOString(),
    method: {
      points: `${K} points per area: production-weighted k-medoids (PAM, greedy BUILD + SWAP) of the producing units on great-circle distance; each point is the medoid unit's internal point / polygon centroid`,
      weights: 'share of the area total (production, or population for heating demand) whose unit is nearest to that point',
      areaMean: 'weighted mean of the daily values at the points, formed separately for each model, lead and variable and for ERA5; a day is kept only if every point has a value',
      budget: `${K} points × 4 areas = ${K * 4} Open-Meteo locations, chosen to fit a 3,000 weighted-call budget`,
    },
    areas,
  };
  mkdirSync(path.join(ROOT, 'research', 'data'), { recursive: true });
  writeFileSync(path.join(ROOT, 'research', 'data', 'areas.json'), `${JSON.stringify(file, null, 2)}\n`);
  for (const a of areas) {
    console.log(`▸ ${a.name}: ${a.units} units · total ${a.totalValue.toLocaleString('en-US')} ${a.unit} (${a.year}) · unallocated ${a.unallocatedValue.toLocaleString('en-US')} · mean distance to point ${a.meanDistanceKm} km`);
    for (const p of a.points) console.log(`   ${p.id} ${p.name} (${p.lat}, ${p.lng}) w=${p.weight} · ${p.unitsAssigned} units`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
