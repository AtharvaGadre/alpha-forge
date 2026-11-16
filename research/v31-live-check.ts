/**
 * The live-region check behind Astraeus v3.1 (docs/results/WEATHER_V31.md, Sections 1 and 9), reproducible from the
 * archived training rows in research/data/v31-live-rows.json.
 *
 * For each region, temperature variable and training lead it runs the live outlook's rolling local check
 * (rollingHeldOut in src/engine/calibratedOutlook.ts: newer half of the window, weekly refits on rows verified at least
 * lead + 6 days earlier) for v3 and v3.1, and reports CRPS skill against the raw multi-model ensemble, the mean error of
 * the raw ensemble mean and of each method's median, and v3's mean fitted slope b.
 *
 * These are the data that motivated v3.1. They illustrate the change; they do not test it.
 *
 *   npx tsx research/v31-live-check.ts   → public/research/archive/weather-v31-live-check.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { rollingHeldOut } from '../src/engine/calibratedOutlook';
import { crpsEnsemble, crpsOf, fitAstraeusV3, fitAstraeusV31, predictAstraeusV3, quantileOf, type AstraeusV3Model } from '../src/engine/weatherPostprocessing';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const input = JSON.parse(readFileSync(path.join(ROOT, 'research', 'data', 'v31-live-rows.json'), 'utf8'));
const METHODS = { 'v3': fitAstraeusV3, 'v3.1': fitAstraeusV31 } as const;
type MethodId = keyof typeof METHODS;
const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

interface Cell { variable: string; lead: number; nTest: number; testStart: string; testEnd: string; maxTrain: number; minTrain: number; crpsRaw: number; crpsCalibrated: number; skill: number; meRaw: number; meMethod: number; meanSlope?: number }
const regions: Record<string, { verifyDates: string[]; v3: Cell[]; 'v3.1': Cell[] }> = {};

for (const [key, reg] of Object.entries<any>(input.regions)) {
  regions[key] = { verifyDates: reg.verifyDates, v3: [], 'v3.1': [] };
  for (const variable of ['tmean', 'tmax']) {
    for (const [leadStr, raw] of Object.entries<any[]>(reg[variable])) {
      const lead = Number(leadStr);
      const rows = raw.map((r) => ({ date: r[0] as string, y: r[1] as number, f: r.slice(2) as number[] }));
      if (rows.length < 20) continue;
      for (const m of Object.keys(METHODS) as MethodId[]) {
        const cases = rollingHeldOut<AstraeusV3Model>(rows, lead, (t) => METHODS[m](t, 'temperature'), predictAstraeusV3);
        if (!cases.length) continue;
        const crpsRaw = avg(cases.map((c) => crpsEnsemble(c.f, c.y)));
        const crpsCal = avg(cases.map((c) => crpsOf(c.fc, c.y)));
        const slopes = [...new Set(cases.map((c) => c.model))].map((x) => (x.kind === 'temperature' ? x.ngr.params.b : NaN));
        regions[key][m].push({
          variable, lead, nTest: cases.length, testStart: cases[0].date, testEnd: cases[cases.length - 1].date,
          maxTrain: Math.max(...cases.map((c) => c.nTrain)), minTrain: Math.min(...cases.map((c) => c.nTrain)),
          crpsRaw: r4(crpsRaw), crpsCalibrated: r4(crpsCal), skill: r4(1 - crpsCal / crpsRaw),
          meRaw: r4(avg(cases.map((c) => avg(c.f) - c.y))), meMethod: r4(avg(cases.map((c) => quantileOf(c.fc, 0.5) - c.y))),
          ...(m === 'v3' ? { meanSlope: r4(avg(slopes)) } : {}),
        });
      }
    }
  }
}

const all = (m: MethodId) => Object.values(regions).flatMap((r) => r[m]);
const pooledSkill = (cells: Cell[]) => r4(1 - cells.reduce((a, c) => a + c.crpsCalibrated * c.nTest, 0) / cells.reduce((a, c) => a + c.crpsRaw * c.nTest, 0));
const out = {
  description: 'Rolling local check of the live outlook (rollingHeldOut: weekly refits on rows verified at least lead + 6 days before each test week) on the newer half of each 90-day window, temperature only. skill = 1 − CRPS(method)/CRPS(raw multi-model ensemble); meRaw / meMethod = mean error (°C) of the raw ensemble mean / the method’s median; meanSlope = v3’s fitted regression slope b averaged over the weekly refits. These are the data that motivated v3.1 (docs/results/WEATHER_V31.md); they illustrate the change and do not test it.',
  generatedBy: 'npx tsx research/v31-live-check.ts (input research/data/v31-live-rows.json)',
  issued: input.issued,
  testDays: `${all('v3').reduce((a, c) => (c.testStart < a ? c.testStart : a), '9999')} to ${all('v3').reduce((a, c) => (c.testEnd > a ? c.testEnd : a), '')}`,
  regions,
  pooled: Object.fromEntries((Object.keys(METHODS) as MethodId[]).map((m) => [m, { tmean: pooledSkill(all(m).filter((c) => c.variable === 'tmean')), tmax: pooledSkill(all(m).filter((c) => c.variable === 'tmax')) }])),
  byRegion: Object.fromEntries(Object.entries(regions).map(([k, r]) => [k, { v3: pooledSkill(r.v3), 'v3.1': pooledSkill(r['v3.1']) }])),
  negativeCells: Object.fromEntries((Object.keys(METHODS) as MethodId[]).map((m) => [m, all(m).filter((c) => c.skill < 0).length])),
  cells: all('v3').length,
};
writeFileSync(path.join(ROOT, 'public', 'research', 'archive', 'weather-v31-live-check.json'), JSON.stringify(out, null, 1));
console.log(`test days ${out.testDays}; negative cells v3 ${out.negativeCells.v3} → v3.1 ${out.negativeCells['v3.1']} of ${out.cells}`);
console.log('pooled', JSON.stringify(out.pooled));
for (const [k, r] of Object.entries(out.byRegion)) console.log(k.padEnd(14), `v3 ${(100 * r.v3).toFixed(1)}%`, `v3.1 ${(100 * r['v3.1']).toFixed(1)}%`);
