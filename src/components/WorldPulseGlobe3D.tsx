/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type {
  CountryProfile,
  CountryNewsItem,
} from '../engine/worldPulseCountryEngine.ts';
import type {
  GlobeLensTabId,
  CrossCountryInteractionLink,
  WeatherPatternPredictionRecord,
  CountryTradeRouteCorridor,
  OpticalCameraReconTarget,
} from '../engine/worldToAlphaEngine.ts';
import {
  resolveNearestCountryFromViewport,
  type CountrySpecificDeepProfile,
  type TrackedMaritimeVessel,
} from '../engine/countryDeepDiveEngine.ts';
import type { TradeRouteFilterMode } from './WorldPulseTradeRoutesPanel.tsx';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

export type CameraStageMode =
  | 'WORLD_GLOBE'
  | 'COUNTRY_VIEW'
  | 'FINANCIAL_CAPITAL_3D';

export interface CustomFocusTarget {
  lat: number;
  lng: number;
  label: string;
  rangeMeters?: number;
  zoomLevel?: number;
  tiltDeg?: number;
}

interface WorldPulseGlobe3DProps {
  countries: CountryProfile[];
  selectedCountry: CountryProfile;
  deepProfile: CountrySpecificDeepProfile;
  onSelectCountry: (isoCode: string) => void;
  activeLens: GlobeLensTabId;
  onSelectLens: (lens: GlobeLensTabId) => void;
  activeLinkId: string | null;
  onSelectLink: (linkId: string) => void;
  selectedWeatherId?: string;
  onSelectWeather?: (weatherId: string) => void;
  countryTradeRoutes: CountryTradeRouteCorridor[];
  selectedTradeRouteId: string | null;
  onSelectTradeRoute: (route: CountryTradeRouteCorridor) => void;
  tradeFilterMode: TradeRouteFilterMode;
  onChangeTradeFilterMode: (mode: TradeRouteFilterMode) => void;
  selectedVisionTargetId?: string;
  onSelectVisionTarget?: (target: OpticalCameraReconTarget) => void;
  newsItems?: CountryNewsItem[];
  selectedNewsId?: string;
  onSelectNews?: (newsId: string) => void;
  customFocusTarget?: CustomFocusTarget | null;
  selectedVesselId?: string | null;
  onSelectVessel?: (vessel: TrackedMaritimeVessel) => void;
  onViewportCameraChange?: (
    lat: number,
    lng: number,
    rangeMeters: number
  ) => void;
}

export interface InfoBannerState {
  badge: string;
  title: string;
  subtitle: string;
  metricsPill?: string;
  aisDetails?: {
    imo: string;
    mmsi: string;
    callsign: string;
    vesselClass: string;
    draught: string;
    navStatus: string;
    aiSignal: string;
  };
}

/**
 * Generates geodesic circle coordinates around (lat, lng) for glowing radar rings & hubs.
 */
function buildGlowingOrbCircleCoords(
  centerLat: number,
  centerLng: number,
  radiusDeg: number,
  numPoints = 24
): Array<{ lat: number; lng: number }> {
  const coords: Array<{ lat: number; lng: number }> = [];
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const dLat = radiusDeg * Math.sin(theta);
    const dLng = (radiusDeg * Math.cos(theta)) / cosLat;
    coords.push({
      lat: Math.max(-85, Math.min(85, centerLat + dLat)),
      lng: centerLng + dLng,
    });
  }
  return coords;
}

/**
 * Generates a high-visibility directional ship hull / arrow polygon oriented along headingDeg
 * so ships are unmistakably visible on the 3D Globe.
 */
function buildDirectionalShipHullCoords(
  centerLat: number,
  centerLng: number,
  headingDeg: number,
  scaleDeg = 0.85
): Array<{ lat: number; lng: number }> {
  const rad = ((90 - headingDeg) * Math.PI) / 180;
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));

  // Bow (front tip), Starboard stern, Center notch, Port stern, back to Bow
  const localPoints = [
    { forward: scaleDeg * 1.35, right: 0 },
    { forward: -scaleDeg * 0.9, right: scaleDeg * 0.72 },
    { forward: -scaleDeg * 0.45, right: 0 },
    { forward: -scaleDeg * 0.9, right: -scaleDeg * 0.72 },
    { forward: scaleDeg * 1.35, right: 0 },
  ];

  return localPoints.map((pt) => {
    const dLat = pt.forward * Math.sin(rad) - pt.right * Math.cos(rad);
    const dLng =
      (pt.forward * Math.cos(rad) + pt.right * Math.sin(rad)) / cosLat;
    return {
      lat: Math.max(-85, Math.min(85, centerLat + dLat)),
      lng: centerLng + dLng,
    };
  });
}

/**
 * Generates a trailing wake + forward course vector line for an AIS ship.
 */
function buildShipWakeAndHeadingLine(
  centerLat: number,
  centerLng: number,
  headingDeg: number,
  lengthDeg = 2.4
): Array<{ lat: number; lng: number }> {
  const rad = ((90 - headingDeg) * Math.PI) / 180;
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
  const sternLat = centerLat - lengthDeg * 0.75 * Math.sin(rad);
  const sternLng = centerLng - (lengthDeg * 0.75 * Math.cos(rad)) / cosLat;
  const bowLat = centerLat + lengthDeg * 0.95 * Math.sin(rad);
  const bowLng = centerLng + (lengthDeg * 0.95 * Math.cos(rad)) / cosLat;
  return [
    { lat: Math.max(-85, Math.min(85, sternLat)), lng: sternLng },
    { lat: centerLat, lng: centerLng },
    { lat: Math.max(-85, Math.min(85, bowLat)), lng: bowLng },
  ];
}

/**
 * Strictly removes all 3D overlay child elements from <gmp-map-3d> when switching countries or lenses
 * so old routes, markers, or polygons never linger or block the map.
 */
function clearAllMap3DOverlays(map3d: HTMLElement) {
  try {
    const existing = map3d.querySelectorAll(
      'gmp-polyline-3d, gmp-polyline-3d-interactive, gmp-polygon-3d, gmp-polygon-3d-interactive, gmp-marker-3d, gmp-marker-3d-interactive'
    );
    existing.forEach((el) => {
      try {
        el.remove();
      } catch (_e) {
        // Ignore
      }
    });
  } catch (_err) {
    // Ignore
  }
}

/**
 * Native Google Photorealistic 3D Globe (<gmp-map-3d> / Map3DElement) controller
 * with Live Viewport Zoom/Pan Telemetry, High-Visibility God's Eye AIS Ships,
 * and Strict Overlay Clearing.
 */
