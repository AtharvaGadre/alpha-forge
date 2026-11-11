import { buildWindFlowPaths } from '../../engine/windFlow';
import { sampleWeather, rainColor, type WeatherFrame } from '../../engine/liveGlobeWeather';
// ============================================================================
// ALPHAFORGE ATMOSPHERE — GOD'S EYE VIEW CESIUM + ATMOSPHERIC GLOBE CANVAS
// Adapted from https://github.com/bilawalsidhu/gods-eye-view (MIT)
// 100% Lockstep-Synchronized Single Globe Engine:
// CesiumJS 3D Globe and High-Resolution Atmospheric Overlay Canvas share a
// single unified camera pose on every animation frame and pointer gesture.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { atmosphereStore, useAtmosphereStore } from '../../state/atmosphereStore';
import {
  ESRI_WORLD_IMAGERY_URL,
  buildGooglePhotorealistic3DTilesUrl,
  resolveGoogleMapsApiKey,
} from '../../engine/globe/MapProviderManager';
import { installTrackpadPinchZoom } from '../../engine/globe/CameraController';
import { buildWeatherFieldSnapshot } from '../../engine/globe/WeatherOverlayManager';
import {
  CURATED_GEOGRAPHIC_TARGETS,
  resolveGeographicTarget,
} from '../../engine/globe/GeographicSelectionService';

declare global {
  interface Window {
    Cesium?: any;
  }
}

const CONTINENT_POLYGONS: Array<Array<[number, number]>> = [
  // North America
  [
    [-165, 65], [-140, 70], [-110, 72], [-80, 68], [-62, 60], [-55, 48],
    [-70, 42], [-80, 26], [-97, 25], [-105, 19], [-83, 9], [-78, 8],
    [-92, 16], [-110, 24], [-122, 37], [-125, 49], [-140, 59], [-165, 65],
  ],
  // South America
  [
    [-78, 9], [-62, 10], [-50, 1], [-35, -6], [-38, -15], [-42, -23],
    [-53, -34], [-65, -45], [-68, -55], [-74, -50], [-72, -33], [-70, -18],
    [-81, -5], [-78, 9],
  ],
  // Europe
  [
    [-10, 36], [-9, 43], [-4, 48], [2, 51], [8, 55], [10, 62], [20, 70],
    [32, 70], [40, 65], [40, 45], [28, 41], [23, 37], [15, 38], [12, 44],
    [5, 43], [-5, 36], [-10, 36],
  ],
  // United Kingdom & Ireland
  [
    [-6, 50], [-5, 54], [-3, 58], [1, 53], [1, 51], [-6, 50],
  ],
  // Africa
  [
    [-17, 15], [-6, 35], [10, 37], [32, 31], [43, 12], [51, 11], [40, -10],
    [35, -24], [20, -35], [14, -22], [9, -2], [4, 6], [-8, 5], [-17, 15],
  ],
  // Asia
  [
    [28, 41], [40, 65], [70, 72], [110, 73], [140, 68], [170, 65], [142, 48],
    [130, 35], [121, 31], [114, 22], [105, 10], [103, 1], [96, 16], [88, 22],
    [78, 8], [72, 21], [62, 25], [55, 24], [48, 30], [35, 33], [28, 41],
  ],
  // Japan
  [
    [130, 31], [136, 35], [141, 41], [145, 44], [141, 38], [135, 33], [130, 31],
  ],
  // Australia
  [
    [114, -22], [122, -16], [136, -12], [145, -15], [153, -27], [148, -38],
    [138, -35], [129, -32], [115, -34], [114, -22],
  ],
];

