/**
 * Natural Earth land polygons (public domain, via the world-atlas TopoJSON package), loaded lazily
 * from /geo so the main bundle stays small. 1:110m is used for overview zooms and 1:50m when the
 * camera is close enough for coastline detail to be visible.
 */
import { useEffect, useState } from 'react';
import { feature } from 'topojson-client';
import type { FeatureCollection, MultiPolygon, Polygon, Feature } from 'geojson';

export type LandGeometry = Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>;

const cache = new Map<string, Promise<LandGeometry | null>>();

export function loadLand(resolution: '110m' | '50m' = '110m'): Promise<LandGeometry | null> {
  if (!cache.has(resolution)) {
    cache.set(
      resolution,
      fetch(`/geo/land-${resolution}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((topo) => (topo ? (feature(topo, topo.objects.land) as unknown as LandGeometry) : null))
        .catch(() => null)
    );
  }
  return cache.get(resolution)!;
}

/** React hook: coarse land first, optional detailed land once requested. */
export function useLand(detailed = false): LandGeometry | null {
  const [coarse, setCoarse] = useState<LandGeometry | null>(null);
  const [fine, setFine] = useState<LandGeometry | null>(null);
  useEffect(() => {
    let live = true;
    void loadLand('110m').then((g) => live && setCoarse(g));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!detailed || fine) return;
    let live = true;
    void loadLand('50m').then((g) => live && setFine(g));
    return () => { live = false; };
  }, [detailed, fine]);
  return (detailed && fine) || coarse;
}
