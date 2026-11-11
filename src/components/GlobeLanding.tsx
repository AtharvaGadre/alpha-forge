import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, Compass, CloudRain, Wind, Play, Pause, RefreshCw, Globe2, Layers3, Loader2, Maximize2, Minus, Plus, Radar, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { GlobeCanvas, type CommodityGlobeOverlay, type GlobeWeatherOverlay } from './globe/GlobeCanvas';
import { atmosphereStore } from '../state/atmosphereStore';
import { COMMODITIES, SECTORS, type CommodityDefinition, type CommodityForecast } from '../engine/commodityForecastEngine';
import { linksForCommodity } from '../engine/commodityTransmissionEngine';

import type { GlobeWeatherField } from '../engine/liveGlobeWeather';

const captions: Record<CommodityForecast['status'], string> = { UPWARD_PRESSURE: 'Upward conditional pressure', DOWNWARD_PRESSURE: 'Downward conditional pressure', MIXED: 'Mixed physical drivers', NO_MATERIAL_SIGNAL: 'No material seasonal signal', INSUFFICIENT_EVIDENCE: 'Insufficient directional evidence' };
const pressureColor = (r?: CommodityForecast) => !r ? '#8495a0' : r.status === 'UPWARD_PRESSURE' ? '#83c1a2' : r.status === 'DOWNWARD_PRESSURE' ? '#e5a08d' : r.status === 'MIXED' ? '#dfbf7e' : '#9aaab5';
interface Props {
  commodity: CommodityDefinition; regionId: string; results: Record<string, CommodityForecast>;
  pending: Record<string, boolean>; errors: Record<string, string>;
  onSelect: (commodityId: string, regionId: string) => void;
  onRun: () => Promise<void>; onMarkets: () => void; onLab: () => void;
}
export function GlobeLanding({ commodity, regionId, results, pending, errors, onSelect, onRun, onMarkets, onLab }: Props) {
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('All sectors');
  const [layer, setLayer] = useState<'REGIONS' | 'FORECASTS'>('REGIONS');
  const [weather,setWeather] = useState<GlobeWeatherField|null>(null);
  const [weatherLoading,setWeatherLoading] = useState(true);
  const [weatherError,setWeatherError] = useState('');
  const [weatherReload,setWeatherReload] = useState(0);
  const [showWind,setShowWind] = useState(true);
  const [showRain,setShowRain] = useState(true);
  const [frameIndex,setFrameIndex] = useState(0);
  const [playing,setPlaying] = useState(false);
  const [opacity,setOpacity] = useState(.55);
  const [reduceMotion,setReduceMotion] = useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>{setReduceMotion(media.matches);if(media.matches)setPlaying(false);};update();
    media.addEventListener('change',update);return()=>media.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setWeatherLoading(true);setWeatherError('');setPlaying(false);
    const timeout=window.setTimeout(()=>controller.abort(),60_000);
    void (async()=>{
      try {
        const response=await fetch('/api/v1/weather/globe',{signal:controller.signal});const data=await response.json();
        if(!response.ok)throw new Error(data.error || 'Weather layers unavailable.');
        if(data.version!=='live-globe-weather-v1'||!Array.isArray(data.frames)||!data.frames.length||!data.inputSha256)throw new Error('Weather response could not be verified.');
        if(active){setWeather(data);setFrameIndex(0);}
      }catch(error){if(active){setWeather(null);setWeatherError(error instanceof Error && error.name==='AbortError'?'Weather request timed out. Retry to load the layers.':error instanceof Error?error.message:'Weather layers unavailable.');}}
      finally{clearTimeout(timeout);if(active)setWeatherLoading(false);}
    })();
    return()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[weatherReload]);
  useEffect(()=>{
    if(!playing||!weather||reduceMotion)return;
    const timer=window.setInterval(()=>setFrameIndex(i=>Math.min(i+1,weather.frames.length-1)),1400);
    return()=>clearInterval(timer);
  },[playing,weather,reduceMotion]);
  useEffect(()=>{if(weather&&frameIndex>=weather.frames.length-1)setPlaying(false);},[frameIndex,weather]);
  const weatherFrame=weather?.frames[frameIndex];
  const rainCount=weatherFrame?.samples.filter(s=>s.precipitationMm!=null).length??0;
  const windCount=weatherFrame?.samples.filter(s=>s.windMs!=null&&s.windFromDeg!=null).length??0;
  const weatherOverlay: GlobeWeatherOverlay|undefined=useMemo(()=>weatherFrame?{frame:weatherFrame,wind:showWind,precipitation:showRain,opacity,animateWind:!reduceMotion}:undefined,[weatherFrame,showWind,showRain,opacity,reduceMotion]);
  const region = commodity.regions.find(r => r.id === regionId) ?? commodity.regions[0];
  const key = `${commodity.id}:${region.id}`;
  const result = results[key];
  const links = linksForCommodity(commodity.id);
  const exposures = useMemo(() => COMMODITIES.flatMap(c => c.regions.map(r => ({ commodity: c, region: r, key: `${c.id}:${r.id}` }))), []);
  const visible = useMemo(() => exposures.filter(e => (sector === 'All sectors' || e.commodity.sector === sector) && `${e.commodity.name} ${e.commodity.symbol} ${e.region.name}`.toLowerCase().includes(search.toLowerCase())), [exposures, sector, search]);
  const focus = (lat = region.lat, lng = region.lng) => {
    atmosphereStore.setState({ cameraPose: { ...atmosphereStore.getState().cameraPose, lat, lng, altitudeMeters: 15_000_000, pitchDeg: -88, headingDeg: 0 } });
  };
  useEffect(() => { focus(); }, [commodity.id, region.id]);
  const overlay: CommodityGlobeOverlay = useMemo(() => ({
    points: visible.map(e => ({ key: e.key, label: `${e.commodity.name} · ${e.region.name.split(' · ')[0]}`, lat: e.region.lat, lng: e.region.lng, color: layer === 'FORECASTS' ? pressureColor(results[e.key]) : e.key === key ? '#f4c08c' : '#84b6b1' })),
    selectedKey: key,
    onSelect: selectedKey => { const e = exposures.find(e => e.key === selectedKey); if (e) onSelect(e.commodity.id, e.region.id); },
  }), [visible, key, layer, results, onSelect, exposures]);
  const zoom = (factor: number) => {
    const current = atmosphereStore.getState().cameraPose;
    atmosphereStore.setState({ cameraPose: { ...current, altitudeMeters: Math.max(4_000_000, Math.min(24_000_000, current.altitudeMeters * factor)) } });
  };
  const keyboard = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    const current = atmosphereStore.getState().cameraPose;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();
      atmosphereStore.setState({ cameraPose: { ...current, lat: Math.max(-78,Math.min(78,current.lat+(event.key === 'ArrowUp' ? 8 : event.key === 'ArrowDown' ? -8 : 0))), lng: ((current.lng+(event.key === 'ArrowRight' ? 12 : event.key === 'ArrowLeft' ? -12 : 0)+540)%360)-180 } });
    } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(.8); }
    else if (event.key === '-') { event.preventDefault(); zoom(1.25); }
  };
  const analyzed = Object.keys(results).length;
  return <section className="af-globe-landing" aria-label="Global forecast explorer">
    <div className="af-earth-heading"><div><span className="af-eyebrow">GLOBAL FORECAST INTELLIGENCE</span><h1>The world behind the market.</h1><p>Explore the regions, follow the forecast and uncover the connections.</p></div><button className="af-button af-outline" onClick={onMarkets}>Explore commodities <ArrowRight size={15} /></button></div>
    <div className="af-earth-toolbar"><label className="af-earth-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a commodity or production region…" aria-label="Search globe regions" /></label><div className="af-earth-filters" aria-label="Globe sector filters">{['All sectors', ...SECTORS].map(s => <button key={s} className={s === sector ? 'active' : ''} aria-pressed={s === sector} onClick={() => setSector(s)}>{s}</button>)}</div></div>
    <div className="af-earth-workspace"><div className="af-earth-stage" tabIndex={0} onKeyDown={keyboard} role="region" aria-label="Interactive globe. Drag to rotate, scroll to zoom, or use arrow keys and plus or minus. Choose labelled regions from the list below.">
      <GlobeCanvas commodityOverlay={overlay} weatherOverlay={weatherOverlay} />
      <div className="af-earth-map-title"><span className="af-live-dot" /> GLOBAL COVERAGE<small>{visible.length} regional exposures · {COMMODITIES.length} commodities</small></div>
      <div className="af-earth-layers" aria-label="Map display layer"><button className={layer === 'REGIONS' ? 'active' : ''} aria-pressed={layer === 'REGIONS'} onClick={() => setLayer('REGIONS')}><Globe2 size={13} /> Regions</button><button className={layer === 'FORECASTS' ? 'active' : ''} aria-pressed={layer === 'FORECASTS'} onClick={() => setLayer('FORECASTS')}><Layers3 size={13} /> Forecast signals</button></div>
      <div className="af-weather-layer-controls" aria-label="Weather layers"><button className={showWind?'active':''} aria-pressed={showWind} onClick={()=>setShowWind(v=>!v)}><Wind size={14}/>Wind</button><button className={showRain?'active':''} aria-pressed={showRain} onClick={()=>setShowRain(v=>!v)}><CloudRain size={14}/>Precipitation</button><button aria-label="Refresh weather grid" title="Refresh weather grid" disabled={weatherLoading} onClick={()=>setWeatherReload(v=>v+1)}><RefreshCw size={13} className={weatherLoading?'af-spin':''}/></button></div>
      <div className="af-weather-status" role="status">{weatherLoading?<><Loader2 size={12} className="af-spin"/>Loading real weather forecasts…</>:weatherError?<><span>Weather unavailable</span><button onClick={()=>setWeatherReload(v=>v+1)}>Retry</button></>:weather?<><span className="af-live-dot"/>NOAA GFS · via Open-Meteo <small>{rainCount}/{weather.totalPoints} rain · {windCount}/{weather.totalPoints} wind samples · 20° grid</small></>:null}</div>
      <div className="af-earth-controls"><button aria-label="Zoom globe in" title="Zoom in" onClick={() => zoom(.8)}><Plus size={17} /></button><button aria-label="Zoom globe out" title="Zoom out" onClick={() => zoom(1.25)}><Minus size={17} /></button><button aria-label="Focus selected region" title="Focus selected region" onClick={() => focus()}><Compass size={17} /></button><button aria-label="Reset global globe view" title="Global view" onClick={() => focus(12,-25)}><Maximize2 size={16} /></button></div>
      <div className="af-earth-legend">{layer === 'REGIONS' ? <><i style={{ background: '#84b6b1' }} /> Mapped sample region <i style={{ background: '#f4c08c' }} /> Selected</> : <><i style={{ background: '#83c1a2' }} /> Upward <i style={{ background: '#e5a08d' }} /> Downward <i style={{ background: '#dfbf7e' }} /> Mixed <i style={{ background: '#8495a0' }} /> No direction / not analysed</>}</div>
      <div className="af-weather-timeline">
        <div className="af-weather-time-heading"><button aria-label={playing?'Pause forecast timeline':'Play forecast timeline'} disabled={!weather||reduceMotion} onClick={()=>{if(!playing&&frameIndex===(weather?.frames.length??0)-1)setFrameIndex(0);setPlaying(v=>!v);}}>{playing?<Pause size={14}/>:<Play size={14}/>}</button><strong>{weatherFrame?`${weatherFrame.validAtUtc.slice(0,16).replace('T',' ')} UTC`:'Forecast time unavailable'}</strong><span>{frameIndex===0?'Current forecast hour':`+${frameIndex*3}h`}</span></div>
        <input aria-label="Weather forecast hour" type="range" min={0} max={(weather?.frames.length??25)-1} value={frameIndex} disabled={!weather} onChange={e=>{setPlaying(false);setFrameIndex(Number(e.target.value));}}/>
        <div className="af-weather-time-ticks"><span>Now</span><span>+24h</span><span>+48h</span><span>+72h</span></div>
        <div className="af-weather-scales">{showRain&&<div><span>Precipitation · mm / preceding hour</span><i className="af-rain-scale"/><small>0.05 · 0.5 · 2 · 5 · 10+</small></div>}{showWind&&<div><span>10 m wind · m/s · flowing streamlines</span><i className="af-wind-scale"/><small>0.25 · 8 · 15+</small></div>}<label>Opacity<input aria-label="Weather layer opacity" type="range" min={.1} max={.9} step={.05} value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label></div>
      </div>
      {!visible.length && <div className="af-earth-no-match">No mapped regions match this search.<button onClick={() => { setSearch(''); setSector('All sectors'); }}>Reset filters</button></div>}
    </div><aside className="af-earth-inspector" aria-label="Selected region forecast">
      <div className="af-eyebrow">SELECTED EXPOSURE</div><h2>{commodity.name}</h2><span className="af-earth-symbol">{commodity.symbol} · {commodity.sector}</span>
      <label className="af-earth-region-label">Production / demand region<select value={region.id} onChange={e => onSelect(commodity.id,e.target.value)} aria-label="Globe selected commodity region">{commodity.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <div className="af-earth-coordinates"><Globe2 size={13} />{region.lat.toFixed(2)}°, {region.lng.toFixed(2)}°<span>7-day forecast</span></div>
      <div className="af-earth-outlook"><div className="af-label">FORECAST OUTLOOK</div><strong>{result ? captions[result.status] : 'Ready for live analysis'}</strong><p>{result?.headline ?? 'Retrieve the regional weather outlook and compare it with seasonal climatology.'}</p>{result && <small>Source snapshot {new Date(result.sourceGeneratedAtUtc).toUTCString()}</small>}</div>
      <button className="af-button af-earth-run" disabled={pending[key]} onClick={() => void onRun()}>{pending[key] ? <Loader2 size={15} className="af-spin" /> : <Radar size={15} />}{pending[key] ? 'Analysing region…' : result ? 'Refresh forecast' : 'Run regional forecast'}<ArrowRight size={14} /></button>
      {pending[key] && <p className="af-note" role="status">Comparing models and climatology. This can take a minute.</p>}
      {errors[key] && <div className="af-error" role="alert">{errors[key]}{result && <p>Previous snapshot remains shown.</p>}</div>}
      <div className="af-earth-driver-list">{result ? result.drivers.map(d => <div key={d.label}><span>{d.label}</span><strong>{d.zScore == null ? 'Unavailable' : `${d.zScore > 0 ? '+' : ''}${d.zScore.toFixed(1)}σ`}</strong></div>) : commodity.rules.map(r => <div key={r.kind}><span>{r.label}</span><small>Awaiting data</small></div>)}</div>
      <div className="af-earth-actions"><button onClick={onMarkets}>Commodity details <ChevronRight size={14} /></button><button onClick={onLab}>Connected markets & forecast lab <ChevronRight size={14} /></button></div>
      <details className="af-weather-provenance"><summary>Weather layer source & coverage</summary>{weather?<><p>{weather.provider} · {weather.model}</p><p>Retrieved: {new Date(weather.fetchedAtUtc).toUTCString()}</p><p>Model run: {weather.modelInitializedAtUtc?new Date(weather.modelInitializedAtUtc).toUTCString():'Initialization unavailable'}</p>{weather.warnings.map(w=><p key={w}>{w}</p>)}<p>Streamlines follow the interpolated forecast wind field. Their animated speed is illustrative, not a travel-time contour or real-time particle trajectory.</p><code>SHA-256 {weather.inputSha256.slice(0,20)}…</code><a href="https://open-meteo.com/en/docs/gfs-api" target="_blank" rel="noreferrer">Open-Meteo / NOAA GFS documentation</a></>:<p>{weatherError||'Loading forecast source metadata…'}</p>}</details>
      <div className="af-earth-context"><SlidersHorizontal size={15} /><span>{links.incoming.length} upstream · {links.outgoing.length} downstream channels<small>Conditional mechanisms, not measured price elasticities.</small></span></div>
    </aside></div>
    <div className="af-earth-regions-heading"><div><span className="af-eyebrow">EXPLORE REGIONAL EXPOSURES</span><p>Select a card or a globe marker to focus the map.</p></div><span>{analyzed} analysed this session</span></div>
    <div className="af-earth-region-cards" aria-label="Mapped commodity regions">{visible.map(e => <button key={e.key} className={e.key === key ? 'selected' : ''} aria-pressed={e.key === key} onClick={() => onSelect(e.commodity.id,e.region.id)}><span>{e.commodity.sector}</span><strong>{e.commodity.name}<ArrowRight size={12} /></strong><small>{e.region.name}</small><div><i style={{ background: pressureColor(results[e.key]) }} />{results[e.key] ? captions[results[e.key].status] : 'Not analysed'}</div></button>)}</div>
    <div className="af-earth-bottom"><ShieldCheck size={15} /><span>Weather layers show coarse GFS forecast samples, not observations. Commodity marker colours remain separate from precipitation and wind.</span><button onClick={onLab}>Open forecast lab <ArrowRight size={13} /></button></div>
  </section>;
}
