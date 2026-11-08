// ============================================================================
// ALPHAFORGE ATMOSPHERE — PROVIDER ATTRIBUTION & DIAGNOSTICS POPUP
// Displays Required Google / Esri / OSM Attribution and Toggleable Provider Status
// ============================================================================

import React, { useState } from 'react';
import { Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAtmosphereStore } from '../../state/atmosphereStore';
import { getWeatherLayerById } from '../../engine/globe/LayerRegistry';
import { formatOffsetHoursToHumanLabel } from '../../engine/globe/ForecastAnimationController';

export const GlobeAttribution: React.FC = () => {
  const state = useAtmosphereStore();
  const [diagOpen, setDiagOpen] = useState(false);

  if (state.activeWorkspace !== 'GLOBE') {
    return null;
  }

  const primaryLayerId = state.activeWeatherLayers[0] || 'TEMPERATURE';
  const activeLayer = getWeatherLayerById(primaryLayerId);
  const timeInfo = formatOffsetHoursToHumanLabel(state.timelineOffsetHours);

  return (
    <div
      className="fixed left-4 bottom-4 z-20 flex flex-col items-start gap-1.5 pointer-events-auto"
      data-testid="globe-attribution"
    >
      {diagOpen && (
        <div
          data-testid="provider-diagnostics-panel"
          className="bg-slate-950/92 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-3 text-xs text-slate-200 shadow-2xl w-72 space-y-1.5"
        >
          <div className="flex items-center justify-between font-semibold text-white border-b border-slate-800 pb-1.5">
            <span>Geospatial & Weather Telemetry</span>
            {state.mapProvider.simulatedOutageActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                <AlertCircle className="w-3 h-3" /> Failover Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Nominal
              </span>
            )}
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Active Map Stack:</span>
            <span className="font-mono text-sky-300">
              {state.mapProvider.activeStackId}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Imagery Mode:</span>
            <span className="font-mono text-slate-200">
              {state.mapProvider.imageryType}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Active Layer:</span>
            <span className="font-mono text-emerald-300">
              {activeLayer.shortName}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Forecast Horizon:</span>
            <span className="font-mono text-slate-200">
              {timeInfo.humanLabel}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 bg-slate-900/80 border border-slate-800 rounded-lg p-1.5 mt-1 leading-snug">
            {state.mapProvider.statusExplanation}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-full px-2.5 py-1 text-[10px] text-slate-400 shadow">
        <button
          type="button"
          onClick={() => setDiagOpen((prev) => !prev)}
          aria-label="Toggle map provider diagnostics"
          data-testid="toggle-provider-diagnostics"
          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"
        >
          <Info className="w-3 h-3" />
          <span>
            {state.mapProvider.activeStackId === 'photoreal'
              ? '3D Tiles'
              : state.mapProvider.activeStackId === 'esri-imagery'
              ? 'Satellite'
              : 'OSM'}
          </span>
        </button>
        <span>·</span>
        <span className="truncate max-w-[210px] sm:max-w-xs">
          {state.mapProvider.attributionText}
        </span>
      </div>
    </div>
  );
};
