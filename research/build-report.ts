/**
 * Renders the Astraeus technical report to Markdown from the same builder and result files the app
 * uses (src/engine/technicalReport.ts), so the document and the website can never disagree.
 *   npx tsx research/build-report.ts   →   docs/TECHNICAL_REPORT.md
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { buildReport, citeLabel } from '../src/engine/technicalReport';
import { RESEARCH_LIBRARY } from '../src/engine/researchLibrary';
import type { PriceSkill, WeatherSkill } from '../src/engine/researchData';
import type { AreaArchive, ReportExtras, StationArchive, TrackSummary, V3Tests } from '../src/engine/technicalReport';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = <T>(p: string): T | null => (existsSync(path.join(ROOT, p)) ? JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) : null);
const weather = read<WeatherSkill>('public/research/weather-skill.json');
// Slim price summary for the website (drops per-week loss paths; the full file stays the source of record).
const fullPrice = read<any>('public/research/price-skill.json');
if (fullPrice) {
  const { rows, ...rest } = fullPrice;
  writeFileSync(path.join(ROOT, 'public', 'research', 'price-summary.json'), JSON.stringify({ ...rest, source: '/research/price-skill.json', rows: rows.map(({ cumulativeSseGain, predictions, paths, ...r }: any) => r) }));
}
if (!weather) throw new Error('public/research/weather-skill.json missing — run the benchmark first.');

// Slim extras for the report page (the archive files they come from stay the source of record).
const v3devFull = read<WeatherSkill>('public/research/archive/weather-v3-dev.json');
const stationsFull = read<any>('public/research/archive/weather-stations-confirm.json');
const areasFull = read<any>('public/research/archive/weather-areas-confirm.json');
const extras: ReportExtras = {
  v3dev: v3devFull ? ({ ...v3devFull, summary: v3devFull.summary.filter((x) => x.variable !== 'precip'), significance: [], bySite: [], singleModels: [], examples: undefined } as unknown as WeatherSkill) : null,
  v3tests: read<V3Tests>('public/research/archive/weather-v3-vs-v2-dm.json'),
  stations: stationsFull ? ({
    stations: {
      sites: stationsFull.stations.sites.map((x: any) => ({ site: x.site, name: x.name, tmax: x.tmax && { source: x.tmax.source, name: x.tmax.name, distanceKm: x.tmax.distanceKm }, precip: x.precip && { source: x.precip.source, name: x.precip.name, distanceKm: x.precip.distanceKm } })),
      excluded: stationsFull.stations.excluded,
    },
    chain: stationsFull.chain,
    singleModelRanking: stationsFull.singleModelRanking,
    caveats: stationsFull.caveats,
  } as StationArchive) : null,
  areas: areasFull ? ({
    areas: { areas: areasFull.areas.areas.map((x: any) => ({ id: x.id, name: x.name, commodity: x.commodity, measure: x.measure, year: x.year, sources: x.sources.map((y: any) => ({ title: y.title, url: y.url })) })) },
    comparisons: areasFull.comparisons.filter((x: any) => x.scope === 'pooled'),
    caveats: areasFull.caveats,
  } as AreaArchive) : null,
  storage: (() => {
    const st = read<any>('public/research/storage-skill.json');
    const rv = read<any>('public/research/price-revisions.json');
    if (!st) return null;
    return {
      generatedAt: st.generatedAt,
      comparisons: st.comparisons.map((c: any) => ({ id: c.id, window: c.window, ref: c.ref, model: c.model, confirmatory: c.confirmatory, q: c.q ?? null, refLabel: c.refLabel, modelLabel: c.modelLabel, n: c.result.n, rmseRef: c.result.rmseRef, rmseModel: c.result.rmseModel, skillMse: c.result.skillMse, ci: [c.result.skillMseCi95.lo, c.result.skillMseCi95.hi], p: c.result.dmSquared.p })),
      bySeason: st.bySeason,
      sensitivity: { bcfPerHdd: st.sanity.fullYearLinear.bcfPerHdd, tHdd: st.sanity.fullYearLinear.tHdd, bcfPerCdd: st.sanity.fullYearLinear.bcfPerCdd },
      windows: { multi: st.comparisons.find((c: any) => c.window === 'multi')?.result.n, gfs: st.comparisons.find((c: any) => c.window === 'gfs')?.result.n },
      missingGfsWeeks: st.missingGfsWeeks,
      caveats: st.caveats,
      revisions: rv ? { n: rv.family[0]?.metrics.n, start: rv.family[0]?.metrics.oosStart, end: rv.family[0]?.metrics.oosEnd, family: rv.family.map((f: any) => ({ key: f.key, label: f.label, q: f.qCw ?? f.q ?? null, cwP: f.metrics.cwWxVsMkt?.p, dmP: f.metrics.dmWxVsRw?.p, qDm: f.qDm ?? null })) } : null,
    };
  })(),
};
writeFileSync(path.join(ROOT, 'public', 'research', 'report-extras.json'), JSON.stringify(extras));
if (extras.storage) writeFileSync(path.join(ROOT, 'public', 'research', 'storage-summary.json'), JSON.stringify(extras.storage)); // ~12 KB, for the landing page
const track = read<TrackSummary>('data/track-record/summary.json');
const doc = buildReport(weather, read<PriceSkill>('public/research/price-skill.json'), read<WeatherSkill>('public/research/archive/weather-dev-period.json'), read<WeatherSkill>('public/research/archive/weather-run1-devonly.json'), { ...extras, track });
const byId = new Map(RESEARCH_LIBRARY.map((r) => [r.id, r]));
const cite = (t: string) => t.replace(/\[(@[a-z0-9-]+(?:;\s*@[a-z0-9-]+)*)\]/g, (_m, ids: string) => `(${ids.split(/;\s*/).map((i) => { const r = byId.get(i.slice(1)); return r ? citeLabel(r) : i; }).join('; ')})`);
const esc = (t: string) => t.replace(/\|/g, '\\|');

const out: string[] = [];
out.push(`# ${doc.title}`, '', `*${doc.subtitle} · Astraeus Research*`, '', ...doc.meta.map((m) => `- ${m}`), '');
out.push('## Abstract', '', cite(doc.abstract), '', `**Keywords:** ${doc.keywords.join(' · ')}`, '');
let fig = 0;
for (const s of doc.sections) {
  out.push(`## ${s.title}`, '');
  for (const b of s.blocks) {
    if (b.type === 'p') out.push(cite(b.text), '');
    else if (b.type === 'list') out.push(...b.items.map((i) => `- ${cite(i)}`), '');
    else if (b.type === 'eq') out.push('```', `${b.text}${b.label ? `    ${b.label}` : ''}`, '```', '');
    else if (b.type === 'table') out.push(`**${b.caption}**`, '', `| ${b.head.map(esc).join(' | ')} |`, `|${b.head.map(() => '---').join('|')}|`, ...b.rows.map((r) => `| ${r.map(esc).join(' | ')} |`), '', ...(b.note ? [`*${b.note}*`, ''] : []));
    else { fig++; out.push(`> ${b.caption} — interactive version in the app (\`#report\`).`, ''); }
  }
}
const refs = doc.cited.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => a!.authors.split(/,\s*/)[0].split(/\s+/).pop()!.localeCompare(b!.authors.split(/,\s*/)[0].split(/\s+/).pop()!) || a!.year - b!.year);
out.push('## References', '', ...refs.map((r) => `- ${r!.authors} (${r!.year}). ${r!.title}. *${r!.venue}*. ${r!.doi ? `https://doi.org/${r!.doi}` : r!.url}`), '');
writeFileSync(path.join(ROOT, 'docs', 'TECHNICAL_REPORT.md'), out.join('\n'));
console.log(`wrote docs/TECHNICAL_REPORT.md · ${doc.sections.length} sections · ${refs.length} references · ${fig} figures referenced`);
