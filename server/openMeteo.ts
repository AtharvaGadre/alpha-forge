/**
 * Open-Meteo accounting for server-side requests: the fair-use call weight, a persistent daily budget, the
 * optional commercial key, and an incremental day store for archive / previous-runs ranges.
 *
 * Everything that reaches Open-Meteo from this server (live regional analyses, the daily precompute, the
 * track-record scorer and the globe wind field) goes through `server/outbound.ts`, which uses these helpers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Call weight
// ---------------------------------------------------------------------------

export const isOpenMeteo = (u: URL) => u.hostname === 'open-meteo.com' || u.hostname.endsWith('.open-meteo.com');
/** `…/data/<model>/static/meta.json` files are static metadata, not API calls. */
export const isStaticMeta = (u: URL) => u.pathname.startsWith('/data/');
const baseHost = (u: URL) => u.hostname.replace(/^customer-/, '');

/** Members per ensemble model, used because the ensemble API weighs each member like a variable (conservative). */
const ENSEMBLE_MEMBERS: Record<string, number> = {
  ecmwf_ifs025: 51, ecmwf_ifs04: 51, ecmwf_aifs025: 51, gfs025: 31, gfs05: 31, gfs_seamless: 31,
  icon_seamless: 40, icon_global: 40, icon_eu: 40, icon_d2: 20, gem_global: 21,
};

const listParam = (q: URLSearchParams, k: string) => (q.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const dayCount = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * Open-Meteo fair-use weight of one request: every location counts separately, and per location
 * max(1, variables × models / 10 × max(1, days / 14)) — 10 variables and 14 days make one call.
 */
export function openMeteoWeight(raw: string): number {
  const u = new URL(raw);
  if (!isOpenMeteo(u) || isStaticMeta(u)) return 0;
  const host = baseHost(u);
  const q = u.searchParams;
  if (host.startsWith('geocoding-api')) return 1;
  const locations = Math.max(1, listParam(q, 'latitude').length);
  const variables = ['hourly', 'daily', 'minutely_15', 'current'].reduce((a, k) => a + listParam(q, k).length, 0) || 1;
  const models = listParam(q, 'models');
  const ensemble = host.startsWith('ensemble-api');
  const modelFactor = models.length ? models.reduce((a, m) => a + (ensemble ? ENSEMBLE_MEMBERS[m] ?? 30 : 1), 0) : 1;
  const start = q.get('start_date');
  const end = q.get('end_date');
  const days = start && end ? dayCount(start, end)
    : q.get('forecast_hours') ? Number(q.get('forecast_hours')) / 24 + Number(q.get('past_days') ?? 0)
    : Number(q.get('forecast_days') ?? 7) + Number(q.get('past_days') ?? 0);
  const perLocation = Math.max(1, ((variables * modelFactor) / 10) * Math.max(1, days / 14));
  return Math.round(locations * perLocation * 100) / 100;
}

/** With OPEN_METEO_API_KEY set, API calls go to the `customer-` hosts with `apikey`; static metadata stays public. */
export function withOpenMeteoKey(raw: string, key?: string): string {
  if (!key) return raw;
  const u = new URL(raw);
  if (!isOpenMeteo(u) || isStaticMeta(u) || u.hostname.startsWith('customer-')) return raw;
  u.hostname = `customer-${u.hostname}`;
  u.searchParams.set('apikey', key);
  return u.toString();
}

// ---------------------------------------------------------------------------
// Daily budget
// ---------------------------------------------------------------------------

export type CallPriority = 'scheduled' | 'interactive';
interface BudgetState { date: string; used: number; scheduled: number; interactive: number; blocked: number }

/**
 * Per-UTC-day weighted-call budget, persisted so restarts do not reset it. Interactive traffic (visitor-triggered
 * analyses, the globe) may not eat into the last `reserve` units, which are kept for the scheduled precompute and
 * track-record scoring.
 */
export class OpenMeteoBudget {
  readonly daily: number;
  readonly reserve: number;
  private state: BudgetState;
  private timer: NodeJS.Timeout | null = null;
  constructor(opts: { daily: number; reserve: number; file?: string }, private readonly now = () => new Date()) {
    this.daily = opts.daily;
    this.reserve = Math.min(opts.reserve, opts.daily);
    this.file = opts.file;
    this.state = this.load();
  }
  private readonly file?: string;
  private today() { return this.now().toISOString().slice(0, 10); }
  private load(): BudgetState {
    const fresh = { date: this.today(), used: 0, scheduled: 0, interactive: 0, blocked: 0 };
    if (!this.file) return fresh;
    try {
      const s = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return s?.date === fresh.date && Number.isFinite(s.used) ? { ...fresh, ...s } : fresh;
    } catch { return fresh; }
  }
  private roll() { if (this.state.date !== this.today()) this.state = { date: this.today(), used: 0, scheduled: 0, interactive: 0, blocked: 0 }; }
  /** Units this priority may still spend today. */
  remaining(priority: CallPriority): number {
    this.roll();
    return Math.max(0, this.daily - (priority === 'interactive' ? this.reserve : 0) - this.state.used);
  }
  tryConsume(weight: number, priority: CallPriority): boolean {
    this.roll();
    if (weight > 0 && weight > this.remaining(priority)) { this.state.blocked++; this.persist(); return false; }
    this.state.used = Math.round((this.state.used + weight) * 100) / 100;
    this.state[priority] = Math.round((this.state[priority] + weight) * 100) / 100;
    this.persist();
    return true;
  }
  snapshot() { this.roll(); return { ...this.state, daily: this.daily, reserve: this.reserve, remaining: Math.max(0, this.daily - this.state.used) }; }
  private persist() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 1500);
    this.timer.unref?.();
  }
  flush() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.state));
      fs.renameSync(`${this.file}.tmp`, this.file);
    } catch { /* accounting must never break a request */ }
  }
}

