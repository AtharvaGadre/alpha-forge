import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Download, FileText, Fingerprint, ShieldCheck } from 'lucide-react';
import type { CellSummary } from '../engine/trackRecord';
import { useResearchData, type SkillRow, type WeatherSkill } from '../engine/researchData';
import { BarList, FanChart, LineChart, PitHistogram, ReliabilityDiagram } from './charts/Charts';

type Var = 'tmean' | 'tmax' | 'precip';
const VAR_LABEL: Record<Var, string> = { tmean: 'Mean temperature', tmax: 'Max temperature', precip: 'Rainfall' };
const UNIT: Record<Var, string> = { tmean: '°C', tmax: '°C', precip: 'mm' };
const METHOD_STYLE: Record<string, { label: string; color: string; dashed?: boolean; emphasis?: boolean }> = {
  'astraeus-v2': { label: 'Astraeus v2', color: 'var(--viz-1)', emphasis: true },
  'raw-ensemble': { label: 'Raw ensemble', color: 'var(--viz-2)' },
  'raw-gauss': { label: 'No-training Gaussian', color: 'var(--viz-3)' },
  climatology: { label: 'Climatology', color: 'var(--viz-ref)', dashed: true },
};
const TABLE_LABEL: Record<string, string> = { ...Object.fromEntries(Object.entries(METHOD_STYLE).map(([k, v]) => [k, v.label])), 'astraeus-v1': 'Astraeus v1', 'astraeus-v3': 'Astraeus v3', 'astraeus-v3.1': 'Astraeus v3.1 (live since 16 Nov)', emos: 'EMOS (classic, 40 d)' };
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
  const gauss = row(w, v, lead, 'raw-gauss');
  const useGauss = v !== 'precip' && h1?.crpssVsRawGauss != null;
  const refName = useGauss ? 'no-training Gaussian' : 'raw ensemble';
  const skillOf = (x?: SkillRow) => (useGauss ? x?.crpssVsRawGauss : x?.crpssVsRaw) ?? null;
  const ciOf = (x?: SkillRow) => (useGauss ? x?.crpssVsRawGaussCI : x?.crpssVsRawCI) ?? [null, null];
  const sig = (versus: string) => w.significance.find((s) => s.variable === v && s.lead === lead && s.method === head && s.versus === versus);
  const sigP = (versus: string) => { const x = sig(versus); return x ? pval(x.robustMaxP ?? x.pValue) : '—'; };
  const event = v === 'precip' ? `rain ≥ ${w.config.precipEventMm} mm` : `above the local ${Math.round(w.config.temperatureEventPercentile * 100)}th climatological percentile`;
  const example = w.examples?.find((e) => e.variable === v) ?? w.examples?.[0];
  const siteName = (id: string) => w.sites.find((s) => s.id === id)?.name ?? id;
  const leaderboard = w.singleModels.filter((m) => m.variable === v && m.lead === lead).sort((a, b) => a.mae - b.mae);

  return <div className="sk">
    <header className="sk-hero">
      <span className="af-eyebrow">FORECAST SKILL · HELD-OUT VERIFICATION</span>
      <h1>How accurate is Astraeus?</h1>
      <p>Astraeus v2 was designed on development-period test days (October 2025 → {w.config.devEnd}), frozen, and then scored on {w.periodLabel.includes('confirmation') ? 'the later confirmation period (April → November 2026)' : w.periodLabel} across {w.sites.length} commodity regions, against ERA5 reanalysis. Scores are the continuous ranked probability score (CRPS), a strictly proper score for whole forecast distributions (Gneiting & Raftery, 2007). Temperature is compared with a <strong>no-training Gaussian</strong> built from the same models — the fair reference, since scoring 5–7 raw members as a distribution carries a finite-ensemble penalty — and rain with the raw ensemble. An exploratory first run had also covered the confirmation days; a strictly prospective test starts with forecasts after {w.config.prospectiveStart ?? '16 November 2026'}.</p>
      <ul className="sk-chips"><li>{w.sites.length} regions</li><li>{w.models.length} global models</li><li>{w.summary.filter((s) => s.method === head).reduce((a, s) => a + s.cases, 0).toLocaleString()} scored forecasts</li><li>Leads {leads.join(' · ')} days</li><li>Refit every {w.config.refitEveryDays} days</li><li>ERA5 lag {w.config.era5LagDays} days respected</li></ul>
    </header>

    <div className="sk-controls">
      <div role="tablist" aria-label="Variable">{(['tmax', 'tmean', 'precip'] as Var[]).map((x) => <button key={x} role="tab" aria-selected={v === x} onClick={() => setV(x)}>{VAR_LABEL[x]}</button>)}</div>
      <label>Lead for detail charts <select value={lead} onChange={(e) => setLead(Number(e.target.value))}>{leads.map((l) => <option key={l} value={l}>Day {l}</option>)}</select></label>
    </div>

    <section className="sk-kpis" aria-label="Headline skill">
      <div><span>CRPS skill vs {refName} · day 1</span><strong>{pct(skillOf(h1))}</strong><small>95% CI {pct(ciOf(h1)[0])} to {pct(ciOf(h1)[1])}</small></div>
      <div><span>CRPS skill vs {refName} · day {lead}</span><strong>{pct(skillOf(hl))}</strong><small>Diebold–Mariano p {sigP(useGauss ? 'raw-gauss' : 'raw-ensemble')} (largest across bandwidths){useGauss ? ` · vs raw ensemble ${pct(hl?.crpssVsRaw)}` : ''}</small></div>
      <div><span>Skill vs climatology · day {lead}</span><strong>{pct(hl?.crpssVsClimatology)}</strong><small>raw ensemble {pct(raw?.crpssVsClimatology)}</small></div>
      <div><span>80% interval coverage · day {lead}</span><strong>{hl ? `${Math.round(hl.coverage80 * 100)}%` : '—'}</strong><small>calibrated = 80% · raw ensemble {raw ? `${Math.round(raw.coverage80 * 100)}%` : '—'}{gauss ? ` · Gaussian ${Math.round(gauss.coverage80 * 100)}%` : ''}</small></div>
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
        <p className="sk-note">Flat at the dashed 10% line = calibrated. A U-shape means too little spread (over-confident); a hump means too much. Coverage on this page is read from the PIT, so it means the same thing for every forecast type.</p>
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
        <thead><tr><th>Lead</th><th>Method</th><th>CRPS</th><th>vs no-training Gaussian (95% CI)</th><th>vs raw (95% CI)</th><th>vs climatology</th><th>MAE</th><th>Bias</th><th>80% coverage</th><th>BSS</th></tr></thead>
        <tbody>{leads.flatMap((l) => w.summary.filter((s) => s.variable === v && s.lead === l).map((s) => <tr key={`${l}-${s.method}`} className={s.method === head ? 'head' : ''}>
          <td>{l}</td><td>{TABLE_LABEL[s.method] ?? s.label}</td><td>{s.crps.toFixed(3)}{s.method === 'raw-ensemble' && s.crpsFair != null ? <small className="sk-fair"> fair {s.crpsFair.toFixed(3)}</small> : null}</td>
          <td>{s.method === 'raw-gauss' || s.crpssVsRawGauss == null ? '—' : `${pct(s.crpssVsRawGauss)} (${pct(s.crpssVsRawGaussCI?.[0])}, ${pct(s.crpssVsRawGaussCI?.[1])})`}</td>
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

    <LiveTrackRecord />

    <section className="sk-protocol">
      <div>
        <h2>Protocol</h2>
        <ul>
          <li><strong>Forecasts:</strong> {String(w.provenance.forecasts)}</li>
          <li><strong>Truth:</strong> {String(w.provenance.truth)}</li>
          <li><strong>Climatology:</strong> {String(w.provenance.climatology)}</li>
          <li><strong>No look-ahead:</strong> at issue time only ERA5 days published {w.config.era5LagDays} days earlier are used for fitting; models are refitted every {w.config.refitEveryDays} days on trailing windows.</li>
          <li><strong>Significance:</strong> Diebold–Mariano on the case-weighted daily loss differential (Newey–West, {w.config.dmLagDays ?? 14}-day bandwidth; the largest p across bandwidths is shown) with the Harvey–Leybourne–Newbold correction; 95% intervals from a {w.config.bootstrapBlockDays ?? 7}-day moving-block bootstrap of the pooled skill ratio.</li>
          <li><strong>Calibration:</strong> coverage and histograms use the randomised PIT (rank-based for ensembles), so 80% means calibrated for every forecast type.</li>
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

interface TrackRecordView {
  enabled: boolean; startDate: string | null; latestSnapshot: string | null; snapshots: number; regionsLatest: number;
  ledger: { head: string; length: number; ok: boolean }; cases: { total: number; scored: number; pending: number };
  nextScoresExpected: string | null; methodVersions: Record<string, number>; cells: CellSummary[];
}
const dayLabel = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const share = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);

/** Prospective record: daily snapshots of the live outlook, hash-chained, scored against ERA5 as it arrives. */
function LiveTrackRecord() {
  const [tr, setTr] = useState<TrackRecordView | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/track-record', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setTr)
      .catch((e) => { if (e?.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, []);
  const cells = tr?.cells ?? [];
  const value = (c: CellSummary, who: 'outlook' | 'gaussian') => (c.metric === 'crps' ? c[who].crps : c[who].qs);
  return <section className="sk-card sk-wide sk-track" aria-labelledby="sk-track-title" id="track-record">
    <div className="sk-track-head">
      <span className="af-eyebrow">LIVE TRACK RECORD · PROSPECTIVE</span>
      <h2 id="sk-track-title">Forecasts logged before the weather happened.</h2>
      <p>Every day after 06:30 UTC the outlook shown on Market overview is frozen for each default region: the calibrated bands, event probabilities, method version and the raw model values behind them. Once ERA5 covers a date (about six days later) it is scored against the raw ensemble and the no-training Gaussian of the same models.</p>
    </div>
    {failed && <p className="sk-note">The track record could not be loaded.</p>}
    {!tr && !failed && <p className="sk-note" role="status">Loading the track record…</p>}
    {tr && <>
      <div className="sk-kpis sk-track-kpis">
        <div><span>Started</span><strong>{dayLabel(tr.startDate)}</strong><small>{tr.latestSnapshot ? `latest snapshot ${dayLabel(tr.latestSnapshot)}` : 'no snapshot yet'}</small></div>
        <div><span>Snapshots logged</span><strong>{tr.snapshots}</strong><small>{tr.regionsLatest} regions in the latest · {Object.keys(tr.methodVersions).join(', ') || '—'}</small></div>
        <div><span>Cases scored</span><strong>{tr.cases.scored}</strong><small>{tr.cases.pending} of {tr.cases.total} awaiting ERA5</small></div>
        <div><span>Ledger head</span><strong className="sk-hash" title={tr.ledger.head}><Fingerprint size={18} />{tr.ledger.head.slice(0, 10)}</strong><small>{tr.ledger.ok ? `${tr.ledger.length} link${tr.ledger.length === 1 ? '' : 's'} · chain verified` : 'chain check failed'}</small></div>
      </div>
      <p className="sk-note"><ShieldCheck size={12} /><span>Each snapshot file is hashed into an append-only chain, chain = sha256(previous chain + sha256(file)), committed with the repository; <code>npx tsx research/track-record.ts verify</code> recomputes every link, so an edited or back-filled forecast changes the head shown here.</span></p>
      {!cells.length ? <div className="sk-track-empty">
        <strong>No outcome has been scored yet.</strong>
        <p>ERA5 reanalysis reaches Open-Meteo about six days after each valid date, so the first scores are expected around <b>{dayLabel(tr.nextScoresExpected ?? '2026-11-22')}</b>. Until then the record shows what was forecast and when; skill will appear here as it accrues, including any day or variable where calibration does not help.</p>
      </div> : <>
        <div className="sk-table-wrap"><table className="sk-table">
          <thead><tr><th>Variable</th><th>Lead</th><th>Cases</th><th>Score</th><th>Astraeus</th><th>No-training Gaussian</th><th>Skill vs Gaussian</th><th>Skill vs raw</th><th>80% coverage (A / G / raw)</th><th>Brier (A / G)</th></tr></thead>
          <tbody>{cells.map((c) => <tr key={`${c.variable}-${c.lead}`}>
            <td>{VAR_LABEL[c.variable]}</td><td>Day {c.lead}</td><td>{c.n}</td><td>{c.metric === 'crps' ? 'CRPS' : 'QS 10/50/90'}</td>
            <td>{value(c, 'outlook')?.toFixed(3) ?? '—'}</td><td>{value(c, 'gaussian')?.toFixed(3) ?? '—'}</td>
            <td>{pct(c.skillVsGaussian)}</td><td>{pct(c.skillVsRaw)}</td>
            <td>{share(c.outlook.inside80)} / {share(c.gaussian.inside80)} / {share(c.raw.inside80)}</td>
            <td>{c.outlook.brier == null ? '—' : `${c.outlook.brier.toFixed(3)} / ${c.gaussian.brier?.toFixed(3) ?? '—'}`}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="sk-note">CRPS where the stored band fixes the forecast distribution (Gaussian temperature bands); otherwise QS — twice the mean pinball loss at the 10/50/90 % quantiles — for all three forecasts. Day 0 is the issue date. Small samples: a running log, not a verdict.</p>
      </>}
      <div className="sk-actions"><a className="af-button af-outline" href="/api/v1/track-record" target="_blank" rel="noreferrer"><Download size={14} /> Track record (JSON)</a><a className="af-button af-outline" href="/api/v1/track-record/ledger" target="_blank" rel="noreferrer"><Fingerprint size={14} /> Ledger</a></div>
    </>}
  </section>;
}
