// ============================================================================
// ALPHAFORGE ATMOSPHERE — CENTRALIZED REACTIVE STATE STORE
// Manages Progressive Disclosure (Level 0 -> Level 1 -> Level 2 -> Level 3),
// Demo Access Workspace Presets, Map Provider Stack, Active Weather Layers,
// Forecast Timeline, Geographic Context, Weather-to-Market Trade Ideas,
// and ARGON Voice / Research State.
// ============================================================================

import { useSyncExternalStore } from 'react';
import {
  type OperationalWeatherLayerId,
} from '../engine/globe/LayerRegistry.ts';
import {
  CURATED_GEOGRAPHIC_TARGETS,
  resolveGeographicTarget,
  type GeographicTargetLocation,
} from '../engine/globe/GeographicSelectionService.ts';
import {
  getMapStackDescriptor,
  resolveGoogleMapsApiKey,
  type MapProviderStatusDiagnostics,
  type MapStackId,
} from '../engine/globe/MapProviderManager.ts';
import {
  executeArgonVoiceWorkflow,
  generateArgonScientificReport,
  type ArgonInvestigationResult,
  type ArgonStructuredReport,
  type WeatherModelId,
} from '../engine/argonAtmosphereEngine.ts';
import {
  DEMO_PRESET_PROFILES,
  getPredictionAndTradeIdeasForLocation,
  type DemoPresetId,
} from '../engine/atmosphereIntelligenceDeckEngine.ts';

export type AtmosphereUserMode = 'BASIC' | 'ADVANCED';

export type TopNavigationTabId =
  | 'OVERVIEW'
  | 'TRADE_IDEAS'
  | 'MARKETS'
  | 'GLOBAL_DATA';

/**
 * Progressive Disclosure Levels:
 * - Level 0: The Earth (clean default screen; all secondary drawers collapsed)
 * - Level 1: Compact Location Summary card open
 * - Level 2: Single expanded side panel / drawer open ('FORECAST' | 'LAYERS' | 'NEWS' | 'MODELS' | 'SETTINGS')
 * - Level 3: Dedicated full-screen workspace ('ADVANCED_RESEARCH' | 'SCIENTIFIC_REPORT')
 */
export type ActiveSidePanelId =
  | 'NONE'
  | 'FORECAST'
  | 'LAYERS'
  | 'NEWS'
  | 'MODELS'
  | 'SETTINGS';

export type ActiveWorkspaceId =
  | 'GLOBE'
  | 'ADVANCED_RESEARCH'
  | 'SCIENTIFIC_REPORT';

export type AdvancedSectionTabId =
  | 'COMPARE_FORECASTS'
  | 'MODEL_ACCURACY'
  | 'WEATHER_RESEARCH'
  | 'ECONOMIC_IMPACT'
  | 'REPORTS';

export interface AtmosphereAppState {
  // Mode, Navigation & Demo Preset
  userMode: AtmosphereUserMode;
  activeTopNav: TopNavigationTabId;
  activeDemoPresetId: DemoPresetId;
  activeSidePanel: ActiveSidePanelId;
  activeWorkspace: ActiveWorkspaceId;
  advancedTab: AdvancedSectionTabId;
  locationSummaryOpen: boolean;

  // Geographic & Camera State
  selectedLocation: GeographicTargetLocation;
  selectedTradeIdeaId: string;
  isLandmark3DActive: boolean;
  cameraPose: {
    lat: number;
    lng: number;
    altitudeMeters: number;
    headingDeg: number;
    pitchDeg: number;
    rollDeg: number;
  };

  // Map Provider & Diagnostics
  mapProvider: MapProviderStatusDiagnostics;
  providerDiagnosticsVisible: boolean;

  // Weather Layers & Forecast Timeline
  activeWeatherLayers: OperationalWeatherLayerId[];
  timelineOffsetHours: number; // -168 to +168 (default 0 = Today/Live)
  isTimelinePlaying: boolean;
  forecastInitTimeUtc: string;

  // Live Point Telemetry from /api/v1/weather/current
  liveTelemetry: {
    temperatureC: number;
    windSpeedMs: number;
    humidityPct: number;
    precipitationMm: number;
    conditionLabel: string;
    fetchedAtUtc: string;
    provider: string;
  } | null;

