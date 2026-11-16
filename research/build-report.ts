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
const doc = buildReport(weather, read<PriceSkill>('public/research/price-skill.json'), read<WeatherSkill>('public/research/archive/weather-dev-period.json'), read<WeatherSkill>('public/research/archive/weather-run1-devonly.json'));
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
