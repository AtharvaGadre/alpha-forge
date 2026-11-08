// ============================================================================
// ALPHAFORGE ATMOSPHERE — LEVEL 1 PLACE SUMMARY CARD
// Compact Floating Card when a Country, City, or Region is Selected
// ============================================================================

import React from 'react';
import {
  X,
  Thermometer,
  Wind,
  CloudRain,
  Sparkles,
  Layers,
  Calendar,
  ArrowUpRight,
  Building2,
} from 'lucide-react';
import { atmosphereStore, useAtmosphereStore } from '../../state/atmosphereStore';
import { argonVoiceStateMachine } from '../../engine/argonVoiceStateMachine';
import { argonAudioManager } from '../../engine/argonAudioManager';

export const LocationSummary: React.FC = () => {
  const state = useAtmosphereStore();
  const place = state.selectedLocation;

  if (!place || !state.locationSummaryOpen || state.activeWorkspace !== 'GLOBE') {
    return null;
  }

  const wx = place.weatherSummaryDefault;

  return (
    <aside
      aria-label={`Weather summary for ${place.name}`}
      data-testid="location-summary-card"
      className="fixed left-4 top-20 z-30 w-[90vw] max-w-sm bg-slate-950/88 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 shadow-2xl text-slate-100 pointer-events-auto transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
              {place.kind === 'CITY'
                ? 'City'
                : place.kind === 'AGRICULTURAL_OR_ECONOMIC_REGION'
                ? 'Agricultural Belt'
                : place.kind === 'COUNTRY'
                ? 'Country'
                : 'Region'}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {place.lat.toFixed(2)}°, {place.lng.toFixed(2)}°
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-1">
            {place.name}
          </h2>
          <p className="text-[11px] text-slate-400">{place.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => atmosphereStore.setState({ locationSummaryOpen: false })}
          aria-label="Close location summary"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Current Weather + Next 24h Strip */}
      <div className="grid grid-cols-3 gap-2 mt-3 bg-slate-900/75 border border-slate-800/80 rounded-xl p-2.5">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-sky-400" /> Now
          </span>
          <span className="text-base font-semibold text-white mt-0.5">
            {wx.temperatureC.toFixed(1)}°C
          </span>
          <span className="text-[10px] text-slate-400 truncate">
            {wx.conditionLabel}
          </span>
        </div>

        <div className="flex flex-col border-l border-slate-800/80 pl-2.5">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-emerald-400" /> Next 24h
          </span>
          <span className="text-sm font-semibold text-emerald-300 mt-0.5">
            {wx.next24hTempRangeC[0]}°–{wx.next24hTempRangeC[1]}°C
          </span>
          <span className="text-[10px] text-slate-400">
            Rain: {wx.precipitation24hMm.toFixed(1)} mm ({wx.next24hRainProbPct}%)
          </span>
        </div>

        <div className="flex flex-col border-l border-slate-800/80 pl-2.5">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Wind className="w-3 h-3 text-amber-400" /> Wind / RH
          </span>
          <span className="text-sm font-semibold text-slate-100 mt-0.5">
            {wx.windSpeedMs.toFixed(1)} m/s
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <CloudRain className="w-2.5 h-2.5 text-sky-400" />
            {wx.humidityPct}% RH
          </span>
        </div>
      </div>

      {/* 1-Sentence Plain-Language Summary */}
      <p className="text-xs text-slate-300 leading-relaxed mt-3">
        {wx.oneSentenceSummary}
      </p>

      {/* Optional 3D Landmark Fly-In Button */}
      {place.landmark && (
        <button
          type="button"
          onClick={() => {
            atmosphereStore.selectLocation(place, {
              openSummary: true,
              flyLandmark3D: true,
            });
            argonAudioManager.triggerSound(
              'MAP_TRANSITION',
              `3D Landmark: ${place.landmark?.name}`
            );
          }}
          data-testid="fly-to-landmark-btn"
          className="mt-2.5 w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-xs text-sky-200 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
            Fly to 3D Landmark: {place.landmark.name}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 4 Progressive Disclosure Actions */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={() => atmosphereStore.toggleSidePanel('FORECAST')}
          data-testid="location-action-view-forecast"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" />
          View forecast
        </button>

        <button
          type="button"
          onClick={() => atmosphereStore.toggleSidePanel('LAYERS')}
          data-testid="location-action-explore-weather"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-medium text-xs border border-slate-700/80 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          Explore weather
        </button>

        <button
          type="button"
          onClick={() => {
            void argonVoiceStateMachine.processUserUtterance(
              `Explain the current weather and 7-day forecast for ${place.name}`
            );
          }}
          data-testid="location-action-ask-argon"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-medium text-xs border border-slate-700/80 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Ask ARGON
        </button>

        <button
          type="button"
          onClick={() =>
            atmosphereStore.openWorkspace(
              'ADVANCED_RESEARCH',
              'COMPARE_FORECASTS'
            )
          }
          data-testid="location-action-more-details"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-medium text-xs border border-slate-700/80 transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
          More details
        </button>
      </div>
    </aside>
  );
};