const GooglePhotorealistic3DGlobeCanvas: React.FC<{
  selectedCountry: CountryProfile;
  deepProfile: CountrySpecificDeepProfile;
  cameraStage: CameraStageMode;
  activeLens: GlobeLensTabId;
  linksForLens: CrossCountryInteractionLink[];
  activeLinkId: string | null;
  tradeRoutes: CountryTradeRouteCorridor[];
  selectedTradeRouteId: string | null;
  tradeFilterMode: TradeRouteFilterMode;
  weatherRecords: WeatherPatternPredictionRecord[];
  selectedWeatherId?: string;
  selectedVisionTargetId?: string;
  selectedVesselId?: string | null;
  customFocusTarget?: CustomFocusTarget | null;
  onSelectCountry: (isoCode: string) => void;
  onSelectLink: (linkId: string) => void;
  onSelectTradeRoute: (route: CountryTradeRouteCorridor) => void;
  onSelectVessel: (vessel: TrackedMaritimeVessel) => void;
  onShowInfoBanner: (banner: InfoBannerState) => void;
  onGlobeLocationClick: (lat: number, lng: number) => void;
  onViewportCameraChange?: (
    lat: number,
    lng: number,
    rangeMeters: number
  ) => void;
}> = ({
  selectedCountry,
  deepProfile,
  cameraStage,
  activeLens,
  linksForLens,
  activeLinkId,
  tradeRoutes,
  selectedTradeRouteId,
  tradeFilterMode,
  selectedVesselId,
  customFocusTarget,
  onSelectCountry,
  onSelectLink,
  onSelectTradeRoute,
  onSelectVessel,
  onShowInfoBanner,
  onGlobeLocationClick,
  onViewportCameraChange,
}) => {
  const maps3dLib = useMapsLibrary('maps3d') as google.maps.Maps3DLibrary | null;
  const markerLib = useMapsLibrary('marker') as google.maps.MarkerLibrary | null;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const map3dRef = useRef<google.maps.maps3d.Map3DElement | null>(null);
  // Prevents programmatic camera flights (when selecting a ship or country) from triggering a bounce-back
  const programmaticFlyLockUntilRef = useRef<number>(0);
  const lastClickedOverlayAtRef = useRef<number>(0);

  const computeTargetCamera = useCallback(
    (
      profile: CountrySpecificDeepProfile,
      stage: CameraStageMode,
      focus?: CustomFocusTarget | null
    ): google.maps.maps3d.CameraOptions => {
      if (focus) {
        return {
          center: { lat: focus.lat, lng: focus.lng, altitude: 20 },
          range: focus.rangeMeters ?? 1400000,
          tilt: focus.tiltDeg ?? 28,
          heading: 0,
          roll: 0,
        };
      }
      if (stage === 'WORLD_GLOBE') {
        return {
          center: {
            lat: profile.lat,
            lng: profile.lng,
            altitude: 0,
          },
          range: 8800000,
          tilt: 14,
          heading: 0,
          roll: 0,
        };
      }
      if (stage === 'FINANCIAL_CAPITAL_3D') {
        return {
          center: {
            lat: profile.lat,
            lng: profile.lng,
            altitude: 30,
          },
          range: 2400,
          tilt: 60,
          heading: 25,
          roll: 0,
        };
      }
      return {
        center: {
          lat: profile.lat,
          lng: profile.lng,
          altitude: 0,
        },
        range: 2200000,
        tilt: 24,
        heading: 0,
        roll: 0,
      };
    },
    []
  );

  // 1. Mount <gmp-map-3d> (Map3DElement) once when maps3dLib loads
  useEffect(() => {
    const container = hostRef.current;
    if (!container || !maps3dLib) return;

    const initialCamera = computeTargetCamera(
      deepProfile,
      cameraStage,
      customFocusTarget
    );

    const map3d = new maps3dLib.Map3DElement({
      center: initialCamera.center,
      range: initialCamera.range,
      tilt: initialCamera.tilt,
      heading: initialCamera.heading,
      roll: 0,
      mode: 'HYBRID' as google.maps.maps3d.MapMode,
      gestureHandling: 'GREEDY' as google.maps.maps3d.GestureHandling,
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    });

    map3d.style.display = 'block';
    map3d.style.width = '100%';
    map3d.style.height = '100%';

    const handleMapClick = (ev: Event) => {
      // If an overlay (ship, route, or hub) was just clicked within the last 350ms, ignore background map click!
      if (Date.now() - lastClickedOverlayAtRef.current < 350) {
        return;
      }
      const locEv = ev as google.maps.maps3d.LocationClickEvent;
      if (locEv.position) {
        const lat =
          typeof locEv.position.lat === 'number' ? locEv.position.lat : 0;
        const lng =
          typeof locEv.position.lng === 'number' ? locEv.position.lng : 0;
        onGlobeLocationClick(lat, lng);
      }
    };

    const handleCameraSteadyOrChange = () => {
      if (Date.now() < programmaticFlyLockUntilRef.current) {
        return;
      }
      const c = map3d.center;
      const r = typeof map3d.range === 'number' ? map3d.range : 4500000;
      if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
        if (onViewportCameraChange) {
          onViewportCameraChange(c.lat, c.lng, r);
        }
      }
    };

    map3d.addEventListener('gmp-click', handleMapClick);
    map3d.addEventListener('gmp-steadystate', handleCameraSteadyOrChange);
    container.innerHTML = '';
    container.appendChild(map3d);
    map3dRef.current = map3d;

    return () => {
      map3d.removeEventListener('gmp-click', handleMapClick);
      map3d.removeEventListener('gmp-steadystate', handleCameraSteadyOrChange);
      map3dRef.current = null;
      container.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps3dLib]);

  // 2. Smoothly fly the 3D Globe camera when country, camera stage, or focus target changes
  useEffect(() => {
    const map3d = map3dRef.current;
    if (!map3d) return;

    programmaticFlyLockUntilRef.current = Date.now() + 1650;
    const targetCam = computeTargetCamera(
      deepProfile,
      cameraStage,
      customFocusTarget
    );

    try {
      if (typeof map3d.flyCameraTo === 'function') {
        map3d.flyCameraTo({
          endCamera: targetCam,
          durationMillis: 1200,
        });
      } else {
        if (targetCam.center) map3d.center = targetCam.center;
        if (targetCam.range !== undefined) map3d.range = targetCam.range;
        if (targetCam.tilt !== undefined) map3d.tilt = targetCam.tilt;
        if (targetCam.heading !== undefined) map3d.heading = targetCam.heading;
      }
    } catch (_err) {
      if (targetCam.center) map3d.center = targetCam.center;
      if (targetCam.range !== undefined) map3d.range = targetCam.range;
      if (targetCam.tilt !== undefined) map3d.tilt = targetCam.tilt;
      if (targetCam.heading !== undefined) map3d.heading = targetCam.heading;
    }
  }, [deepProfile.iso2, cameraStage, customFocusTarget, computeTargetCamera, deepProfile]);

  // 3. STRICT CLEAR-ON-SWITCH + Render Selected Country Hub, Partner Hubs, Trade Corridors & High-Visibility AIS Ships
  useEffect(() => {
    const map3d = map3dRef.current;
    if (!map3d || !maps3dLib) return;

    clearAllMap3DOverlays(map3d);
    const createdNodes: HTMLElement[] = [];

    const PolylineCtor =
      maps3dLib.Polyline3DInteractiveElement || maps3dLib.Polyline3DElement;
    const PolyCtor =
      maps3dLib.Polygon3DInteractiveElement || maps3dLib.Polygon3DElement;
    const MarkerCtor =
      maps3dLib.Marker3DInteractiveElement || maps3dLib.Marker3DElement;

    const showTradeAndShips =
      activeLens === 'STOCK_INTERACTIONS' ||
      activeLens === 'COMMODITIES_FLOWS' ||
      activeLens === 'PREDICTIONS_NEWS';

    // A. Selected Country Two-Colour Bilateral Trade Routes (Emerald #10b981 for EXPORT | Amber #f59e0b for IMPORT)
    if (PolylineCtor && showTradeAndShips && tradeFilterMode !== 'HIDDEN') {
      const visibleTradeRoutes = tradeRoutes.filter((tr) => {
        if (tradeFilterMode === 'EXPORT_ONLY') return tr.direction === 'EXPORT';
        if (tradeFilterMode === 'IMPORT_ONLY') return tr.direction === 'IMPORT';
        return true;
      });

      visibleTradeRoutes.forEach((route) => {
        const isSelectedRoute = route.id === selectedTradeRouteId;
        const isExport = route.direction === 'EXPORT';
        const strokeColor = isExport
          ? isSelectedRoute
            ? '#34d399'
            : '#10b981'
          : isSelectedRoute
          ? '#fde047'
          : '#f59e0b';

        try {
          const tradeLine = new PolylineCtor({
            strokeColor,
            strokeWidth: isSelectedRoute ? 5.5 : 3.6,
            outerColor: isExport
              ? 'rgba(16, 185, 129, 0.42)'
              : 'rgba(245, 158, 11, 0.42)',
            outerWidth: isSelectedRoute ? 0.55 : 0.3,
            altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
            geodesic: true,
            drawsOccludedSegments: true,
          });
          tradeLine.path = [
            { lat: route.fromLat, lng: route.fromLng },
            { lat: route.toLat, lng: route.toLng },
          ];
          tradeLine.addEventListener('gmp-click', (e: Event) => {
            e.stopPropagation();
            lastClickedOverlayAtRef.current = Date.now();
            onSelectTradeRoute(route);
            onShowInfoBanner({
              badge: `${
                isExport ? 'EXPORT CORRIDOR (EMERALD)' : 'IMPORT CORRIDOR (AMBER)'
              } · $${route.annualVolumeUsdBillions}B/yr · YoY +${route.yoyGrowthPct}%`,
              title: route.headline,
              subtitle: route.plainEnglishSummary,
              metricsPill: `Chokepoint: ${route.chokepointName} (${route.avgTransitDays}d transit) · Watch: ${route.impactedTickersAndFx
                .map((a) => a.symbol)
                .join(', ')}`,
            });
          });
          map3d.appendChild(tradeLine);
          createdNodes.push(tradeLine);
        } catch (_err) {
          // Ignore
        }
      });
    }

    // B. HIGH-VISIBILITY GOD'S EYE AIS MARITIME VESSELS (Directional Ship Hull + Pulsing Radar Ring + Speed Wake + Pin)
    if (PolyCtor && MarkerCtor && showTradeAndShips && tradeFilterMode !== 'HIDDEN') {
      const visibleShips = deepProfile.shipsInAndOut.filter((ship) => {
        if (tradeFilterMode === 'EXPORT_ONLY')
          return ship.direction === 'SHIP_OUT_EXPORT';
        if (tradeFilterMode === 'IMPORT_ONLY')
          return ship.direction === 'SHIP_IN_IMPORT';
        return true;
      });

      visibleShips.forEach((ship) => {
        const isShipOut = ship.direction === 'SHIP_OUT_EXPORT';
        const isSelectedShip = ship.vesselId === selectedVesselId;
        const handleShipClick = (e?: Event) => {
          if (e) e.stopPropagation();
          lastClickedOverlayAtRef.current = Date.now();
          onSelectVessel(ship);
          onShowInfoBanner({
            badge: `${
              isShipOut ? '▲ AIS SHIP OUT (EXPORT · EMERALD)' : '▼ AIS SHIP IN (IMPORT · AMBER)'
            } · ${ship.speedKnots} kn · Hdg ${ship.headingDeg}°`,
            title: `${ship.vesselName} (${ship.vesselTypeClass})`,
            subtitle: `Route: ${ship.originPort} → ${ship.destinationPort} · Carrying ${ship.cargoDescription} ($${ship.estimatedCargoValueUsdM}M est. cargo) · ETA ${ship.etaLabel}`,
            metricsPill: `Chokepoint: ${ship.chokepointName} · Partner: ${ship.partnerCountryName} (${ship.partnerIso2})`,
            aisDetails: {
              imo: ship.imoNumber,
              mmsi: ship.mmsiNumber,
              callsign: ship.callsign,
              vesselClass: `${ship.vesselTypeClass} · ${ship.deadweightTonnageDwt}`,
              draught: ship.draughtMeters,
              navStatus: ship.aisNavStatus,
              aiSignal: ship.aiSurveillanceSignal,
            },
          });
        };

        try {
          // 1. AIS Wake & Forward Course Vector Line
          if (PolylineCtor) {
            const wakeLine = new PolylineCtor({
              strokeColor: isSelectedShip ? '#ffffff' : ship.colorHex,
              strokeWidth: isSelectedShip ? 4.0 : 2.6,
              outerColor: isShipOut
                ? 'rgba(16, 185, 129, 0.5)'
                : 'rgba(245, 158, 11, 0.5)',
              outerWidth: 0.35,
              altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
              geodesic: true,
              drawsOccludedSegments: true,
            });
            wakeLine.path = buildShipWakeAndHeadingLine(
              ship.lat,
              ship.lng,
              ship.headingDeg,
              2.2
            );
            wakeLine.addEventListener('gmp-click', handleShipClick);
            map3d.appendChild(wakeLine);
            createdNodes.push(wakeLine);
          }

          // 2. Outer Glowing AIS Radar Surveillance Ring (large enough to see clearly from space!)
          const shipRadarRing = new PolyCtor({
            strokeColor: isSelectedShip ? '#22d3ee' : ship.colorHex,
            strokeWidth: isSelectedShip ? 3.2 : 2.2,
            fillColor: isShipOut
              ? 'rgba(16, 185, 129, 0.32)'
              : 'rgba(245, 158, 11, 0.32)',
            altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
            geodesic: true,
            drawsOccludedSegments: true,
          });
          shipRadarRing.path = buildGlowingOrbCircleCoords(
            ship.lat,
            ship.lng,
            isSelectedShip ? 1.45 : 1.1
          );
          shipRadarRing.addEventListener('gmp-click', handleShipClick);
          map3d.appendChild(shipRadarRing);
          createdNodes.push(shipRadarRing);

          // 3. Directional Ship Hull Chevron Polygon oriented along headingDeg
          const shipHullPoly = new PolyCtor({
            strokeColor: '#ffffff',
            strokeWidth: 2.2,
            fillColor: isSelectedShip ? '#22d3ee' : ship.colorHex,
            altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
            geodesic: true,
            drawsOccludedSegments: true,
          });
          shipHullPoly.path = buildDirectionalShipHullCoords(
            ship.lat,
            ship.lng,
            ship.headingDeg,
            isSelectedShip ? 0.95 : 0.75
          );
          shipHullPoly.addEventListener('gmp-click', handleShipClick);
          map3d.appendChild(shipHullPoly);
          createdNodes.push(shipHullPoly);

          // 4. Elevated AIS Transponder Callout Pin
          const shipMarker = new MarkerCtor({
            position: { lat: ship.lat, lng: ship.lng, altitude: 120 },
            altitudeMode:
              'RELATIVE_TO_GROUND' as google.maps.maps3d.AltitudeMode,
            extruded: true,
            label: `${isShipOut ? '🚢 ▲ OUT' : '🚢 ▼ IN'} ${ship.vesselName} (${ship.speedKnots}kn)`,
            title: `${ship.vesselName} · ${ship.imoNumber} · ${ship.cargoDescription}`,
          });

          if (markerLib?.PinElement) {
            const pin = new markerLib.PinElement({
              scale: isSelectedShip ? 0.95 : 0.78,
              background: isSelectedShip ? '#22d3ee' : ship.colorHex,
              borderColor: '#ffffff',
              glyphColor: '#020617',
            });
            shipMarker.append(pin);
          }

          shipMarker.addEventListener('gmp-click', handleShipClick);
          map3d.appendChild(shipMarker);
          createdNodes.push(shipMarker);
        } catch (_err) {
          // Ignore
        }
      });
    }

    // C. Selected Country Primary Glowing Hub + Connected Partner Hubs
    if (PolyCtor && cameraStage !== 'FINANCIAL_CAPITAL_3D') {
      const hubsToRender: Array<{
        iso2: string;
        name: string;
        hubLabel: string;
        lat: number;
        lng: number;
        isPrimary: boolean;
        directionTag?: string;
      }> = [
        {
          iso2: deepProfile.iso2,
          name: deepProfile.countryName,
          hubLabel: deepProfile.financialHubCity,
          lat: deepProfile.lat,
          lng: deepProfile.lng,
          isPrimary: true,
        },
      ];

      if (showTradeAndShips) {
        const seenPartnerIsos = new Set<string>([deepProfile.iso2]);
        tradeRoutes.forEach((r) => {
          if (!seenPartnerIsos.has(r.partnerIso2)) {
            seenPartnerIsos.add(r.partnerIso2);
            const partnerLat = r.direction === 'EXPORT' ? r.toLat : r.fromLat;
            const partnerLng = r.direction === 'EXPORT' ? r.toLng : r.fromLng;
            hubsToRender.push({
              iso2: r.partnerIso2,
              name: r.partnerCountryName,
              hubLabel: r.partnerHubName,
              lat: partnerLat,
              lng: partnerLng,
              isPrimary: false,
              directionTag:
                r.direction === 'EXPORT' ? 'EXPORT PARTNER' : 'IMPORT PARTNER',
            });
          }
        });
      }

      hubsToRender.forEach((hub) => {
        const haloRadius = hub.isPrimary ? 2.1 : 1.3;
        const coreRadius = hub.isPrimary ? 0.68 : 0.42;
        const colorHex = hub.isPrimary
          ? '#22d3ee'
          : hub.directionTag === 'EXPORT PARTNER'
          ? '#10b981'
          : '#f59e0b';

        const handleHubClick = (e?: Event) => {
          if (e) e.stopPropagation();
          lastClickedOverlayAtRef.current = Date.now();
          if (!hub.isPrimary) {
            onSelectCountry(hub.iso2);
          }
          onShowInfoBanner({
            badge: hub.isPrimary
              ? `SELECTED COUNTRY HUB · ${hub.iso2} · ${deepProfile.currencyCode}`
              : `${hub.directionTag} · ${hub.iso2}`,
            title: `${hub.hubLabel} (${hub.name})`,
            subtitle: hub.isPrimary
              ? `${deepProfile.stocksProfile.centralBankName} (${deepProfile.stocksProfile.policyRateLabel}) · ${deepProfile.weatherProfile.instituteAcronym}: ${deepProfile.weatherProfile.currentSeasonalPatternTitle}`
              : `Switched workspace to connected trade partner ${hub.name} (${hub.iso2}).`,
            metricsPill: hub.isPrimary
              ? `${deepProfile.stocksProfile.benchmarkIndexName}: ${deepProfile.stocksProfile.benchmarkSpot} · ${deepProfile.fxPairLabel}`
              : `Connected Trade Hub for ${deepProfile.countryName}`,
          });
        };

        try {
          const haloPoly = new PolyCtor({
            strokeColor: hub.isPrimary ? '#fef08a' : colorHex,
            strokeWidth: hub.isPrimary ? 2.5 : 1.5,
            fillColor: hub.isPrimary
              ? 'rgba(34, 211, 238, 0.35)'
              : 'rgba(16, 185, 129, 0.25)',
            altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
            geodesic: true,
            drawsOccludedSegments: true,
          });
          haloPoly.path = buildGlowingOrbCircleCoords(
            hub.lat,
            hub.lng,
            haloRadius
          );
          haloPoly.addEventListener('gmp-click', handleHubClick);
          map3d.appendChild(haloPoly);
          createdNodes.push(haloPoly);

          const corePoly = new PolyCtor({
            strokeColor: '#ffffff',
            strokeWidth: hub.isPrimary ? 2.0 : 1.2,
            fillColor: hub.isPrimary ? '#fef08a' : colorHex,
            altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
            geodesic: true,
            drawsOccludedSegments: true,
          });
          corePoly.path = buildGlowingOrbCircleCoords(
            hub.lat,
            hub.lng,
            coreRadius
          );
          corePoly.addEventListener('gmp-click', handleHubClick);
          map3d.appendChild(corePoly);
          createdNodes.push(corePoly);

          if (MarkerCtor) {
            const marker = new MarkerCtor({
              position: {
                lat: hub.lat,
                lng: hub.lng,
                altitude: hub.isPrimary ? 140 : 60,
              },
              altitudeMode:
                'RELATIVE_TO_GROUND' as google.maps.maps3d.AltitudeMode,
              extruded: false,
              label: `${hub.hubLabel.split('(')[0].trim()} (${hub.iso2})`,
              title: `${hub.hubLabel} (${hub.name})`,
            });

            if (markerLib?.PinElement) {
              const pin = new markerLib.PinElement({
                scale: hub.isPrimary ? 0.68 : 0.52,
                background: hub.isPrimary ? '#facc15' : colorHex,
                borderColor: '#ffffff',
                glyphColor: '#020617',
              });
              marker.append(pin);
            }

            marker.addEventListener('gmp-click', handleHubClick);
            map3d.appendChild(marker);
            createdNodes.push(marker);
          }
        } catch (_err) {
          // Ignore
        }
      });
    }

    // D. Country-Dependent Weather Pattern Overlay when WEATHER_PATTERNS Lens is Active
    if (PolyCtor && activeLens === 'WEATHER_PATTERNS') {
      const wx = deepProfile.weatherProfile;
      try {
        const wxHalo = new PolyCtor({
          strokeColor: '#c084fc',
          strokeWidth: 3.2,
          fillColor: 'rgba(192, 132, 252, 0.32)',
          altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
          geodesic: true,
          drawsOccludedSegments: true,
        });
        wxHalo.path = buildGlowingOrbCircleCoords(
          wx.visualReconScene.lat,
          wx.visualReconScene.lng,
          3.1
        );
        wxHalo.addEventListener('gmp-click', (e: Event) => {
          e.stopPropagation();
          lastClickedOverlayAtRef.current = Date.now();
          onShowInfoBanner({
            badge: `${wx.instituteAcronym} METEOROLOGICAL TELEMETRY · ${deepProfile.iso2}`,
            title: wx.currentSeasonalPatternTitle,
            subtitle: wx.expectedPatternForecast,
            metricsPill: `${wx.temperatureAnomalyC} · ${wx.precipitationOrHydroAnomalyPct}`,
          });
        });
        map3d.appendChild(wxHalo);
        createdNodes.push(wxHalo);
      } catch (_err) {
        // Ignore
      }
    }

    // E. Country-Dependent Street/Satellite Vision Recon Ring when STREET_VISION_AI Lens is Active
    if (PolyCtor && activeLens === 'STREET_VISION_AI') {
      const scene = deepProfile.stocksProfile.visualReconScene;
      try {
        const camRing = new PolyCtor({
          strokeColor: '#22d3ee',
          strokeWidth: 3.2,
          fillColor: 'rgba(34, 211, 238, 0.35)',
          altitudeMode: 'CLAMP_TO_GROUND' as google.maps.maps3d.AltitudeMode,
          geodesic: true,
          drawsOccludedSegments: true,
        });
        camRing.path = buildGlowingOrbCircleCoords(scene.lat, scene.lng, 2.2);
        camRing.addEventListener('gmp-click', (e: Event) => {
          e.stopPropagation();
          lastClickedOverlayAtRef.current = Date.now();
          onShowInfoBanner({
            badge: `OPTICAL AI RECON · ${deepProfile.iso2}`,
            title: scene.sceneTitle,
            subtitle: scene.aiVisualInterpretation,
            metricsPill: `${scene.opticalAiHeadline} · ${scene.opticalAiMetricBadge}`,
          });
        });
        map3d.appendChild(camRing);
        createdNodes.push(camRing);
      } catch (_err) {
        // Ignore
      }
    }

    return () => {
      createdNodes.forEach((node) => {
        try {
          node.remove();
        } catch (_err) {
          // Ignore
        }
      });
      clearAllMap3DOverlays(map3d);
    };
  }, [
    maps3dLib,
    markerLib,
    selectedCountry,
    deepProfile,
    cameraStage,
    activeLens,
    linksForLens,
    activeLinkId,
    tradeRoutes,
    selectedTradeRouteId,
    tradeFilterMode,
    selectedVesselId,
    onSelectCountry,
    onSelectLink,
    onSelectTradeRoute,
    onSelectVessel,
    onShowInfoBanner,
  ]);

  return <div ref={hostRef} className="w-full h-full" />;
};

