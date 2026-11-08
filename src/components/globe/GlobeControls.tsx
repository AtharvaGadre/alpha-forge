// ============================================================================
// ALPHAFORGE ATMOSPHERE — GLOBE CONTROLS & LEVEL 2 SINGLE-PANEL DRAWERS
// Enforces Single-Panel Rule: Only ONE of FORECAST | LAYERS | NEWS | MODELS | SETTINGS
// may be open at a time.
// ============================================================================

import React, { useState } from 'react';
import {
  Plus,
  Minus,
  RotateCcw,
  Compass,
  X,
  Calendar,
  Newspaper,
  Cpu,
  Settings,
  AlertTriangle,
  FileText,
  ArrowUpRight,
  Volume2,
  ShieldAlert,
} from 'lucide-react';
import { atmosphereStore, useAtmosphereStore } from '../../state/atmosphereStore';
import { globeController } from '../../engine/globe/GlobeController';
import { WEATHER_MODEL_REGISTRY } from '../../engine/argonAtmosphereEngine';
import { buildWeatherFieldSnapshot } from '../../engine/globe/WeatherOverlayManager';
import { argonAudioManager } from '../../engine/argonAudioManager';

export const GlobeControls: React.FC = () => {
  const state = useAtmosphereStore();
  const [audioPrefs, setAudioPrefs] = useState(() =>
    argonAudioManager.getPreferences()
  );

  if (state.activeWorkspace !== 'GLOBE') {
    return null;
  }

  const place = state.selectedLocation;
  const inv = state.activeInvestigation;
  const ens = inv.modelComparison.ensembleResult;
  const alerts = buildWeatherFieldSnapshot({
    activeLayers: ['SEVERE_WEATHER_WARNINGS'],
    offsetHours: state.timelineOffsetHours,
    focusLat: place.lat,
    focusLng: place.lng,
  }).alertPolygons;

  return (
    <>
      {/* Subtle Left-Bottom Zoom & Orientation Controls */}
      <div
        className="fixed left-4 bottom-16 z-20 flex flex-col gap-1.5 pointer-events-auto"
        aria-label="Globe camera controls"
      >
        <button
          type="button"
          onClick={() => globeController.zoomByFactor(0.65)}
          aria-label="Zoom in"
          data-testid="globe-zoom-in"
          className="w-8 h-8 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800/90 text-slate-200 flex items-center justify-center shadow-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => globeController.zoomByFactor(1.45)}
          aria-label="Zoom out"
          data-testid="globe-zoom-out"
          className="w-8 h-8 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800/90 text-slate-200 flex items-center justify-center shadow-lg transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const cur = state.cameraPose;
            atmosphereStore.setState({
              cameraPose: {
                ...cur,
                pitchDeg: cur.pitchDeg < -65 ? -42 : -88,
              },
            });
          }}
          aria-label="Toggle 3D tilt"
          data-testid="globe-tilt-toggle"
          className="w-8 h-8 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800/90 text-slate-200 flex items-center justify-center shadow-lg transition-colors"
          title="Toggle 3D Horizon Tilt"
        >
          <Compass className="w-4 h-4 text-sky-400" />
        </button>
        <button
          type="button"
          onClick={() => globeController.resetGlobalView()}
          aria-label="Reset global view"
          data-testid="globe-reset-view"
          className="w-8 h-8 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800/90 text-slate-200 flex items-center justify-center shadow-lg transition-colors"
          title="Reset Global View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* LEVEL 2 DRAWER: FORECAST */}
      {state.activeSidePanel === 'FORECAST' && (
        <aside
          aria-label="7-Day Forecast Drawer"
          data-testid="forecast-drawer"
          className="fixed right-4 top-20 bottom-24 z-30 w-[92vw] max-w-sm bg-slate-950/92 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  7-Day Ensemble Forecast
                </h2>
                <p className="text-[11px] text-slate-400">{place.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => atmosphereStore.toggleSidePanel('FORECAST')}
              aria-label="Close forecast drawer"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            <div className="bg-slate-900/75 border border-slate-800/80 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Ensemble Consensus</span>
                <span className="font-semibold text-emerald-300">
                  {ens.disagreementLevel}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1.5 leading-relaxed">
                {ens.disagreementExplanation}
              </p>
            </div>

            <div className="space-y-2">
              {inv.modelComparison.modelInputs.map((m) => (
                <div
                  key={m.modelId}
                  className="flex items-center justify-between bg-slate-900/55 border border-slate-800/70 rounded-xl px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-white">{m.modelName}</div>
                    <div className="text-[11px] text-slate-400">
                      Weight: {(m.weight * 100).toFixed(0)}% · Wind:{' '}
                      {m.predictedWindSpeedMs} m/s
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-sky-300">
                      {m.predictedTemperatureC.toFixed(1)}°C
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Rain: {m.predictedPrecipitationMm.toFixed(1)} mm
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                atmosphereStore.openWorkspace(
                  'ADVANCED_RESEARCH',
                  'COMPARE_FORECASTS'
                )
              }
              data-testid="open-compare-forecasts-btn"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Compare Models
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => atmosphereStore.openWorkspace('SCIENTIFIC_REPORT')}
              data-testid="forecast-generate-report-btn"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs border border-slate-700"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              28-Sec Report
            </button>
          </div>
        </aside>
      )}

      {/* LEVEL 2 DRAWER: NEWS & ADVISORIES */}
      {state.activeSidePanel === 'NEWS' && (
        <aside
          aria-label="Weather News & Advisories Drawer"
          data-testid="news-drawer"
          className="fixed right-4 top-20 bottom-24 z-30 w-[92vw] max-w-sm bg-slate-950/92 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-sky-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Weather & Market Advisories
                </h2>
                <p className="text-[11px] text-slate-400">{place.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => atmosphereStore.toggleSidePanel('NEWS')}
              aria-label="Close news drawer"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            <div className="bg-slate-900/75 border border-slate-800/80 rounded-xl p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
                {place.weatherSummaryDefault.officialAgency}
              </div>
              <h3 className="text-xs font-semibold text-white mt-1">
                {place.name} Synoptic & Economic Briefing
              </h3>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {place.weatherSummaryDefault.oneSentenceSummary}
              </p>
              <p className="text-[11px] text-emerald-300/90 mt-1.5 leading-relaxed">
                {inv.epistemicMatrix.C_economicMechanisms[0]}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Active Official Advisories (CAP)
              </div>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-slate-900/65 border border-slate-800/80 rounded-xl p-3 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      {alert.title}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {alert.severity}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{alert.agency}</div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {alert.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90">
            <button
              type="button"
              onClick={() =>
                atmosphereStore.openWorkspace(
                  'ADVANCED_RESEARCH',
                  'ECONOMIC_IMPACT'
                )
              }
              data-testid="news-open-economic-impact-btn"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              Open Full Economic & Market Impact
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* LEVEL 2 DRAWER: MODELS */}
      {state.activeSidePanel === 'MODELS' && (
        <aside
          aria-label="Forecast Models Drawer"
          data-testid="models-drawer"
          className="fixed right-4 top-20 bottom-24 z-30 w-[92vw] max-w-sm bg-slate-950/92 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">
                Forecast Models (NWP + AI)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => atmosphereStore.toggleSidePanel('MODELS')}
              aria-label="Close models drawer"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {WEATHER_MODEL_REGISTRY.map((model) => (
              <div
                key={model.modelId}
                data-testid={`select-model-${model.modelId}`}
                className="w-full text-left p-3 rounded-xl border bg-slate-900/60 border-slate-800/80"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    {model.modelName}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                    {model.spatialResolutionDeg}° · {model.maxLeadTimeHours}h
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {model.provider}
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                  {model.accessMethodNote}
                </p>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* LEVEL 2 DRAWER: SETTINGS & PROVIDER FALLBACK CONTROLS */}
      {state.activeSidePanel === 'SETTINGS' && (
        <aside
          aria-label="Globe & Voice Settings Drawer"
          data-testid="settings-drawer"
          className="fixed right-4 top-20 bottom-24 z-30 w-[92vw] max-w-sm bg-slate-950/92 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">
                Earth Engine & ARGON Settings
              </h2>
            </div>
            <button
              type="button"
              onClick={() => atmosphereStore.toggleSidePanel('SETTINGS')}
              aria-label="Close settings drawer"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Satellite & 3D Map Provider Stack
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'photoreal', label: 'Google 3D' },
                    { id: 'esri-imagery', label: 'Esri Satellite' },
                    { id: 'osm', label: 'Low-Bandwidth' },
                  ] as const
                ).map((stack) => (
                  <button
                    key={stack.id}
                    type="button"
                    onClick={() => atmosphereStore.setMapStack(stack.id, 'manual')}
                    data-testid={`switch-provider-${stack.id}`}
                    className={`px-2 py-2 rounded-xl text-xs font-medium border transition-colors ${
                      state.mapProvider.activeStackId === stack.id
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {stack.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario F: Simulate Primary Provider Failure */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Resilience & Failover Test
                </span>
                <button
                  type="button"
                  onClick={() =>
                    atmosphereStore.simulateProviderOutage(
                      !state.mapProvider.simulatedOutageActive
                    )
                  }
                  data-testid="simulate-provider-outage-btn"
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    state.mapProvider.simulatedOutageActive
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {state.mapProvider.simulatedOutageActive
                    ? 'Outage Active (Fallback)'
                    : 'Simulate Outage'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Tests automatic failover from primary 3D tiles to Esri World
                Imagery / Low-Bandwidth without crashing the globe.
              </p>
            </div>

            {/* ARGON Speech & Sound Effects Controls */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                ARGON Voice & Sound Effects
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Spoken Voice Output</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = argonAudioManager.updatePreferences({
                      speechMuted: !audioPrefs.speechMuted,
                    });
                    setAudioPrefs(updated);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium ${
                    !audioPrefs.speechMuted
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {audioPrefs.speechMuted ? 'Muted' : 'Enabled'}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">UI Sound Effects (SFX)</span>
                <button
                  type="button"
                  onClick={() => {
                    const updated = argonAudioManager.updatePreferences({
                      sfxMuted: !audioPrefs.sfxMuted,
                    });
                    setAudioPrefs(updated);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium ${
                    !audioPrefs.sfxMuted
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {audioPrefs.sfxMuted ? 'Muted' : 'Enabled'}
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
};
