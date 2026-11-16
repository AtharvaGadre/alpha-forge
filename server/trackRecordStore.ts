/**
 * Live track record — file I/O around the pure functions in src/engine/trackRecord.ts.
 *
 * data/track-record/ (committed to git):
 *   snapshots/YYYY-MM-DD.json  what the site showed on that issue date (written once, never rewritten)
 *   ledger.jsonl               append-only {date, file, sha256, prev, chain = sha256(prev + sha256)}
 *   truth.json                 ERA5 daily truth used for scoring (point|date → values)
 *   summary.json               scores, pending cases and the ledger head (rebuilt after every snapshot/score)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ERA5_LAG_DAYS, GENESIS, TRACK_RECORD_SCHEMA, TRACK_VARIABLES, era5DailyTruth, ledgerEntry, parseLedger, scoreCase, summariseScores, verifyLedger,
  type CellSummary, type DailyTruth, type LedgerEntry, type ScoredRow, type SnapshotRegion, type TrackSnapshot,
} from '../src/engine/trackRecord.ts';
import { COMMODITY_ENGINE_VERSION } from '../src/engine/commodityForecastEngine.ts';
import type { Outbound } from './outbound.ts';

const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function trackRecordPaths(root: string) {
  const dir = path.join(root, 'data', 'track-record');
  return { dir, snapshots: path.join(dir, 'snapshots'), ledger: path.join(dir, 'ledger.jsonl'), truth: path.join(dir, 'truth.json'), summary: path.join(dir, 'summary.json') };
}

export function readLedger(root: string): LedgerEntry[] {
  try { return parseLedger(fs.readFileSync(trackRecordPaths(root).ledger, 'utf8')); } catch { return []; }
}

const fileShaIn = (root: string) => (file: string) => {
  try { return sha256(fs.readFileSync(path.join(trackRecordPaths(root).dir, file))); } catch { return null; }
};

export function verifyTrackRecord(root: string) {
  return verifyLedger(readLedger(root), fileShaIn(root), sha256);
}

/** Issued at or after 06:30 UTC — the daily schedule — so every snapshot reflects the same model-cycle timing. */
export const SNAPSHOT_EARLIEST_UTC_MINUTES = 6 * 60 + 30;

/**
 * Writes the snapshot for `issueDate` and appends its ledger line. Never overwrites: a second precompute on the
 * same day leaves the first snapshot (and the chain) untouched.
 */
export function writeSnapshot(root: string, input: { issueDate: string; issuedAtUtc: string; methodVersions: string[]; regions: SnapshotRegion[]; missing: Array<{ key: string; reason: string }> }): { written: boolean; reason?: string; entry?: LedgerEntry } {
  const p = trackRecordPaths(root);
  const rel = `snapshots/${input.issueDate}.json`;
  const file = path.join(p.dir, rel);
  if (fs.existsSync(file)) return { written: false, reason: 'A snapshot for this date already exists.' };
  if (!input.regions.length) return { written: false, reason: 'No region produced a calibrated outlook.' };
  const ledger = readLedger(root);
  if (ledger.some((e) => e.date === input.issueDate)) return { written: false, reason: 'The ledger already has this date.' };
  if (ledger.length && ledger[ledger.length - 1].date > input.issueDate) return { written: false, reason: 'Snapshots must be appended in date order.' };
  const snapshot: TrackSnapshot = {
    schema: TRACK_RECORD_SCHEMA,
    issueDate: input.issueDate,
    issuedAtUtc: input.issuedAtUtc,
    methodVersions: input.methodVersions,
    engineVersion: COMMODITY_ENGINE_VERSION,
    regions: input.regions,
    missing: input.missing,
    notes: [
      'Bands are copied verbatim from the live calibrated outlook; members are the raw model values that produced each band (matched on the band\'s raw count, mean, min and max).',
      'lead = days after the issue date (0 = the issue date, a partly elapsed UTC day at issue time).',
      'Scored against ERA5 (Open-Meteo archive, models=era5, UTC days with all 24 hours) once available, by research/track-record.ts score.',
    ],
  };
  const text = `${JSON.stringify(snapshot, null, 1)}\n`;
  fs.mkdirSync(p.snapshots, { recursive: true });
  fs.writeFileSync(file, text, { flag: 'wx' });
  const entry = ledgerEntry(ledger.length ? ledger[ledger.length - 1].chain : GENESIS, input.issueDate, rel, sha256(text), sha256);
  fs.appendFileSync(p.ledger, `${JSON.stringify(entry)}\n`);
  return { written: true, entry };
}

export function loadSnapshots(root: string): TrackSnapshot[] {
  const p = trackRecordPaths(root);
  return readLedger(root).map((e) => {
    try { return JSON.parse(fs.readFileSync(path.join(p.dir, e.file), 'utf8')) as TrackSnapshot; } catch { return null; }
  }).filter((s): s is TrackSnapshot => !!s && s.schema === TRACK_RECORD_SCHEMA);
}

type TruthFile = Record<string, DailyTruth & { fetchedAtUtc: string }>;
const pointKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
function loadTruth(root: string): TruthFile {
  try { return JSON.parse(fs.readFileSync(trackRecordPaths(root).truth, 'utf8')); } catch { return {}; }
}

