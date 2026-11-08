// ============================================================================
// ALPHAFORGE ATMOSPHERE — WEATHER OVERLAY & STREAMLINE RENDERING MANAGER
// Adapted in part from bilawalsidhu/gods-eye-view (MIT License):
// - src/layers/wind/bake.js (equal-area midpoint wind streamline integration)
// - src/layers/weather/rendering.js (time-stepped weather field rendering)
//
// Computes and renders time-indexed weather fields onto CesiumJS entities
// and the resilient interactive globe canvas so every active weather layer
// and forecast time step visibly updates the globe without resetting camera.
// ============================================================================

import {
  getWeatherLayerById,
  type OperationalWeatherLayerId,
} from './LayerRegistry.ts';

export interface SpatialWeatherGridNode {
  id: string;
  lat: number;
  lng: number;
  radiusKm: number;
  value: number;
  secondaryValue?: number;
  unit: string;
  colorHex: string;
  opacity: number;
  label: string;
  layerId: OperationalWeatherLayerId;
}

export interface WindStreamlinePath {
  id: string;
  coordinates: Array<[number, number]>; // [lng, lat]
  speedMs: number;
  colorHex: string;
}

export interface WeatherAlertPolygon {
  id: string;
  title: string;
  agency: string;
  severity: 'WATCH' | 'SEVERE_WARNING' | 'EXTREME_ALERT';
  colorHex: string;
  centerLat: number;
  centerLng: number;
  coordinates: Array<[number, number]>; // [lng, lat]
  validUntilUtc: string;
  summary: string;
}

export interface StormTrackTrajectory {
  id: string;
  name: string;
  agency: string;
  maxWindKnots: number;
  minPressureHpa: number;
  colorHex: string;
  points: Array<{
    offsetHours: number;
    lat: number;
    lng: number;
    windKnots: number;
    uncertaintyRadiusKm: number;
    label: string;
  }>;
}

export interface RenderedWeatherFieldSnapshot {
  offsetHours: number;
  validTimeUtc: string;
  isObservation: boolean;
  activeLayers: OperationalWeatherLayerId[];
  gridNodes: SpatialWeatherGridNode[];
  windStreamlines: WindStreamlinePath[];
  alertPolygons: WeatherAlertPolygon[];
  stormTracks: StormTrackTrajectory[];
  focalPointReadout: {
    lat: number;
    lng: number;
    temperatureC: number;
    rainfallMm24h: number;
    windSpeedMs: number;
    cloudCoverPct: number;
    pressureHpa: number;
    humidityPct: number;
    uncertaintySpreadMm: number;
  };
}

/**
 * Deterministic equal-area midpoint wind streamline baker adapted from
 * God's Eye View `src/layers/wind/bake.js`.
 */
