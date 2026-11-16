/**
 * Station and area verification report for the Astraeus weather benchmark.
 *
 *   npx tsx research/verification-report.ts
 *
 * Reads benchmark runs from research/out (commands in REPRODUCE below; all offline once the cache is filled) and
 * writes public/research/archive/weather-stations-{dev,confirm}.json, public/research/archive/weather-areas-confirm.json,
 * docs/results/STATION_VERIFICATION.md and docs/results/AREA_VERIFICATION.md. Never touches
 * public/research/weather-skill.json (read only, as the published ERA5 reference).
 *
 * Paired cross-run comparisons (station-trained vs ERA5-trained; area vs single point) use the per-case CRPS each
 * extended run stores (`caseLosses`), restricted to the cases both runs share, with the benchmark's estimand and tests:
 * pooled CRPSS = 1 − ΣCRPS_a / ΣCRPS_b, Diebold–Mariano on the case-weighted daily differential (Newey–West 14 days;
 * the largest p over bandwidths {lead, 7, 14, 21} is reported) and a 7-day moving-block bootstrap (2,000 resamples).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dieboldMariano, seededRandom } from '../src/engine/weatherPostprocessing';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LEADS = [1, 3, 5, 7];
const STATION_VARS = ['tmax', 'precip'] as const;
const ALL_VARS = ['tmean', 'tmax', 'precip'] as const;
const VAR_LABEL: Record<string, string> = { tmean: 'Daily mean temperature', tmax: 'Daily maximum temperature', precip: 'Daily precipitation' };
const B = 2000;
const BLOCK = 7;

const REPRODUCE = {
  stations: [
    'npx tsx research/select-stations.ts                      # research/data/stations.json (station choice, coverage, alignment)',
    'npx tsx research/weather-benchmark.ts --suite final --period dev --offline                                  # ERA5, all 16 sites (dev reference)',
    'npx tsx research/weather-benchmark.ts --suite final --period <dev|confirm> --offline --mask stations       # ERA5 on station site-days',
    'npx tsx research/weather-benchmark.ts --suite final --period <dev|confirm> --offline --truth stations --train era5      # as deployed',
    'npx tsx research/weather-benchmark.ts --suite final --period <dev|confirm> --offline --truth stations --train stations  # station-trained',
    'npx tsx research/verification-report.ts',
  ],
  areas: [
    'npx tsx research/build-areas.ts                          # research/data/areas.json (points, weights, sources)',
    'npx tsx research/weather-benchmark.ts --suite final --period confirm --sites areas --clim-years 2022,2024 [--offline]',
    'npx tsx research/weather-benchmark.ts --suite final --period confirm --offline --only iowa,mato-grosso,minas,northeast --clim-years 2022,2024',
    'npx tsx research/verification-report.ts',
  ],
};

const readJson = (rel: string) => {
  const p = path.join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`${rel} missing — see REPRODUCE in research/verification-report.ts`);
  return JSON.parse(readFileSync(p, 'utf8'));
};
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const pct = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
const ci = (c: Array<number | null> | undefined) => (c && c[0] !== null && c[1] !== null && Number.isFinite(c[0] as number) ? `(${pct(c[0])}, ${pct(c[1])})` : '');
const pval = (p: number | null | undefined) => (p === null || p === undefined || !Number.isFinite(p) ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

// ---------------------------------------------------------------------------
// Paired machinery
// ---------------------------------------------------------------------------

/** `${variable}|${lead}` → `${site}|${date}` → method → [crps, inside80] */
type CaseTable = Map<string, Map<string, Record<string, [number, number]>>>;

function caseTable(run: any, siteMap: (s: string) => string = (s) => s): CaseTable {
  const t: CaseTable = new Map();
  for (const g of run.caseLosses ?? []) {
    const k = `${g.variable}|${g.lead}`;
    if (!t.has(k)) t.set(k, new Map());
    const m = t.get(k)!;
    g.dates.forEach((d: string, i: number) => {
      const row: Record<string, [number, number]> = {};
      for (const meth of Object.keys(g.crps)) row[meth] = [g.crps[meth][i], g.inside80[meth][i]];
      m.set(`${siteMap(g.site)}|${d}`, row);
    });
  }
  return t;
}

function blockDraws(nDates: number, seed: number): number[][] {
  const rnd = seededRandom(seed);
  const draws: number[][] = [];
  for (let b = 0; b < B; b++) {
    const pick: number[] = [];
    while (pick.length < nDates) {
      const start = Math.floor(rnd() * Math.max(1, nDates - BLOCK + 1));
      for (let j = 0; j < BLOCK && pick.length < nDates; j++) pick.push(Math.min(nDates - 1, start + j));
    }
    draws.push(pick);
  }
  return draws;
}

const quantile = (xs: number[], q: number) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))]; };

