import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Download, FileText, ShieldCheck } from 'lucide-react';
import { useResearchData, type SkillRow, type WeatherSkill } from '../engine/researchData';
import { BarList, FanChart, LineChart, PitHistogram, ReliabilityDiagram } from './charts/Charts';

type Var = 'tmean' | 'tmax' | 'precip';
const VAR_LABEL: Record<Var, string> = { tmean: 'Mean temperature', tmax: 'Max temperature', precip: 'Rainfall' };
const UNIT: Record<Var, string> = { tmean: '°C', tmax: '°C', precip: 'mm' };
const METHOD_STYLE: Record<string, { label: string; color: string; dashed?: boolean; emphasis?: boolean }> = {
  'astraeus-v2': { label: 'Astraeus v2', color: 'var(--viz-1)', emphasis: true },
  'raw-ensemble': { label: 'Raw 7-model ensemble', color: 'var(--viz-2)' },
  'astraeus-v1': { label: 'Astraeus v1', color: 'var(--viz-3)' },
  climatology: { label: 'Climatology', color: 'var(--viz-ref)', dashed: true },
};
const pct = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)}%`);
const pval = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3));

function row(w: WeatherSkill, v: string, lead: number, m: string): SkillRow | undefined {
  return w.summary.find((s) => s.variable === v && s.lead === lead && s.method === m);
}

export function ForecastSkill({ onReport }: { onReport?: () => void }) {
  const { weather: w } = useResearchData();
  const [v, setV] = useState<Var>('tmax');
  const [lead, setLead] = useState(3);
  const head = w?.headlineMethod ?? 'astraeus-v2';
  const sites = useMemo(() => (w ? w.bySite.filter((r) => r.variable === v && r.lead === lead) : []), [w, v, lead]);
  if (!w) return <div className="sk-loading" role="status">Loading the verification record…</div>;
  const leads = w.config.leads;
  const lineSeries = (metric: 'crps' | 'crpssVsClimatology') => Object.entries(METHOD_STYLE)
    .filter(([m]) => metric === 'crps' || m !== 'climatology')
    .map(([m, st]) => ({ id: m, ...st, points: leads.map((l) => ({ x: l, y: row(w, v, l, m)?.[metric] ?? null })) }));
  const h1 = row(w, v, 1, head);
  const hl = row(w, v, lead, head);
  const raw = row(w, v, lead, 'raw-ensemble');
  const sig = (versus: string) => w.significance.find((s) => s.variable === v && s.lead === lead && s.method === head && s.versus === versus);
  const event = v === 'precip' ? `rain ≥ ${w.config.precipEventMm} mm` : `above the local ${Math.round(w.config.temperatureEventPercentile * 100)}th climatological percentile`;
  const example = w.examples?.find((e) => e.variable === v) ?? w.examples?.[0];
  const siteName = (id: string) => w.sites.find((s) => s.id === id)?.name ?? id;
  const leaderboard = w.singleModels.filter((m) => m.variable === v && m.lead === lead).sort((a, b) => a.mae - b.mae);

  return <div className="sk">
    <header className="sk-hero">
      <span className="af-eyebrow">FORECAST SKILL · HELD-OUT VERIFICATION</span>
      <h1>How accurate is Astraeus?</h1>
      <p>Astraeus v2 was designed on development-period test days (October 2025 → {w.config.devEnd}), frozen, and then scored <strong>once</strong> on {w.periodLabel.includes('confirmation') ? 'the later confirmation period (April → November 2026)' : w.periodLabel} across {w.sites.length} commodity regions. Truth is ERA5 reanalysis. Scores are the continuous ranked probability score (CRPS), a strictly proper score for whole forecast distributions (Gneiting & Raftery, 2007).</p>
      <ul className="sk-chips"><li>{w.sites.length} regions</li><li>{w.models.length} global models</li><li>{w.summary.filter((s) => s.method === head).reduce((a, s) => a + s.cases, 0).toLocaleString()} scored forecasts</li><li>Leads {leads.join(' · ')} days</li><li>Refit every {w.config.refitEveryDays} days</li><li>ERA5 lag {w.config.era5LagDays} days respected</li></ul>
    </header>

    <div className="sk-controls">
      <div role="tablist" aria-label="Variable">{(['tmax', 'tmean', 'precip'] as Var[]).map((x) => <button key={x} role="tab" aria-selected={v === x} onClick={() => setV(x)}>{VAR_LABEL[x]}</button>)}</div>
      <label>Lead for detail charts <select value={lead} onChange={(e) => setLead(Number(e.target.value))}>{leads.map((l) => <option key={l} value={l}>Day {l}</option>)}</select></label>
    </div>

    <section className="sk-kpis" aria-label="Headline skill">
      <div><span>CRPS skill vs raw models · day 1</span><strong>{pct(h1?.crpssVsRaw)}</strong><small>95% CI {pct(h1?.crpssVsRawCI[0])} to {pct(h1?.crpssVsRawCI[1])}</small></div>
      <div><span>CRPS skill vs raw models · day {lead}</span><strong>{pct(hl?.crpssVsRaw)}</strong><small>Diebold–Mariano p {sig('raw-ensemble') ? pval(sig('raw-ensemble')!.pValue) : '—'}</small></div>
      <div><span>Skill vs climatology · day {lead}</span><strong>{pct(hl?.crpssVsClimatology)}</strong><small>raw ensemble {pct(raw?.crpssVsClimatology)}</small></div>
      <div><span>80% interval coverage · day {lead}</span><strong>{hl ? `${Math.round(hl.coverage80 * 100)}%` : '—'}</strong><small>target 80% · raw ensemble {raw ? `${Math.round(raw.coverage80 * 100)}%` : '—'}</small></div>
    </section>

    <div className="sk-grid two">
      <article className="sk-card"><LineChart caption={`${VAR_LABEL[v]}: CRPS by lead (${UNIT[v]}, lower is better)`} series={lineSeries('crps')} xFormat={(x) => `Day ${x}`} yFormat={(y) => y.toFixed(2)} xLabel="Lead" yLabel={`CRPS (${UNIT[v]})`} /></article>
      <article className="sk-card"><LineChart caption={`${VAR_LABEL[v]}: skill relative to climatology (CRPSS, higher is better)`} series={lineSeries('crpssVsClimatology')} xFormat={(x) => `Day ${x}`} yFormat={(y) => `${Math.round(y * 100)}%`} xLabel="Lead" yLabel="CRPSS" zeroLine /></article>
    </div>

    <div className="sk-grid three">
      <article className="sk-card">
        <ReliabilityDiagram caption={`Reliability · P(${event}) · day ${lead}`} series={[{ label: 'Astraeus v2', color: 'var(--viz-1)', bins: hl?.reliability ?? [] }, { label: 'Raw ensemble', color: 'var(--viz-2)', bins: raw?.reliability ?? [] }]} />
        <p className="sk-note">Brier skill vs climatology: Astraeus {pct(hl?.brierSkillVsClimatology)} · raw {pct(raw?.brierSkillVsClimatology)}. Event base rate {hl ? `${Math.round(hl.eventBaseRate * 100)}%` : '—'}.</p>
      </article>
      <article className="sk-card sk-pits">
        <p className="sk-card-title">Calibration · PIT histograms, day {lead}</p>
        <PitHistogram label="Astraeus v2" color="var(--viz-1)" bins={hl?.pit ?? []} />
        <PitHistogram label="Raw ensemble" color="var(--viz-2)" bins={raw?.pit ?? []} />
        <p className="sk-note">Flat at the dashed 10% line = calibrated. A U-shape means the forecast is too confident: the truth often falls outside the forecast range.</p>
      </article>
      <article className="sk-card">
        <BarList caption={`Single-model error · day ${lead} (MAE, ${UNIT[v]})`} rows={leaderboard.map((m, i) => ({ label: m.name, value: m.mae, note: m.kind === 'machine learning' ? 'machine learning' : undefined, highlight: i === 0 }))} format={(x) => x.toFixed(2)} />
        <p className="sk-note">ECMWF AIFS is trained on ERA5, so verification against ERA5 is expected to favour it.</p>
      </article>
    </div>

    {example && example.days.length > 0 && <article className="sk-card sk-wide">
      <FanChart days={example.days.slice(-60)} unit={UNIT[example.variable as Var] ?? ''} caption={`Example · ${siteName(example.site)} · ${VAR_LABEL[example.variable as Var] ?? example.variable}, day-${example.lead} forecasts in the held-out period`} />
    </article>}

    <article className="sk-card sk-wide">
      <p className="sk-card-title">{VAR_LABEL[v]} · every method, every lead</p>
      <div className="sk-table-wrap"><table className="sk-table">
        <thead><tr><th>Lead</th><th>Method</th><th>CRPS</th><th>vs raw (95% CI)</th><th>vs climatology</th><th>MAE</th><th>Bias</th><th>80% coverage</th><th>BSS</th></tr></thead>
        <tbody>{leads.flatMap((l) => w.summary.filter((s) => s.variable === v && s.lead === l).map((s) => <tr key={`${l}-${s.method}`} className={s.method === head ? 'head' : ''}>
          <td>{l}</td><td>{METHOD_STYLE[s.method]?.label ?? (s.method === 'emos' ? 'EMOS (classic, 40 d)' : s.label)}</td><td>{s.crps.toFixed(3)}</td>
          <td>{s.method === 'raw-ensemble' ? '—' : `${pct(s.crpssVsRaw)} (${pct(s.crpssVsRawCI[0])}, ${pct(s.crpssVsRawCI[1])})`}</td>
          <td>{pct(s.crpssVsClimatology)}</td><td>{s.mae.toFixed(2)}</td><td>{s.bias > 0 ? '+' : ''}{s.bias.toFixed(2)}</td><td>{Math.round(s.coverage80 * 100)}%</td><td>{pct(s.brierSkillVsClimatology)}</td>
        </tr>))}</tbody>
      </table></div>
    </article>

    <article className="sk-card sk-wide">
      <p className="sk-card-title">By region · day {lead} · CRPS skill of Astraeus v2 vs the raw ensemble</p>
      <ol className="sk-sites">{[...sites].sort((a, b) => (1 - Number(b[head]) / Number(b['raw-ensemble'])) - (1 - Number(a[head]) / Number(a['raw-ensemble']))).map((r) => {
        const s = 1 - Number(r[head]) / Number(r['raw-ensemble']);
        return <li key={String(r.site)} title={`${siteName(String(r.site))}: CRPS ${Number(r[head]).toFixed(3)} vs raw ${Number(r['raw-ensemble']).toFixed(3)} over ${r.days} days`}>
          <span>{siteName(String(r.site))}</span>
          <span className="sk-site-bar"><i className={s >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.min(100, Math.abs(s) * 250)}%` }} /></span>
          <b>{pct(s)}</b>
        </li>;
      })}</ol>
    </article>

    <section className="sk-protocol">
      <div>
        <h2>Protocol</h2>
        <ul>
          <li><strong>Forecasts:</strong> {String(w.provenance.forecasts)}</li>
          <li><strong>Truth:</strong> {String(w.provenance.truth)}</li>
          <li><strong>Climatology:</strong> {String(w.provenance.climatology)}</li>
          <li><strong>No look-ahead:</strong> at issue time only ERA5 days published {w.config.era5LagDays} days earlier are used for fitting; models are refitted every {w.config.refitEveryDays} days on trailing windows.</li>
          <li><strong>Significance:</strong> Diebold–Mariano with Newey–West variance and Harvey–Leybourne–Newbold correction on the daily cross-region mean loss; intervals from a 7-day moving-block bootstrap.</li>
        </ul>
      </div>
      <div>
        <h2>Caveats</h2>
        <ul>{w.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="sk-actions">
          <a className="af-button af-outline" href="/research/weather-skill.json" download><Download size={14} /> Download results (JSON)</a>
          {onReport && <button className="af-button af-primary" onClick={onReport}><FileText size={14} /> Technical report <ArrowUpRight size={13} /></button>}
        </div>
        <p className="sk-note"><ShieldCheck size={12} /> Reproduce: <code>{String(w.provenance.reproducibility)}</code></p>
      </div>
    </section>
  </div>;
}
