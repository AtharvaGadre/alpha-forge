/**
 * Live track record — pure scoring and ledger functions (no I/O; unit-tested in trackRecord.test.ts).
 *
 * Every daily precompute snapshots what the site shows: for each region and day, the calibrated band of the live
 * outlook exactly as stored (mean, p10/p50/p90, event probability, calibrated flag) plus the raw model values that
 * produced it. Once ERA5 covers a valid date, each case is scored against two references built from the same raw
 * values: the raw multi-model ensemble and the no-training Gaussian (`rawGaussian`).
 *
 * Scores
 * - CRPS where the outlook's full predictive law is recoverable from the band: a calibrated temperature band of a
 *   Gaussian method (p10/p50/p90 symmetric, σ = (p90 − p10) / (2·z₀.₉)), or an uncalibrated band (= raw ensemble).
 * - QS: the three-quantile approximation of the CRPS, (2/3)·Σ pinball(τ) over τ = 0.1, 0.5, 0.9, computed for all
 *   three forecasts from their 10/50/90 % quantiles. It is used for rainfall, whose skill-weighted ensemble cannot be
 *   rebuilt from the stored band, and wherever the band is not Gaussian.
 * - Band PIT: share of outcomes below p10, p10–p50, p50–p90 and above p90 (expected 10/40/40/10 %); ties with a
 *   point mass (dry days) spread the outcome uniformly over the tied probability range.
 * - Inside-80 %: the mass of the band PIT inside [0.1, 0.9].
 * - Brier score for P(Tmax ≥ 32 °C) and P(rain ≥ 1 mm), the outlook's own events.
 */
import { PhiInv, crpsOf, exceedanceOf, quantileOf, rawGaussian, type PredictiveForecast, type VariableKind } from './weatherPostprocessing';
import { hourlyAggregate, type OutlookBand } from './calibratedOutlook';

export const TRACK_RECORD_SCHEMA = 'astraeus-track-record-v1';
export type TrackVariable = 'tmean' | 'tmax' | 'precip';
export const TRACK_VARIABLES: TrackVariable[] = ['tmax', 'tmean', 'precip'];
export const EVENT_THRESHOLD: Record<TrackVariable, number | null> = { tmax: 32, tmean: null, precip: 1 };
export const kindOf = (v: TrackVariable): VariableKind => (v === 'precip' ? 'precipitation' : 'temperature');
/** ERA5 at Open-Meteo trails real time by about five days; a valid date is normally scoreable six days later. */
export const ERA5_LAG_DAYS = 6;

export interface SnapshotCase {
  /** The outlook band exactly as `buildCalibratedOutlook` stored it. */
  band: OutlookBand;
  /** Raw model values behind the band (model name → value), recovered from the forecast response; null if not matched. */
  members: Record<string, number> | null;
}
export interface SnapshotDay { date: string; lead: number; trainingLead: number; tmean?: SnapshotCase; tmax?: SnapshotCase; precip?: SnapshotCase }
export interface SnapshotRegion {
  key: string; name: string; lat: number; lng: number; commodities: string[];
  generatedAtUtc: string; inputSha256: string;
  outlook: { version: string; trainingDates: { start: string; end: string }; models: string[] };
  days: SnapshotDay[];
}
export interface TrackSnapshot {
  schema: string; issueDate: string; issuedAtUtc: string; methodVersions: string[]; engineVersion: string;
  regions: SnapshotRegion[]; missing: Array<{ key: string; reason: string }>; notes: string[];
}

// ---------------------------------------------------------------------------
// Snapshot construction helpers
// ---------------------------------------------------------------------------

const r2 = (x: number) => Math.round(x * 100) / 100;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** True when `values` reproduce the band's raw summary (member count, mean, min and max at 0.01 precision). */
export function membersMatchBand(values: number[], band: Pick<OutlookBand, 'members' | 'rawMean' | 'rawMin' | 'rawMax'>): boolean {
  if (values.length !== band.members || !values.length) return false;
  const close = (a: number, b: number) => Math.abs(r2(a) - b) <= 0.011;
  return close(avg(values), band.rawMean) && close(Math.min(...values), band.rawMin) && close(Math.max(...values), band.rawMax);
}

/**
 * Recovers which models formed a band: first the outlook's own model list, otherwise the subset (≤ 2^n, n ≤ 8)
 * whose values reproduce the band's raw count, mean, min and max. Returns null when nothing matches.
 */