  // ARGON Investigation & Report State
  activeInvestigation: ArgonInvestigationResult;
  activeReport: ArgonStructuredReport;
  customModelWeights: Partial<Record<WeatherModelId, number>>;
  staleForecastInjected: boolean;
  investigationHistory: ArgonInvestigationResult[];
}

const STORAGE_MODE_KEY = 'alphaforge_atmosphere_mode_v4';

function loadInitialMode(): AtmosphereUserMode {
  try {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    if (saved === 'ADVANCED' || saved === 'BASIC') return saved;
  } catch {
    // Ignore
  }
  return 'BASIC';
}

const initialLocation = resolveGeographicTarget('Stockholm'); // Default to Sweden (SE) matching the Actionable Trade Playbook, dynamically updates for any selected country
const initialGoogleKey = resolveGoogleMapsApiKey();
const initialStackId: MapStackId = initialGoogleKey ? 'photoreal' : 'esri-imagery';
const initialStackDesc = getMapStackDescriptor(initialStackId);

const initialInvestigation = executeArgonVoiceWorkflow({
  query:
    "Hey ARGON, analyse last week's weather across Asia and tell me which financial markets have been affected and what next week's weather could mean for those markets.",
});

const initialReport = generateArgonScientificReport(
  initialInvestigation,
  'FULL_28_SECTION_SCIENTIFIC_REPORT'
);

const initialTradeIdeas = getPredictionAndTradeIdeasForLocation(
  initialLocation.countryIso2,
  0
);

