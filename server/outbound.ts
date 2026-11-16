/**
 * One outbound HTTP layer for every server-side data fetch (Open-Meteo, NOAA GFS via Open-Meteo, NASA POWER,
 * Yahoo Finance): a TTL cache, in-flight de-duplication, the daily Open-Meteo budget, a 429 cool-down and the
 * optional commercial Open-Meteo key. Archive / previous-runs ranges are served incrementally from `DayStore`.
 */
import path from 'node:path';
import { DayStore, OpenMeteoBudget, isOpenMeteo, isStaticMeta, openMeteoWeight, spliceable, withOpenMeteoKey, type CallPriority } from './openMeteo.ts';

export class OutboundError extends Error {
  constructor(message: string, readonly code: 'OM_BUDGET' | 'OM_COOLDOWN' | 'OM_429' | 'HTTP') { super(message); }
}

/** Per-job counters (the precompute uses one to measure its Open-Meteo weight). */
export interface FetchMeter {
  requests: number;
  openMeteoRequests: number;
  openMeteoWeight: number;
  cacheHits: number;
  rateLimited: boolean;
  budgetBlocked: number;
  byHost: Record<string, { requests: number; weight: number }>;
}
export const newMeter = (): FetchMeter => ({ requests: 0, openMeteoRequests: 0, openMeteoWeight: 0, cacheHits: 0, rateLimited: false, budgetBlocked: 0, byHost: {} });

export interface FetchContext { priority: CallPriority; meter?: FetchMeter }
export type FetchJsonFn = (url: string, timeoutMs: number) => Promise<any>;

const USER_AGENT = 'Astraeus/1.0 (+https://github.com/AtharvaGadre/alpha-forge)';
const MINUTE = 60_000;

function ttlFor(u: URL): number {
  const host = u.hostname.replace(/^customer-/, '');
  if (isOpenMeteo(u)) {
    if (isStaticMeta(u)) return 15 * MINUTE;
    if (host.startsWith('geocoding-api')) return 24 * 60 * MINUTE;
    if (host.startsWith('archive-api') || host.startsWith('previous-runs-api')) return 6 * 60 * MINUTE;
    return 30 * MINUTE; // forecast / ensemble
  }
  if (host.endsWith('finance.yahoo.com')) return 15 * MINUTE;
  if (host === 'power.larc.nasa.gov') return 24 * 60 * MINUTE;
  return 10 * MINUTE;
}

export function createOutbound(opts: { dataDir: string; dailyBudget: number; reserve: number; apiKey?: string; now?: () => Date }) {
  const now = opts.now ?? (() => new Date());
  const budget = new OpenMeteoBudget({ daily: opts.dailyBudget, reserve: opts.reserve, file: path.join(opts.dataDir, 'om-usage.json') }, now);
  const dayStore = new DayStore(path.join(opts.dataDir, 'om-days'), now);
  const memo = new Map<string, { expires: number; value: any }>();
  const inflight = new Map<string, Promise<any>>();
  const totals = newMeter();
  let cooldownUntil = 0;

  const count = (ctx: FetchContext, host: string, weight: number) => {
    for (const m of [totals, ctx.meter].filter(Boolean) as FetchMeter[]) {
      m.requests++;
      if (weight > 0 || host.endsWith('open-meteo.com')) { m.openMeteoRequests++; m.openMeteoWeight = Math.round((m.openMeteoWeight + weight) * 100) / 100; }
      const h = (m.byHost[host] = m.byHost[host] ?? { requests: 0, weight: 0 });
      h.requests++;
      h.weight = Math.round((h.weight + weight) * 100) / 100;
    }
  };

  async function network(url: string, timeoutMs: number, ctx: FetchContext): Promise<any> {
    const u = new URL(url);
    const om = isOpenMeteo(u);
    let weight = 0;
    if (om && !isStaticMeta(u)) {
      if (Date.now() < cooldownUntil) throw new OutboundError('Open-Meteo is paused after a rate-limit response; cached data only.', 'OM_COOLDOWN');
      weight = openMeteoWeight(url);
      if (!budget.tryConsume(weight, ctx.priority)) {
        totals.budgetBlocked++;
        if (ctx.meter) ctx.meter.budgetBlocked++;
        throw new OutboundError('The daily Open-Meteo budget for this server is used up; cached data only.', 'OM_BUDGET');
      }
    }
    const target = om ? withOpenMeteoKey(url, opts.apiKey) : url;
    count(ctx, u.hostname, weight);
    const res = await fetch(target, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': u.hostname.endsWith('finance.yahoo.com') ? 'Mozilla/5.0 (compatible; Astraeus/1.0)' : USER_AGENT, Accept: 'application/json' },
    });
    if (res.status === 429 && om) {
      cooldownUntil = Date.now() + 15 * MINUTE;
      totals.rateLimited = true;
      if (ctx.meter) ctx.meter.rateLimited = true;
      throw new OutboundError('Open-Meteo returned HTTP 429 (rate limit).', 'OM_429');
    }
    if (!res.ok) throw new OutboundError(`HTTP ${res.status}`, 'HTTP');
    return res.json();
  }

  /** Cached, de-duplicated JSON fetch. Errors are never cached. */
  async function fetchJson(url: string, timeoutMs: number, ctx: FetchContext): Promise<any> {
    const u = new URL(url);
    const hit = memo.get(url);
    if (hit && hit.expires > Date.now()) {
      totals.cacheHits++;
      if (ctx.meter) ctx.meter.cacheHits++;
      return hit.value;
    }
    const pending = inflight.get(url);
    if (pending) return pending;
    const job = (async () => {
      if (spliceable(url)) {
        // Day-level storage is the cache for these; the assembled response is not memoised (it can be large).
        const { json, fetched } = await dayStore.get(url, (sub) => network(sub, timeoutMs, ctx));
        if (!fetched) { totals.cacheHits++; if (ctx.meter) ctx.meter.cacheHits++; }
        return json;
      }
      const value = await network(url, timeoutMs, ctx);
      if (value && typeof value === 'object' && (value.error === true || value.chart?.error)) return value; // let callers report provider errors; do not cache
      memo.set(url, { expires: Date.now() + ttlFor(u), value });
      if (memo.size > 300) memo.delete(memo.keys().next().value!);
      return value;
    })();
    inflight.set(url, job);
    try { return await job; } finally { inflight.delete(url); }
  }

  return {
    budget,
    fetchJson,
    /** A `FetchJson` for engine code (`runLiveAtmospherePipeline`, `fetchGlobeWeather`). */
    fetcher: (ctx: FetchContext): FetchJsonFn => (url, timeoutMs) => fetchJson(url, timeoutMs, ctx),
    stats: () => ({ ...totals, byHost: { ...totals.byHost }, memoEntries: memo.size, cooldownUntil: cooldownUntil > Date.now() ? new Date(cooldownUntil).toISOString() : null }),
    coolingDown: () => Date.now() < cooldownUntil,
    keyConfigured: Boolean(opts.apiKey),
    flush: () => budget.flush(),
  };
}
export type Outbound = ReturnType<typeof createOutbound>;
