import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, FileText, Gauge, Layers, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { HeroGlobe, type HeroSite } from './HeroGlobe';
import { BarList, FanChart, LineChart, type FanDay } from '../charts/Charts';
import { loadJson, useResearchData, type WeatherSkill, type PriceSkill } from '../../engine/researchData';
import type { StorageSummary } from '../../engine/technicalReport';
import type { WorkspaceView } from '../../engine/workspaceNavigation';

/** Adds `is-in` once an element scrolls into view (once); respects reduced motion via CSS. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    // Also pick up blocks that render later (e.g. once their data file has loaded).
    const seen = new WeakSet<Element>();
    const watch = () => el.querySelectorAll('[data-reveal]').forEach((n) => { if (!seen.has(n)) { seen.add(n); io.observe(n); } });
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(el, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return ref;
}

function CountUp({ value, decimals = 0, suffix = '', prefix = '' }: { value: number; decimals?: number; suffix?: string; prefix?: string }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(value)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        setShown(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref} className="lp-count">{prefix}{shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

const pct = (x: number | null | undefined, d = 0) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);
const LEAD_LABEL = (l: number) => `Day ${l}`;

function headline(w: WeatherSkill | null) {
  if (!w) return null;
  const m = w.headlineMethod ?? 'astraeus-v2';
  const row = (v: string, lead: number) => w.summary.find((s) => s.variable === v && s.lead === lead && s.method === m);
  const cases = w.summary.filter((s) => s.method === m).reduce((a, s) => a + s.cases, 0);
  return { method: m, cases, tmax1: row('tmax', 1), tmean1: row('tmean', 1), precip1: row('precip', 1), tmax3: row('tmax', 3), tmax7: row('tmax', 7) };
}

const STEPS = [
  { n: '01', icon: Layers, title: 'Ingest seven global models', body: 'ECMWF IFS and its machine-learning sibling AIFS, NOAA GFS, DWD ICON, the UK Met Office, JMA and Environment Canada. Runs older than 24 hours are rejected, never back-filled.' },
  { n: '02', icon: Gauge, title: 'Score every model against the record', body: 'Each model’s past forecasts are verified against ERA5 reanalysis at the same lead time, region by region. Skill is measured, then earned: accurate models gain weight.' },
  { n: '03', icon: Sparkles, title: 'Calibrate into probabilities', body: 'Bias-corrected, skill-weighted and spread-adjusted by non-homogeneous Gaussian regression fitted on minimum CRPS (Gneiting et al., 2005). The output is a distribution, and its interval coverage is published, warts and all.' },
  { n: '04', icon: Waves, title: 'Trace the shock into markets', body: 'Calibrated anomalies feed explicit, literature-backed mechanisms: heat at corn pollination, frost in Brazilian coffee, heating demand in the US Northeast — each with its own invalidation test.' },
];

function StepVisual({ step, w }: { step: number; w: WeatherSkill | null }) {
  const leaderboard = useMemo(() => {
    if (!w) return [];
    return w.singleModels.filter((m) => m.variable === 'tmax' && m.lead === 3).sort((a, b) => a.mae - b.mae).map((m, i) => ({ label: m.name, value: m.mae, note: m.kind === 'machine learning' ? 'machine learning' : undefined, highlight: i === 0 }));
  }, [w]);
  const example = w?.examples?.find((e) => e.site === 'iowa' && e.variable === 'tmax');
  const fan: FanDay[] = (example?.days ?? []).slice(-45);
  return <div className="lp-step-visual" data-step={step}>
    <div className={`lp-vis ${step === 0 ? 'on' : ''}`} aria-hidden={step !== 0}>
      <div className="lp-models">
        {['ECMWF IFS', 'ECMWF AIFS', 'NOAA GFS', 'DWD ICON', 'UK Met Office', 'JMA GSM', 'ECCC GEM'].map((m, i) => <span key={m} style={{ ['--i' as any]: i }}>{m}{m === 'ECMWF AIFS' && <small>AI</small>}</span>)}
        <div className="lp-models-core"><Waves size={22} /><strong>Astraeus</strong><small>multi-model calibration</small></div>
      </div>
    </div>
    <div className={`lp-vis ${step === 1 ? 'on' : ''}`} aria-hidden={step !== 1}>
      {leaderboard.length ? <BarList caption="Day-3 maximum-temperature error by model (MAE, °C, lower is better) — 16 commodity regions, held-out Apr–Nov 2026" rows={leaderboard} format={(v) => v.toFixed(2)} unit="°C" /> : <p className="lp-muted">Verification table loading…</p>}
    </div>
    <div className={`lp-vis ${step === 2 ? 'on' : ''}`} aria-hidden={step !== 2}>
      {fan.length ? <FanChart days={fan} unit="°C" caption="Iowa · daily maximum temperature, forecast 3 days ahead (held-out period)" /> : <p className="lp-muted">Example forecast loading…</p>}
    </div>
    <div className={`lp-vis ${step === 3 ? 'on' : ''}`} aria-hidden={step !== 3}>
      <ol className="lp-chain">
        {[['Weather', 'Calibrated heat, rain, frost, degree-days'], ['Physical system', 'Yield stress · harvest · heating & cooling load'], ['Supply & demand', 'Inventories, exports, substitution'], ['Price pressure', 'Conditional direction, with invalidation criteria']].map(([t, d], i) => <li key={t} style={{ ['--i' as any]: i }}><span>0{i + 1}</span><strong>{t}</strong><small>{d}</small></li>)}
      </ol>
    </div>
  </div>;
}

export function PriceEvidence({ p }: { p: PriceSkill | null }) {
  if (!p) return <p className="lp-muted">Price study results loading…</p>;
  const tiers: Array<[string, string]> = [['REALISED_LAGGED', 'Realised weather (lagged)'], ['NWP_FORECAST', 'Weather forecasts (2024–26)']];
  const commodities = [...new Map(p.rows.map((r) => [r.commodity, r.name])).entries()];
  const cell = (c: string, tier: string, h: number) => p.rows.find((r) => r.commodity === c && r.tier === tier && r.horizonWeeks === h);
  return <div className="lp-price-grid" role="table" aria-label="Out-of-sample R² of weather-augmented models relative to market-only models">
    <div role="row" className="lp-price-head"><span role="columnheader">Commodity</span>{tiers.map(([t, l]) => [1, 4].map((h) => <span role="columnheader" key={`${t}${h}`}>{l}<small>{h}-week returns</small></span>))}</div>
    {commodities.map(([id, name]) => <div role="row" key={id}><span role="rowheader">{name}</span>{tiers.map(([t]) => [1, 4].map((h) => {
      const r = cell(id, t, h);
      if (!r) return <span role="cell" key={`${t}${h}`} className="lp-price-cell na">—</span>;
      const v = r.metrics.oosR2WxVsMkt;
      const q = r.qCwWxVsMkt;
      const sig = q != null && q < 0.1;
      return <span role="cell" key={`${t}${h}`} className={`lp-price-cell ${v > 0 ? 'pos' : 'neg'} ${sig ? 'sig' : ''}`} style={{ ['--mag' as any]: Math.min(1, Math.abs(v) / 0.08) }} title={`R² gain vs market-only: ${(v * 100).toFixed(1)}% · Clark–West p = ${r.metrics.cwWxVsMkt?.p?.toFixed(3)} · BH q = ${q?.toFixed(3) ?? '—'} · vs no-change: DM p = ${r.metrics.dmWxVsRw?.p?.toFixed(2) ?? '—'} · n = ${r.metrics.n} weeks`}>
        {v > 0 ? '+' : ''}{(v * 100).toFixed(1)}%{sig && <b aria-label="significant after multiple-testing correction">●</b>}
      </span>;
    }))}</div>)}
  </div>;
}

export function Landing({ onEnter }: { onEnter: (view: WorkspaceView) => void }) {
  const { weather, price } = useResearchData();
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  useEffect(() => { let live = true; void loadJson<StorageSummary>('/research/storage-summary.json').then((d) => live && setStorage(d)); return () => { live = false; }; }, []);
  const ng = storage?.comparisons.find((x) => x.id === 'C1');
  const ngGfs = storage?.comparisons.find((x) => x.id === 'C3');
  const h = headline(weather);
  const root = useReveal<HTMLDivElement>();
  const [wind, setWind] = useState<{ live: boolean; model?: string; validAt?: string } | null>(null);
  const [step, setStep] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const sites: HeroSite[] = useMemo(() => (weather?.sites ?? []).map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })), [weather]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.index)); }), { rootMargin: '-45% 0px -45% 0px' });
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const leadSeries = useMemo(() => {
    if (!weather) return [];
    const methods: Array<[string, string, string, boolean?]> = [['astraeus-v2', 'Astraeus v2', 'var(--viz-1)'], ['raw-ensemble', 'Raw ensemble', 'var(--viz-2)'], ['raw-gauss', 'No-training Gaussian', 'var(--viz-3)'], ['climatology', 'Climatology', 'var(--viz-ref)', true]];
    return methods.map(([id, label, color, dashed]) => ({ id, label, color, dashed, emphasis: id === 'astraeus-v2', points: weather.config.leads.map((l) => ({ x: l, y: weather.summary.find((s) => s.variable === 'tmax' && s.lead === l && s.method === id)?.crps ?? null })) }));
  }, [weather]);

  const go = (v: WorkspaceView) => (e: React.MouseEvent) => { e.preventDefault(); onEnter(v); };

  return <div className="lp" ref={root}>
    <header className={`lp-nav ${scrolled ? 'solid' : ''}`}>
      <a className="lp-brand" href="#home" aria-label="Astraeus home"><span className="lp-mark"><Waves size={18} /></span>Astraeus</a>
      <nav aria-label="Site">
        <a href="#method" onClick={(e) => { e.preventDefault(); document.getElementById('lp-method')?.scrollIntoView({ behavior: 'smooth' }); }}>Method</a>
        <a href="#accuracy" onClick={go('accuracy')}>Forecast skill</a>
        <a href="#report" onClick={go('report')}>Technical report</a>
      </nav>
      <a className="lp-cta-small" href="#globe" onClick={go('globe')}>Open the terminal <ArrowRight size={14} /></a>
    </header>

    <section className="lp-hero">
      <div className="lp-hero-copy">
        <p className="lp-eyebrow" data-reveal>Weather-to-commodity intelligence</p>
        <h1 data-reveal>The weather <em>behind</em><br />the price.</h1>
        <p className="lp-lede" data-reveal>Astraeus combines seven global weather models, calibrates them against the reanalysis record and traces each physical shock to the commodity markets that feel it first — with every accuracy claim tested out of sample.</p>
        <div className="lp-actions" data-reveal>
          <a className="lp-btn primary" href="#globe" onClick={go('globe')}>Open the terminal <ArrowRight size={16} /></a>
          <a className="lp-btn" href="#report" onClick={go('report')}><FileText size={16} /> Read the technical report</a>
        </div>
        <p className="lp-wind-status" aria-live="polite">{wind == null ? 'Connecting to live NOAA GFS wind…' : wind.live ? <><i className="live" /> Live {wind.model} 10 m wind · valid {wind.validAt?.slice(11, 16)} UTC · 20° samples, interpolated</> : <><i /> Live wind unavailable — showing land and benchmark regions only</>}</p>
      </div>
      <div className="lp-hero-globe"><HeroGlobe sites={sites} onWindStatus={setWind} /></div>
      <dl className="lp-metrics" data-reveal>
        <div><dt>Global weather models</dt><dd><CountUp value={7} /></dd><small>incl. ECMWF’s AI model AIFS</small></div>
        <div><dt>Commodity regions verified</dt><dd><CountUp value={weather?.sites.length ?? 16} /></dd><small>corn belts to gas-demand hubs</small></div>
        <div><dt>Held-out forecasts scored</dt><dd><CountUp value={h?.cases ?? 0} /></dd><small>Apr–Nov 2026, scored once</small></div>
        <div><dt>Lower forecast error</dt><dd><CountUp value={(h?.tmax1?.crpssVsRawGauss ?? h?.tmax1?.crpssVsRaw ?? 0) * 100} decimals={0} suffix="%" /></dd><small>day-1 max temperature vs a no-training forecast</small></div>
      </dl>
    </section>

    <section className="lp-section lp-method" id="lp-method">
      <header className="lp-section-head" data-reveal>
        <p className="lp-eyebrow">How Astraeus forecasts</p>
        <h2>From seven models to one calibrated forecast.</h2>
      </header>
      <div className="lp-steps">
        <div className="lp-steps-text">
          {STEPS.map((s, i) => { const Icon = s.icon; return <article key={s.n} data-index={i} ref={(el) => { stepRefs.current[i] = el; }} className={step === i ? 'active' : ''}>
            <span className="lp-step-n">{s.n}</span><Icon size={20} /><h3>{s.title}</h3><p>{s.body}</p>
          </article>; })}
        </div>
        <div className="lp-steps-sticky"><StepVisual step={step} w={weather} /></div>
      </div>
    </section>

    <section className="lp-section lp-proof">
      <header className="lp-section-head" data-reveal>
        <p className="lp-eyebrow">Measured, not claimed</p>
        <h2>Tested on a held-out period — and independently reviewed.</h2>
        <p>The method was chosen on October 2025 – March 2026, frozen, then scored on April – November 2026 across sixteen commodity regions against ERA5 reanalysis. Temperature is compared with a no-training forecast built from the same models; rain with the raw ensemble. Every interval is a 95% block bootstrap. A strictly prospective test — forecasts for days after the freeze — will be scored as those forecasts verify.</p>
      </header>
      <div className="lp-proof-grid">
        <div className="lp-proof-numbers" data-reveal>
          {([[h?.tmax1, 'Max temperature · day 1', true], [h?.tmean1, 'Mean temperature · day 1', true], [h?.tmax7, 'Max temperature · day 7', true], [h?.precip1, 'Rainfall · day 1', false]] as any[]).map(([r, label, gauss]) => {
            const val = r ? (gauss && r.crpssVsRawGauss != null ? r.crpssVsRawGauss : r.crpssVsRaw) : null;
            const ci = r ? (gauss && r.crpssVsRawGaussCI ? r.crpssVsRawGaussCI : r.crpssVsRawCI) : null;
            return <div key={label}>
              <strong>{val != null ? <CountUp value={val * 100} decimals={1} suffix="%" /> : '—'}</strong>
              <span>{label}</span>
              <small>{r ? `lower CRPS vs ${gauss ? 'no-training forecast' : 'raw ensemble'} · 95% CI ${pct(ci[0], 1)} to ${pct(ci[1], 1)}` : ''}</small>
            </div>;
          })}
        </div>
        <div className="lp-proof-chart" data-reveal>
          {leadSeries.length ? <LineChart caption="Probabilistic error (CRPS, °C) of daily maximum temperature by forecast lead — lower is better" series={leadSeries} xFormat={(x) => LEAD_LABEL(x)} yFormat={(y) => y.toFixed(1)} xLabel="Lead" yLabel="CRPS (°C)" height={280} /> : null}
          <p className="lp-footnote">Temperature gains over a no-training forecast fall from about 15% at day 1 to 3–5% at day 7; rainfall gains over the raw ensemble are small (1–2%) but significant at every lead. These are grid-box scores (~30 km): against nearby weather stations the same forecasts gain only 1–5%, and training on station data is what restores about 11% at day 1. Since 16 November the live outlook runs v3, which widens v2’s slightly over-confident ranges (80% intervals now hold about 78% of outcomes, up from 75%); every day’s outlook is logged to a hash-chained track record and scored as it verifies. ERA5 verification favours ECMWF’s AIFS, which is trained on it. <a href="#accuracy" onClick={go('accuracy')}>Full skill report <ArrowUpRight size={12} /></a></p>
        </div>
      </div>
    </section>

    <section className="lp-section lp-price">
      <header className="lp-section-head" data-reveal>
        <p className="lp-eyebrow">From forecast to price</p>
        <h2>Weather moves prices — sometimes. We test which.</h2>
        <p>A walk-forward study (2008–2026) asks whether weather information improves out-of-sample forecasts of weekly futures returns beyond a market-only model. Almost always it does not: markets price weather fast. The one cell that survives correction — natural-gas forecasts at one week — beats the market-only model but not a simple no-change forecast, on 88 weeks of data. Astraeus treats it as a hypothesis to monitor, not a trading signal.</p>
      </header>
      <div data-reveal><PriceEvidence p={price} /></div>
      <p className="lp-footnote" data-reveal>Cells show out-of-sample R² gained over a market-only model; ● marks Benjamini–Hochberg q &lt; 0.10 (Clark–West test). Hover a cell for the test against a no-change forecast. Continuous front-month contracts contain roll jumps; results are research evidence, not trading advice.</p>
      {ng ? <div className="lp-storage" data-reveal>
        <div className="lp-storage-num"><strong><CountUp value={ng.skillMse * 100} decimals={0} suffix="%" /></strong><span>lower squared error, weekly US gas-storage change</span></div>
        <div className="lp-storage-copy">
          <h3>Where weather does forecast: the physical balance.</h3>
          <p>Raw GFS and ECMWF forecasts — not the calibrated outlook — issued before each week begins predict the weekly change in US natural-gas storage with {pct(ng.skillMse, 0)} lower squared error than the EIA five-year average over {ng.n} weeks (95% CI {pct(ng.ci[0], 0)} to {pct(ng.ci[1], 0)}){ngGfs ? `, and ${pct(ngGfs.skillMse, 0)} over ${ngGfs.n} weeks with GFS alone` : ''}. Most of the gain comes in winter. The study was pre-specified; analysts’ consensus forecasts were not available, so this is skill against naive benchmarks, not against the market.</p>
          <a href="#report" onClick={go('report')}>Read Section 4.11 <ArrowUpRight size={12} /></a>
        </div>
      </div> : null}
    </section>

    <section className="lp-section lp-research">
      <header className="lp-section-head" data-reveal>
        <p className="lp-eyebrow">Built on the literature</p>
        <h2>Every method has a citation. Every citation has a DOI.</h2>
      </header>
      <ResearchStrip />
    </section>

    <section className="lp-final" data-reveal>
      <ShieldCheck size={26} />
      <h2>Evidence before conviction.</h2>
      <p>Open the terminal to explore calibrated outlooks for 28 commodities across 160+ production, processing and demand regions — every number with its source, timestamp and hash.</p>
      <div className="lp-actions"><a className="lp-btn primary" href="#globe" onClick={go('globe')}>Open the terminal <ArrowRight size={16} /></a><a className="lp-btn" href="#accuracy" onClick={go('accuracy')}><Gauge size={16} /> Forecast skill</a><a className="lp-btn" href="#report" onClick={go('report')}><BookOpen size={16} /> Technical report</a></div>
    </section>
    <footer className="lp-footer"><span>ASTRAEUS · Forecast-driven commodity research</span><span>Weather data: ECMWF, NOAA, DWD, Met Office, JMA, ECCC via Open-Meteo · ERA5 © Copernicus · Natural Earth</span></footer>
  </div>;
}

function ResearchStrip() {
  const [refs, setRefs] = useState<Array<{ id: string; authors: string; year: number; title: string; venue: string; doi?: string; url: string; topic: string }>>([]);
  useEffect(() => { let live = true; void import('../../engine/researchLibrary').then((m) => live && setRefs((m.RESEARCH_LIBRARY as any[]).filter((r) => r.verified !== false))); return () => { live = false; }; }, []);
  if (!refs.length) return null;
  const topics: Record<string, string> = { postprocessing: 'Post-processing', verification: 'Verification', 'ml-weather': 'ML weather', reanalysis: 'Reanalysis', 'weather-commodity': 'Weather → prices', econometrics: 'Econometrics', visualisation: 'Visualisation' };
  // round-robin across topics so the strip shows the breadth of the evidence base
  const byTopic = new Map<string, typeof refs>();
  refs.forEach((r) => byTopic.set(r.topic, [...(byTopic.get(r.topic) ?? []), r]));
  const mixed: typeof refs = [];
  for (let i = 0; mixed.length < Math.min(28, refs.length); i++) for (const list of byTopic.values()) if (list[i] && mixed.length < 28) mixed.push(list[i]);
  const row = mixed;
  return <div className="lp-marquee" aria-label="Selected references">
    <div className="lp-marquee-track">
      {[...row, ...row].map((r, i) => <a key={`${r.id}-${i}`} href={r.doi ? `https://doi.org/${r.doi}` : r.url} target="_blank" rel="noreferrer" aria-hidden={i >= row.length} tabIndex={i >= row.length ? -1 : 0}>
        <small>{topics[r.topic] ?? r.topic}</small>
        <strong>{r.title}</strong>
        <span>{r.authors.split(',')[0].replace(/\s+et al\.?$/, '')}{r.authors.includes(',') ? ' et al.' : ''} · {r.venue} · {r.year}</span>
      </a>)}
    </div>
  </div>;
}