// ---------------------------------------------------------------------------
// Incremental day store (archive + previous-runs)
// ---------------------------------------------------------------------------

interface StoredDay { d?: Record<string, number | null>; h?: Record<string, Array<number | null>>; used: string }
interface SeriesFile { v: 1; series: string; meta: Record<string, unknown>; dailyUnits?: Record<string, string>; hourlyUnits?: Record<string, string>; days: Record<string, StoredDay> }

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000));
const datesBetween = (a: string, b: string) => { const out: string[] = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

/**
 * Whether a request can be served from per-day storage: archive / previous-runs, one location, an explicit
 * date range and UTC days. Multi-location requests and anything else go to the network unchanged.
 */
export function spliceable(raw: string): boolean {
  const u = new URL(raw);
  if (!isOpenMeteo(u)) return false;
  const host = baseHost(u);
  if (!host.startsWith('archive-api') && !host.startsWith('previous-runs-api')) return false;
  const q = u.searchParams;
  const tz = (q.get('timezone') ?? 'GMT').toUpperCase();
  return !!q.get('start_date') && !!q.get('end_date') && listParam(q, 'latitude').length === 1 && (tz === 'UTC' || tz === 'GMT');
}

/**
 * Stores each final UTC day of a series once, so a rolling 90-day window costs one new day per run instead of the
 * whole window. A day is final when its values can no longer change: previous-runs days at least 2 days old, and
 * ERA5 days either complete or at least 10 days old (ERA5T revisions after that are ignored, which is documented).
 * Returned JSON has the same shape as the API response for the requested range.
 */
export class DayStore {
  private cache = new Map<string, SeriesFile>();
  private locks = new Map<string, Promise<unknown>>();
  constructor(private readonly dir: string, private readonly now = () => new Date()) {}

  private seriesOf(raw: string) {
    const u = new URL(raw);
    u.searchParams.delete('start_date');
    u.searchParams.delete('end_date');
    u.searchParams.sort();
    const series = `${baseHost(u)}${u.pathname}?${u.searchParams.toString()}`;
    return { series, file: path.join(this.dir, `${createHash('sha1').update(series).digest('hex').slice(0, 20)}.json`) };
  }
  private load(series: string, file: string): SeriesFile {
    const hit = this.cache.get(file);
    if (hit) return hit;
    let s: SeriesFile = { v: 1, series, meta: {}, days: {} };
    try { const parsed = JSON.parse(fs.readFileSync(file, 'utf8')); if (parsed?.v === 1 && parsed.series === series) s = parsed; } catch { /* new series */ }
    this.cache.set(file, s);
    if (this.cache.size > 12) this.cache.delete(this.cache.keys().next().value!);
    return s;
  }
  private save(file: string, s: SeriesFile) {
    const cutoff = addDays(isoDay(this.now()), -21);
    for (const [d, v] of Object.entries(s.days)) if (v.used < cutoff) delete s.days[d];
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(s));
    fs.renameSync(`${file}.tmp`, file);
  }
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.locks.set(key, run.catch(() => undefined));
    return run;
  }

  /** Splits a JSON response into days. */
  private static explode(json: any): Map<string, StoredDay & { complete: boolean }> {
    const out = new Map<string, StoredDay & { complete: boolean }>();
    const get = (d: string) => { let x = out.get(d); if (!x) { x = { used: '', complete: true }; out.set(d, x); } return x; };
    const daily = json?.daily ?? {};
    (daily.time ?? []).forEach((d: string, i: number) => {
      const day = get(d);
      day.d = day.d ?? {};
      for (const [k, arr] of Object.entries(daily)) if (k !== 'time') { const v = (arr as any[])[i]; day.d[k] = v ?? null; if (v === null || v === undefined) day.complete = false; }
    });
    const hourly = json?.hourly ?? {};
    const times: string[] = hourly.time ?? [];
    times.forEach((t, i) => {
      const day = get(t.slice(0, 10));
      const hour = Number(t.slice(11, 13));
      day.h = day.h ?? {};
      for (const [k, arr] of Object.entries(hourly)) if (k !== 'time') {
        const v = (arr as any[])[i];
        (day.h[k] = day.h[k] ?? Array(24).fill(null))[hour] = v ?? null;
        if (v === null || v === undefined) day.complete = false;
      }
    });
    for (const day of out.values()) if (day.h && Object.values(day.h).some((a) => a.length !== 24)) day.complete = false;
    return out;
  }

  private isFinal(host: string, day: string, complete: boolean) {
    const today = isoDay(this.now());
    if (host.startsWith('previous-runs-api')) return day <= addDays(today, -2);
    return day <= addDays(today, -10) || (complete && day <= addDays(today, -5));
  }

  /**
   * Serves `raw` (same shape as the API) from stored days, fetching only the missing span. Returns the weight of
   * what was actually fetched (0 when fully stored).
   */
  async get(raw: string, fetchRange: (url: string) => Promise<any>): Promise<{ json: any; fetched: string | null }> {
    const u = new URL(raw);
    const host = baseHost(u);
    const start = u.searchParams.get('start_date')!;
    const end = u.searchParams.get('end_date')!;
    const { series, file } = this.seriesOf(raw);
    return this.withLock(file, async () => {
      const s = this.load(series, file);
      const want = datesBetween(start, end);
      const missing = want.filter((d) => !s.days[d]);
      let fresh = new Map<string, StoredDay & { complete: boolean }>();
      let fetched: string | null = null;
      const today = isoDay(this.now());
      if (missing.length) {
        const a = missing[0];
        let b = missing[missing.length - 1];
        // Past-year windows move forward one day per run: fetching up to 14 days ahead costs the same single call.
        if (host.startsWith('archive-api') && b <= addDays(today, -400)) {
          const ext = addDays(a, 13);
          if (ext > b && ext <= addDays(today, -400)) b = ext;
        }
        const f = new URL(raw);
        f.searchParams.set('start_date', a);
        f.searchParams.set('end_date', b);
        fetched = f.toString();
        const json = await fetchRange(fetched);
        if (Array.isArray(json)) throw new Error('Unexpected multi-location response.');
        const { daily, hourly, daily_units, hourly_units, ...meta } = json ?? {};
        s.meta = meta;
        if (daily_units) s.dailyUnits = daily_units;
        if (hourly_units) s.hourlyUnits = hourly_units;
        fresh = DayStore.explode(json);
        for (const [d, v] of fresh) if (this.isFinal(host, d, v.complete)) s.days[d] = { d: v.d, h: v.h, used: today };
      }
      const dailyKeys = new Set<string>();
      const hourlyKeys = new Set<string>();
      for (const d of want) {
        const day = s.days[d] ?? fresh.get(d);
        if (s.days[d]) s.days[d].used = today;
        Object.keys(day?.d ?? {}).forEach((k) => dailyKeys.add(k));
        Object.keys(day?.h ?? {}).forEach((k) => hourlyKeys.add(k));
      }
      const json: any = { ...s.meta };
      if (dailyKeys.size) {
        json.daily_units = s.dailyUnits;
        json.daily = { time: want };
        for (const k of dailyKeys) json.daily[k] = want.map((d) => (s.days[d] ?? fresh.get(d))?.d?.[k] ?? null);
      }
      if (hourlyKeys.size) {
        json.hourly_units = s.hourlyUnits;
        json.hourly = { time: want.flatMap((d) => HOURS.map((h) => `${d}T${h}`)) };
        for (const k of hourlyKeys) json.hourly[k] = want.flatMap((d) => (s.days[d] ?? fresh.get(d))?.h?.[k] ?? Array(24).fill(null));
      }
      try { this.save(file, s); } catch { /* storage is an optimisation */ }
      return { json, fetched };
    });
  }
}
