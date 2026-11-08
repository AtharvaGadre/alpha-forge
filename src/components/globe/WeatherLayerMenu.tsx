// ============================================================================
// ALPHAFORGE ATMOSPHERE — LEVEL 2 WEATHER LAYER MENU DRAWER
// Organized into Clean Categories: Weather, Storms, Satellite, Forecasts, Advanced
// ============================================================================

import React, { useState } from 'react';
import { X, Layers, Wind, AlertTriangle, Check } from 'lucide-react';
import {
  OPERATIONAL_WEATHER_LAYER_REGISTRY,
  LAYER_CATEGORIES,
  type OperationalLayerCategory,
  type OperationalWeatherLayerId,
} from '../../engine/globe/LayerRegistry';
import { atmosphereStore, useAtmosphereStore } from '../../state/atmosphereStore';
import { argonAudioManager } from '../../engine/argonAudioManager';

export const WeatherLayerMenu: React.FC = () => {
  const state = useAtmosphereStore();
  const [selectedCategory, setSelectedCategory] =
    useState<OperationalLayerCategory>('Weather');

  if (state.activeSidePanel !== 'LAYERS' || state.activeWorkspace !== 'GLOBE') {
    return null;
  }

  const filteredLayers = OPERATIONAL_WEATHER_LAYER_REGISTRY.filter(
    (layer) => layer.category === selectedCategory
  );

  const handleSelectLayer = (layerId: OperationalWeatherLayerId) => {
    atmosphereStore.setState({ activeWeatherLayers: [layerId] });
    argonAudioManager.triggerSound('FORECAST_UPDATED');
  };

  const windEnabled = state.activeWeatherLayers.includes('WIND_SPEED');
  const alertsEnabled = state.activeWeatherLayers.includes(
    'SEVERE_WEATHER_WARNINGS'
  );

  return (
    <aside
      aria-label="Weather Layers Drawer"
      data-testid="weather-layer-drawer"
      className="fixed right-4 top-20 bottom-24 z-30 w-[92vw] max-w-sm bg-slate-950/92 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 pointer-events-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-white">
            Atmospheric & Earth Layers
          </h2>
        </div>
        <button
          type="button"
          onClick={() => atmosphereStore.toggleSidePanel('LAYERS')}
          aria-label="Close layers drawer"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/70"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1 px-3 py-2.5 border-b border-slate-800/70 overflow-x-auto no-scrollbar">
        {LAYER_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            data-testid={`layer-category-${cat.toLowerCase()}`}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Quick Overlay Switches (Wind Streamlines & Official Alerts) */}
      <div className="grid grid-cols-2 gap-2 px-3.5 py-2.5 bg-slate-900/60 border-b border-slate-800/70">
        <button
          type="button"
          onClick={() => atmosphereStore.toggleWeatherLayer('WIND_SPEED')}
          data-testid="toggle-wind-particles"
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs border transition-colors ${
            windEnabled
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
              : 'bg-slate-900/80 border-slate-800 text-slate-400'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5" />
            Wind Flow
          </span>
          <span className="text-[10px] font-semibold">
            {windEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            atmosphereStore.toggleWeatherLayer('SEVERE_WEATHER_WARNINGS')
          }
          data-testid="toggle-weather-alerts"
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs border transition-colors ${
            alertsEnabled
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              : 'bg-slate-900/80 border-slate-800 text-slate-400'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            CAP Alerts
          </span>
          <span className="text-[10px] font-semibold">
            {alertsEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Layer List for Selected Category */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredLayers.map((layer) => {
          const isSelected = state.activeWeatherLayers.includes(layer.id);
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => handleSelectLayer(layer.id)}
              data-testid={`select-layer-${layer.id.toLowerCase()}`}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-sky-500/15 border-sky-400/60 shadow-sm'
                  : 'bg-slate-900/55 hover:bg-slate-900/90 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    {layer.name}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      layer.priority === 'P0'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : layer.priority === 'P1'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-purple-500/20 text-purple-300'
                    }`}
                  >
                    {layer.priority}
                  </span>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-sky-400 shrink-0" />
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                {layer.descriptionPlain}
              </p>

              {/* Colour Scale Preview */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {layer.legendStops.map((stop) => (
                  <span
                    key={stop.label}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-300"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: stop.colorHex }}
                    />
                    {stop.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
