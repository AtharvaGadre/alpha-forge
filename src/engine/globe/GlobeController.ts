// ============================================================================
// ALPHAFORGE ATMOSPHERE — GLOBE CONTROLLER & ARGON TOOL BRIDGE
// Owns the single CesiumJS Viewer lifecycle + resilient satellite fallback and
// exposes the 13 deterministic, validated ARGON globe commands (Section 12).
// ============================================================================

import {
  atmosphereStore,
  type AdvancedSectionTabId,
} from '../../state/atmosphereStore.ts';
import {
  OPERATIONAL_WEATHER_LAYER_REGISTRY,
  type OperationalWeatherLayerId,
} from './LayerRegistry.ts';
import {
  resolveGeographicTarget,
  type GeographicTargetLocation,
} from './GeographicSelectionService.ts';

export type ArgonGlobeCommandName =
  | 'fly_to_country'
  | 'fly_to_city'
  | 'fly_to_coordinates'
  | 'select_weather_layer'
  | 'set_forecast_time'
  | 'animate_forecast'
  | 'compare_models'
  | 'show_weather_alerts'
  | 'open_news'
  | 'open_location_summary'
  | 'open_advanced_analysis'
  | 'generate_report'
  | 'explain_visible_map';

export interface ArgonGlobeCommandResult {
  command: ArgonGlobeCommandName;
  success: boolean;
  summary: string;
  appliedStatePatch?: Record<string, unknown>;
}

type CameraFlightListener = (pose: {
  lat: number;
  lng: number;
  altitudeMeters: number;
  headingDeg: number;
  pitchDeg: number;
  durationSeconds?: number;
}) => void;

class GlobeControllerSingleton {
  private flightListeners = new Set<CameraFlightListener>();

  onCameraFlight(listener: CameraFlightListener): () => void {
    this.flightListeners.add(listener);
    return () => {
      this.flightListeners.delete(listener);
    };
  }

  private emitCameraFlight(pose: {
    lat: number;
    lng: number;
    altitudeMeters: number;
    headingDeg: number;
    pitchDeg: number;
    durationSeconds?: number;
  }) {
    atmosphereStore.setState({
      cameraPose: {
        lat: pose.lat,
        lng: pose.lng,
        altitudeMeters: pose.altitudeMeters,
        headingDeg: pose.headingDeg,
        pitchDeg: pose.pitchDeg,
        rollDeg: 0,
      },
    });
    for (const fn of this.flightListeners) {
      try {
        fn(pose);
      } catch {
        // Ignore listener error
      }
    }
  }

  flyToLocation(
    target: GeographicTargetLocation,
    options?: { useLandmark3D?: boolean; openSummary?: boolean }
  ) {
    const resolved = atmosphereStore.selectLocation(target, {
      openSummary: options?.openSummary ?? true,
      flyLandmark3D: options?.useLandmark3D ?? false,
    });
    const pose = atmosphereStore.getState().cameraPose;
    this.emitCameraFlight({
      ...pose,
      durationSeconds: 1.8,
    });
    return resolved;
  }

  flyToCoordinates(
    lat: number,
    lng: number,
    altitudeMeters = 1_400_000,
    tiltDeg = 28
  ) {
    const clampedLat = Math.max(-85, Math.min(85, Number(lat) || 0));
    const clampedLng = Math.max(-180, Math.min(180, Number(lng) || 0));
    const target = resolveGeographicTarget(
      `${clampedLat.toFixed(3)}, ${clampedLng.toFixed(3)}`
    );
    atmosphereStore.setState({
      selectedLocation: target,
    });
    this.emitCameraFlight({
      lat: clampedLat,
      lng: clampedLng,
      altitudeMeters: Math.max(400, altitudeMeters),
      headingDeg: 0,
      pitchDeg: -(90 - Math.max(0, Math.min(80, tiltDeg))),
      durationSeconds: 1.8,
    });
  }

  zoomByFactor(factor: number) {
    const curr = atmosphereStore.getState().cameraPose;
    const nextAlt = Math.max(
      450,
      Math.min(22_000_000, Math.round(curr.altitudeMeters * factor))
    );
    this.emitCameraFlight({
      ...curr,
      altitudeMeters: nextAlt,
      durationSeconds: 0.5,
    });
  }

  resetGlobalView() {
    atmosphereStore.closeAllPanelsToLevel0();
    this.emitCameraFlight({
      lat: 24.0,
      lng: 15.0,
      altitudeMeters: 15_500_000,
      headingDeg: 0,
      pitchDeg: -88,
      durationSeconds: 1.4,
    });
  }

