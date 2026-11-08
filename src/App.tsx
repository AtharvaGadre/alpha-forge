// ============================================================================
// ALPHAFORGE ATMOSPHERE — FUTURISTIC GLOBE-FIRST WEATHER & MARKET INTELLIGENCE
// Combines God's Eye View Synchronized 3D Earth with:
// 1. Predicted Weather Effects on Financial Markets & Research-Backed Trade Ideas
// 2. Prediction Market Ideas & Implied Probabilities Under the Map
// 3. General Trade Ideas from the News & Verified Regional News Feed
// 4. AI Executive Summary at the Bottom + ARGON Autonomous Voice Assistant
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Compass,
  FileText,
  Globe,
  Layers,
  Newspaper,
  Settings,
  Sparkles,
  TrendingUp,
  Volume2,
  X,
} from 'lucide-react';
import {
  atmosphereStore,
  useAtmosphereStore,
  type AdvancedSectionTabId,
} from './state/atmosphereStore';
import { GlobeCanvas } from './components/globe/GlobeCanvas';
import { GlobeSearch } from './components/globe/GlobeSearch';
import { ForecastTimeline } from './components/globe/ForecastTimeline';
import { LocationSummary } from './components/globe/LocationSummary';
import { WeatherLayerMenu } from './components/globe/WeatherLayerMenu';
import { GlobeControls } from './components/globe/GlobeControls';
import { GlobeAttribution } from './components/globe/GlobeAttribution';
import { ArgonVoiceAssistantHud } from './components/ArgonVoiceAssistantHud';
import { ArgonScientificReportModal } from './components/ArgonScientificReportModal';
import {
  WEATHER_MODEL_REGISTRY,
  type WeatherModelId,
} from './engine/argonAtmosphereEngine';
import {
  DEMO_PRESET_PROFILES,
  generateBottomAiResearchSummary,
  getNewsDrivenTradeIdeasForLocation,
  getPredictionAndTradeIdeasForLocation,
  type DemoPresetId,
  type PredictionMarketTradeIdea,
} from './engine/atmosphereIntelligenceDeckEngine';
import { argonAudioManager } from './engine/argonAudioManager';