/** CRPSS of (tableA, methodA) over (tableB, methodB) on the cases both share. */
function pairedSkill(A: CaseTable, ma: string, Bt: CaseTable, mb: string, variable: string, lead: number, sites?: string[]) {
  const a = A.get(`${variable}|${lead}`);
  const b = Bt.get(`${variable}|${lead}`);
  if (!a || !b) return null;
  const byDate = new Map<string, { sa: number; sb: number; n: number; ia: number; ib: number }>();
  for (const [k, ra] of a) {
    const rb = b.get(k);
    if (!rb || !ra[ma] || !rb[mb]) continue;
    const [site, d] = k.split('|');
    if (sites && !sites.includes(site)) continue;
    if (!byDate.has(d)) byDate.set(d, { sa: 0, sb: 0, n: 0, ia: 0, ib: 0 });
    const x = byDate.get(d)!;
    x.sa += ra[ma][0]; x.sb += rb[mb][0]; x.n++; x.ia += ra[ma][1]; x.ib += rb[mb][1];
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length < 8) return null;
  const sa = dates.map((d) => byDate.get(d)!.sa);
  const sb = dates.map((d) => byDate.get(d)!.sb);
  const n = dates.map((d) => byDate.get(d)!.n);
  const N = n.reduce((x, y) => x + y, 0);
  const SA = sa.reduce((x, y) => x + y, 0);
  const SB = sb.reduce((x, y) => x + y, 0);
  const draws = blockDraws(dates.length, 424242 + lead);
  const vals = draws.map((p) => 1 - p.reduce((x, i) => x + sa[i], 0) / p.reduce((x, i) => x + sb[i], 0));
  const nBar = N / dates.length;
  const d = sa.map((x, i) => (x - sb[i]) / nBar);
  const main = dieboldMariano(d, 14);
  const robustMaxP = Math.max(main.pValue, ...[Math.max(1, lead), 7, 21].map((l) => dieboldMariano(d, l).pValue));
  return {
    cases: N, days: dates.length, crpsA: r3(SA / N), crpsB: r3(SB / N), skill: r3(1 - SA / SB), ci: [r3(quantile(vals, 0.025)), r3(quantile(vals, 0.975))],
    dmP: main.pValue, robustMaxP,
    coverageA: r3(dates.reduce((x, dd) => x + byDate.get(dd)!.ia, 0) / N), coverageB: r3(dates.reduce((x, dd) => x + byDate.get(dd)!.ib, 0) / N),
  };
}

/** Difference of two skill scores (method m over ref) between table X and table Y on paired site-days. */
function skillDiff(X: CaseTable, Y: CaseTable, m: string, ref: string, variable: string, lead: number, pairs: Array<[string, string]>) {
  const x = X.get(`${variable}|${lead}`);
  const y = Y.get(`${variable}|${lead}`);
  if (!x || !y) return null;
  const byDate = new Map<string, { xm: number; xr: number; ym: number; yr: number; n: number; xi: number; yi: number }>();
  for (const [xs, ys] of pairs) {
    for (const [k, rx] of x) {
      const [site, d] = k.split('|');
      if (site !== xs) continue;
      const ry = y.get(`${ys}|${d}`);
      if (!ry || !rx[m] || !rx[ref] || !ry[m] || !ry[ref]) continue;
      if (!byDate.has(d)) byDate.set(d, { xm: 0, xr: 0, ym: 0, yr: 0, n: 0, xi: 0, yi: 0 });
      const o = byDate.get(d)!;
      o.xm += rx[m][0]; o.xr += rx[ref][0]; o.ym += ry[m][0]; o.yr += ry[ref][0]; o.n++; o.xi += rx[m][1]; o.yi += ry[m][1];
    }
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length < 8) return null;
  const col = (k: 'xm' | 'xr' | 'ym' | 'yr') => dates.map((d) => byDate.get(d)![k]);
  const [xm, xr, ym, yr] = [col('xm'), col('xr'), col('ym'), col('yr')];
  const S = (a: number[], p?: number[]) => (p ? p.reduce((s, i) => s + a[i], 0) : a.reduce((s, v) => s + v, 0));
  const N = dates.reduce((s, d) => s + byDate.get(d)!.n, 0);
  const sx = 1 - S(xm) / S(xr);
  const sy = 1 - S(ym) / S(yr);
  const draws = blockDraws(dates.length, 777 + lead);
  const vals = draws.map((p) => (1 - S(xm, p) / S(xr, p)) - (1 - S(ym, p) / S(yr, p)));
  return {
    cases: N, days: dates.length, skillX: r3(sx), skillY: r3(sy), diff: r3(sx - sy), ci: [r3(quantile(vals, 0.025)), r3(quantile(vals, 0.975))],
    crpsX: r3(S(xm) / N), crpsY: r3(S(ym) / N),
    coverageX: r3(dates.reduce((s, d) => s + byDate.get(d)!.xi, 0) / N), coverageY: r3(dates.reduce((s, d) => s + byDate.get(d)!.yi, 0) / N),
  };
}