export interface TrackRecordSummary {
  schema: string;
  generatedAtUtc: string;
  startDate: string | null;
  latestSnapshot: string | null;
  snapshots: number;
  regionsLatest: number;
  ledger: { head: string; length: number; ok: boolean; problems: string[] };
  cases: { total: number; scored: number; pending: number };
  /** Earliest date on which a pending case can be scored (valid date + ERA5 lag). */
  nextScoresExpected: string | null;
  methodVersions: Record<string, number>;
  cells: CellSummary[];
  verify: string;
}

/** Recomputes scores from the committed snapshots and truth (no network). */
export function buildSummary(root: string, now = new Date()): TrackRecordSummary {
  const snaps = loadSnapshots(root);
  const truth = loadTruth(root);
  const rows: ScoredRow[] = [];
  let total = 0;
  let pendingEarliest: string | null = null;
  const versions: Record<string, number> = {};
  for (const s of snaps) for (const r of s.regions) {
    versions[r.outlook.version] = (versions[r.outlook.version] ?? 0) + 1;
    for (const d of r.days) for (const v of TRACK_VARIABLES) {
      const c = d[v];
      if (!c) continue;
      total++;
      const t = truth[`${pointKey(r.lat, r.lng)}|${d.date}`];
      if (!t) { const due = addDays(d.date, ERA5_LAG_DAYS); if (!pendingEarliest || due < pendingEarliest) pendingEarliest = due; continue; }
      rows.push({ issueDate: s.issueDate, region: r.key, date: d.date, lead: d.lead, variable: v, version: r.outlook.version, y: t[v], score: scoreCase(v, c, t[v]) });
    }
  }
  const v = verifyTrackRecord(root);
  const latest = snaps[snaps.length - 1];
  return {
    schema: TRACK_RECORD_SCHEMA,
    generatedAtUtc: now.toISOString(),
    startDate: snaps[0]?.issueDate ?? null,
    latestSnapshot: latest?.issueDate ?? null,
    snapshots: snaps.length,
    regionsLatest: latest?.regions.length ?? 0,
    ledger: { head: v.head, length: v.length, ok: v.ok, problems: v.problems },
    cases: { total, scored: rows.length, pending: total - rows.length },
    nextScoresExpected: pendingEarliest,
    methodVersions: versions,
    cells: summariseScores(rows),
    verify: 'npx tsx research/track-record.ts verify',
  };
}

export function writeSummary(root: string, now = new Date()): TrackRecordSummary {
  const summary = buildSummary(root, now);
  const p = trackRecordPaths(root);
  fs.mkdirSync(p.dir, { recursive: true });
  // generatedAtUtc is left out of the committed file so an unchanged record produces no diff
  const { generatedAtUtc: _omit, ...stable } = summary;
  fs.writeFileSync(p.summary, `${JSON.stringify(stable, null, 1)}\n`);
  return summary;
}

/**
 * Fetches ERA5 for every snapshot point/date that is old enough and not yet in truth.json, then rebuilds the
 * summary. One archive request per point (weight 1 for ≤ 70 days); days without all 24 hours stay pending.
 */
export async function scoreTrackRecord(root: string, outbound: Outbound, opts: { now?: Date; log?: (m: string) => void } = {}) {
  const now = opts.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const log = opts.log ?? (() => undefined);
  const truth = loadTruth(root);
  const need = new Map<string, { lat: number; lng: number; dates: Set<string> }>();
  for (const s of loadSnapshots(root)) for (const r of s.regions) for (const d of r.days) {
    const pk = pointKey(r.lat, r.lng);
    if (truth[`${pk}|${d.date}`] || d.date > addDays(today, -(ERA5_LAG_DAYS - 1))) continue;
    const n = need.get(pk) ?? { lat: r.lat, lng: r.lng, dates: new Set<string>() };
    n.dates.add(d.date);
    need.set(pk, n);
  }
  const fetchJson = outbound.fetcher({ priority: 'scheduled' });
  let added = 0;
  for (const [pk, n] of need) {
    const dates = [...n.dates].sort();
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${n.lat.toFixed(3)}&longitude=${n.lng.toFixed(3)}&start_date=${dates[0]}&end_date=${dates[dates.length - 1]}&hourly=temperature_2m,precipitation&models=era5&timezone=UTC`;
    try {
      const daily = era5DailyTruth(await fetchJson(url, 20_000));
      for (const d of dates) {
        const t = daily.get(d);
        if (t) { truth[`${pk}|${d}`] = { ...t, fetchedAtUtc: now.toISOString() }; added++; }
      }
    } catch (err) {
      log(`ERA5 ${pk}: ${(err as Error).message}`);
      if (outbound.coolingDown()) break;
    }
  }
  if (added) {
    const sorted = Object.fromEntries(Object.entries(truth).sort(([a], [b]) => a.localeCompare(b)));
    fs.mkdirSync(trackRecordPaths(root).dir, { recursive: true });
    fs.writeFileSync(trackRecordPaths(root).truth, `${JSON.stringify(sorted, null, 1)}\n`);
  }
  log(`truth: ${added} new point-days from ${need.size} point(s)`);
  return { added, points: need.size, summary: writeSummary(root, now) };
}
