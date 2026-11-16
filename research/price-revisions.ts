/**
 * research/price-revisions.ts — do CHANGES in the gas-weighted degree-day forecast (or weather
 * surprises scaled by the storage model) forecast weekly Henry Hub futures returns?
 *
 *   npx tsx research/price-revisions.ts            # needs the storage-study cache (fetches anything missing)
 *   npx tsx research/price-revisions.ts --offline
 *
 * Pre-specification: docs/results/PRICE_STUDY_REVISIONS.md (committed before scoring).
 * Output: public/research/price-revisions.json and the generated results section of that file.
 * Uses the walk-forward machinery, baselines and tests of research/price-study.ts
 * (src/engine/priceSkill.ts) unchanged; does not touch price-skill.json.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  addDaysIso,
  barForWeekEnding,
  benjaminiHochberg,
  evaluateSkill,
  fridays,
  neweyWestLag,
  olsHac,
  sdSample,
  walkForward,
  weekdayOf,
  type PriceBar,
  type SkillMetrics,
  type StudyRow,
} from '../src/engine/priceSkill';
import { walkForwardStorage, type StorageSpec } from '../src/engine/storageSkill';
import { ROOT, loadPrices, usage } from './storage-data';
import { STORAGE_CONFIG, devSelection, loadData, type Data } from './storage-study';
import type { DD } from './storage-weather';

export const REVISIONS_CONFIG = {
  study: 'astraeus-ng-forecast-revisions-v1',
  symbol: 'NG=F',
  priceStart: '2004-06-01',
  priceEnd: '2026-11-14',
  firstOrigin: '2021-04-30',
  lastOrigin: '2026-11-06',
  primaryModels: ['gfs_global'],
  robustnessModels: ['gfs_global', 'ecmwf_ifs025'],
  minTrain: 52,
  lambdaPerObs: 0.1,
  bootstrap: { resamples: 1000, seed: 20261117 },
};
const R = REVISIONS_CONFIG;

type FeatureKey = 'H1_REV1D' | 'H2_REVACC' | 'H3_WKSURP_DD' | 'H4_WKSURP_STOR' | 'H5_WKANOM_5Y' | 'H6_NEXTWK_ANOM';
const FEATURES: Array<{ key: FeatureKey; label: string; kind: 'change' | 'news' | 'level' }> = [
  { key: 'H1_REV1D', label: 'H1 1-day revision of the gas-weighted HDD+CDD forecast for days 0…+5 (lead k+1 minus lead k+2)', kind: 'change' },
  { key: 'H2_REVACC', label: 'H2 Accumulated revision for days 0…+5 (lead k+1 minus lead 7)', kind: 'change' },
  { key: 'H3_WKSURP_DD', label: 'H3 Weather surprise of the storage week just ended: realised minus week-start forecast HDD+CDD', kind: 'news' },
  { key: 'H4_WKSURP_STOR', label: 'H4 Storage-model surprise of that week: model(realised DD) minus model(forecast DD), Bcf', kind: 'news' },
  { key: 'H5_WKANOM_5Y', label: 'H5 Weather-implied storage anomaly of that week vs the EIA five-year average, Bcf', kind: 'level' },
  { key: 'H6_NEXTWK_ANOM', label: 'H6 Forecast-implied storage anomaly of the coming week vs the five-year average, Bcf', kind: 'level' },
];

const tdd = (x: DD) => x.hdd + x.cdd;

function marketFeatures(bars: PriceBar[], friday: string): number[] | null {
  const closes: number[] = [];
  for (let k = 0; k <= 12; k++) {
    const b = barForWeekEnding(bars, addDaysIso(friday, -7 * k));
    if (!b) return null;
    closes.push(b.close);
  }
  const rets = closes.slice(0, 12).map((c, i) => Math.log(c / closes[i + 1]));
  return [rets[0], Math.log(closes[0] / closes[4]), sdSample(rets)];
}

interface Built {
  rows: Record<FeatureKey, StudyRow[]>;
  diag: Array<{ origin: string; y: number; holdSurprise: number }>;
  dropped: { notFriday: number; missingInputs: number };
}

function buildRows(d: Data, bars: PriceBar[], spec: StorageSpec, models: string[]): Built {
  const ctx = d.ctx;
  const rows = Object.fromEntries(FEATURES.map((f) => [f.key, [] as StudyRow[]])) as Record<FeatureKey, StudyRow[]>;
  const diag: Built['diag'] = [];
  const dropped = { notFriday: 0, missingInputs: 0 };
  const fc = (lead: number, day: string, issue: string) => ctx.forecastDay(models, lead, day, issue, true);
  /** Realised proxy for the storage week ending `weekEnd`, known at the Friday close of weekEnd: CPC through Wednesday, lead-1 forecast for Thursday. */
  const realisedProxy = (weekEnd: string): DD | null => {
    let hdd = 0, cdd = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDaysIso(weekEnd, i - 7);
      const v = i < 6 ? ctx.truthDay(day) : fc(1, day, weekEnd);
      if (!v) return null;
      hdd += v.hdd;
      cdd += v.cdd;
    }
    return { hdd, cdd };
  };
  for (const t of fridays(R.firstOrigin, R.lastOrigin)) {
    const bar = barForWeekEnding(bars, t);
    const end = barForWeekEnding(bars, addDaysIso(t, 7));
    if (!bar || !end) continue;
    if (bar.date !== t || weekdayOf(bar.date) !== 5) { dropped.notFriday++; continue; }
    const market = marketFeatures(bars, t);
    if (!market) continue;
    const y = Math.log(end.close / bar.close);
    // Forecast revisions for days t … t+5 (local Central days); issue = runs initialised ≤ Thursday 23:00 CT.
    let rev1 = 0, revAcc = 0, ok = true;
    for (let i = 0; i <= 5 && ok; i++) {
      const day = addDaysIso(t, i);
      const a = fc(i + 1, day, t), b = fc(i + 2, day, t), c7 = fc(7, day, t);
      if (!a || !b || !c7) { ok = false; break; }
      rev1 += tdd(a) - tdd(b);
      revAcc += tdd(a) - tdd(c7);
    }
    const real = realisedProxy(t);
    const wkFc = ctx.forecastWeek(models, t, true);
    const nextFc = ctx.forecastWeek(models, addDaysIso(t, 7), true);
    const f5 = d.fiveYr.get(t);
    const f5next = d.fiveYr.get(addDaysIso(t, 7));
    if (!ok || !real || !wkFc || !nextFc || f5 === undefined || f5next === undefined) { dropped.missingInputs++; continue; }
    // Storage model as known at the origin: trained on report weeks ending ≤ t − 7 (published Thursday t − 1).
    const inputs = { real: () => real, wk: () => wkFc, next: () => nextFc };
    const wf = walkForwardStorage(d.obs, [addDaysIso(t, 7)], spec, { gapDays: 14, minTrain: STORAGE_CONFIG.minTrain }, { real: inputs.real, wk: inputs.wk, next: inputs.next });
    if (!wf.length) { dropped.missingInputs++; continue; }
    // walkForwardStorage evaluates the design at the target week (t + 7); re-evaluate the past-week terms at week t with the same coefficients.
    const wfPast = walkForwardStorage(d.obs.filter((o) => o.weekEnd <= addDaysIso(t, -7)), [t], spec, { gapDays: 7, minTrain: STORAGE_CONFIG.minTrain }, { real: inputs.real, wk: inputs.wk });
    if (!wfPast.length) { dropped.missingInputs++; continue; }
    const p = wfPast[0].preds;
    const values: Record<FeatureKey, number> = {
      H1_REV1D: rev1,
      H2_REVACC: revAcc,
      H3_WKSURP_DD: tdd(real) - tdd(wkFc),
      H4_WKSURP_STOR: p.real! - p.wk!,
      H5_WKANOM_5Y: p.real! - f5,
      H6_NEXTWK_ANOM: wf[0].preds.next! - f5next,
    };
    for (const f of FEATURES) rows[f.key].push({ origin: t, labelDate: end.date, y, market, weather: [values[f.key]] });
    // Contemporaneous diagnostic: the weather surprise that arrives DURING the holding week.
    const realNext = realisedProxy(addDaysIso(t, 7));
    if (realNext) diag.push({ origin: t, y, holdSurprise: tdd(realNext) - tdd(nextFc) });
  }
  return { rows, diag, dropped };
}

