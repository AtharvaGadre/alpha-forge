/**
 * Small, dependency-free SVG chart kit for Astraeus.
 * Colours come from CSS custom properties (--viz-1…3, --viz-ref) validated for both themes with the
 * data-viz palette checker; identity is never colour-only (legend + direct labels + dash for references).
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

/** Width of the plot container, so SVG text renders at true pixel size on every screen. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const cw = Math.round(e.contentRect.width); if (cw > 0) setW(Math.max(300, cw)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface SeriesPoint { x: number; y: number | null }
export interface LineSeries { id: string; label: string; color: string; dashed?: boolean; points: SeriesPoint[]; emphasis?: boolean }

const fmt = (v: number, digits = 2) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(digits));

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return <ul className="viz-legend">{items.map((i) => <li key={i.label}><svg width="22" height="8" aria-hidden="true"><line x1="1" x2="21" y1="4" y2="4" stroke={i.color} strokeWidth="2.5" strokeDasharray={i.dashed ? '4 3' : undefined} strokeLinecap="round" /></svg>{i.label}</li>)}</ul>;
}

/** Multi-series line chart with crosshair tooltip and end-of-line direct labels. */
export function LineChart({ series, height = 260, xLabel, yLabel, xFormat = (x) => String(x), yFormat = (y) => fmt(y), yDomain, zeroLine, caption, directLabels = true }: {
  series: LineSeries[]; height?: number; xLabel?: string; yLabel?: string; xFormat?: (x: number) => string; yFormat?: (y: number) => string;
  yDomain?: [number, number]; zeroLine?: boolean; caption?: string; directLabels?: boolean;
}) {
  const [box, width] = useWidth(640);
  const showDirect = directLabels && width >= 520;
  const m = { top: 16, right: showDirect ? 132 : 18, bottom: 40, left: 52 };
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b), [series]);
  const ys = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y !== null && Number.isFinite(y)));
  const [y0, y1] = yDomain ?? [Math.min(...ys, zeroLine ? 0 : Infinity), Math.max(...ys, zeroLine ? 0 : -Infinity)];
  const pad = (y1 - y0) * 0.08 || 1;
  const lo = yDomain ? y0 : y0 - pad;
  const hi = yDomain ? y1 : y1 + pad;
  const sx = (x: number) => m.left + ((x - xs[0]) / Math.max(1e-9, xs[xs.length - 1] - xs[0])) * (width - m.left - m.right);
  const sy = (y: number) => m.top + (1 - (y - lo) / (hi - lo)) * (height - m.top - m.bottom);
  const yt = niceTicks(lo, hi, 5);
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const titleId = useId();
  const onMove = (e: React.PointerEvent) => {
    const svg = ref.current;
    if (!svg || !xs.length) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    let best = 0;
    xs.forEach((x, i) => { if (Math.abs(sx(x) - px) < Math.abs(sx(xs[best]) - px)) best = i; });
    setHover(best);
  };
  // direct labels: last finite point, nudged apart vertically
  const ends = series.map((s) => { const p = [...s.points].reverse().find((q) => q.y !== null && Number.isFinite(q.y)); return p ? { s, y: sy(p.y as number) } : null; }).filter(Boolean) as Array<{ s: LineSeries; y: number }>;
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  const hx = hover !== null ? xs[hover] : null;
  return <figure className="viz-figure">
    {caption && <figcaption id={titleId}>{caption}</figcaption>}
    <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
    <div className="viz-plot" ref={box}>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={caption ? titleId : undefined} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {yt.map((t) => <g key={t}><line className="viz-grid" x1={m.left} x2={width - m.right} y1={sy(t)} y2={sy(t)} /><text className="viz-tick" x={m.left - 8} y={sy(t) + 4} textAnchor="end">{yFormat(t)}</text></g>)}
        {zeroLine && lo < 0 && hi > 0 && <line className="viz-zero" x1={m.left} x2={width - m.right} y1={sy(0)} y2={sy(0)} />}
        {xs.map((x) => <text key={x} className="viz-tick" x={sx(x)} y={height - m.bottom + 18} textAnchor="middle">{xFormat(x)}</text>)}
        {xLabel && <text className="viz-axis-label" x={(m.left + width - m.right) / 2} y={height - 4} textAnchor="middle">{xLabel}</text>}
        {yLabel && <text className="viz-axis-label" transform={`translate(12 ${(m.top + height - m.bottom) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>}
        {series.map((s) => {
          const pts = s.points.filter((p) => p.y !== null && Number.isFinite(p.y));
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y as number).toFixed(1)}`).join('');
          return <g key={s.id} className="viz-series">
            <path d={d} fill="none" stroke={s.color} strokeWidth={s.emphasis ? 2.6 : 2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y as number)} r={hx === p.x ? 5 : 3.2} fill={s.color} stroke="var(--viz-surface)" strokeWidth="2" />)}
          </g>;
        })}
        {showDirect && ends.map(({ s, y }) => <text key={s.id} className="viz-direct" x={width - m.right + 10} y={y + 4}>{s.label.length > 18 ? `${s.label.slice(0, 17)}…` : s.label}</text>)}
        {hx !== null && <line className="viz-crosshair" x1={sx(hx)} x2={sx(hx)} y1={m.top} y2={height - m.bottom} />}
        <rect x={m.left} y={m.top} width={width - m.left - m.right} height={height - m.top - m.bottom} fill="transparent" />
      </svg>
      {hx !== null && <div className="viz-tooltip" style={{ left: `${(sx(hx) / width) * 100}%` }}>
        <strong>{xLabel ? `${xLabel}: ` : ''}{xFormat(hx)}</strong>
        {series.map((s) => { const p = s.points.find((q) => q.x === hx); return p && p.y !== null ? <span key={s.id}><i style={{ background: s.color }} />{s.label}<b>{yFormat(p.y)}</b></span> : null; })}
      </div>}
    </div>
  </figure>;
}