let state: AtmosphereAppState = {
  userMode: loadInitialMode(),
  activeTopNav: 'OVERVIEW',
  activeDemoPresetId: 'GUEST_EXPLORER',
  // STRICT LEVEL 0 DEFAULT ON FIRST LOAD: All secondary drawers collapsed
  activeSidePanel: 'NONE',
  activeWorkspace: 'GLOBE',
  advancedTab: 'COMPARE_FORECASTS',
  locationSummaryOpen: false,

  selectedLocation: initialLocation,
  selectedTradeIdeaId: initialTradeIdeas[0]?.id || '',
  isLandmark3DActive: false,
  cameraPose: {
    lat: 26.0,
    lng: 14.0,
    altitudeMeters: 15_500_000,
    headingDeg: 0,
    pitchDeg: -88,
    rollDeg: 0,
  },

  mapProvider: {
    activeStackId: initialStackId,
    activeProviderLabel: initialStackDesc.label,
    availability: initialGoogleKey ? 'AVAILABLE' : 'FALLBACK_ACTIVE',
    switchOrigin: initialGoogleKey ? 'manual' : 'automatic_fallback',
    imageryType: initialStackDesc.imageryType,
    googleKeyConfigured: Boolean(initialGoogleKey),
    simulatedOutageActive: false,
    tilesLoadedCount: 18,
    lastError: null,
    statusExplanation: initialGoogleKey
      ? 'Google Photorealistic 3D Tiles active via CesiumJS Map Tiles API.'
      : 'Esri World Imagery satellite fallback active with WGS84 terrain.',
    coverageLimitations: initialStackDesc.coverageLimitations,
    attributionText: initialStackDesc.attributionText,
  },
  providerDiagnosticsVisible: false,

  activeWeatherLayers: ['TEMPERATURE'],
  timelineOffsetHours: 0,
  isTimelinePlaying: false,
  forecastInitTimeUtc: new Date(Date.now() - 3 * 3_600_000).toISOString(),

  liveTelemetry: null,

  activeInvestigation: initialInvestigation,
  activeReport: initialReport,
  customModelWeights: {},
  staleForecastInjected: false,
  investigationHistory: [initialInvestigation],
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const atmosphereStore = {
  getState(): AtmosphereAppState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setState(
    updater:
      | Partial<AtmosphereAppState>
      | ((prev: AtmosphereAppState) => Partial<AtmosphereAppState>)
  ) {
    const patch = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...patch };
    emitChange();
  },

  setUserMode(userMode: AtmosphereUserMode) {
    try {
      localStorage.setItem(STORAGE_MODE_KEY, userMode);
    } catch {
      // Ignore
    }
    this.setState((prev) => ({
      userMode,
      activeWorkspace:
        userMode === 'BASIC' && prev.activeWorkspace === 'ADVANCED_RESEARCH'
          ? 'GLOBE'
          : prev.activeWorkspace,
    }));
  },

  setActiveTopNav(tab: TopNavigationTabId) {
    this.setState({ activeTopNav: tab });
  },

  selectTradeIdea(ideaId: string) {
    this.setState({ selectedTradeIdeaId: ideaId });
  },

  applyDemoPreset(presetId: DemoPresetId) {
    const preset =
      DEMO_PRESET_PROFILES.find((p) => p.id === presetId) ||
      DEMO_PRESET_PROFILES[0];
    const resolvedLoc = resolveGeographicTarget(preset.defaultLocationQuery);
    const inv = executeArgonVoiceWorkflow({
      query: preset.sampleArgonPrompt,
      currentCountryIso2: resolvedLoc.countryIso2,
      previousInvestigation: state.activeInvestigation,
    });
    const report = generateArgonScientificReport(
      inv,
      'FULL_28_SECTION_SCIENTIFIC_REPORT'
    );
    const ideas = getPredictionAndTradeIdeasForLocation(
      resolvedLoc.countryIso2,
      state.timelineOffsetHours
    );

    this.setState((curr) => ({
      activeDemoPresetId: preset.id,
      userMode: preset.recommendedMode,
      selectedLocation: resolvedLoc,
      selectedTradeIdeaId: ideas[0]?.id || curr.selectedTradeIdeaId,
      locationSummaryOpen: true,
      activeWeatherLayers: preset.defaultLayers,
      activeInvestigation: inv,
      activeReport: report,
      cameraPose: {
        lat: resolvedLoc.lat,
        lng: resolvedLoc.lng,
        altitudeMeters: resolvedLoc.cameraAltitudeMeters,
        headingDeg: resolvedLoc.cameraHeadingDeg,
        pitchDeg: -(90 - resolvedLoc.cameraTiltDeg),
        rollDeg: 0,
      },
      investigationHistory: [
        inv,
        ...curr.investigationHistory.filter(
          (item) => item.investigationId !== inv.investigationId
        ),
      ].slice(0, 12),
    }));
  },

  /**
   * Enforces the single-panel rule (Section 7):
   * Opening one major side panel automatically collapses any previous side panel.
   */
  toggleSidePanel(panel: ActiveSidePanelId) {
    this.setState((prev) => ({
      activeSidePanel: prev.activeSidePanel === panel ? 'NONE' : panel,
      activeWorkspace: 'GLOBE',
    }));
  },

  closeAllPanelsToLevel0() {
    this.setState({
      activeSidePanel: 'NONE',
      activeWorkspace: 'GLOBE',
      locationSummaryOpen: false,
      providerDiagnosticsVisible: false,
    });
  },

  openWorkspace(
    workspace: ActiveWorkspaceId,
    advancedTab?: AdvancedSectionTabId
  ) {
    this.setState((prev) => ({
      activeWorkspace: workspace,
      activeSidePanel: 'NONE',
      advancedTab: advancedTab || prev.advancedTab,
      userMode:
        workspace === 'ADVANCED_RESEARCH' ? 'ADVANCED' : prev.userMode,
    }));
  },

  selectLocation(
    locationOrQuery: GeographicTargetLocation | string,
    options?: {
      openSummary?: boolean;
      flyLandmark3D?: boolean;
    }
  ): GeographicTargetLocation {
    const resolved =
      typeof locationOrQuery === 'string'
        ? resolveGeographicTarget(locationOrQuery, options?.flyLandmark3D)
        : locationOrQuery;

    const useLandmark = Boolean(options?.flyLandmark3D && resolved.landmark);
    const targetLat = useLandmark ? resolved.landmark!.lat : resolved.lat;
    const targetLng = useLandmark ? resolved.landmark!.lng : resolved.lng;
    const targetAlt = useLandmark
      ? resolved.landmark!.altitudeMeters
      : resolved.cameraAltitudeMeters;
    const targetTilt = useLandmark
      ? resolved.landmark!.tiltDeg
      : resolved.cameraTiltDeg;
    const targetHeading = useLandmark
      ? resolved.landmark!.headingDeg
      : resolved.cameraHeadingDeg;

    // Synthesize location-specific weather-to-market investigation so the predicted weather market effects and trade ideas update immediately
    const locationQuery =
      resolved.countryIso2 === 'BR'
        ? 'Show me Brazil coffee regions and compare rainfall forecasts for the next ten days.'
        : resolved.countryIso2 === 'JP' ||
          resolved.countryIso2 === 'SG' ||
          resolved.countryIso2 === 'CN'
        ? "Hey ARGON, analyse last week's weather across Asia and tell me which financial markets have been affected and what next week's weather could mean for those markets."
        : `Hey ARGON, analyse how predicted weather patterns in ${resolved.name} (${resolved.countryName}) affect financial markets and suggest research-backed trade ideas.`;

    const inv = executeArgonVoiceWorkflow({
      query: locationQuery,
      currentCountryIso2: resolved.countryIso2,
      previousInvestigation: state.activeInvestigation,
    });
    const report = generateArgonScientificReport(
      inv,
      'FULL_28_SECTION_SCIENTIFIC_REPORT'
    );
    const ideas = getPredictionAndTradeIdeasForLocation(
      resolved.countryIso2,
      state.timelineOffsetHours
    );

    this.setState((curr) => ({
      selectedLocation: resolved,
      selectedTradeIdeaId: ideas[0]?.id || curr.selectedTradeIdeaId,
      isLandmark3DActive: useLandmark,
      locationSummaryOpen: options?.openSummary ?? true,
      activeInvestigation: inv,
      activeReport: report,
      cameraPose: {
        lat: targetLat,
        lng: targetLng,
        altitudeMeters: targetAlt,
        headingDeg: targetHeading,
        pitchDeg: -(90 - targetTilt),
        rollDeg: 0,
      },
      investigationHistory: [
        inv,
        ...curr.investigationHistory.filter(
          (item) => item.investigationId !== inv.investigationId
        ),
      ].slice(0, 12),
    }));

    return resolved;
  },

  toggleWeatherLayer(
    layerId: OperationalWeatherLayerId,
    forceState?: boolean
  ) {
    this.setState((prev) => {
      const exists = prev.activeWeatherLayers.includes(layerId);
      const shouldEnable = forceState !== undefined ? forceState : !exists;
      const nextLayers = shouldEnable
        ? exists
          ? prev.activeWeatherLayers
          : [...prev.activeWeatherLayers, layerId]
        : prev.activeWeatherLayers.filter((id) => id !== layerId);
      return {
        activeWeatherLayers: nextLayers,
      };
    });
  },

  setTimelineOffsetHours(offsetHours: number) {
    const clamped = Math.max(-168, Math.min(168, Math.round(offsetHours)));
    this.setState({ timelineOffsetHours: clamped });
  },

  setTimelinePlaying(isPlaying: boolean) {
    this.setState({ isTimelinePlaying: isPlaying });
  },

  setMapStack(
    stackId: MapStackId,
    origin: 'manual' | 'automatic_fallback' = 'manual',
    errorMsg: string | null = null
  ) {
    const desc = getMapStackDescriptor(stackId);
    this.setState((prev) => ({
      mapProvider: {
        ...prev.mapProvider,
        activeStackId: stackId,
        activeProviderLabel: desc.label,
        availability:
          origin === 'automatic_fallback' ? 'FALLBACK_ACTIVE' : 'AVAILABLE',
        switchOrigin: origin,
        imageryType: desc.imageryType,
        lastError: errorMsg,
        statusExplanation:
          origin === 'automatic_fallback'
            ? `Satellite fallback (${desc.label}) automatically activated: ${
                errorMsg || 'Primary 3D tile provider unavailable.'
              }`
            : `${desc.label} active.`,
        coverageLimitations: desc.coverageLimitations,
        attributionText: desc.attributionText,
      },
    }));
  },

  simulateProviderOutage(simulate: boolean) {
    if (simulate) {
      const fallbackDesc = getMapStackDescriptor('esri-imagery');
      this.setState((prev) => ({
        mapProvider: {
          ...prev.mapProvider,
          activeStackId: 'esri-imagery',
          activeProviderLabel: fallbackDesc.label,
          availability: 'FALLBACK_ACTIVE',
          switchOrigin: 'automatic_fallback',
          imageryType: fallbackDesc.imageryType,
          simulatedOutageActive: true,
          lastError:
            'Google Photorealistic 3D Tiles API key disabled / outage simulated.',
          statusExplanation:
            'Primary 3D tile provider unavailable — Esri World Imagery satellite fallback loaded automatically.',
          coverageLimitations: fallbackDesc.coverageLimitations,
          attributionText: fallbackDesc.attributionText,
        },
      }));
    } else {
      const hasGoogle = Boolean(resolveGoogleMapsApiKey());
      const targetStack: MapStackId = hasGoogle ? 'photoreal' : 'esri-imagery';
      const desc = getMapStackDescriptor(targetStack);
      this.setState((prev) => ({
        mapProvider: {
          ...prev.mapProvider,
          activeStackId: targetStack,
          activeProviderLabel: desc.label,
          availability: hasGoogle ? 'AVAILABLE' : 'FALLBACK_ACTIVE',
          switchOrigin: hasGoogle ? 'manual' : 'automatic_fallback',
          imageryType: desc.imageryType,
          simulatedOutageActive: false,
          lastError: null,
          statusExplanation: hasGoogle
            ? 'Google Photorealistic 3D Tiles restored and active.'
            : 'Esri World Imagery satellite active.',
          coverageLimitations: desc.coverageLimitations,
          attributionText: desc.attributionText,
        },
      }));
    }
  },

  runArgonQuery(
    query: string,
    options?: {
      customWeights?: Partial<Record<WeatherModelId, number>>;
      injectStaleForecastTest?: boolean;
      openReportWorkspace?: boolean;
    }
  ): ArgonInvestigationResult {
    const prev = this.getState();
    const weights = options?.customWeights ?? prev.customModelWeights;
    const stale = options?.injectStaleForecastTest ?? prev.staleForecastInjected;

    const inv = executeArgonVoiceWorkflow({
      query,
      currentCountryIso2: prev.selectedLocation.countryIso2,
      previousInvestigation: prev.activeInvestigation,
      customWeights: weights,
      injectStaleForecastTest: stale,
    });

    const report = generateArgonScientificReport(
      inv,
      'FULL_28_SECTION_SCIENTIFIC_REPORT'
    );

    const nextLoc = resolveGeographicTarget(
      inv.resolvedScope.scopeType === 'ASIA_REGIONAL'
        ? 'Asia'
        : inv.resolvedScope.scopeType === 'BRAZIL_COFFEE'
        ? 'Sul de Minas Coffee Belt, Brazil'
        : inv.resolvedScope.countryIso2
    );

    const mappedLayers = inv.resolvedScope.activeWeatherLayers.filter(
      (l): l is OperationalWeatherLayerId => Boolean(l)
    );
    const ideas = getPredictionAndTradeIdeasForLocation(
      nextLoc.countryIso2,
      prev.timelineOffsetHours
    );

    this.setState((curr) => ({
      activeInvestigation: inv,
      activeReport: report,
      customModelWeights: weights,
      staleForecastInjected: stale,
      selectedLocation: nextLoc,
      selectedTradeIdeaId: ideas[0]?.id || curr.selectedTradeIdeaId,
      cameraPose: {
        lat: inv.resolvedScope.targetLat,
        lng: inv.resolvedScope.targetLng,
        altitudeMeters: inv.resolvedScope.targetRangeMeters,
        headingDeg: 0,
        pitchDeg: -65,
        rollDeg: 0,
      },
      activeWeatherLayers:
        mappedLayers.length > 0
          ? mappedLayers.slice(0, 2)
          : curr.activeWeatherLayers,
      activeWorkspace: options?.openReportWorkspace
        ? 'SCIENTIFIC_REPORT'
        : curr.activeWorkspace,
      investigationHistory: [
        inv,
        ...curr.investigationHistory.filter(
          (item) => item.investigationId !== inv.investigationId
        ),
      ].slice(0, 12),
    }));

    return inv;
  },
};

export function useAtmosphereStore(): AtmosphereAppState {
  return useSyncExternalStore(
    atmosphereStore.subscribe,
    atmosphereStore.getState,
    atmosphereStore.getState
  );
}
