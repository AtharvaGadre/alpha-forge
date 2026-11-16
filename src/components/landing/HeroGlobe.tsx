/**
 * Landing-page globe: Natural Earth land rendered as a dot matrix, the 16 benchmark regions as gold
 * markers and — only when the live NOAA GFS grid loads — particles advected by the real 10 m wind
 * (20° samples, bilinearly interpolated). No synthetic wind is ever drawn.
 */
import React, { useEffect, useRef, useState } from 'react';
import { geoEquirectangular, geoOrthographic, geoPath } from 'd3-geo';
import { loadLand } from '../../engine/geoLand';
import { sampleWeather, type GlobeWeatherField, type WeatherFrame } from '../../engine/liveGlobeWeather';

export interface HeroSite { id: string; name: string; lat: number; lng: number }

const DEG = Math.PI / 180;

/** Rasterise land once to an equirectangular mask and sample a lat/lng dot grid from it. */
async function landDots(step = 1.25): Promise<Array<[number, number]>> {
  const land = await loadLand('110m');
  if (!land) return [];
  const W = 1440;
  const H = 720;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const proj = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  geoPath(proj, ctx)(land as any);
  ctx.fill();
  const data = ctx.getImageData(0, 0, W, H).data;
  const out: Array<[number, number]> = [];
  for (let lat = -58; lat <= 78; lat += step) {
    // keep dot spacing roughly uniform on the sphere
    const lngStep = step / Math.max(0.25, Math.cos(lat * DEG));
    for (let lng = -180; lng < 180; lng += lngStep) {
      const x = Math.floor(((lng + 180) / 360) * W);
      const y = Math.floor(((90 - lat) / 180) * H);
      if (data[(y * W + x) * 4 + 3] > 128) out.push([lng, lat]);
    }
  }
  return out;
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function HeroGlobe({ sites, onWindStatus }: { sites: HeroSite[]; onWindStatus?: (s: { live: boolean; model?: string; validAt?: string; init?: string | null }) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dots, setDots] = useState<Array<[number, number]>>([]);
  const [frame, setFrame] = useState<WeatherFrame | null>(null);
  const dotsRef = useRef(dots);
  dotsRef.current = dots;
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => { let live = true; void landDots().then((d) => live && setDots(d)); return () => { live = false; }; }, []);
  useEffect(() => {
    let live = true;
    const ctrl = new AbortController();
    fetch('/api/v1/weather/globe', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((field: GlobeWeatherField | null) => {
        if (!live) return;
        const f = field?.frames?.[0];
        if (f && f.samples.some((s) => s.windMs != null)) {
          setFrame(f);
          onWindStatus?.({ live: true, model: field!.model, validAt: f.validAtUtc, init: field!.modelInitializedAtUtc });
        } else onWindStatus?.({ live: false });
      })
      .catch(() => live && onWindStatus?.({ live: false }));
    return () => { live = false; ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    // particles live in lat/lng; trails are kept as short histories
    const N = 1400;
    const TRAIL = 9;
    const rand = () => ({ lat: Math.asin(2 * Math.random() - 1) / DEG * 0.78, lng: Math.random() * 360 - 180, age: Math.floor(Math.random() * 120), hist: [] as Array<[number, number]> });
    const particles = Array.from({ length: N }, rand);
    let lng0 = -35;
    const lat0 = 16;
    let t = 0;
    let last = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden) { last = now; return; }
      const dt = Math.min(64, now - last);
      last = now;
      if (!reduce) lng0 += dt * 0.0042;
      t += dt;
      const gold = cssVar('--as-gold', '#dfc484');
      const ink = cssVar('--as-ink', '#e8e3d8');
      const light = document.documentElement.dataset.theme === 'light';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w * 0.46, h * 0.46);
      const cx = w * 0.5;
      const cy = h * 0.52;
      const proj = geoOrthographic().rotate([-lng0, -lat0]).scale(R).translate([cx, cy]).clipAngle(90);
      const sinL0 = Math.sin(lat0 * DEG);
      const cosL0 = Math.cos(lat0 * DEG);
      const vis = (lng: number, lat: number) => sinL0 * Math.sin(lat * DEG) + cosL0 * Math.cos(lat * DEG) * Math.cos((lng - lng0) * DEG);

      // atmosphere halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.22);
      halo.addColorStop(0, light ? 'rgba(128,98,34,0.16)' : 'rgba(223,196,132,0.16)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2); ctx.fill();
      // sphere body
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, light ? '#fbf8f1' : '#17181b');
      body.addColorStop(1, light ? '#ece7db' : '#0b0b0d');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = light ? 'rgba(36,39,37,0.18)' : 'rgba(232,227,216,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // graticule
      ctx.beginPath();
      const gp = geoPath(proj, ctx);
      for (let la = -60; la <= 60; la += 30) gp({ type: 'LineString', coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, la]) } as any);
      for (let lo = -180; lo < 180; lo += 30) gp({ type: 'LineString', coordinates: Array.from({ length: 35 }, (_, i) => [lo, -85 + i * 5]) } as any);
      ctx.strokeStyle = light ? 'rgba(36,39,37,0.06)' : 'rgba(232,227,216,0.05)';
      ctx.stroke();

      // land dot matrix
      ctx.fillStyle = ink;
      for (const [lng, lat] of dotsRef.current) {
        const c = vis(lng, lat);
        if (c <= 0.02) continue;
        const p = proj([lng, lat]);
        if (!p) continue;
        ctx.globalAlpha = (light ? 0.22 : 0.28) + 0.5 * c;
        const s = 0.7 + 0.9 * c;
        ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // live wind particles
      const f = frameRef.current;
      if (f) {
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = gold;
        for (const q of particles) {
          q.age++;
          const wv = sampleWeather(f, q.lat, q.lng);
          if (!wv || wv.u == null || wv.v == null || q.age > 160 || Math.abs(q.lat) > 68) { Object.assign(q, rand(), { age: 0, hist: [] }); continue; }
          if (!reduce) {
            const k = dt * 0.0016;
            q.lat += wv.v * k;
            q.lng += (wv.u * k) / Math.max(0.2, Math.cos(q.lat * DEG));
            if (q.lng > 180) q.lng -= 360;
            if (q.lng < -180) q.lng += 360;
          }
          q.hist.push([q.lng, q.lat]);
          if (q.hist.length > TRAIL) q.hist.shift();
          const c = vis(q.lng, q.lat);
          if (c <= 0.05 || q.hist.length < 2) continue;
          const speed = Math.hypot(wv.u, wv.v);
          ctx.globalAlpha = Math.min(0.85, 0.12 + speed / 22) * Math.min(1, c * 1.6) * Math.min(1, q.age / 20);
          ctx.beginPath();
          let started = false;
          for (const [lg, lt] of q.hist) {
            const p = proj([lg, lt]);
            if (!p) { started = false; continue; }
            if (!started) { ctx.moveTo(p[0], p[1]); started = true; } else ctx.lineTo(p[0], p[1]);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // benchmark regions
      for (const s of sites) {
        const c = vis(s.lng, s.lat);
        if (c <= 0.05) continue;
        const p = proj([s.lng, s.lat]);
        if (!p) continue;
        const pulse = reduce ? 0.5 : (Math.sin(t / 700 + s.lat) + 1) / 2;
        ctx.globalAlpha = 0.35 * c * (1 - pulse);
        ctx.strokeStyle = gold;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p[0], p[1], 4 + pulse * 10, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = Math.min(1, 0.4 + c);
        ctx.fillStyle = gold;
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // terminator-like rim shading
      const rim = ctx.createRadialGradient(cx, cy, R * 0.75, cx, cy, R);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(1, light ? 'rgba(245,242,234,0.55)' : 'rgba(8,8,9,0.6)');
      ctx.fillStyle = rim;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [sites]);

  return <canvas ref={canvasRef} className="lp-globe-canvas" aria-hidden="true" />;
}
