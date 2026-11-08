// ============================================================================
// ALPHAFORGE ATMOSPHERE — COMPACT FORECAST TIMELINE CONTROL
// Simple, Human-Friendly Time Scrubbing: Yesterday | Today | Tomorrow | Next 7 Days
// ============================================================================

import React, { useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { atmosphereStore, useAtmosphereStore } from '../../state/atmosphereStore';
import {
  TIMELINE_PRESET_STEPS,
  formatOffsetHoursToHumanLabel,
} from '../../engine/globe/ForecastAnimationController';
import { getWeatherLayerById } from '../../engine/globe/LayerRegistry';
import { argonAudioManager } from '../../engine/argonAudioManager';

export const ForecastTimeline: React.FC = () => {
  const state = useAtmosphereStore();
  const formattedTime = formatOffsetHoursToHumanLabel(state.timelineOffsetHours);
  const primaryLayerId = state.activeWeatherLayers[0] || 'TEMPERATURE';
  const activeLayer = getWeatherLayerById(primaryLayerId);

  useEffect(() => {
    if (!state.isTimelinePlaying) return;
    const timer = window.setInterval(() => {
      const curOffset = atmosphereStore.getState().timelineOffsetHours;
      const nextOffset = curOffset >= 168 ? -24 : curOffset + 6;
      atmosphereStore.setTimelineOffsetHours(nextOffset);
    }, 950);
    return () => window.clearInterval(timer);
  }, [state.isTimelinePlaying]);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 w-[92vw] max-w-xl pointer-events-auto"
      data-testid="forecast-timeline-bar"
    >
      {/* Active Weather Layer Compact Legend Strip */}
      <div className="flex items-center gap-2.5 bg-slate-950/75 backdrop-blur-md border border-slate-800/80 rounded-full px-3 py-1 text-[11px] text-slate-300 shadow">
        <span className="font-medium text-sky-300">{activeLayer.shortName}</span>
        <span className="text-slate-500">·</span>
        <div className="flex items-center gap-1.5">
          {activeLayer.legendStops.slice(0, 4).map((stop) => (
            <span
              key={stop.label}
              className="inline-flex items-center gap-1 text-[10px] text-slate-300"
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: stop.colorHex }}
              />
              <span className="hidden sm:inline">{stop.label}</span>
            </span>
          ))}
        </div>
        <span className="text-slate-500">·</span>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            state.timelineOffsetHours <= 0
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-sky-500/20 text-sky-300'
          }`}
        >
          {formattedTime.regimeBadge}
        </span>
      </div>

      {/* Main Timeline Bar */}
      <div className="w-full flex items-center justify-between gap-1.5 bg-slate-950/85 backdrop-blur-xl border border-slate-800/90 rounded-2xl px-2.5 py-1.5 shadow-2xl">
        <button
          type="button"
          onClick={() => {
            const nextPlaying = !state.isTimelinePlaying;
            atmosphereStore.setTimelinePlaying(nextPlaying);
            argonAudioManager.triggerSound('FORECAST_UPDATED');
          }}
          aria-label={
            state.isTimelinePlaying
              ? 'Pause forecast animation'
              : 'Play forecast animation'
          }
          data-testid="timeline-play-toggle"
          className="flex items-center justify-center w-8 h-8 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 transition-colors shrink-0"
        >
          {state.isTimelinePlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>

        <div className="flex items-center justify-between flex-1 gap-1 overflow-x-auto no-scrollbar">
          {TIMELINE_PRESET_STEPS.map((step) => {
            const isSelected = state.timelineOffsetHours === step.offsetHours;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  atmosphereStore.setTimelinePlaying(false);
                  atmosphereStore.setTimelineOffsetHours(step.offsetHours);
                  argonAudioManager.triggerSound(
                    'FORECAST_UPDATED',
                    `Forecast time: ${step.label}`
                  );
                }}
                data-testid={`timeline-step-${step.id.toLowerCase()}`}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-sky-500 text-slate-950 shadow-sm font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                {step.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