/** Horizontal bars (HTML) — readable labels, tabular numbers, one highlighted row. */
export function BarList({ rows, format = (v) => fmt(v), caption, unit }: { rows: Array<{ label: string; value: number; note?: string; highlight?: boolean }>; format?: (v: number) => string; caption?: string; unit?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1e-9);
  return <figure className="viz-figure viz-barlist">
    {caption && <figcaption>{caption}</figcaption>}
    <ol>{rows.map((r) => <li key={r.label} className={r.highlight ? 'highlight' : ''} title={`${r.label}: ${format(r.value)}${unit ? ` ${unit}` : ''}`}>
      <span className="viz-bar-label">{r.label}{r.note && <small>{r.note}</small>}</span>
      <span className="viz-bar-track"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
      <span className="viz-bar-value">{format(r.value)}{unit && <small> {unit}</small>}</span>
    </li>)}</ol>
  </figure>;
}

/** Reliability diagram for event probabilities; marker area ∝ forecast count. */
export function ReliabilityDiagram({ series, caption }: { series: Array<{ label: string; color: string; bins: Array<{ p: number | null; o: number | null; n: number }> }>; caption?: string }) {
  const size = 300;
  const m = 36;
  const s = (v: number) => m + v * (size - 2 * m);
  const [hover, setHover] = useState<string | null>(null);
  const total = Math.max(1, ...series.flatMap((x) => x.bins.map((b) => b.n)));
  return <figure className="viz-figure viz-reliability">
    {caption && <figcaption>{caption}</figcaption>}
    <Legend items={[...series.map((x) => ({ label: x.label, color: x.color })), { label: 'Perfect reliability', color: 'var(--viz-ref)', dashed: true }]} />
    <div className="viz-plot">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Reliability diagram: forecast probability against observed frequency">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line className="viz-grid" x1={s(0)} x2={s(1)} y1={size - s(t)} y2={size - s(t)} /><text className="viz-tick" x={m - 6} y={size - s(t) + 4} textAnchor="end">{t}</text><text className="viz-tick" x={s(t)} y={size - m + 16} textAnchor="middle">{t}</text></g>)}
        <line x1={s(0)} y1={size - s(0)} x2={s(1)} y2={size - s(1)} stroke="var(--viz-ref)" strokeDasharray="5 4" strokeWidth="1.5" />
        {series.map((x) => {
          const pts = x.bins.filter((b) => b.n > 0 && b.p !== null && b.o !== null);
          return <g key={x.label}>
            <path d={pts.map((b, i) => `${i ? 'L' : 'M'}${s(b.p!)},${size - s(b.o!)}`).join('')} fill="none" stroke={x.color} strokeWidth="2" />
            {pts.map((b) => { const key = `${x.label}-${b.p}`; return <circle key={key} cx={s(b.p!)} cy={size - s(b.o!)} r={3 + 6 * Math.sqrt(b.n / total)} fill={x.color} fillOpacity={hover === key ? 1 : 0.75} stroke="var(--viz-surface)" strokeWidth="2" onPointerEnter={() => setHover(key)} onPointerLeave={() => setHover(null)}><title>{`${x.label}: forecast ${(b.p! * 100).toFixed(0)}% → observed ${(b.o! * 100).toFixed(0)}% (n = ${b.n})`}</title></circle>; })}
          </g>;
        })}
        <text className="viz-axis-label" x={size / 2} y={size - 4} textAnchor="middle">Forecast probability</text>
        <text className="viz-axis-label" transform={`translate(10 ${size / 2}) rotate(-90)`} textAnchor="middle">Observed frequency</text>
      </svg>
    </div>
  </figure>;
}