interface FamilyRow {
  key: FeatureKey;
  label: string;
  kind: string;
  nRows: number;
  metrics: SkillMetrics | null;
  qCw: number | null;
  qDm: number | null;
  inSample: { coefPctPerSd: number; t: number; p: number; n: number } | null;
  robustness?: Array<{ variant: string; n: number; oosR2Wx: number; oosR2WxVsMkt: number; cwP: number | null; dmVsRwP: number | null }>;
}

function score(rows: StudyRow[], lambdaPerObs = R.lambdaPerObs, seed = R.bootstrap.seed) {
  return evaluateSkill(walkForward(rows, { minTrain: R.minTrain, lambdaPerObs }), 1, { resamples: R.bootstrap.resamples, seed });
}

function inSample(rows: StudyRow[]) {
  if (rows.length < 30) return null;
  const x = rows.map((r) => r.weather[0]);
  const sd = sdSample(x);
  const reg = olsHac(x.map((v) => [v / sd]), rows.map((r) => r.y), neweyWestLag(rows.length, 1));
  return { coefPctPerSd: reg.coef[1] * 100, t: reg.t[1], p: reg.p[1], n: rows.length };
}

const fmt = (x: number | null | undefined, dgt = 2) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(dgt));
const fmtP = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : x < 0.001 ? '<0.001' : x.toFixed(3));