/** Single-model MAE ranking from per-case errors; site-debiased MAE removes each model's mean error per site (in-sample diagnostic). */
function modelRanking(run: any) {
  const names: Record<string, string> = Object.fromEntries(run.models.map((m: any) => [m.api, m.name]));
  const groups = new Map<string, number[]>();
  for (const [site, v, lead, model, , err] of run.singleModelErrors as Array<[string, string, number, string, string, number]>) {
    const k = `${v}|${lead}|${model}|${site}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(err);
  }
  const out: Array<{ variable: string; lead: number; model: string; name: string; cases: number; mae: number | null; maeSiteDebiased: number | null; bias: number | null; rank: number; rankDebiased: number }> = [];
  for (const v of ALL_VARS) for (const lead of LEADS) {
    const rows: Array<{ model: string; errs: number[]; deb: number[] }> = [];
    for (const [k, errs] of groups) {
      const [vv, ll, model] = k.split('|');
      if (vv !== v || Number(ll) !== lead) continue;
      const mean = avg(errs);
      let r = rows.find((x) => x.model === model);
      if (!r) { r = { model, errs: [], deb: [] }; rows.push(r); }
      r.errs.push(...errs);
      r.deb.push(...errs.map((e) => e - mean));
    }
    const stats = rows.map((r) => ({ variable: v, lead, model: r.model, name: names[r.model] ?? r.model, cases: r.errs.length, mae: r3(avg(r.errs.map(Math.abs))), maeSiteDebiased: r3(avg(r.deb.map(Math.abs))), bias: r3(avg(r.errs)), rank: 0, rankDebiased: 0 }));
    stats.slice().sort((a, b) => (a.mae ?? 9e9) - (b.mae ?? 9e9)).forEach((s, i) => { s.rank = i + 1; });
    stats.slice().sort((a, b) => (a.maeSiteDebiased ?? 9e9) - (b.maeSiteDebiased ?? 9e9)).forEach((s, i) => { s.rankDebiased = i + 1; });
    out.push(...stats.sort((a, b) => a.rank - b.rank));
  }
  return out;
}

const slim = (run: any) => ({
  file: run.__file, verification: run.verification ?? { truth: 'era5', sites: 'benchmark' }, period: run.period, generatedAt: run.generatedAt,
  sites: run.sites.map((s: any) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, modelsByLead: s.modelsByLead })),
  methods: run.methods, summary: run.summary, significance: run.significance, singleModels: run.singleModels, bySite: run.bySite,
});

const load = (rel: string) => ({ ...readJson(rel), __file: rel });
const summ = (run: any, v: string, lead: number, m: string) => run.summary.find((x: any) => x.variable === v && x.lead === lead && x.method === m);
const sig = (run: any, v: string, lead: number, m: string, vs: string) => run.significance.find((x: any) => x.variable === v && x.lead === lead && x.method === m && x.versus === vs);

/** Methods in the run's suite other than the references (picked up automatically when the suite grows). */
const candidates = (run: any) => run.methods.map((m: any) => m.id).filter((id: string) => !['climatology', 'raw-ensemble', 'raw-gauss'].includes(id));

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

function stationReport(period: 'dev' | 'confirm') {
  const stationsFile = readJson('research/data/stations.json');
  const runs = {
    era5All: load(period === 'confirm' ? 'public/research/weather-skill.json' : 'research/out/weather-final-dev.json'),
    era5StationDays: load(`research/out/weather-final-${period}-era5-stationdays.json`),
    deployed: load(`research/out/weather-final-${period}-stations-train-era5.json`),
    stationTrained: load(`research/out/weather-final-${period}-stations-train-stations.json`),
  };
  const headlineMethod = runs.deployed.headlineMethod ?? 'astraeus-v2';
  const truthLabel: Record<string, string> = {
    era5All: period === 'confirm' ? 'ERA5 · all 16 grid points (published benchmark)' : 'ERA5 · all 16 grid points (final suite, development days)',
    era5StationDays: 'ERA5 · station sites, station-observed days',
    deployed: 'Stations · trained on ERA5 (as deployed)',
    stationTrained: 'Stations · trained on stations',
  };
  // chain: how the headline skill changes from ERA5 to stations
  const chain: any[] = [];
  for (const m of candidates(runs.deployed)) for (const v of STATION_VARS) for (const lead of LEADS) for (const [key, run] of Object.entries(runs)) {
    const s = summ(run, v, lead, m);
    if (!s) continue;
    for (const vs of ['raw-gauss', 'raw-ensemble']) {
      const g = sig(run, v, lead, m, vs);
      const ref = summ(run, v, lead, vs);
      chain.push({
        method: m, variable: v, lead, truth: key, versus: vs, cases: s.cases, days: s.days,
        skill: vs === 'raw-gauss' ? s.crpssVsRawGauss : s.crpssVsRaw, ci: vs === 'raw-gauss' ? s.crpssVsRawGaussCI : s.crpssVsRawCI,
        robustMaxP: g?.robustMaxP ?? null, coverage80: s.coverage80, referenceCoverage80: ref?.coverage80 ?? null,
        pitLowest: s.pitLowest, pitHighest: s.pitHighest, bias: s.bias, referenceBias: ref?.bias ?? null, crps: s.crps, referenceCrps: ref?.crps ?? null,
      });
    }
  }
  // station-trained vs ERA5-trained, paired on identical station cases
  const tDep = caseTable(runs.deployed);
  const tSt = caseTable(runs.stationTrained);
  const tE5 = caseTable(runs.era5StationDays);
  const trainedMethods = runs.deployed.methods.filter((m: any) => m.window > 0).map((m: any) => m.id);
  const modes: any[] = [];
  for (const m of trainedMethods) for (const v of STATION_VARS) for (const lead of LEADS) {
    const r = pairedSkill(tSt, m, tDep, m, v, lead);
    if (r) modes.push({ method: m, variable: v, lead, ...r });
  }
  // per-site skill of the headline method over raw-gauss and raw-ensemble, pooled over leads
  const sites = runs.deployed.sites.map((s: any) => s.id);
  const perSite: any[] = [];
  for (const site of sites) for (const v of STATION_VARS) {
    const row: any = { site, variable: v };
    for (const [key, t] of [['era5StationDays', tE5], ['deployed', tDep], ['stationTrained', tSt]] as const) {
      let sm = 0, sg = 0, sr = 0, n = 0, inside = 0;
      for (const lead of LEADS) for (const [k, rr] of t.get(`${v}|${lead}`) ?? []) {
        if (!k.startsWith(`${site}|`) || !rr[headlineMethod]) continue;
        sm += rr[headlineMethod][0]; sg += rr['raw-gauss']?.[0] ?? NaN; sr += rr['raw-ensemble']?.[0] ?? NaN; inside += rr[headlineMethod][1]; n++;
      }
      row[key] = n ? { cases: n, crps: r3(sm / n), vsRawGauss: r3(1 - sm / sg), vsRaw: r3(1 - sm / sr), coverage80: r3(inside / n) } : null;
    }
    if (row.deployed) perSite.push(row);
  }
  const ranking = { era5StationDays: modelRanking(runs.era5StationDays), station: modelRanking(runs.deployed) };
  const json = {
    version: 'astraeus-station-verification-v1', generatedAt: new Date().toISOString(), period,
    periodLabel: runs.deployed.periodLabel, headlineMethod, reproduce: REPRODUCE.stations,
    stations: { version: stationsFile.version, generatedAt: stationsFile.generatedAt, window: stationsFile.window, rules: stationsFile.rules, sites: stationsFile.sites, excluded: stationsFile.excluded, sources: stationsFile.sources },
    truthLabels: truthLabel,
    runs: Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, slim(r)])),
    chain, modes, perSite, singleModelRanking: ranking,
    caveats: stationCaveats(stationsFile),
  };
  return json;
}

function stationCaveats(st: any) {
  const nT = st.sites.filter((s: any) => s.tmax).length;
  const nP = st.sites.filter((s: any) => s.precip).length;
  return [
    `Coverage is uneven: Tmax at ${nT} of 16 sites and precipitation at ${nP}, all but one in the United States, Australia and the Netherlands. The tropical and Southern-Hemisphere crop sites (Mato Grosso, Paraná, Minas Gerais, Daloa, Mekong) and Punjab, Beauce, Odesa and Jilin have no usable station, so station results describe mid-latitude, data-rich sites only.`,
    'GHCN-Daily records for the non-U.S. synoptic stations near these sites stop in August 2025; Meteostat fills its 2025–2026 daily files at the same stations with model forecasts (DWD MOSMIX, MET Norway), which are excluded here — verifying forecasts against model-filled “observations” would be circular.',
    'Representativeness: a station is a point 4–12 km from the grid point the forecasts were fetched for; station-minus-grid differences (elevation, coast, urban heat) are part of the station error and are not forecastable by the raw models. Forecasts were not refetched at station coordinates (Open-Meteo budget).',
    'Day conventions: forecasts and ERA5 are UTC days; station days are local (US ASOS midnight LST, Dubbo 9 am local for rainfall). The integer shift fixed on development data aligns the bulk of each day but cannot remove the 4–6-hour local-vs-UTC offset, which blurs precipitation more than Tmax.',
    'Tmean is not verified on stations: (Tmax+Tmin)/2 differs systematically from the 24-hour mean the forecasts are aggregated to, and the forecast cache holds no daily minimum to build a like-for-like (max+min)/2.',
    'Mode (b) trains on the same station it is verified on, with the same 6-day lag and windows as the ERA5-trained system; it is the realistic upper bound for site-specific calibration, not a deployable product for sites without a live station feed.',
    'Climatology reference: the station’s own 2019–2024 record where ≥ 60% complete; Córdoba Tmax (Meteostat METAR-derived, 47% complete) uses the ERA5 grid-point climatology instead.',
  ];
}

function stationMarkdown(dev: any, conf: any): string {
  const L: string[] = [];
  const st = conf.stations;
  const hm = conf.headlineMethod;
  const hmLabel = conf.runs.deployed.methods.find((m: any) => m.id === hm)?.label ?? hm;
  L.push('# Station verification', '');
  L.push(`Generated ${conf.generatedAt} · ${conf.version} · suite final · headline method ${hm}`, '');
  L.push('This study answers the first weakness of the ERA5 benchmark: ERA5 is a ~31 km reanalysis, so it rewards smooth forecasts — including ECMWF AIFS, which is trained on it. The same frozen methods are verified against weather-station observations in two modes:', '');
  L.push('- **(a) as deployed** — methods trained on ERA5 (6-day lag), verified on the station;');
  L.push('- **(b) station-trained** — the same methods trained on the station’s own observations with the same lag (the realistic upper bound for site-specific calibration).', '');
  L.push('A third run scores ERA5 truth on exactly the station site-days, so the change from the published headline splits into a site-subset effect (ERA5, 16 sites → ERA5, station site-days) and a truth effect (ERA5 → station). Forecasts are the cached grid-point forecasts at the benchmark coordinates; the station distance is part of the result.', '');
  L.push('## Stations', '');
  L.push(`Rules: ${st.rules.distance}; ${st.rules.coverage}; ${st.rules.preference}. Alignment: ${st.rules.alignment}.`, '');
  L.push('| Site | Variable | Station | Source | Distance | Elev. diff | Coverage Tmax / Tmin / PRCP | Shift | r (shift 0 / −1) | Climatology |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const s of st.sites) for (const v of ['tmax', 'precip']) {
    const c = s[v];
    if (!c) continue;
    L.push(`| ${s.name} | ${v === 'tmax' ? 'Tmax' : 'Precip.'} | ${c.id} ${c.name} | ${c.source === 'ghcnd' ? 'GHCN-Daily' : 'Meteostat'} | ${c.distanceKm} km | ${c.elevationDiffM === null ? '—' : `${c.elevationDiffM > 0 ? '+' : ''}${c.elevationDiffM} m`} | ${pct(c.coverage.tmax, 0)} / ${pct(c.coverage.tmin, 0)} / ${pct(c.coverage.prcp, 0)} | ${c.shift === 0 ? '0' : '−1'} | ${c.alignment.corrShift0?.toFixed(3) ?? '—'} / ${c.alignment.corrShiftMinus1?.toFixed(3) ?? '—'} | ${c.climatology.usable ? `station ${c.climatology.years.join('–')}` : 'ERA5 grid point'} |`);
  }
  L.push('', 'Elevation difference = station elevation − Copernicus GLO-90 DEM height at the benchmark coordinate. Coverage = share of days 2025-07-01 → 2026-11-08 with an accepted value. r = Pearson correlation of the re-dated station series with ERA5 at the site on development days only.', '');
  L.push('**Excluded (no usable station):**', '');
  const ex = new Map<string, string[]>();
  for (const e of st.excluded) { if (!ex.has(e.site)) ex.set(e.site, []); ex.get(e.site)!.push(`${e.variable === 'tmax' ? 'Tmax' : 'precipitation'}: ${e.reason}`); }
  for (const [site, rs] of ex) L.push(`- ${site} — ${rs.join('; ')}`);
  L.push('', `Licences: GHCN-Daily — ${st.sites.find((s: any) => s.tmax?.source === 'ghcnd')?.tmax.licence ?? ''} Meteostat — data © Meteostat contributors, CC BY-NC 4.0 (https://meteostat.net); used for Córdoba Tmax only.`, '');

  const chainTable = (j: any, title: string) => {
    L.push(`## ${title}`, '');
    L.push(`CRPS skill of ${hmLabel} over the zero-training Gaussian (raw-gauss) and the raw ensemble, 95% block-bootstrap interval, Diebold–Mariano p (largest over bandwidths), and 80% central-interval coverage from the PIT (v2 / raw-gauss / raw ensemble).`, '');
    for (const v of STATION_VARS) {
      L.push(`### ${VAR_LABEL[v]}`, '');
      L.push('| Lead | Truth | Cases | CRPS v2 | Skill vs raw-gauss (95% CI) | DM p | Skill vs raw ensemble (95% CI) | DM p | 80% coverage v2 / gauss / raw | v2 bias |', '|---|---|---|---|---|---|---|---|---|---|');
      for (const lead of LEADS) for (const key of ['era5All', 'era5StationDays', 'deployed', 'stationTrained']) {
        const g = j.chain.find((x: any) => x.method === hm && x.variable === v && x.lead === lead && x.truth === key && x.versus === 'raw-gauss');
        const r = j.chain.find((x: any) => x.method === hm && x.variable === v && x.lead === lead && x.truth === key && x.versus === 'raw-ensemble');
        if (!g || !r) continue;
        const run = j.runs[key];
        const cov = (m: string) => run.summary.find((x: any) => x.variable === v && x.lead === lead && x.method === m)?.coverage80;
        L.push(`| ${lead} | ${j.truthLabels[key]} | ${g.cases} | ${g.crps} | ${pct(g.skill)} ${ci(g.ci)} | ${pval(g.robustMaxP)} | ${pct(r.skill)} ${ci(r.ci)} | ${pval(r.robustMaxP)} | ${pct(cov(hm), 0)} / ${pct(cov('raw-gauss'), 0)} / ${pct(cov('raw-ensemble'), 0)} | ${g.bias} |`);
      }
      L.push('');
    }
  };
  chainTable(conf, 'Results — confirmation period (test days > 2026-03-31)');

  const modeTable = (j: any) => {
    L.push('### Station-trained (b) over as-deployed (a), paired on identical station cases', '');
    L.push('| Method | Variable | Lead | Cases | CRPS (a) | CRPS (b) | Skill of (b) over (a) (95% CI) | DM p | 80% coverage (a) / (b) |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of j.modes) L.push(`| ${r.method} | ${r.variable} | ${r.lead} | ${r.cases} | ${r.crpsB} | ${r.crpsA} | ${pct(r.skill)} ${ci(r.ci)} | ${pval(r.robustMaxP)} | ${pct(r.coverageB, 0)} / ${pct(r.coverageA, 0)} |`);
    L.push('');
  };
  modeTable(conf);

  // auto-generated findings (every number below is read from the tables)
  const f = (j: any, v: string, lead: number, key: string, vs = 'raw-gauss') => j.chain.find((x: any) => x.method === hm && x.variable === v && x.lead === lead && x.truth === key && x.versus === vs);
  L.push('### What changes against stations (confirmation period)', '');
  for (const lead of [1, 3, 5, 7]) {
    const a = f(conf, 'tmax', lead, 'era5All'), b = f(conf, 'tmax', lead, 'era5StationDays'), c = f(conf, 'tmax', lead, 'deployed'), d = f(conf, 'tmax', lead, 'stationTrained');
    if (a && b && c && d) L.push(`- Tmax day ${lead}: skill over raw-gauss ${pct(a.skill)} (ERA5, 16 sites) → ${pct(b.skill)} (ERA5, station site-days) → ${pct(c.skill)} (stations, as deployed; p ${pval(c.robustMaxP)}) → ${pct(d.skill)} (stations, station-trained; p ${pval(d.robustMaxP)}); v2 80% coverage ${pct(b.coverage80, 0)} (ERA5, station site-days) → ${pct(c.coverage80, 0)} (as deployed) → ${pct(d.coverage80, 0)} (station-trained).`);
  }
  for (const lead of [1, 3, 5, 7]) {
    const a = f(conf, 'precip', lead, 'era5All', 'raw-ensemble'), b = f(conf, 'precip', lead, 'era5StationDays', 'raw-ensemble'), c = f(conf, 'precip', lead, 'deployed', 'raw-ensemble'), d = f(conf, 'precip', lead, 'stationTrained', 'raw-ensemble');
    if (a && b && c && d) L.push(`- Precipitation day ${lead}: skill over the raw ensemble ${pct(a.skill)} (ERA5, 16 sites) → ${pct(b.skill)} (ERA5, station site-days) → ${pct(c.skill)} (stations, as deployed; p ${pval(c.robustMaxP)}) → ${pct(d.skill)} (station-trained; p ${pval(d.robustMaxP)}).`);
  }
  const climBeats = conf.runs.deployed.summary.filter((s: any) => s.variable === 'precip' && s.method === hm && s.crpssVsClimatology !== null && s.crpssVsClimatology < 0).map((s: any) => s.lead);
  if (climBeats.length) L.push(`- Against station rainfall the climatology reference beats ${hm} at lead(s) ${climBeats.join(', ')} (CRPSS vs climatology < 0 in the as-deployed run).`);
  L.push('');

  // single-model ranking
  L.push('## Single-model ranking: ERA5 vs station truth (confirmation period)', '');
  L.push('Mean absolute error of each raw model on identical cases (station site-days). “Site-debiased” removes each model’s mean error at each site over the period (an in-sample diagnostic separating systematic grid-vs-station offsets from day-to-day skill).', '');
  for (const v of STATION_VARS) {
    L.push(`### ${VAR_LABEL[v]}`, '');
    L.push('| Lead | Rank on ERA5 (MAE) | Rank on stations (MAE) | Rank on stations (site-debiased MAE) |', '|---|---|---|---|');
    for (const lead of LEADS) {
      const fmt = (rows: any[], key: 'mae' | 'maeSiteDebiased') => rows.filter((r) => r.variable === v && r.lead === lead).sort((a, b) => (a[key] ?? 9e9) - (b[key] ?? 9e9)).map((r) => `${r.name.replace(/^(ECMWF|NOAA|DWD|UK Met Office|JMA|ECCC) /, '')} ${r[key]}`).join(' · ');
      L.push(`| ${lead} | ${fmt(conf.singleModelRanking.era5StationDays, 'mae')} | ${fmt(conf.singleModelRanking.station, 'mae')} | ${fmt(conf.singleModelRanking.station, 'maeSiteDebiased')} |`);
    }
    L.push('');
  }
  const aifsLead = (j: any, key: 'era5StationDays' | 'station', field: 'rank' | 'rankDebiased') => j.singleModelRanking[key].filter((r: any) => r.model === 'ecmwf_aifs025_single' && r[field] === 1 && STATION_VARS.includes(r.variable)).length;
  const total = STATION_VARS.length * LEADS.length;
  L.push(`AIFS ranks first in ${aifsLead(conf, 'era5StationDays', 'rank')} of ${total} variable–lead cells on ERA5 (station site-days), ${aifsLead(conf, 'station', 'rank')} of ${total} on station MAE and ${aifsLead(conf, 'station', 'rankDebiased')} of ${total} on site-debiased station MAE (development period: ${aifsLead(dev, 'era5StationDays', 'rank')}, ${aifsLead(dev, 'station', 'rank')} and ${aifsLead(dev, 'station', 'rankDebiased')}).`, '');
  const gap = (j: any, key: 'era5StationDays' | 'station', v: string, lead: number) => {
    const rows = j.singleModelRanking[key].filter((r: any) => r.variable === v && r.lead === lead).sort((a: any, b: any) => a.mae - b.mae);
    const aifs = rows.find((r: any) => r.model === 'ecmwf_aifs025_single');
    const best = rows.find((r: any) => r.model !== 'ecmwf_aifs025_single');
    return aifs && best ? 1 - aifs.mae / best.mae : NaN;
  };
  L.push(`AIFS's MAE advantage over the best other model (Tmax): ${LEADS.map((l) => `day ${l} ${pct(gap(conf, 'era5StationDays', 'tmax', l))} on ERA5 vs ${pct(gap(conf, 'station', 'tmax', l))} on stations`).join('; ')} (negative = another model is better).`, '');

  // per site
  L.push('## Per site (all leads pooled, confirmation period)', '');
  L.push(`| Site | Variable | Cases | ${hm} skill vs raw-gauss: ERA5 / as deployed / station-trained | 80% coverage: ERA5 / as deployed / station-trained |`, '|---|---|---|---|---|');
  for (const r of conf.perSite) L.push(`| ${r.site} | ${r.variable} | ${r.deployed.cases} | ${pct(r.era5StationDays?.vsRawGauss)} / ${pct(r.deployed.vsRawGauss)} / ${pct(r.stationTrained?.vsRawGauss)} | ${pct(r.era5StationDays?.coverage80, 0)} / ${pct(r.deployed.coverage80, 0)} / ${pct(r.stationTrained?.coverage80, 0)} |`);
  L.push('');

  // dev period
  chainTable(dev, 'Development period (test days ≤ 2026-03-31)');
  modeTable(dev);

  // full method tables (every method in the suite)
  L.push('## All methods on station truth (confirmation period)', '');
  for (const key of ['deployed', 'stationTrained']) {
    const run = conf.runs[key];
    L.push(`### ${conf.truthLabels[key]}`, '');
    L.push('| Variable | Lead | Method | Cases | CRPS | CRPSS vs clim. | CRPSS vs raw (95% CI) | CRPSS vs raw-gauss (95% CI) | MAE | Bias | 80% coverage | PIT <0.1 / >0.9 |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const v of STATION_VARS) for (const lead of LEADS) for (const s of run.summary.filter((x: any) => x.variable === v && x.lead === lead)) {
      L.push(`| ${v} | ${lead} | ${s.method === 'climatology' ? 'Climatology (station record; ERA5 where too short)' : s.label} | ${s.cases} | ${s.crps} | ${pct(s.crpssVsClimatology)} | ${pct(s.crpssVsRaw)} ${ci(s.crpssVsRawCI)} | ${pct(s.crpssVsRawGauss)} ${ci(s.crpssVsRawGaussCI)} | ${s.mae} | ${s.bias} | ${pct(s.coverage80)} | ${pct(s.pitLowest, 0)} / ${pct(s.pitHighest, 0)} |`);
    }
    L.push('');
  }
  L.push('## Caveats', '', ...conf.caveats.map((c: string) => `- ${c}`), '');
  L.push('## Reproduce', '', '```', ...REPRODUCE.stations, '```', '');
  L.push('Archived results: `public/research/archive/weather-stations-dev.json`, `public/research/archive/weather-stations-confirm.json`. Station metadata: `research/data/stations.json`.', '');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

/**
 * Open-Meteo weight of the area fetch, recomputed from the request plan with the same formula the benchmark logs
 * (it matched the server's x-ratelimit-cost header to 0.1 on every request): locations × variables·models/10 × days/14, ≥ 1.
 */
function areaFetchWeight(areasFile: any, start: string, end: string, climYears: [number, number]) {
  const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5 + 1;
  const chunks = (s0: string, e0: string, months: number) => {
    const out: Array<[string, string]> = [];
    let s = new Date(`${s0}T00:00:00Z`);
    const e = new Date(`${e0}T00:00:00Z`);
    while (s <= e) {
      const n = new Date(s); n.setUTCMonth(n.getUTCMonth() + months); n.setUTCDate(n.getUTCDate() - 1);
      const stop = n < e ? n : e;
      out.push([s.toISOString().slice(0, 10), stop.toISOString().slice(0, 10)]);
      s = new Date(stop); s.setUTCDate(s.getUTCDate() + 1);
    }
    return out;
  };
  const w = (vars: number, d: number) => Math.max(1, (vars / 10) * (d / 14));
  const perPoint = {
    forecasts: chunks(start, end, 4).reduce((s, [a, b]) => s + w(4 * 2 * 7, days(a, b)), 0),
    era5: chunks(start, end, 6).reduce((s, [a, b]) => s + w(2, days(a, b)), 0),
    climatology: w(3, days(`${climYears[0]}-01-01`, `${climYears[1]}-12-31`)),
  };
  const points = areasFile.areas.reduce((s: number, a: any) => s + a.points.length, 0);
  const each = perPoint.forecasts + perPoint.era5 + perPoint.climatology;
  return { points, perPoint: Object.fromEntries(Object.entries(perPoint).map(([k, v]) => [k, Math.round(v * 10) / 10])), total: Math.round(points * each) };
}

function areaReport() {
  const areasFile = readJson('research/data/areas.json');
  const area = load('research/out/weather-final-confirm-areas-clim2022-2024.json');
  const point = load('research/out/weather-final-confirm-era5-iowa+mato-grosso+minas+northeast-clim2022-2024.json');
  const hm = area.headlineMethod ?? 'astraeus-v2';
  const tA = caseTable(area);
  const tP = caseTable(point);
  const pairs: Array<[string, string]> = areasFile.areas.map((a: any) => [a.id, a.benchmarkSite]);
  const rows: any[] = [];
  for (const m of candidates(area)) for (const ref of ['raw-gauss', 'raw-ensemble', 'climatology']) for (const v of ALL_VARS) for (const lead of LEADS) {
    const pooled = skillDiff(tA, tP, m, ref, v, lead, pairs);
    if (pooled) rows.push({ method: m, versus: ref, variable: v, lead, scope: 'pooled', ...pooled });
    for (const pr of pairs) {
      const one = skillDiff(tA, tP, m, ref, v, lead, [pr]);
      if (one) rows.push({ method: m, versus: ref, variable: v, lead, scope: pr[0], ...one });
    }
  }
  const membership = areasFile.areas.map((a: any) => ({
    area: a.id, site: a.benchmarkSite,
    areaModels: area.sites.find((s: any) => s.id === a.id)?.modelsByLead, siteModels: point.sites.find((s: any) => s.id === a.benchmarkSite)?.modelsByLead,
  }));
  return {
    version: 'astraeus-area-verification-v1', generatedAt: new Date().toISOString(), period: 'confirm', periodLabel: area.periodLabel, headlineMethod: hm,
    reproduce: REPRODUCE.areas, areas: areasFile, runs: { area: slim(area), point: slim(point) }, membership,
    openMeteoWeight: areaFetchWeight(areasFile, area.verification?.areaForecastStart ?? '2025-12-15', area.config.forecastEnd, area.verification?.climatologyYears ?? [2022, 2024]),
    comparisons: rows,
    caveats: [
      'Confirmation period only (test days 2026-04-01 → 2026-11-08): area forecasts were fetched from 2025-12-15 to fit the Open-Meteo budget, which leaves no development-period history for the areas.',
      'Climatology uses ERA5 2022–2024 for both the areas and the single points in this comparison (3 years to fit the budget; the published benchmark uses 2019–2024), so CRPSS vs climatology here is not comparable with the published table.',
      'Four points per area: the area mean is a 4-point production-weighted average, not a full areal integral; it removes much but not all small-scale noise.',
      'Skill differences compare scores on different truths (area-mean ERA5 vs grid-point ERA5): the area mean is smoother and easier to forecast, so CRPS levels fall; the question is whether post-processing gains (CRPSS) survive, not whether CRPS is lower.',
      'Model membership is fixed per run from availability (≥ 90% of days) over each run’s own archive. UK Met Office day-1 forecasts have a gap of about six weeks in April–May 2026 in the Previous-Runs archive: over the single points’ full archive (from 2025-07-01) the model passes the rule, over the shorter area archive (from 2025-12-15) it does not, so day-1 area forecasts use 6 models and day-1 point forecasts 7. Leads 3–7 use identical models.',
      'ERA5 remains the truth here; production-weighted station networks would be the natural next step.',
    ],
  };
}

function areaMarkdown(j: any): string {
  const L: string[] = [];
  const hm = j.headlineMethod;
  L.push('# Production-weighted area verification', '');
  L.push(`Generated ${j.generatedAt} · ${j.version} · suite final · ${j.periodLabel}`, '');
  L.push('This study answers the second weakness of the ERA5 benchmark: each commodity region is one grid point, not the production-weighted area that drives supply or demand. For four regions the producing counties / municipalities were clustered into four points (production-weighted k-medoids), each weighted by the share of production — population for heating demand — nearest to it. Every model’s daily forecast and ERA5 were averaged over the points with those weights, and the frozen methods were run unchanged on the area means. The single grid point is scored on the same days with the same climatology years for comparison.', '');
  L.push('## Areas and points', '');
  for (const a of j.areas.areas) {
    L.push(`### ${a.name} — ${a.measure}, ${a.year}`, '');
    L.push(`${a.units} ${a.id === 'northeast-heating' ? 'counties' : a.id === 'iowa-corn' ? 'counties with published production' : 'producing municipalities'}, total ${a.totalValue.toLocaleString('en-US')} ${a.unit}${a.unallocatedValue ? ` (${a.unallocatedValue.toLocaleString('en-US')} ${a.unit} suppressed at county level and not allocated)` : ''}; production-weighted mean distance to the assigned point ${a.meanDistanceKm} km; compared with benchmark site \`${a.benchmarkSite}\`.`, '');
    L.push('| Point | Medoid unit | Lat | Lon | Weight | Units assigned |', '|---|---|---|---|---|---|');
    for (const p of a.points) L.push(`| ${p.id} | ${p.name} | ${p.lat} | ${p.lng} | ${pct(p.weight)} | ${p.unitsAssigned} |`);
    L.push('', `Sources: ${a.sources.map((s: any) => `[${s.title}](${s.url})${s.note ? ` — ${s.note}` : ''}`).join('; ')}.`, '');
  }
  const mm = j.membership.filter((m: any) => JSON.stringify(m.areaModels) !== JSON.stringify(m.siteModels));
  if (mm.length) {
    L.push('Model membership differs between area and point for: ' + mm.map((m: any) => `${m.area} (${LEADS.filter((l) => JSON.stringify(m.areaModels?.[l]) !== JSON.stringify(m.siteModels?.[l])).map((l) => `day ${l}: area ${m.areaModels?.[l]?.length ?? 0} vs point ${m.siteModels?.[l]?.length ?? 0} models`).join(', ')})`).join('; ') + '.', '');
  }
  L.push(`Open-Meteo cost: ${j.openMeteoWeight.points} points × ${(j.openMeteoWeight.total / j.openMeteoWeight.points).toFixed(1)} weighted calls (forecasts ${j.openMeteoWeight.perPoint.forecasts}, ERA5 ${j.openMeteoWeight.perPoint.era5}, climatology ${j.openMeteoWeight.perPoint.climatology}) = ${j.openMeteoWeight.total} weighted calls.`, '');
  L.push('## Area mean vs single point (pooled over the four regions)', '');
  L.push(`Skill = pooled CRPSS of ${hm} over the reference on paired region-days; the difference (area − point) has a 95% moving-block bootstrap interval over days.`, '');
  for (const ref of ['raw-gauss', 'raw-ensemble']) {
    L.push(`### ${hm} over ${ref}`, '');
    L.push('| Variable | Lead | Cases | CRPS area / point | Skill area | Skill point | Area − point (95% CI) | 80% coverage area / point |', '|---|---|---|---|---|---|---|---|');
    for (const v of ALL_VARS) for (const lead of LEADS) {
      const r = j.comparisons.find((x: any) => x.method === hm && x.versus === ref && x.variable === v && x.lead === lead && x.scope === 'pooled');
      if (r) L.push(`| ${v} | ${lead} | ${r.cases} | ${r.crpsX} / ${r.crpsY} | ${pct(r.skillX)} | ${pct(r.skillY)} | ${pct(r.diff)} ${ci(r.ci)} | ${pct(r.coverageX, 0)} / ${pct(r.coverageY, 0)} |`);
    }
    L.push('');
  }
  L.push('## By region', '');
  L.push(`| Region | Variable | Lead | ${hm} vs raw-gauss: area / point | Area − point (95% CI) | vs raw ensemble: area / point | vs climatology: area / point |`, '|---|---|---|---|---|---|---|');
  for (const a of j.areas.areas) for (const v of ALL_VARS) for (const lead of [1, 5]) {
    const g = j.comparisons.find((x: any) => x.method === hm && x.versus === 'raw-gauss' && x.variable === v && x.lead === lead && x.scope === a.id);
    const r = j.comparisons.find((x: any) => x.method === hm && x.versus === 'raw-ensemble' && x.variable === v && x.lead === lead && x.scope === a.id);
    const c = j.comparisons.find((x: any) => x.method === hm && x.versus === 'climatology' && x.variable === v && x.lead === lead && x.scope === a.id);
    if (g && r && c) L.push(`| ${a.name} | ${v} | ${lead} | ${pct(g.skillX)} / ${pct(g.skillY)} | ${pct(g.diff)} ${ci(g.ci)} | ${pct(r.skillX)} / ${pct(r.skillY)} | ${pct(c.skillX)} / ${pct(c.skillY)} |`);
  }
  L.push('', 'Leads 1 and 5 shown; all leads and methods are in `public/research/archive/weather-areas-confirm.json`.', '');
  L.push('## All methods on area-mean ERA5 (pooled)', '');
  L.push('| Variable | Lead | Method | Cases | CRPS | CRPSS vs clim. (ERA5 2022–2024) | CRPSS vs raw (95% CI) | CRPSS vs raw-gauss (95% CI) | Bias | 80% coverage |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const v of ALL_VARS) for (const lead of LEADS) for (const s of j.runs.area.summary.filter((x: any) => x.variable === v && x.lead === lead)) {
    L.push(`| ${v} | ${lead} | ${s.method === 'climatology' ? 'Climatology (area-mean ERA5 2022–2024, ±7 d)' : s.label} | ${s.cases} | ${s.crps} | ${pct(s.crpssVsClimatology)} | ${pct(s.crpssVsRaw)} ${ci(s.crpssVsRawCI)} | ${pct(s.crpssVsRawGauss)} ${ci(s.crpssVsRawGaussCI)} | ${s.bias} | ${pct(s.coverage80)} |`);
  }
  L.push('', '## Caveats', '', ...j.caveats.map((c: string) => `- ${c}`), '');
  L.push('## Reproduce', '', '```', ...REPRODUCE.areas, '```', '');
  return L.join('\n');
}

// ---------------------------------------------------------------------------

function main() {
  const arch = path.join(ROOT, 'public', 'research', 'archive');
  const docs = path.join(ROOT, 'docs', 'results');
  mkdirSync(arch, { recursive: true });
  mkdirSync(docs, { recursive: true });
  const dev = stationReport('dev');
  const conf = stationReport('confirm');
  writeFileSync(path.join(arch, 'weather-stations-dev.json'), JSON.stringify(dev));
  writeFileSync(path.join(arch, 'weather-stations-confirm.json'), JSON.stringify(conf));
  writeFileSync(path.join(docs, 'STATION_VERIFICATION.md'), stationMarkdown(dev, conf));
  console.log('wrote weather-stations-dev.json, weather-stations-confirm.json, STATION_VERIFICATION.md');
  if (existsSync(path.join(ROOT, 'research', 'out', 'weather-final-confirm-areas-clim2022-2024.json'))) {
    const areas = areaReport();
    writeFileSync(path.join(arch, 'weather-areas-confirm.json'), JSON.stringify(areas));
    writeFileSync(path.join(docs, 'AREA_VERIFICATION.md'), areaMarkdown(areas));
    console.log('wrote weather-areas-confirm.json, AREA_VERIFICATION.md');
  } else console.log('area runs not found — skipped the area report');
}

main();