/** PIT histogram: a flat histogram at the dashed line means a calibrated forecast. */
export function PitHistogram({ bins, label, color }: { bins: number[]; label: string; color: string }) {
  const w = 220;
  const h = 110;
  const max = Math.max(0.2, ...bins);
  const bw = (w - 20) / bins.length;
  return <figure className="viz-figure viz-pit">
    <figcaption>{label}</figcaption>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`PIT histogram, ${label}`}>
      {bins.map((b, i) => <rect key={i} x={10 + i * bw + 1} width={bw - 2} y={h - 16 - (b / max) * (h - 26)} height={(b / max) * (h - 26)} rx="2" fill={color}><title>{`PIT ${(i / bins.length).toFixed(1)}–${((i + 1) / bins.length).toFixed(1)}: ${(b * 100).toFixed(1)}% of cases (calibrated = 10%)`}</title></rect>)}
      <line x1="10" x2={w - 10} y1={h - 16 - (0.1 / max) * (h - 26)} y2={h - 16 - (0.1 / max) * (h - 26)} stroke="var(--viz-ref)" strokeDasharray="4 3" />
      <line className="viz-grid" x1="10" x2={w - 10} y1={h - 16} y2={h - 16} />
      <text className="viz-tick" x="10" y={h - 3}>0</text><text className="viz-tick" x={w - 10} y={h - 3} textAnchor="end">1</text>
    </svg>
  </figure>;
}

export interface FanDay { date: string; truth: number; p10: number; p50: number; p90: number; members: Record<string, number> }