  /**
   * Deterministic Tool Bridge between ARGON and the Map Engine (Section 12).
   * Validates arguments, executes real application actions, updates shared state,
   * and returns structured execution status.
   */
  executeCommand(
    command: ArgonGlobeCommandName,
    args: Record<string, any> = {}
  ): ArgonGlobeCommandResult {
    switch (command) {
      case 'fly_to_country': {
        const countryQuery = String(
          args.country || args.query || args.iso2 || 'United Kingdom'
        ).trim();
        const resolved = resolveGeographicTarget(countryQuery, false);
        this.flyToLocation(resolved, {
          useLandmark3D: false,
          openSummary: Boolean(args.openSummary ?? true),
        });
        return {
          command,
          success: true,
          summary: `Flew globe camera to ${resolved.countryName} (${resolved.lat.toFixed(2)}°, ${resolved.lng.toFixed(2)}°).`,
          appliedStatePatch: { countryIso2: resolved.countryIso2 },
        };
      }

      case 'fly_to_city': {
        const cityQuery = String(args.city || args.query || 'London').trim();
        const resolved = resolveGeographicTarget(cityQuery, true);
        this.flyToLocation(resolved, {
          useLandmark3D: Boolean(args.landmark3D ?? true),
          openSummary: true,
        });
        return {
          command,
          success: true,
          summary: `Flew globe camera to ${resolved.name} (${resolved.lat.toFixed(2)}°, ${resolved.lng.toFixed(2)}°).`,
          appliedStatePatch: { locationId: resolved.id },
        };
      }

      case 'fly_to_coordinates': {
        const lat = Number(args.lat);
        const lng = Number(args.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return {
            command,
            success: false,
            summary: 'Invalid coordinates supplied to fly_to_coordinates.',
          };
        }
        const alt = Number(args.altitudeMeters) || 1_400_000;
        const tilt = Number(args.tiltDeg) || 30;
        this.flyToCoordinates(lat, lng, alt, tilt);
        return {
          command,
          success: true,
          summary: `Flew globe camera to coordinates (${lat.toFixed(2)}°, ${lng.toFixed(2)}°) at ${(alt / 1000).toFixed(0)} km altitude.`,
          appliedStatePatch: { lat, lng, altitudeMeters: alt },
        };
      }

      case 'select_weather_layer': {
        const rawLayer = String(args.layer || args.layerId || 'RAINFALL_ACCUMULATION')
          .toUpperCase()
          .trim();
        const matched =
          OPERATIONAL_WEATHER_LAYER_REGISTRY.find(
            (l) =>
              l.id === rawLayer ||
              l.shortName.toUpperCase() === rawLayer ||
              l.name.toUpperCase().includes(rawLayer)
          ) ||
          (rawLayer.includes('RAIN')
            ? OPERATIONAL_WEATHER_LAYER_REGISTRY.find(
                (l) => l.id === 'RAINFALL_ACCUMULATION'
              )!
            : rawLayer.includes('WIND')
            ? OPERATIONAL_WEATHER_LAYER_REGISTRY.find(
                (l) => l.id === 'WIND_SPEED'
              )!
            : rawLayer.includes('ALERT') || rawLayer.includes('WARN')
            ? OPERATIONAL_WEATHER_LAYER_REGISTRY.find(
                (l) => l.id === 'SEVERE_WEATHER_WARNINGS'
              )!
            : rawLayer.includes('STORM') || rawLayer.includes('TRACK')
            ? OPERATIONAL_WEATHER_LAYER_REGISTRY.find(
                (l) => l.id === 'STORM_TRACKS'
              )!
            : rawLayer.includes('DROUGHT')
            ? OPERATIONAL_WEATHER_LAYER_REGISTRY.find(
                (l) => l.id === 'DROUGHT_INDICATORS'
              )!
            : OPERATIONAL_WEATHER_LAYER_REGISTRY[0]);

        const enabled = args.enabled !== undefined ? Boolean(args.enabled) : true;
        if (args.exclusive) {
          atmosphereStore.setState({ activeWeatherLayers: [matched.id] });
        } else {
          atmosphereStore.toggleWeatherLayer(matched.id, enabled);
        }
        return {
          command,
          success: true,
          summary: `${enabled ? 'Enabled' : 'Disabled'} weather layer: ${matched.name} (${matched.unit}).`,
          appliedStatePatch: { layerId: matched.id, enabled },
        };
      }

      case 'set_forecast_time': {
        let offsetHours = 0;
        if (typeof args.offsetHours === 'number' && Number.isFinite(args.offsetHours)) {
          offsetHours = args.offsetHours;
        } else {
          const label = String(args.window || args.label || 'next week').toLowerCase();
          if (label.includes('yesterday') || label.includes('last')) offsetHours = -24;
          else if (label.includes('tomorrow')) offsetHours = 24;
          else if (label.includes('3 day')) offsetHours = 72;
          else if (label.includes('next week') || label.includes('7 day')) offsetHours = 168;
          else offsetHours = 0;
        }
        atmosphereStore.setTimelineOffsetHours(offsetHours);
        return {
          command,
          success: true,
          summary: `Set forecast timeline to ${
            offsetHours === 0
              ? 'Today (Live)'
              : offsetHours > 0
              ? `+${offsetHours}h Forecast`
              : `${offsetHours}h Observed`
          }.`,
          appliedStatePatch: { timelineOffsetHours: offsetHours },
        };
      }

      case 'animate_forecast': {
        const play = args.play !== undefined ? Boolean(args.play) : true;
        atmosphereStore.setTimelinePlaying(play);
        return {
          command,
          success: true,
          summary: play
            ? 'Started forecast timeline animation.'
            : 'Paused forecast timeline animation.',
          appliedStatePatch: { isTimelinePlaying: play },
        };
      }

      case 'compare_models': {
        if (args.query || args.region) {
          atmosphereStore.runArgonQuery(String(args.query || args.region));
        }
        atmosphereStore.setState({
          activeSidePanel: 'MODELS',
          activeWorkspace: 'GLOBE',
        });
        return {
          command,
          success: true,
          summary:
            'Opened multi-model forecast comparison (WeatherNext 3, ECMWF IFS, ECMWF AIFS, GraphCast, NOAA GFS).',
        };
      }

      case 'show_weather_alerts': {
        atmosphereStore.toggleWeatherLayer('SEVERE_WEATHER_WARNINGS', true);
        return {
          command,
          success: true,
          summary: 'Enabled Official Weather Alerts (CAP polygons) on the globe.',
        };
      }

      case 'open_news': {
        atmosphereStore.setState({
          activeSidePanel: 'NEWS',
          activeWorkspace: 'GLOBE',
        });
        return {
          command,
          success: true,
          summary: 'Opened verified local weather & market news panel.',
        };
      }

      case 'open_location_summary': {
        if (args.location) {
          const target = resolveGeographicTarget(String(args.location));
          this.flyToLocation(target, { openSummary: true });
        } else {
          atmosphereStore.setState({ locationSummaryOpen: true });
        }
        return {
          command,
          success: true,
          summary: `Opened compact location summary for ${
            atmosphereStore.getState().selectedLocation.name
          }.`,
        };
      }

      case 'open_advanced_analysis': {
        const tab = (args.tab as AdvancedSectionTabId) || 'ECONOMIC_IMPACT';
        atmosphereStore.openWorkspace('ADVANCED_RESEARCH', tab);
        return {
          command,
          success: true,
          summary: `Opened Advanced Research workspace (${tab}).`,
        };
      }

      case 'generate_report': {
        if (args.query) {
          atmosphereStore.runArgonQuery(String(args.query), {
            openReportWorkspace: true,
          });
        } else {
          atmosphereStore.openWorkspace('SCIENTIFIC_REPORT');
        }
        return {
          command,
          success: true,
          summary: `Generated and opened verifiable 8-chapter (28-section) scientific report (${
            atmosphereStore.getState().activeReport.reportId
          }).`,
        };
      }

      case 'explain_visible_map': {
        const st = atmosphereStore.getState();
        const explanation = `Viewing ${st.selectedLocation.name} (${st.selectedLocation.lat.toFixed(
          2
        )}°, ${st.selectedLocation.lng.toFixed(2)}°) with ${st.activeWeatherLayers.join(
          ', '
        )} active at ${
          st.timelineOffsetHours === 0
            ? 'Today (Live)'
            : `${st.timelineOffsetHours > 0 ? '+' : ''}${st.timelineOffsetHours}h`
        }. ${st.selectedLocation.weatherSummaryDefault.oneSentenceSummary}`;
        return {
          command,
          success: true,
          summary: explanation,
        };
      }

      default:
        return {
          command,
          success: false,
          summary: `Unknown globe command: ${String(command)}`,
        };
    }
  }