export function matchMembers(values: Record<string, number | null | undefined>, band: OutlookBand, preferred: string[] = []): Record<string, number> | null {
  const finite = Object.entries(values).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]));
  const pick = (names: string[]) => Object.fromEntries(finite.filter(([n]) => names.includes(n)));
  const pref = finite.filter(([n]) => preferred.includes(n));
  if (membersMatchBand(pref.map(([, v]) => v), band)) return pick(pref.map(([n]) => n));
  if (finite.length > 8) return null;
  for (let mask = 1; mask < 1 << finite.length; mask++) {
    const subset = finite.filter((_, i) => mask & (1 << i));
    if (subset.length === band.members && membersMatchBand(subset.map(([, v]) => v), band)) return pick(subset.map(([n]) => n));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

const Z90 = PhiInv(0.9);

/** The outlook's predictive law when the band determines it (see header); otherwise null. */
export function outlookForecast(c: SnapshotCase, variable: TrackVariable): PredictiveForecast | null {
  const { band } = c;
  const members = c.members ? Object.values(c.members) : null;
  if (!band.calibrated) return members && members.length >= 2 ? { kind: 'ensemble', members } : null;
  if (variable === 'precip') return null;
  const sigma = (band.p90 - band.p10) / (2 * Z90);
  const symmetric = Math.abs(band.p50 - band.mean) <= 0.02 && Math.abs((band.p90 - band.p50) - (band.p50 - band.p10)) <= 0.03;
  return sigma > 0 && symmetric ? { kind: 'normal', mu: band.mean, sigma } : null;
}

export const pinball = (q: number, y: number, tau: number) => (y >= q ? tau * (y - q) : (1 - tau) * (q - y));
/** Three-quantile approximation of the CRPS: 2 × the mean pinball loss at τ = 0.1, 0.5, 0.9. */
export const quantileScore = (q: [number, number, number], y: number) => (2 / 3) * (pinball(q[0], y, 0.1) + pinball(q[1], y, 0.5) + pinball(q[2], y, 0.9));

const TAUS = [0, 0.1, 0.5, 0.9, 1];
/**
 * Band PIT histogram contribution of one outcome: bins [0,0.1), [0.1,0.5), [0.5,0.9), [0.9,1]. The PIT lies in
 * [max τ with q_τ < y, min τ with q_τ > y]; that range is spread uniformly (a single bin unless y ties a quantile).
 */
export function bandBins(q: [number, number, number], y: number): [number, number, number, number] {
  const lo = Math.max(0, ...[0.1, 0.5, 0.9].filter((_, i) => q[i] < y));
  const hi = Math.min(1, ...[0.1, 0.5, 0.9].filter((_, i) => q[i] > y));
  const out: [number, number, number, number] = [0, 0, 0, 0];
  if (hi <= lo) { out[Math.min(3, TAUS.findIndex((t) => t > lo) - 1)] = 1; return out; }
  for (let b = 0; b < 4; b++) out[b] = Math.max(0, Math.min(hi, TAUS[b + 1]) - Math.max(lo, TAUS[b])) / (hi - lo);
  return out;
}

export interface ForecasterScore { crps: number | null; qs: number; bins: [number, number, number, number]; inside80: number; brier: number | null; prob: number | null }
export interface CaseScore { outlook: ForecasterScore; gaussian: ForecasterScore | null; raw: ForecasterScore | null; outcome: boolean | null }

function scoreOf(q: [number, number, number], y: number, crps: number | null, prob: number | null, outcome: boolean | null): ForecasterScore {
  const bins = bandBins(q, y);
  return { crps, qs: quantileScore(q, y), bins, inside80: bins[1] + bins[2], prob, brier: prob == null || outcome == null ? null : (prob - (outcome ? 1 : 0)) ** 2 };
}

export function scoreCase(variable: TrackVariable, c: SnapshotCase, y: number): CaseScore {
  const t = EVENT_THRESHOLD[variable];
  const outcome = t == null ? null : y >= t;
  const ofc = outlookForecast(c, variable);
  const outlook = scoreOf([c.band.p10, c.band.p50, c.band.p90], y, ofc ? crpsOf(ofc, y) : null, t == null ? null : c.band.prob ?? null, outcome);
  const members = c.members ? Object.values(c.members) : [];
  const ref = (fc: PredictiveForecast) => scoreOf([quantileOf(fc, 0.1), quantileOf(fc, 0.5), quantileOf(fc, 0.9)], y, crpsOf(fc, y), t == null ? null : exceedanceOf(fc, t), outcome);
  return {
    outlook,
    gaussian: members.length >= 2 ? ref(rawGaussian(members, kindOf(variable))) : null,
    raw: members.length >= 2 ? ref({ kind: 'ensemble', members }) : null,
    outcome,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface ScoredRow { issueDate: string; region: string; date: string; lead: number; variable: TrackVariable; version: string; y: number; score: CaseScore }
export interface ForecasterSummary { crps: number | null; qs: number; inside80: number; bins: number[]; brier: number | null }
export interface CellSummary {
  variable: TrackVariable; lead: number; n: number;
  /** 'crps' when every case in the cell has an exact outlook CRPS, otherwise the three-quantile score. */
  metric: 'crps' | 'qs';
  outlook: ForecasterSummary; gaussian: ForecasterSummary; raw: ForecasterSummary;
  skillVsGaussian: number | null; skillVsRaw: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const round = (x: number | null, d = 4) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

/** Averages per variable × lead over cases that have both baselines (so all three are scored on the same cases). */
export function summariseScores(rows: ScoredRow[]): CellSummary[] {
  const cells = new Map<string, ScoredRow[]>();
  for (const r of rows) if (r.score.gaussian && r.score.raw) {
    const k = `${r.variable}|${r.lead}`;
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(r);
  }
  const out: CellSummary[] = [];
  for (const [k, rs] of cells) {
    const [variable, lead] = [k.split('|')[0] as TrackVariable, Number(k.split('|')[1])];
    const metric: 'crps' | 'qs' = rs.every((r) => r.score.outlook.crps != null) ? 'crps' : 'qs';
    const summ = (pick: (r: ScoredRow) => ForecasterScore): ForecasterSummary => {
      const s = rs.map(pick);
      const briers = s.map((x) => x.brier).filter((x): x is number => x != null);
      return {
        crps: metric === 'crps' ? round(mean(s.map((x) => x.crps!))) : null,
        qs: round(mean(s.map((x) => x.qs)))!,
        inside80: round(mean(s.map((x) => x.inside80)))!,
        bins: [0, 1, 2, 3].map((b) => round(mean(s.map((x) => x.bins[b])))!),
        brier: briers.length === s.length && briers.length ? round(mean(briers)) : null,
      };
    };
    const o = summ((r) => r.score.outlook), g = summ((r) => r.score.gaussian!), w = summ((r) => r.score.raw!);
    const val = (s: ForecasterSummary) => (metric === 'crps' ? s.crps! : s.qs);
    out.push({ variable, lead, n: rs.length, metric, outlook: o, gaussian: g, raw: w,
      skillVsGaussian: val(g) > 0 ? round(1 - val(o) / val(g)) : null, skillVsRaw: val(w) > 0 ? round(1 - val(o) / val(w)) : null });
  }
  return out.sort((a, b) => TRACK_VARIABLES.indexOf(a.variable) - TRACK_VARIABLES.indexOf(b.variable) || a.lead - b.lead);
}

// ---------------------------------------------------------------------------
// Truth
// ---------------------------------------------------------------------------

export interface DailyTruth { tmean: number; tmax: number; precip: number }
/**
 * Daily ERA5 truth from an Open-Meteo archive response requested with `hourly=temperature_2m,precipitation`,
 * `models=era5` and `timezone=UTC`. A day counts only with all 24 hours (`hourlyAggregate`, as the live outlook).
 */
export function era5DailyTruth(json: any): Map<string, DailyTruth> {
  const t = json?.hourly?.time as string[] | undefined;
  const temp = hourlyAggregate(t, json?.hourly?.temperature_2m, 'mean');
  const tmax = hourlyAggregate(t, json?.hourly?.temperature_2m, 'max');
  const rain = hourlyAggregate(t, json?.hourly?.precipitation, 'sum');
  const out = new Map<string, DailyTruth>();
  for (const [d, v] of temp) if (tmax.has(d) && rain.has(d)) out.set(d, { tmean: r2(v), tmax: r2(tmax.get(d)!), precip: r2(rain.get(d)!) });
  return out;
}

// ---------------------------------------------------------------------------
// Ledger (hash chain)
// ---------------------------------------------------------------------------

export const GENESIS = '0'.repeat(64);
export interface LedgerEntry { date: string; file: string; sha256: string; prev: string; chain: string }
export type Sha256Hex = (text: string) => string;

/** chain = sha256(prev + sha256(file)), prev = the previous entry's chain (64 zeros for the first). */
export function ledgerEntry(prev: string, date: string, file: string, fileSha256: string, sha256: Sha256Hex): LedgerEntry {
  return { date, file, sha256: fileSha256, prev, chain: sha256(prev + fileSha256) };
}

export function parseLedger(text: string): LedgerEntry[] {
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as LedgerEntry);
}

/** Recomputes every link. `fileSha` returns the current sha256 of a snapshot file (null when missing). */
export function verifyLedger(entries: LedgerEntry[], fileSha: (file: string) => string | null, sha256: Sha256Hex): { ok: boolean; head: string; length: number; problems: string[] } {
  const problems: string[] = [];
  let prev = GENESIS;
  const seen = new Set<string>();
  entries.forEach((e, i) => {
    const at = `line ${i + 1} (${e.date})`;
    if (e.prev !== prev) problems.push(`${at}: prev does not equal the previous chain value`);
    const actual = fileSha(e.file);
    if (actual == null) problems.push(`${at}: ${e.file} is missing`);
    else if (actual !== e.sha256) problems.push(`${at}: ${e.file} has changed (sha256 ${actual.slice(0, 12)}… ≠ ${e.sha256.slice(0, 12)}…)`);
    if (sha256(e.prev + e.sha256) !== e.chain) problems.push(`${at}: chain value does not match sha256(prev + sha256)`);
    if (seen.has(e.date)) problems.push(`${at}: duplicate date`);
    seen.add(e.date);
    prev = e.chain;
  });
  return { ok: problems.length === 0, head: prev, length: entries.length, problems };
}