/**
 * 2D Hybrid Map Controller with Strict Overlay Clearing + Live Viewport Zoom Listener
 */
const GoogleMap2DOverlaysController: React.FC<{
  deepProfile: CountrySpecificDeepProfile;
  cameraStage: CameraStageMode;
  activeLens: GlobeLensTabId;
  tradeRoutes: CountryTradeRouteCorridor[];
  selectedTradeRouteId: string | null;
  tradeFilterMode: TradeRouteFilterMode;
  onSelectTradeRoute: (route: CountryTradeRouteCorridor) => void;
  customFocusTarget?: CustomFocusTarget | null;
  onViewportCameraChange?: (
    lat: number,
    lng: number,
    rangeMeters: number
  ) => void;
}> = ({
  deepProfile,
  cameraStage,
  activeLens,
  tradeRoutes,
  selectedTradeRouteId,
  tradeFilterMode,
  onSelectTradeRoute,
  customFocusTarget,
  onViewportCameraChange,
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const programmaticPanLockRef = useRef<number>(0);

  useEffect(() => {
    if (!map) return;
    programmaticPanLockRef.current = Date.now() + 1200;

    if (customFocusTarget) {
      map.panTo({ lat: customFocusTarget.lat, lng: customFocusTarget.lng });
      map.setZoom(customFocusTarget.zoomLevel ?? 6);
      return;
    }

    if (cameraStage === 'WORLD_GLOBE') {
      map.panTo({ lat: deepProfile.lat, lng: deepProfile.lng });
      map.setZoom(4);
      map.setTilt(0);
      return;
    }

    map.panTo({ lat: deepProfile.lat, lng: deepProfile.lng });
    map.setZoom(cameraStage === 'FINANCIAL_CAPITAL_3D' ? 15 : 6);
  }, [map, deepProfile.iso2, deepProfile.lat, deepProfile.lng, cameraStage, customFocusTarget]);

  useEffect(() => {
    if (!map || !onViewportCameraChange) return;
    const listener = map.addListener('idle', () => {
      if (Date.now() < programmaticPanLockRef.current) return;
      const c = map.getCenter();
      const z = map.getZoom() ?? 4;
      if (c) {
        // Approximate altitude in meters from Google Maps zoom level
        const approxRangeMeters = Math.round(35000000 / Math.pow(2, z - 1));
        onViewportCameraChange(c.lat(), c.lng(), approxRangeMeters);
      }
    });
    return () => {
      listener.remove();
    };
  }, [map, onViewportCameraChange]);

  useEffect(() => {
    if (!map || !mapsLib) return;
    const createdPolylines: google.maps.Polyline[] = [];

    const showTrade =
      activeLens === 'STOCK_INTERACTIONS' ||
      activeLens === 'COMMODITIES_FLOWS' ||
      activeLens === 'PREDICTIONS_NEWS';

    if (showTrade && tradeFilterMode !== 'HIDDEN') {
      const visibleTradeRoutes = tradeRoutes.filter((tr) => {
        if (tradeFilterMode === 'EXPORT_ONLY') return tr.direction === 'EXPORT';
        if (tradeFilterMode === 'IMPORT_ONLY') return tr.direction === 'IMPORT';
        return true;
      });
      visibleTradeRoutes.forEach((route) => {
        const isSelected = route.id === selectedTradeRouteId;
        const isExport = route.direction === 'EXPORT';
        const line = new mapsLib.Polyline({
          path: [
            { lat: route.fromLat, lng: route.fromLng },
            { lat: route.toLat, lng: route.toLng },
          ],
          geodesic: true,
          strokeColor: isExport ? '#10b981' : '#f59e0b',
          strokeOpacity: isSelected ? 0.98 : 0.85,
          strokeWeight: isSelected ? 4.8 : 3.4,
          map,
        });
        line.addListener('click', () => {
          onSelectTradeRoute(route);
        });
        createdPolylines.push(line);
      });
    }

    return () => {
      createdPolylines.forEach((l) => l.setMap(null));
    };
  }, [
    map,
    mapsLib,
    deepProfile,
    activeLens,
    tradeRoutes,
    selectedTradeRouteId,
    tradeFilterMode,
    onSelectTradeRoute,
  ]);

  return null;
};

export const WorldPulseGlobe3D: React.FC<WorldPulseGlobe3DProps> = ({
  selectedCountry,
  deepProfile,
  onSelectCountry,
  activeLens,
  onSelectLens,
  activeLinkId,
  onSelectLink,
  selectedWeatherId,
  onSelectWeather,
  countryTradeRoutes,
  selectedTradeRouteId,
  onSelectTradeRoute,
  tradeFilterMode,
  onChangeTradeFilterMode,
  selectedVisionTargetId,
  customFocusTarget,
  selectedVesselId,
  onSelectVessel,
  onViewportCameraChange,
}) => {
  const [runtimeMapsKey, setRuntimeMapsKey] = useState<string>(API_KEY);
  const [renderEngine, setRenderEngine] = useState<
    'GOOGLE_3D_GLOBE' | 'GOOGLE_HYBRID_MAP'
  >('GOOGLE_3D_GLOBE');
  const [cameraStage, setCameraStage] = useState<CameraStageMode>('WORLD_GLOBE');
  const [activeInfoBanner, setActiveInfoBanner] =
    useState<InfoBannerState | null>(null);
  const [internalSelectedVesselId, setInternalSelectedVesselId] = useState<
    string | null
  >(null);

  const activeVesselId = selectedVesselId ?? internalSelectedVesselId;

  // Clear floating banner when switching countries so nothing stale remains
  useEffect(() => {
    setActiveInfoBanner(null);
  }, [deepProfile.iso2, activeLens]);

  useEffect(() => {
    if (runtimeMapsKey) return;
    fetch('/api/worldpulse/v3/bootstrap')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.googleMapsApiKey) {
          setRuntimeMapsKey(String(data.googleMapsApiKey));
        }
      })
      .catch(() => {
        // Keep fallback
      });
  }, [runtimeMapsKey]);

  // Fixed: Uses full GLOBAL_COUNTRY_DIRECTORY (46+ countries) and never snaps erroneously to London when clicking near ships!
  const handleGlobeLocationClick = useCallback(
    (lat: number, lng: number) => {
      // Check if click was actually near one of the current country's ships first
      for (const ship of deepProfile.shipsInAndOut) {
        const dShip = Math.hypot(ship.lat - lat, ship.lng - lng);
        if (dShip < 2.2) {
          setInternalSelectedVesselId(ship.vesselId);
          if (onSelectVessel) onSelectVessel(ship);
          const isOut = ship.direction === 'SHIP_OUT_EXPORT';
          setActiveInfoBanner({
            badge: `${
              isOut
                ? '▲ AIS SHIP OUT (EXPORT · EMERALD)'
                : '▼ AIS SHIP IN (IMPORT · AMBER)'
            } · ${ship.speedKnots} kn · Hdg ${ship.headingDeg}°`,
            title: `${ship.vesselName} (${ship.vesselTypeClass})`,
            subtitle: `Route: ${ship.originPort} → ${ship.destinationPort} · Cargo: ${ship.cargoDescription} ($${ship.estimatedCargoValueUsdM}M est.) · ETA ${ship.etaLabel}`,
            metricsPill: `Chokepoint: ${ship.chokepointName} · Partner: ${ship.partnerCountryName} (${ship.partnerIso2})`,
            aisDetails: {
              imo: ship.imoNumber,
              mmsi: ship.mmsiNumber,
              callsign: ship.callsign,
              vesselClass: `${ship.vesselTypeClass} · ${ship.deadweightTonnageDwt}`,
              draught: ship.draughtMeters,
              navStatus: ship.aisNavStatus,
              aiSignal: ship.aiSurveillanceSignal,
            },
          });
          return;
        }
      }

      const nearest = resolveNearestCountryFromViewport(lat, lng);
      if (nearest.distanceKm < 850 && nearest.seed.iso2 !== deepProfile.iso2) {
        onSelectCountry(nearest.seed.iso2);
      } else if (onViewportCameraChange) {
        onViewportCameraChange(lat, lng, 950000);
      }
    },
    [deepProfile.shipsInAndOut, deepProfile.iso2, onSelectCountry, onSelectVessel, onViewportCameraChange]
  );

  const handleSelectShipAndFly = useCallback(
    (ship: TrackedMaritimeVessel) => {
      setInternalSelectedVesselId(ship.vesselId);
      if (onSelectVessel) {
        onSelectVessel(ship);
      }
      const isOut = ship.direction === 'SHIP_OUT_EXPORT';
      setActiveInfoBanner({
        badge: `${
          isOut
            ? '▲ AIS SHIP OUT (EXPORT · EMERALD)'
            : '▼ AIS SHIP IN (IMPORT · AMBER)'
        } · ${ship.speedKnots} kn · Hdg ${ship.headingDeg}°`,
        title: `${ship.vesselName} (${ship.vesselTypeClass})`,
        subtitle: `Route: ${ship.originPort} → ${ship.destinationPort} · Cargo: ${ship.cargoDescription} ($${ship.estimatedCargoValueUsdM}M est.) · ETA ${ship.etaLabel}`,
        metricsPill: `Chokepoint: ${ship.chokepointName} · Partner: ${ship.partnerCountryName} (${ship.partnerIso2})`,
        aisDetails: {
          imo: ship.imoNumber,
          mmsi: ship.mmsiNumber,
          callsign: ship.callsign,
          vesselClass: `${ship.vesselTypeClass} · ${ship.deadweightTonnageDwt}`,
          draught: ship.draughtMeters,
          navStatus: ship.aisNavStatus,
          aiSignal: ship.aiSurveillanceSignal,
        },
      });
    },
    [onSelectVessel]
  );

  const lensTabs: Array<{
    id: GlobeLensTabId;
    label: string;
    shortSub: string;
    dotColor: string;
  }> = [
    {
      id: 'STOCK_INTERACTIONS',
      label: 'Stocks & Policy',
      shortSub: `${deepProfile.stocksProfile.benchmarkIndexName} · ${deepProfile.stocksProfile.centralBankName.split('(')[0].trim()}`,
      dotColor: 'bg-cyan-400',
    },
    {
      id: 'COMMODITIES_FLOWS',
      label: 'Commodities & AIS Ships',
      shortSub: `${deepProfile.shipsInAndOut.length} Active AIS Ships · Trade Corridors`,
      dotColor: 'bg-emerald-400',
    },
    {
      id: 'WEATHER_PATTERNS',
      label: `Weather (${deepProfile.weatherProfile.instituteAcronym})`,
      shortSub: `${deepProfile.weatherProfile.precipitationOrHydroAnomalyPct}`,
      dotColor: 'bg-purple-400',
    },
    {
      id: 'PREDICTIONS_NEWS',
      label: 'Predictions & News',
      shortSub: `${deepProfile.countryName} Live Catalysts`,
      dotColor: 'bg-amber-400',
    },
    {
      id: 'STREET_VISION_AI',
      label: 'God’s Eye Street & Cam AI',
      shortSub: `Overlaid Recon (${deepProfile.stocksProfile.supermarketOccupancyPct}% Lot)`,
      dotColor: 'bg-rose-400',
    },
  ];

  const shipsOutCount = useMemo(
    () =>
      deepProfile.shipsInAndOut.filter(
        (s) => s.direction === 'SHIP_OUT_EXPORT'
      ).length,
    [deepProfile.shipsInAndOut]
  );
  const shipsInCount = useMemo(
    () =>
      deepProfile.shipsInAndOut.filter(
        (s) => s.direction === 'SHIP_IN_IMPORT'
      ).length,
    [deepProfile.shipsInAndOut]
  );

  return (
    <div className="w-full max-w-full rounded-2xl bg-[#040711] border border-slate-800/90 overflow-hidden shadow-2xl flex flex-col select-none">
      {/* Top Command Header: Country-Specific Pulse + 5 Country-Synced Lens Tabs */}
      <div className="bg-slate-950/95 border-b border-slate-800/90 px-3.5 sm:px-4 py-3 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Active Country Summary */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                {deepProfile.countryName} ({deepProfile.iso2})
              </span>
              <span className="text-xs text-slate-400">
                · {deepProfile.financialHubCity}
              </span>
              <span className="text-xs font-mono tabular-nums text-cyan-300">
                · {deepProfile.stocksProfile.benchmarkIndexName}{' '}
                {deepProfile.stocksProfile.benchmarkSpot} (+
                {deepProfile.stocksProfile.mtdTrendPct}%)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-mono tabular-nums">
              <span className="text-slate-300">{deepProfile.fxPairLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-300">
                {deepProfile.stocksProfile.centralBankName}:{' '}
                {deepProfile.stocksProfile.policyRateLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-purple-300">
                Met: {deepProfile.weatherProfile.instituteAcronym}
              </span>
            </div>
          </div>

          {/* Camera Zoom Stage & 3D Globe Engine Switch */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <div
              role="group"
              aria-label="Globe Camera Zoom Presets"
              className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5"
            >
              <button
                type="button"
                onClick={() => setCameraStage('WORLD_GLOBE')}
                className={`px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraStage === 'WORLD_GLOBE'
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Full Earth
              </button>
              <button
                type="button"
                onClick={() => setCameraStage('COUNTRY_VIEW')}
                className={`px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraStage === 'COUNTRY_VIEW'
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {deepProfile.iso2} Region &amp; Ships
              </button>
              <button
                type="button"
                onClick={() => setCameraStage('FINANCIAL_CAPITAL_3D')}
                className={`px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraStage === 'FINANCIAL_CAPITAL_3D'
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {deepProfile.capitalCity} 3D
              </button>
            </div>

            <div
              role="group"
              aria-label="Google Map Rendering Mode"
              className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5"
            >
              <button
                type="button"
                onClick={() => setRenderEngine('GOOGLE_3D_GLOBE')}
                className={`px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  renderEngine === 'GOOGLE_3D_GLOBE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                3D Globe
              </button>
              <button
                type="button"
                onClick={() => setRenderEngine('GOOGLE_HYBRID_MAP')}
                className={`px-2 sm:px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  renderEngine === 'GOOGLE_HYBRID_MAP'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2D Map
              </button>
            </div>
          </div>
        </div>

        {/* 5 Interactive Lens Tabs (Responsive across Mobile 2-col, Tablet 3-col, Website 5-col) */}
        <div
          role="tablist"
          aria-label="Global Intelligence Lens Switcher"
          className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
        >
          {lensTabs.map((tab) => {
            const isActive = activeLens === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectLens(tab.id)}
                className={`text-left px-3 py-2 rounded-xl border transition-all min-w-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900/95 border-cyan-400/70 shadow-md'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div
                  className={`text-xs font-bold truncate ${
                    isActive ? 'text-cyan-300' : 'text-slate-200'
                  }`}
                >
                  {tab.label}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {tab.shortSub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Google Photorealistic 3D Globe Viewport (Ergonomic Height on Mobile, Tablet & Desktop) */}
      <div className="relative w-full h-[380px] sm:h-[460px] lg:h-[520px] bg-[#03060f]">
        {/* God's Eye AIS Maritime Transponder / Spatial HUD Overlay */}
        {activeInfoBanner && (
          <div className="absolute top-2.5 left-2.5 right-2.5 sm:right-auto sm:max-w-md z-20 bg-slate-950/95 backdrop-blur-md border border-cyan-400/60 rounded-xl p-3 sm:p-3.5 shadow-2xl space-y-2 max-h-[85%] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase truncate">
                {activeInfoBanner.badge}
              </span>
              <button
                type="button"
                onClick={() => setActiveInfoBanner(null)}
                className="text-xs text-slate-400 hover:text-slate-200 font-mono shrink-0 px-1.5 py-0.5 cursor-pointer"
              >
                Close [×]
              </button>
            </div>
            <div className="text-xs sm:text-sm font-bold text-white">
              {activeInfoBanner.title}
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              {activeInfoBanner.subtitle}
            </div>
            {activeInfoBanner.aisDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono tabular-nums bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                <div className="truncate">
                  <span className="text-slate-400">ID:</span>{' '}
                  <span className="text-cyan-300">
                    {activeInfoBanner.aisDetails.imo} · {activeInfoBanner.aisDetails.mmsi}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">CALLSIGN:</span>{' '}
                  <span className="text-white">{activeInfoBanner.aisDetails.callsign}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">DRAUGHT:</span>{' '}
                  <span className="text-emerald-300">
                    {activeInfoBanner.aisDetails.draught}
                  </span>
                </div>
                <div className="truncate">
                  <span className="text-slate-400">STATUS:</span>{' '}
                  <span className="text-amber-300">
                    {activeInfoBanner.aisDetails.navStatus.slice(0, 32)}
                  </span>
                </div>
                <div className="sm:col-span-2 pt-1 border-t border-slate-800 text-slate-200 font-sans text-[11px]">
                  <strong className="text-cyan-300 font-mono">
                    GOD&apos;S EYE AI SURVEILLANCE:
                  </strong>{' '}
                  {activeInfoBanner.aisDetails.aiSignal}
                </div>
              </div>
            )}
            {activeInfoBanner.metricsPill && (
              <div className="pt-1.5 border-t border-slate-800/80 text-[11px] font-mono text-cyan-300">
                {activeInfoBanner.metricsPill}
              </div>
            )}
          </div>
        )}

        {/* Colour-Coded Trade & Ships In/Out Legend + Filter in Bottom-Left Corner */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 backdrop-blur-sm border border-slate-800/90 text-[11px] text-slate-200">
          <span className="font-semibold text-cyan-300 whitespace-nowrap">
            {deepProfile.countryName} ({deepProfile.iso2})
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeTradeFilterMode(
                tradeFilterMode === 'EXPORT_ONLY' ? 'ALL' : 'EXPORT_ONLY'
              )
            }
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              tradeFilterMode === 'EXPORT_ONLY'
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold'
                : 'bg-slate-900/80 border-slate-700 text-emerald-300 hover:border-emerald-400'
            }`}
          >
            <span className="w-3 h-1.5 rounded bg-emerald-400 inline-block shrink-0" />
            <span>Exports &amp; {shipsOutCount} Ships Out</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeTradeFilterMode(
                tradeFilterMode === 'IMPORT_ONLY' ? 'ALL' : 'IMPORT_ONLY'
              )
            }
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border transition-colors whitespace-nowrap cursor-pointer ${
              tradeFilterMode === 'IMPORT_ONLY'
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                : 'bg-slate-900/80 border-slate-700 text-amber-300 hover:border-amber-400'
            }`}
          >
            <span className="w-3 h-1.5 rounded bg-amber-400 inline-block shrink-0" />
            <span>Imports &amp; {shipsInCount} Ships In</span>
          </button>
          {tradeFilterMode !== 'ALL' && (
            <button
              type="button"
              onClick={() => onChangeTradeFilterMode('ALL')}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300 hover:text-white whitespace-nowrap cursor-pointer"
            >
              Show All
            </button>
          )}
        </div>

        {runtimeMapsKey ? (
          <APIProvider
            apiKey={runtimeMapsKey}
            version="alpha"
            libraries={['maps3d', 'marker', 'maps', 'geocoding', 'places']}
          >
            {renderEngine === 'GOOGLE_3D_GLOBE' ? (
              <GooglePhotorealistic3DGlobeCanvas
                selectedCountry={selectedCountry}
                deepProfile={deepProfile}
                cameraStage={cameraStage}
                activeLens={activeLens}
                linksForLens={deepProfile.countryInteractionLinks}
                activeLinkId={activeLinkId}
                tradeRoutes={countryTradeRoutes}
                selectedTradeRouteId={selectedTradeRouteId}
                tradeFilterMode={tradeFilterMode}
                weatherRecords={[]}
                selectedWeatherId={selectedWeatherId}
                selectedVisionTargetId={selectedVisionTargetId}
                selectedVesselId={activeVesselId}
                customFocusTarget={customFocusTarget}
                onSelectCountry={onSelectCountry}
                onSelectLink={onSelectLink}
                onSelectTradeRoute={onSelectTradeRoute}
                onSelectVessel={handleSelectShipAndFly}
                onShowInfoBanner={setActiveInfoBanner}
                onGlobeLocationClick={handleGlobeLocationClick}
                onViewportCameraChange={onViewportCameraChange}
              />
            ) : (
              <GoogleMap
                defaultCenter={{
                  lat: deepProfile.lat,
                  lng: deepProfile.lng,
                }}
                defaultZoom={4}
                mapId="DEMO_MAP_ID"
                mapTypeId="hybrid"
                gestureHandling="greedy"
                disableDefaultUI={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                onClick={(e) => {
                  if (e.detail?.latLng) {
                    handleGlobeLocationClick(
                      e.detail.latLng.lat,
                      e.detail.latLng.lng
                    );
                  }
                }}
                className="w-full h-full"
              >
                <GoogleMap2DOverlaysController
                  deepProfile={deepProfile}
                  cameraStage={cameraStage}
                  activeLens={activeLens}
                  tradeRoutes={countryTradeRoutes}
                  selectedTradeRouteId={selectedTradeRouteId}
                  tradeFilterMode={tradeFilterMode}
                  onSelectTradeRoute={onSelectTradeRoute}
                  customFocusTarget={customFocusTarget}
                  onViewportCameraChange={onViewportCameraChange}
                />

                {/* Primary Selected Country Marker */}
                <AdvancedMarker
                  position={{ lat: deepProfile.lat, lng: deepProfile.lng }}
                  onClick={() => onSelectCountry(deepProfile.iso2)}
                >
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 border bg-slate-950/95 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.65)] scale-105">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                    <span className="text-[11px] font-semibold">
                      {deepProfile.countryName} ({deepProfile.iso2})
                    </span>
                  </div>
                </AdvancedMarker>

                {/* High-Visibility God's Eye AIS Ships In / Ships Out on 2D Map */}
                {deepProfile.shipsInAndOut.map((ship: TrackedMaritimeVessel) => {
                  const isOut = ship.direction === 'SHIP_OUT_EXPORT';
                  const isSelected = ship.vesselId === activeVesselId;
                  return (
                    <AdvancedMarker
                      key={ship.vesselId}
                      position={{ lat: ship.lat, lng: ship.lng }}
                      onClick={() => handleSelectShipAndFly(ship)}
                    >
                      <div
                        className={`px-2.5 py-1 rounded-full border-2 text-[11px] font-mono font-bold shadow-lg cursor-pointer transition-transform ${
                          isSelected ? 'scale-125 ring-2 ring-cyan-300' : 'hover:scale-110'
                        } ${
                          isOut
                            ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200 shadow-emerald-500/40'
                            : 'bg-amber-950/95 border-amber-400 text-amber-200 shadow-amber-500/40'
                        }`}
                      >
                        {isOut ? '▲ OUT' : '▼ IN'} {ship.vesselName} ·{' '}
                        {ship.speedKnots}kn
                      </div>
                    </AdvancedMarker>
                  );
                })}
              </GoogleMap>
            )}
          </APIProvider>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            Initializing Google Photorealistic 3D Globe...
          </div>
        )}
      </div>

      {/* Bottom Bar: Responsive Grid of Active God's Eye AIS Maritime Transponder Vessels (1 col Mobile, 2 col Tablet, 3 col Desktop) */}
      <div className="bg-slate-950 border-t border-slate-800/90 px-3.5 py-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
          <span className="text-cyan-300 font-bold">
            GOD&apos;S EYE AIS MARITIME SURVEILLANCE · {deepProfile.countryName.toUpperCase()} ({deepProfile.shipsInAndOut.length} ACTIVE TRANSPONDERS)
          </span>
          <span>Tap or click any vessel to lock 3D Globe &amp; Optical Camera</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {deepProfile.shipsInAndOut.map((ship) => {
            const isOut = ship.direction === 'SHIP_OUT_EXPORT';
            const isSelected = ship.vesselId === activeVesselId;
            return (
              <button
                key={ship.vesselId}
                type="button"
                onClick={() => handleSelectShipAndFly(ship)}
                className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[11px] font-mono tabular-nums border transition-all cursor-pointer min-w-0 ${
                  isSelected
                    ? 'bg-cyan-500/25 border-cyan-300 text-white ring-1 ring-cyan-400 font-bold'
                    : isOut
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 border-amber-500/40 text-amber-200 hover:bg-amber-500/20'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="shrink-0 font-bold">
                    {isOut ? '▲ OUT' : '▼ IN'}
                  </span>
                  <span className="font-bold text-white truncate">
                    {ship.vesselName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                  <span className="text-cyan-300">
                    {ship.speedKnots}kn · ${ship.estimatedCargoValueUsdM}M
                  </span>
                  <span className="text-slate-400">({ship.partnerIso2})</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

