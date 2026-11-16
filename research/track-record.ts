/**
 * Live track record CLI.
 *
 *   npx tsx research/track-record.ts snapshot [--allowance 1500] [--only iowa,kansas]
 *       Runs today's precompute (data/outlooks/latest.json) and, at or after 06:30 UTC, writes
 *       data/track-record/snapshots/<today>.json and appends its line to ledger.jsonl.
 *   npx tsx research/track-record.ts score
 *       Fetches ERA5 for every snapshot day old enough (≈ 6-day lag), stores it in truth.json, rebuilds summary.json.
 *   npx tsx research/track-record.ts verify
 *       Recomputes every file hash and the hash chain; exits 1 if anything changed.
 *
 * Environment: OPEN_METEO_DAILY_BUDGET (default 5000), OPEN_METEO_API_KEY (optional customer hosts),
 * PRECOMPUTE_ALLOWANCE (default 1500).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOutbound } from '../server/outbound.ts';
import { runDailyJob } from '../server/dailyJob.ts';
import { scoreTrackRecord, verifyTrackRecord, writeSummary } from '../server/trackRecordStore.ts';
import { createForecastLedger, issuedSignal } from '../src/engine/forecastBacktest.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...rest] = process.argv.slice(2);
const arg = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const num = (v: string | undefined, d: number) => (v != null && Number.isFinite(Number(v)) ? Number(v) : d);
const log = (m: string) => console.log(m);

function outbound() {
  return createOutbound({
    dataDir: path.join(root, '.astraeus-data'),
    dailyBudget: num(process.env.OPEN_METEO_DAILY_BUDGET, 5000),
    reserve: num(process.env.OPEN_METEO_RESERVE, 1500),
    perMinute: num(process.env.OPEN_METEO_PER_MINUTE, 300),
    apiKey: process.env.OPEN_METEO_API_KEY || undefined,
  });
}

async function main() {
  if (command === 'snapshot' || command === 'precompute') {
    const ob = outbound();
    const ledger = createForecastLedger(path.join(root, '.astraeus-data'));
    const t0 = Date.now();
    const { file, meter, snapshot, snapshotRegions } = await runDailyJob({
      root, outbound: ob, snapshot: command === 'snapshot', log,
      allowance: num(arg('allowance') ?? process.env.PRECOMPUTE_ALLOWANCE, 1500),
      only: arg('only')?.split(','),
      onIssued: (f) => ledger.append(issuedSignal(f)),
    });
    ob.flush();
    // How many bands found their raw members (needed for both baselines)
    const bands = snapshotRegions.flatMap((r) => r.days.flatMap((d) => (['tmax', 'tmean', 'precip'] as const).map((v) => d[v]).filter(Boolean)));
    const regionsOut = snapshotRegions.map((r) => ({ key: r.key, version: r.outlook.version, models: r.outlook.models.length, bands: r.days.reduce((a, d) => a + (['tmax', 'tmean', 'precip'] as const).filter((v) => d[v]).length, 0) }));
    console.log(JSON.stringify({ issuedAtUtc: file.issuedAtUtc, seconds: Math.round((Date.now() - t0) / 1000), openMeteo: { weight: meter.openMeteoWeight, requests: meter.openMeteoRequests, cacheHits: meter.cacheHits, rateLimited: meter.rateLimited, byHost: meter.byHost }, budgetToday: ob.budget.snapshot(), snapshot, snapshotRegions: regionsOut, bands: bands.length, bandsWithMembers: bands.filter((b) => b!.members).length }, null, 2));
    if (meter.rateLimited) process.exitCode = 2;
  } else if (command === 'score') {
    const ob = outbound();
    const r = await scoreTrackRecord(root, ob, { log });
    ob.flush();
    console.log(JSON.stringify({ added: r.added, points: r.points, cases: r.summary.cases, nextScoresExpected: r.summary.nextScoresExpected, ledgerHead: r.summary.ledger.head }, null, 2));
  } else if (command === 'verify') {
    const v = verifyTrackRecord(root);
    console.log(v.ok ? `OK: ${v.length} snapshot(s), ledger head ${v.head}` : `FAILED:\n${v.problems.join('\n')}`);
    if (!v.ok) process.exitCode = 1;
  } else if (command === 'summary') {
    const s = writeSummary(root);
    console.log(JSON.stringify(s, null, 2));
  } else {
    console.log('Usage: npx tsx research/track-record.ts snapshot|score|verify|summary');
    process.exitCode = 64;
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
