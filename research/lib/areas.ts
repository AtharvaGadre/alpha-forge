/**
 * Production-weighted (population-weighted for demand) commodity areas for the Astraeus benchmark.
 *
 * research/data/areas.json is written by research/build-areas.ts from official production / population tables
 * (USDA NASS, IBGE PAM, US Census). Each area is a small set of points (production-weighted k-medoids of the
 * producing counties / municipalities) with weights equal to the share of production nearest to each point.
 * The benchmark forms weighted area means of every model's daily forecast and of ERA5, then runs the same methods.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface AreaPoint {
  id: string;
  /** the medoid county / municipality */
  name: string;
  code: string;
  lat: number;
  lng: number;
  weight: number;
  unitsAssigned: number;
  valueAssigned: number;
}

export interface Area {
  id: string;
  name: string;
  /** benchmark single grid point this area is compared with */
  benchmarkSite: string;
  commodity: string;
  measure: string;
  unit: string;
  year: number;
  totalValue: number;
  unallocatedValue: number;
  units: number;
  points: AreaPoint[];
  meanDistanceKm: number;
  sources: Array<{ title: string; url: string; note?: string }>;
}

export interface AreasFile {
  version: string;
  generatedAt: string;
  method: Record<string, string>;
  areas: Area[];
}

export function readAreasFile(root: string): AreasFile {
  const p = path.join(root, 'research', 'data', 'areas.json');
  if (!existsSync(p)) throw new Error('research/data/areas.json missing — run `npx tsx research/build-areas.ts` first.');
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Weighted mean of several daily series. A date is kept only when every point has a value, so an area mean is
 * never silently formed from a subset of its points.
 */
export function weightedMean(series: Array<Record<string, number> | undefined>, weights: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  const first = series[0];
  if (!first || series.some((s) => !s)) return out;
  const wsum = weights.reduce((a, b) => a + b, 0);
  for (const d of Object.keys(first)) {
    let acc = 0;
    let ok = true;
    for (let i = 0; i < series.length; i++) {
      const v = series[i]![d];
      if (v === undefined || !Number.isFinite(v)) { ok = false; break; }
      acc += weights[i] * v;
    }
    if (ok) out[d] = acc / wsum;
  }
  return out;
}

/** Applies weightedMean to every leaf series of identically shaped nested records (e.g. var → lead → model → date). */
export function weightedMeanNested<T>(stores: T[], weights: number[], depth: number): T {
  if (depth === 0) return weightedMean(stores as unknown as Array<Record<string, number>>, weights) as unknown as T;
  const out: Record<string, unknown> = {};
  const keys = new Set<string>();
  for (const s of stores) for (const k of Object.keys(s as object)) keys.add(k);
  for (const k of keys) out[k] = weightedMeanNested(stores.map((s) => (s as Record<string, unknown>)[k]) as unknown[], weights, depth - 1);
  return out as T;
}
