/**
 * The daily job (precompute → track-record snapshot → scoring) and its in-process scheduler.
 * The same `runDailyJob` backs the server scheduler, the CLI (research/track-record.ts) and the GitHub workflow.
 */
import { loadLatestOutlooks, runPrecompute, type OutlookFile } from './precompute.ts';
import { SNAPSHOT_EARLIEST_UTC_MINUTES, scoreTrackRecord, writeSnapshot, writeSummary } from './trackRecordStore.ts';
import type { Outbound } from './outbound.ts';
import type { CommodityForecast } from '../src/engine/commodityForecastEngine.ts';

const minutesUtc = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

export async function runDailyJob(opts: {
  root: string; outbound: Outbound; allowance: number; snapshot: boolean; only?: string[];
  log?: (m: string) => void; onIssued?: (f: CommodityForecast) => Promise<void> | void;
}) {
  const log = opts.log ?? (() => undefined);
  const { file, snapshotRegions, meter } = await runPrecompute({ root: opts.root, outbound: opts.outbound, allowance: opts.allowance, only: opts.only, log, onIssued: opts.onIssued });
  log(`precompute: ${file.regions.filter((r) => r.status === 'ok').length}/${file.regions.length} regions, Open-Meteo weight ${meter.openMeteoWeight} in ${meter.openMeteoRequests} requests (${meter.cacheHits} cache hits)`);
  let snapshot: ReturnType<typeof writeSnapshot> | null = null;
  if (opts.snapshot) {
    if (minutesUtc(new Date(file.issuedAtUtc)) < SNAPSHOT_EARLIEST_UTC_MINUTES) {
      snapshot = { written: false, reason: 'Issued before 06:30 UTC; the daily snapshot is taken from the scheduled run.' };
    } else {
      const missing = file.regions.filter((r) => r.status !== 'ok' || !snapshotRegions.some((s) => s.key === r.key))
        .map((r) => ({ key: r.key, reason: r.error ?? (r.status === 'ok' ? 'No calibrated outlook for this region today.' : r.status) }));
      snapshot = writeSnapshot(opts.root, { issueDate: file.issueDate, issuedAtUtc: file.issuedAtUtc, methodVersions: file.methodVersions, regions: snapshotRegions, missing });
    }
    log(snapshot.written ? `snapshot ${file.issueDate}: ${snapshotRegions.length} regions, chain ${snapshot.entry!.chain.slice(0, 16)}…` : `snapshot not written: ${snapshot.reason}`);
    writeSummary(opts.root);
  }
  return { file, meter, snapshot, snapshotRegions };
}

/** Stale = no outlooks, or none issued since today's 06:30 UTC (or, at startup, older than 30 hours). */
export function outlooksStale(latest: OutlookFile | null, now: Date, startup: boolean): boolean {
  if (!latest) return true;
  const issued = Date.parse(latest.issuedAtUtc);
  if (startup && now.getTime() - issued > 30 * 3_600_000) return true;
  const today0630 = Date.parse(`${now.toISOString().slice(0, 10)}T06:30:00Z`);
  return minutesUtc(now) >= SNAPSHOT_EARLIEST_UTC_MINUTES && issued < today0630;
}

/**
 * In-process scheduler: checks every 10 minutes (and 20 s after start-up) whether today's outlooks are due, runs
 * the daily job, and — with the track record on — scores once per UTC day.
 */
export function startScheduler(opts: {
  root: string; outbound: Outbound; allowance: number; trackRecord: boolean;
  log: (m: string) => void; onIssued?: (f: CommodityForecast) => Promise<void> | void; onComplete?: (file: OutlookFile) => void;
}) {
  let running = false;
  let scoredOn = '';
  const tick = async (startup = false) => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      if (outlooksStale(loadLatestOutlooks(opts.root), now, startup)) {
        const { file } = await runDailyJob({ root: opts.root, outbound: opts.outbound, allowance: opts.allowance, snapshot: opts.trackRecord, log: opts.log, onIssued: opts.onIssued });
        opts.onComplete?.(file);
      }
      const today = now.toISOString().slice(0, 10);
      if (opts.trackRecord && scoredOn !== today && minutesUtc(now) >= SNAPSHOT_EARLIEST_UTC_MINUTES) {
        const r = await scoreTrackRecord(opts.root, opts.outbound, { log: opts.log });
        opts.log(`track record: ${r.summary.cases.scored} scored / ${r.summary.cases.pending} pending, ledger head ${r.summary.ledger.head.slice(0, 12)}`);
        scoredOn = today;
      }
    } catch (err) {
      opts.log(`daily job failed: ${(err as Error)?.stack ?? err}`);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(() => void tick(true), 20_000);
  const every = setInterval(() => void tick(false), 10 * 60_000);
  first.unref?.();
  every.unref?.();
  return { runNow: () => tick(false), stop: () => { clearTimeout(first); clearInterval(every); } };
}

export { writeSummary };