/** Calibrated band (p10–p90) with median, raw model forecasts as faint ticks and ERA5 truth as dots. */
export function FanChart({ days, unit, caption, height = 280, memberLabel = 'Raw models', bandLabel = 'Astraeus 80% interval' }: { days: FanDay[]; unit: string; caption?: string; height?: number; memberLabel?: string; bandLabel?: string }) {
  const [box, width] = useWidth(720);
  const m = { top: 14, right: 16, bottom: 34, left: 46 };
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (!days.length) return null;
  const all = days.flatMap((d) => [d.truth, d.p10, d.p90, ...Object.values(d.members)]).filter(Number.isFinite);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.06 || 1;
  const sx = (i: number) => m.left + (i / Math.max(1, days.length - 1)) * (width - m.left - m.right);
  const sy = (v: number) => m.top + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (height - m.top - m.bottom);
  const band = `${days.map((d, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(d.p90)}`).join('')}${[...days].reverse().map((d, j) => `L${sx(days.length - 1 - j)},${sy(d.p10)}`).join('')}Z`;
  const ticks = niceTicks(lo, hi, 4);
  const inside = days.filter((d) => d.truth >= d.p10 && d.truth <= d.p90).length;
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * width;
    setHover(Math.max(0, Math.min(days.length - 1, Math.round(((px - m.left) / (width - m.left - m.right)) * (days.length - 1)))));
  };
  const hd = hover !== null ? days[hover] : null;
  return <figure className="viz-figure viz-fan">
    {caption && <figcaption>{caption}</figcaption>}
    <Legend items={[{ label: bandLabel, color: 'var(--viz-1)' }, { label: 'Astraeus median', color: 'var(--viz-1)' }, { label: memberLabel, color: 'var(--viz-ref)', dashed: true }, { label: 'ERA5 observed', color: 'var(--viz-ink)' }]} />
    <div className="viz-plot" ref={box}>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${caption ?? 'Forecast fan chart'}; ${inside} of ${days.length} observations inside the 80% interval`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line className="viz-grid" x1={m.left} x2={width - m.right} y1={sy(t)} y2={sy(t)} /><text className="viz-tick" x={m.left - 8} y={sy(t) + 4} textAnchor="end">{fmt(t, 0)}</text></g>)}
        {days.map((d, i) => (i % Math.ceil(days.length / Math.max(3, Math.floor(width / 110))) === 0 ? <text key={d.date} className="viz-tick" x={sx(i)} y={height - 12} textAnchor="middle">{d.date.slice(5)}</text> : null))}
        <path d={band} fill="var(--viz-1)" fillOpacity="0.2" />
        {days.map((d, i) => Object.values(d.members).map((v, j) => <line key={`${i}-${j}`} x1={sx(i) - 2.5} x2={sx(i) + 2.5} y1={sy(v)} y2={sy(v)} stroke="var(--viz-ref)" strokeWidth="1.2" opacity="0.7" />))}
        <path d={days.map((d, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(d.p50)}`).join('')} fill="none" stroke="var(--viz-1)" strokeWidth="2.2" />
        {days.map((d, i) => <circle key={d.date} cx={sx(i)} cy={sy(d.truth)} r={hover === i ? 4.5 : 2.8} fill={d.truth >= d.p10 && d.truth <= d.p90 ? 'var(--viz-ink)' : 'var(--viz-surface)'} stroke="var(--viz-ink)" strokeWidth="1.4" />)}
        {hd && <line className="viz-crosshair" x1={sx(hover!)} x2={sx(hover!)} y1={m.top} y2={height - m.bottom} />}
        <text className="viz-axis-label" transform={`translate(12 ${(m.top + height - m.bottom) / 2}) rotate(-90)`} textAnchor="middle">{unit}</text>
      </svg>
      {hd && <div className="viz-tooltip" style={{ left: `${(sx(hover!) / width) * 100}%` }}>
        <strong>{hd.date}</strong>
        <span><i style={{ background: 'var(--viz-ink)' }} />Observed (ERA5)<b>{fmt(hd.truth, 1)} {unit}</b></span>
        <span><i style={{ background: 'var(--viz-1)' }} />Astraeus 80%<b>{fmt(hd.p10, 1)}–{fmt(hd.p90, 1)}</b></span>
        <span><i style={{ background: 'var(--viz-ref)' }} />Model range<b>{fmt(Math.min(...Object.values(hd.members)), 1)}–{fmt(Math.max(...Object.values(hd.members)), 1)}</b></span>
      </div>}
    </div>
    <p className="viz-note">{inside} of {days.length} observed days ({Math.round((100 * inside) / days.length)}%) fell inside the 80% interval. Hollow dots fell outside.</p>
  </figure>;
}