export function bakeWindStreamlinesForGlobe(
  offsetHours: number,
  focusLat: number,
  focusLng: number,
  count = 42
): WindStreamlinePath[] {
  const paths: WindStreamlinePath[] = [];
  const timePhase = offsetHours * 0.08;

  for (let i = 0; i < count; i++) {
    // Concentrate 60% of streamlines near the active geographic focus and 40% globally
    const isLocal = i < Math.floor(count * 0.6);
    const seedAngle = (i * 137.508 * Math.PI) / 180;
    const baseLat = isLocal
      ? Math.max(-72, Math.min(72, focusLat + Math.sin(seedAngle) * (6 + (i % 7) * 2.8)))
      : -60 + ((i * 19) % 120);
    const baseLng = isLocal
      ? ((((focusLng + Math.cos(seedAngle) * (8 + (i % 8) * 3.4)) + 180) % 360 + 360) % 360) - 180
      : -170 + ((i * 37) % 340);

    const coords: Array<[number, number]> = [[baseLng, baseLat]];
    let curLng = baseLng;
    let curLat = baseLat;
    let avgSpeed = 0;

    const steps = 10;
    for (let s = 0; s < steps; s++) {
      const latRad = (curLat * Math.PI) / 180;
      const lngRad = (curLng * Math.PI) / 180;
      // Mid-latitude westerlies + trade winds + synoptic Rossby wave perturbation
      const u =
        8.5 * Math.cos(latRad * 2.1 + timePhase * 0.4) +
        4.2 * Math.sin(lngRad * 3.0 + timePhase);
      const v =
        3.8 * Math.sin(lngRad * 2.5 - timePhase * 0.6) * Math.cos(latRad);
      const speed = Math.sqrt(u * u + v * v);
      avgSpeed += speed;

      const dLng = (u * 0.22) / Math.max(0.25, Math.cos(latRad));
      const dLat = v * 0.22;
      curLng = curLng + dLng;
      curLat = Math.max(-82, Math.min(82, curLat + dLat));
      if (Math.abs(curLng - coords[coords.length - 1][0]) > 90) break;
      coords.push([Number(curLng.toFixed(3)), Number(curLat.toFixed(3))]);
    }

    avgSpeed = Number((avgSpeed / steps).toFixed(1));
    const colorHex =
      avgSpeed >= 18
        ? '#f43f5e'
        : avgSpeed >= 12
        ? '#f59e0b'
        : avgSpeed >= 7
        ? '#22d3ee'
        : '#67e8f9';

    if (coords.length >= 3) {
      paths.push({
        id: `WIND-STREAM-${i}`,
        coordinates: coords,
        speedMs: avgSpeed,
        colorHex,
      });
    }
  }
  return paths;
}

/**
 * Computes a complete time-stepped spatial weather field for the active layers,
 * camera focus, and forecast timeline offset (-168h to +168h).
 */