export const REVISIONS_MARKER = '<!-- RESULTS: everything below this line is generated by research/price-revisions.ts -->';

async function main() {
  const d = await loadData(true);
  const dev = devSelection(d);
  const spec = dev.chosen.weather;
  console.log(`Storage model (frozen by the storage-study development selection): K=${spec.harmonics}, ${spec.window}, ${spec.weather}`);
  const bars = await loadPrices(R.symbol, R.priceStart, R.priceEnd);
  console.log(`Prices ${R.symbol}: ${bars.length} sessions ${bars[0].date}…${bars.at(-1)!.date}`);

  const primary = buildRows(d, bars, spec, R.primaryModels);
  if (process.argv.includes('--phase=coverage')) {
    const rows = primary.rows.H1_REV1D;
    console.log(`Coverage only (no scoring): ${rows.length} origins ${rows[0]?.origin}…${rows.at(-1)?.origin}; first OOS origin after ${R.minTrain} training weeks: ${rows[R.minTrain]?.origin}; OOS n ≈ ${Math.max(0, rows.length - R.minTrain)}; dropped ${JSON.stringify(primary.dropped)}`);
    return;
  }
  const family: FamilyRow[] = FEATURES.map((f) => {
    const rows = primary.rows[f.key];
    return { key: f.key, label: f.label, kind: f.kind, nRows: rows.length, metrics: score(rows), qCw: null, qDm: null, inSample: inSample(rows) };
  });
  const qCw = benjaminiHochberg(family.map((r) => r.metrics?.cwWxVsMkt?.p ?? null));
  const qDm = benjaminiHochberg(family.map((r) => r.metrics?.dmWxVsRw?.p ?? null));
  family.forEach((r, i) => { r.qCw = qCw[i]; r.qDm = qDm[i]; });
  for (const r of family) console.log(`${r.key}: rows ${r.nRows}, OOS ${r.metrics?.n}, R2os ${fmt((r.metrics?.oosR2Wx ?? NaN) * 100)}%, vs MKT ${fmt((r.metrics?.oosR2WxVsMkt ?? NaN) * 100)}%, CW p ${fmtP(r.metrics?.cwWxVsMkt?.p)} q ${fmtP(r.qCw)}, DM p ${fmtP(r.metrics?.dmWxVsRw?.p)} q ${fmtP(r.qDm)}`);

  // Pre-declared robustness for rows with CW q < 0.10: λ grid, IFS+GFS mean (shorter window), halves.
  const robust = new Map<FeatureKey, StudyRow[]>();
  for (const r of family.filter((x) => x.qCw !== null && x.qCw < 0.1)) {
    const rows = primary.rows[r.key];
    r.robustness = [];
    const add = (variant: string, m: SkillMetrics | null) => { if (m) r.robustness!.push({ variant, n: m.n, oosR2Wx: m.oosR2Wx, oosR2WxVsMkt: m.oosR2WxVsMkt, cwP: m.cwWxVsMkt?.p ?? null, dmVsRwP: m.dmWxVsRw?.p ?? null }); };
    for (const l of [0.03, 0.3, 1]) add(`ridge λ = ${l} × n`, score(rows, l));
    if (!robust.has(r.key)) robust.set(r.key, buildRows(d, bars, spec, R.robustnessModels).rows[r.key]);
    add('IFS + GFS mean (from Feb 2024)', score(robust.get(r.key)!));
    const preds = walkForward(rows, { minTrain: R.minTrain, lambdaPerObs: R.lambdaPerObs });
    const mid = preds[Math.floor(preds.length / 2)]?.origin;
    if (mid) {
      add('first half of OOS window', evaluateSkill(preds.filter((p) => p.origin < mid), 1, { resamples: 200, seed: R.bootstrap.seed }));
      add('second half of OOS window', evaluateSkill(preds.filter((p) => p.origin >= mid), 1, { resamples: 200, seed: R.bootstrap.seed }));
    }
  }

  // Contemporaneous diagnostic (not a forecast; excluded from the family).
  const dg = primary.diag;
  const sdS = sdSample(dg.map((x) => x.holdSurprise));
  const regD = olsHac(dg.map((x) => [x.holdSurprise / sdS]), dg.map((x) => x.y), neweyWestLag(dg.length, 1));
  const contemporaneous = { n: dg.length, pctReturnPerSd: regD.coef[1] * 100, t: regD.t[1], p: regD.p[1], r2: regD.r2, first: dg[0]?.origin, last: dg.at(-1)?.origin };
  console.log(`Contemporaneous: return vs holding-week weather surprise ${fmt(contemporaneous.pctReturnPerSd)}% per SD (HAC t ${fmt(contemporaneous.t)}, n ${contemporaneous.n})`);

  const json = {
    study: R.study,
    generatedAt: new Date().toISOString(),
    preSpecification: 'docs/results/PRICE_STUDY_REVISIONS.md (pre-specification section, committed before scoring)',
    config: R,
    storageModel: spec,
    provenance: {
      prices: 'https://query1.finance.yahoo.com/v8/finance/chart/NG%3DF?period1={unix}&period2={unix}&interval=1d (unofficial endpoint; same cached series as public/research/price-skill.json)',
      weather: 'See public/research/storage-skill.json provenance (CPC truth, Open-Meteo Previous Runs + ERA5).',
      inputsSha256: createHash('sha256').update(JSON.stringify({ R, rows: primary.rows })).digest('hex'),
      openMeteoWeightFetchedThisRun: Math.round(usage.openMeteoFetched),
      dropped: primary.dropped,
    },
    leadLimitation: 'The Previous Runs API exposes previous_day1…previous_day7 only. A week-on-week revision of a fixed target window (issue t vs t − 7) needs leads 8–14 and is impossible; H1/H2 are the longest revisions the archive supports (1 day, and lead k+1 vs lead 7 for days 0…+5).',
    models: {
      rw: 'Zero-return random walk (no-change price forecast).',
      hm: 'Expanding historical mean of realised training returns.',
      mkt: 'Ridge on 1-week return, 4-week return and 12-week realised volatility.',
      wx: 'Ridge on market features + one family feature (nests mkt).',
    },
    family,
    contemporaneousDiagnostic: contemporaneous,
  };
  await mkdir(path.join(ROOT, 'public', 'research'), { recursive: true });
  await writeFile(path.join(ROOT, 'public', 'research', 'price-revisions.json'), JSON.stringify(json, null, 1));
  const mdPath = path.join(ROOT, 'docs', 'results', 'PRICE_STUDY_REVISIONS.md');
  const head = (await readFile(mdPath, 'utf8')).split(REVISIONS_MARKER)[0];
  await writeFile(mdPath, `${head}${REVISIONS_MARKER}\n\n${render(json)}`);
  console.log('Wrote public/research/price-revisions.json and docs/results/PRICE_STUDY_REVISIONS.md');
}

