import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Download, Gauge, Printer } from 'lucide-react';
import { loadJson, useResearchData, type WeatherSkill } from '../engine/researchData';
import { buildReport, citeLabel, type ReportBlock } from '../engine/technicalReport';
import { BarList, LineChart, ReliabilityDiagram } from './charts/Charts';
import { PriceEvidence } from './landing/Landing';
import type { ResearchReference } from '../engine/researchLibrary';

const surname = (r: ResearchReference) => (r.authors.split(/,\s*/)[0] ?? '').trim().split(/\s+/).pop() ?? '';

export function TechnicalReport({ onSkill }: { onSkill?: () => void }) {
  const { weather, price } = useResearchData();
  const [dev, setDev] = useState<WeatherSkill | null>(null);
  const [run1, setRun1] = useState<WeatherSkill | null>(null);
  const [lib, setLib] = useState<ResearchReference[]>([]);
  useEffect(() => {
    let live = true;
    void loadJson<WeatherSkill>('/research/archive/weather-dev-period.json').then((d) => live && setDev(d));
    void loadJson<WeatherSkill>('/research/archive/weather-run1-devonly.json').then((d) => live && setRun1(d));
    void import('../engine/researchLibrary').then((m) => live && setLib(m.RESEARCH_LIBRARY));
    return () => { live = false; };
  }, []);
  const doc = useMemo(() => (weather ? buildReport(weather, price, dev, run1) : null), [weather, price, dev, run1]);
  const byId = useMemo(() => new Map(lib.map((r) => [r.id, r])), [lib]);
  if (!doc || !weather) return <div className="sk-loading" role="status">Assembling the report from the published results…</div>;
  const refs = doc.cited.map((id) => byId.get(id)).filter((r): r is ResearchReference => !!r).sort((a, b) => surname(a).localeCompare(surname(b)) || a.year - b.year);

  const inline = (text: string) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(/\[(@[a-z0-9-]+(?:;\s*@[a-z0-9-]+)*)\]/g)) {
      parts.push(text.slice(last, m.index));
      const ids = m[1].split(/;\s*/).map((x) => x.slice(1));
      parts.push(<span className="tr-cite" key={m.index}>({ids.map((id, i) => { const r = byId.get(id); return <React.Fragment key={id}>{i > 0 && '; '}<a href={`#ref-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ref-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>{r ? citeLabel(r) : id}</a></React.Fragment>; })})</span>);
      last = (m.index ?? 0) + m[0].length;
    }
    parts.push(text.slice(last));
    return parts;
  };

  const figure = (b: Extract<ReportBlock, { type: 'figure' }>) => {
    const w = weather;
    const v = b.variable ?? 'tmax';
    if (b.kind === 'skill-by-lead') {
      const styles: Array<[string, string, string, boolean?]> = [['astraeus-v2', 'Astraeus v2', 'var(--viz-1)'], ['raw-ensemble', 'Raw ensemble', 'var(--viz-2)'], ['raw-gauss', 'No-training Gaussian', 'var(--viz-3)'], ['climatology', 'Climatology', 'var(--viz-ref)', true]];
      return <LineChart caption={b.caption} series={styles.map(([id, label, color, dashed]) => ({ id, label, color, dashed, emphasis: id === 'astraeus-v2', points: w.config.leads.map((l) => ({ x: l, y: w.summary.find((s) => s.variable === v && s.lead === l && s.method === id)?.crps ?? null })) }))} xFormat={(x) => `Day ${x}`} yFormat={(y) => y.toFixed(2)} xLabel="Lead" yLabel="CRPS" />;
    }
    if (b.kind === 'reliability') {
      const r = (m: string) => w.summary.find((s) => s.variable === v && s.lead === (b.lead ?? 1) && s.method === m)?.reliability ?? [];
      return <ReliabilityDiagram caption={b.caption} series={[{ label: 'Astraeus v2', color: 'var(--viz-1)', bins: r('astraeus-v2') }, { label: 'Raw ensemble', color: 'var(--viz-2)', bins: r('raw-ensemble') }]} />;
    }
    if (b.kind === 'leaderboard') {
      const rows = w.singleModels.filter((m) => m.variable === v && m.lead === (b.lead ?? 3)).sort((a, c) => a.mae - c.mae);
      return <BarList caption={b.caption} rows={rows.map((m, i) => ({ label: m.name, value: m.mae, note: m.kind === 'machine learning' ? 'machine learning' : undefined, highlight: i === 0 }))} format={(x) => x.toFixed(2)} unit="°C" />;
    }
    if (b.kind === 'price-matrix') return <figure className="viz-figure"><figcaption>{b.caption}</figcaption><PriceEvidence p={price} /></figure>;
    return null;
  };

  return <article className="tr">
    <div className="tr-toolbar no-print">
      <span className="af-eyebrow">TECHNICAL REPORT</span>
      <div>
        {onSkill && <button className="af-button af-outline" onClick={onSkill}><Gauge size={14} /> Interactive skill dashboard</button>}
        <a className="af-button af-outline" href="/research/weather-skill.json" download><Download size={14} /> Data (JSON)</a>
        <button className="af-button af-primary" onClick={() => window.print()}><Printer size={14} /> Save as PDF</button>
      </div>
    </div>
    <header className="tr-head">
      <p className="tr-series">{doc.subtitle}</p>
      <h1>{doc.title}</h1>
      <p className="tr-byline">Astraeus Research</p>
      <ul className="tr-meta">{doc.meta.map((m) => <li key={m}>{m}</li>)}</ul>
    </header>
    <section className="tr-abstract"><h2>Abstract</h2><p>{inline(doc.abstract)}</p><p className="tr-keywords"><strong>Keywords:</strong> {doc.keywords.join(' · ')}</p></section>
    <nav className="tr-toc no-print" aria-label="Contents"><strong>Contents</strong><ol>{doc.sections.map((s) => <li key={s.id}><a href={`#tr-${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`tr-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}>{s.title}</a></li>)}<li><a href="#tr-refs" onClick={(e) => { e.preventDefault(); document.getElementById('tr-refs')?.scrollIntoView({ behavior: 'smooth' }); }}>References</a></li></ol></nav>
    {doc.sections.map((s) => <section key={s.id} id={`tr-${s.id}`} className="tr-section">
      <h2>{s.title}</h2>
      {s.blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i}>{inline(b.text)}</p>;
        if (b.type === 'list') return <ul key={i}>{b.items.map((it) => <li key={it}>{inline(it)}</li>)}</ul>;
        if (b.type === 'eq') return <div key={i} className="tr-eq"><code>{b.text}</code>{b.label && <span>{b.label}</span>}</div>;
        if (b.type === 'table') return <figure key={i} className="tr-table"><figcaption>{b.caption}</figcaption><div className="sk-table-wrap"><table className="sk-table"><thead><tr>{b.head.map((h, k) => <th key={k}>{h}</th>)}</tr></thead><tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((cell, k) => <td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>{b.note && <p className="tr-note">{b.note}</p>}</figure>;
        return <div key={i} className="tr-figure">{figure(b)}</div>;
      })}
    </section>)}
    <section id="tr-refs" className="tr-section tr-refs">
      <h2>References</h2>
      <ol>{refs.map((r) => <li key={r.id} id={`ref-${r.id}`}>
        <span>{r.authors} ({r.year}). {r.title}. <em>{r.venue}</em>.</span>
        {r.doi ? <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">doi:{r.doi} <ArrowUpRight size={11} /></a> : <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace(/^https?:\/\//, '').slice(0, 60)} <ArrowUpRight size={11} /></a>}
        {!r.verified && <small> (record verified; finding from secondary documentation)</small>}
      </li>)}</ol>
    </section>
  </article>;
}