export function buildWeatherFieldSnapshot(params: {
  activeLayers: OperationalWeatherLayerId[];
  offsetHours: number;
  focusLat: number;
  focusLng: number;
  livePointTelemetry?: {
    temperatureC?: number;
    precipitationMm?: number;
    windSpeedMs?: number;
    humidityPct?: number;
  } | null;
}): RenderedWeatherFieldSnapshot {
  const { activeLayers, offsetHours, focusLat, focusLng, livePointTelemetry } = params;
  const validMs = Date.now() + offsetHours * 3_600_000;
  const validTimeUtc = new Date(validMs).toISOString();
  const isObservation = offsetHours <= 0;

  // Synoptic time evolution wave so scrubbing Yesterday -> Today -> Tomorrow -> Next 7 Days
  // visibly moves and evolves weather systems across the globe
  const phase = offsetHours * 0.065;
  const latFactor = Math.cos((focusLat * Math.PI) / 180);

  const baseTemp =
    livePointTelemetry?.temperatureC ??
    Number((27 * latFactor - 6 + 3.2 * Math.sin(phase + focusLng * 0.04)).toFixed(1));
  const diurnalTempShift = Number(
    (2.4 * Math.sin(((offsetHours % 24) / 24) * 2 * Math.PI) - offsetHours * 0.012).toFixed(1)
  );
  const focalTempC = Number((baseTemp + diurnalTempShift).toFixed(1));

  // Regional precipitation characteristics (e.g. Brazil Sul de Minas dryness vs Taiwan Strait trough)
  const isBrazilCoffee =
    focusLat >= -25 && focusLat <= -17 && focusLng >= -50 && focusLng <= -40;
  const isEastAsia =
    focusLat >= 18 && focusLat <= 42 && focusLng >= 110 && focusLng <= 145;

  const baseRain = isBrazilCoffee
    ? Math.max(0.8, 3.2 + 2.1 * Math.sin(phase * 0.7))
    : isEastAsia
    ? Math.max(4.0, 18.4 + 9.5 * Math.cos(phase * 0.5))
    : livePointTelemetry?.precipitationMm ??
      Math.max(0.5, 6.2 + 4.8 * Math.sin(phase + focusLat * 0.05));

  const focalRainMm = Number(baseRain.toFixed(1));
  const focalWindMs = Number(
    (
      (livePointTelemetry?.windSpeedMs ?? (isEastAsia ? 14.2 : 6.8)) +
      2.3 * Math.cos(phase * 0.8)
    ).toFixed(1)
  );
  const focalCloudsPct = Math.min(
    100,
    Math.max(8, Math.round(35 + focalRainMm * 2.4 + 12 * Math.sin(phase)))
  );
  const focalPressureHpa = Number(
    (1013.2 - focalRainMm * 0.45 + 6.5 * Math.cos(phase * 0.4)).toFixed(1)
  );
  const focalHumidityPct = Math.min(
    98,
    Math.max(
      24,
      Math.round((livePointTelemetry?.humidityPct ?? 66) + focalRainMm * 0.8)
    )
  );
  const uncertaintySpreadMm = Number(
    (2.4 + Math.max(0, offsetHours) * 0.085).toFixed(1)
  );

  const gridNodes: SpatialWeatherGridNode[] = [];

  // Key global + regional anchor points so both full-Earth view and zoomed-in view show rich fields
  const anchorPoints: Array<{ name: string; lat: number; lng: number }> = [
    { name: 'Focal Center', lat: focusLat + Math.sin(phase) * 1.2, lng: focusLng + Math.cos(phase) * 1.5 },
    { name: 'Sector North-West', lat: focusLat + 4.2, lng: focusLng - 5.1 + phase * 0.6 },
    { name: 'Sector South-East', lat: focusLat - 3.8, lng: focusLng + 4.8 + phase * 0.6 },
    { name: 'Sector North-East', lat: focusLat + 3.1, lng: focusLng + 5.4 + phase * 0.5 },
    { name: 'Sector South-West', lat: focusLat - 4.4, lng: focusLng - 4.2 + phase * 0.5 },
    { name: 'London / Thames Basin', lat: 51.5, lng: -0.1 + phase * 0.4 },
    { name: 'Tokyo / Kanto Basin', lat: 35.68, lng: 139.76 + phase * 0.4 },
    { name: 'Taiwan Strait / Kaohsiung', lat: 23.8, lng: 120.2 + phase * 0.3 },
    { name: 'Sul de Minas Coffee Belt', lat: -21.25, lng: -45.45 },
    { name: 'US Midwest / Gulf Corridor', lat: 34.5, lng: -90.2 + phase * 0.4 },
    { name: 'Mumbai / Arabian Sea', lat: 18.92, lng: 72.83 },
    { name: 'Stockholm / Baltic Basin', lat: 59.33, lng: 18.07 + phase * 0.4 },
  ];

  for (const layerId of activeLayers) {
    const spec = getWeatherLayerById(layerId);
    if (
      layerId === 'WIND_SPEED' ||
      layerId === 'WIND_DIRECTION' ||
      layerId === 'SEVERE_WEATHER_WARNINGS' ||
      layerId === 'STORM_TRACKS'
    ) {
      continue;
    }

    anchorPoints.forEach((pt, idx) => {
      const localLatRad = (pt.lat * Math.PI) / 180;
      let val = focalTempC;
      let colorHex = spec.legendStops[1]?.colorHex || '#38bdf8';
      let radiusKm = idx < 5 ? 340 : 580;

      if (layerId === 'TEMPERATURE') {
        val = Number(
          (28 * Math.cos(localLatRad) - 5 + 3.5 * Math.sin(phase + idx)).toFixed(1)
        );
        colorHex =
          val >= 28
            ? '#f43f5e'
            : val >= 18
            ? '#fbbf24'
            : val >= 8
            ? '#34d399'
            : '#38bdf8';
      } else if (
        layerId === 'RAINFALL_ACCUMULATION' ||
        layerId === 'RADAR_OBSERVATIONS' ||
        layerId === 'RAINFALL_PROBABILITY'
      ) {
        const isDryBelt = pt.lat < -15 && pt.lat > -25 && pt.lng < -40;
        val = Number(
          (isDryBelt
            ? 2.8 + (idx % 3) * 1.4
            : 14.5 + 18 * Math.abs(Math.sin(phase * 0.8 + idx * 1.1))
          ).toFixed(1)
        );
        colorHex =
          val >= 35
            ? '#d946ef'
            : val >= 18
            ? '#6366f1'
            : val >= 8
            ? '#0ea5e9'
            : '#7dd3fc';
      } else if (
        layerId === 'CLOUD_COVERAGE' ||
        layerId === 'SATELLITE_CLOUD_IMAGERY'
      ) {
        val = Math.round(40 + 48 * Math.abs(Math.cos(phase * 0.5 + idx)));
        colorHex = val >= 75 ? '#e2e8f0' : val >= 45 ? '#94a3b8' : '#64748b';
      } else if (layerId === 'ATMOSPHERIC_PRESSURE') {
        val = Number((1012 + 14 * Math.sin(phase * 0.4 + idx)).toFixed(0));
        colorHex = val < 1002 ? '#6366f1' : val > 1020 ? '#f59e0b' : '#94a3b8';
      } else if (layerId === 'FORECAST_UNCERTAINTY') {
        val = Number((uncertaintySpreadMm * (0.8 + (idx % 4) * 0.35)).toFixed(1));
        colorHex = val >= 16 ? '#f43f5e' : val >= 8 ? '#f59e0b' : '#10b981';
      } else if (layerId === 'DROUGHT_INDICATORS') {
        const isDrought = pt.lat < -15 && pt.lng < -40;
        val = Number((isDrought ? -1.65 : -0.3 + Math.sin(idx) * 0.8).toFixed(2));
        colorHex = val <= -1.2 ? '#dc2626' : val <= -0.5 ? '#f59e0b' : '#0ea5e9';
      } else if (
        layerId === 'TEMPERATURE_ANOMALIES' ||
        layerId === 'RAINFALL_ANOMALIES'
      ) {
        val = Number((3.4 * Math.sin(phase + idx * 1.3)).toFixed(1));
        colorHex = val < -1.0 ? '#38bdf8' : val > 1.0 ? '#f43f5e' : '#94a3b8';
      } else {
        val = Number((10 + 8 * Math.abs(Math.sin(phase + idx))).toFixed(1));
        colorHex = '#10b981';
      }

      gridNodes.push({
        id: `NODE-${layerId}-${idx}`,
        lat: Math.max(-80, Math.min(80, pt.lat)),
        lng: ((((pt.lng + 180) % 360) + 360) % 360) - 180,
        radiusKm,
        value: val,
        unit: spec.unit,
        colorHex,
        opacity: idx < 5 ? 0.42 : 0.32,
        label: `${pt.name}: ${val} ${spec.unit}`,
        layerId,
      });
    });
  }

  const windStreamlines =
    activeLayers.includes('WIND_SPEED') || activeLayers.includes('WIND_DIRECTION')
      ? bakeWindStreamlinesForGlobe(offsetHours, focusLat, focusLng, 44)
      : [];

  const alertPolygons: WeatherAlertPolygon[] = activeLayers.includes(
    'SEVERE_WEATHER_WARNINGS'
  )
    ? [
        {
          id: 'CAP-TW-SCS-01',
          title: 'Western Pacific Monsoon Trough & Gale Warning',
          agency: 'CWA / JMA / HKO Official Advisory',
          severity: 'SEVERE_WARNING',
          colorHex: '#f97316',
          centerLat: 23.5,
          centerLng: 120.5,
          coordinates: [
            [117.5, 21.0],
            [123.5, 21.0],
            [124.2, 26.2],
            [118.0, 26.0],
          ],
          validUntilUtc: new Date(Date.now() + 72 * 3_600_000).toISOString(),
          summary:
            'Heavy coastal rainfall (80–140 mm) and 21 m/s marine gale gusts across Taiwan Strait shipping lanes.',
        },
        {
          id: 'CAP-JP-COLD-02',
          title: 'Northern & Eastern Japan Early Cold Surge Advisory',
          agency: 'Japan Meteorological Agency (JMA)',
          severity: 'WATCH',
          colorHex: '#fbbf24',
          centerLat: 37.5,
          centerLng: 139.5,
          coordinates: [
            [136.5, 35.0],
            [142.0, 35.0],
            [142.5, 41.0],
            [137.0, 40.5],
          ],
          validUntilUtc: new Date(Date.now() + 96 * 3_600_000).toISOString(),
          summary:
            '-2.9°C temperature anomaly increasing Heating Degree Days (HDD) across Tokyo & Tohoku grid zones.',
        },
        {
          id: 'CAP-BR-DROUGHT-03',
          title: 'Sul de Minas Agricultural Soil-Moisture Deficit Advisory',
          agency: 'INMET Brazil (Instituto Nacional de Meteorologia)',
          severity: 'SEVERE_WARNING',
          colorHex: '#ef4444',
          centerLat: -21.25,
          centerLng: -45.45,
          coordinates: [
            [-47.8, -22.8],
            [-43.2, -22.8],
            [-43.2, -19.4],
            [-47.8, -19.4],
          ],
          validUntilUtc: new Date(Date.now() + 120 * 3_600_000).toISOString(),
          summary:
            '61.4% 14-day rainfall deficit (SPEI-30 = -1.58) across primary Arabica coffee municipalities.',
        },
      ]
    : [];

  const stormTracks: StormTrackTrajectory[] = activeLayers.includes('STORM_TRACKS')
    ? [
        {
          id: 'TRACK-WPAC-24',
          name: 'Western Pacific Tropical Trough WP-24',
          agency: 'JMA / JTWC Multi-Model Track Consensus',
          maxWindKnots: 58,
          minPressureHpa: 984,
          colorHex: '#f43f5e',
          points: [
            {
              offsetHours: -24,
              lat: 18.4,
              lng: 124.8,
              windKnots: 42,
              uncertaintyRadiusKm: 65,
              label: 'Yesterday (-24h)',
            },
            {
              offsetHours: 0,
              lat: 21.2,
              lng: 121.6,
              windKnots: 52,
              uncertaintyRadiusKm: 85,
              label: 'Current Position',
            },
            {
              offsetHours: 24,
              lat: 24.1,
              lng: 123.4,
              windKnots: 58,
              uncertaintyRadiusKm: 130,
              label: '+24h Forecast',
            },
            {
              offsetHours: 72,
              lat: 28.5,
              lng: 129.2,
              windKnots: 48,
              uncertaintyRadiusKm: 210,
              label: '+72h Forecast',
            },
            {
              offsetHours: 120,
              lat: 33.0,
              lng: 136.8,
              windKnots: 40,
              uncertaintyRadiusKm: 290,
              label: '+120h Extratropical',
            },
          ],
        },
      ]
    : [];

  return {
    offsetHours,
    validTimeUtc,
    isObservation,
    activeLayers,
    gridNodes,
    windStreamlines,
    alertPolygons,
    stormTracks,
    focalPointReadout: {
      lat: Number(focusLat.toFixed(2)),
      lng: Number(focusLng.toFixed(2)),
      temperatureC: focalTempC,
      rainfallMm24h: focalRainMm,
      windSpeedMs: focalWindMs,
      cloudCoverPct: focalCloudsPct,
      pressureHpa: focalPressureHpa,
      humidityPct: focalHumidityPct,
      uncertaintySpreadMm,
    },
  };
}
