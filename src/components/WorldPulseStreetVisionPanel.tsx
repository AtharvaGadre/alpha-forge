/// <reference types="google.maps" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import {
  OPTICAL_CAMERA_RECON_TARGETS,
  extractFinancialIntelFromVisualPrompt,
  type OpticalCameraReconTarget,
  type VisionIntelligenceResult,
} from '../engine/worldToAlphaEngine.ts';
import type {
  CategoryVisualReconScene,
  CountryOptionCategory,
  CountrySpecificDeepProfile,
  TrackedMaritimeVessel,
  ViewportZoomAiPrediction,
} from '../engine/countryDeepDiveEngine.ts';

const ENV_MAPS_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

export type GodsEyeOpticalSensorMode =
  | 'OPTICAL_RGB'
  | 'NVG_NIGHT_VISION'
  | 'FLIR_THERMAL_IR'
  | 'SAR_RADAR_EDGE';

export type SurveillanceCameraSourceMode =
  | 'COUNTRY_CATEGORY_CAM'
  | 'LIVE_VIEWPORT_ZOOM_CAM'
  | 'AIS_SHIP_TRANSPONDER_CAM'
  | 'GLOBAL_PRESET_CAM';

interface WorldPulseStreetVisionPanelProps {
  deepProfile: CountrySpecificDeepProfile;
  activeCategory: CountryOptionCategory;
  onSelectCategory?: (category: CountryOptionCategory) => void;
  selectedTargetId?: string;
  onSelectTarget?: (target: OpticalCameraReconTarget) => void;
  onFlyGlobeToTarget?: (lat: number, lng: number, label: string) => void;
  viewportLat?: number;
  viewportLng?: number;
  viewportRangeMeters?: number;
  viewportPrediction?: ViewportZoomAiPrediction;
  selectedVessel?: TrackedMaritimeVessel | null;
  onSelectVessel?: (vessel: TrackedMaritimeVessel) => void;
}

/**
 * Smoothly pans & zooms the Close-Up Google Satellite/Hybrid Map
 * whenever the selected country, zoomed viewport, or vessel target changes.
 */
const CloseUpGoogleMapCameraUpdater: React.FC<{
  lat: number;
  lng: number;
  zoom: number;
  heading: number;
}> = ({ lat, lng, zoom, heading }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
    map.setZoom(zoom);
    map.setTilt(45);
    if (typeof map.setHeading === 'function') {
      map.setHeading(heading);
    }
  }, [map, lat, lng, zoom, heading]);
  return null;
};

/**
 * Live Google Street View Panorama + Automatic Close-Up Satellite Fallback
 * so EVERY coordinate on Earth (urban supermarkets, ports, oil tank farms, maritime chokepoints, or zoomed map coordinates)
 * renders an interactive Google Street/Aerial canvas underneath the God's Eye Optical AI Recon HUD.
 */
