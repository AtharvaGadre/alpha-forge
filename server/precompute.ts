/**
 * Daily precomputed outlooks: the same engine as a live request (runLiveAtmospherePipeline → calibrated outlook →
 * buildCommodityForecast), run in Node for every commodity's default region, so the terminal opens with today's
 * outlooks instead of "Not analysed". Regions shared by several commodities are fetched once.
 *
 * Output: data/outlooks/latest.json (+ .gz) and a dated copy, both gitignored. The same run yields the
 * track-record snapshot regions (raw model values recovered from the forecast response).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { COMMODITIES, COMMODITY_ENGINE_VERSION, buildCommodityForecast, commodityTarget, type CommodityDefinition, type CommodityForecast, type CommodityRegion } from '../src/engine/commodityForecastEngine.ts';
import { LIVE_MODEL_SPECS, clearLivePipelineCache, runLiveAtmospherePipeline, type LiveAtmosphereInvestigation } from '../src/engine/liveAtmospherePipeline.ts';
import { TRACK_VARIABLES, matchMembers, type SnapshotDay, type SnapshotRegion } from '../src/engine/trackRecord.ts';
import { newMeter, type FetchMeter, type Outbound } from './outbound.ts';

export const PRECOMPUTE_JOB = 'astraeus-precompute-v1';
/** Upper estimate of one region with nothing cached (forecast 9.3 + ensemble 8.2 + ERA5 5.1 + previous runs 54 + climatology 17). */
export const COLD_REGION_WEIGHT = 100;

/** Same evidence fields as a live request (parameters hash and experiment id). */
export function issueCommodityForecast(commodity: CommodityDefinition, region: CommodityRegion, live: LiveAtmosphereInvestigation): CommodityForecast {
  const result = buildCommodityForecast(commodity, region, live);
  const parametersSha256 = createHash('sha256').update(JSON.stringify({ version: COMMODITY_ENGINE_VERSION, commodity, region })).digest('hex');
  result.evidence.parametersSha256 = parametersSha256;
  result.evidence.experimentId = `CF-${commodity.id}-${parametersSha256.slice(0, 12)}-${result.evidence.inputHash.slice(0, 12)}`;
  return result;
}

export interface PrecomputeGroup { key: string; name: string; country: string; lat: number; lng: number; members: Array<{ commodity: CommodityDefinition; region: CommodityRegion }> }

/** Each commodity's default (first) region, de-duplicated by coordinates. */
export function precomputeGroups(): PrecomputeGroup[] {
  const byCoord = new Map<string, PrecomputeGroup>();
  for (const commodity of COMMODITIES) {
    const region = commodity.regions[0];
    const coord = `${region.lat.toFixed(3)},${region.lng.toFixed(3)}`;
    let g = byCoord.get(coord);
    if (!g) {
      const taken = [...byCoord.values()].some((x) => x.key === region.id);
      g = { key: taken ? `${region.id}-${coord}` : region.id, name: region.name, country: region.country, lat: region.lat, lng: region.lng, members: [] };
      byCoord.set(coord, g);
    }
    g.members.push({ commodity, region });
  }
  return [...byCoord.values()];
}

export interface OutlookRegionStatus { key: string; name: string; lat: number; lng: number; commodities: string[]; status: 'ok' | 'failed' | 'deferred'; error?: string; generatedAtUtc?: string; openMeteoWeight?: number }
export interface OutlookFile {
  schema: 'astraeus-outlooks-v1';
  job: string;
  issueDate: string;
  issuedAtUtc: string;
  completedAtUtc: string;
  engineVersion: string;
  methodVersions: string[];
  openMeteo: { weightedCalls: number; requests: number; cacheHits: number; allowance: number; rateLimited: boolean; budgetBlocked: number };
  regions: OutlookRegionStatus[];
  /** Keyed `${commodityId}:${regionId}`, as App.tsx keys its results. */
  results: Record<string, CommodityForecast>;
}

const FC_DAILY: Record<string, string> = { tmean: 'temperature_2m_mean', tmax: 'temperature_2m_max', precip: 'precipitation_sum' };