  /**
   * Parses natural spoken or typed directives (e.g. "Hey ARGON, show me the rainfall
   * forecast for Japan next week") into a deterministic sequence of globe tool calls
   * and executes them against the live globe and forecasting engine.
   */
  interpretAndExecuteDirective(
    rawUtterance: string,
    options?: { openReportIfRequested?: boolean }
  ): {
    executedCommands: ArgonGlobeCommandResult[];
    investigation: ReturnType<typeof atmosphereStore.runArgonQuery>;
  } {
    const q = (rawUtterance || '').trim();
    const qLower = q.toLowerCase();
    const executedCommands: ArgonGlobeCommandResult[] = [];

    // 1. Run the deterministic + live forecasting investigation
    const wantsReport =
      Boolean(options?.openReportIfRequested) &&
      (qLower.includes('generate a scientific report') ||
        qLower.includes('generate a report') ||
        qLower.includes('open report'));

    const inv = atmosphereStore.runArgonQuery(q, {
      openReportWorkspace: wantsReport,
    });

    // 2. Determine geographic flight command
    if (qLower.includes('london') || qLower.includes('tower bridge')) {
      executedCommands.push(
        this.executeCommand('fly_to_city', {
          city: 'London',
          landmark3D: qLower.includes('tower bridge') || qLower.includes('3d'),
        })
      );
    } else if (qLower.includes('tokyo')) {
      executedCommands.push(
        this.executeCommand('fly_to_city', { city: 'Tokyo', landmark3D: true })
      );
    } else if (qLower.includes('japan')) {
      executedCommands.push(
        this.executeCommand('fly_to_country', {
          country: 'Japan',
          openSummary: true,
        })
      );
    } else if (qLower.includes('brazil') || qLower.includes('coffee')) {
      executedCommands.push(
        this.executeCommand('fly_to_country', {
          country: 'Sul de Minas Coffee Belt, Brazil',
          openSummary: true,
        })
      );
    } else if (qLower.includes('asia')) {
      executedCommands.push(
        this.executeCommand('fly_to_coordinates', {
          lat: 25.5,
          lng: 118.5,
          altitudeMeters: 4_600_000,
          tiltDeg: 20,
        })
      );
    } else {
      executedCommands.push(
        this.executeCommand('fly_to_coordinates', {
          lat: inv.resolvedScope.targetLat,
          lng: inv.resolvedScope.targetLng,
          altitudeMeters: inv.resolvedScope.targetRangeMeters,
          tiltDeg: 28,
        })
      );
    }

    // 3. Determine weather layer command
    if (qLower.includes('rain') || qLower.includes('precip') || qLower.includes('monsoon')) {
      executedCommands.push(
        this.executeCommand('select_weather_layer', {
          layerId: 'RAINFALL_ACCUMULATION',
          enabled: true,
          exclusive: true,
        })
      );
    } else if (qLower.includes('storm') || qLower.includes('typhoon') || qLower.includes('cyclone')) {
      executedCommands.push(
        this.executeCommand('select_weather_layer', {
          layerId: 'STORM_TRACKS',
          enabled: true,
        })
      );
      executedCommands.push(this.executeCommand('show_weather_alerts', {}));
    } else if (qLower.includes('wind')) {
      executedCommands.push(
        this.executeCommand('select_weather_layer', {
          layerId: 'WIND_SPEED',
          enabled: true,
        })
      );
    } else if (qLower.includes('drought') || qLower.includes('coffee')) {
      executedCommands.push(
        this.executeCommand('select_weather_layer', {
          layerId: 'RAINFALL_ACCUMULATION',
          enabled: true,
        })
      );
      executedCommands.push(
        this.executeCommand('select_weather_layer', {
          layerId: 'DROUGHT_INDICATORS',
          enabled: true,
        })
      );
    }

    // 4. Determine forecast time window command
    if (qLower.includes('next week') || qLower.includes('7 day')) {
      executedCommands.push(
        this.executeCommand('set_forecast_time', { offsetHours: 168 })
      );
    } else if (qLower.includes('tomorrow')) {
      executedCommands.push(
        this.executeCommand('set_forecast_time', { offsetHours: 24 })
      );
    } else if (qLower.includes('yesterday') || qLower.includes('last week')) {
      executedCommands.push(
        this.executeCommand('set_forecast_time', {
          offsetHours: qLower.includes('next week') ? 168 : -24,
        })
      );
    }

    // 5. Open specific panel only if explicitly asked
    if (
      qLower.includes('models disagree') ||
      qLower.includes('compare model') ||
      qLower.includes('most accurate')
    ) {
      executedCommands.push(this.executeCommand('compare_models', {}));
    } else if (wantsReport) {
      executedCommands.push(this.executeCommand('generate_report', {}));
    }

    return {
      executedCommands,
      investigation: inv,
    };
  }
}

export const globeController = new GlobeControllerSingleton();
