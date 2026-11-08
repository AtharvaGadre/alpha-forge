// ============================================================================
// ALPHAFORGE ATMOSPHERE — OPERATIONAL WEATHER LAYER REGISTRY
// Audits all 17 weather layers for real provider availability, geographic
// alignment, rendering implementation, colour scale, units, and categories.
// ============================================================================

export type OperationalLayerCategory =
  | 'Weather'
  | 'Storms'
  | 'Satellite'
  | 'Forecasts'
  | 'Advanced';

export type OperationalLayerPriority = 'P0' | 'P1' | 'P2';

export type OperationalWeatherLayerId =
  | 'TEMPERATURE'
  | 'RAINFALL_ACCUMULATION'
  | 'RAINFALL_PROBABILITY'
  | 'WIND_SPEED'
  | 'WIND_DIRECTION'
  | 'CLOUD_COVERAGE'
  | 'SEVERE_WEATHER_WARNINGS'
  | 'ATMOSPHERIC_PRESSURE'
  | 'HUMIDITY'
  | 'RADAR_OBSERVATIONS'
  | 'STORM_TRACKS'
  | 'FORECAST_UNCERTAINTY'
  | 'SATELLITE_CLOUD_IMAGERY'
  | 'DROUGHT_INDICATORS'
  | 'TEMPERATURE_ANOMALIES'
  | 'RAINFALL_ANOMALIES'
  | 'RENEWABLE_ENERGY_VARIABLES';

export interface OperationalWeatherLayerAudit {
  id: OperationalWeatherLayerId;
  name: string;
  shortName: string;
  category: OperationalLayerCategory;
  priority: OperationalLayerPriority;
  unit: string;
  providerName: string;
  modelSource: string;
  operationalStatus: 'OPERATIONAL' | 'REGIONAL_COVERAGE' | 'UNAVAILABLE';
  supportsTimeAnimation: boolean;
  renderMethod:
    | 'HEATMAP_GRID'
    | 'PRECIPITATION_FIELD'
    | 'WIND_STREAMLINES'
    | 'CLOUD_CANOPY'
    | 'CAP_ALERT_POLYGONS'
    | 'ISOBAR_CONTOURS'
    | 'STORM_TRACK_VECTORS'
    | 'UNCERTAINTY_ENVELOPE'
    | 'ANOMALY_DIVERGING';
  legendStops: Array<{ label: string; value: number; colorHex: string }>;
  descriptionPlain: string;
  coverageNote: string;
}

