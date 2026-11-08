// ============================================================================
// ALPHAFORGE ATMOSPHERE — MAP PROVIDER MANAGER
// Adapted from bilawalsidhu/gods-eye-view (MIT License):
// - src/maps/catalog.js
// - src/maps/defaultSources.js
// - src/maps/imagery.js
// - src/maps/terrain.js
//
// Provides:
// 1. PRIMARY: Google Photorealistic 3D Tiles via CesiumJS (/v1/3dtiles/root.json)
// 2. FALLBACK: Esri World Imagery Satellite + Re:Earth Ellipsoidal Terrain
// 3. LOW-BANDWIDTH: OpenStreetMap (OSM) Geographic Tiles
// ============================================================================

export type MapStackId = 'photoreal' | 'esri-imagery' | 'osm';

export interface MapStackDescriptor {
  id: MapStackId;
  label: string;
  shortLabel: string;
  imageryType: 'PHOTOREALISTIC_3D_TILES' | 'SATELLITE_IMAGERY' | 'LOW_BANDWIDTH_VECTOR_RASTER';
  attributionHtml: string;
  attributionText: string;
  requiresGoogleKey: boolean;
  coverageLimitations: string;
}

export const MAP_STACK_CATALOG: MapStackDescriptor[] = [
  {
    id: 'photoreal',
    label: 'Google Photorealistic 3D',
    shortLabel: 'Google 3D',
    imageryType: 'PHOTOREALISTIC_3D_TILES',
    attributionHtml: '© Google · Map Tiles API (Photorealistic 3D Tiles)',
    attributionText: 'Google · Map Tiles API (Photorealistic 3D Tiles)',
    requiresGoogleKey: true,
    coverageLimitations:
      'High-resolution 3D buildings in 2,500+ cities across 49 countries; global 3D terrain & satellite mesh elsewhere.',
  },
  {
    id: 'esri-imagery',
    label: 'Esri World Imagery (Satellite Fallback)',
    shortLabel: 'Satellite',
    imageryType: 'SATELLITE_IMAGERY',
    attributionHtml:
      'Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    attributionText: 'Powered by Esri · Maxar · Earthstar Geographics',
    requiresGoogleKey: false,
    coverageLimitations:
      'Global orthorectified satellite imagery with Re:Earth / WGS84 terrain elevation.',
  },
  {
    id: 'osm',
    label: 'OpenStreetMap (Low-Bandwidth)',
    shortLabel: 'Low-Bandwidth',
    imageryType: 'LOW_BANDWIDTH_VECTOR_RASTER',
    attributionHtml: '© OpenStreetMap contributors (ODbL)',
    attributionText: '© OpenStreetMap contributors',
    requiresGoogleKey: false,
    coverageLimitations:
      'Low-bandwidth 2D cartographic tiles draped on 3D WGS84 ellipsoid.',
  },
];

export interface MapProviderStatusDiagnostics {
  activeStackId: MapStackId;
  activeProviderLabel: string;
  availability: 'AVAILABLE' | 'FALLBACK_ACTIVE' | 'DEGRADED';
  switchOrigin: 'manual' | 'automatic_fallback';
  imageryType: MapStackDescriptor['imageryType'];
  googleKeyConfigured: boolean;
  simulatedOutageActive: boolean;
  tilesLoadedCount: number;
  lastError: string | null;
  statusExplanation: string;
  coverageLimitations: string;
  attributionText: string;
}

export const ESRI_WORLD_IMAGERY_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/';

export const KEYLESS_TERRAIN_URL =
  'https://terrain.reearth.land/cesium-mesh/ellipsoid';

export function resolveGoogleMapsApiKey(): string {
  try {
    const viteKey = (import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY;
    if (viteKey && String(viteKey).trim()) return String(viteKey).trim();
  } catch {
    // Ignore
  }
  try {
    const procKey =
      (globalThis as any)?.process?.env?.GOOGLE_MAPS_PLATFORM_KEY ||
      (globalThis as any)?.process?.env?.VITE_GOOGLE_MAPS_API_KEY;
    if (procKey && String(procKey).trim()) return String(procKey).trim();
  } catch {
    // Ignore
  }
  return '';
}

export function buildGooglePhotorealistic3DTilesUrl(apiKey: string): string {
  const cleanKey = encodeURIComponent(apiKey.trim());
  return `https://tile.googleapis.com/v1/3dtiles/root.json?key=${cleanKey}&solution_id=gmp_mcp_codeassist_v1_aistudio`;
}

export function getMapStackDescriptor(stackId: MapStackId): MapStackDescriptor {
  return (
    MAP_STACK_CATALOG.find((s) => s.id === stackId) || MAP_STACK_CATALOG[1]
  );
}
