import React, { useState } from 'react';
import { ArrowRight, ExternalLink, FlaskConical, GitBranch, Loader2, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { COMMODITIES, type CommodityDefinition, type CommodityForecast } from '../engine/commodityForecastEngine';
import { TRANSMISSION_NODES, TRANSMISSION_VERSION, linksForCommodity, traceTransmission, compareForecasts, directionFromForecast, type Direction, type Measure, type TransmissionLink } from '../engine/commodityTransmissionEngine';

const names = new Map(TRANSMISSION_NODES.map(n => [n.id, n.name]));
const measures: Record<Measure, string> = { PRICE: 'price pressure', INPUT_COST: 'input costs', DEMAND: 'demand', MARGIN: 'producer margin', CONTEXT: 'context only' };
const statusLabel = (r?: CommodityForecast) => r ? r.status.toLowerCase().replaceAll('_', ' ') : 'not analysed';
const number = (v: number | undefined, suffix = '') => v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(2)}${suffix}`;
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

function NodeButton({ id, onSelect }: { id: string; onSelect: (id: string) => void }) {
  return COMMODITIES.some(c => c.id === id) ? <button className="af-node-button" onClick={() => onSelect(id)}>{names.get(id)}<ArrowRight size={12} /></button> : <strong>{names.get(id)}</strong>;
}
function LinkCard({ link, incoming, onSelect }: { link: TransmissionLink; incoming: boolean; onSelect: (id: string) => void }) {
  return <article className="af-link-card"><div className="af-link-card-title"><NodeButton id={incoming ? link.from : link.to} onSelect={onSelect} /><span>{measures[link.targetMeasure]}</span></div><small>{link.channel} · {link.lag}</small><p>{link.mechanism}</p><details><summary>Conditions & background source</summary><p>{link.condition}</p><a href={link.source.url} target="_blank" rel="noreferrer">{link.source.title}<ExternalLink size={11} /></a><p>Source supports the mechanism background, not a fitted elasticity or validation of this specific route.</p></details></article>;
}
export function LinkedMarkets({ commodity, onSelect, onOpenLab }: { commodity: CommodityDefinition; onSelect: (id: string) => void; onOpenLab: () => void }) {
  const links = linksForCommodity(commodity.id);
  return <div className="af-linked-markets"><div className="af-driver-heading"><h3>Connected markets</h3><button className="af-text-button" onClick={onOpenLab}>Open transmission lab <ArrowRight size={12} /></button></div><p className="af-note">Follow economic channels, not assumed correlations. Costs, demand and selling prices are different effects.</p><div className="af-label">UPSTREAM DRIVERS</div>{links.incoming.map(l => <LinkCard key={l.id} link={l} incoming onSelect={onSelect} />)}<div className="af-label">DOWNSTREAM EXPOSURES</div>{links.outgoing.map(l => <LinkCard key={l.id} link={l} incoming={false} onSelect={onSelect} />)}{!links.outgoing.length && <p className="af-note">No defensible outgoing route is configured. Upstream cost exposure is not evidence of onward price contagion.</p>}</div>;
}

type Tab = 'transmission' | 'scenario' | 'regions' | 'revisions' | 'models';
const tabs: { id: Tab; name: string; description: string }[] = [
  { id: 'transmission', name: 'Transmission map', description: 'How economic channels connect commodities.' },
  { id: 'scenario', name: 'Scenario lab', description: 'Trace a conditional up/down shock without inventing price targets.' },
  { id: 'regions', name: 'Regional comparison', description: 'Compare actual analyses across the selected commodity’s sample points.' },
  { id: 'revisions', name: 'Forecast revisions', description: 'Compare retrieved snapshots for the same commodity and region.' },
  { id: 'models', name: 'Model diagnostics', description: 'Inspect weather-model disagreement, freshness and held-out skill.' },
];
interface Props {
  commodity: CommodityDefinition; regionId: string;
  results: Record<string, CommodityForecast>; history: Record<string, CommodityForecast[]>;
  pending: Record<string, boolean>; errors: Record<string, string>;
  onCommodity: (id: string) => void; onRegion: (id: string) => void;
  onRun: (c?: CommodityDefinition, region?: string) => Promise<void>;
}
export function ForecastLab({ commodity, regionId, results, history, pending, errors, onCommodity, onRegion, onRun }: Props) {
  const [tab, setTab] = useState<Tab>('transmission');
  const [direction, setDirection] = useState<Direction>('UP');
  const [hops, setHops] = useState(2);
  const [runningRegions, setRunningRegions] = useState(false);
  const [scenario, setScenario] = useState<'MANUAL' | 'FORECAST'>('MANUAL');
  const key = `${commodity.id}:${regionId}`;
  const result = results[key];
  const snapshots = history[key] ?? [];
  const current = snapshots.at(-1), prior = snapshots.at(-2);
  const revision = prior && current ? compareForecasts(prior, current) : null;
  const forecastDirection = directionFromForecast(result);
  const effectiveDirection = scenario === 'FORECAST' ? forecastDirection : direction;
  const paths = effectiveDirection ? traceTransmission(commodity.id, effectiveDirection, hops) : [];
  const links = linksForCommodity(commodity.id);
  const analyzeRegions = async () => {
    setRunningRegions(true);
    try { for (const region of commodity.regions) await onRun(commodity, region.id); }
    finally { setRunningRegions(false); }
  };
  return <section className="af-forecast-lab af-panel">
    <div className="af-lab-intro"><span className="af-eyebrow">ADVANCED · BUILT FOR FORECAST RESEARCH</span><h2>Understand the second-order effects.</h2><p>Explore what transmits, what offsets it, and where evidence stops. All routes are conditional mechanisms; none are fitted return forecasts.</p></div>
    <div className="af-lab-controls"><label>Commodity<select value={commodity.id} onChange={e => onCommodity(e.target.value)}>{COMMODITIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Regional sample<select value={regionId} onChange={e => onRegion(e.target.value)}>{commodity.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button className="af-button af-primary" disabled={pending[key]} onClick={() => void onRun(commodity, regionId)}>{pending[key] ? <Loader2 className="af-spin" size={14} /> : <RefreshCw size={14} />}{pending[key] ? 'Analysing…' : 'Run live analysis'}</button></div>
    {errors[key] && <div className="af-error" role="alert">{errors[key]}</div>}
    {pending[key] && <p className="af-note" role="status">Fetching forecasts, seasonal climatology and market context. This may take a minute.</p>}
    <div className="af-lab-tabs" role="tablist" aria-label="Forecast tools">{tabs.map(t => <button id={`lab-tab-${t.id}`} key={t.id} role="tab" aria-selected={t.id === tab} aria-controls="af-lab-panel" className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>{t.name}</button>)}</div>
    <div className="af-lab-panel" id="af-lab-panel" role="tabpanel" aria-labelledby={`lab-tab-${tab}`}><p className="af-lab-description">{tabs.find(t => t.id === tab)!.description}</p>
      {tab === 'transmission' && <>
        <div className="af-network"><div><div className="af-label">WHAT AFFECTS {commodity.name.toUpperCase()}</div>{links.incoming.map(l => <LinkCard key={l.id} link={l} incoming onSelect={onCommodity} />)}{!links.incoming.length && <p className="af-note">No upstream route mapped.</p>}</div><div className="af-network-center"><GitBranch size={29} /><h3>{commodity.name}</h3><p>{commodity.symbol}</p><span>Supply · demand · costs</span><p>→ direction of economic transmission</p></div><div><div className="af-label">WHAT {commodity.name.toUpperCase()} AFFECTS</div>{links.outgoing.map(l => <LinkCard key={l.id} link={l} incoming={false} onSelect={onCommodity} />)}{!links.outgoing.length && <p className="af-note">No justified downstream route mapped. Incoming cost pressure is not automatically a selling-price signal.</p>}</div></div>
        <div className="af-caution"><ShieldCheck size={18} /><p>These are directional economic hypotheses. They do not estimate correlation or causality from observed prices. Click a commodity to follow the chain; open a route to inspect conditions and sources.</p></div>
      </>}
      {tab === 'scenario' && <>
        <div className="af-scenario-controls"><label>Scenario origin<select value={scenario} onChange={e => setScenario(e.target.value as 'MANUAL' | 'FORECAST')}><option value="MANUAL">Manual hypothetical price shock</option><option value="FORECAST">Current conditional forecast pressure</option></select></label><label>Initial direction<select disabled={scenario === 'FORECAST'} value={scenario === 'FORECAST' ? forecastDirection ?? '' : direction} onChange={e => setDirection(e.target.value as Direction)}>{scenario === 'FORECAST' && !forecastDirection && <option value="">No directional seed</option>}<option value="UP">Upward</option><option value="DOWN">Downward</option></select></label><label>Transmission depth<select value={hops} onChange={e => setHops(Number(e.target.value))}><option value={1}>Direct effects</option><option value={2}>Two steps</option><option value={3}>Three steps</option></select></label></div>
        <div className="af-scenario-seed"><FlaskConical size={22} /><div><strong>{scenario === 'MANUAL' ? 'WHAT-IF SCENARIO' : 'CONDITIONAL FORECAST SCENARIO'}</strong><p>{effectiveDirection ? `${commodity.name} price pressure ${effectiveDirection === 'UP' ? 'rises' : 'falls'} → follow the mechanisms below.` : 'Run an analysis with a single directional pressure signal, or choose a manual scenario.'}</p>{scenario === 'FORECAST' && result && <small>Source snapshot: {new Date(result.sourceGeneratedAtUtc).toUTCString()} · {result.evidence.experimentId}</small>}</div></div>
        <p className="af-note">Each additional step requires every earlier assumption to hold. Input-cost, margin and demand effects stay separate from price effects. Routes are not summed into a target.</p>
        <div className="af-scenario-paths">{paths.map(path => <article key={path.links.map(l => l.id).join('|')}><div className="af-path-chain">{path.nodes.map((id, i) => <React.Fragment key={id}>{i > 0 && <ArrowRight size={14} />}<NodeButton id={id} onSelect={onCommodity} /></React.Fragment>)}</div><span className={`af-path-effect ${path.direction === 'UP' ? 'up' : 'down'}`}>{path.direction === 'UP' ? '↑' : '↓'} {measures[path.measure]} · {path.links.length} step{path.links.length > 1 ? 's' : ''}</span><p>{path.links.at(-1)!.mechanism}</p><details><summary>Required assumptions & timing</summary>{path.links.map(l => <p key={l.id}><strong>{l.channel}:</strong> {l.condition} <small>{l.lag}</small></p>)}</details></article>)}</div>
        {effectiveDirection && !paths.length && <div className="af-evidence-empty"><h3>No justified directional route</h3><p>This commodity’s relationships are contextual or upstream-only. The engine does not invent spillover signals.</p></div>}
        <p className="af-note">Rule set: {TRANSMISSION_VERSION}. Manual inputs remain separate from live analysis and never overwrite it.</p>
      </>}
      {tab === 'regions' && <>
        <div className="af-region-lab-heading"><p className="af-note">Compare regional standardized anomalies. Values use local baselines and are not production-weighted global aggregates.</p><button className="af-button af-outline" disabled={runningRegions} onClick={() => void analyzeRegions()}>{runningRegions ? <Loader2 size={14} className="af-spin" /> : <Play size={14} />}Analyse {commodity.regions.length} region{commodity.regions.length > 1 ? 's' : ''}</button></div>
        <div className="af-lab-table-wrap"><table className="af-lab-table"><thead><tr><th>Region</th><th>Pressure</th><th>Sensitivity window</th><th>Drivers</th><th>Source snapshot</th><th /></tr></thead><tbody>{commodity.regions.map(region => { const k = `${commodity.id}:${region.id}`, r = results[k]; return <tr key={region.id}><td>{region.name}</td><td>{pending[k] ? 'Analysing…' : errors[k] ? 'Refresh failed' : statusLabel(r)}{errors[k] && <small>{errors[k]}</small>}</td><td>{r ? r.seasonActive ? 'Active / year-round' : 'Outside broad window' : 'Not checked'}</td><td>{r?.drivers.map(d => <small key={d.label}>{d.label}: {number(d.zScore ?? undefined, 'σ')}</small>) ?? '—'}</td><td>{r ? new Date(r.sourceGeneratedAtUtc).toUTCString() : 'Not analysed'}</td><td><button className="af-text-button" disabled={pending[k]} onClick={() => { onRegion(region.id); void onRun(commodity, region.id); }}>Refresh</button></td></tr>; })}</tbody></table></div>
        {commodity.regions.length === 1 && <p className="af-note">Only one representative region is mapped for this commodity. A global comparison is not available.</p>}
      </>}
      {tab === 'revisions' && <>
        <div className="af-revision-summary"><h3>{snapshots.length} distinct snapshot{snapshots.length === 1 ? '' : 's'} this session</h3><p>{revision?.reason ?? 'Run a live analysis, then refresh after source inputs update. Re-fetching a cached result does not count as a revision.'}</p><small>History is session-local and retains the latest 12 distinct snapshots per commodity/region.</small></div>
        {revision?.comparable && <><p className="af-note">Pressure classification {revision.pressureChanged ? 'changed' : 'unchanged'}: {statusLabel(prior)} → {statusLabel(current)}</p><div className="af-lab-table-wrap"><table className="af-lab-table"><thead><tr><th>Driver</th><th>Previous anomaly</th><th>Latest anomaly</th><th>Change</th></tr></thead><tbody>{revision.changes.map(c => <tr key={c.label}><td>{c.label}</td><td>{signed(c.fromZ)}σ</td><td>{signed(c.toZ)}σ</td><td>{signed(c.deltaZ)}σ</td></tr>)}</tbody></table></div></>}
        <div className="af-snapshot-list">{[...snapshots].reverse().map(r => <article key={`${r.sourceGeneratedAtUtc}:${r.evidence.inputHash}`}><span>{new Date(r.sourceGeneratedAtUtc).toUTCString()}</span><strong>{statusLabel(r)}</strong><code>{r.evidence.inputHash.slice(0,20)}…</code></article>)}</div>
      </>}
      {tab === 'models' && (!result?.diagnostics ? <div className="af-evidence-empty"><ShieldCheck size={28} /><h3>Run a forecast to inspect its models.</h3><p>Diagnostics come from the actual analysis. No example skill scores are substituted.</p></div> : <>
        <div className="af-lab-table-wrap"><table className="af-lab-table"><thead><tr><th>Weather model</th><th>Included?</th><th>Rain / 7d</th><th>Mean temp</th><th>Mean wind</th><th>Run initialized</th></tr></thead><tbody>{result.diagnostics.models.map(m => <tr key={m.modelId}><td>{m.name}</td><td>{m.includedInEnsemble ? 'Yes' : m.exclusionReason ?? 'No'}</td><td>{number(m.stats?.precipMm, ' mm')}</td><td>{number(m.stats?.tempMeanC, ' °C')}</td><td>{number(m.stats?.windMeanMs, ' m/s')}</td><td>{result.diagnostics!.provenance.find(p => p.modelId === m.modelId)?.initTimestampUtc ?? 'Unavailable'}</td></tr>)}</tbody></table></div>
        {result.diagnostics.verification ? <div className="af-weather-skill"><h3>Held-out weather verification</h3><p>Training: {result.diagnostics.verification.trainWindow} · test: {result.diagnostics.verification.testWindow}</p><div className="af-evidence-grid"><div><span>Equal-weight rain RMSE</span><strong>{number(result.diagnostics.verification.equalWeight.rmse, ' mm')}</strong></div><div><span>Skill-weighted rain RMSE</span><strong>{number(result.diagnostics.verification.skillWeighted.rmse, ' mm')}</strong></div><div><span>Skill-weighted CRPS</span><strong>{number(result.diagnostics.verification.skillWeighted.crps, ' mm')}</strong></div><div><span>90% interval coverage</span><strong>{number(result.diagnostics.verification.skillWeighted.predictionIntervalCoverage90Pct, '%')}</strong></div></div><p>{result.diagnostics.verification.verdict.toLowerCase().replaceAll('_', ' ')}</p></div> : <p className="af-note">Held-out weather verification unavailable for this region.</p>}
        <div className="af-caution"><ShieldCheck size={18} /><p>These scores assess weather forecasts. They do not establish commodity-price prediction skill. Rainfall verification does not automatically validate temperature, wind or any downstream financial effect.</p></div>
      </>)}
    </div>
  </section>;
}
