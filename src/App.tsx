import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp, Download, ExternalLink, FlaskConical, Globe2, Layers3, Loader2, Radar, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sprout, Star, Waves, X, Zap } from 'lucide-react';
import { COMMODITIES, SECTORS, type CommodityDefinition, type CommodityForecast } from './engine/commodityForecastEngine';
import { ForecastLab, LinkedMarkets } from './components/ForecastLab';
import { appendForecastSnapshot, linksForCommodity, TRANSMISSION_VERSION } from './engine/commodityTransmissionEngine';
import { GlobeLanding } from './components/GlobeLanding';
import { workspaceViewFromHash, type WorkspaceView } from './engine/workspaceNavigation';
import './globe-landing.css';
import './commodity.css';
import './forecast-lab.css';

const STATUS = {
  UPWARD_PRESSURE: { label: 'Upward pressure', tone: 'up' },
  DOWNWARD_PRESSURE: { label: 'Downward pressure', tone: 'down' },
  MIXED: { label: 'Mixed drivers', tone: 'mixed' },
  NO_MATERIAL_SIGNAL: { label: 'No material signal', tone: 'neutral' },
  INSUFFICIENT_EVIDENCE: { label: 'Insufficient evidence', tone: 'neutral' },
};
const keyFor = (id: string, region: string) => `${id}:${region}`;
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`;
function readWatchlist(): string[] {
  try { const v = JSON.parse(localStorage.getItem('alphaforge-watchlist-v1') || 'null'); if (Array.isArray(v)) return v.filter(id => COMMODITIES.some(c => c.id === id)); } catch {}
  return ['corn', 'coffee', 'natural-gas', 'copper'];
}
function Status({ result }: { result?: CommodityForecast }) {
  const s = result ? STATUS[result.status] : { label: 'Not analysed', tone: 'neutral' };
  return <span className={`af-status ${s.tone}`}><i />{s.label}</span>;
}
function SectorIcon({ sector, size = 18 }: { sector: string; size?: number }) {
  return sector === 'Energy' ? <Zap size={size} /> : sector.includes('metals') ? <Layers3 size={size} /> : <Sprout size={size} />;
}

export function App() {
  const [selectedId, setSelectedId] = useState('corn');
  const [regionId, setRegionId] = useState('iowa');
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All commodities');
  const [view, setView] = useState<WorkspaceView>(() => workspaceViewFromHash(typeof window === 'undefined' ? '' : window.location.hash));
  const navigate = (next: WorkspaceView) => {
    setView(next);
    if (typeof window !== 'undefined') {
      if (window.location.hash !== `#${next}`) window.location.hash = next;
      window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  };
  useEffect(() => {
    const sync = () => setView(workspaceViewFromHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const [watchlist, setWatchlist] = useState<string[]>(readWatchlist);
  const [results, setResults] = useState<Record<string, CommodityForecast>>({});
  const [history, setHistory] = useState<Record<string, CommodityForecast[]>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'outlook' | 'evidence' | 'links'>('outlook');
  const requests = useRef(new Set<string>());
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const selected = COMMODITIES.find(c => c.id === selectedId)!;
  const region = selected.regions.find(r => r.id === regionId) ?? selected.regions[0];
  const activeKey = keyFor(selectedId, region.id);
  const result = results[activeKey];
  const loading = pending[activeKey];
  useEffect(() => { try { localStorage.setItem('alphaforge-watchlist-v1', JSON.stringify(watchlist)); } catch {} }, [watchlist]);
  const filtered = useMemo(() => COMMODITIES.filter(c =>
    (sector === 'All commodities' || c.sector === sector) &&
    (view !== 'watchlist' || watchlist.includes(c.id)) &&
    `${c.name} ${c.symbol} ${c.sector} ${c.regions.map(r => r.name).join(' ')}`.toLowerCase().includes(search.toLowerCase())
  ), [sector, view, watchlist, search]);
  const select = (c: CommodityDefinition) => { if (c.id !== selectedId) { setSelectedId(c.id); setRegionId(c.regions[0].id); } setTab('outlook'); };
  const toggleWatch = (id: string) => setWatchlist(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id]);
  const run = async (c = selected, rid = region.id) => {
    const key = keyFor(c.id, rid);
    if (requests.current.has(key)) return;
    requests.current.add(key); setPending(p => ({ ...p, [key]: true })); setErrors(e => ({ ...e, [key]: '' }));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(`/api/v1/commodities/${encodeURIComponent(c.id)}/forecast?region=${encodeURIComponent(rid)}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The forecast service is unavailable.');
      if (data.commodityId !== c.id || data.regionId !== rid || !data.evidence?.inputHash) throw new Error('The forecast response could not be verified.');
      setResults(prev => ({ ...prev, [key]: data }));
      setHistory(prev => ({ ...prev, [key]: appendForecastSnapshot(prev[key] ?? [], data) }));
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'The data providers took too long. Please retry.' : error instanceof Error ? error.message : 'Unable to retrieve live data.';
      setErrors(e => ({ ...e, [key]: message }));
    } finally { clearTimeout(timeout); requests.current.delete(key); setPending(p => ({ ...p, [key]: false })); }
  };
  const scanWatchlist = async () => {
    if (scan) return;
    const items = COMMODITIES.filter(c => watchlist.includes(c.id));
    setScan({ done: 0, total: items.length });
    // Sequential requests limit load on the public forecast/archive services.
    for (let i = 0; i < items.length; i++) { await run(items[i], items[i].regions[0].id); setScan({ done: i + 1, total: items.length }); }
    setScan(null);
  };
  const exportResult = () => {
    if (!result) return;
    const file = new Blob([JSON.stringify({ commodity: selected, forecast: result, transmission: { version: TRANSMISSION_VERSION, ...linksForCommodity(selected.id) } }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = `alphaforge-${selected.id}-${region.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const analyzed = new Set(Object.values(results).map(r => r.commodityId)).size;
  const material = Object.values(results).filter(r => ['UPWARD_PRESSURE', 'DOWNWARD_PRESSURE', 'MIXED'].includes(r.status)).length;
  return <div className="af-app">
    <aside className="af-sidebar">
      <a className="af-brand" href="#" onClick={e => { e.preventDefault(); navigate('globe'); }}><span className="af-logo"><Waves size={23} /></span><span>alpha<span className="af-brand-thin">forge</span><small>COMMODITY INTELLIGENCE</small></span></a>
      <div className="af-nav-caption">WORKSPACE</div>
      <nav aria-label="Workspace">
        <button title="Global globe explorer" aria-label="Global globe explorer" aria-current={view === 'globe' ? 'page' : undefined} className={view === 'globe' ? 'active' : ''} onClick={() => navigate('globe')}><Globe2 size={18} /> Global explorer <ChevronRight size={14} /></button>
        <button title="Commodity dashboard" aria-label="Commodity dashboard" aria-current={view === 'markets' ? 'page' : undefined} className={view === 'markets' ? 'active' : ''} onClick={() => navigate('markets')}><Radar size={18} /> Market overview <ChevronRight size={14} /></button>
        <button title="Watchlist" aria-label="Watchlist" aria-current={view === 'watchlist' ? 'page' : undefined} className={view === 'watchlist' ? 'active' : ''} onClick={() => { navigate('watchlist'); setSector('All commodities'); }}><Star size={18} /> Watchlist <span className="af-nav-count">{watchlist.length}</span></button>
        <button title="Forecast lab" aria-label="Forecast lab" aria-current={view === 'advanced' ? 'page' : undefined} className={view === 'advanced' ? 'active' : ''} onClick={() => navigate('advanced')}><SlidersHorizontal size={18} /> Forecast lab</button>
        <button title="Research method" aria-label="Research method" aria-current={view === 'methodology' ? 'page' : undefined} className={view === 'methodology' ? 'active' : ''} onClick={() => navigate('methodology')}><FlaskConical size={18} /> Research method</button>
      </nav>
      <div className="af-sidebar-note"><span className="af-live-dot" /> FORECAST → FUNDAMENTALS<p>Understand the physical drivers behind commodity markets.</p><div>Weather. Supply. Demand.</div></div>
      <div className="af-sidebar-bottom"><ShieldCheck size={17} /><span>Evidence before conviction<small>No synthetic market signals</small></span></div>
    </aside>
    <main className="af-main">
      <header className="af-topbar"><div className="af-breadcrumb">Workspace <ChevronRight size={13} /><strong>{view === 'watchlist' ? 'Watchlist' : view === 'methodology' ? 'Research method' : view === 'advanced' ? 'Forecast lab' : view === 'globe' ? 'Global explorer' : 'Market overview'}</strong></div><button className="af-top-home" onClick={() => navigate('globe')}><Globe2 size={12} /> Back to globe</button><span className="af-top-label"><Globe2 size={14} /> Global coverage <span className="af-avatar">AF</span></span></header>
      <div className="af-content">
        {view !== 'globe' && <div className="af-page-heading"><div><div className="af-eyebrow">THE FORECAST ADVANTAGE</div><h1>{view === 'watchlist' ? 'Your markets. In focus.' : view === 'methodology' ? 'A signal is only as good as its evidence.' : view === 'advanced' ? 'Connect the forecast to the wider market.' : 'See what moves markets.'}</h1><p>From physical forecasts to commodity outlooks. Follow the driver, understand the mechanism, check the evidence.</p></div><button className="af-button af-outline" disabled={!!scan || !watchlist.length || view === 'methodology'} onClick={() => void scanWatchlist()}>{scan ? <Loader2 className="af-spin" size={15} /> : <RefreshCw size={15} />}{scan ? `Analysing ${scan.done}/${scan.total}` : 'Analyse watchlist'}</button></div>}
        {view === 'globe' ? <GlobeLanding commodity={selected} regionId={region.id} results={results} pending={pending} errors={errors} onSelect={(id,rid) => { select(COMMODITIES.find(c => c.id === id)!); setRegionId(rid); }} onRun={() => run(selected,region.id)} onMarkets={() => navigate('markets')} onLab={() => navigate('advanced')} /> : view === 'methodology' ? <Methodology /> : view === 'advanced' ? <ForecastLab commodity={selected} regionId={region.id} results={results} history={history} pending={pending} errors={errors} onCommodity={id => select(COMMODITIES.find(c => c.id === id)!)} onRegion={setRegionId} onRun={run} /> : <>
          <section className="af-stats" aria-label="Coverage summary"><div><span>Commodity universe</span><strong>{COMMODITIES.length}<small>across {SECTORS.length} sectors</small></strong><Layers3 size={20} /></div><div><span>Analysed this session</span><strong>{analyzed}<small>of {COMMODITIES.length} commodities</small></strong><Radar size={20} /></div><div><span>Regional pressure signals</span><strong>{material}<small>conditional, not price targets</small></strong><Zap size={20} /></div><div><span>Forecast window</span><strong>7<small>days · weather outlook</small></strong><Globe2 size={20} /></div></section>
          <div className="af-workspace">
            <section className="af-universe af-panel">
              <div className="af-panel-heading"><div><span className="af-eyebrow">EXPLORE THE UNIVERSE</span><h2>{view === 'watchlist' ? 'Your watchlist' : 'Commodity monitor'} <span>{filtered.length}</span></h2></div><SlidersHorizontal size={17} /></div>
              <label className="af-search"><Search size={16} /><input aria-label="Search commodities" placeholder="Search commodity, ticker or region…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label>
              <div className="af-filters" aria-label="Commodity sectors">{['All commodities', ...SECTORS].map(s => <button key={s} aria-pressed={sector === s} onClick={() => setSector(s)} className={sector === s ? 'active' : ''}>{s}</button>)}</div>
              <div className="af-table-head"><span>COMMODITY / EXPOSURE</span><span>OUTLOOK</span><span>WATCH</span></div>
              <div className="af-commodity-list">{filtered.map(c => {
                const rowResult = c.id === selectedId ? result : results[keyFor(c.id, c.regions[0].id)];
                return <div key={c.id} className={`af-commodity-row ${selectedId === c.id ? 'selected' : ''}`}>
                  <button className="af-select-commodity" onClick={() => select(c)} aria-pressed={selectedId === c.id}><span className={`af-commodity-icon ${c.sector === 'Energy' ? 'energy' : c.sector.includes('metals') ? 'metal' : ''}`}><SectorIcon sector={c.sector} /></span><span><strong>{c.name}</strong><small>{c.symbol} <i /> {c.regions[0].name}</small></span></button>
                  <button className="af-row-outlook" onClick={() => select(c)} aria-label={`View ${c.name} outlook`}><Status result={rowResult} /></button>
                  <button className={`af-star ${watchlist.includes(c.id) ? 'saved' : ''}`} aria-label={`${watchlist.includes(c.id) ? 'Remove' : 'Add'} ${c.name} ${watchlist.includes(c.id) ? 'from' : 'to'} watchlist`} aria-pressed={watchlist.includes(c.id)} onClick={() => toggleWatch(c.id)}><Star size={16} fill={watchlist.includes(c.id) ? 'currentColor' : 'none'} /></button>
                </div>;
              })}</div>
              {!filtered.length && <div className="af-empty-list"><Search size={24} /><strong>No commodities found</strong><p>Try another search or add markets to your watchlist.</p><button className="af-text-button" onClick={() => { setSearch(''); setSector('All commodities'); navigate('markets'); }}>Show all commodities <ArrowRight size={14} /></button></div>}
              <div className="af-list-footer"><ShieldCheck size={14} /> Coverage is mapped. Signals require a live analysis.</div>
            </section>
            <section className="af-detail af-panel" aria-label="Selected commodity research">
              <div className="af-detail-title"><span className="af-eyebrow">COMMODITY DEEP DIVE</span><button aria-label="Export research JSON" disabled={!result} onClick={exportResult}><Download size={17} /></button></div>
              <div className="af-detail-name"><span className="af-large-icon"><SectorIcon sector={selected.sector} size={27} /></span><div><h2>{selected.name}</h2><p>{selected.symbol} <span>·</span> {selected.unit}</p></div><button className={`af-star ${watchlist.includes(selected.id) ? 'saved' : ''}`} aria-label="Toggle selected commodity watchlist" aria-pressed={watchlist.includes(selected.id)} onClick={() => toggleWatch(selected.id)}><Star size={19} fill={watchlist.includes(selected.id) ? 'currentColor' : 'none'} /></button></div>
              <div className="af-region"><Globe2 size={15} /><select aria-label="Forecast region" value={region.id} onChange={e => setRegionId(e.target.value)}>{selected.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><ChevronDown size={14} /></div>
              <div className="af-detail-tabs" role="tablist" aria-label="Research detail"><button id="outlook-tab" role="tab" aria-selected={tab === 'outlook'} aria-controls="research-detail" onClick={() => setTab('outlook')} className={tab === 'outlook' ? 'active' : ''}>Forecast outlook</button><button id="links-tab" role="tab" aria-selected={tab === 'links'} aria-controls="research-detail" onClick={() => setTab('links')} className={tab === 'links' ? 'active' : ''}>Linked markets</button><button id="evidence-tab" role="tab" aria-selected={tab === 'evidence'} aria-controls="research-detail" onClick={() => setTab('evidence')} className={tab === 'evidence' ? 'active' : ''}>Evidence & sources</button></div>
              <div id="research-detail" role="tabpanel" aria-labelledby={`${tab}-tab`} className="af-detail-body">
                <div className="af-analysis-controls"><span><i className={`af-live-dot ${result ? '' : 'muted'}`} />{result ? `Fetched ${new Date(result.sourceGeneratedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live analysis ready'}</span><button className="af-button af-primary" disabled={loading} onClick={() => void run()}>{loading ? <Loader2 className="af-spin" size={14} /> : <Radar size={14} />}{loading ? 'Analysing…' : result ? 'Refresh analysis' : 'Run forecast'}</button></div>
                {loading && <div className="af-loading" role="status"><div className="af-loading-line" /><p>Comparing weather models, climatology and observed prices. This can take a minute.</p></div>}
                {errors[activeKey] && <div className="af-error" role="alert"><strong>Live analysis unavailable</strong><p>{errors[activeKey]}</p><small>{result ? 'Previous result remains below; it was not refreshed.' : 'No demo result has been substituted.'}</small><button className="af-text-button" onClick={() => void run()} disabled={loading}>Retry <RefreshCw size={13} /></button></div>}
                {tab === 'outlook' ? <>
                  <div className="af-outlook-summary"><div className="af-label">CONDITIONAL PRICE PRESSURE</div><Status result={result} /><h3>{result?.headline ?? (selected.weatherRole === 'LIMITED' ? 'Start with fundamentals. Weather is a supporting input.' : 'Every outlook starts with a physical driver.')}</h3><p>{result ? result.weatherWindow : 'Run an analysis to compare the next seven days with regional climatology. No signal is shown before the evidence arrives.'}</p></div>
                  <div className="af-driver-heading"><h3>What to watch</h3><span>{selected.weatherRole.toLowerCase()} weather exposure</span></div>
                  {result ? <div className="af-driver-readings">{result.drivers.map(d => <div className="af-reading" key={d.label}><div><strong>{d.label}</strong><span>{d.pressure === 'UNKNOWN' ? 'Unavailable' : d.zScore == null ? '—' : `${signed(d.zScore)}σ`}</span></div><div className="af-anomaly-track"><i /><b style={{ left: d.zScore == null ? '50%' : `${50 + Math.max(-3, Math.min(3, d.zScore)) / 3 * 46}%` }} /></div><div className="af-reading-values"><span>{d.value == null ? 'No usable climatology' : `Forecast ${d.value.toFixed(1)} ${d.unit} · normal ${d.normal!.toFixed(1)}`}</span><span>{d.pressure === 'UP' ? '↑ pressure' : d.pressure === 'DOWN' ? '↓ pressure' : d.pressure === 'UNKNOWN' ? 'Missing' : 'No signal'}</span></div><p>{d.mechanism}</p><small>{d.caveat}</small></div>)}{!result.drivers.length && <p className="af-note">No defensible direct weather-to-price rule is configured for {selected.name}. Follow the fundamental checklist below.</p>}</div> : <div className="af-driver-preview">{selected.rules.length ? selected.rules.map((rule, i) => <div key={rule.kind}><span>0{i + 1}</span><section><strong>{rule.label}</strong><p>{rule.mechanism}</p></section></div>) : <div><CircleHelp size={20} /><section><strong>No direct weather model</strong><p>A rainfall forecast cannot explain real yields, central-bank buying or industrial demand.</p></section></div>}</div>}
                  <div className="af-fundamentals"><div className="af-label">CONFIRM WITH FUNDAMENTALS</div>{selected.fundamentals.map(f => <p key={f}><span className="af-check-circle" />{f}</p>)}</div>
                  {result?.market && <div className="af-observed"><span>Observed market context <small>{result.market.lastDate} · {result.market.currency}</small></span><strong>{result.market.lastClose.toLocaleString(undefined, { maximumFractionDigits: 3 })}<small>{signed(result.market.return5dPct)}% / 5 sessions</small></strong></div>}
                  {result && !result.market && <p className="af-note">Observed market quote unavailable. No price or return has been substituted.</p>}
                </> : tab === 'links' ? <LinkedMarkets commodity={selected} onSelect={id => select(COMMODITIES.find(c => c.id === id)!)} onOpenLab={() => navigate('advanced')} /> : <Evidence result={result} commodity={selected} />}
                <div className="af-caution"><ShieldCheck size={16} /><p><strong>Research with boundaries.</strong> These are conditional physical mechanisms, not a validated price forecast. {selected.horizon} transmission horizon; inventories, policy and demand can dominate.</p></div>
              </div>
            </section>
          </div>
          <section className="af-process"><div><span className="af-eyebrow">FROM FORECAST TO UNDERSTANDING</span><h2>Follow the whole chain.</h2></div>{[{ n: '01', title: 'Physical forecast', text: 'Fresh regional weather models' }, { n: '02', title: 'Economic mechanism', text: 'Supply, demand or disruption' }, { n: '03', title: 'Market evidence', text: 'Observed prices, not imagined returns' }, { n: '04', title: 'Challenge the thesis', text: 'Check offsets and invalidation' }].map(s => <article key={s.n}><span>{s.n}</span><strong>{s.title}</strong><p>{s.text}</p></article>)}</section>
        </>}
        <footer className="af-footer"><span>ALPHAFORGE <i /> Forecast-driven commodity research</span><span>Data gaps stay visible. Evidence stays attached.</span></footer>
      </div>
    </main>
  </div>;
}

function Evidence({ result, commodity }: { result?: CommodityForecast; commodity: CommodityDefinition }) {
  if (!result) return <div className="af-evidence-empty"><ShieldCheck size={30} /><h3>Evidence belongs beside the outlook.</h3><p>Run a forecast to inspect model coverage, regional climatology, input provenance and source requests.</p><p>Price-model validation for {commodity.name}: <strong>not established</strong>.</p></div>;
  const sourceList = [...new Map(result.sources.map(s => [s.url, s])).values()];
  return <><div className="af-evidence-grid"><div><span>Accepted weather models</span><strong>{result.evidence.modelCount}</strong></div><div><span>Climatology years</span><strong>{result.evidence.climateYears}</strong></div><div><span>Weather verification</span><strong>{result.evidence.weatherVerification ? 'Available' : 'Unavailable'}</strong></div><div><span>Price-model validation</span><strong>Not established</strong></div></div><h3 className="af-section-title">Limits & invalidation</h3><ul className="af-limitations">{result.limitations.map(l => <li key={l}>{l}</li>)}</ul><div className="af-provenance"><div className="af-label">REPRODUCIBLE INPUTS</div><code>{result.evidence.experimentId}</code><small>INPUT SHA-256</small><code>{result.evidence.inputHash}</code><small>ENGINE / PARAMETERS SHA-256</small><code>{result.evidence.engineVersion}</code><code>{result.evidence.parametersSha256 ?? 'Not available'}</code><p>{new Date(result.generatedAtUtc).toUTCString()}</p></div><h3 className="af-section-title">Source requests</h3><div className="af-sources">{sourceList.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer"><span className={s.ok ? 'af-source-ok' : 'af-source-fail'}>{s.ok ? <Check size={13} /> : <X size={13} />}</span><span>{s.source}<small>{s.note}</small></span><ExternalLink size={13} /></a>)}{!sourceList.length && <p className="af-note">Inputs were served from the weather pipeline cache. Use the input hash and timestamp to identify this analysis.</p>}</div></>;
}
function Methodology() {
  return <section className="af-methodology af-panel"><span className="af-eyebrow">HOW ALPHAFORGE REASONS</span><h2>Physical forecasts first. Financial claims need their own validation.</h2><p>The catalogue maps commodities to representative production or demand locations. A live analysis retrieves regional multi-model forecasts, compares them with historical seasonal conditions and applies explicit mechanism rules.</p><div className="af-method-grid">{[
    ['01', 'Forecast', 'A seven-day weather window uses fresh model runs. Missing or stale inputs are not replaced with invented observations.'],
    ['02', 'Detect', 'Anomalies are expressed against regional climatology. Standardized anomalies describe unusual weather, not a probability of a profitable trade.'],
    ['03', 'Translate', 'Crop stress, degree-day demand, wind substitution and disruption use different rules. Seasonal windows limit crop inference. These rules are screening heuristics, not estimated price elasticities.'],
    ['04', 'Verify', 'Weather verification and financial validation are separate. Observed historical returns are context, not forecast performance. No target or confidence percentage is manufactured.'],
  ].map(([n, title, body]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p></article>)}</div><h3>What stronger price prediction requires</h3><p>Production-weighted regional inputs, crop-stage and soil-moisture data, point-in-time inventories and demand, contract-roll handling, forecast revisions, and a walk-forward price model tested against simple baselines. Until those are integrated and validated, AlphaForge reports conditional pressure and the evidence that could overturn it.</p><div className="af-caution"><ShieldCheck size={20} /><p>The current coverage is 28 commodities. Regional coverage and free market quotes are incomplete. An unsupported direction is labelled insufficient evidence.</p></div></section>;
}
export default App;