function render(json: any): string {
  const fam: FamilyRow[] = json.family;
  const sig = fam.filter((r) => r.qCw !== null && r.qCw < 0.1);
  const c = json.contemporaneousDiagnostic;
  return `## Results

*Generated ${json.generatedAt} by \`npx tsx research/price-revisions.ts\`. Machine-readable: \`public/research/price-revisions.json\`. Inputs SHA-256 \`${json.provenance.inputsSha256.slice(0, 16)}…\`. Origins dropped: ${json.provenance.dropped.notFriday} non-Friday closes, ${json.provenance.dropped.missingInputs} with missing inputs.*

| Test | Kind | OOS n | OOS window | R²os wx | 95% CI | R²os mkt | R²os wx vs mkt | RMSE wx/RW | CW p (wx>mkt) | BH q | DM p (wx<RW) | BH q | In-sample % ret per SD (HAC t) |
|---|---|---:|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
${fam.map((r) => {
    const m = r.metrics;
    if (!m) return `| ${r.label} | ${r.kind} | 0 | — | — | — | — | — | — | — | — | — | — | — |`;
    return `| ${r.label} | ${r.kind} | ${m.n} | ${m.oosStart}…${m.oosEnd} | ${fmt(m.oosR2Wx * 100)}% | [${fmt(m.oosR2WxCi95.lo * 100, 1)}, ${fmt(m.oosR2WxCi95.hi * 100, 1)}]% | ${fmt(m.oosR2Mkt * 100)}% | ${fmt(m.oosR2WxVsMkt * 100)}% | ${fmt(m.rmseRatioWxVsRw, 3)} | ${fmtP(m.cwWxVsMkt?.p)} | ${fmtP(r.qCw)} | ${fmtP(m.dmWxVsRw?.p)} | ${fmtP(r.qDm)} | ${fmt(r.inSample?.coefPctPerSd)} (${fmt(r.inSample?.t, 1)}) |`;
  }).join('\n')}

${sig.length ? `### Robustness (pre-declared, rows with CW q < 0.10)\n\n| Row | Variant | n | R²os wx vs HM | R²os wx vs MKT | CW p | DM p vs RW |\n|---|---|---:|---:|---:|---:|---:|\n${sig.flatMap((r) => (r.robustness ?? []).map((v) => `| ${r.key} | ${v.variant} | ${v.n} | ${fmt(v.oosR2Wx * 100)}% | ${fmt(v.oosR2WxVsMkt * 100)}% | ${fmtP(v.cwP)} | ${fmtP(v.dmVsRwP)} |`)).join('\n')}` : '_No family member reached Clark–West q < 0.10, so no robustness grid was run._'}

### Contemporaneous diagnostic (not a forecast)

Weekly return regressed on the weather surprise that arrives during the holding week itself (realised minus origin-forecast HDD+CDD for the storage week starting at the origin), full sample with Newey–West HAC: ${fmt(c.pctReturnPerSd)}% return per SD (HAC t ${fmt(c.t)}, p ${fmtP(c.p)}, R² ${fmt(c.r2, 3)}, n ${c.n}, ${c.first}…${c.last}). This uses information unavailable at the origin and measures whether weather news is priced when it arrives.

### Reading

- ${sig.length} of ${fam.length} family members show weather information adding to the market-only model at Benjamini–Hochberg q < 0.10 (Clark–West); ${fam.filter((r) => r.qDm !== null && r.qDm < 0.1).length} beat the no-change forecast at q < 0.10 (Diebold–Mariano).
${(() => {
    const best = [...fam].filter((r) => r.metrics?.cwWxVsMkt).sort((a, b) => a.metrics!.cwWxVsMkt!.p - b.metrics!.cwWxVsMkt!.p)[0];
    if (!best) return '';
    const m = best.metrics!;
    return `- Lowest raw Clark–West p: ${best.key} (p ${fmtP(m.cwWxVsMkt!.p)}, q ${fmtP(best.qCw)}; R²os ${fmt(m.oosR2Wx * 100)}%, 95% CI ${fmt(m.oosR2WxCi95.lo * 100, 1)} to ${fmt(m.oosR2WxCi95.hi * 100, 1)}%; DM vs no-change p ${fmtP(m.dmWxVsRw?.p)}). After multiple-testing control it is not evidence. Its in-sample sign (${fmt(best.inSample?.coefPctPerSd)}% per SD, HAC t ${fmt(best.inSample?.t, 1)}) is also the opposite of the naive fundamental reading for H5 (a larger-than-normal weather-implied build preceding *higher* returns), so treat it as noise or a reversal effect to re-test, not a mechanism.`;
  })()}
- Forecast *changes* (H1, H2), the weather news to be revealed by the next storage report (H3, H4) and the storage-scaled forecast level (H6) do not predict next-week returns out of sample. That is what an efficient market implies: the information is public at the Friday close and is priced.
- Contemporaneous diagnostic: the weather surprise arriving *during* the holding week has a positive but statistically weak association with that week's return (${fmt(c.pctReturnPerSd)}% per SD, HAC t ${fmt(c.t)}). Weekly returns are dominated by non-weather news, so even same-week weather news explains only ~${fmt(c.r2 * 100, 1)}% of their variance.
- H3 and H4 subtract the mapped nine-city forecast from CPC values for the same days, so the forecast's winter warm bias (see the degree-day verification in \`STORAGE_STUDY.md\`) gives them a seasonal component. The ridge intercept absorbs only a constant part. Both are null either way.
- Taken with \`STORAGE_STUDY.md\`: weather forecasts strongly predict the physical storage change, but that predictability does not transfer to next-week futures returns.
- ${json.leadLimitation}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'research', 'price-revisions.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
