import React, { useState } from 'react';
import { ArrowUpRight, CloudRain, Thermometer } from 'lucide-react';
import type { CalibratedOutlook, OutlookBand } from '../engine/calibratedOutlook';

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
const n1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');

/** Calibrated seven-day outlook: 80 % intervals, medians and event probabilities from the live Astraeus method (v3 since 16 Nov 2026). */
export function CalibratedOutlookPanel({ outlook, onSkill }: { outlook: CalibratedOutlook; onSkill?: () => void }) {
  const [variable, setVariable] = useState<'tmax' | 'tmean' | 'precip'>('tmax');
  const bands = outlook.days.map((d) => d[variable]).filter((b): b is OutlookBand => !!b);
  if (!bands.length) return null;
  const lo = Math.min(...bands.map((b) => Math.min(b.p10, b.rawMin)));
  const hi = Math.max(...bands.map((b) => Math.max(b.p90, b.rawMax)));
  const span = Math.max(1e-6, hi - lo);
  const x = (v: number) => `${((v - lo) / span) * 100}%`;
  const unit = variable === 'precip' ? 'mm' : '°C';
  const checks = outlook.heldOut.filter((h) => h.variable === variable);
  const isRain = variable === 'precip';
  return <section className="as-outlook" aria-label="Calibrated seven-day outlook">
    <header>
      <div><span className="af-label">CALIBRATED 7-DAY OUTLOOK</span><h3>{isRain ? 'Daily rainfall' : variable === 'tmax' ? 'Daily maximum temperature' : 'Daily mean temperature'}</h3></div>
      <div className="as-outlook-switch" role="group" aria-label="Variable">
        {([['tmax', 'Max temp'], ['tmean', 'Mean temp'], ['precip', 'Rain']] as const).map(([id, label]) => <button key={id} aria-pressed={variable === id} onClick={() => setVariable(id)}>{id === 'precip' ? <CloudRain size={13} /> : <Thermometer size={13} />}{label}</button>)}
      </div>
    </header>
    <ol className="as-outlook-days">
      {outlook.days.map((d) => {
        const b = d[variable];
        if (!b) return <li key={d.date} className="missing"><span>{weekday(d.date)}</span><small>No complete model set</small></li>;
        return <li key={d.date} title={`${d.date}: 80% interval ${n1(b.p10)}–${n1(b.p90)} ${unit}, median ${n1(b.p50)}; raw models ${n1(b.rawMin)}–${n1(b.rawMax)} ${unit}${b.prob != null ? `; ${isRain ? 'P(≥1 mm)' : 'P(≥32 °C)'} ${Math.round(b.prob * 100)}%` : ''}`}>
          <span className="as-day">{weekday(d.date)}<small>{d.date.slice(5)}</small></span>
          <span className="as-range" aria-hidden="true">
            <i className="raw" style={{ left: x(b.rawMin), width: `calc(${x(b.rawMax)} - ${x(b.rawMin)})` }} />
            <i className="band" style={{ left: x(b.p10), width: `calc(${x(b.p90)} - ${x(b.p10)})` }} />
            <i className="median" style={{ left: x(b.p50) }} />
          </span>
          <span className="as-values"><b>{n1(b.p50)}</b><small>{n1(b.p10)}–{n1(b.p90)} {unit}</small></span>
          {b.prob != null && <span className={`as-prob ${b.prob >= 0.5 ? 'high' : ''}`}><b>{Math.round(b.prob * 100)}%</b><small>{isRain ? '≥ 1 mm' : '≥ 32 °C'}</small></span>}
          {!b.calibrated && <span className="as-uncal">raw</span>}
        </li>;
      })}
    </ol>
    <p className="as-outlook-legend"><i className="band" /> Astraeus 80% interval <i className="median" /> median <i className="raw" /> spread of {bands[0].members} raw models</p>
    <p className="as-outlook-scope">Values are averages over the region’s ~30 km reanalysis grid boxes (ERA5), not readings at one weather station. At individual stations the ranges are too narrow; see the technical report, Section 4.9.</p>
    {checks.length > 0 && <details className="as-outlook-check">
      <summary>Local held-out check for this region ({checks.map((c) => `day ${c.lead}: ${c.skill >= 0 ? '+' : ''}${Math.round(c.skill * 100)}%`).join(' · ')})</summary>
      <p>{outlook.heldOutDesign === 'rolling' ? <>The newer half of the {outlook.trainingDates.start} → {outlook.trainingDates.end} window is forecast as the live outlook would have been: refitted weekly, using only outcomes known at the time</> : <>Calibration fitted once on the older half of the {outlook.trainingDates.start} → {outlook.trainingDates.end} window and scored on the newer half, up to ~45 days stale, so it understates skill when biases shift with the season</>} (CRPS vs the raw ensemble, positive = better). With about six weeks of test days per lead the check is noisy; the population-level evidence is the 16-region benchmark.{checks.some((c) => c.skill < 0) ? ' Negative values mean calibration did worse than the raw models here recently, which happens when model biases shift with the season faster than a trailing window can learn them; treat this region’s ranges with extra caution.' : ''}</p>
      <table><thead><tr><th>Lead</th><th>Max train / test days</th><th>CRPS raw</th><th>CRPS calibrated</th><th>Skill</th></tr></thead><tbody>
        {checks.map((c) => <tr key={c.lead}><td>Day {c.lead}</td><td>{c.nTrain} / {c.nTest}</td><td>{c.crpsRaw}</td><td>{c.crpsCalibrated}</td><td className={c.skill >= 0 ? 'pos' : 'neg'}>{c.skill >= 0 ? '+' : ''}{Math.round(c.skill * 100)}%</td></tr>)}
      </tbody></table>
    </details>}
    <footer><span>{outlook.version === 'astraeus-v3' ? 'Astraeus v3' : outlook.version === 'astraeus-v2' ? 'Astraeus v2' : outlook.version} · {outlook.models.length} models · trained {outlook.trainingDates.start} → {outlook.trainingDates.end} vs ERA5</span>{onSkill && <button className="af-text-button" onClick={onSkill}>How accurate is this? <ArrowUpRight size={12} /></button>}</footer>
  </section>;
}