export const OPERATIONAL_WEATHER_LAYER_REGISTRY: OperationalWeatherLayerAudit[] = [
  // ==========================================================================
  // P0 — CORE WEATHER & ALERTS (Weather / Storms)
  // ==========================================================================
  {
    id: 'TEMPERATURE',
    name: 'Temperature (2m Air)',
    shortName: 'Temperature',
    category: 'Weather',
    priority: 'P0',
    unit: '°C',
    providerName: 'Open-Meteo / ECMWF IFS / WeatherNext 3',
    modelSource: 'Calibrated Multi-Model 2m Temperature Field',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'HEATMAP_GRID',
    legendStops: [
      { label: '-15°C', value: -15, colorHex: '#38bdf8' },
      { label: '0°C', value: 0, colorHex: '#2dd4bf' },
      { label: '15°C', value: 15, colorHex: '#34d399' },
      { label: '25°C', value: 25, colorHex: '#fbbf24' },
      { label: '38°C', value: 38, colorHex: '#f43f5e' },
    ],
    descriptionPlain: 'Surface air temperature 2 meters above ground in degrees Celsius.',
    coverageNote: 'Global 0.25° gridded coverage (-168h observations to +168h forecast).',
  },
  {
    id: 'RAINFALL_ACCUMULATION',
    name: 'Rainfall & Precipitation',
    shortName: 'Rainfall',
    category: 'Weather',
    priority: 'P0',
    unit: 'mm / 24h',
    providerName: 'WeatherNext 3 / ECMWF IFS / NOAA GFS',
    modelSource: 'Constrained Multi-Model Ensemble Precipitation (ŷ = Σ wᵢ ŷᵢ)',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'PRECIPITATION_FIELD',
    legendStops: [
      { label: '2 mm', value: 2, colorHex: '#7dd3fc' },
      { label: '12 mm', value: 12, colorHex: '#0ea5e9' },
      { label: '35 mm', value: 35, colorHex: '#6366f1' },
      { label: '80+ mm', value: 80, colorHex: '#d946ef' },
    ],
    descriptionPlain: 'Accumulated 24-hour liquid precipitation in millimeters.',
    coverageNote: 'Global coverage with station-calibrated EMOS bias correction.',
  },
  {
    id: 'WIND_SPEED',
    name: 'Wind Speed & Streamlines (10m)',
    shortName: 'Wind',
    category: 'Weather',
    priority: 'P0',
    unit: 'm/s',
    providerName: 'ECMWF IFS / NOAA GFS / WeatherNext 3',
    modelSource: '10m Zonal (u) & Meridional (v) Vector Streamlines',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'WIND_STREAMLINES',
    legendStops: [
      { label: '4 m/s', value: 4, colorHex: '#67e8f9' },
      { label: '10 m/s', value: 10, colorHex: '#22d3ee' },
      { label: '18 m/s', value: 18, colorHex: '#f59e0b' },
      { label: '28+ m/s', value: 28, colorHex: '#f43f5e' },
    ],
    descriptionPlain: 'Animated equal-area wind streamlines and 10m wind speed magnitude.',
    coverageNote: 'Global streamline bake adapted from God’s Eye View midpoint integrator.',
  },
  {
    id: 'CLOUD_COVERAGE',
    name: 'Cloud Cover',
    shortName: 'Clouds',
    category: 'Weather',
    priority: 'P0',
    unit: '%',
    providerName: 'Open-Meteo / EUMETSAT / GOES / Himawari-9',
    modelSource: 'Total Atmospheric Cloud Fraction',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'CLOUD_CANOPY',
    legendStops: [
      { label: '15%', value: 15, colorHex: '#64748b' },
      { label: '50%', value: 50, colorHex: '#94a3b8' },
      { label: '85%', value: 85, colorHex: '#e2e8f0' },
      { label: '100%', value: 100, colorHex: '#ffffff' },
    ],
    descriptionPlain: 'Total column cloud fraction percentage across low, mid, and high levels.',
    coverageNote: 'Global geostationary and NWP cloud cover synthesis.',
  },
  {
    id: 'SEVERE_WEATHER_WARNINGS',
    name: 'Official Weather Alerts',
    shortName: 'Alerts',
    category: 'Storms',
    priority: 'P0',
    unit: 'CAP Severity',
    providerName: 'WMO / JMA / Met Office / NOAA NWS / INMET / SMHI',
    modelSource: 'Verified National Met Agency Advisories',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: false,
    renderMethod: 'CAP_ALERT_POLYGONS',
    legendStops: [
      { label: 'Watch / Advisory', value: 1, colorHex: '#fbbf24' },
      { label: 'Severe Warning', value: 2, colorHex: '#f97316' },
      { label: 'Extreme Alert', value: 3, colorHex: '#ef4444' },
    ],
    descriptionPlain: 'Official meteorological agency warnings and active hazard zones.',
    coverageNote: 'Separates verified government CAP alerts from model predictions.',
  },

  // ==========================================================================
  // P1 — STORMS, SATELLITE & FORECAST DIAGNOSTICS
  // ==========================================================================
  {
    id: 'RADAR_OBSERVATIONS',
    name: 'Precipitation Radar',
    shortName: 'Radar',
    category: 'Storms',
    priority: 'P1',
    unit: 'dBZ',
    providerName: 'RainViewer / NEXRAD / JMA / OPERA Composite',
    modelSource: 'Observed Doppler Reflectivity Composite',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'PRECIPITATION_FIELD',
    legendStops: [
      { label: '20 dBZ (Light)', value: 20, colorHex: '#38bdf8' },
      { label: '35 dBZ (Moderate)', value: 35, colorHex: '#22c55e' },
      { label: '48 dBZ (Heavy)', value: 48, colorHex: '#eab308' },
      { label: '58+ dBZ (Severe)', value: 58, colorHex: '#ef4444' },
    ],
    descriptionPlain: 'Near-real-time weather radar reflectivity showing active rain bands.',
    coverageNote: 'Observed radar (-168h to Now); transitions to model precipitation for future steps.',
  },
  {
    id: 'STORM_TRACKS',
    name: 'Storm Tracks & Cyclones',
    shortName: 'Storm Tracks',
    category: 'Storms',
    priority: 'P1',
    unit: 'kt / hPa',
    providerName: 'JTWC / NHC / JMA / ECMWF Ensemble Tracks',
    modelSource: 'Cyclone Trajectory & 90% Cone of Uncertainty',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'STORM_TRACK_VECTORS',
    legendStops: [
      { label: 'Tropical Depression', value: 30, colorHex: '#38bdf8' },
      { label: 'Tropical Storm', value: 50, colorHex: '#f59e0b' },
      { label: 'Typhoon / Hurricane', value: 85, colorHex: '#f43f5e' },
    ],
    descriptionPlain: 'Active tropical trough, cyclone, and extratropical storm tracks.',
    coverageNote: 'Includes Western Pacific (Taiwan Strait / Okinawa) & North Atlantic corridors.',
  },
  {
    id: 'SATELLITE_CLOUD_IMAGERY',
    name: 'Infrared Satellite Clouds',
    shortName: 'IR Satellite',
    category: 'Satellite',
    priority: 'P1',
    unit: 'K (Brightness Temp)',
    providerName: 'NOAA GOES / Himawari-9 / EUMETSAT Meteosat',
    modelSource: 'Longwave IR (10.4 μm) Cloud-Top Temperature',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'CLOUD_CANOPY',
    legendStops: [
      { label: '275 K (Low)', value: 275, colorHex: '#475569' },
      { label: '240 K (Mid)', value: 240, colorHex: '#cbd5e1' },
      { label: '205 K (Deep Convective)', value: 205, colorHex: '#38bdf8' },
    ],
    descriptionPlain: 'Satellite infrared cloud-top brightness showing deep convection.',
    coverageNote: 'Global geostationary composite ring (-60°S to +60°N).',
  },
  {
    id: 'HUMIDITY',
    name: 'Relative Humidity (2m)',
    shortName: 'Humidity',
    category: 'Satellite',
    priority: 'P1',
    unit: '%',
    providerName: 'Open-Meteo / ECMWF IFS',
    modelSource: '2m Relative Moisture Saturation',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'HEATMAP_GRID',
    legendStops: [
      { label: '25% (Dry)', value: 25, colorHex: '#f59e0b' },
      { label: '55% (Moderate)', value: 55, colorHex: '#34d399' },
      { label: '85%+ (Humid)', value: 85, colorHex: '#0ea5e9' },
    ],
    descriptionPlain: 'Near-surface relative humidity percentage.',
    coverageNote: 'Global 0.25° resolution.',
  },
  {
    id: 'ATMOSPHERIC_PRESSURE',
    name: 'Mean Sea-Level Pressure',
    shortName: 'Pressure',
    category: 'Forecasts',
    priority: 'P1',
    unit: 'hPa',
    providerName: 'ECMWF IFS / NOAA GFS / WeatherNext 3',
    modelSource: 'MSLP Synoptic Ridge & Trough Field',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'ISOBAR_CONTOURS',
    legendStops: [
      { label: '985 hPa (Deep Low)', value: 985, colorHex: '#6366f1' },
      { label: '1013 hPa (Standard)', value: 1013, colorHex: '#94a3b8' },
      { label: '1032 hPa (High Ridge)', value: 1032, colorHex: '#f59e0b' },
    ],
    descriptionPlain: 'Mean sea-level barometric pressure in hectopascals (hPa).',
    coverageNote: 'Global synoptic pressure centers and frontal troughs.',
  },
  {
    id: 'RAINFALL_PROBABILITY',
    name: 'Rainfall Probability (>10mm)',
    shortName: 'Rain Prob',
    category: 'Forecasts',
    priority: 'P1',
    unit: '%',
    providerName: 'WeatherNext 3 (60-Member) + ECMWF ENS (51-Member)',
    modelSource: 'Calibrated Ensemble Exceedance Probability',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'PRECIPITATION_FIELD',
    legendStops: [
      { label: '20%', value: 20, colorHex: '#93c5fd' },
      { label: '50%', value: 50, colorHex: '#3b82f6' },
      { label: '80%+', value: 80, colorHex: '#1d4ed8' },
    ],
    descriptionPlain: 'Probability that 24-hour rainfall exceeds 10 mm across ensemble members.',
    coverageNote: 'Calibrated via EMOS across 141 combined ensemble members.',
  },
  {
    id: 'FORECAST_UNCERTAINTY',
    name: 'Forecast Uncertainty (Model Spread)',
    shortName: 'Uncertainty',
    category: 'Forecasts',
    priority: 'P1',
    unit: 'mm (1σ)',
    providerName: 'AlphaForge Multi-Model Verification Engine',
    modelSource: 'Inter-Model Disagreement + EMOS Predictive Spread (σ_cal)',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'UNCERTAINTY_ENVELOPE',
    legendStops: [
      { label: 'Low Spread (<4mm)', value: 3, colorHex: '#10b981' },
      { label: 'Moderate (10mm)', value: 10, colorHex: '#f59e0b' },
      { label: 'High Disagreement (>22mm)', value: 24, colorHex: '#f43f5e' },
    ],
    descriptionPlain: 'Highlights regions where WeatherNext 3, ECMWF, and NOAA GFS diverge.',
    coverageNote: 'Distinguishes raw ensemble spread from calibrated 90% prediction intervals.',
  },

  // ==========================================================================
  // P2 — ADVANCED CLIMATE ANOMALIES, DROUGHT & RENEWABLE ENERGY
  // ==========================================================================
  {
    id: 'DROUGHT_INDICATORS',
    name: 'Drought & Soil Moisture Stress',
    shortName: 'Drought',
    category: 'Advanced',
    priority: 'P2',
    unit: 'SPEI-30',
    providerName: 'NASA SMAP / Copernicus ERA5-Land / INMET',
    modelSource: '30-Day Standardized Precipitation-Evapotranspiration Index',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: false,
    renderMethod: 'ANOMALY_DIVERGING',
    legendStops: [
      { label: '-2.0 (Extreme Drought)', value: -2.0, colorHex: '#dc2626' },
      { label: '-1.0 (Moderate Deficit)', value: -1.0, colorHex: '#f59e0b' },
      { label: '0.0 (Normal)', value: 0.0, colorHex: '#94a3b8' },
      { label: '+1.5 (Moisture Surplus)', value: 1.5, colorHex: '#0ea5e9' },
    ],
    descriptionPlain: 'Root-zone soil moisture and agricultural drought stress index.',
    coverageNote: 'Critical for Brazil Arabica coffee, US Midwest grains, and Sahel crops.',
  },
  {
    id: 'TEMPERATURE_ANOMALIES',
    name: 'Temperature Anomalies (vs 1991–2020)',
    shortName: 'Temp Anomaly',
    category: 'Advanced',
    priority: 'P2',
    unit: '°C Anomaly',
    providerName: 'ERA5 Climatology / WeatherNext 3',
    modelSource: 'Departure from 30-Year WMO Seasonal Normal',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'ANOMALY_DIVERGING',
    legendStops: [
      { label: '-4°C (Cold Surge)', value: -4, colorHex: '#38bdf8' },
      { label: '0°C (Climatology)', value: 0, colorHex: '#94a3b8' },
      { label: '+4°C (Heat Wave)', value: 4, colorHex: '#f43f5e' },
    ],
    descriptionPlain: 'Surface temperature departure from the 1991–2020 seasonal mean.',
    coverageNote: 'Drives Heating/Cooling Degree Day (HDD/CDD) utility power load models.',
  },
  {
    id: 'RAINFALL_ANOMALIES',
    name: 'Rainfall Anomalies (% of Normal)',
    shortName: 'Rain Anomaly',
    category: 'Advanced',
    priority: 'P2',
    unit: '% vs Norm',
    providerName: 'CHIRPS v2.0 / ERA5 / Multi-Model Ensemble',
    modelSource: 'Precipitation Departure from Seasonal Baseline',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'ANOMALY_DIVERGING',
    legendStops: [
      { label: '-60% (Deficit)', value: -60, colorHex: '#d97706' },
      { label: '0% (Normal)', value: 0, colorHex: '#94a3b8' },
      { label: '+60% (Surplus)', value: 60, colorHex: '#0284c7' },
    ],
    descriptionPlain: 'Percentage departure of precipitation from 30-year climatology.',
    coverageNote: 'Used in hydropower reservoir and agricultural yield regressions.',
  },
  {
    id: 'RENEWABLE_ENERGY_VARIABLES',
    name: 'Renewable Energy (100m Wind & Solar)',
    shortName: 'Renewables',
    category: 'Advanced',
    priority: 'P2',
    unit: 'm/s & W/m²',
    providerName: 'ECMWF IFS Energy Slice / Open-Meteo',
    modelSource: '100m Turbine Hub-Height Wind & Shortwave Solar Irradiance',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'HEATMAP_GRID',
    legendStops: [
      { label: 'Low Gen (<4 m/s)', value: 3, colorHex: '#64748b' },
      { label: 'Optimal Generation', value: 12, colorHex: '#10b981' },
      { label: 'Cut-Out Gale (>25 m/s)', value: 25, colorHex: '#f43f5e' },
    ],
    descriptionPlain: 'Wind turbine hub-height generation potential and solar irradiance.',
    coverageNote: 'Used for European, Japanese, and US grid generation spread analysis.',
  },
  {
    id: 'WIND_DIRECTION',
    name: 'Upper-Level Wind Vectors (850 hPa)',
    shortName: '850hPa Wind',
    category: 'Advanced',
    priority: 'P2',
    unit: 'deg / m/s',
    providerName: 'ECMWF IFS / NOAA GFS',
    modelSource: '850 hPa Monsoon & Jet Transport Vectors',
    operationalStatus: 'OPERATIONAL',
    supportsTimeAnimation: true,
    renderMethod: 'WIND_STREAMLINES',
    legendStops: [
      { label: '10 m/s', value: 10, colorHex: '#38bdf8' },
      { label: '22 m/s', value: 22, colorHex: '#a855f7' },
      { label: '35+ m/s', value: 35, colorHex: '#ec4899' },
    ],
    descriptionPlain: '850 hPa moisture transport and lower-tropospheric wind vectors.',
    coverageNote: 'Tracks moisture plumes into East Asia and South America.',
  },
];

export const LAYER_CATEGORIES: OperationalLayerCategory[] = [
  'Weather',
  'Storms',
  'Satellite',
  'Forecasts',
  'Advanced',
];

export function getWeatherLayerById(
  id: OperationalWeatherLayerId
): OperationalWeatherLayerAudit {
  return (
    OPERATIONAL_WEATHER_LAYER_REGISTRY.find((l) => l.id === id) ||
    OPERATIONAL_WEATHER_LAYER_REGISTRY[0]
  );
}