export interface CommodityGlobePoint { key: string; label: string; lat: number; lng: number; color: string }
export interface CommodityGlobeOverlay { points: CommodityGlobePoint[]; selectedKey: string; onSelect: (key: string) => void }
export interface GlobeWeatherOverlay { frame: WeatherFrame; wind: boolean; precipitation: boolean; opacity: number; animateWind: boolean }
export const GlobeCanvas: React.FC<{ commodityOverlay?: CommodityGlobeOverlay; weatherOverlay?: GlobeWeatherOverlay }> = ({ commodityOverlay, weatherOverlay }) => {
  const state = useAtmosphereStore();
  const cesiumContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetCameraRef = useRef(state.cameraPose);
  const currentCameraRef = useRef({ ...state.cameraPose });
  const [cesiumReady, setCesiumReady] = useState(false);
  const markerHits = useRef<Array<{ key: string; x: number; y: number }>>([]);

  // Sync external store camera updates into targetCameraRef
  useEffect(() => {
    targetCameraRef.current = state.cameraPose;
  }, [state.cameraPose]);

  // Helper to lockstep-sync CesiumJS camera with currentCameraRef on every frame/gesture
  const syncCesiumCameraImmediate = (pose: {
    lat: number;
    lng: number;
    altitudeMeters: number;
    headingDeg: number;
    pitchDeg: number;
  }) => {
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;
    try {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          pose.lng,
          pose.lat,
          pose.altitudeMeters
        ),
        orientation: {
          heading: Cesium.Math.toRadians(pose.headingDeg || 0),
          pitch: Cesium.Math.toRadians(pose.pitchDeg || -88),
          roll: 0,
        },
      });
    } catch {
      // Ignore transient Cesium view errors
    }
  };

  // 1. Initialize CesiumJS Viewer adapted from God's Eye View
  useEffect(() => {
    const container = cesiumContainerRef.current;
    if (!container || typeof window === 'undefined' || commodityOverlay) return;

    let viewer: any = null;
    let cleanupPinch: (() => void) | null = null;

    const initCesium = async () => {
      const Cesium = window.Cesium;
      if (!Cesium) return;

      try {
        const osmImagery = new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          credit: '© OpenStreetMap contributors',
        });

        viewer = new Cesium.Viewer(container, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          scene3DOnly: true,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          contextOptions: {
            webgl: {
              alpha: true,
              antialias: true,
              preserveDrawingBuffer: true,
              failIfMajorPerformanceCaveat: false,
            },
          },
          baseLayer: new Cesium.ImageryLayer(osmImagery),
        });

        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#030712');

        const googleKey = resolveGoogleMapsApiKey();
        const enable3DTilesFetch =
          Boolean((import.meta as any).env?.VITE_ENABLE_GOOGLE_3D_TILES) &&
          Boolean(googleKey);
        const activeStack = atmosphereStore.getState().mapProvider.activeStackId;

        if (
          activeStack === 'photoreal' &&
          enable3DTilesFetch &&
          Cesium.Cesium3DTileset?.fromUrl
        ) {
          try {
            const tileset = await Cesium.Cesium3DTileset.fromUrl(
              buildGooglePhotorealistic3DTilesUrl(googleKey),
              { showCreditsOnScreen: true }
            );
            viewer.scene.primitives.add(tileset);
            viewer.scene.globe.show = false;
          } catch {
            viewer.scene.globe.show = true;
          }
        } else if (
          activeStack === 'esri-imagery' &&
          Cesium.ArcGisMapServerImageryProvider?.fromUrl
        ) {
          try {
            const esriProvider =
              await Cesium.ArcGisMapServerImageryProvider.fromUrl(
                ESRI_WORLD_IMAGERY_URL,
                { enablePickFeatures: false }
              );
            viewer.imageryLayers.removeAll();
            viewer.imageryLayers.addImageryProvider(esriProvider);
          } catch {
            // Keep OSM fallback
          }
        }

        cleanupPinch = installTrackpadPinchZoom(viewer);
        viewerRef.current = viewer;
        syncCesiumCameraImmediate(atmosphereStore.getState().cameraPose);
        setCesiumReady(true);

        const canvasEl = viewer.scene?.canvas as HTMLCanvasElement | undefined;
        if (canvasEl) {
          canvasEl.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setCesiumReady(false);
          });
        }
      } catch {
        setCesiumReady(false);
      }
    };

    void initCesium();

    return () => {
      cleanupPinch?.();
      if (viewer && !viewer.isDestroyed()) {
        try {
          viewer.destroy();
        } catch {
          // Ignore
        }
      }
      viewerRef.current = null;
    };
  }, []);

  // 2. Synchronized High-Resolution Interactive Earth + Weather Overlay Canvas
  // Both CesiumJS and the Weather Overlay share `currentCameraRef.current` in lockstep on every frame.
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rainCells: Array<{lat:number;lng:number;mm:number}> = [];
    if (weatherOverlay?.precipitation) {
      for (let lat=-67.5;lat<70;lat+=5) for(let lng=-177.5;lng<180;lng+=5) {
        const mm=sampleWeather(weatherOverlay.frame,lat,lng)?.precipitationMm;
        if(mm!=null && mm>=.05) rainCells.push({lat,lng,mm});
      }
    }
    const windPaths = weatherOverlay?.wind ? buildWindFlowPaths(weatherOverlay.frame) : [];
    let animFrameId = 0;

    const renderFrame = (timestampMs: number) => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      if (
        canvas.width !== Math.floor(width * dpr) ||
        canvas.height !== Math.floor(height * dpr)
      ) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const target = targetCameraRef.current;
      const cur = currentCameraRef.current;
      const prevLat = cur.lat;
      const prevLng = cur.lng;
      const prevAlt = cur.altitudeMeters;

      cur.lat += (target.lat - cur.lat) * 0.16;
      let dLng = target.lng - cur.lng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      cur.lng += dLng * 0.16;
      cur.altitudeMeters +=
        (target.altitudeMeters - cur.altitudeMeters) * 0.16;
      cur.pitchDeg += (target.pitchDeg - cur.pitchDeg) * 0.16;
      cur.headingDeg += (target.headingDeg - cur.headingDeg) * 0.16;

      // Keep CesiumJS 100% locked to the exact same interpolated camera pose every frame
      if (
        Math.abs(cur.lat - prevLat) > 1e-4 ||
        Math.abs(cur.lng - prevLng) > 1e-4 ||
        Math.abs(cur.altitudeMeters - prevAlt) > 1
      ) {
        syncCesiumCameraImmediate(cur);
      }

      const cx = width * 0.5;
      const cy = height * 0.5;
      const baseRadius = Math.min(width, height) * 0.42;
      const zoomFactor = Math.max(
        0.75,
        Math.min(4.8, 12_500_000 / Math.max(850, cur.altitudeMeters))
      );
      const globeRadius = baseRadius * zoomFactor;

      const lat0 = (cur.lat * Math.PI) / 180;
      const lon0 = (cur.lng * Math.PI) / 180;

      const projectLatLon = (latDeg: number, lonDeg: number) => {
        const phi = (latDeg * Math.PI) / 180;
        const lam = (lonDeg * Math.PI) / 180;
        const dLam = lam - lon0;
        const cosC =
          Math.sin(lat0) * Math.sin(phi) +
          Math.cos(lat0) * Math.cos(phi) * Math.cos(dLam);
        const x = cx + globeRadius * Math.cos(phi) * Math.sin(dLam);
        const y =
          cy -
          globeRadius *
            (Math.cos(lat0) * Math.sin(phi) -
              Math.sin(lat0) * Math.cos(phi) * Math.cos(dLam));
        return { x, y, visible: cosC > -0.05, cosC };
      };

      // Deep space background so there is never a double-globe artifact
      const bgGrad = ctx.createRadialGradient(
        cx,
        cy,
        globeRadius * 0.2,
        cx,
        cy,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, '#071428');
      bgGrad.addColorStop(0.55, '#030914');
      bgGrad.addColorStop(1, '#010409');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Atmospheric limb glow
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy,
        globeRadius * 0.94,
        cx,
        cy,
        globeRadius * 1.15
      );
      haloGrad.addColorStop(0, 'rgba(56, 189, 248, 0.32)');
      haloGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.14)');
      haloGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.clip();

      const oceanGrad = ctx.createRadialGradient(
        cx - globeRadius * 0.28,
        cy - globeRadius * 0.28,
        globeRadius * 0.08,
        cx,
        cy,
        globeRadius
      );
      const isLowBandwidth = state.mapProvider.activeStackId === 'osm';
      oceanGrad.addColorStop(
        0,
        isLowBandwidth ? 'rgba(15, 23, 42, 0.96)' : 'rgba(12, 48, 88, 0.96)'
      );
      oceanGrad.addColorStop(
        0.65,
        isLowBandwidth ? 'rgba(9, 14, 28, 0.96)' : 'rgba(6, 26, 52, 0.96)'
      );
      oceanGrad.addColorStop(1, 'rgba(2, 10, 24, 0.98)');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(
        cx - globeRadius,
        cy - globeRadius,
        globeRadius * 2,
        globeRadius * 2
      );

      // Graticule lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.13)';
      ctx.lineWidth = 0.75;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const p = projectLatLon(lat, lon);
          if (p.cosC > 0) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }
      for (let lon = -150; lon <= 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -80; lat <= 80; lat += 5) {
          const p = projectLatLon(lat, lon);
          if (p.cosC > 0) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // Continental landmasses
      for (const poly of CONTINENT_POLYGONS) {
        ctx.beginPath();
        let visibleCount = 0;
        poly.forEach(([lon, lat], idx) => {
          const p = projectLatLon(lat, lon);
          if (p.cosC > -0.15) visibleCount++;
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        if (visibleCount > 2) {
          ctx.fillStyle = isLowBandwidth
            ? 'rgba(30, 41, 59, 0.78)'
            : 'rgba(22, 66, 56, 0.86)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.36)';
          ctx.lineWidth = 1.15;
          ctx.stroke();
        }
      }

      // Build weather field snapshot from WeatherOverlayManager
      const snapshot = commodityOverlay ? { gridNodes: [], windStreamlines: [], alertPolygons: [], stormTracks: [] } : buildWeatherFieldSnapshot({
        activeLayers:
          state.activeWeatherLayers.length > 0
            ? state.activeWeatherLayers
            : ['TEMPERATURE'],
        offsetHours: state.timelineOffsetHours,
        focusLat: cur.lat,
        focusLng: cur.lng,
        livePointTelemetry: state.liveTelemetry,
      });

      // Render spatial weather grid nodes
      for (const node of snapshot.gridNodes) {
        const p = projectLatLon(node.lat, node.lng);
        if (p.cosC <= 0.05) continue;
        const cellRadius = Math.max(18, globeRadius * 0.14 * p.cosC);
        const cellGrad = ctx.createRadialGradient(
          p.x,
          p.y,
          2,
          p.x,
          p.y,
          cellRadius
        );
        cellGrad.addColorStop(0, `${node.colorHex}66`);
        cellGrad.addColorStop(1, `${node.colorHex}00`);
        ctx.fillStyle = cellGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, cellRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render equal-area midpoint wind streamlines
      const streamlines = commodityOverlay ? [] :
        snapshot.windStreamlines.length > 0
          ? snapshot.windStreamlines
          : buildWeatherFieldSnapshot({
              activeLayers: ['WIND_SPEED'],
              offsetHours: state.timelineOffsetHours,
              focusLat: cur.lat,
              focusLng: cur.lng,
            }).windStreamlines;

      const phase = (timestampMs * 0.0012) % 1;
      for (const line of streamlines) {
        ctx.beginPath();
        let validPoints = 0;
        line.coordinates.forEach(([lon, lat], idx) => {
          const p = projectLatLon(lat, lon);
          if (p.cosC > 0.05) {
            validPoints++;
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
        });
        if (validPoints >= 2) {
          ctx.strokeStyle = `${line.colorHex}77`;
          ctx.lineWidth = line.speedMs >= 16 ? 1.5 : 1.05;
          ctx.stroke();

          const headIdx = Math.min(
            line.coordinates.length - 1,
            Math.floor(phase * line.coordinates.length)
          );
          const [hLon, hLat] = line.coordinates[headIdx];
          const hp = projectLatLon(hLat, hLon);
          if (hp.cosC > 0.08) {
            ctx.fillStyle = line.colorHex;
            ctx.beginPath();
            ctx.arc(hp.x, hp.y, 2.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Render Official CAP Alert Polygons
      for (const alert of snapshot.alertPolygons) {
        ctx.beginPath();
        let vis = 0;
        alert.coordinates.forEach(([lon, lat], idx) => {
          const p = projectLatLon(lat, lon);
          if (p.cosC > 0) vis++;
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        if (vis >= 3) {
          ctx.fillStyle = `${alert.colorHex}38`;
          ctx.fill();
          ctx.strokeStyle = alert.colorHex;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Render Storm Tracks
      for (const storm of snapshot.stormTracks) {
        ctx.beginPath();
        storm.points.forEach((pt, idx) => {
          const p = projectLatLon(pt.lat, pt.lng);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = storm.colorHex;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Render 3D Landmark Prisms when zoomed in (< 1,200,000m altitude)
      if (!commodityOverlay && cur.altitudeMeters < 1_200_000 && state.selectedLocation) {
        const sel = state.selectedLocation;
        const centerProj = projectLatLon(sel.lat, sel.lng);
        if (centerProj.cosC > 0.2) {
          const buildingOffsets = [
            { dx: 0, dy: 0, h: 36, w: 12 },
            { dx: -22, dy: 10, h: 22, w: 9 },
            { dx: 20, dy: 8, h: 26, w: 10 },
            { dx: -14, dy: -16, h: 18, w: 8 },
            { dx: 16, dy: -14, h: 20, w: 9 },
          ];
          for (const b of buildingOffsets) {
            const bx = centerProj.x + b.dx;
            const by = centerProj.y + b.dy;
            ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
            ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
            ctx.lineWidth = 1;
            ctx.fillRect(bx - b.w / 2, by - b.h, b.w, b.h);
            ctx.strokeRect(bx - b.w / 2, by - b.h, b.w, b.h);
          }
        }
      }

      // Real forecast layers share the earth projection. Always draw below commodity markers.
      if (weatherOverlay) {
        ctx.save();
        ctx.globalAlpha = weatherOverlay.opacity;
        for(const cell of rainCells) {
          const corners=[[-2.5,-2.5],[-2.5,2.5],[2.5,2.5],[2.5,-2.5]].map(([dy,dx])=>projectLatLon(cell.lat+dy,cell.lng+dx));
          if(corners.some(p=>p.cosC<.025)) continue;
          ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
          ctx.fillStyle=rainColor(cell.mm);ctx.fill();
        }
        if(weatherOverlay.wind) {
          ctx.lineCap='round';ctx.lineJoin='round';
          for(const path of windPaths) {
            const phase=weatherOverlay.animateWind?(timestampMs*.000055*(.5+Math.min(path.speedMs,30)/18)+path.phase)%1:.64;
            const color=path.speedMs>=15?'255,222,171':path.speedMs>=8?'160,218,206':'171,207,230';
            const points=path.points.map(p=>projectLatLon(p.lat,p.lng));
            // A faint continuous curve provides the flow structure; tapered highlights move along it.
            ctx.beginPath();let pen=false;
            for(const p of points) {if(p.cosC<.055){pen=false;continue;}if(pen)ctx.lineTo(p.x,p.y);else{ctx.moveTo(p.x,p.y);pen=true;}}
            ctx.strokeStyle=`rgba(${color},0.10)`;ctx.lineWidth=.65;ctx.stroke();
            for(let k=1;k<points.length;k++) {
              const tail=points[k-1],head=points[k];
              if(tail.cosC<.055||head.cosC<.055)continue;
              const age=(phase-k/(points.length-1)+1)%1;
              if(age>.30)continue;
              const fade=1-age/.30;
              const horizon=Math.min(1,Math.min(tail.cosC,head.cosC)*5);
              ctx.strokeStyle=`rgba(${color},${(.12+fade*.8)*horizon})`;
              ctx.lineWidth=.45+fade*(path.speedMs>=15?1.5:1.05);
              ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(head.x,head.y);ctx.stroke();
            }
          }
        }
        ctx.restore();
      }
      markerHits.current = [];
      for (const point of commodityOverlay?.points ?? []) {
        const p = projectLatLon(point.lat, point.lng);
        if (p.cosC <= 0.1) continue;
        markerHits.current.push({ key: point.key, x: p.x, y: p.y });
        const selected = point.key === commodityOverlay?.selectedKey;
        ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 12 : 7, 0, Math.PI * 2);
        ctx.fillStyle = selected ? 'rgba(241,181,124,0.18)' : 'rgba(117,166,151,0.09)'; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = point.color; ctx.fill();
        ctx.strokeStyle = selected ? '#ffe3bf' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.stroke();
        if (selected) {
          ctx.font = '500 11px system-ui, sans-serif';
          const w = ctx.measureText(point.label).width;
          ctx.fillStyle = 'rgba(10,26,35,0.88)'; ctx.fillRect(p.x+12,p.y-12,w+15,24);
          ctx.fillStyle = '#f5e7d5'; ctx.fillText(point.label,p.x+19,p.y+4);
        }
      }
      // Legacy hubs are suppressed in the commodity workspace.
      for (const place of commodityOverlay ? [] : CURATED_GEOGRAPHIC_TARGETS) {
        const p = projectLatLon(place.lat, place.lng);
        if (p.cosC <= 0.08) continue;

        const isSelected = state.selectedLocation?.id === place.id;
        const dotRadius = isSelected ? 5.5 : place.kind === 'CITY' ? 3.5 : 2.9;

        if (isSelected) {
          const pulse = 10 + Math.sin(timestampMs * 0.006) * 4;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isSelected
          ? '#38bdf8'
          : place.kind === 'AGRICULTURAL_OR_ECONOMIC_REGION'
          ? '#34d399'
          : '#f8fafc';
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        if (isSelected || (p.cosC > 0.52 && (place.kind === 'CITY' || zoomFactor > 1.25))) {
          ctx.font = isSelected
            ? '600 12px Inter, system-ui, sans-serif'
            : '500 10.5px Inter, system-ui, sans-serif';
          ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(226, 232, 240, 0.86)';
          ctx.fillText(place.name, p.x + 8, p.y + 3.5);
        }
      }

      ctx.restore();

      // Specular inner rim highlight
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      animFrameId = window.requestAnimationFrame(renderFrame);
    };

    animFrameId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(animFrameId);
    };
  }, [
    cesiumReady,
    state.mapProvider.activeStackId,
    state.activeWeatherLayers,
    state.timelineOffsetHours,
    state.selectedLocation,
    state.locationSummaryOpen,
    state.liveTelemetry,
    commodityOverlay,
    weatherOverlay,
  ]);

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !commodityOverlay) return;
    const preventPageScroll = (event: WheelEvent) => event.preventDefault();
    canvas.addEventListener('wheel', preventPageScroll, { passive: false });
    return () => canvas.removeEventListener('wheel', preventPageScroll);
  }, [Boolean(commodityOverlay)]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    if (Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y) > 5) {
      dragMovedRef.current = true;
    }
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    const cur = currentCameraRef.current;
    const sensitivity = Math.max(
      0.04,
      Math.min(0.32, cur.altitudeMeters / 35_000_000)
    );
    const nextLng = ((cur.lng - dx * sensitivity + 540) % 360) - 180;
    const nextLat = Math.max(-78, Math.min(78, cur.lat + dy * sensitivity));

    currentCameraRef.current.lng = nextLng;
    currentCameraRef.current.lat = nextLat;
    targetCameraRef.current = {
      ...targetCameraRef.current,
      lat: nextLat,
      lng: nextLng,
    };

    // Synchronize CesiumJS immediately on every drag event
    syncCesiumCameraImmediate(currentCameraRef.current);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const wasDragged = dragMovedRef.current;
    isDraggingRef.current = false;

    if (wasDragged) {
      atmosphereStore.setState({
        cameraPose: { ...currentCameraRef.current },
      });
      return;
    }

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    if (commodityOverlay) {
      const hit = markerHits.current.map(h => ({ ...h, distance: Math.hypot(h.x - clickX, h.y - clickY) }))
        .filter(h => h.distance <= 16).sort((a,b) => a.distance-b.distance || Number(b.key === commodityOverlay.selectedKey)-Number(a.key === commodityOverlay.selectedKey))[0];
      if (hit) commodityOverlay.onSelect(hit.key);
      return;
    }
    const cx = rect.width * 0.5;
    const cy = rect.height * 0.5;

    const cur = currentCameraRef.current;
    const baseRadius = Math.min(rect.width, rect.height) * 0.42;
    const zoomFactor = Math.max(
      0.75,
      Math.min(4.8, 12_500_000 / Math.max(850, cur.altitudeMeters))
    );
    const globeRadius = baseRadius * zoomFactor;

    const nx = (clickX - cx) / globeRadius;
    const ny = (cy - clickY) / globeRadius;
    const rho = Math.hypot(nx, ny);
    if (rho > 1.02) return;

    const c = Math.asin(Math.min(1, rho));
    const lat0 = (cur.lat * Math.PI) / 180;
    const lon0 = (cur.lng * Math.PI) / 180;

    let clickedLat = cur.lat;
    let clickedLon = cur.lng;
    if (rho > 1e-4) {
      const phi = Math.asin(
        Math.cos(c) * Math.sin(lat0) +
          (ny * Math.sin(c) * Math.cos(lat0)) / rho
      );
      const lam =
        lon0 +
        Math.atan2(
          nx * Math.sin(c),
          rho * Math.cos(lat0) * Math.cos(c) -
            ny * Math.sin(lat0) * Math.sin(c)
        );
      clickedLat = (phi * 180) / Math.PI;
      clickedLon = (((lam * 180) / Math.PI + 540) % 360) - 180;
    }

    const resolved = resolveGeographicTarget(
      `${clickedLat.toFixed(2)}, ${clickedLon.toFixed(2)}`
    );
    atmosphereStore.selectLocation(resolved, { openSummary: true });
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const cur = targetCameraRef.current;
    const factor = e.deltaY > 0 ? 1.18 : 0.84;
    const nextAlt = Math.max(
      commodityOverlay ? 4_000_000 : 1_200,
      Math.min(24_000_000, Math.round(cur.altitudeMeters * factor))
    );
    const nextPose = {
      ...cur,
      altitudeMeters: nextAlt,
    };
    targetCameraRef.current = nextPose;
    currentCameraRef.current.altitudeMeters = nextAlt;
    syncCesiumCameraImmediate(currentCameraRef.current);
    atmosphereStore.setState({
      cameraPose: nextPose,
    });
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#020617] select-none"
      data-testid="earth-globe-viewport"
    >
      <div
        ref={cesiumContainerRef}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        aria-hidden="true"
      />
      <canvas
        ref={overlayCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { isDraggingRef.current = false; }}
        style={{ touchAction: 'none' }}
        onWheel={handleWheel}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Earth and Atmospheric Forecast Globe"
      />
    </div>
  );
};