/** Snapshot of what the site shows for one region: bands verbatim, plus the raw model values behind each band. */
export function snapshotRegion(group: PrecomputeGroup, live: LiveAtmosphereInvestigation, forecastJson: any): SnapshotRegion | null {
  const outlook = live.calibratedOutlook;
  if (!outlook) return null;
  const loc = Array.isArray(forecastJson) ? forecastJson[0] : forecastJson;
  const times: string[] = loc?.daily?.time ?? [];
  const days: SnapshotDay[] = outlook.days.map((d, lead) => {
    const day: SnapshotDay = { date: d.date, lead, trainingLead: d.trainingLead };
    const k = times.indexOf(d.date);
    for (const v of TRACK_VARIABLES) {
      const band = d[v];
      if (!band) continue;
      const values = Object.fromEntries(LIVE_MODEL_SPECS.map((m) => [m.name, k >= 0 ? loc?.daily?.[`${FC_DAILY[v]}_${m.apiId}`]?.[k] ?? null : null]));
      day[v] = { band: { ...band }, members: matchMembers(values, band, outlook.models) };
    }
    return day;
  });
  return {
    key: group.key, name: group.name, lat: group.lat, lng: group.lng,
    commodities: group.members.map((m) => `${m.commodity.id}:${m.region.id}`),
    generatedAtUtc: live.generatedAtUtc, inputSha256: live.reproducibility.inputsSha256,
    outlook: { version: outlook.version, trainingDates: outlook.trainingDates, models: outlook.models },
    days,
  };
}

export function outlookPaths(root: string) {
  const dir = path.join(root, 'data', 'outlooks');
  return { dir, latest: path.join(dir, 'latest.json'), latestGz: path.join(dir, 'latest.json.gz'), dated: (d: string) => path.join(dir, `${d}.json`) };
}

export function loadLatestOutlooks(root: string): OutlookFile | null {
  try { const f = JSON.parse(fs.readFileSync(outlookPaths(root).latest, 'utf8')); return f?.schema === 'astraeus-outlooks-v1' ? f : null; } catch { return null; }
}

function writeOutlooks(root: string, file: OutlookFile) {
  const p = outlookPaths(root);
  fs.mkdirSync(p.dir, { recursive: true });
  const text = JSON.stringify(file);
  for (const [target, data] of [[p.latest, text], [p.latestGz, zlib.gzipSync(text, { level: 9 })], [p.dated(file.issueDate), text]] as const) {
    fs.writeFileSync(`${target}.tmp`, data);
    fs.renameSync(`${target}.tmp`, target);
  }
}

export interface PrecomputeOptions {
  root: string;
  outbound: Outbound;
  /** Maximum Open-Meteo weight this run may spend (regions beyond it are deferred to the next run). */
  allowance: number;
  only?: string[];
  log?: (msg: string) => void;
  /** Called for each issued forecast (the server appends it to the issued-forecast ledger). */
  onIssued?: (f: CommodityForecast) => Promise<void> | void;
}

