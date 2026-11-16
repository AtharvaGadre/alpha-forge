/**
 * Astraeus technical report — a single, data-driven source rendered both in the app (TechnicalReport.tsx)
 * and to Markdown (research/build-report.ts → docs/TECHNICAL_REPORT.md). Every number is computed from
 * the published result files; citations use [@id] markers resolved against RESEARCH_LIBRARY.
 */
import type { PriceSkill, SkillRow, WeatherSkill } from './researchData';

export type ReportBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'eq'; text: string; label?: string }
  | { type: 'table'; caption: string; head: string[]; rows: string[][]; note?: string; highlightRow?: (row: string[]) => boolean }
  | { type: 'figure'; kind: 'skill-by-lead' | 'reliability' | 'fan' | 'price-matrix' | 'leaderboard'; caption: string; variable?: string; lead?: number };

export interface ReportSection { id: string; title: string; blocks: ReportBlock[] }
export interface ReportDoc { title: string; subtitle: string; meta: string[]; abstract: string; keywords: string[]; sections: ReportSection[]; cited: string[] }

const pc = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);
const sp = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%`);
const f3 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(3));
const pv = (p: number | null | undefined) => (p == null || !Number.isFinite(p) ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3));
const VAR: Record<string, string> = { tmean: 'daily mean temperature', tmax: 'daily maximum temperature', precip: 'daily precipitation' };
const VAR_SHORT: Record<string, string> = { tmean: 'Mean temp.', tmax: 'Max temp.', precip: 'Precip.' };
const METHOD: Record<string, string> = {
  climatology: 'Climatology', 'raw-ensemble': 'Raw ensemble', 'astraeus-v1': 'Astraeus v1', 'bias-corrected': 'Bias-corrected ensemble', emos: 'EMOS (40 d)', 'emos-weighted': 'EMOS, learned weights (40 d)', 'astraeus-v2': 'Astraeus v2',
};
const mname = (m: string) => METHOD[m] ?? m.replace(/-(\d+)$/, ' ($1 d)').replace('ngr-skill-clim', 'Skill NGR + clim.').replace('ngr-skill', 'Skill-weighted NGR').replace('weighted-ensemble', 'Skill-weighted ensemble').replace('sqrt-censored-w', '√-censored, weighted').replace('cbrt-censored-w', '∛-censored, weighted').replace('sqrt-censored', '√-censored');

function get(w: WeatherSkill | null, v: string, lead: number, m: string): SkillRow | undefined {
  return w?.summary.find((s) => s.variable === v && s.lead === lead && s.method === m);
}

/** Result files added in revision 3; all optional so the report degrades gracefully when one is missing. */
export interface ChainRow { method: string; variable: string; lead: number; truth: string; versus: string; cases: number; skill: number; ci: [number, number]; robustMaxP: number; coverage80: number }
export interface StationArchive {
  stations: { sites: Array<{ site: string; name: string; tmax?: { source: string; name: string; distanceKm: number } | null; precip?: { source: string; name: string; distanceKm: number } | null }>; excluded: Array<{ site: string; variable: string; reason: string }> };
  chain: ChainRow[];
  singleModelRanking: Record<string, Array<{ variable: string; lead: number; model: string; name: string; mae: number; maeSiteDebiased: number; rank: number; rankDebiased: number }>>;
  caveats: string[];
}
export interface AreaArchive {
  areas: { areas: Array<{ id: string; name: string; commodity: string; measure: string; year: number; sources: Array<{ title: string; url: string }> }> };
  comparisons: Array<{ method: string; versus: string; variable: string; lead: number; scope: string; cases: number; days: number; skillX: number; skillY: number; diff: number; ci: [number, number]; coverageX: number; coverageY: number }>;
  caveats: string[];
}
export interface TrackSummary { startDate: string; latestSnapshot: string | null; snapshots: number; regionsLatest: number; ledger: { head: string; length: number; ok: boolean }; cases: { total: number; scored: number; pending: number }; nextScoresExpected: string | null; methodVersions: Record<string, number> }
export interface V3Tests { freezeCommit: string; confirm: { rows: Array<{ variable: string; lead: number; meanDiff: number; pValue: number; robustMaxP: number }> } }
export interface ReportExtras { v3dev?: WeatherSkill | null; v3tests?: V3Tests | null; stations?: StationArchive | null; areas?: AreaArchive | null; storage?: StorageSummary | null; track?: TrackSummary | null }
/** Slim view of public/research/storage-skill.json + price-revisions.json written by research/build-report.ts. */
export interface StorageSummary {
  generatedAt: string;
  comparisons: Array<{ id: string; window: 'multi' | 'gfs'; ref: string; model: string; confirmatory: boolean; q: number | null; refLabel: string; modelLabel: string; n: number; rmseRef: number; rmseModel: number; skillMse: number; ci: [number, number]; p: number }>;
  bySeason: Array<{ window: string; season: string; n: number; rmse: Record<string, number> }>;
  sensitivity: { bcfPerHdd: number; tHdd: number; bcfPerCdd: number };
  windows: { multi?: number; gfs?: number };
  missingGfsWeeks: string[];
  caveats: string[];
  revisions: { n: number; start: string; end: string; family: Array<{ key: string; label: string; q: number | null; cwP: number; dmP: number; qDm: number | null }> } | null;
}

export function buildReport(w: WeatherSkill, price: PriceSkill | null, dev: WeatherSkill | null, run1: WeatherSkill | null, extra: ReportExtras = {}): ReportDoc {
  const head = w.headlineMethod ?? 'astraeus-v2';
  const leads = w.config.leads;
  const L1 = leads[0];
  const LN = leads[leads.length - 1];
  const cases = w.summary.filter((s) => s.method === head).reduce((a, s) => a + s.cases, 0);
  const days = Math.max(...w.summary.map((s) => s.days));
  const hasGauss = w.summary.some((s) => s.method === 'raw-gauss');
  const r = (v: string, l: number, m = head) => get(w, v, l, m);
  const sig = (v: string, l: number, versus: string) => w.significance.find((s) => s.method === head && s.variable === v && s.lead === l && s.versus === versus);
  const isSig = (v: string, l: number, versus: string) => { const x = sig(v, l, versus); return !!x && x.meanDiff < 0 && (x.robustMaxP ?? x.pValue) < 0.05; };
  const cells = (versus: string, vars = ['tmax', 'tmean', 'precip']) => vars.flatMap((v) => leads.map((l) => ({ v, l, s: sig(v, l, versus) }))).filter((c) => c.s);
  const countSig = (versus: string, vars?: string[]) => cells(versus, vars).filter((c) => isSig(c.v, c.l, versus)).length;
  const worse = (versus: string, vars?: string[]) => cells(versus, vars).filter((c) => c.s!.meanDiff > 0 && (c.s!.robustMaxP ?? c.s!.pValue) < 0.05).length;
  const vsG = (v: string, l: number) => r(v, l)?.crpssVsRawGauss ?? NaN;
  const vsR = (v: string, l: number) => r(v, l)?.crpssVsRaw ?? NaN;
  const members = leads.map((l) => r('tmax', l, 'raw-ensemble')?.members ?? NaN);
  const cov = (v: string, l: number, m = head) => r(v, l, m)?.coverage80 ?? NaN;
  const covRange = (v: string, m = head) => { const xs = leads.map((l) => cov(v, l, m)); return `${pc(Math.min(...xs), 0)}–${pc(Math.max(...xs), 0)}`; };
  const lowBin = (v: string) => { const xs = leads.map((l) => r(v, l)?.pitLowest ?? NaN); return `${pc(Math.min(...xs), 0)}–${pc(Math.max(...xs), 0)}`; };
  const best = (v: string, lead: number) => [...w.singleModels.filter((m) => m.variable === v && m.lead === lead)].sort((a, b) => a.mae - b.mae);
  const aifsBestCount = w.variables.reduce((a, vv) => a + leads.filter((l) => best(vv.id, l)[0]?.model === 'ecmwf_aifs025_single').length, 0);
  const site = (id: string) => w.sites.find((x) => x.id === id)?.name ?? id;
  const siteSkill = w.bySite.filter((x) => x.variable === 'tmax' && x.lead === 3).map((x) => ({ id: String(x.site), s: 1 - Number(x[head]) / Number(x['raw-ensemble']) })).sort((a, b) => b.s - a.s);
  const rainSiteCells = w.bySite.filter((x) => x.variable === 'precip');
  const rainWorse = rainSiteCells.filter((x) => Number(x[head]) > Number(x['raw-ensemble'])).length;
  const fairTmax1 = r('tmax', L1, 'raw-ensemble')?.crpsFair;

  // development-period selection (pooled rule)
  const devMean = (m: string, vars: string[]) => (dev ? vars.flatMap((v) => leads.map((l) => get(dev, v, l, m)?.crpssVsRaw ?? NaN)).filter(Number.isFinite) : []).reduce((a, x, _i, arr) => a + x / arr.length, 0);
  const tempCands = dev ? [...new Set(dev.summary.filter((s) => s.variable === 'tmax').map((s) => s.method))].filter((m) => m !== 'climatology' && m !== 'raw-ensemble') : [];
  const pooledTemp = tempCands.map((m) => ({ m, pooled: devMean(m, ['tmax', 'tmean']), tmax: devMean(m, ['tmax']), tmean: devMean(m, ['tmean']) })).sort((a, b) => b.pooled - a.pooled);
  const rainCands = dev ? [...new Set(dev.summary.filter((s) => s.variable === 'precip').map((s) => s.method))].filter((m) => m !== 'climatology' && m !== 'raw-ensemble') : [];
  const pooledRain = rainCands.map((m) => ({ m, pooled: devMean(m, ['precip']) })).sort((a, b) => b.pooled - a.pooled);
  const tmaxLeader = [...pooledTemp].sort((a, b) => b.tmax - a.tmax)[0];

  // dev-only replay of the exploratory first run
  const r1cov = run1 ? (['tmean', 'tmax'] as const).map((v) => get(run1, v, 1, 'emos')?.coverage80 ?? NaN) : [];
  const r1rain = run1 ? leads.map((l) => get(run1, 'precip', l, 'emos')?.crpssVsRaw ?? NaN).filter(Number.isFinite) : [];

  // price findings
  const sigPrice = (price?.rows ?? []).filter((x) => x.qCwWxVsMkt != null && x.qCwWxVsMkt < 0.1 && x.metrics.oosR2WxVsMkt > 0);
  const positive = (price?.rows ?? []).filter((x) => x.metrics.oosR2WxVsMkt > 0).length;
  const tierLabel: Record<string, string> = { REALISED_LAGGED: 'realised weather, lagged', ORACLE_TARGET_WINDOW: 'look-ahead diagnostic (realised holding-period weather)', NWP_FORECAST: 'NWP forecasts known at origin' };
  const priceAbstract = !price ? 'The companion price study was not available when this report was generated.'
    : sigPrice.length
      ? `In a walk-forward study of weekly futures returns for ${price.commodities.length} weather-sensitive commodities, weather information improved out-of-sample forecasts over a market-only model in ${positive} of ${price.rows.length} commodity–information–horizon cells (point estimates); after Benjamini–Hochberg correction the only surviving cell is ${sigPrice.map((x) => `${x.name} with ${tierLabel[x.tier] ?? x.tier} at ${x.horizonWeeks} week${x.horizonWeeks > 1 ? 's' : ''} (R² gain over the market-only model ${sp(x.metrics.oosR2WxVsMkt)}, Clark–West q = ${pv(x.qCwWxVsMkt)}), which nevertheless did not significantly beat a no-change forecast (Diebold–Mariano p = ${pv(x.metrics.dmWxVsRw?.p)}; out-of-sample R² ${sp(x.metrics.oosR2Wx)}, 95% CI ${sp(x.metrics.oosR2WxCi95?.lo)} to ${sp(x.metrics.oosR2WxCi95?.hi)}) and rests on ${x.metrics.n} weeks`).join('; ')}.`
      : `In a walk-forward study of weekly futures returns for ${price.commodities.length} weather-sensitive commodities, no weather-information set improved out-of-sample forecasts over a market-only model after Benjamini–Hochberg correction (${positive} of ${price.rows.length} cells had a positive point estimate).`;

  const cited = new Set<string>();
  const c = (text: string) => { for (const m of text.matchAll(/@([a-z0-9-]+)/g)) cited.add(m[1]); return text; };
  const P = (text: string): ReportBlock => ({ type: 'p', text: c(text) });
  const Lst = (items: string[]): ReportBlock => ({ type: 'list', items: items.map(c) });

  const mainRows: string[][] = [];
  for (const v of ['tmax', 'tmean', 'precip']) for (const l of leads) {
    const x = r(v, l);
    if (!x) continue;
    const dg = sig(v, l, 'raw-gauss');
    const dr = sig(v, l, 'raw-ensemble');
    const dv1 = sig(v, l, 'astraeus-v1');
    mainRows.push([VAR_SHORT[v], `Day ${l}`, String(x.cases), String(x.members ?? '—'), f3(r(v, l, 'raw-ensemble')?.crps), f3(r(v, l, 'raw-gauss')?.crps), f3(x.crps),
      `${sp(x.crpssVsRawGauss)} (${sp(x.crpssVsRawGaussCI?.[0])}, ${sp(x.crpssVsRawGaussCI?.[1])})`, pv(dg?.robustMaxP ?? dg?.pValue),
      `${sp(x.crpssVsRaw)} (${sp(x.crpssVsRawCI[0])}, ${sp(x.crpssVsRawCI[1])})`, pv(dr?.robustMaxP ?? dr?.pValue),
      sp(x.crpssVsV1), pv(dv1?.robustMaxP ?? dv1?.pValue), pc(x.coverage80, 0)]);
  }
  const calRows: string[][] = [];
  for (const v of ['tmax', 'tmean', 'precip']) for (const l of leads) {
    const a = r(v, l, 'raw-ensemble');
    const g = r(v, l, 'raw-gauss');
    const x = r(v, l);
    if (!a || !x) continue;
    calRows.push([VAR_SHORT[v], `Day ${l}`, pc(a.coverage80, 0), g ? pc(g.coverage80, 0) : '—', pc(x.coverage80, 0), pc(x.pitLowest, 0), pc(x.pitHighest, 0), f3(a.crpsFair), f3(x.crps)]);
  }
  const devRows: string[][] = [];
  if (dev) for (const v of ['tmax', 'tmean', 'precip']) {
    const methods = [...new Set(dev.summary.filter((s) => s.variable === v).map((s) => s.method))].filter((m) => m !== 'climatology');
    const ranked = methods.map((m) => ({ m, mean: devMean(m, [v]) })).sort((a, b) => b.mean - a.mean).slice(0, 4);
    ranked.forEach((x, i) => devRows.push([i === 0 ? VAR_SHORT[v] : '', mname(x.m), ...leads.map((l) => sp(get(dev, v, l, x.m)?.crpssVsRaw)), sp(x.mean)]));
  }
  const regionRows = w.sites.map((x) => [x.name, x.commodities.join(', '), `${x.lat.toFixed(2)}, ${x.lng.toFixed(2)}`, leads.map((l) => x.modelsByLead?.[l]?.length ?? '—').join(' / ')]);
  const priceRows = (price?.rows ?? []).map((x) => [x.name, tierLabel[x.tier] ?? x.tier, `${x.horizonWeeks} wk`, String(x.metrics.n), sp(x.metrics.oosR2Wx, 2), sp(x.metrics.oosR2WxVsMkt, 2), pv(x.metrics.cwWxVsMkt?.p), pv(x.qCwWxVsMkt), pv(x.metrics.dmWxVsRw?.p), pc(x.metrics.hitRateWx, 1)]);

  const tempCells = leads.length * 2;
  const gaussSigTemp = countSig('raw-gauss', ['tmax', 'tmean']);
  const rawSigAll = countSig('raw-ensemble');
  const v1Better = countSig('astraeus-v1');
  const v1Worse = worse('astraeus-v1');
  const v1Cells = cells('astraeus-v1').length;
  const v1Ties = cells('astraeus-v1').filter((x) => !isSig(x.v, x.l, 'astraeus-v1') && !(x.s!.meanDiff > 0 && (x.s!.robustMaxP ?? x.s!.pValue) < 0.05));
  const prospective = w.config.prospectiveStart ?? '2026-11-16';

  // ── Revision 3: Astraeus v3 (dispersion correction) ──────────────────────────────
  const V3 = 'astraeus-v3';
  const hasV3 = w.summary.some((x) => x.method === V3);
  const pooled = (src: WeatherSkill | null | undefined, m: string, key: 'crps' | 'coverage80' | 'pitLowest' | 'pitHighest', vars = ['tmax', 'tmean']) => {
    const rows = (src?.summary ?? []).filter((x) => x.method === m && vars.includes(x.variable));
    const n = rows.reduce((a, x) => a + x.cases, 0);
    return n ? rows.reduce((a, x) => a + Number(x[key] ?? NaN) * x.cases, 0) / n : NaN;
  };
  const v3dev = extra.v3dev ?? null;
  const v3Cands = v3dev ? v3dev.methods.filter((m) => !['climatology', 'raw-ensemble', 'raw-gauss'].includes(m.id)) : [];
  const v3CandRows = v3Cands.map((m) => [m.id === 'astraeus-v2' ? 'Astraeus v2 (reference)' : m.label.replace(/^C(\d) /, 'C$1 · '), pooled(v3dev, m.id, 'crps').toFixed(4), m.id === 'astraeus-v2' ? '—' : sp(1 - pooled(v3dev, m.id, 'crps') / pooled(v3dev, 'astraeus-v2', 'crps'), 2), pc(pooled(v3dev, m.id, 'coverage80'), 1)]);
  const sigV3 = (v: string, l: number) => w.significance.find((x) => x.method === V3 && x.variable === v && x.lead === l && x.versus === 'raw-gauss');
  const v3Rows: string[][] = hasV3 ? ['tmax', 'tmean'].flatMap((v) => leads.map((l) => { const a = r(v, l); const b = r(v, l, V3); const sg = sigV3(v, l); return [VAR_SHORT[v], `Day ${l}`, sp(a?.crpssVsRawGauss), sp(b?.crpssVsRawGauss), pv(sg?.robustMaxP ?? sg?.pValue), pc(a?.coverage80, 1), pc(b?.coverage80, 1), pc(a?.pitLowest, 1), pc(b?.pitLowest, 1)]; })) : [];
  const v3SigTemp = hasV3 ? ['tmax', 'tmean'].flatMap((v) => leads.map((l) => sigV3(v, l))).filter((x) => x && x.meanDiff < 0 && (x.robustMaxP ?? x.pValue) < 0.05).length : 0;
  const v3vsv2 = (extra.v3tests?.confirm?.rows ?? []).filter((x) => x.variable !== 'precip');
  const v3vsv2Better = v3vsv2.filter((x) => x.meanDiff < 0 && x.pValue < 0.05).length;
  const v3vsv2Robust = v3vsv2.filter((x) => x.meanDiff < 0 && x.robustMaxP < 0.05).length;

  // ── Revision 3: station truth and production-weighted areas ──────────────────────
  const st = extra.stations ?? null;
  const stSites = (k: 'tmax' | 'precip') => (st?.stations.sites ?? []).filter((x) => x[k]);
  const chain = (m: string, v: string, l: number, truth: string, versus: string) => st?.chain.find((x) => x.method === m && x.variable === v && x.lead === l && x.truth === truth && x.versus === versus);
  const truthName: Record<string, string> = { era5All: 'ERA5, all 16 regions', era5StationDays: 'ERA5, station sites and days', deployed: 'Stations, ERA5-trained (as deployed)', stationTrained: 'Stations, station-trained' };
  const stMethods = ['astraeus-v2', ...(st?.chain.some((x) => x.method === V3) ? [V3] : [])];
  const stRows: string[][] = st ? stMethods.flatMap((m) => Object.keys(truthName).map((t) => [m === V3 ? 'v3' : 'v2', truthName[t], ...leads.map((l) => { const x = chain(m, 'tmax', l, t, 'raw-gauss'); return x ? `${sp(x.skill)} (p ${pv(x.robustMaxP)})` : '—'; }), (() => { const xs = leads.map((l) => chain(m, 'tmax', l, t, 'raw-gauss')?.coverage80 ?? NaN).filter(Number.isFinite); return xs.length ? `${pc(Math.min(...xs), 0)}–${pc(Math.max(...xs), 0)}` : '—'; })()])) : [];
  const stRain = (t: string) => leads.map((l) => chain('astraeus-v2', 'precip', l, t, 'raw-ensemble')?.skill ?? NaN).filter(Number.isFinite);
  const range = (xs: number[]) => (xs.length ? `${sp(Math.min(...xs))} to ${sp(Math.max(...xs))}` : '—');
  const aifsMargin = (truth: string, l: number) => {
    const rows = (st?.singleModelRanking[truth] ?? []).filter((x) => x.variable === 'tmax' && x.lead === l).sort((a, b) => a.mae - b.mae);
    const ai = rows.find((x) => x.model === 'ecmwf_aifs025_single');
    const other = rows.find((x) => x.model !== 'ecmwf_aifs025_single');
    return ai && other ? { rank: rows.indexOf(ai) + 1, margin: 1 - ai.mae / other.mae, next: other.name } : null;
  };
  const ar = extra.areas ?? null;
  const areaCmp = (m: string, v: string, l: number, versus: string) => ar?.comparisons.find((x) => x.method === m && x.variable === v && x.lead === l && x.versus === versus && x.scope === 'pooled');
  const areaMethods = ['astraeus-v2', ...(ar?.comparisons.some((x) => x.method === V3) ? [V3] : [])];
  const areaRows: string[][] = ar ? areaMethods.flatMap((m) => ['tmax', 'tmean'].map((v) => [m === V3 ? 'v3' : 'v2', VAR_SHORT[v], ...leads.map((l) => { const x = areaCmp(m, v, l, 'raw-gauss'); return x ? `${sp(x.skillX)} vs ${sp(x.skillY)}` : '—'; })])) : [];
  const areaRain = leads.map((l) => areaCmp('astraeus-v2', 'precip', l, 'raw-ensemble')?.skillX ?? NaN).filter(Number.isFinite);
  const track = extra.track ?? null;
  // ── Revision 3: natural-gas storage fundamentals ──────────────────────────────────
  const ng = extra.storage ?? null;
  const ngC = (id: string) => ng?.comparisons.find((x) => x.id === id);
  const ngConf = (ng?.comparisons ?? []).filter((x) => x.confirmatory);
  const ngOracleGap = (ng?.comparisons ?? []).find((x) => x.window === 'multi' && x.ref === 'fcMulti' && x.model === 'oracle');
  const ngOracleSeasonal = (ng?.comparisons ?? []).find((x) => x.window === 'multi' && x.ref === 'seasonal' && x.model === 'oracle');
  const ngSeason = (season: string) => ng?.bySeason.find((x) => x.window === 'multi' && x.season.startsWith(season));
  const ngWin: Record<string, string> = { multi: 'IFS + GFS, Mar 2024 – Nov 2026', gfs: 'GFS only, May 2021 – Nov 2026' };
  const ngModel: Record<string, string> = { fiveYr: 'EIA five-year average', seasonal: 'Seasonal, no weather', fcMulti: 'Forecast degree days (IFS + GFS)', fcGfs: 'Forecast degree days (GFS)', oracle: 'Actual degree days (oracle)' };
  const ngRows: string[][] = (ng?.comparisons ?? []).filter((x) => x.confirmatory || (x.model === 'oracle' && x.ref !== 'oracleEra5City')).map((x) => [x.confirmatory ? x.id : `${x.id}†`, ngWin[x.window] ?? x.window, ngModel[x.model] ?? x.model, ngModel[x.ref] ?? x.ref, String(x.n), x.rmseRef.toFixed(1), x.rmseModel.toFixed(1), `${pc(x.skillMse)} (${pc(x.ci[0])}, ${pc(x.ci[1])})`, pv(x.p), x.q == null ? '—' : pv(x.q)]);
  const revQ = (ng?.revisions?.family ?? []).map((x) => x.q).filter((x): x is number => x != null && Number.isFinite(x));
  const ngAbstract = ng && ngC('C1') ? ` In a separate pre-specified study, weather forecasts available before each week began reduced the mean squared error of the US weekly natural-gas storage change by ${pc(ngC('C1')!.skillMse, 0)} relative to the EIA five-year average (${ngC('C1')!.n} weeks; ${pc(ngC('C3')?.skillMse, 0)} over ${ngC('C3')?.n} weeks with GFS alone), whereas ${ng.revisions ? `none of ${ng.revisions.family.length} forecast-revision measures` : 'forecast revisions did not'} predicted natural-gas futures returns: weather forecasts measurably predict the physical quantity, not the price.` : '';
  const freeze = extra.v3tests?.freezeCommit?.slice(0, 7) ?? null;
  const dep = (l: number) => chain('astraeus-v2', 'tmax', l, 'deployed', 'raw-gauss');
  const stt = (l: number) => chain('astraeus-v2', 'tmax', l, 'stationTrained', 'raw-gauss');
  const covSpan = (truth: string, m = 'astraeus-v2') => { const xs = leads.map((l) => chain(m, 'tmax', l, truth, 'raw-gauss')?.coverage80 ?? NaN).filter(Number.isFinite); return xs.length ? `${pc(Math.min(...xs), 0)}–${pc(Math.max(...xs), 0)}` : '—'; };
  const aifsStationFirst = st ? (st.singleModelRanking.station ?? []).filter((x) => x.model === 'ecmwf_aifs025_single' && x.rank === 1).length : 0;
  const aifsStationCells = st ? new Set((st.singleModelRanking.station ?? []).map((x) => `${x.variable}|${x.lead}`)).size : 0;
  const aE = aifsMargin('era5StationDays', L1);
  const aS = aifsMargin('station', L1);
  const areaNames = (ar?.areas.areas ?? []).map((x) => x.name);
  const v3Abstract = hasV3 ? ` A dispersion-corrected successor, Astraeus v3, was selected on development days only and frozen${freeze ? ` (commit ${freeze})` : ''} before being scored once on the confirmation period, where it improved on v2 in every temperature cell (maximum temperature ${pc(r('tmax', L1, V3)?.crpssVsRawGauss)} at day ${L1} and ${pc(r('tmax', LN, V3)?.crpssVsRawGauss)} at day ${LN} against the zero-training Gaussian) and raised 80% coverage to ${covRange('tmax', V3)}; because that period motivated the correction, this is a consistency check, and a hash-chained live track record started on ${track?.startDate ?? prospective} provides the prospective test.` : '';
  const stAbstract = st && dep(L1) && stt(L1) ? ` Against weather-station observations at the ${stSites('tmax').length} regions with usable stations, the ERA5-trained forecasts kept little skill for day-${L1} maximum temperature (${sp(dep(L1)!.skill)} against the zero-training Gaussian) and their 80% intervals held only ${covSpan('deployed')} of station values, whereas training on station data restored ${sp(stt(L1)!.skill)}; the skill reported here applies to ~31 km grid-box values, not to points.` : '';


  const doc: ReportDoc = {
    title: 'Calibrated multi-model weather forecasts for commodity regions, and what they can and cannot tell us about futures returns',
    subtitle: 'Astraeus Technical Report AR-2026-01 (revision 3)',
    meta: [`Results generated ${w.generatedAt.slice(0, 10)}`, `Weather benchmark ${w.version} · ${w.suite}/${w.period}`, price ? `Price study ${price.study}` : 'Price study pending', 'Code: research/weather-benchmark.ts · research/price-study.ts · src/engine/weatherPostprocessing.ts'],
    abstract: c(`We verify daily forecasts from seven global weather prediction systems — ECMWF IFS and the machine-learning AIFS, NOAA GFS, DWD ICON, the UK Met Office Unified Model, JMA GSM and ECCC GEM — at ${w.sites.length} commodity-producing and demand regions against ERA5 reanalysis, and develop the post-processing behind the Astraeus commodity platform. Candidate methods were compared on development-period test days (October 2025 to ${w.config.devEnd}); the selected scheme, Astraeus v2 — bias-corrected, skill-weighted non-homogeneous Gaussian regression for temperature and a skill-weighted multi-model ensemble for precipitation, both trained on trailing 90-day windows — was then frozen and scored on a later confirmation period (${days} days, ${cases.toLocaleString()} forecast–observation pairs). Against a zero-training Gaussian forecast built from the same models, Astraeus v2 reduced the continuous ranked probability score (CRPS) of daily maximum temperature by ${pc(vsG('tmax', L1))} at day ${L1} and ${pc(vsG('tmax', LN))} at day ${LN}, and of daily mean temperature by ${pc(vsG('tmean', L1))} and ${pc(vsG('tmean', LN))} (significant in ${gaussSigTemp} of ${tempCells} temperature cells at p < 0.05). Against the raw ensemble scored as its empirical distribution the reductions are larger (${pc(vsR('tmax', L1))} and ${pc(vsR('tmax', LN))} for maximum temperature), partly because a ${Math.min(...members)}- to ${Math.max(...members)}-member ensemble carries a finite-ensemble penalty. For precipitation, where v2 is itself a weighted ensemble, the like-for-like gain over the raw ensemble was ${pc(vsR('precip', L1))} at day ${L1} and ${pc(vsR('precip', LN))} at day ${LN} (significant at every lead). The gains come from bias correction and skill weighting rather than from better dispersion: v2’s central 80% intervals covered ${covRange('tmax')} of maximum-temperature observations, whereas the raw ensemble is over-dispersive at short leads. An exploratory first run had also covered the confirmation days, so a strictly prospective test on forecasts issued after ${prospective} is specified alongside.${v3Abstract}${stAbstract} ${priceAbstract}${ngAbstract} Calibrated weather information is a measurable physical input at the grid scale it is verified on; weekly price predictability from weather is narrow and should be claimed only where it survives out-of-sample testing.`),
    keywords: ['ensemble post-processing', 'EMOS', 'CRPS', 'ERA5', 'station verification', 'AIFS', 'commodity futures', 'out-of-sample predictability'],
    sections: [
      { id: 'intro', title: '1. Introduction', blocks: [
        P('Weather is a first-order driver of commodity supply and demand. Extreme heat above roughly 29–30 °C sharply reduces US corn and soybean yields [@schlenker2009-nonlinear-heat], weather-driven yield shocks identify the supply response of staple crops [@roberts2013-elasticities], temperature shocks move natural-gas returns and volatility through heating and cooling demand and storage [@mu2007-gas-weather], and frost risk is visible in orange-juice futures [@roll1984-oj; @boudoukh2007-oj].'),
        P('Medium-range forecasting has improved steadily [@bauer2015-quiet-revolution; @haiden2026-ecmwf-tm938] and machine-learning models trained on reanalysis now rival or exceed physics-based systems on many headline scores [@lam2023-graphcast; @price2025-gencast; @bi2023-pangu; @lang2024-aifs]. Raw model output is nonetheless biased, so operational centres apply statistical post-processing [@gneiting2005-emos; @raftery2005-bma; @vannitsem2021-review].'),
        P('This report documents the weather engine behind Astraeus and asks two questions. How accurate are freely available global forecasts at the places commodities are grown and consumed, and how much does post-processing help? And does weather information measurably improve forecasts of weekly commodity futures returns once evaluated out of sample?'),
        Lst([
          `A reproducible, ${w.sites.length}-region verification of seven global models (including ECMWF’s AIFS) against ERA5 at leads of ${leads.join(', ')} days.`,
          'A development/confirmation protocol, a zero-training baseline that separates learned skill from the finite-ensemble penalty, and calibration judged consistently from the probability integral transform.',
          'A closed-form CRPS for the zero-censored Gaussian, derived and verified numerically, alongside skill-weighted NGR and weighted-ensemble predictors.',
          'A walk-forward test of weather information in futures returns with nested-model tests and multiple-testing control.',
        ]),
      ] },
      { id: 'data', title: '2. Data', blocks: [
        P(`Forecasts. Daily forecasts were reconstructed from the Open-Meteo Previous Runs API, which archives each model’s hourly output as issued N days before the target day. Hourly values were aggregated to UTC days (all 24 hours required) as the mean and maximum of 2 m temperature and the sum of precipitation. Leads of ${leads.join(', ')} days were used. A model enters at a region and lead when it is available on at least ${Math.round(w.config.minModelAvailability * 100)}% of archive days — a rule that uses no truth or skill information — giving ${leads.map((l) => `${Math.min(...w.sites.map((x) => x.modelsByLead?.[l]?.length ?? 0))}–${Math.max(...w.sites.map((x) => x.modelsByLead?.[l]?.length ?? 0))} models at day ${l}`).join(', ')}.`),
        P(`Truth. ERA5 reanalysis [@hersbach2020-era5] from the Open-Meteo archive, aggregated identically. ERA5 is published with a lag of about five days; only days at least ${w.config.era5LagDays} days before issue time are treated as known.`),
        P(`Climatology. Reference forecasts are the empirical distribution of ERA5 values within ±${w.config.climatologyHalfWindowDays ?? 7} days of the calendar date over ${w.config.climatologyYears.join('–')}, years that do not overlap the evaluation.`),
        { type: 'table', caption: `Table 1. Verification regions (representative grid points) and models available at leads ${leads.join(' / ')} days.`, head: ['Region', 'Commodities', 'Lat, lon', 'Models by lead'], rows: regionRows },
        P(`Prices. ${price ? 'Friday-to-Friday weekly log returns of continuous front-month futures from the Yahoo Finance chart endpoint. Continuous contracts contain roll jumps, so returns are research proxies rather than executable P&L.' : 'Pending.'}`),
      ] },
      { id: 'methods', title: '3. Methods', blocks: [
        P('3.1 Scoring. Forecasts are judged with the continuous ranked probability score, a strictly proper score that rewards calibration and sharpness jointly [@gneiting2007-scoring-rules; @hersbach2000-crps]:'),
        { type: 'eq', text: 'CRPS(F, y) = ∫ (F(x) − 𝟙{x ≥ y})² dx', label: '(1)' },
        P('For a Gaussian N(μ, σ²) it has the closed form of Gneiting et al. [@gneiting2005-emos]; for an m-member ensemble it is E|X − y| − ½E|X − X′|, computed exactly by sorting. For a Gaussian left-censored at zero we use'),
        { type: 'eq', text: 'CRPS_c0(μ, σ; y) = CRPS_N(μ, σ; y) − σ [ ℓΦ(ℓ)² + 2φ(ℓ)Φ(ℓ) − Φ(ℓ√2)/√π ],   ℓ = −μ/σ', label: '(2)' },
        P('which follows from removing the integral of Φ² below zero; it agrees with numerical integration to 10⁻⁸ in the unit tests and is consistent with the censored-distribution formulas of scoringRules [@jordan2019-scoringrules]. Skill is CRPSS = 1 − ΣCRPS / ΣCRPS_ref over identical cases. Calibration is judged from the randomised probability integral transform (PIT; rank-based for ensembles, with a weighted analogue for weighted ensembles that reduces to the rank when weights are equal) [@hamill2001-rank-histograms; @gneiting2007-calibration-sharpness]; central 80% coverage is the share of PIT values in [0.1, 0.9], so a calibrated forecast covers 80% whatever its representation. Events (precipitation ≥ 1 mm; temperature above the local 80th climatological percentile) are scored with the Brier score and its decomposition.'),
        P('3.2 Methods compared. All trained methods are refitted every seven days on trailing windows containing only information available at issue time.'),
        Lst([
          `Raw ensemble: the m available model forecasts (m = ${members.join(', ')} at days ${leads.join(', ')}) as equally weighted members.`,
          ...(hasGauss ? ['Zero-training Gaussian: N(member mean, member sd²), zero-censored for precipitation. It isolates the effect of turning a few point forecasts into a smooth distribution from the effect of learning from past errors.'] : []),
          'Astraeus v1 (the previous production method): inverse-MSE model weights shrunk 50% toward equal weights and a Gaussian whose spread is inflated by the training RMSE/spread ratio.',
          'Classical EMOS [@gneiting2005-emos] on 40-day windows: Y ~ N(a + b·m̄, c² + d²s²) on additively bias-corrected, equally weighted members, fitted by minimum CRPS; for precipitation a zero-censored Gaussian with variance c² + d²·MD + g²·m̄ [@scheuerer2015-csgd; @thorarinsdottir2010-censored-emos].',
          'Skill-weighted NGR: members are bias-corrected, combined with inverse-MSE weights shrunk 25% toward equal (cf. superensemble weighting [@krishnamurti1999-superensemble]), then Y ~ N(a + b·m̄_w, c² + d²·s²_w) is fitted by minimum CRPS — four parameters regardless of the number of models.',
          'Skill-weighted ensemble: the members with the same weights (bias-corrected for temperature), scored with the weighted-ensemble CRPS.',
          'Development-only candidates: power-censored Gaussians for precipitation on √ and ∛ scales fitted by maximum likelihood [@messner2014-censored-logistic; @gebetsberger2018-crps-vs-ml], and NGR with a climatology predictor.',
        ]),
        { type: 'eq', text: 'w_i ∝ (1 − λ)·MSE_i⁻¹ / Σ_j MSE_j⁻¹ + λ/K,   λ = 0.25;   Y | x ~ N(a + b Σ w_i (x_i − β_i),  c² + d² Σ w_i (x_i − β_i − m̄_w)²)', label: '(3)' },
        P(`3.3 Protocol. An exploratory first run evaluated five methods over the whole archive with 40-day windows; because it covered the later confirmation days too, those days are held out from tuning but not unseen. Replaying that run on development days only reproduces its diagnostics${run1 ? ` (EMOS day-1 coverage ${r1cov.map((x) => pc(x, 0)).join(' and ')} for mean and maximum temperature; censored-EMOS precipitation CRPSS ${r1rain.map((x) => sp(x, 0)).join(', ')} at days ${leads.slice(0, r1rain.length).join(', ')})` : ''}, so the redesign would have followed from development data alone. New candidates were then compared only on test days up to ${w.config.devEnd}. The selection rule was the highest mean CRPSS against the raw ensemble, pooled over both temperature variables and all leads for temperature, and over all leads for precipitation. Astraeus v2 was frozen before the confirmation period was scored, and the scoring corrections made after an independent code review (Section 6) changed only how forecasts are scored, not the method. A strictly prospective evaluation covers forecasts for days after ${prospective} (--period prospective).`),
        P(`3.4 Inference. Confidence intervals for CRPSS come from a ${w.config.bootstrapBlockDays ?? 7}-day moving-block bootstrap over days that recomputes the pooled ratio from the resampled cases. Diebold–Mariano tests [@diebold1995-dm] use the case-weighted daily loss differential with a Newey–West bandwidth of ${w.config.dmLagDays ?? 14} days and the Harvey–Leybourne–Newbold correction [@harvey1997-hln]; reported p-values are the largest across bandwidths of the lead, 7, ${w.config.dmLagDays ?? 14} and 21 days. Regions are not independent, so the effective sample size is the number of days.`),
        P(`3.5 Price study. ${price ? 'Weekly log returns at 1- and 4-week horizons are forecast with expanding-window ridge regressions: a market-only model (recent returns and realised volatility) and a nested model adding weather features — season-gated extreme degree days and precipitation in production regions [@schlenker2009-nonlinear-heat], frost indicators for coffee, and heating/cooling degree-day anomalies for natural gas [@mu2007-gas-weather]. Three information sets are tested: realised weather with a publication lag, a look-ahead diagnostic using the weather that occurred during the holding period (not tradable, and not an upper bound because forecastable weather is already priced at the origin), and NWP forecasts known at the origin (2024–2026). Out-of-sample R² follows Campbell and Thompson [@campbell2008-oos]; nested models are compared with the Clark–West test [@clark2007-cw], direction with Pesaran–Timmermann [@pesaran1992-pt], and p-values are controlled for false discovery with Benjamini–Hochberg [@benjamini1995-fdr].' : 'Pending.'}`),
        P(`3.6 Live track record. ${track ? `Since ${track.startDate} the deployed system writes each day’s published outlook — calibrated bands, event probabilities, the method version and the raw model values needed for both baselines — to a dated snapshot whose SHA-256 hash is chained into an append-only ledger (data/track-record/; checked with npx tsx research/track-record.ts verify). Snapshots are scored against ERA5 once it is published, with the same scores and baselines as the benchmark${track.nextScoresExpected ? `; the first scores are expected on ${track.nextScoresExpected}` : ''}. At this revision the ledger holds ${track.snapshots} snapshot${track.snapshots === 1 ? '' : 's'} (${track.cases.total} forecast cases from ${track.regionsLatest} regions; head ${track.ledger.head.slice(0, 12)}…). A ledger kept in the project’s own repository is tamper-evident, not tamper-proof: publishing the head hash each day, for example by pushing the repository, is what gives outsiders a timestamp.` : 'The live track record had not started when this report was generated.'}`),
      ] },
      { id: 'results', title: '4. Results', blocks: [
        P(`4.1 First run. Every post-processing method improved temperature forecasts at short leads, but classical EMOS on 40-day windows was under-dispersive and censored-Gaussian EMOS degraded precipitation (development-only figures in Section 3.3). Requiring every model to be present also left day 7 empty, because not every model publishes 7-day-old runs; availability is therefore assessed per lead.`),
        P(`4.2 Development period. ${dev && pooledTemp.length ? `Table 2 lists the four best candidates per variable by mean CRPSS against the raw ensemble across leads. Pooled over both temperature variables, ${mname(pooledTemp[0].m)} led (${sp(pooledTemp[0].pooled)}, next ${mname(pooledTemp[1].m)} ${sp(pooledTemp[1].pooled)})${tmaxLeader && tmaxLeader.m !== pooledTemp[0].m ? `; for maximum temperature alone ${mname(tmaxLeader.m)} was marginally ahead (${sp(tmaxLeader.tmax)} vs ${sp(pooledTemp.find((x) => x.m === pooledTemp[0].m)!.tmax)})` : ''}. For precipitation, ${mname(pooledRain[0].m)} led (${sp(pooledRain[0].pooled)}); none of the parametric censored models beat the raw ensemble on average.` : 'Archived.'}`),
        ...(dev ? [{ type: 'table' as const, caption: `Table 2. Development period (test days to ${w.config.devEnd}): CRPSS vs the raw ensemble by lead and the mean across leads.`, head: ['Variable', 'Method', ...leads.map((l) => `Day ${l}`), 'Mean'], rows: devRows }] : []),
        P(`4.3 Confirmation period. Table 3 is the headline result. Against the zero-training Gaussian, Astraeus v2 reduced CRPS for maximum temperature by ${leads.map((l) => pc(vsG('tmax', l))).join(', ')} and for mean temperature by ${leads.map((l) => pc(vsG('tmean', l))).join(', ')} at days ${leads.join(', ')}; ${gaussSigTemp} of ${tempCells} temperature cells are significant at p < 0.05 under every bandwidth. Against the raw ensemble the improvement is significant in ${rawSigAll} of ${cells('raw-ensemble').length} cells, including precipitation at every lead. Against the previous production method it was significantly better in ${v1Better} of ${v1Cells} cells, significantly worse in ${v1Worse}, and statistically indistinguishable in ${v1Ties.length} (${v1Ties.map((x) => `${VAR_SHORT[x.v].toLowerCase()} day ${x.l}`).join(', ')}), where v1’s simpler Gaussian is about as good.`),
        { type: 'table', caption: 'Table 3. Confirmation period. CRPS of the raw ensemble, the zero-training Gaussian and Astraeus v2; CRPSS of v2 with 95% block-bootstrap intervals and Diebold–Mariano p-values (largest across bandwidths) against each reference; and PIT-based 80% coverage of v2.', head: ['Variable', 'Lead', 'N', 'm', 'CRPS raw', 'CRPS Gauss', 'CRPS v2', 'vs Gauss (95% CI)', 'p', 'vs raw (95% CI)', 'p', 'vs v1', 'p', 'Cov. 80%'], rows: mainRows, note: 'Units: °C for temperature, mm for precipitation. m = members in the raw ensemble.' },
        { type: 'figure', kind: 'skill-by-lead', variable: 'tmax', caption: 'Figure 1. CRPS of daily maximum temperature by lead: Astraeus v2, the raw ensemble, the zero-training Gaussian and climatology (confirmation period).' },
        P(`4.4 Calibration. Judged consistently from the PIT, the raw ensemble is over-dispersive at short leads — its 80% interval held ${pc(cov('tmax', L1, 'raw-ensemble'), 0)} of day-${L1} maximum-temperature observations, falling to ${pc(cov('tmax', LN, 'raw-ensemble'), 0)} at day ${LN} — because model disagreement exceeds the error of the best models. Astraeus v2 is mildly under-dispersive: its 80% intervals covered ${covRange('tmax')} (maximum) and ${covRange('tmean')} (mean temperature), with ${lowBin('tmax')} of maximum-temperature observations below its 10th percentile, reflecting a small warm bias. Its gains therefore come from bias correction and skill weighting, not from better dispersion; a dispersion correction is the obvious next step and will be tested prospectively. For precipitation, v2’s coverage was ${covRange('precip')} and its Brier skill for rain ≥ 1 mm against climatology was ${pc(r('precip', L1)?.brierSkillVsClimatology, 0)} at day ${L1} and ${pc(r('precip', LN)?.brierSkillVsClimatology, 0)} at day ${LN}.`),
        { type: 'table', caption: 'Table 4. Calibration: PIT-based central 80% coverage of the raw ensemble, the zero-training Gaussian and v2; share of observations below v2’s 10th and above its 90th percentile (10% each if calibrated); fair CRPS of the raw ensemble beside v2’s CRPS.', head: ['Variable', 'Lead', 'Cov. raw', 'Cov. Gauss', 'Cov. v2', 'v2 < p10', 'v2 > p90', 'Fair CRPS raw', 'CRPS v2'], rows: calRows, note: `The fair CRPS estimates the score of an unlimited ensemble drawn from the same distribution as the members [@ferro2014-fair-crps]. It is not an issuable forecast, and multi-model members are not exchangeable draws, so it is indicative only; by this measure the raw ensemble is comparable to v2 for temperature (day-${L1} maximum: ${f3(fairTmax1)} vs ${f3(r('tmax', L1)?.crps)} °C).` },
        { type: 'figure', kind: 'reliability', variable: 'precip', lead: 1, caption: 'Figure 2. Reliability of day-1 probability of precipitation ≥ 1 mm, Astraeus v2 vs the raw ensemble.' },
        P(`4.5 Regions. Gains are heterogeneous. For day-3 maximum temperature the largest improvements over the raw ensemble were at ${siteSkill.slice(0, 3).map((x) => `${site(x.id)} (${sp(x.s, 0)})`).join(', ')} and the smallest at ${siteSkill.slice(-3).map((x) => `${site(x.id)} (${sp(x.s, 0)})`).join(', ')}; the pattern does not follow a simple terrain or coastline explanation and is not interpreted further. For precipitation, v2 was worse than the raw ensemble in ${rainWorse} of ${rainSiteCells.length} region–lead cells, so its small average gain is not uniform.`),
        P(`4.6 Individual models. ECMWF AIFS had the lowest mean absolute error in ${aifsBestCount} of ${w.variables.length * leads.length} variable–lead combinations (day-3 maximum temperature: ${best('tmax', 3).slice(0, 3).map((m) => `${m.name} ${m.mae.toFixed(2)} °C`).join(', ')}). Because AIFS is trained on ERA5, verification against ERA5 is expected to favour it [@lang2024-aifs; @rasp2024-weatherbench2]; ECMWF reports AIFS ahead of IFS by roughly a third of a forecast day in its own verification [@haiden2026-ecmwf-tm938]. Skill weighting lets v2 lean on such models when their recent record warrants it.`),
        { type: 'figure', kind: 'leaderboard', variable: 'tmax', lead: 3, caption: 'Figure 3. Single-model mean absolute error, day-3 maximum temperature, confirmation period.' },
        P(`4.7 Weather information and futures returns. ${priceAbstract}`),
        ...(price ? [{ type: 'table' as const, caption: 'Table 5. Walk-forward price study: out-of-sample R² of the weather model vs the historical-mean benchmark, R² gain over the nested market-only model, Clark–West p-value and its Benjamini–Hochberg q-value, Diebold–Mariano p-value against a no-change forecast, and directional hit rate.', head: ['Commodity', 'Information', 'Horizon', 'N weeks', 'R² (weather)', 'R² gain vs market', 'p (CW)', 'q (BH)', 'p (DM vs no-change)', 'Hit rate'], rows: priceRows, note: 'Out-of-sample R² is measured against the expanding historical mean (Campbell and Thompson); negative values mean the model forecast worse than that benchmark. The look-ahead diagnostic uses weather that was not known at the forecast origin and is not a tradable signal.' }] : []),
        ...(price ? [{ type: 'figure' as const, kind: 'price-matrix' as const, caption: 'Figure 4. R² gain of weather-augmented over market-only models (● = BH q < 0.10).' }] : []),
        ...(hasV3 && v3dev ? [
          P(`4.8 A dispersion correction (Astraeus v3). The under-dispersion of v2 is already present on development days — pooled temperature coverage ${pc(pooled(v3dev, 'astraeus-v2', 'coverage80'), 1)}, with ${pc(pooled(v3dev, 'astraeus-v2', 'pitLowest'), 1)} of observations below the 10th percentile and ${pc(pooled(v3dev, 'astraeus-v2', 'pitHighest'), 1)} above the 90th, i.e. tails heavier than a Gaussian rather than a uniformly narrow interval — so a correction could be developed without the confirmation data. Six candidates and the selection rule (lowest pooled development CRPS for temperature among candidates whose coverage lies within 77–83%) were written down before any was run (docs/results/WEATHER_V3.md). They drew on heavier-tailed logistic regression [@messner2014-censored-logistic], recency-weighted training [@lang2020-remember-the-past] and scale recalibration from blocked cross-validation [@bergmeir2012-ts-cv]. The combination C6 was the only candidate inside the coverage band to beat v2 (Table 6) and was frozen as Astraeus v3${freeze ? ` (commit ${freeze})` : ''}.`),
          { type: 'table' as const, caption: 'Table 6. Development period: pooled CRPS for maximum and mean temperature over all leads (°C), CRPSS relative to v2, and PIT-based central 80% coverage of the pre-specified v3 candidates.', head: ['Candidate', 'Pooled CRPS', 'vs v2', 'Cov. 80%'], rows: v3CandRows },
          P(`Scored once on the confirmation period (Table 7), v3 improved CRPS against the zero-training Gaussian in every temperature cell (${v3SigTemp} of ${tempCells} significant at p < 0.05 under every bandwidth, against ${gaussSigTemp} for v2), raised maximum-temperature coverage from ${covRange('tmax')} to ${covRange('tmax', V3)}, and reduced the share of observations below the 10th percentile.${v3vsv2.length ? ` A direct comparison with v2, added after the freeze and therefore not pre-specified, favoured v3 at p < 0.05 in ${v3vsv2Better} of ${v3vsv2.length} temperature cells (${v3vsv2Robust} under the most conservative bandwidth).` : ''} The claim is limited in two ways: the confirmation period is where v2’s over-confidence was noticed, so this is a consistency check rather than a clean test; and v3 still covers about 78% rather than 80% and keeps a small warm bias. Precipitation is unchanged. Under a pre-written adoption rule the live outlook switched to v3 on 16 November 2026, so the live track record (Section 3.6) is its prospective test.`),
          { type: 'table' as const, caption: 'Table 7. Confirmation period, scored once after the freeze: CRPSS of v2 and v3 against the zero-training Gaussian, Diebold–Mariano p for v3 (largest across bandwidths), PIT-based 80% coverage, and the share of observations below the 10th percentile (10% if calibrated).', head: ['Variable', 'Lead', 'v2 vs Gauss', 'v3 vs Gauss', 'p (v3)', 'Cov. v2', 'Cov. v3', 'v2 < p10', 'v3 < p10'], rows: v3Rows },
        ] : []),
        ...(st ? [
          P(`4.9 Weather-station truth. ERA5 is a ~31 km reanalysis, so the benchmark was repeated against station observations from GHCN-Daily [@menne2012-ghcnd], with Meteostat as a fallback. Usable stations — within 40 km of a region’s grid point and with at least 80% observational coverage — exist for maximum temperature at ${stSites('tmax').length} regions and for precipitation at ${stSites('precip').length}, almost all in the United States, Australia and the Netherlands; the tropical and Southern-Hemisphere crop regions have no station with current observations, and Meteostat values there are largely model-filled and were rejected. Mean temperature is not verified, because a station’s (max + min)/2 is not the 24-hour mean used here. Table 8 traces the maximum-temperature skill of v2 from the published benchmark to station truth. Restricting ERA5 to the station regions and days already lowers it; against the stations themselves, the ERA5-trained forecasts as deployed keep ${dep(L1) ? `${sp(dep(L1)!.skill)} at day ${L1} (p ${pv(dep(L1)!.robustMaxP)})` : 'little skill'}, and their 80% intervals cover only ${covSpan('deployed')} of station observations, because a grid-box value differs systematically from a point 4–12 km away. Training the same method on each station’s own history, with the same six-day lag, restores ${stt(L1) ? sp(stt(L1)!.skill) : '—'} at day ${L1} and coverage of ${covSpan('stationTrained')}. For precipitation the gain over the raw ensemble against stations is ${range(stRain('deployed'))} as deployed and ${range(stRain('stationTrained'))} when station-trained, none of it significant.${aE && aS ? ` ECMWF AIFS still has the lowest raw error against stations in ${aifsStationFirst} of ${aifsStationCells} variable–lead cells, but its day-${L1} maximum-temperature margin over the next-best model falls from ${pc(aE.margin)} against ERA5 to ${pc(aS.margin)} against stations: much of its ERA5 advantage is a systematic grid-versus-station offset rather than day-to-day skill.` : ''}`),
          { type: 'table' as const, caption: 'Table 8. Maximum temperature, confirmation period: CRPSS of Astraeus against the zero-training Gaussian (Diebold–Mariano p, largest across bandwidths) from the published ERA5 benchmark to station truth, and the range of PIT-based 80% coverage across leads.', head: ['Method', 'Truth', ...leads.map((l) => `Day ${l}`), 'Cov. 80%'], rows: stRows, note: 'ERA5-trained = the method as deployed, trained on ERA5 and verified on stations. Station-trained = the same method trained on the station’s own observations (six-day lag). Stations are 4–12 km from the grid points.' },
        ] : []),
        ...(ar ? [
          P(`4.10 Production-weighted areas. Commodity exposure is spread across a region, so four areas — ${areaNames.join(', ')} — were each represented by four points weighted by production (population for heating demand) from USDA NASS county estimates, IBGE municipal production and US Census county populations, with forecasts and ERA5 averaged using the same weights. Area means are smoother, so every method’s error falls, but the gain of Astraeus over the zero-training Gaussian is unchanged at day ${L1} and smaller at longer leads (Table 9). For precipitation the gain over the raw ensemble on area means is ${range(areaRain)}.`),
          { type: 'table' as const, caption: 'Table 9. Confirmation period, four production-weighted areas pooled: CRPSS against the zero-training Gaussian for the area mean versus the single representative grid point over the same days.', head: ['Method', 'Variable', ...leads.map((l) => `Day ${l}: area vs point`)], rows: areaRows, note: 'Area runs use a 2022–2024 climatology and require ≥ 90% model availability over the shorter area archive, which excludes the UK Met Office model at some leads.' },
        ] : []),
        ...(ng && ngC('C1') && ngC('C2') ? [
          P(`4.11 Weather and the physical market: natural-gas storage. If forecastable weather is priced quickly, its value should appear in the physical quantities markets forecast rather than in returns. A second study, pre-specified and committed before scoring (docs/results/STORAGE_STUDY.md), forecasts the US Energy Information Administration’s weekly Lower-48 working-gas change from gas-weighted heating and population-weighted cooling degree days [@mu2007-gas-weather]. A regression fitted on degree days observed by NOAA’s Climate Prediction Center since 2010 is applied, walk-forward, to forecast degree days for nine census-division cities from runs initialised before the storage week begins (ECMWF IFS and NOAA GFS, bias-corrected). Against the EIA five-year average — the benchmark quoted in the weekly report — the forecast reduced mean squared error by ${pc(ngC('C1')!.skillMse)} (95% CI ${pc(ngC('C1')!.ci[0])} to ${pc(ngC('C1')!.ci[1])}) over ${ngC('C1')!.n} weeks with both models and by ${pc(ngC('C3')?.skillMse)} over ${ngC('C3')?.n} weeks with GFS alone, and against a seasonal model without weather by ${pc(ngC('C2')!.skillMse)} and ${pc(ngC('C4')?.skillMse)}; all ${ngConf.length} pre-specified comparisons survive Benjamini–Hochberg correction (q ≤ ${pv(Math.max(...ngConf.map((x) => x.q ?? 1)))}) (Table 10).${ngOracleGap && ngOracleSeasonal ? ` Using the degree days that actually occurred lowers the error further (${pc(ngOracleGap.skillMse, 0)} lower MSE than the forecast model, p ${pv(ngOracleGap.p)}), so the forecast captures about ${pc(ngC('C2')!.skillMse / ngOracleSeasonal.skillMse, 0)} of the gain attainable from perfect weather knowledge.` : ''}${ngSeason('Heating') && ngSeason('Injection') ? ` The skill is concentrated in the heating season: RMSE ${ngSeason('Heating')!.rmse.fcMulti.toFixed(0)} Bcf against ${ngSeason('Heating')!.rmse.fiveYr.toFixed(0)} Bcf for the five-year average in November–March, but ${ngSeason('Injection')!.rmse.fcMulti.toFixed(0)} against ${ngSeason('Injection')!.rmse.fiveYr.toFixed(0)} Bcf in April–October.` : ''} The fitted sensitivity, ${ng.sensitivity.bcfPerHdd.toFixed(2)} Bcf per weekly heating degree day (t = ${ng.sensitivity.tHdd.toFixed(1)}), has the expected sign and size. These comparisons are with naive benchmarks: analysts’ consensus forecasts, made the day before the report with most of the week’s weather already observed, were not available, so nothing here claims to beat market expectations. Inputs are today’s revised EIA and CPC data, and ${ng.missingGfsWeeks.length} GFS weeks (January–February 2024) are missing from the archive.`),
          { type: 'table' as const, caption: 'Table 10. Weekly US Lower-48 natural-gas storage change: walk-forward forecasts issued before each storage week. MSE skill = 1 − MSE(model)/MSE(reference) with 95% block-bootstrap intervals, Diebold–Mariano p on squared errors, and Benjamini–Hochberg q over the pre-specified family.', head: ['ID', 'Window', 'Model', 'Reference', 'Weeks', 'RMSE ref. (Bcf)', 'RMSE model (Bcf)', 'MSE skill (95% CI)', 'p (DM)', 'q (BH)'], rows: ngRows, note: '† Exploratory comparisons with the oracle that uses observed degree days; the oracle is not a forecast.' },
          ...(ng.revisions ? [P(`Forecast changes and prices. To test whether forecast changes rather than levels move prices, a family of ${ng.revisions.family.length} pre-specified revision and surprise measures (docs/results/PRICE_STUDY_REVISIONS.md) was added to the walk-forward return model for natural-gas futures over ${ng.revisions.n} weeks (${ng.revisions.start} to ${ng.revisions.end}). None improved on the market-only model after Benjamini–Hochberg correction (smallest q = ${pv(Math.min(...revQ))}) and none beat a no-change forecast. The archive exposes leads of at most seven days, so a true week-on-week revision of the same target week could not be formed.`)] : []),
        ] : []),
      ] },
      { id: 'discussion', title: '5. Discussion', blocks: [
        P('Temperature benefits most from post-processing because its errors are dominated by persistent biases and by large differences in skill between models, both of which a 90-day window can estimate. Compared with classical EMOS, v2 differs in two ways at once — inverse-MSE rather than equal member weights, and a 90-day rather than 40-day window — and the development results suggest both matter; with seven models and 40 days, parameter-rich fits over-fit [@gneiting2005-emos; @lerch2017-semilocal; @hagedorn2012-tigge]. Part of the headline improvement over the raw ensemble is simply the conversion of five to seven point forecasts into a smooth distribution, which is why the zero-training Gaussian is the fairer reference for temperature.'),
        P('Precipitation is harder: it is intermittent and skewed, and parametric censored models need longer or spatially pooled training to beat a good raw ensemble [@scheuerer2015-csgd; @lerch2017-semilocal]. Skill weighting gives small average gains that are not uniform across regions; semi-local pooling is the natural next step.'),
        P('Price predictability from weather is narrow. Markets incorporate realised weather quickly [@roll1984-oj], so lagged realised weather adds little to weekly return forecasts, and even the look-ahead diagnostic did not forecast returns in a linear model, consistent with the forecastable part of weather being priced at the origin. Where evidence exists in the literature it concerns forecast information and revisions — especially for natural gas [@hsu2026-forecast-revisions-wp; @monteux2025-extreme-forecast-premium]. The natural-gas result here is suggestive rather than established: it beats a market-only model but not a no-change forecast, on 88 weeks of a short archive, and must be re-tested as the archive grows. Astraeus therefore presents weather as conditional physical pressure with explicit invalidation criteria.'),
        ...(ng && ngC('C1') ? [P(`The contrast between Sections 4.7 and 4.11 is the main economic finding. The same weather forecasts that explain about three-quarters of the squared error of the naive storage benchmark do not forecast natural-gas returns, which is what one expects if the market prices forecast information as it arrives. The useful product of weather intelligence is therefore an early, quantified read of the physical balance — storage, and by extension yields and demand — rather than a return signal; its value to a trader depends on how it compares with the consensus, which this study could not measure.`)] : []),
        P(`Limitations. Skill is measured against ERA5, a ~31 km reanalysis that favours smooth models${st ? '; against weather stations the ERA5-trained forecasts lose most of their short-range advantage and their intervals are too narrow for point values (Section 4.9), and station coverage is limited to mid-latitude, data-rich regions' : ''}. The confirmation period had been covered by an exploratory run and spans a single realisation of each season${hasV3 ? ', and it also motivated v3' : ''}; v2 is mildly under-dispersive${hasV3 ? ' and v3 narrows but does not close the gap' : ''}. The forecast-tier price sample is short, continuous futures contain roll jumps, and the free data sources used are licensed for non-commercial research (docs/DATA_LICENSING.md).`),
        P(`Future work. The prospective evaluation of v2 and v3 from the live track record; station-trained calibration wherever a station with current observations exists${st ? ', which Section 4.9 shows is where point-level skill comes from' : ''}; production-weighted areas for every region; semi-local precipitation post-processing; ensemble members (ECMWF ENS, GEFS) as predictors; and crop-stage-aware price features.`),
      ] },
      { id: 'repro', title: '6. Reproducibility and revision history', blocks: [
        Lst([
          'npx tsx research/weather-benchmark.ts --suite run1 --period dev --offline — the first run replayed on development days.',
          'npx tsx research/weather-benchmark.ts --suite dev --period dev --offline — development comparison.',
          'npx tsx research/weather-benchmark.ts --suite final --period confirm --offline — the confirmation result (public/research/weather-skill.json).',
          'npx tsx research/weather-benchmark.ts --suite v3dev --period dev --offline — the v3 candidates on development days (public/research/archive/weather-v3-dev.json).',
          'npx tsx research/weather-benchmark.ts --suite final --period prospective — the prospective test of v2 and v3, once forecasts after the freeze have verified.',
          'npx tsx research/weather-benchmark.ts --suite final --period confirm --offline --truth stations --train era5|stations, and --sites areas — station and area verification; npx tsx research/verification-report.ts summarises them (public/research/archive/weather-stations-*.json, weather-areas-confirm.json).',
          'npx tsx research/track-record.ts verify | score — checks the live ledger’s hash chain and scores verified snapshots (data/track-record/).',
          ...(price ? ['npx tsx research/price-study.ts --offline --end=2026-11-14 — the price study (public/research/price-skill.json).'] : []),
          'npm test — unit tests, including closed-form CRPS against numerical integration, PIT-based coverage of calibrated forecasts, and synthetic recovery tests for every method.',
          'npx tsx research/build-report.ts — regenerates this report as docs/TECHNICAL_REPORT.md from the same result files.',
        ]),
        P('Revision 2 follows an independent code review of the benchmark. Interval coverage was previously read from interpolated ensemble quantiles, which understates coverage for small ensembles and had reversed the calibration conclusion; it is now taken from the PIT for every method. The bootstrap now resamples the pooled estimand, Diebold–Mariano tests weight days by their number of cases, a zero-training Gaussian baseline and fair CRPS were added, the live outlook was aligned with the benchmark (per-day leads 1–6, ≥ 90% availability, ≥ 60 training days), and several sentences were corrected. The forecasting method itself was not changed.'),
        P(`Revision 3 adds the pre-specified v3 dispersion correction and its single confirmation-period scoring (Section 4.8), verification against weather stations and production-weighted areas (4.9–4.10), and the live hash-chained track record (3.6). It also aligns the live outlook’s training truth with the benchmark (ERA5 only, 24-hour UTC days; previously Open-Meteo’s default archive blend). Published v2 results are unchanged: re-running the confirmation benchmark after these changes reproduces public/research/weather-skill.json exactly, apart from the added v3 rows.`),
      ] },
    ],
    cited: [],
  };
  doc.cited = [...cited];
  return doc;
}

/** Author-year label for a reference: "Gneiting et al., 2005", "Mu, 2007", "Clark and West, 2007". */
export function citeLabel(r: { authors: string; year: number }): string {
  const names = r.authors.replace(/\s+et al\.?$/i, '').split(/,\s*/).filter(Boolean);
  const surname = (n: string) => n.trim().split(/\s+/).pop() ?? n;
  const etal = /et al/i.test(r.authors) || names.length > 2;
  const who = names.length === 1 && !etal ? surname(names[0]) : names.length === 2 && !etal ? `${surname(names[0])} and ${surname(names[1])}` : `${surname(names[0])} et al.`;
  return `${who}, ${r.year}`;
}