const LiveGoogleStreetOrCloseSatelliteCanvas: React.FC<{
  lat: number;
  lng: number;
  heading: number;
  pitch: number;
  zoom: number;
  baseMapMode: 'GOOGLE_STREET_PANORAMA' | 'GOOGLE_CLOSE_SATELLITE';
  sensorMode: GodsEyeOpticalSensorMode;
  onPanoramaCoverageChange: (hasStreetPanorama: boolean) => void;
}> = ({
  lat,
  lng,
  heading,
  pitch,
  zoom,
  baseMapMode,
  sensorMode,
  onPanoramaCoverageChange,
}) => {
  const svHostRef = useRef<HTMLDivElement | null>(null);
  const [hasRoadPano, setHasRoadPano] = useState<boolean>(true);

  useEffect(() => {
    if (baseMapMode !== 'GOOGLE_STREET_PANORAMA') return;
    const container = svHostRef.current;
    if (!container) return;

    const g = (window as any).google;
    if (!g?.maps?.StreetViewService || !g?.maps?.StreetViewPanorama) {
      setHasRoadPano(false);
      onPanoramaCoverageChange(false);
      return;
    }

    let cancelled = false;
    const svService = new g.maps.StreetViewService();
    svService.getPanorama(
      {
        location: { lat, lng },
        radius: 4500,
      },
      (data: any, status: string) => {
        if (cancelled) return;
        if (status === 'OK' && data?.location?.latLng && container) {
          setHasRoadPano(true);
          onPanoramaCoverageChange(true);
          container.innerHTML = '';
          // eslint-disable-next-line no-new
          new g.maps.StreetViewPanorama(container, {
            position: data.location.latLng,
            pov: { heading, pitch },
            zoom: 1,
            addressControl: false,
            linksControl: true,
            panControl: true,
            enableCloseButton: false,
            fullscreenControl: false,
          });
        } else {
          setHasRoadPano(false);
          onPanoramaCoverageChange(false);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [lat, lng, heading, pitch, baseMapMode, onPanoramaCoverageChange]);

  const showSatellite =
    baseMapMode === 'GOOGLE_CLOSE_SATELLITE' || !hasRoadPano;

  const sensorFilterClass =
    sensorMode === 'NVG_NIGHT_VISION'
      ? 'sepia brightness-110 contrast-150 hue-rotate-[75deg] saturate-200'
      : sensorMode === 'FLIR_THERMAL_IR'
      ? 'invert contrast-150 hue-rotate-[185deg] saturate-150'
      : sensorMode === 'SAR_RADAR_EDGE'
      ? 'grayscale contrast-200 brightness-95'
      : '';

  return (
    <div className={`w-full h-full relative ${sensorFilterClass}`}>
      {/* Live Street View Panorama Container */}
      <div
        ref={svHostRef}
        className={`w-full h-full ${showSatellite ? 'hidden' : 'block'}`}
      />

      {/* High-Resolution Close-Up Google Satellite / Hybrid Street View */}
      {showSatellite && (
        <GoogleMap
          defaultCenter={{ lat, lng }}
          defaultZoom={zoom}
          mapTypeId="hybrid"
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
        >
          <CloseUpGoogleMapCameraUpdater
            lat={lat}
            lng={lng}
            zoom={zoom}
            heading={heading}
          />
        </GoogleMap>
      )}
    </div>
  );
};

export const WorldPulseStreetVisionPanel: React.FC<
  WorldPulseStreetVisionPanelProps
> = ({
  deepProfile,
  activeCategory,
  onSelectCategory,
  onFlyGlobeToTarget,
  viewportLat,
  viewportLng,
  viewportRangeMeters,
  viewportPrediction,
  selectedVessel,
  onSelectVessel,
}) => {
  const [runtimeMapsKey, setRuntimeMapsKey] = useState<string>(ENV_MAPS_KEY);
  const [baseMapMode, setBaseMapMode] = useState<
    'GOOGLE_STREET_PANORAMA' | 'GOOGLE_CLOSE_SATELLITE'
  >('GOOGLE_STREET_PANORAMA');
  const [sensorMode, setSensorMode] =
    useState<GodsEyeOpticalSensorMode>('OPTICAL_RGB');
  const [cameraSourceMode, setCameraSourceMode] =
    useState<SurveillanceCameraSourceMode>('COUNTRY_CATEGORY_CAM');
  const [showAiOverlayHud, setShowAiOverlayHud] = useState<boolean>(true);
  const [hasStreetPanorama, setHasStreetPanorama] = useState<boolean>(true);

  // Interactive PTZ (Pan / Tilt / Zoom) state
  const [ptzHeading, setPtzHeading] = useState<number>(155);
  const [ptzPitch, setPtzPitch] = useState<number>(-4);
  const [ptzZoom, setPtzZoom] = useState<number>(17);

  // Active vessel in the God's Eye AIS Transponder Surveillance Matrix
  const [internalSelectedVesselId, setInternalSelectedVesselId] = useState<
    string | null
  >(null);

  const activeVessel: TrackedMaritimeVessel = useMemo(() => {
    if (selectedVessel) return selectedVessel;
    if (internalSelectedVesselId) {
      const found = deepProfile.shipsInAndOut.find(
        (s) => s.vesselId === internalSelectedVesselId
      );
      if (found) return found;
    }
    return deepProfile.shipsInAndOut[0];
  }, [selectedVessel, internalSelectedVesselId, deepProfile.shipsInAndOut]);

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
        // Ignore
      });
  }, [runtimeMapsKey]);

  // Select the active Country-Specific Visual Recon Scene based on the active category
  const activeCountryScene: CategoryVisualReconScene = useMemo(() => {
    if (activeCategory === 'WEATHER_METEOROLOGY') {
      return deepProfile.weatherProfile.visualReconScene;
    }
    if (
      activeCategory === 'COMMODITIES_SUPPLY' ||
      activeCategory === 'TRADE_SHIPS'
    ) {
      return deepProfile.commoditiesProfile.visualReconScene;
    }
    return deepProfile.stocksProfile.visualReconScene;
  }, [deepProfile, activeCategory]);

  // Optional override when user clicks one of the global stress-test presets
  const [presetOverride, setPresetOverride] =
    useState<OpticalCameraReconTarget | null>(null);

  const [visualObservationPrompt, setVisualObservationPrompt] =
    useState<string>('');
  const [geopoliticalContext, setGeopoliticalContext] = useState<string>('');
  const [customImageDataUri, setCustomImageDataUri] = useState<string>('');
  const [customImageMimeType, setCustomImageMimeType] =
    useState<string>('image/jpeg');

  const [intelResult, setIntelResult] = useState<VisionIntelligenceResult>(() =>
    extractFinancialIntelFromVisualPrompt({
      visualObservationPrompt: `${deepProfile.stocksProfile.visualReconScene.opticalAiHeadline}: ${deepProfile.stocksProfile.supermarketCarsCounted}`,
      geopoliticalOrMacroContext: `${deepProfile.countryName} (${deepProfile.stocksProfile.centralBankName} ${deepProfile.stocksProfile.policyRateLabel}) — ${deepProfile.stocksProfile.supermarketSalesPrediction}`,
      locationName: deepProfile.stocksProfile.visualReconScene.locationLabel,
    })
  );
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Whenever user clicks a vessel on the globe (`selectedVessel` prop updates), switch camera to AIS_SHIP_TRANSPONDER_CAM
  useEffect(() => {
    if (!selectedVessel) return;
    setInternalSelectedVesselId(selectedVessel.vesselId);
    setCameraSourceMode('AIS_SHIP_TRANSPONDER_CAM');
    setBaseMapMode('GOOGLE_CLOSE_SATELLITE');
    setPtzHeading(selectedVessel.headingDeg);
    setPtzPitch(-12);
    setPtzZoom(15);
  }, [selectedVessel]);

  // Whenever user zooms/pans the main map (`viewportLat`/`viewportLng` change markedly), sync the Live Viewport Camera & AI Prediction
  useEffect(() => {
    if (
      viewportLat === undefined ||
      viewportLng === undefined ||
      !viewportPrediction
    ) {
      return;
    }
    // Automatically follow the zoomed viewport when the user zooms in below 5,000 km
    if (
      viewportRangeMeters !== undefined &&
      viewportRangeMeters < 5000000 &&
      cameraSourceMode !== 'AIS_SHIP_TRANSPONDER_CAM' &&
      cameraSourceMode !== 'GLOBAL_PRESET_CAM'
    ) {
      setCameraSourceMode('LIVE_VIEWPORT_ZOOM_CAM');
      if (viewportRangeMeters < 450000) {
        setBaseMapMode('GOOGLE_STREET_PANORAMA');
        setPtzZoom(18);
      } else {
        setBaseMapMode('GOOGLE_CLOSE_SATELLITE');
        setPtzZoom(16);
      }
    }
  }, [
    viewportLat,
    viewportLng,
    viewportRangeMeters,
    viewportPrediction,
    cameraSourceMode,
  ]);

  // STRICT CLEAR-ON-SWITCH: Whenever Selected Country or Category changes, sync scene + AI intel
  useEffect(() => {
    setPresetOverride(null);
    setCustomImageDataUri('');
    setCameraSourceMode('COUNTRY_CATEGORY_CAM');
    setPtzHeading(activeCountryScene.streetViewHeading);
    setPtzPitch(activeCountryScene.streetViewPitch);
    setPtzZoom(activeCountryScene.satelliteZoom);

    const obs = `${activeCountryScene.opticalAiHeadline} — ${activeCountryScene.detectedTelemetry
      .map((t) => `${t.metricName}: ${t.readingValue}`)
      .join('; ')}`;
    const ctx = `${deepProfile.countryName} (${deepProfile.iso2}) · ${activeCountryScene.aiVisualInterpretation}`;

    setVisualObservationPrompt(obs);
    setGeopoliticalContext(ctx);
    setBaseMapMode(
      activeCountryScene.defaultViewMode === 'GOOGLE_STREET_VIEW_OVERLAID'
        ? 'GOOGLE_STREET_PANORAMA'
        : 'GOOGLE_CLOSE_SATELLITE'
    );

    const countryIntel: VisionIntelligenceResult = {
      providerStatus: 'DETERMINISTIC_VISION_KERNEL',
      sceneTitle: activeCountryScene.sceneTitle,
      timestampUtc: new Date().toISOString(),
      detectedVisualObjects: activeCountryScene.overlaidBoxes.map((b) => ({
        objectLabel: b.label,
        measuredState: b.subLabel,
        anomalyVsBaseline: activeCountryScene.opticalAiMetricBadge,
        confidencePct: b.confidencePct,
      })),
      plainEnglishSummary: activeCountryScene.aiVisualInterpretation,
      causalTransmissionSteps: [
        {
          stepTitle: `1. Optical Street/Satellite Detection (${deepProfile.iso2})`,
          detail: `${activeCountryScene.opticalAiHeadline} at ${activeCountryScene.locationLabel}.`,
        },
        {
          stepTitle: `2. Fundamental & Policy Transmission`,
          detail:
            activeCategory === 'WEATHER_METEOROLOGY'
              ? `${deepProfile.weatherProfile.meteorologicalInstituteName} (${deepProfile.weatherProfile.instituteAcronym}): ${deepProfile.weatherProfile.implicationsForGridAndCrops}`
              : activeCategory === 'COMMODITIES_SUPPLY'
              ? deepProfile.commoditiesProfile.storageAndInventorySummary
              : `${deepProfile.stocksProfile.centralBankName} (${deepProfile.stocksProfile.policyRateLabel}) + ${deepProfile.stocksProfile.supermarketOccupancyPct}% supermarket car-park occupancy.`,
        },
        {
          stepTitle: `3. Market Pricing Impact (${deepProfile.countryName})`,
          detail: `${activeCountryScene.opticalAiMetricBadge} across ${deepProfile.stocksProfile.benchmarkIndexName} and linked sector equities.`,
        },
      ],
      marketSignal: {
        direction: 'BULLISH_UPWARD_PRESSURE',
        expectedPriceImpactRange: activeCountryScene.opticalAiMetricBadge,
        horizonLabel: '14 to 60 Trading Days',
        confidenceScorePct: 92,
      },
      affectedTickers:
        activeCategory === 'WEATHER_METEOROLOGY'
          ? deepProfile.weatherProfile.affectedSectorsAndTickers.map((t) => ({
              ticker: t.ticker,
              name: t.name,
              expectedMove: t.expectedImpact,
              direction: 'BULLISH' as const,
              reasonPlain: t.reason,
            }))
          : deepProfile.stocksProfile.topStocksToWatch.map((st) => ({
              ticker: st.ticker,
              name: st.companyName,
              expectedMove: st.priceMovePct,
              direction: 'BULLISH' as const,
              reasonPlain: st.catalystNote,
            })),
      falsificationAndRiskNote: `Signal invalidated if subsequent satellite/Street View passes show occupancy/storage reverting >15% against baseline.`,
    };

    setIntelResult(countryIntel);
  }, [deepProfile, activeCategory, activeCountryScene]);

  // Compute active camera coordinates & labels from cameraSourceMode
  const currentLat = useMemo(() => {
    if (cameraSourceMode === 'GLOBAL_PRESET_CAM' && presetOverride) {
      return presetOverride.lat;
    }
    if (cameraSourceMode === 'AIS_SHIP_TRANSPONDER_CAM' && activeVessel) {
      return activeVessel.lat;
    }
    if (
      cameraSourceMode === 'LIVE_VIEWPORT_ZOOM_CAM' &&
      viewportLat !== undefined
    ) {
      return viewportLat;
    }
    return activeCountryScene.lat;
  }, [
    cameraSourceMode,
    presetOverride,
    activeVessel,
    viewportLat,
    activeCountryScene.lat,
  ]);

  const currentLng = useMemo(() => {
    if (cameraSourceMode === 'GLOBAL_PRESET_CAM' && presetOverride) {
      return presetOverride.lng;
    }
    if (cameraSourceMode === 'AIS_SHIP_TRANSPONDER_CAM' && activeVessel) {
      return activeVessel.lng;
    }
    if (
      cameraSourceMode === 'LIVE_VIEWPORT_ZOOM_CAM' &&
      viewportLng !== undefined
    ) {
      return viewportLng;
    }
    return activeCountryScene.lng;
  }, [
    cameraSourceMode,
    presetOverride,
    activeVessel,
    viewportLng,
    activeCountryScene.lng,
  ]);

  const currentLocationLabel = useMemo(() => {
    if (cameraSourceMode === 'GLOBAL_PRESET_CAM' && presetOverride) {
      return presetOverride.locationName;
    }
    if (cameraSourceMode === 'AIS_SHIP_TRANSPONDER_CAM' && activeVessel) {
      return `AIS Vessel Lock: ${activeVessel.vesselName} (IMO ${activeVessel.imoNumber} · ${activeVessel.chokepointName})`;
    }
    if (
      cameraSourceMode === 'LIVE_VIEWPORT_ZOOM_CAM' &&
      viewportPrediction
    ) {
      return `Live Map Zoom Sector: ${viewportPrediction.resolvedCountryName} (${currentLat.toFixed(2)}°, ${currentLng.toFixed(2)}°)`;
    }
    return activeCountryScene.locationLabel;
  }, [
    cameraSourceMode,
    presetOverride,
    activeVessel,
    viewportPrediction,
    currentLat,
    currentLng,
    activeCountryScene.locationLabel,
  ]);

  const activeBoxes = useMemo(() => {
    if (cameraSourceMode === 'GLOBAL_PRESET_CAM' && presetOverride) {
      return presetOverride.precomputedIntel.detectedVisualObjects.map(
        (obj, idx) => ({
          id: `PRESET-BOX-${idx}`,
          label: obj.objectLabel.toUpperCase(),
          subLabel: `${obj.measuredState} (${obj.anomalyVsBaseline})`,
          xPct: idx === 0 ? 8 : 52,
          yPct: idx === 0 ? 46 : 42,
          widthPct: 40,
          heightPct: 26,
          colorHex: idx === 0 ? '#10b981' : '#f43f5e',
          confidencePct: obj.confidencePct,
        })
      );
    }
    if (cameraSourceMode === 'AIS_SHIP_TRANSPONDER_CAM' && activeVessel) {
      return [
        {
          id: `AIS-BOX-1-${activeVessel.vesselId}`,
          label: `AIS TRANSPONDER · ${activeVessel.vesselName}`,
          subLabel: `MMSI ${activeVessel.mmsiNumber} · ${activeVessel.speedKnots} kn · Hdg ${activeVessel.headingDeg}°`,
          xPct: 12,
          yPct: 38,
          widthPct: 44,
          heightPct: 28,
          colorHex:
            activeVessel.direction === 'SHIP_OUT_EXPORT'
              ? '#10b981'
              : '#f59e0b',
          confidencePct: 97,
        },
        {
          id: `AIS-BOX-2-${activeVessel.vesselId}`,
          label: `DRAUGHT & CARGO PAYLOAD TELEMETRY`,
          subLabel: `Draught ${activeVessel.draughtMeters} · $${activeVessel.estimatedCargoValueUsdM}M (${activeVessel.cargoDescription})`,
          xPct: 58,
          yPct: 44,
          widthPct: 36,
          heightPct: 24,
          colorHex: '#22d3ee',
          confidencePct: 94,
        },
      ];
    }
    return activeCountryScene.overlaidBoxes;
  }, [
    cameraSourceMode,
    presetOverride,
    activeVessel,
    activeCountryScene.overlaidBoxes,
  ]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomImageMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomImageDataUri(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunGeminiExtraction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsAnalyzing(true);

    const localResult = extractFinancialIntelFromVisualPrompt({
      visualObservationPrompt,
      geopoliticalOrMacroContext: geopoliticalContext,
      locationName: currentLocationLabel,
    });
    setIntelResult(localResult);

    try {
      const response = await fetch('/api/worldpulse/vision-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualObservationPrompt,
          geopoliticalOrMacroContext: geopoliticalContext,
          locationName: currentLocationLabel,
          lat: currentLat,
          lng: currentLng,
          heading: ptzHeading,
          pitch: ptzPitch,
          fov: 80,
          imageBase64: customImageDataUri || '',
          mimeType: customImageMimeType,
        }),
      });
      if (response.ok) {
        const data: VisionIntelligenceResult = await response.json();
        if (data && data.sceneTitle && data.plainEnglishSummary) {
          setIntelResult(data);
        }
      }
    } catch (_err) {
      // Keep deterministic localResult
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLockOnVessel = (vessel: TrackedMaritimeVessel) => {
    setInternalSelectedVesselId(vessel.vesselId);
    setCameraSourceMode('AIS_SHIP_TRANSPONDER_CAM');
    setBaseMapMode('GOOGLE_CLOSE_SATELLITE');
    setPtzHeading(vessel.headingDeg);
    setPtzPitch(-12);
    setPtzZoom(15);
    setVisualObservationPrompt(
      `${vessel.vesselName} (IMO ${vessel.imoNumber}, MMSI ${vessel.mmsiNumber}) at ${vessel.lat.toFixed(2)}°, ${vessel.lng.toFixed(2)}° — ${vessel.aiSurveillanceSignal}`
    );
    setGeopoliticalContext(
      `${vessel.originPort} → ${vessel.destinationPort} (${vessel.chokepointName}) · Cargo: ${vessel.cargoDescription} ($${vessel.estimatedCargoValueUsdM}M)`
    );
    if (onSelectVessel) {
      onSelectVessel(vessel);
    }
    if (onFlyGlobeToTarget) {
      onFlyGlobeToTarget(
        vessel.lat,
        vessel.lng,
        `${vessel.vesselName} (${vessel.originPort} → ${vessel.destinationPort})`
      );
    }
  };

  return (
    <section
      aria-label="God's Eye Multi-Sensor Street Camera, AIS Ship Transponder & Gemini AI Vision Surveillance Suite"
      className="rounded-2xl bg-slate-900/95 border border-cyan-500/40 p-3.5 sm:p-5 shadow-2xl space-y-4 sm:space-y-5 overflow-hidden"
    >
      {/* Top Header & God's Eye Surveillance Camera Source Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/50 text-[11px] font-mono font-bold text-cyan-300 uppercase">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              God&apos;s Eye Multi-Sensor Street Camera &amp; AIS Maritime Surveillance
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300">
              {deepProfile.countryName} ({deepProfile.iso2}) · CAM MODE: {cameraSourceMode.replace(/_/g, ' ')}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-1">
            {cameraSourceMode === 'AIS_SHIP_TRANSPONDER_CAM' && activeVessel
              ? `AIS Optical Recon Lock: ${activeVessel.vesselName} (${activeVessel.originPort} → ${activeVessel.destinationPort})`
              : cameraSourceMode === 'LIVE_VIEWPORT_ZOOM_CAM' &&
                viewportPrediction
              ? viewportPrediction.aiPredictionHeadline
              : presetOverride
              ? presetOverride.title
              : activeCountryScene.sceneTitle}
          </h2>
          <p className="text-xs text-slate-300">
            Live-synced to wherever you zoom on the globe (`{currentLat.toFixed(3)}°, {currentLng.toFixed(3)}°`), with God&apos;s Eye PTZ optics, NVG/FLIR/SAR filters, and full AIS vessel transponder telemetry.
          </p>
        </div>

        {/* 4 Camera Target Modes: Live Map Zoom Cam | Supermarket Car Park | Weather/Hydro | Port & AIS Vessel Cam */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex xl:flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPresetOverride(null);
              setCameraSourceMode('LIVE_VIEWPORT_ZOOM_CAM');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left xl:text-center ${
              cameraSourceMode === 'LIVE_VIEWPORT_ZOOM_CAM'
                ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold shadow-md'
                : 'bg-slate-950 text-cyan-300 border-cyan-500/40 hover:border-cyan-400'
            }`}
          >
            ◎ Live Map Zoom Cam (
            {(viewportLat ?? deepProfile.lat).toFixed(2)}°,{' '}
            {(viewportLng ?? deepProfile.lng).toFixed(2)}°)
          </button>

          <button
            type="button"
            onClick={() => {
              setPresetOverride(null);
              setCameraSourceMode('COUNTRY_CATEGORY_CAM');
              if (onSelectCategory) onSelectCategory('STOCKS_POLICY');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left xl:text-center ${
              cameraSourceMode === 'COUNTRY_CATEGORY_CAM' &&
              activeCategory === 'STOCKS_POLICY'
                ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold shadow-md'
                : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-emerald-400/60'
            }`}
          >
            CAM-01 {deepProfile.iso2} Supermarket ({deepProfile.stocksProfile.supermarketOccupancyPct}% Full)
          </button>

          <button
            type="button"
            onClick={() => {
              setPresetOverride(null);
              setCameraSourceMode('COUNTRY_CATEGORY_CAM');
              if (onSelectCategory) onSelectCategory('WEATHER_METEOROLOGY');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left xl:text-center ${
              cameraSourceMode === 'COUNTRY_CATEGORY_CAM' &&
              activeCategory === 'WEATHER_METEOROLOGY'
                ? 'bg-purple-400 text-slate-950 border-purple-300 font-bold shadow-md'
                : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-purple-400/60'
            }`}
          >
            CAM-02 {deepProfile.weatherProfile.instituteAcronym} Weather &amp; Hydro
          </button>

          <button
            type="button"
            onClick={() => {
              setPresetOverride(null);
              setCameraSourceMode('COUNTRY_CATEGORY_CAM');
              if (onSelectCategory) onSelectCategory('COMMODITIES_SUPPLY');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left xl:text-center ${
              cameraSourceMode === 'COUNTRY_CATEGORY_CAM' &&
              (activeCategory === 'COMMODITIES_SUPPLY' ||
                activeCategory === 'TRADE_SHIPS')
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-md'
                : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-amber-400/60'
            }`}
          >
            CAM-03 {deepProfile.iso2} Port &amp; Oil Drum Storage
          </button>
        </div>
      </div>

      {/* Main 12-Col Grid: Left 6 Cols (Live Street/Satellite + God's Eye Optical Filters & PTZ) | Right 6 Cols (Gemini Extracted Intelligence) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* LEFT 6 COLS: Live Google Street View / Close-Up Satellite with God's Eye Optical Filters & PTZ */}
        <div className="lg:col-span-6 min-w-0 space-y-3">
          {/* Camera Mode + Sensor Filter Bar (OPTICAL RGB | NVG | FLIR | SAR) */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
            <div className="text-xs font-mono text-slate-300 truncate max-w-full">
              <span className="text-cyan-400 font-bold">
                [{deepProfile.iso2}]
              </span>{' '}
              {currentLocationLabel}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Street View 360 vs Close-Up Satellite */}
              <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setBaseMapMode('GOOGLE_STREET_PANORAMA')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    baseMapMode === 'GOOGLE_STREET_PANORAMA'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Street View 360°
                </button>
                <button
                  type="button"
                  onClick={() => setBaseMapMode('GOOGLE_CLOSE_SATELLITE')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    baseMapMode === 'GOOGLE_CLOSE_SATELLITE'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Close-Up Satellite
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAiOverlayHud(!showAiOverlayHud)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                  showAiOverlayHud
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                HUD: {showAiOverlayHud ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* God's Eye Optical Sensor Filter Selector + Interactive PTZ Controls */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-slate-400 mr-1">OPTICS:</span>
              {(
                [
                  { id: 'OPTICAL_RGB', label: 'RGB OPTICAL' },
                  { id: 'NVG_NIGHT_VISION', label: 'NVG PHOSPHOR' },
                  { id: 'FLIR_THERMAL_IR', label: 'FLIR THERMAL' },
                  { id: 'SAR_RADAR_EDGE', label: 'SAR RADAR' },
                ] as Array<{ id: GodsEyeOpticalSensorMode; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSensorMode(opt.id)}
                  className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    sensorMode === opt.id
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* PTZ Controls (Pan Heading, Tilt Pitch, Optical Zoom) */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-300">
              <label className="flex items-center gap-1">
                <span>PAN {ptzHeading}°</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={ptzHeading}
                  onChange={(e) => setPtzHeading(Number(e.target.value))}
                  className="w-16 accent-cyan-400"
                />
              </label>
              <label className="flex items-center gap-1">
                <span>TILT {ptzPitch}°</span>
                <input
                  type="range"
                  min={-25}
                  max={25}
                  step={1}
                  value={ptzPitch}
                  onChange={(e) => setPtzPitch(Number(e.target.value))}
                  className="w-14 accent-cyan-400"
                />
              </label>
              <label className="flex items-center gap-1">
                <span>ZOOM {ptzZoom}x</span>
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={1}
                  value={ptzZoom}
                  onChange={(e) => setPtzZoom(Number(e.target.value))}
                  className="w-14 accent-cyan-400"
                />
              </label>
            </div>
          </div>

          {/* LIVE GOOGLE STREET VIEW / CLOSE-UP SATELLITE VIEWPORT + OVERLAID OPTICAL AI RECON HUD */}
          <div className="relative w-full h-[320px] sm:h-[350px] rounded-xl overflow-hidden bg-[#050914] border border-cyan-500/40 shadow-inner">
            {customImageDataUri ? (
              <img
                src={customImageDataUri}
                alt="Custom uploaded visual feed"
                className="w-full h-full object-cover"
              />
            ) : runtimeMapsKey ? (
              <APIProvider
                apiKey={runtimeMapsKey}
                version="alpha"
                libraries={['maps3d', 'marker']}
              >
                <LiveGoogleStreetOrCloseSatelliteCanvas
                  lat={currentLat}
                  lng={currentLng}
                  heading={ptzHeading}
                  pitch={ptzPitch}
                  zoom={ptzZoom}
                  baseMapMode={baseMapMode}
                  sensorMode={sensorMode}
                  onPanoramaCoverageChange={setHasStreetPanorama}
                />
              </APIProvider>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                Loading Google Street &amp; Close-Up Satellite Feed...
              </div>
            )}

            {/* OVERLAID OPTICAL AI RECON HUD (Bounding Boxes + Reticle + Telemetry Ribbon directly on top of Google Street/Satellite) */}
            {showAiOverlayHud && (
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3">
                {/* Top HUD Telemetry Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/85 backdrop-blur-md border border-cyan-400/50 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-cyan-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>
                      {cameraSourceMode === 'AIS_SHIP_TRANSPONDER_CAM' &&
                      activeVessel
                        ? `${activeVessel.vesselName} · ${activeVessel.vesselTypeClass}`
                        : cameraSourceMode === 'LIVE_VIEWPORT_ZOOM_CAM' &&
                          viewportPrediction
                        ? viewportPrediction.zoomScaleLabel
                        : presetOverride
                        ? presetOverride.precomputedIntel.sceneTitle.slice(
                            0,
                            48
                          )
                        : activeCountryScene.opticalAiHeadline}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-mono font-bold text-emerald-300">
                    {cameraSourceMode === 'AIS_SHIP_TRANSPONDER_CAM' &&
                    activeVessel
                      ? `AIS ${activeVessel.speedKnots} kn · $${activeVessel.estimatedCargoValueUsdM}M`
                      : presetOverride
                      ? presetOverride.precomputedIntel.marketSignal
                          .expectedPriceImpactRange
                      : activeCountryScene.opticalAiMetricBadge}
                  </span>
                </div>

                {/* Overlaid AI Detection Bounding Boxes */}
                <div className="relative flex-1 w-full my-1">
                  {activeBoxes.map((box) => (
                    <div
                      key={box.id}
                      style={{
                        left: `${box.xPct}%`,
                        top: `${box.yPct - 25}%`,
                        width: `${box.widthPct}%`,
                        height: `${box.heightPct + 14}%`,
                        borderColor: box.colorHex,
                      }}
                      className="absolute border-2 rounded-lg bg-slate-950/25 backdrop-blur-[1px] shadow-[0_0_15px_rgba(16,185,129,0.25)] flex flex-col justify-between p-1.5"
                    >
                      <div className="flex items-center justify-between gap-1 bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-700/80">
                        <span
                          style={{ color: box.colorHex }}
                          className="text-[10px] font-mono font-bold truncate"
                        >
                          {box.label}
                        </span>
                        <span className="text-[9px] font-mono text-white shrink-0">
                          {box.confidencePct}%
                        </span>
                      </div>
                      <div className="bg-slate-950/85 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-200 truncate">
                        {box.subLabel}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom HUD Status & Sensor Indicator */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] font-mono text-slate-300">
                  <span>
                    FEED:{' '}
                    <strong className="text-cyan-300">
                      {baseMapMode === 'GOOGLE_STREET_PANORAMA' &&
                      hasStreetPanorama
                        ? 'LIVE GOOGLE STREET VIEW 360°'
                        : 'GOOGLE CLOSE-UP SATELLITE / HYBRID 3D'}
                    </strong>{' '}
                    · SENSOR: <strong className="text-emerald-300">{sensorMode}</strong>
                  </span>
                  <span className="text-amber-300">
                    LAT {currentLat.toFixed(3)}° · LNG {currentLng.toFixed(3)}° · PTZ {ptzHeading}°/{ptzPitch}°/{ptzZoom}x
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* "Analyze Anything" Custom Visual Observation & Geopolitical Context Form */}
          <form
            onSubmit={handleRunGeminiExtraction}
            className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-300 font-bold">
                Analyze Any Visual Scene, Camera Feed or Custom Scenario
              </span>
              <div className="flex items-center gap-1.5">
                {onFlyGlobeToTarget && (
                  <button
                    type="button"
                    onClick={() =>
                      onFlyGlobeToTarget(
                        currentLat,
                        currentLng,
                        currentLocationLabel
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-[11px] font-medium text-cyan-300 cursor-pointer"
                  >
                    Center 3D Globe Here
                  </button>
                )}
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-[11px] font-medium text-slate-200">
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label
                  htmlFor="vision-observation-input"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Visual Observation (Synced to {deepProfile.countryName} or type any scenario):
                </label>
                <input
                  id="vision-observation-input"
                  type="text"
                  value={visualObservationPrompt}
                  onChange={(e) => setVisualObservationPrompt(e.target.value)}
                  placeholder="e.g., Supermarket car park is 91% full or Oil drums are empty..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="vision-context-input"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Monetary, Fiscal, Meteorological or Geopolitical Context:
                </label>
                <input
                  id="vision-context-input"
                  type="text"
                  value={geopoliticalContext}
                  onChange={(e) => setGeopoliticalContext(e.target.value)}
                  placeholder="e.g., Central bank rate cuts boosting retail or conflict in Iran..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const oilPreset = OPTICAL_CAMERA_RECON_TARGETS[0];
                    setPresetOverride(oilPreset);
                    setCameraSourceMode('GLOBAL_PRESET_CAM');
                    setVisualObservationPrompt(
                      oilPreset.defaultVisualObservation
                    );
                    setGeopoliticalContext(
                      oilPreset.defaultGeopoliticalContext
                    );
                    setIntelResult(oilPreset.precomputedIntel);
                    setBaseMapMode('GOOGLE_CLOSE_SATELLITE');
                  }}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-rose-400/60 text-[11px] text-rose-300 cursor-pointer"
                >
                  Preset: Oil Drums Empty + Iran War
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPresetOverride(null);
                    setCameraSourceMode('COUNTRY_CATEGORY_CAM');
                    if (onSelectCategory) onSelectCategory('STOCKS_POLICY');
                  }}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-emerald-400/60 text-[11px] text-emerald-300 cursor-pointer"
                >
                  Reset to {deepProfile.countryName} Supermarket ({deepProfile.stocksProfile.supermarketOccupancyPct}% Full)
                </button>
              </div>

              <button
                type="submit"
                disabled={isAnalyzing}
                className="px-4 py-1.5 rounded-lg bg-cyan-400 text-slate-950 text-xs font-bold hover:bg-cyan-300 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isAnalyzing
                  ? 'Extracting with Gemini AI...'
                  : 'Extract Intelligence with Gemini AI →'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT 6 COLS: Gemini AI Multimodal Intelligence Readout + God's Eye AIS Maritime Surveillance Matrix */}
        <div className="lg:col-span-6 min-w-0 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            {/* Scene Title & Market Signal Banner */}
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                  GEMINI AI VISUAL-TO-MARKET INTERPRETATION ({deepProfile.countryName})
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white mt-0.5">
                  {intelResult.sceneTitle}
                </h3>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                  intelResult.marketSignal.direction ===
                  'BEARISH_DOWNWARD_PRESSURE'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {intelResult.marketSignal.expectedPriceImpactRange} (
                {intelResult.marketSignal.confidenceScorePct}% Conf)
              </span>
            </div>

            {/* Plain-English Interpretation */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-100 leading-relaxed">
              {intelResult.plainEnglishSummary}
            </div>

            {/* Detected Visual Objects Table */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Overlaid Optical AI Detections &amp; Physical Telemetry
              </div>
              <div className="grid grid-cols-1 gap-2">
                {intelResult.detectedVisualObjects.map((obj, idx) => (
                  <div
                    key={`${obj.objectLabel}-${idx}`}
                    className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">
                        {obj.objectLabel}
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {obj.measuredState}
                      </div>
                    </div>
                    <div className="sm:text-right font-mono">
                      <div className="text-[11px] text-cyan-300 font-semibold">
                        {obj.anomalyVsBaseline}
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        Vision Conf: {obj.confidencePct}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3-Step Causal Transmission Chain */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {intelResult.causalTransmissionSteps.map((step, i) => (
                <div
                  key={`${step.stepTitle}-${i}`}
                  className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1"
                >
                  <div className="text-[11px] font-bold text-cyan-300">
                    {step.stepTitle}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>

            {/* Affected Stocks, ETFs & Commodities */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>
                  AFFECTED {deepProfile.countryName.toUpperCase()} &amp; GLOBAL ASSETS
                </span>
                <span>HORIZON: {intelResult.marketSignal.horizonLabel}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {intelResult.affectedTickers.map((t) => (
                  <div
                    key={t.ticker}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-white">
                        {t.ticker}{' '}
                        <span className="text-[11px] font-sans font-normal text-slate-400">
                          ({t.name})
                        </span>
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          t.direction === 'BEARISH'
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {t.expectedMove}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {t.reasonPlain}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================================================= */}
          {/* GOD'S EYE AIS MARITIME TRANSPONDER & VESSEL SURVEILLANCE MATRIX                           */}
          {/* Full ship data: IMO, MMSI, Callsign, DWT, Draught, Chokepoint & AI Surveillance Signal    */}
          {/* ========================================================================================= */}
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                  GOD&apos;S EYE AIS MARITIME TRANSPONDER SURVEILLANCE ({deepProfile.countryName})
                </div>
                <h3 className="text-sm font-bold text-white">
                  Live Tracked Vessels · Click Any Ship to Lock Optical Camera &amp; 3D Globe
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-300">
                {deepProfile.shipsInAndOut.length} AIS Transponders Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[270px] overflow-y-auto pr-1">
              {deepProfile.shipsInAndOut.map((vessel) => {
                const isExport = vessel.direction === 'SHIP_OUT_EXPORT';
                const isSelected = activeVessel?.vesselId === vessel.vesselId;
                return (
                  <div
                    key={vessel.vesselId}
                    onClick={() => handleLockOnVessel(vessel)}
                    className={`rounded-xl p-2.5 border transition-all cursor-pointer space-y-1 ${
                      isSelected
                        ? isExport
                          ? 'bg-emerald-950/40 border-emerald-400 shadow-md'
                          : 'bg-amber-950/40 border-amber-400 shadow-md'
                        : 'bg-slate-900/90 border-slate-800 hover:border-cyan-400/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span
                        className={`font-bold ${
                          isExport ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {isExport ? '▲ EXPORT' : '▼ IMPORT'} · {vessel.vesselName}
                      </span>
                      <span className="text-cyan-300">
                        {vessel.speedKnots} kn · {vessel.headingDeg}°
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {vessel.imoNumber} · {vessel.mmsiNumber} · Call {vessel.callsign}
                    </div>
                    <div className="text-[11px] text-slate-200 truncate">
                      {vessel.originPort} → {vessel.destinationPort} ({vessel.chokepointName})
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 flex items-center justify-between pt-0.5 border-t border-slate-800/80">
                      <span>
                        Draught: {vessel.draughtMeters} · {vessel.deadweightTonnageDwt}
                      </span>
                      <span className="text-emerald-300 font-bold">
                        ${vessel.estimatedCargoValueUsdM}M
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