export function App() {
  const state = useAtmosphereStore();
  const [weightDraft, setWeightDraft] = useState<
    Partial<Record<WeatherModelId, number>>
  >(state.customModelWeights);

  // Fetch live point weather telemetry when selectedLocation changes
  useEffect(() => {
    let cancelled = false;
    const loc = state.selectedLocation;
    const fetchLiveWeather = async () => {
      try {
        const res = await fetch(
          `/api/v1/weather/current?lat=${loc.lat}&lng=${loc.lng}&country=${loc.countryIso2}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.telemetry) {
          atmosphereStore.setState({ liveTelemetry: json.telemetry });
        }
      } catch {
        // Keep deterministic atmospheric calculation fallback
      }
    };
    void fetchLiveWeather();
    return () => {
      cancelled = true;
    };
  }, [
    state.selectedLocation.id,
    state.selectedLocation.lat,
    state.selectedLocation.lng,
    state.selectedLocation.countryIso2,
  ]);

  const inv = state.activeInvestigation;
  const loc = state.selectedLocation;
  const ens = inv.modelComparison.ensembleResult;
  const ver = inv.modelComparison.verificationMetrics;

  // Compute research-backed trade ideas, news-driven trade ideas, and bottom AI summary for the active location
  const predictionAndTradeIdeas = getPredictionAndTradeIdeasForLocation(
    loc.countryIso2,
    state.timelineOffsetHours
  );
  const newsTradeIdeas = getNewsDrivenTradeIdeasForLocation(loc.countryIso2);
  const bottomAiSummary = generateBottomAiResearchSummary(
    loc.countryIso2,
    loc.name,
    inv,
    predictionAndTradeIdeas,
    newsTradeIdeas
  );

  const spotlightIdea: PredictionMarketTradeIdea =
    predictionAndTradeIdeas.find((i) => i.id === state.selectedTradeIdeaId) ||
    predictionAndTradeIdeas[0];

  const handleSelectTradeIdea = (idea: PredictionMarketTradeIdea) => {
    atmosphereStore.selectTradeIdea(idea.id);
    atmosphereStore.selectLocation(idea.regionLabel, { openSummary: true });
  };

  const handleApplyWeightOverride = () => {
    atmosphereStore.runArgonQuery(inv.userQuery, {
      customWeights: weightDraft,
      injectStaleForecastTest: state.staleForecastInjected,
    });
  };

  const scrollToResearchDeck = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto overflow-x-hidden bg-[#020617] text-slate-100 font-sans">
      {/* =====================================================================
          STICKY TOP NAVIGATION BAR (FUTURISTIC GLOBE-CENTRIC HEADER)
      ===================================================================== */}
      <header className="sticky top-0 z-40 px-3 sm:px-5 py-2.5 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-[1680px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Brand Identity + Primary Navigation Tabs */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                atmosphereStore.closeAllPanelsToLevel0();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 hover:border-sky-400/50 transition-colors"
              title="Reset to clean Level 0 Earth view"
            >
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                <Globe className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold tracking-tight text-white leading-none">
                  AlphaForge Atmosphere
                </div>
                <div className="text-[10px] text-sky-300/90 mt-0.5">
                  Weather-to-Market Intelligence
                </div>
              </div>
            </button>

            {/* Primary Futuristic Navigation Pills */}
            <nav
              aria-label="Primary Platform Navigation"
              className="hidden xl:flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800"
            >
              {(
                [
                  {
                    id: 'OVERVIEW',
                    label: 'Overview',
                    targetId: 'hero-globe-section',
                  },
                  {
                    id: 'TRADE_IDEAS',
                    label: 'Trade Ideas',
                    targetId: 'under-map-trade-ideas',
                  },
                  {
                    id: 'MARKETS',
                    label: 'Markets & News',
                    targetId: 'under-map-news-ideas',
                  },
                  {
                    id: 'GLOBAL_DATA',
                    label: 'AI Summary',
                    targetId: 'under-map-ai-summary',
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    atmosphereStore.setActiveTopNav(item.id);
                    if (item.id === 'OVERVIEW') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                      scrollToResearchDeck(item.targetId);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    state.activeTopNav === item.id
                      ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Center: Geographic Search Input */}
          <GlobeSearch />

          {/* Right: Demo Access Preset Selector + Quick Actions + Basic/Advanced Switch */}
          <div className="flex items-center gap-1.5">
            {/* Instant Demo Workspace Selector (Clearly labelled DEMO ACCESS) */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/35">
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                DEMO ACCESS
              </span>
              <label htmlFor="demo-preset-select" className="sr-only">
                Select Demo Research Workspace
              </label>
              <select
                id="demo-preset-select"
                data-testid="demo-preset-select"
                value={state.activeDemoPresetId}
                onChange={(e) =>
                  atmosphereStore.applyDemoPreset(
                    e.target.value as DemoPresetId
                  )
                }
                className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer"
              >
                {DEMO_PRESET_PROFILES.map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    className="bg-slate-950 text-slate-100"
                  >
                    {preset.label} ({preset.roleBadge})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => atmosphereStore.toggleSidePanel('LAYERS')}
              data-testid="top-layers-button"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                state.activeSidePanel === 'LAYERS'
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-slate-900/85 border-slate-700/80 text-slate-200 hover:border-slate-600'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Layers</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-sky-300">
                {state.activeWeatherLayers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => atmosphereStore.toggleSidePanel('NEWS')}
              data-testid="top-news-button"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                state.activeSidePanel === 'NEWS'
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-slate-900/85 border-slate-700/80 text-slate-200 hover:border-slate-600'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">News</span>
            </button>

            <button
              type="button"
              onClick={() => atmosphereStore.toggleSidePanel('SETTINGS')}
              data-testid="top-settings-button"
              aria-label="Map Provider and System Settings"
              className={`p-2 rounded-xl border transition-colors ${
                state.activeSidePanel === 'SETTINGS'
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-slate-900/85 border-slate-700/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Basic / Advanced Mode Switch */}
            <div
              className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-700/80"
              role="group"
              aria-label="Interface Complexity Mode"
            >
              <button
                type="button"
                data-testid="mode-basic-button"
                onClick={() => atmosphereStore.setUserMode('BASIC')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  state.userMode === 'BASIC'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Basic
              </button>
              <button
                type="button"
                data-testid="mode-advanced-button"
                onClick={() => {
                  atmosphereStore.setUserMode('ADVANCED');
                  atmosphereStore.openWorkspace(
                    'ADVANCED_RESEARCH',
                    'COMPARE_FORECASTS'
                  );
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  state.userMode === 'ADVANCED'
                    ? 'bg-indigo-500 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Advanced
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          HERO SECTION: SYNCHRONIZED 3D EARTH + WEATHER-TO-MARKET OVERLAYS
      ===================================================================== */}
      <section
        id="hero-globe-section"
        className="relative w-full h-[calc(100vh-58px)] min-h-[580px] overflow-hidden border-b border-slate-800/90"
      >
        {/* 100% Lockstep-Synchronized 3D Earth & Atmospheric Canvas */}
        <GlobeCanvas />

        {/* Quick Regional Weather-to-Market Pills (Top-Left of Globe Viewport) */}
        <div className="pointer-events-none absolute top-3 left-3 sm:left-5 z-20 flex flex-wrap items-center gap-1.5 max-w-[65vw]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-slate-950/80 backdrop-blur-md border border-slate-800/90 px-2.5 py-1.5 rounded-xl">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Focus Region:
            </span>
            {[
              { label: 'London / UK', query: 'London' },
              {
                label: 'Brazil Coffee Belt',
                query: 'Sul de Minas Coffee Belt, Brazil',
              },
              { label: 'Tokyo / East Asia', query: 'Tokyo' },
              { label: 'US Midwest / NY', query: 'New York' },
              { label: 'Sweden / Nordics', query: 'Stockholm' },
            ].map((chip) => {
              const active =
                loc.name.toLowerCase().includes(chip.query.toLowerCase()) ||
                (chip.query.includes('Brazil') && loc.countryIso2 === 'BR') ||
                (chip.query === 'Tokyo' && loc.countryIso2 === 'JP') ||
                (chip.query === 'London' && loc.countryIso2 === 'GB') ||
                (chip.query === 'New York' && loc.countryIso2 === 'US') ||
                (chip.query === 'Stockholm' && loc.countryIso2 === 'SE');
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() =>
                    atmosphereStore.selectLocation(chip.query, {
                      openSummary: true,
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Left: Compact Location Summary Card (Level 1) */}
        <LocationSummary />

        {/* Right: Spotlight Card — Predicted Weather Effect on Financial Markets & Top Trade Idea */}
        {spotlightIdea && state.activeSidePanel === 'NONE' && (
          <aside
            data-testid="hero-trade-idea-spotlight"
            className="hidden lg:block pointer-events-auto absolute top-16 right-5 z-20 w-[355px] rounded-2xl bg-slate-950/88 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-4 text-slate-100"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                  Weather → Market Trade Idea
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/30 text-[10px] font-mono text-sky-300">
                {loc.countryName} ({loc.countryIso2})
              </span>
            </div>

            <div className="mt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    spotlightIdea.suggestedDirection === 'LONG'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : spotlightIdea.suggestedDirection === 'SHORT'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                  }`}
                >
                  {spotlightIdea.suggestedDirection} •{' '}
                  {spotlightIdea.convictionScore}/100 Conviction
                </span>
                <span className="text-xs font-mono font-semibold text-sky-300">
                  {spotlightIdea.impliedProbabilityPct}% Implied Odds
                </span>
              </div>

              <h3 className="text-xs font-semibold text-white mt-2 leading-snug">
                {spotlightIdea.tradeThesisTitle}
              </h3>

              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                <strong className="text-sky-300">Weather Catalyst:</strong>{' '}
                {spotlightIdea.weatherEvidenceSummary}
              </p>

              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                <strong className="text-emerald-300">Market Effect:</strong>{' '}
                {spotlightIdea.economicMechanism}
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1">
                {spotlightIdea.affectedInstruments.map((inst) => (
                  <span
                    key={inst.ticker}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-200"
                  >
                    {inst.ticker} ({inst.expectedSensitivity})
                  </span>
                ))}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => scrollToResearchDeck('under-map-trade-ideas')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-xs font-medium text-sky-200 transition-colors"
                >
                  <span>View All Trade Ideas Below</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    atmosphereStore.openWorkspace('SCIENTIFIC_REPORT')
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 transition-colors"
                >
                  28-Sec Report
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Level 2: Single Side Panel (Layers, Forecast, News, Settings) */}
        <WeatherLayerMenu />

        {state.activeSidePanel === 'FORECAST' && (
          <aside
            data-testid="forecast-side-panel"
            className="pointer-events-auto fixed top-16 right-4 z-30 w-[380px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-4 text-slate-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-sky-400">
                  7-Day Outlook & Market Transmission
                </div>
                <h2 className="text-sm font-semibold text-white mt-0.5">
                  {loc.name} ({loc.countryName})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => atmosphereStore.toggleSidePanel('NONE')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[11px] font-semibold text-sky-300">
                  Observed Historical Impact (Past 7 Days)
                </div>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  {inv.epistemicMatrix.A_whatWeatherOccurred[0]}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[11px] font-semibold text-emerald-300">
                  Predicted Future Scenario (Next 7–10 Days)
                </div>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  {inv.epistemicMatrix.E_modelSupportedFutureScenarios[0]}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-200">
                    Consensus Status
                  </span>
                  <span className="text-xs font-mono text-sky-300">
                    {ens.disagreementLevel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {ens.disagreementExplanation}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  atmosphereStore.openWorkspace(
                    'ADVANCED_RESEARCH',
                    'COMPARE_FORECASTS'
                  )
                }
                className="w-full py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 font-medium transition-colors"
              >
                Compare All 6 Forecast Models in Advanced View
              </button>
            </div>
          </aside>
        )}

        {state.activeSidePanel === 'NEWS' && (
          <aside
            data-testid="news-side-panel"
            className="pointer-events-auto fixed top-16 right-4 z-30 w-[390px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-4 text-slate-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-400">
                  Verified Meteorological & Macro Alerts
                </div>
                <h2 className="text-sm font-semibold text-white mt-0.5">
                  {loc.countryName} Advisories & Market News
                </h2>
              </div>
              <button
                type="button"
                onClick={() => atmosphereStore.toggleSidePanel('NONE')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {newsTradeIdeas.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-900/85 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {item.sourceTypeBadge}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.sourceAgency}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {item.headline}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {item.newsSummary}
                  </p>
                  <div className="pt-1.5 border-t border-slate-800/80 text-[11px] text-sky-300">
                    <strong>Trade Idea ({item.suggestedDirection}):</strong>{' '}
                    {item.derivedTradeIdeaTitle} [
                    {item.targetTickers.join(', ')}]
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {state.activeSidePanel === 'SETTINGS' && (
          <aside
            data-testid="settings-side-panel"
            className="pointer-events-auto fixed top-16 right-4 z-30 w-[380px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-4 text-slate-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-sky-400">
                  Geospatial & Provider Diagnostics
                </div>
                <h2 className="text-sm font-semibold text-white mt-0.5">
                  God&apos;s Eye View Map Stack
                </h2>
              </div>
              <button
                type="button"
                onClick={() => atmosphereStore.toggleSidePanel('NONE')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                  Select Map Rendering Provider
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {(
                    [
                      {
                        id: 'photoreal',
                        title: 'Google Photorealistic 3D Tiles',
                        sub: 'Primary 3D urban & terrain mesh via CesiumJS',
                      },
                      {
                        id: 'esri-imagery',
                        title: 'Esri World Imagery Satellite',
                        sub: 'High-resolution global satellite fallback',
                      },
                      {
                        id: 'osm',
                        title: 'OpenStreetMap Low-Bandwidth',
                        sub: 'Lightweight vector/raster base map',
                      },
                    ] as const
                  ).map((stack) => (
                    <button
                      key={stack.id}
                      type="button"
                      data-testid={`stack-option-${stack.id}`}
                      onClick={() =>
                        atmosphereStore.setMapStack(stack.id, 'manual')
                      }
                      className={`text-left p-2.5 rounded-xl border transition-colors ${
                        state.mapProvider.activeStackId === stack.id
                          ? 'bg-sky-500/15 border-sky-400/50 text-white'
                          : 'bg-slate-900/75 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-xs">{stack.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {stack.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/85 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Active Provider:</span>
                  <span className="font-medium text-sky-300">
                    {state.mapProvider.activeProviderLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Switch Origin:</span>
                  <span className="font-mono text-[11px] text-slate-200">
                    {state.mapProvider.switchOrigin}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                  {state.mapProvider.statusExplanation}
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  data-testid="simulate-outage-button"
                  onClick={() =>
                    atmosphereStore.simulateProviderOutage(
                      !state.mapProvider.simulatedOutageActive
                    )
                  }
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                    state.mapProvider.simulatedOutageActive
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {state.mapProvider.simulatedOutageActive
                    ? 'Restore Primary Map Provider'
                    : 'Simulate 3D Tile Outage (Test Satellite Fallback)'}
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Bottom-Center: Forecast Timeline Scrubber */}
        <ForecastTimeline />

        {/* Bottom-Right: Minimal Camera Controls */}
        <GlobeControls />

        {/* Bottom-Left: Attribution + ARGON Voice Orb */}
        <GlobeAttribution />
        <ArgonVoiceAssistantHud currentCountryIso2={loc.countryIso2} />
      </section>

      {/* =====================================================================
          UNDER THE MAP: WEATHER EFFECTS ON FINANCIAL MARKETS & TRADE IDEAS DECK
          1. Predicted Weather Effects on Markets + Prediction Market & Trade Ideas
          2. General Trade Ideas from the News + Verified Regional News
          3. AI Executive Summary at the Bottom
      ===================================================================== */}
      <main
        id="under-map-research-deck"
        data-testid="under-map-research-deck"
        className="relative z-20 max-w-[1680px] mx-auto px-4 sm:px-6 py-8 space-y-8"
      >
        {/* ===================================================================
            SECTION 1: PREDICTED WEATHER EFFECTS ON FINANCIAL MARKETS &
                       RESEARCH-BACKED TRADE IDEAS / PREDICTION MARKETS
        =================================================================== */}
        <section
          id="under-map-trade-ideas"
          data-testid="under-map-trade-ideas"
          className="rounded-3xl bg-slate-900/75 border border-slate-800/90 p-5 sm:p-6 shadow-2xl space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                <TrendingUp className="w-4 h-4" />
                <span>
                  Section 1 • Predicted Weather Effects on Financial Markets &
                  Research-Backed Trade Ideas
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                {loc.name}, {loc.countryName} — Weather-to-Market Causal Impact
                & Prediction Market Ideas
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                All trade ideas and prediction market probabilities below are
                backed by multi-model meteorological forecasts (WeatherNext 3,
                ECMWF IFS, ECMWF AIFS, GraphCast, NOAA GFS) and historical
                cross-asset sensitivity.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  atmosphereStore.openWorkspace(
                    'ADVANCED_RESEARCH',
                    'ECONOMIC_IMPACT'
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                Open Full Cross-Asset Matrix
              </button>
              <button
                type="button"
                onClick={() =>
                  atmosphereStore.openWorkspace('SCIENTIFIC_REPORT')
                }
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Generate 28-Section Report</span>
              </button>
            </div>
          </div>

          {/* Explicit Weather-to-Financial-Markets Causal Impact Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                <Compass className="w-4 h-4" />
                <span>1. Observed vs. Predicted Weather Anomaly</span>
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                <strong className="text-white">Past 7 Days (Observed):</strong>{' '}
                {inv.epistemicMatrix.A_whatWeatherOccurred[0]}
              </p>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                <strong className="text-sky-300">
                  Next 7–10 Days (Predicted):
                </strong>{' '}
                {inv.epistemicMatrix.B_whatModelsPredict[0]}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <Activity className="w-4 h-4" />
                <span>
                  2. Physical & Economic Transmission to Financial Markets
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {inv.conditionalWatchlist.slice(0, 2).map((row) => (
                  <div
                    key={row.instrument}
                    className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-white">
                      <span>
                        {row.instrument} — {row.name}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-300">
                        {row.observed7DayMovePct}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1">
                      {row.observedMoveAttributionNote}
                    </p>
                    <div className="text-[11px] text-sky-300 mt-1">
                      <strong>Predicted Market Scenario:</strong>{' '}
                      {row.positiveWeatherScenario}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-amber-300">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>3. Multi-Model Forecast Consensus & Skill</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 font-mono text-[11px]">
                  {ens.disagreementLevel}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {ens.disagreementExplanation}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {inv.modelComparison.modelInputs.slice(0, 3).map((m) => (
                  <div
                    key={m.modelId}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <div className="text-[10px] font-semibold text-slate-300 truncate">
                      {m.modelName}
                    </div>
                    <div className="text-xs font-mono font-bold text-sky-300 mt-0.5">
                      {(m.weight * 100).toFixed(0)}% wt
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {m.predictedPrecipitationMm.toFixed(1)} mm
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Prediction Market Ideas & Research-Backed Trade Ideas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {predictionAndTradeIdeas.map((idea) => {
              const isSelected = idea.id === spotlightIdea?.id;
              return (
                <article
                  key={idea.id}
                  data-testid={`trade-idea-card-${idea.id}`}
                  onClick={() => handleSelectTradeIdea(idea)}
                  className={`cursor-pointer rounded-2xl p-5 border transition-all ${
                    isSelected
                      ? 'bg-slate-950/95 border-sky-400/70 shadow-lg shadow-sky-950/40'
                      : 'bg-slate-950/75 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Row: Prediction Market Badge + Direction + Conviction */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                          idea.suggestedDirection === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : idea.suggestedDirection === 'SHORT'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                        }`}
                      >
                        SUGGESTED TRADE: {idea.suggestedDirection}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-300">
                        Horizon: {idea.horizonDays}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-sky-300">
                        Conviction: {idea.convictionScore}/100
                      </span>
                    </div>
                  </div>

                  {/* Trade Thesis Title */}
                  <h3 className="text-base font-bold text-white mt-3">
                    {idea.tradeThesisTitle}
                  </h3>

                  {/* Prediction Market Contract Box */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300">
                        Prediction Market Contract • {idea.marketVenueLabel}
                      </div>
                      <div className="text-xs font-medium text-slate-100 mt-0.5">
                        “{idea.contractQuestion}”
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-emerald-300">
                        {idea.impliedProbabilityPct}% YES
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {idea.probabilityChange24hPct >= 0 ? '+' : ''}
                        {idea.probabilityChange24hPct}% (24h) • Vol{' '}
                        {idea.contractVolumeUsd}
                      </div>
                    </div>
                  </div>

                  {/* Research Evidence & Financial Market Transmission */}
                  <div className="mt-3 space-y-2 text-xs">
                    <p className="text-slate-300 leading-relaxed">
                      <strong className="text-sky-300">
                        Predicted Weather Evidence:
                      </strong>{' '}
                      {idea.weatherEvidenceSummary}
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      <strong className="text-emerald-300">
                        Effect on Financial Markets:
                      </strong>{' '}
                      {idea.economicMechanism}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-slate-300">
                        Forecast Models:
                      </strong>{' '}
                      {idea.forecastSourceModels.join(', ')} •{' '}
                      <strong className="text-slate-300">
                        Historical Analog:
                      </strong>{' '}
                      {idea.historicalAnalog}
                    </p>
                  </div>

                  {/* Suggested Tradable Instruments */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Suggested Financial Instruments & Sensitivity
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {idea.affectedInstruments.map((inst) => (
                        <div
                          key={inst.ticker}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/90 text-xs flex items-center gap-1.5"
                        >
                          <span className="font-mono font-bold text-white">
                            {inst.ticker}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {inst.name}
                          </span>
                          <span className="text-emerald-300 font-mono text-[10px]">
                            ({inst.expectedSensitivity})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Uncertainty & Invalidation Criteria */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="text-slate-400">
                      <strong className="text-amber-300">Uncertainty:</strong>{' '}
                      {idea.uncertaintyNotes}
                    </div>
                    <div className="text-slate-400">
                      <strong className="text-rose-300">Invalidation:</strong>{' '}
                      {idea.invalidationCriteria}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ===================================================================
            SECTION 2: GENERAL TRADE IDEAS FROM THE NEWS & VERIFIED NEWS FEED
        =================================================================== */}
        <section
          id="under-map-news-ideas"
          data-testid="under-map-news-ideas"
          className="rounded-3xl bg-slate-900/75 border border-slate-800/90 p-5 sm:p-6 shadow-2xl space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Newspaper className="w-4 h-4" />
                <span>
                  Section 2 • General Trade Ideas from the News & Verified
                  Regional Advisories
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                Verified News Headlines → Actionable Market Trade Hypotheses
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-300 font-medium">
              Region: {loc.countryName} ({loc.countryIso2})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {newsTradeIdeas.map((news) => (
              <article
                key={news.id}
                data-testid={`news-trade-idea-${news.id}`}
                className="rounded-2xl bg-slate-950/85 border border-slate-800 p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-semibold uppercase text-emerald-300">
                      {news.sourceTypeBadge.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {news.sourceAgency}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {news.headline}
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {news.newsSummary}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                      Derived News Trade Idea
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        news.suggestedDirection === 'LONG'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : news.suggestedDirection === 'SHORT'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {news.suggestedDirection}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {news.derivedTradeIdeaTitle}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {news.derivedTradeMechanism}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                    <div className="flex flex-wrap gap-1.5">
                      {news.targetTickers.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-sky-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Risk: {news.riskAndAlternativeView}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ===================================================================
            SECTION 3: AI EXECUTIVE SUMMARY AT THE BOTTOM
        =================================================================== */}
        <section
          id="under-map-ai-summary"
          data-testid="under-map-ai-summary"
          className="rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-950 to-sky-950/40 border border-sky-500/40 p-6 shadow-2xl space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Section 3 • ARGON AI Executive Synthesis (Bottom Summary)
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  {bottomAiSummary.headline}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="narrate-ai-summary-button"
                onClick={() => {
                  void argonAudioManager.speakText(
                    bottomAiSummary.spokenNarrationScript
                  );
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-xs font-semibold text-sky-200 transition-colors"
              >
                <Volume2 className="w-4 h-4" />
                <span>Narrate Summary with ARGON</span>
              </button>
              <button
                type="button"
                data-testid="bottom-open-28-report-button"
                onClick={() =>
                  atmosphereStore.openWorkspace('SCIENTIFIC_REPORT')
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Open Full 28-Section Report</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                Weather Regime Synthesis
              </div>
              <p className="text-slate-300 leading-relaxed">
                {bottomAiSummary.weatherRegimeSynthesis}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
                Multi-Model Skill Consensus
              </div>
              <p className="text-slate-300 leading-relaxed">
                {bottomAiSummary.modelConsensusSynthesis}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                Prediction Markets & Trade Ideas
              </div>
              <p className="text-slate-300 leading-relaxed">
                {bottomAiSummary.predictionMarketSynthesis}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                News & Risk Caveat
              </div>
              <p className="text-slate-300 leading-relaxed">
                {bottomAiSummary.newsCatalystSynthesis}
              </p>
              <p className="text-[11px] text-amber-200/90 pt-1 border-t border-slate-800">
                {bottomAiSummary.confidenceAndRiskCaveat}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Provenance Hash:{' '}
                <code className="text-slate-300 font-mono">
                  {bottomAiSummary.provenanceHash}
                </code>
              </span>
            </div>
            <div>
              Generated at{' '}
              <span className="font-mono text-slate-300">
                {bottomAiSummary.generatedAtUtc}
              </span>{' '}
              • Synchronized across Web & Native Mobile APIs
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          LEVEL 3: DEDICATED ADVANCED RESEARCH WORKSPACE
          5 Clean Sections:
          1. Compare Forecasts
          2. Model Accuracy
          3. Weather Research
          4. Economic Impact
          5. Reports
      ===================================================================== */}
      {state.activeWorkspace === 'ADVANCED_RESEARCH' && (
        <div
          data-testid="advanced-research-workspace"
          className="fixed inset-0 z-50 bg-slate-950/96 backdrop-blur-2xl flex flex-col overflow-hidden"
        >
          {/* Workspace Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Advanced Atmospheric & Econometric Laboratory
                </div>
                <h1 className="text-base font-bold text-white">
                  {inv.resolvedScope.regionLabel} — {loc.name}
                </h1>
              </div>
            </div>

            {/* 5 Clean Section Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(
                [
                  { id: 'COMPARE_FORECASTS', label: '1. Compare Forecasts' },
                  { id: 'MODEL_ACCURACY', label: '2. Model Accuracy' },
                  { id: 'WEATHER_RESEARCH', label: '3. Weather Research' },
                  { id: 'ECONOMIC_IMPACT', label: '4. Economic Impact' },
                  { id: 'REPORTS', label: '5. Reports' },
                ] as { id: AdvancedSectionTabId; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`advanced-tab-${tab.id}`}
                  onClick={() =>
                    atmosphereStore.openWorkspace('ADVANCED_RESEARCH', tab.id)
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    state.advancedTab === tab.id
                      ? 'bg-indigo-500 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="close-advanced-workspace"
              onClick={() => atmosphereStore.openWorkspace('GLOBE')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
            >
              <X className="w-4 h-4" />
              <span>Return to Globe</span>
            </button>
          </div>

          {/* Workspace Body */}
          <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6">
            {/* TAB 1: COMPARE FORECASTS */}
            {state.advancedTab === 'COMPARE_FORECASTS' && (
              <div className="space-y-6" data-testid="section-compare-forecasts">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                    <div className="text-xs text-slate-400">
                      Multi-Model Agreement
                    </div>
                    <div className="text-lg font-bold text-white mt-1">
                      {ens.disagreementLevel}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {ens.disagreementExplanation}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                    <div className="text-xs text-slate-400">
                      Ensemble Temperature & Wind
                    </div>
                    <div className="text-lg font-bold text-sky-300 mt-1">
                      {ens.ensembleTemperatureC.toFixed(1)}°C •{' '}
                      {ens.ensembleWindSpeedMs.toFixed(1)} m/s
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Calibrated 90% PI: [{ens.calibrated90PctIntervalMm[0]},{' '}
                      {ens.calibrated90PctIntervalMm[1]}] mm
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
                    <div className="text-xs text-slate-400">
                      Ensemble Precipitation
                    </div>
                    <div className="text-lg font-bold text-emerald-300 mt-1">
                      {ens.ensemblePrecipitationMm.toFixed(1)} mm
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Spread: ±{ens.rawEnsembleSpreadMm.toFixed(1)} mm (Calibrated
                      ±{ens.calibratedPredictiveStdMm.toFixed(1)} mm)
                    </p>
                  </div>
                </div>

                {/* Model Comparison Table */}
                <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="p-3.5">Forecast Model</th>
                        <th className="p-3.5">Predicted Temp</th>
                        <th className="p-3.5">Predicted Precip (mm)</th>
                        <th className="p-3.5">Predicted Wind (m/s)</th>
                        <th className="p-3.5">Exceedance (&gt;20mm)</th>
                        <th className="p-3.5">Skill Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {inv.modelComparison.modelInputs.map((m) => (
                        <tr key={m.modelId} className="hover:bg-slate-800/40">
                          <td className="p-3.5 font-semibold text-white">
                            {m.modelName}
                          </td>
                          <td className="p-3.5 text-sky-300 font-mono">
                            {m.predictedTemperatureC.toFixed(1)}°C
                          </td>
                          <td className="p-3.5 text-emerald-300 font-mono">
                            {m.predictedPrecipitationMm.toFixed(1)} mm
                          </td>
                          <td className="p-3.5 text-slate-300 font-mono">
                            {m.predictedWindSpeedMs.toFixed(1)} m/s
                          </td>
                          <td className="p-3.5 font-mono text-amber-300">
                            {(m.probExceedance20Mm * 100).toFixed(0)}%
                          </td>
                          <td className="p-3.5 font-mono font-semibold text-white">
                            {(m.weight * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: MODEL ACCURACY */}
            {state.advancedTab === 'MODEL_ACCURACY' && (
              <div className="space-y-6" data-testid="section-model-accuracy">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Rolling Forecast Verification & Skill Weight Controls
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Metrics computed deterministically: MAE ({ver.mae}), RMSE (
                      {ver.rmse}), Brier Score ({ver.brierScore}), CRPS (
                      {ver.crps}), and 90% PI Coverage (
                      {ver.predictionIntervalCoverage90Pct}%).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="inject-stale-forecast-button"
                      onClick={() => {
                        const nextStale = !state.staleForecastInjected;
                        atmosphereStore.runArgonQuery(inv.userQuery, {
                          injectStaleForecastTest: nextStale,
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                        state.staleForecastInjected
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                          : 'bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      {state.staleForecastInjected
                        ? 'Clear Stale Model Run Test'
                        : 'Simulate Stale Model Run Penalty'}
                    </button>
                    <button
                      type="button"
                      data-testid="apply-model-weights-button"
                      onClick={handleApplyWeightOverride}
                      className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold"
                    >
                      Recalculate Consensus
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inv.modelComparison.modelInputs.map((m) => (
                    <div
                      key={m.modelId}
                      className="p-4 rounded-2xl bg-slate-900/85 border border-slate-800 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">
                          {m.modelName}
                        </span>
                        <span className="font-mono text-indigo-300">
                          Effective Weight: {(m.weight * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-slate-400 text-[11px]">
                          Custom Weight Multiplier:
                        </span>
                        <input
                          type="range"
                          min={0.05}
                          max={1.0}
                          step={0.05}
                          value={weightDraft[m.modelId] ?? m.weight}
                          onChange={(e) =>
                            setWeightDraft((prev) => ({
                              ...prev,
                              [m.modelId]: Number(e.target.value),
                            }))
                          }
                          className="flex-1 accent-indigo-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: WEATHER RESEARCH */}
            {state.advancedTab === 'WEATHER_RESEARCH' && (
              <div className="space-y-6" data-testid="section-weather-research">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                      Observed Past Weather Analysis (Historical)
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {inv.epistemicMatrix.A_whatWeatherOccurred.join(' ')}
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Forecast Future Scenario Analysis (Forward-Looking)
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {inv.epistemicMatrix.B_whatModelsPredict.join(' ')}
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/85 border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-white">
                    Global & Regional Weather Model Registry (
                    {WEATHER_MODEL_REGISTRY.length} Registered Systems)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {WEATHER_MODEL_REGISTRY.map((reg) => (
                      <div
                        key={reg.modelId}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800"
                      >
                        <div className="font-semibold text-white">
                          {reg.modelName}
                        </div>
                        <div className="text-[11px] text-sky-300 mt-0.5">
                          {reg.provider} • {reg.spatialResolutionDeg}° •{' '}
                          {reg.maxLeadTimeHours}h
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {reg.accessMethodNote}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ECONOMIC IMPACT */}
            {state.advancedTab === 'ECONOMIC_IMPACT' && (
              <div className="space-y-4" data-testid="section-economic-impact">
                {inv.conditionalWatchlist.map((row) => (
                  <div
                    key={row.instrument}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                          {row.sector} • {row.conditionalHypothesisLabel}
                        </span>
                        <h3 className="text-base font-bold text-white mt-0.5">
                          {row.instrument} — {row.name}
                        </h3>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-mono text-sky-300">
                        7d Observed Move: {row.observed7DayMovePct}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      <strong>Attribution & Mechanism:</strong>{' '}
                      {row.observedMoveAttributionNote}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
                        <div className="font-semibold text-sky-300 mb-1">
                          Positive / Primary Weather Scenario
                        </div>
                        <p className="text-slate-300">
                          {row.positiveWeatherScenario}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
                        <div className="font-semibold text-emerald-300 mb-1">
                          Alternative / Invalidation Scenario
                        </div>
                        <p className="text-slate-300">
                          {row.negativeWeatherScenario} ({row.invalidationCriteria})
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 5: REPORTS */}
            {state.advancedTab === 'REPORTS' && (
              <div className="space-y-4" data-testid="section-reports">
                <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                      28-Section Institutional Research Dossier
                    </div>
                    <h2 className="text-lg font-bold text-white mt-1">
                      {state.activeReport.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Provenance Hash:{' '}
                      {state.activeReport.modelRegistryChecksum} •{' '}
                      {state.activeReport.sections28.length} Verified Sections
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="open-full-report-modal-button"
                    onClick={() =>
                      atmosphereStore.openWorkspace('SCIENTIFIC_REPORT')
                    }
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open Full-Screen 28-Section Report & Exports</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          LEVEL 3: FULL-SCREEN 28-SECTION SCIENTIFIC REPORT WORKSPACE
      ===================================================================== */}
      {state.activeWorkspace === 'SCIENTIFIC_REPORT' && (
        <ArgonScientificReportModal
          report={state.activeReport}
          onClose={() => atmosphereStore.openWorkspace('GLOBE')}
        />
      )}
    </div>
  );
}

export default App;