export async function runPrecompute(opts: PrecomputeOptions): Promise<{ file: OutlookFile; snapshotRegions: SnapshotRegion[]; meter: FetchMeter }> {
  const log = opts.log ?? (() => undefined);
  const issuedAt = new Date();
  const issueDate = issuedAt.toISOString().slice(0, 10);
  const previous = loadLatestOutlooks(opts.root);
  const meter = newMeter();
  const base = opts.outbound.fetcher({ priority: 'scheduled', meter });
  const prevOk = new Set(previous?.regions.filter((r) => r.status === 'ok').map((r) => r.key) ?? []);
  // Regions missing from the previous run go first, so a deferred region is not starved two days running.
  const groups = precomputeGroups().filter((g) => !opts.only || opts.only.includes(g.key)).sort((a, b) => Number(prevOk.has(a.key)) - Number(prevOk.has(b.key)));
  const results: Record<string, CommodityForecast> = {};
  const regions: OutlookRegionStatus[] = [];
  const snapshotRegions: SnapshotRegion[] = [];
  const methodVersions = new Set<string>();

  for (const group of groups) {
    const status: OutlookRegionStatus = { key: group.key, name: group.name, lat: group.lat, lng: group.lng, commodities: group.members.map((m) => m.commodity.id), status: 'ok' };
    regions.push(status);
    if (meter.rateLimited || opts.outbound.coolingDown()) { status.status = 'deferred'; status.error = 'Open-Meteo rate limit (HTTP 429); stopped.'; continue; }
    if (meter.openMeteoWeight + COLD_REGION_WEIGHT > opts.allowance) { status.status = 'deferred'; status.error = `Precompute allowance (${opts.allowance} weighted calls) reached.`; continue; }
    const before = meter.openMeteoWeight;
    // Force the pipeline through the outbound layer (its own in-memory cache would hide the forecast response).
    clearLivePipelineCache();
    let forecastJson: any = null;
    const fetchJson = async (url: string, timeoutMs: number) => {
      const json = await base(url, timeoutMs);
      if (/open-meteo\.com\/v1\/forecast\?/.test(url) && url.includes('past_days=30')) forecastJson = json;
      return json;
    };
    const errors: string[] = [];
    for (const { commodity, region } of group.members) {
      try {
        const live = await runLiveAtmospherePipeline({ query: `${commodity.name}: ${region.name}`, target: commodityTarget(commodity, region), fetchJson });
        const f = issueCommodityForecast(commodity, region, live);
        f.precomputed = { issuedAtUtc: issuedAt.toISOString(), issueDate, job: PRECOMPUTE_JOB };
        results[`${commodity.id}:${region.id}`] = f;
        if (live.calibratedOutlook) methodVersions.add(live.calibratedOutlook.version);
        status.generatedAtUtc = live.generatedAtUtc;
        if (!snapshotRegions.some((s) => s.key === group.key)) {
          const snap = snapshotRegion(group, live, forecastJson);
          if (snap) snapshotRegions.push(snap);
        }
        await opts.onIssued?.(f);
      } catch (err) {
        errors.push(`${commodity.id}: ${(err as Error)?.message ?? err}`);
      }
    }
    status.openMeteoWeight = Math.round((meter.openMeteoWeight - before) * 100) / 100;
    if (errors.length === group.members.length) { status.status = 'failed'; status.error = errors.join('; '); }
    else if (errors.length) status.error = errors.join('; ');
    log(`${group.key.padEnd(14)} ${status.status.padEnd(8)} weight ${String(status.openMeteoWeight).padStart(6)}  total ${meter.openMeteoWeight}${status.error ? `  (${status.error})` : ''}`);
  }

  // Regions that could not run keep the previous issue, labelled as carried over.
  if (previous) for (const r of regions) if (r.status !== 'ok') for (const id of r.commodities) {
    for (const [key, f] of Object.entries(previous.results)) if (key.startsWith(`${id}:`) && !results[key]) results[key] = { ...f, precomputed: { ...(f.precomputed ?? { issuedAtUtc: previous.issuedAtUtc, issueDate: previous.issueDate, job: previous.job }), carriedOver: true } };
  }

  const file: OutlookFile = {
    schema: 'astraeus-outlooks-v1', job: PRECOMPUTE_JOB, issueDate, issuedAtUtc: issuedAt.toISOString(), completedAtUtc: new Date().toISOString(),
    engineVersion: COMMODITY_ENGINE_VERSION, methodVersions: [...methodVersions],
    openMeteo: { weightedCalls: meter.openMeteoWeight, requests: meter.openMeteoRequests, cacheHits: meter.cacheHits, allowance: opts.allowance, rateLimited: meter.rateLimited, budgetBlocked: meter.budgetBlocked },
    regions, results,
  };
  if (Object.values(results).some((f) => !f.precomputed?.carriedOver)) writeOutlooks(opts.root, file);
  opts.outbound.flush();
  return { file, snapshotRegions, meter };
}
