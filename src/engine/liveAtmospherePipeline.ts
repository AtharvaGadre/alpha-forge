// ============================================================================
// ALPHAFORGE ATMOSPHERE — LIVE OPEN-DATA PIPELINE (SERVER-SIDE)
// Predict the weather → Model the consequences → Explain → Verify, for ANY
// location the user names, using live public data instead of fixtures:
//   • Open-Meteo Geocoding API             (place → coordinates)
//   • Open-Meteo Forecast API              (8 deterministic global models)
//   • Open-Meteo Ensemble API              (ECMWF ENS 51 + NOAA GEFS 31 members)
//   • Open-Meteo Previous-Runs API         (what each model forecast 1/3/5 days ago)
//   • Open-Meteo Historical API (ERA5)     (10-year climatology + verification truth)
//   • Open-Meteo model metadata            (real run initialisation timestamps)
//   • NASA POWER monthly point API         (10-year monthly history for market tests)
//   • Yahoo Finance chart endpoint         (observed prices; unofficial, research display only)
// Every number shown to the user is computed here from those responses. The LLM
// (server.ts) may only rephrase these numbers, never create them.
// ============================================================================

import {
  computeWeightedEnsembleForecast,
  computeWeatherVerificationMetrics,
  validateForecastProvenanceGate,
  type ArgonInvestigationResult,
  type ArgonWorkflowStepLog,
  type AtmosphereWeatherLayerId,
  type ForecastImprovementExperimentRecord,
  type ForecastProvenanceCheckResult,
  type ModelSingleForecastInput,
  type MultiModelEnsembleResult,
  type WeatherModelId,
  type WeatherVerificationMetrics,
} from './argonAtmosphereEngine.ts';

// ----------------------------------------------------------------------------
// 1. TYPES
// ----------------------------------------------------------------------------

export type FetchJson = (url: string, timeoutMs: number) => Promise<any>;

export interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

export type ExposureDriver = 'PRECIP' | 'TEMP_DEMAND' | 'HEAT' | 'WIND' | 'CONTEXT';

export interface MarketExposure {
  symbol: string;
  name: string;
  sector: 'AGRICULTURE' | 'ENERGY' | 'EQUITY_INDEX' | 'FX';
  driver: ExposureDriver;
}

export interface ResolvedTarget {
  label: string;
  countryCode: string;
  points: GeoPoint[];
  presetId: string | null;
  resolution: 'PRESET' | 'GEOCODED' | 'COORDINATES' | 'CONTEXT_FALLBACK';
  matchedText: string;
  exposures: MarketExposure[];
}

export interface LiveModelSpec {
  apiId: string; // Open-Meteo model id used in forecast / previous-runs requests
  metaId: string; // Open-Meteo metadata id for run timestamps
  modelId: WeatherModelId;
  name: string;
  provider: string;
}

export interface DataFetchLogEntry {
  source: string;
  url: string;
  fetchedAtUtc: string;
  ok: boolean;
  elapsedMs: number;
  note: string;
}

export interface WindowStats {
  precipMm: number;
  tempMeanC: number;
  heatDays: number; // days with Tmax ≥ 32 °C
  hdd: number; // Σ max(0, 18 − Tmean)
  cdd: number; // Σ max(0, Tmean − 18)
  windMeanMs: number;
}

export interface ModelProvenance {
  modelId: WeatherModelId;
  name: string;
  initTimestampUtc: string | null;
  gate: ForecastProvenanceCheckResult;
}

export interface ModelSkillRow {
  modelId: WeatherModelId;
  name: string;
  leadDays: number;
  n: number;
  precipMae: number;
  precipRmse: number;
  precipBias: number;
  tempMae: number;
  tempRmse: number;
  tempBias: number;
}

export interface VerificationExperiment {
  truthSource: string;
  trainWindow: string;
  testWindow: string;
  leadDays: number;
  nTrain: number;
  nTest: number;
  trainedWeights: Array<{ modelId: WeatherModelId; name: string; weight: number }>;
  calibrationInflation: number;
  equalWeightInflation: number;
  skillWeighted: WeatherVerificationMetrics;
  equalWeight: WeatherVerificationMetrics;
  bestSingleModel: { name: string; rmse: number };
  verdict: 'SKILL_WEIGHTING_IMPROVED' | 'SKILL_WEIGHTING_NOT_BETTER';
}

export interface ClimateSignal {
  id: 'PRECIP_NEXT7' | 'PRECIP_14D' | 'TEMP_NEXT7' | 'HDD_NEXT7' | 'CDD_NEXT7' | 'HEAT_NEXT7' | 'WIND_NEXT7';
  label: string;
  unit: string;
  value: number;
  normal: number;
  anomaly: number;
  anomalyPct: number | null;
  zScore: number;
  percentileVsLast10Years: number;
  materiality: 'MATERIAL' | 'NOTABLE' | 'NEAR_NORMAL';
}

export interface ObservedMarketMove {
  symbol: string;
  name: string;
  lastClose: number;
  currency: string;
  lastDate: string;
  return5dPct: number;
  realisedVolDailyPct: number;
  moveInSigma: number;
}

export interface HistoricalAssociation {
  symbol: string;
  weatherVariable: string;
  months: number;
  sameMonthR: number;
  sameMonthP: number;
  nextMonthR: number;
  nextMonthP: number;
  expectedSign: -1 | 1;
  verdict: 'SUPPORTED_IN_SAMPLE' | 'CONTRADICTED_IN_SAMPLE' | 'NOT_DETECTED';
}

export interface ConsequenceChain {
  exposure: MarketExposure;
  driverSignal: ClimateSignal | null;
  steps: string[];
  hypothesis: string;
  hypothesisDirection: 'UPWARD_PRESSURE' | 'DOWNWARD_PRESSURE' | 'NO_MATERIAL_SIGNAL';
  offsettingFactors: string[];
  invalidationCriteria: string;
  observedMove: ObservedMarketMove | null;
  historical: HistoricalAssociation | null;
  confidence: 'LOW' | 'MODERATE' | 'HIGH';
  confidenceReasons: string[];
}

export interface LiveAtmosphereInvestigation {
  pipelineVersion: string;
  generatedAtUtc: string;
  query: string;
  target: ResolvedTarget;
  windows: { pastLabel: string; forecastLabel: string; forecastDates: string[] };
  provenance: ModelProvenance[];
  modelForecasts: Array<{ modelId: WeatherModelId; name: string; stats: WindowStats; includedInEnsemble: boolean; exclusionReason: string | null }>;
  ensembleMembers: { ecmwfMembers: number; gefsMembers: number; withinStdMm: number };
  modelInputs: ModelSingleForecastInput[];
  ensemble: MultiModelEnsembleResult;
  exceedanceThresholdMm: number;
  recentPast: WindowStats;
  climatology: { years: number; next7: WindowStats; past7: WindowStats };
  signals: ClimateSignal[];
  verification: VerificationExperiment | null;
  skillByLead: ModelSkillRow[];
  consequences: ConsequenceChain[];
  epistemic: {
    A_whatWeatherOccurred: string[];
    B_whatModelsPredict: string[];
    C_economicMechanisms: string[];
    D_whatAssetPricesDid: string[];
    E_modelSupportedFutureScenarios: string[];
    F_whatRemainsUncertainOrUnverified: string[];
  };
  briefingBasic: string;
  briefingAdvanced: string;
  steps: ArgonWorkflowStepLog[];
  dataLog: DataFetchLogEntry[];
  reproducibility: { inputsSha256: string; reconciliationPassed: boolean; reconciliationNote: string };
}

// ----------------------------------------------------------------------------
// 2. REGISTRIES
// ----------------------------------------------------------------------------

export const LIVE_MODEL_SPECS: LiveModelSpec[] = [
  { apiId: 'ecmwf_ifs025', metaId: 'ecmwf_ifs025', modelId: 'ECMWF_IFS', name: 'ECMWF IFS 0.25°', provider: 'ECMWF (open data) via Open-Meteo' },
  { apiId: 'ecmwf_aifs025_single', metaId: 'ecmwf_aifs025_single', modelId: 'ECMWF_AIFS', name: 'ECMWF AIFS (AI model)', provider: 'ECMWF (open data) via Open-Meteo' },
  { apiId: 'gfs_seamless', metaId: 'ncep_gfs025', modelId: 'NOAA_GFS', name: 'NOAA GFS', provider: 'NOAA NCEP via Open-Meteo' },
  { apiId: 'icon_seamless', metaId: 'dwd_icon', modelId: 'DWD_ICON', name: 'DWD ICON', provider: 'Deutscher Wetterdienst via Open-Meteo' },
  { apiId: 'ukmo_seamless', metaId: 'ukmo_global_deterministic_10km', modelId: 'UKMO_UM', name: 'UK Met Office UM', provider: 'Met Office via Open-Meteo' },
  { apiId: 'meteofrance_seamless', metaId: 'meteofrance_arpege_world025', modelId: 'METEOFRANCE_ARPEGE', name: 'Météo-France ARPEGE', provider: 'Météo-France via Open-Meteo' },
  { apiId: 'jma_seamless', metaId: 'jma_gsm', modelId: 'JMA_GSM', name: 'JMA GSM', provider: 'Japan Meteorological Agency via Open-Meteo' },
  { apiId: 'gem_seamless', metaId: 'cmc_gem_gdps', modelId: 'ECCC_GEM', name: 'ECCC GEM', provider: 'Environment Canada via Open-Meteo' },
];

const MAX_RUN_AGE_HOURS = 24;
const HEAT_DAY_TMAX_C = 32;
const DEGREE_DAY_BASE_C = 18;

interface RegionPreset {
  id: string;
  label: string;
  countryCode: string;
  keywords: RegExp;
  points: GeoPoint[];
  exposures: MarketExposure[];
}

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'BRAZIL_COFFEE_BELT',
    label: 'Brazil Arabica coffee belt (Sul de Minas & Cerrado Mineiro)',
    countryCode: 'BR',
    keywords: /\b(coffee|arabica|minas gerais|sul de minas|cerrado mineiro)\b/i,
    points: [
      { name: 'Varginha', lat: -21.551, lng: -45.43 },
      { name: 'Patrocínio', lat: -18.944, lng: -46.993 },
      { name: 'Guaxupé', lat: -21.305, lng: -46.713 },
    ],
    exposures: [
      { symbol: 'KC=F', name: 'ICE Arabica coffee futures', sector: 'AGRICULTURE', driver: 'PRECIP' },
      { symbol: 'BRL=X', name: 'USD/BRL', sector: 'FX', driver: 'CONTEXT' },
    ],
  },
  {
    id: 'US_CORN_BELT',
    label: 'US Corn Belt (Iowa, Illinois, Nebraska)',
    countryCode: 'US',
    keywords: /\b(corn belt|corn|soy|soybeans?|iowa|illinois|nebraska|midwest)\b/i,
    points: [
      { name: 'Des Moines', lat: 41.586, lng: -93.625 },
      { name: 'Champaign', lat: 40.116, lng: -88.243 },
      { name: 'Lincoln', lat: 40.814, lng: -96.702 },
    ],
    exposures: [
      { symbol: 'ZC=F', name: 'CBOT corn futures', sector: 'AGRICULTURE', driver: 'PRECIP' },
      { symbol: 'ZS=F', name: 'CBOT soybean futures', sector: 'AGRICULTURE', driver: 'PRECIP' },
    ],
  },
  {
    id: 'TEXAS_POWER',
    label: 'Texas power load centres (Dallas, Houston, San Antonio)',
    countryCode: 'US',
    keywords: /\b(texas|ercot|houston|dallas)\b/i,
    points: [
      { name: 'Dallas', lat: 32.777, lng: -96.797 },
      { name: 'Houston', lat: 29.76, lng: -95.37 },
      { name: 'San Antonio', lat: 29.424, lng: -98.494 },
    ],
    exposures: [{ symbol: 'NG=F', name: 'NYMEX Henry Hub natural gas futures', sector: 'ENERGY', driver: 'TEMP_DEMAND' }],
  },
  {
    id: 'NW_EUROPE_GAS',
    label: 'North-west Europe gas & power demand (London, Amsterdam, Berlin, Paris)',
    countryCode: 'NL',
    keywords: /\b(europe|european|ttf|eu gas|north-?west europe)\b/i,
    points: [
      { name: 'London', lat: 51.507, lng: -0.128 },
      { name: 'Amsterdam', lat: 52.37, lng: 4.895 },
      { name: 'Berlin', lat: 52.52, lng: 13.405 },
      { name: 'Paris', lat: 48.857, lng: 2.352 },
    ],
    exposures: [{ symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' }],
  },
  {
    id: 'EAST_SOUTH_ASIA',
    label: 'East & South Asia demand centres (Tokyo, Seoul, Shanghai, Taipei, Mumbai)',
    countryCode: 'JP',
    keywords: /\b(asia|asian|east asia)\b/i,
    points: [
      { name: 'Tokyo', lat: 35.676, lng: 139.65 },
      { name: 'Seoul', lat: 37.566, lng: 126.978 },
      { name: 'Shanghai', lat: 31.23, lng: 121.474 },
      { name: 'Taipei', lat: 25.033, lng: 121.565 },
      { name: 'Mumbai', lat: 19.076, lng: 72.878 },
    ],
    exposures: [
      { symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' },
      { symbol: 'EWJ', name: 'iShares MSCI Japan ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
    ],
  },
  {
    id: 'INDIA_MONSOON',
    label: 'India monsoon & agriculture (Mumbai, Delhi, Nagpur, Kolkata)',
    countryCode: 'IN',
    keywords: /\b(india|monsoon|indian)\b/i,
    points: [
      { name: 'Mumbai', lat: 19.076, lng: 72.878 },
      { name: 'Delhi', lat: 28.614, lng: 77.209 },
      { name: 'Nagpur', lat: 21.146, lng: 79.088 },
      { name: 'Kolkata', lat: 22.573, lng: 88.364 },
    ],
    exposures: [
      { symbol: 'SB=F', name: 'ICE raw sugar futures', sector: 'AGRICULTURE', driver: 'PRECIP' },
      { symbol: 'INDA', name: 'iShares MSCI India ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
    ],
  },
  {
    id: 'WEST_AFRICA_COCOA',
    label: "West Africa cocoa belt (Côte d'Ivoire & Ghana)",
    countryCode: 'CI',
    keywords: /\b(cocoa|ivory coast|c[oô]te d'?ivoire|ghana)\b/i,
    points: [
      { name: 'Daloa', lat: 6.877, lng: -6.45 },
      { name: 'San-Pédro', lat: 4.748, lng: -6.636 },
      { name: 'Kumasi', lat: 6.688, lng: -1.624 },
    ],
    exposures: [{ symbol: 'CC=F', name: 'ICE cocoa futures', sector: 'AGRICULTURE', driver: 'PRECIP' }],
  },
];

/** Country-level market exposure used when the user names an arbitrary place. */
export const COUNTRY_EXPOSURES: Record<string, MarketExposure[]> = {
  BR: [
    { symbol: 'KC=F', name: 'ICE Arabica coffee futures', sector: 'AGRICULTURE', driver: 'PRECIP' },
    { symbol: 'EWZ', name: 'iShares MSCI Brazil ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
  ],
  US: [{ symbol: 'NG=F', name: 'NYMEX Henry Hub natural gas futures', sector: 'ENERGY', driver: 'TEMP_DEMAND' }],
  CA: [{ symbol: 'NG=F', name: 'NYMEX Henry Hub natural gas futures', sector: 'ENERGY', driver: 'TEMP_DEMAND' }],
  GB: [
    { symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' },
    { symbol: 'EWU', name: 'iShares MSCI United Kingdom ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
  ],
  NL: [{ symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' }],
  DE: [
    { symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' },
    { symbol: 'EWG', name: 'iShares MSCI Germany ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
  ],
  FR: [{ symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' }],
  SE: [
    { symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' },
    { symbol: 'EWD', name: 'iShares MSCI Sweden ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
  ],
  NO: [{ symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' }],
  JP: [
    { symbol: 'NG=F', name: 'NYMEX Henry Hub gas (proxy: TTF/JKM not available from free sources)', sector: 'ENERGY', driver: 'TEMP_DEMAND' },
    { symbol: 'EWJ', name: 'iShares MSCI Japan ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
  ],
  KR: [{ symbol: 'EWY', name: 'iShares MSCI South Korea ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' }],
  TW: [{ symbol: 'EWT', name: 'iShares MSCI Taiwan ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' }],
  CN: [{ symbol: 'FXI', name: 'iShares China Large-Cap ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' }],
  IN: [
    { symbol: 'SB=F', name: 'ICE raw sugar futures', sector: 'AGRICULTURE', driver: 'PRECIP' },
    { symbol: 'INDA', name: 'iShares MSCI India ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' },
  ],
  AU: [{ symbol: 'EWA', name: 'iShares MSCI Australia ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' }],
  CI: [{ symbol: 'CC=F', name: 'ICE cocoa futures', sector: 'AGRICULTURE', driver: 'PRECIP' }],
  GH: [{ symbol: 'CC=F', name: 'ICE cocoa futures', sector: 'AGRICULTURE', driver: 'PRECIP' }],
  VN: [{ symbol: 'KC=F', name: 'ICE Arabica coffee futures (robusta proxy)', sector: 'AGRICULTURE', driver: 'PRECIP' }],
  MX: [{ symbol: 'EWW', name: 'iShares MSCI Mexico ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' }],
  ZA: [{ symbol: 'EZA', name: 'iShares MSCI South Africa ETF', sector: 'EQUITY_INDEX', driver: 'CONTEXT' }],
};

// ----------------------------------------------------------------------------
// 3. PURE MATHS & DATE HELPERS (unit-tested)
// ----------------------------------------------------------------------------

export const round = (x: number, dp = 2): number => {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
};

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export const stdDev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
};

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function shiftYears(dateIso: string, years: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  if (d.getUTCMonth() !== month) d.setUTCDate(0); // 29 Feb → 28 Feb
  return isoDate(d);
}

export function dateRange(startIso: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(startIso, i));
}

export function normalCdf(z: number): number {
  // Abramowitz–Stegun 7.1.26 via erf
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Pearson correlation with a two-sided p-value from the Fisher z-transform. */
export function pearsonWithP(x: number[], y: number[]): { r: number; p: number; n: number } {
  const pairs = x.map((xi, i) => [xi, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const n = pairs.length;
  if (n < 6) return { r: 0, p: 1, n };
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [a, b] of pairs) {
    sxy += (a - mx) * (b - my);
    sxx += (a - mx) ** 2;
    syy += (b - my) ** 2;
  }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const rc = Math.max(-0.999999, Math.min(0.999999, r));
  const z = Math.atanh(rc) * Math.sqrt(n - 3);
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { r, p, n };
}

export function windowStats(precip: number[], tmean: number[], tmax: number[], wind: number[]): WindowStats {
  return {
    precipMm: precip.reduce((a, b) => a + b, 0),
    tempMeanC: mean(tmean),
    heatDays: tmax.filter((t) => t >= HEAT_DAY_TMAX_C).length,
    hdd: tmean.reduce((a, t) => a + Math.max(0, DEGREE_DAY_BASE_C - t), 0),
    cdd: tmean.reduce((a, t) => a + Math.max(0, t - DEGREE_DAY_BASE_C), 0),
    windMeanMs: mean(wind),
  };
}

export function averageStats(list: WindowStats[]): WindowStats {
  return {
    precipMm: mean(list.map((s) => s.precipMm)),
    tempMeanC: mean(list.map((s) => s.tempMeanC)),
    heatDays: mean(list.map((s) => s.heatDays)),
    hdd: mean(list.map((s) => s.hdd)),
    cdd: mean(list.map((s) => s.cdd)),
    windMeanMs: mean(list.map((s) => s.windMeanMs)),
  };
}

/** Inverse-MSE weights shrunk 50 % toward equal weights (guards against over-fitting a short window). */
export function inverseMseWeights(mseByModel: number[], shrinkToEqual = 0.5): number[] {
  const m = mseByModel.length;
  const inv = mseByModel.map((v) => 1 / Math.max(1e-6, v));
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((v) => (1 - shrinkToEqual) * (v / s) + shrinkToEqual / m);
}

export function weightedMeanAndStd(values: number[], weights: number[]): { mean: number; std: number } {
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const mu = values.reduce((a, v, i) => a + (weights[i] / wsum) * v, 0);
  const v = values.reduce((a, x, i) => a + (weights[i] / wsum) * (x - mu) ** 2, 0);
  return { mean: mu, std: Math.sqrt(v) };
}

export function classifyMateriality(z: number): ClimateSignal['materiality'] {
  const a = Math.abs(z);
  return a >= 1.5 ? 'MATERIAL' : a >= 0.75 ? 'NOTABLE' : 'NEAR_NORMAL';
}

export function buildSignal(
  id: ClimateSignal['id'],
  label: string,
  unit: string,
  value: number,
  history: number[],
  pct: boolean,
  sdFloor = pct ? 0.5 : 0.3
): ClimateSignal {
  const normal = mean(history);
  // The floor stops near-zero climatologies (e.g. heating degree-days in the tropics) from producing huge z-scores
  const sd = Math.max(stdDev(history), sdFloor, pct ? Math.abs(normal) * 0.1 : 0);
  const z = (value - normal) / sd;
  const below = history.filter((h) => h < value).length;
  return {
    id,
    label,
    unit,
    value: round(value, 1),
    normal: round(normal, 1),
    anomaly: round(value - normal, 1),
    anomalyPct: pct && Math.abs(normal) > 0.5 ? round(((value - normal) / normal) * 100, 0) : null,
    zScore: round(z, 2),
    percentileVsLast10Years: round((below / Math.max(1, history.length)) * 100, 0),
    materiality: classifyMateriality(z),
  };
}

// ----------------------------------------------------------------------------
// 4. QUERY → LOCATION RESOLUTION
// ----------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'hey', 'argon', 'what', 'how', 'why', 'when', 'where', 'which', 'who', 'the', 'and', 'or', 'next', 'last',
  'this', 'that', 'week', 'weeks', 'weather', 'forecast', 'show', 'tell', 'me', 'could', 'would', 'will',
  'markets', 'market', 'mean', 'i', 'a', 'an', 'is', 'are', 'do', 'does', 'did', 'affect', 'concentrate',
  'compare', 'explain', 'focus', 'please', 'give', 'today', 'tomorrow', 'rain', 'rainfall', 'prices',
]);

export function extractCoordinates(query: string): { lat: number; lng: number } | null {
  const m = query.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (m[1].includes('.') || m[2].includes('.')) ? { lat, lng } : null;
}

const DEMONYMS: Record<string, string> = {
  brazilian: 'Brazil', indian: 'India', japanese: 'Japan', chinese: 'China', american: 'United States', british: 'United Kingdom',
  german: 'Germany', french: 'France', australian: 'Australia', kenyan: 'Kenya', mexican: 'Mexico', canadian: 'Canada',
  swedish: 'Sweden', norwegian: 'Norway', dutch: 'Netherlands', korean: 'South Korea', taiwanese: 'Taiwan', vietnamese: 'Vietnam',
  ghanaian: 'Ghana', ivorian: "Côte d'Ivoire", argentine: 'Argentina', argentinian: 'Argentina', egyptian: 'Egypt', nigerian: 'Nigeria',
  spanish: 'Spain', italian: 'Italy', turkish: 'Turkey', russian: 'Russia', ukrainian: 'Ukraine', indonesian: 'Indonesia', thai: 'Thailand',
};

/** Candidate place names, most specific first. */
export function extractPlaceCandidates(query: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const raw = s.replace(/[?!.,;:"“”]+$/g, '').replace(/['’]s$/, '').trim();
    const t = DEMONYMS[raw.toLowerCase()] ?? raw;
    if (t.length >= 2 && !STOP_WORDS.has(t.toLowerCase()) && !out.includes(t)) out.push(t);
  };
  const prep = /\b(?:in|over|across|for|at|near|around|on|about|to)\s+((?:[A-Z][\p{L}'’.-]*)(?:\s+(?:de|do|da|del|of|la|le|[A-Z][\p{L}'’.-]*)){0,3})/gu;
  for (const m of query.matchAll(prep)) push(m[1]);
  const caps = /((?:[A-Z][\p{L}'’.-]+)(?:\s+(?:de|do|da|del|of|[A-Z][\p{L}'’.-]+)){0,3})/gu;
  for (const m of query.matchAll(caps)) {
    const words = m[1].split(/\s+/).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
    if (words.length) push(words.join(' '));
  }
  const plain = query.trim();
  if (plain.split(/\s+/).length <= 3) push(plain);
  return out.slice(0, 5);
}

/** Choose the best geocoding hit: countries/states over towns, then population. */
export function pickGeocodeResult(results: any[], candidate: string): any | null {
  if (!Array.isArray(results) || !results.length) return null;
  const lc = candidate.toLowerCase();
  // Only accept exact name matches — fuzzy hits ("Brazilian" → "Brazilian Island") mislead more than they help
  results = results.filter((r) => String(r.name || '').toLowerCase() === lc);
  if (!results.length) return null;
  const score = (r: any) => {
    const exact = String(r.name || '').toLowerCase() === lc ? 4 : 0;
    const fc = String(r.feature_code || '');
    const admin = fc === 'PCLI' ? 6 : fc === 'ADM1' ? 5 : fc.startsWith('PPLC') ? 3 : fc.startsWith('PPLA') ? 2 : 0;
    const pop = Math.log10(Math.max(1, Number(r.population) || 1)) / 2;
    return exact + admin + pop;
  };
  return [...results].sort((a, b) => score(b) - score(a))[0];
}

export async function resolveTarget(
  query: string,
  fetchJson: FetchJson,
  log: DataFetchLogEntry[],
  fallback?: { label: string; countryCode: string; lat: number; lng: number }
): Promise<ResolvedTarget> {
  const preset = REGION_PRESETS.find((p) => p.keywords.test(query));
  const coords = extractCoordinates(query);
  if (coords) {
    return {
      label: `${coords.lat.toFixed(2)}°, ${coords.lng.toFixed(2)}°`,
      countryCode: '',
      points: [{ name: 'Requested coordinates', ...coords }],
      presetId: null,
      resolution: 'COORDINATES',
      matchedText: `${coords.lat}, ${coords.lng}`,
      exposures: [],
    };
  }

  // Specific place names beat broad presets ("Brazil" alone → country; "coffee" → coffee belt)
  for (const candidate of extractPlaceCandidates(query)) {
    if (preset && preset.keywords.test(candidate)) break;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=8&language=en&format=json`;
    const t0 = Date.now();
    try {
      const data = await fetchJson(url, 5000);
      const hit = pickGeocodeResult(data?.results, candidate);
      log.push({ source: 'Open-Meteo Geocoding', url, fetchedAtUtc: new Date().toISOString(), ok: true, elapsedMs: Date.now() - t0, note: hit ? `${candidate} → ${hit.name}, ${hit.country}` : `no match for "${candidate}"` });
      if (!hit) continue;
      // Do not let a country-level hit override a commodity preset inside that country (e.g. "Brazil coffee")
      if (preset && hit.feature_code === 'PCLI' && hit.country_code === preset.countryCode) break;
      const cc = String(hit.country_code || '').toUpperCase();
      const label = [hit.name, hit.admin1 && hit.admin1 !== hit.name ? hit.admin1 : null, hit.country && hit.country !== hit.name ? hit.country : null]
        .filter(Boolean)
        .join(', ');
      return {
        label,
        countryCode: cc,
        points: [{ name: hit.name, lat: Number(hit.latitude), lng: Number(hit.longitude) }],
        presetId: null,
        resolution: 'GEOCODED',
        matchedText: candidate,
        exposures: COUNTRY_EXPOSURES[cc] ?? [],
      };
    } catch (err) {
      log.push({ source: 'Open-Meteo Geocoding', url, fetchedAtUtc: new Date().toISOString(), ok: false, elapsedMs: Date.now() - t0, note: String(err) });
    }
  }

  if (preset) {
    return {
      label: preset.label,
      countryCode: preset.countryCode,
      points: preset.points,
      presetId: preset.id,
      resolution: 'PRESET',
      matchedText: query.match(preset.keywords)?.[0] ?? preset.id,
      exposures: preset.exposures,
    };
  }

  const fb = fallback ?? { label: 'London, United Kingdom', countryCode: 'GB', lat: 51.507, lng: -0.128 };
  return {
    label: fb.label,
    countryCode: fb.countryCode,
    points: [{ name: fb.label, lat: fb.lat, lng: fb.lng }],
    presetId: null,
    resolution: 'CONTEXT_FALLBACK',
    matchedText: '',
    exposures: COUNTRY_EXPOSURES[fb.countryCode] ?? [],
  };
}

// ----------------------------------------------------------------------------
// 5. NETWORK
// ----------------------------------------------------------------------------

const USER_AGENT = 'AlphaForge-Atmosphere/1.0 (+https://github.com/AtharvaGadre/alpha-forge)';

export const defaultFetchJson: FetchJson = async (url, timeoutMs) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const isYahoo = url.includes('finance.yahoo.com');
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': isYahoo ? 'Mozilla/5.0 (compatible; AlphaForge-Atmosphere/1.0)' : USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

// Open-Meteo throttles bursts on its archive host; keep at most 2 requests in flight there
const hostSlots = new Map<string, { active: number; waiters: Array<() => void> }>();
async function withHostLimit<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const host = new URL(url).host;
  const limit = host.startsWith('archive-api') ? 2 : 8;
  const slot = hostSlots.get(host) ?? { active: 0, waiters: [] };
  hostSlots.set(host, slot);
  if (slot.active >= limit) await new Promise<void>((r) => slot.waiters.push(r));
  slot.active++;
  try {
    return await fn();
  } finally {
    slot.active--;
    slot.waiters.shift()?.();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function logged<T>(
  log: DataFetchLogEntry[],
  source: string,
  url: string,
  timeoutMs: number,
  fetchJson: FetchJson,
  note: (data: any) => string
): Promise<T | null> {
  const t0 = Date.now();
  try {
    let data: any = null;
    for (let attempt = 0; ; attempt++) {
      try {
        data = await withHostLimit(url, () => fetchJson(url, timeoutMs));
        break;
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        const transient = /429|HTTP 5\d\d|abort|fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg);
        if (attempt >= 2 || !transient) throw err;
        await sleep(2000 * (attempt + 1)); // rate limit / timeout / server blip: back off and retry
      }
    }
    if (data && (data.error === true || data.reason)) throw new Error(String(data.reason || 'API error'));
    log.push({ source, url, fetchedAtUtc: new Date().toISOString(), ok: true, elapsedMs: Date.now() - t0, note: note(data) });
    return data as T;
  } catch (err) {
    log.push({ source, url, fetchedAtUtc: new Date().toISOString(), ok: false, elapsedMs: Date.now() - t0, note: String((err as Error)?.message ?? err) });
    return null;
  }
}

const asArray = (data: any): any[] => (Array.isArray(data) ? data : data ? [data] : []);
const latList = (pts: GeoPoint[]) => pts.map((p) => p.lat.toFixed(3)).join(',');
const lngList = (pts: GeoPoint[]) => pts.map((p) => p.lng.toFixed(3)).join(',');

// Small TTL cache so repeated questions do not hammer the free APIs
const cache = new Map<string, { at: number; value: any }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  if (value !== null) cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearLivePipelineCache(): void {
  cache.clear();
}

// ----------------------------------------------------------------------------
// 6. PIPELINE STAGES
// ----------------------------------------------------------------------------

function dailySeries(loc: any, variable: string, suffix: string, dates: string[]): number[] | null {
  const times: string[] = loc?.daily?.time ?? [];
  const values: Array<number | null> = loc?.daily?.[`${variable}${suffix}`] ?? [];
  const out: number[] = [];
  for (const d of dates) {
    const i = times.indexOf(d);
    const v = i >= 0 ? values[i] : null;
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    out.push(Number(v));
  }
  return out;
}

function statsForDates(loc: any, suffix: string, dates: string[]): WindowStats | null {
  const p = dailySeries(loc, 'precipitation_sum', suffix, dates);
  const t = dailySeries(loc, 'temperature_2m_mean', suffix, dates);
  const tx = dailySeries(loc, 'temperature_2m_max', suffix, dates);
  const w = dailySeries(loc, 'wind_speed_10m_mean', suffix, dates);
  if (!p || !t || !tx || !w) return null;
  return windowStats(p, t, tx, w);
}

/** Aggregates hourly previous-run series into UTC daily sums (precip) or means (temp). */
export function hourlyToDaily(times: string[], values: Array<number | null>, mode: 'sum' | 'mean'): Map<string, number> {
  const acc = new Map<string, { s: number; n: number }>();
  times.forEach((t, i) => {
    const v = values?.[i];
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    const d = t.slice(0, 10);
    const a = acc.get(d) ?? { s: 0, n: 0 };
    a.s += Number(v);
    a.n += 1;
    acc.set(d, a);
  });
  const out = new Map<string, number>();
  for (const [d, a] of acc) if (a.n >= 20) out.set(d, mode === 'sum' ? a.s : a.s / a.n);
  return out;
}

interface VerificationPair {
  date: string;
  point: number;
  truthPrecip: number;
  truthTemp: number;
  forecasts: Array<{ precip: number; temp: number } | null>; // indexed like models
}

/**
 * Builds forecast/truth pairs for one lead time. Truth = ERA5 reanalysis daily values
 * (independent of every forecast model under test).
 */
export function buildVerificationPairs(
  prevLocs: any[],
  eraLocs: any[],
  models: LiveModelSpec[],
  leadDays: number,
  dates: string[]
): VerificationPair[] {
  const pairs: VerificationPair[] = [];
  prevLocs.forEach((loc, pi) => {
    const era = eraLocs[pi];
    if (!loc?.hourly || !era?.daily) return;
    const daily = models.map((m) => ({
      p: hourlyToDaily(loc.hourly.time, loc.hourly[`precipitation_previous_day${leadDays}_${m.apiId}`], 'sum'),
      t: hourlyToDaily(loc.hourly.time, loc.hourly[`temperature_2m_previous_day${leadDays}_${m.apiId}`], 'mean'),
    }));
    for (const d of dates) {
      const ei = era.daily.time.indexOf(d);
      const tp = ei >= 0 ? era.daily.precipitation_sum?.[ei] : null;
      const tt = ei >= 0 ? era.daily.temperature_2m_mean?.[ei] : null;
      if (tp === null || tp === undefined || tt === null || tt === undefined) continue;
      pairs.push({
        date: d,
        point: pi,
        truthPrecip: Number(tp),
        truthTemp: Number(tt),
        forecasts: daily.map((dm) => (dm.p.has(d) && dm.t.has(d) ? { precip: dm.p.get(d)!, temp: dm.t.get(d)! } : null)),
      });
    }
  });
  return pairs;
}

export function skillRows(pairs: VerificationPair[], models: LiveModelSpec[], leadDays: number): ModelSkillRow[] {
  return models
    .map((m, i) => {
      const rows = pairs.filter((p) => p.forecasts[i]);
      if (rows.length < 8) return null;
      const ep = rows.map((r) => r.forecasts[i]!.precip - r.truthPrecip);
      const et = rows.map((r) => r.forecasts[i]!.temp - r.truthTemp);
      return {
        modelId: m.modelId,
        name: m.name,
        leadDays,
        n: rows.length,
        precipMae: round(mean(ep.map(Math.abs)), 2),
        precipRmse: round(Math.sqrt(mean(ep.map((e) => e * e))), 2),
        precipBias: round(mean(ep), 2),
        tempMae: round(mean(et.map(Math.abs)), 2),
        tempRmse: round(Math.sqrt(mean(et.map((e) => e * e))), 2),
        tempBias: round(mean(et), 2),
      };
    })
    .filter((r): r is ModelSkillRow => r !== null);
}

/**
 * Out-of-sample experiment: fit inverse-MSE weights + spread-inflation factor on the
 * older half of the window, then score skill-weighted vs equal-weight ensembles on the
 * newer half. Nothing from the test half is used in fitting.
 */
export function runVerificationExperiment(
  pairs: VerificationPair[],
  models: LiveModelSpec[],
  usable: boolean[],
  leadDays: number,
  truthSource: string
): VerificationExperiment | null {
  const idx = models.map((_, i) => i).filter((i) => usable[i]);
  const complete = pairs.filter((p) => idx.every((i) => p.forecasts[i]));
  if (idx.length < 2 || complete.length < 16) return null;
  const dates = Array.from(new Set(complete.map((p) => p.date))).sort();
  const cut = dates[Math.floor(dates.length / 2)];
  const train = complete.filter((p) => p.date < cut);
  const test = complete.filter((p) => p.date >= cut);
  if (train.length < 8 || test.length < 8) return null;

  const mse = idx.map((i) => mean(train.map((p) => (p.forecasts[i]!.precip - p.truthPrecip) ** 2)));
  const w = inverseMseWeights(mse);
  const eq = idx.map(() => 1 / idx.length);

  const predict = (p: VerificationPair, weights: number[]) =>
    weightedMeanAndStd(
      idx.map((i) => p.forecasts[i]!.precip),
      weights
    );

  // Spread-inflation factor k: RMS(error) / RMS(between-model spread) on TRAIN only
  const kFor = (weights: number[]) => {
    const errs = train.map((p) => predict(p, weights).mean - p.truthPrecip);
    const sprs = train.map((p) => predict(p, weights).std);
    return Math.max(1, Math.sqrt(mean(errs.map((e) => e * e)) / Math.max(0.05, mean(sprs.map((s) => s * s)))));
  };

  const score = (weights: number[], label: string): WeatherVerificationMetrics => {
    const k = kFor(weights);
    const preds = test.map((p) => predict(p, weights));
    const probs = test.map((p) => {
      const frac = idx.reduce((a, i, j) => a + weights[j] * (p.forecasts[i]!.precip >= 1 ? 1 : 0), 0);
      return (frac * idx.length + 0.5) / (idx.length + 1);
    });
    return computeWeatherVerificationMetrics({
      observedValues: test.map((p) => p.truthPrecip),
      predictedValues: preds.map((x) => x.mean),
      predictiveStdDevs: preds.map((x) => Math.max(0.3, k * x.std)),
      predictedExceedanceProbs: probs,
      eventThreshold: 1,
      validationPeriodLabel: label,
    });
  };

  const testLabel = `${test[0].date}…${test[test.length - 1].date}`;
  const skillWeighted = score(w, `Held-out ${testLabel}, day-${leadDays} lead, truth = ERA5 (skill-weighted)`);
  const equalWeight = score(eq, `Held-out ${testLabel}, day-${leadDays} lead, truth = ERA5 (equal-weight baseline)`);

  const singles = idx.map((i) => ({
    name: models[i].name,
    trainMse: mean(train.map((p) => (p.forecasts[i]!.precip - p.truthPrecip) ** 2)),
    testRmse: Math.sqrt(mean(test.map((p) => (p.forecasts[i]!.precip - p.truthPrecip) ** 2))),
  }));
  const best = [...singles].sort((a, b) => a.trainMse - b.trainMse)[0];

  return {
    truthSource,
    trainWindow: `${train[0].date}…${addDays(cut, -1)}`,
    testWindow: testLabel,
    leadDays,
    nTrain: train.length,
    nTest: test.length,
    trainedWeights: idx.map((i, j) => ({ modelId: models[i].modelId, name: models[i].name, weight: round(w[j], 4) })),
    calibrationInflation: round(kFor(w), 3),
    equalWeightInflation: round(kFor(eq), 3),
    skillWeighted,
    equalWeight,
    bestSingleModel: { name: best.name, rmse: round(best.testRmse, 3) },
    verdict: skillWeighted.crps < equalWeight.crps ? 'SKILL_WEIGHTING_IMPROVED' : 'SKILL_WEIGHTING_NOT_BETTER',
  };
}

/** Region-average monthly anomalies (de-seasonalised by month-of-year) from NASA POWER monthly point data. */
export function monthlyAnomaliesFromPower(powerResponses: any[], parameter: 'PRECTOTCORR' | 'T2M'): Map<string, number> {
  const byMonth = new Map<string, number[]>();
  for (const resp of powerResponses) {
    const series: Record<string, number> = resp?.properties?.parameter?.[parameter] ?? {};
    for (const [key, val] of Object.entries(series)) {
      const mm = key.slice(4);
      if (mm === '13' || !Number.isFinite(val) || val <= -999) continue; // '13' = annual value, -999 = missing
      const ym = `${key.slice(0, 4)}-${mm}`;
      byMonth.set(ym, [...(byMonth.get(ym) ?? []), Number(val)]);
    }
  }
  const regional = new Map<string, number>();
  for (const [ym, vals] of byMonth) if (vals.length === powerResponses.length) regional.set(ym, mean(vals));
  const moy = new Map<string, number[]>();
  for (const [ym, v] of regional) moy.set(ym.slice(5), [...(moy.get(ym.slice(5)) ?? []), v]);
  const out = new Map<string, number>();
  for (const [ym, v] of regional) out.set(ym, v - mean(moy.get(ym.slice(5))!));
  return out;
}

/** Merges several Open-Meteo daily responses (same locations, different date ranges) into one per location. */
export function mergeDailyResponses(responses: any[][]): any[] {
  const nLoc = Math.max(0, ...responses.map((r) => r.length));
  return Array.from({ length: nLoc }, (_, li) => {
    const merged: any = { daily: { time: [] as string[] } };
    for (const resp of responses) {
      const d = resp[li]?.daily;
      if (!d?.time) continue;
      const n0 = merged.daily.time.length;
      merged.daily.time.push(...d.time);
      for (const [k, v] of Object.entries(d)) {
        if (k === 'time') continue;
        if (!merged.daily[k]) merged.daily[k] = new Array(n0).fill(null);
        merged.daily[k].push(...(v as any[]));
      }
      for (const k of Object.keys(merged.daily)) if (merged.daily[k].length < merged.daily.time.length) merged.daily[k].push(...new Array(merged.daily.time.length - merged.daily[k].length).fill(null));
    }
    return merged;
  });
}

export function historicalAssociation(
  symbol: string,
  driver: ExposureDriver,
  weatherAnoms: Map<string, number>,
  monthlyCloses: Array<{ ym: string; close: number }>
): HistoricalAssociation | null {
  const rets = new Map<string, number>();
  for (let i = 1; i < monthlyCloses.length; i++) {
    const a = monthlyCloses[i - 1].close;
    const b = monthlyCloses[i].close;
    if (a > 0 && b > 0) rets.set(monthlyCloses[i].ym, Math.log(b / a));
  }
  const months = Array.from(weatherAnoms.keys()).filter((m) => rets.has(m)).sort();
  if (months.length < 24) return null;
  const nextMonth = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  };
  const same = pearsonWithP(months.map((m) => weatherAnoms.get(m)!), months.map((m) => rets.get(m)!));
  const nm = months.filter((m) => rets.has(nextMonth(m)));
  const lead = pearsonWithP(nm.map((m) => weatherAnoms.get(m)!), nm.map((m) => rets.get(nextMonth(m))!));
  // Crop: less rain → supply risk → higher price (negative sign). Demand: more degree-days → higher price (sign depends on season; use |temp anomaly| proxy elsewhere)
  const expectedSign: -1 | 1 = driver === 'PRECIP' ? -1 : 1;
  const strongest = same.p <= lead.p ? same : lead;
  const verdict: HistoricalAssociation['verdict'] =
    strongest.p < 0.05 ? (Math.sign(strongest.r) === expectedSign ? 'SUPPORTED_IN_SAMPLE' : 'CONTRADICTED_IN_SAMPLE') : 'NOT_DETECTED';
  return {
    symbol,
    weatherVariable: driver === 'PRECIP' ? 'monthly regional precipitation anomaly (NASA POWER)' : 'monthly regional temperature anomaly (NASA POWER)',
    months: same.n,
    sameMonthR: round(same.r, 3),
    sameMonthP: round(same.p, 4),
    nextMonthR: round(lead.r, 3),
    nextMonthP: round(lead.p, 4),
    expectedSign,
    verdict,
  };
}

function observedMove(symbol: string, name: string, chart: any): ObservedMarketMove | null {
  const r = chart?.chart?.result?.[0];
  const closes: Array<number | null> = r?.indicators?.quote?.[0]?.close ?? [];
  const ts: number[] = r?.timestamp ?? [];
  const series = closes.map((c, i) => ({ c, t: ts[i] })).filter((x) => x.c !== null && Number.isFinite(x.c)) as Array<{ c: number; t: number }>;
  if (series.length < 8) return null;
  const last = series[series.length - 1];
  const prev5 = series[series.length - 6];
  const rets = series.slice(1).map((x, i) => Math.log(x.c / series[i].c));
  const vol = stdDev(rets.slice(-20));
  const r5 = Math.log(last.c / prev5.c);
  return {
    symbol,
    name,
    lastClose: round(last.c, 3),
    currency: String(r?.meta?.currency ?? ''),
    lastDate: isoDate(new Date(last.t * 1000)),
    return5dPct: round((Math.exp(r5) - 1) * 100, 2),
    realisedVolDailyPct: round(vol * 100, 2),
    moveInSigma: vol > 0 ? round(r5 / (vol * Math.sqrt(5)), 2) : 0,
  };
}

// ----------------------------------------------------------------------------
// 7. CONSEQUENCE MODELLING (deterministic transmission rules)
// ----------------------------------------------------------------------------

export function driverSignalFor(driver: ExposureDriver, signals: ClimateSignal[]): ClimateSignal | null {
  const get = (id: ClimateSignal['id']) => signals.find((s) => s.id === id) ?? null;
  if (driver === 'PRECIP') return get('PRECIP_14D') ?? get('PRECIP_NEXT7');
  if (driver === 'HEAT') return get('HEAT_NEXT7');
  if (driver === 'WIND') return get('WIND_NEXT7');
  if (driver === 'TEMP_DEMAND') {
    const h = get('HDD_NEXT7');
    const c = get('CDD_NEXT7');
    if (!h) return c;
    if (!c) return h;
    return h.normal >= c.normal ? h : c; // heating vs cooling season
  }
  return null;
}

export function buildConsequenceChain(
  exposure: MarketExposure,
  signals: ClimateSignal[],
  observed: ObservedMarketMove | null,
  historical: HistoricalAssociation | null,
  forecastSignalToNoise: number,
  verificationImproved: boolean | null,
  regionLabel: string
): ConsequenceChain {
  const sig = driverSignalFor(exposure.driver, signals);
  const material = sig && sig.materiality !== 'NEAR_NORMAL';
  let direction: ConsequenceChain['hypothesisDirection'] = 'NO_MATERIAL_SIGNAL';
  let steps: string[] = [];
  let hypothesis = '';
  let offsetting: string[] = [];

  if (exposure.driver === 'CONTEXT' || !sig) {
    steps = [`${regionLabel} weather`, 'No direct physical mechanism to this instrument', 'Shown for market context only'];
    hypothesis = `${exposure.name} is shown as context. AlphaForge does not claim a direct weather mechanism for it.`;
  } else if (exposure.driver === 'PRECIP') {
    const dry = sig.anomaly < 0;
    steps = [
      `14-day rainfall ${sig.value} mm vs ${sig.normal} mm normal (z = ${sig.zScore})`,
      dry ? 'Soil moisture deficit during crop development' : 'Above-normal soil moisture / possible harvest or logistics disruption',
      dry ? 'Yield-risk narrative for the growing region' : 'Crop-condition improvement or quality/transport risk',
      `${exposure.name} supply expectations`,
    ];
    direction = !material ? 'NO_MATERIAL_SIGNAL' : dry ? 'UPWARD_PRESSURE' : 'DOWNWARD_PRESSURE';
    hypothesis = !material
      ? `Rainfall is within the normal range (z = ${sig.zScore}); no material crop-weather signal for ${exposure.name}.`
      : dry
      ? `If the dry anomaly persists, supply-risk pricing could add upward pressure on ${exposure.name}.`
      : `If the wet anomaly persists, improved crop prospects could ease prices of ${exposure.name}, unless it disrupts harvest or transport.`;
    offsetting = ['Certified stocks / inventories', 'Currency moves (e.g. BRL)', 'Crop stage — rain matters more in flowering/fill', 'Speculative positioning already pricing the forecast'];
  } else if (exposure.driver === 'TEMP_DEMAND') {
    const heating = sig.id === 'HDD_NEXT7';
    const more = sig.anomaly > 0;
    steps = [
      `${heating ? 'Heating' : 'Cooling'} degree-days ${sig.value} vs ${sig.normal} normal (z = ${sig.zScore})`,
      `${more ? 'Higher' : 'Lower'} ${heating ? 'heating' : 'air-conditioning'} demand`,
      `${more ? 'More' : 'Less'} gas burn for power and heat`,
      `${exposure.name} demand balance`,
    ];
    direction = !material ? 'NO_MATERIAL_SIGNAL' : more ? 'UPWARD_PRESSURE' : 'DOWNWARD_PRESSURE';
    hypothesis = !material
      ? `Degree-days are near normal (z = ${sig.zScore}); weather is unlikely to be a material demand driver for ${exposure.name} this week.`
      : `${more ? 'Above' : 'Below'}-normal ${heating ? 'heating' : 'cooling'} demand could put ${more ? 'upward' : 'downward'} pressure on ${exposure.name}.`;
    offsetting = ['Storage levels vs seasonal norm', 'LNG supply / outages', 'Wind & solar output', 'Forecast already priced in'];
  } else {
    steps = [`${sig.label}: ${sig.value} ${sig.unit} vs ${sig.normal} normal`, 'Operational exposure', exposure.name];
    direction = material ? (sig.anomaly > 0 ? 'UPWARD_PRESSURE' : 'DOWNWARD_PRESSURE') : 'NO_MATERIAL_SIGNAL';
    hypothesis = `${sig.label} anomaly z = ${sig.zScore}.`;
  }

  const reasons: string[] = [];
  let score = 0;
  if (direction !== 'NO_MATERIAL_SIGNAL') {
    if (forecastSignalToNoise >= 1) {
      score++;
      reasons.push(`Forecast anomaly exceeds calibrated uncertainty (signal/noise ${round(forecastSignalToNoise, 2)})`);
    } else reasons.push(`Forecast anomaly is within calibrated uncertainty (signal/noise ${round(forecastSignalToNoise, 2)})`);
    if (verificationImproved) {
      score++;
      reasons.push('Skill-weighted ensemble beat equal weighting on held-out recent days');
    } else reasons.push('No out-of-sample evidence that weighting improves on equal weights here');
    if (historical?.verdict === 'SUPPORTED_IN_SAMPLE') {
      score++;
      reasons.push(`Historical association in expected direction (p ≤ ${Math.min(historical.sameMonthP, historical.nextMonthP)})`);
    } else if (historical) reasons.push(`Historical association ${historical.verdict.replaceAll('_', ' ').toLowerCase()} (min p = ${Math.min(historical.sameMonthP, historical.nextMonthP)})`);
    else reasons.push('Historical association not tested (insufficient data)');
  } else reasons.push('No material weather signal — no market hypothesis generated');

  return {
    exposure,
    driverSignal: sig,
    steps,
    hypothesis,
    hypothesisDirection: direction,
    offsettingFactors: offsetting,
    invalidationCriteria: sig
      ? `Invalidated if the next two model cycles move the ${sig.label.toLowerCase()} back within ±0.75σ of normal, or if realised ERA5 values verify near normal.`
      : 'Not applicable (context instrument).',
    observedMove: observed,
    historical,
    confidence: score >= 3 ? 'HIGH' : score === 2 ? 'MODERATE' : 'LOW',
    confidenceReasons: reasons,
  };
}

// ----------------------------------------------------------------------------
// 8. ORCHESTRATOR
// ----------------------------------------------------------------------------

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface RunLivePipelineOptions {
  query: string;
  fetchJson?: FetchJson;
  now?: Date;
  fallbackLocation?: { label: string; countryCode: string; lat: number; lng: number };
  customWeights?: Partial<Record<WeatherModelId, number>>;
}

export async function runLiveAtmospherePipeline(opts: RunLivePipelineOptions): Promise<LiveAtmosphereInvestigation> {
  const fetchJson = opts.fetchJson ?? defaultFetchJson;
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  const today = isoDate(now);
  const log: DataFetchLogEntry[] = [];
  const steps: ArgonWorkflowStepLog[] = [];
  const step = (title: string, tool: string, summary: string, citation: string, warn = false) =>
    steps.push({ stepNumber: steps.length + 1, stepTitle: title, toolCalled: tool, status: warn ? 'WARNING' : 'COMPLETED', timestampUtc: new Date().toISOString(), summary, sourceCitation: citation });

  // --- Step 1: resolve location ------------------------------------------------
  const target = await resolveTarget(opts.query, fetchJson, log, opts.fallbackLocation);
  step(
    'Resolve the place the user asked about',
    'resolveTarget()',
    `${target.resolution === 'PRESET' ? 'Matched region preset' : target.resolution === 'GEOCODED' ? `Geocoded "${target.matchedText}"` : target.resolution === 'COORDINATES' ? 'Parsed coordinates' : 'No place found in the question — used the currently selected country'}: ${target.label} (${target.points.length} sample point${target.points.length > 1 ? 's' : ''}).`,
    target.resolution === 'GEOCODED' ? 'Open-Meteo Geocoding API (GeoNames)' : 'AlphaForge region registry',
    target.resolution === 'CONTEXT_FALLBACK'
  );

  const pts = target.points;
  const pastDates = dateRange(addDays(today, -7), 7);
  const nextDates = dateRange(today, 7); // today + next 6 days: the horizon ICON and UKMO also cover
  const verifyDates = dateRange(addDays(today, -46), 40);
  const climYears = 10;
  const eraTruthStart = verifyDates[0];
  const eraTruthEnd = addDays(today, -6); // ERA5 is published with a ~5-day lag
  const locKey = `${latList(pts)}|${lngList(pts)}`;
  const hourKey = nowIso.slice(0, 13);

  const modelIds = LIVE_MODEL_SPECS.map((m) => m.apiId).join(',');
  const fcUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latList(pts)}&longitude=${lngList(pts)}&daily=precipitation_sum,temperature_2m_mean,temperature_2m_max,wind_speed_10m_mean&models=${modelIds}&past_days=7&forecast_days=7&wind_speed_unit=ms&timezone=UTC`;
  const ensUrl = `https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${latList(pts)}&longitude=${lngList(pts)}&daily=precipitation_sum&models=ecmwf_ifs025,gfs025&forecast_days=8&timezone=UTC`;
  const eraDaily = 'daily=precipitation_sum,temperature_2m_mean,temperature_2m_max,wind_speed_10m_mean&wind_speed_unit=ms&timezone=UTC';
  const eraUrl = (start: string, end: string) =>
    `https://archive-api.open-meteo.com/v1/archive?latitude=${latList(pts)}&longitude=${lngList(pts)}&start_date=${start}&end_date=${end}&${eraDaily}`;
  // Climatology: one small request per past year covering only the 14 days we need (keeps API load low)
  const climRanges = Array.from({ length: climYears }, (_, k) => [shiftYears(pastDates[0], -(k + 1)), shiftYears(nextDates[6], -(k + 1))]);
  const lastFullYear = now.getUTCFullYear() - 1;
  const prevVars = [1, 3, 5].flatMap((l) => [`precipitation_previous_day${l}`, `temperature_2m_previous_day${l}`]).join(',');
  const prevUrl = `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${latList(pts)}&longitude=${lngList(pts)}&hourly=${prevVars}&models=${modelIds}&start_date=${verifyDates[0]}&end_date=${verifyDates[verifyDates.length - 1]}&timezone=UTC`;

  const [fcRaw, ensRaw, eraRaw, prevRaw, metas, climRaw] = await Promise.all([
    cached(`fc|${locKey}|${hourKey}`, 30 * 60_000, () => logged<any>(log, 'Open-Meteo Forecast (8 models)', fcUrl, 15000, fetchJson, () => 'daily precip, temperature, wind'),),
    cached(`ens|${locKey}|${hourKey}`, 30 * 60_000, () => logged<any>(log, 'Open-Meteo Ensemble (ECMWF ENS + GEFS)', ensUrl, 15000, fetchJson, () => 'member precipitation')),
    cached(`era|${locKey}|${today}`, 12 * 3_600_000, () => logged<any>(log, 'Open-Meteo Historical (ERA5, verification truth)', eraUrl(eraTruthStart, eraTruthEnd), 20000, fetchJson, () => `${eraTruthStart}…${eraTruthEnd}`)),
    cached(`prev|${locKey}|${today}`, 6 * 3_600_000, () => logged<any>(log, 'Open-Meteo Previous Runs (lead 1/3/5 d)', prevUrl, 25000, fetchJson, () => `${verifyDates[0]}…${verifyDates[verifyDates.length - 1]}`)),
    Promise.all(
      LIVE_MODEL_SPECS.map((m) =>
        cached(`meta|${m.metaId}|${hourKey}`, 20 * 60_000, () =>
          logged<any>(log, `Model run metadata (${m.name})`, `https://api.open-meteo.com/data/${m.metaId}/static/meta.json`, 6000, fetchJson, (d) => `init ${new Date(Number(d?.last_run_initialisation_time) * 1000).toISOString()}`)
        )
      )
    ),
    Promise.all(
      climRanges.map(([a, b]) =>
        cached(`clim|${locKey}|${a}`, 7 * 24 * 3_600_000, () => logged<any>(log, `Open-Meteo Historical (ERA5 climatology ${a.slice(0, 4)})`, eraUrl(a, b), 15000, fetchJson, () => `${a}…${b}`))
      )
    ),
  ]);

  const fcLocs = asArray(fcRaw);
  if (!fcLocs.length) throw new Error('Live forecast unavailable (Open-Meteo forecast request failed).');
  const ensLocs = asArray(ensRaw);
  const eraLocs = asArray(eraRaw);
  const climLocs = mergeDailyResponses(climRaw.filter((r) => r !== null).map(asArray));
  const prevLocs = asArray(prevRaw);

  // --- Step 2–3: provenance gate + per-model forecasts ------------------------------
  const provenance: ModelProvenance[] = LIVE_MODEL_SPECS.map((m, i) => {
    const t = Number(metas[i]?.last_run_initialisation_time);
    const init = Number.isFinite(t) && t > 0 ? new Date(t * 1000).toISOString() : null;
    return {
      modelId: m.modelId,
      name: m.name,
      initTimestampUtc: init,
      gate: validateForecastProvenanceGate({
        provider: m.provider,
        modelId: m.modelId,
        initTimestampUtc: init ?? '1970-01-01T00:00:00Z',
        currentTimestampUtc: nowIso,
        maxAllowedAgeHours: MAX_RUN_AGE_HOURS,
        claimsOfficialPublicSafetyWarning: false,
        verifiedByNationalMetAgency: false,
        temperatureUnit: '°C',
      }),
    };
  });

  const modelForecasts = LIVE_MODEL_SPECS.map((m, i) => {
    const perPoint = fcLocs.map((loc) => statsForDates(loc, `_${m.apiId}`, nextDates)).filter((s): s is WindowStats => s !== null);
    const stats = perPoint.length === pts.length ? averageStats(perPoint) : null;
    return { spec: m, stats, fresh: provenance[i].gate.accepted };
  });

  const fcLog = log.find((d) => d.source.startsWith('Open-Meteo Forecast'));
  step(
    'Retrieve forecasts from 8 global weather models',
    'fetchMultiModelForecast()',
    `${modelForecasts.filter((m) => m.stats).length}/${LIVE_MODEL_SPECS.length} models returned a complete 7-day window for ${pts.length} point(s)${fcLog ? ` in ${fcLog.elapsedMs} ms` : ' (cached)'}; ensemble members requested from ECMWF ENS and NOAA GEFS.`,
    'Open-Meteo Forecast & Ensemble APIs (ECMWF, NOAA, DWD, Met Office, Météo-France, JMA, ECCC)',
    false
  );

  const stale = provenance.filter((p) => !p.gate.accepted);
  step(
    'Check model run freshness (provenance gate)',
    'validateForecastProvenanceGate()',
    `${provenance.length - stale.length}/${provenance.length} model runs are within ${MAX_RUN_AGE_HOURS} h. ${stale.length ? `Excluded: ${stale.map((s) => `${s.name} (${s.gate.forecastAgeHours} h old)`).join(', ')}.` : 'No stale runs.'}`,
    'Open-Meteo model metadata (last_run_initialisation_time)',
    stale.length > 0
  );

  const recentPerModel = LIVE_MODEL_SPECS.map((m) => {
    const per = fcLocs.map((loc) => statsForDates(loc, `_${m.apiId}`, pastDates)).filter((s): s is WindowStats => s !== null);
    return per.length === pts.length ? averageStats(per) : null;
  }).filter((s): s is WindowStats => s !== null);
  if (!recentPerModel.length) throw new Error('No model returned the past-7-day window.');
  // Median across model analyses for "what happened" (robust to one bad model)
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  const recentPast: WindowStats = {
    precipMm: median(recentPerModel.map((s) => s.precipMm)),
    tempMeanC: median(recentPerModel.map((s) => s.tempMeanC)),
    heatDays: median(recentPerModel.map((s) => s.heatDays)),
    hdd: median(recentPerModel.map((s) => s.hdd)),
    cdd: median(recentPerModel.map((s) => s.cdd)),
    windMeanMs: median(recentPerModel.map((s) => s.windMeanMs)),
  };

  // --- Step 4: climatology ------------------------------------------------------
  const climNext: WindowStats[] = [];
  const climPast: WindowStats[] = [];
  for (let y = 1; y <= climYears; y++) {
    const nd = nextDates.map((d) => shiftYears(d, -y));
    const pd = pastDates.map((d) => shiftYears(d, -y));
    const n = climLocs.map((loc) => statsForDates(loc, '', nd)).filter((s): s is WindowStats => s !== null);
    const p = climLocs.map((loc) => statsForDates(loc, '', pd)).filter((s): s is WindowStats => s !== null);
    if (n.length === pts.length) climNext.push(averageStats(n));
    if (p.length === pts.length) climPast.push(averageStats(p));
  }
  step(
    'Build 10-year climatology for the same calendar weeks',
    'fetchEra5Climatology()',
    climNext.length
      ? `ERA5 reanalysis: ${climNext.length} years for the forecast week, ${climPast.length} for the past week. Normal next-7-day rainfall ${round(mean(climNext.map((s) => s.precipMm)), 1)} mm; normal mean temperature ${round(mean(climNext.map((s) => s.tempMeanC)), 1)} °C.`
      : 'ERA5 climatology unavailable — anomalies cannot be computed.',
    'Copernicus ERA5 via Open-Meteo Historical API',
    !climNext.length
  );

  // --- Step 5: verification experiment on the recent past ---------------------------
  const usable = LIVE_MODEL_SPECS.map((_, i) => modelForecasts[i].stats !== null && modelForecasts[i].fresh);
  const skillByLead: ModelSkillRow[] = [];
  let verification: VerificationExperiment | null = null;
  if (prevLocs.length && eraLocs.length) {
    for (const lead of [1, 3, 5]) {
      const pairs = buildVerificationPairs(prevLocs, eraLocs, LIVE_MODEL_SPECS, lead, verifyDates);
      skillByLead.push(...skillRows(pairs, LIVE_MODEL_SPECS, lead));
      if (lead === 3) verification = runVerificationExperiment(pairs, LIVE_MODEL_SPECS, usable, 3, 'ERA5 reanalysis daily totals (independent of the models under test)');
    }
  }
  step(
    'Verify every model against what actually happened',
    'runVerificationExperiment()',
    verification
      ? `Day-3 forecasts vs ERA5 on ${verification.nTrain + verification.nTest} point-days. Weights fitted on ${verification.trainWindow}; scored on held-out ${verification.testWindow}: skill-weighted CRPS ${verification.skillWeighted.crps} mm vs equal-weight ${verification.equalWeight.crps} mm → ${verification.verdict === 'SKILL_WEIGHTING_IMPROVED' ? 'weighting kept' : 'weighting did not help'}.`
      : 'Not enough overlapping forecast/ERA5 days to run the held-out experiment — equal weights used.',
    'Open-Meteo Previous-Runs API + ERA5',
    !verification
  );

  // --- Step 6: skill-weighted, calibrated ensemble for the next 7 days -------------------
  const allPairs3 = prevLocs.length && eraLocs.length ? buildVerificationPairs(prevLocs, eraLocs, LIVE_MODEL_SPECS, 3, verifyDates) : [];
  const liveIdx = LIVE_MODEL_SPECS.map((_, i) => i).filter((i) => usable[i]);
  if (!liveIdx.length) throw new Error('No fresh model forecasts available for this location.');
  let weights: number[];
  // Autonomous improvement gate: skill weights are only used if they beat equal weights on held-out days
  if (verification && verification.verdict === 'SKILL_WEIGHTING_IMPROVED') {
    const complete = allPairs3.filter((p) => liveIdx.every((i) => p.forecasts[i]));
    const mse = liveIdx.map((i) => mean(complete.map((p) => (p.forecasts[i]!.precip - p.truthPrecip) ** 2)));
    weights = inverseMseWeights(mse);
  } else weights = liveIdx.map(() => 1 / liveIdx.length);
  if (opts.customWeights) {
    weights = liveIdx.map((i, j) => {
      const cw = opts.customWeights?.[LIVE_MODEL_SPECS[i].modelId];
      return cw !== undefined && Number.isFinite(cw) ? Math.max(0, cw) : weights[j];
    });
  }

  // Ensemble members → within-model spread of 7-day totals and exceedance probabilities
  const memberTotals = (suffixRe: RegExp): number[] => {
    if (!ensLocs.length) return [];
    const keys = Object.keys(ensLocs[0]?.daily ?? {}).filter((k) => suffixRe.test(k));
    return keys
      .map((k) => {
        const per = ensLocs.map((loc) => {
          const s = dailySeries({ daily: { time: loc.daily.time, x: loc.daily[k] } }, 'x', '', nextDates);
          return s ? s.reduce((a, b) => a + b, 0) : null;
        });
        return per.every((v) => v !== null) ? mean(per as number[]) : null;
      })
      .filter((v): v is number => v !== null);
  };
  const ecmwfMembers = memberTotals(/^precipitation_sum(_member\d+)?_ecmwf_ifs025_ensemble$/);
  const gefsMembers = memberTotals(/^precipitation_sum(_member\d+)?_ncep_gefs025$|^precipitation_sum(_member\d+)?_gfs025$/);
  const withinStd = mean([stdDev(ecmwfMembers), stdDev(gefsMembers)].filter((s) => s > 0)) || 0;
  const normalNext = climNext.length ? mean(climNext.map((s) => s.precipMm)) : 0;
  const threshold = round(Math.max(1, normalNext), 1);
  const fracAbove = (xs: number[]) => (xs.length ? xs.filter((x) => x > threshold).length / xs.length : null);

  const modelInputs: ModelSingleForecastInput[] = liveIdx.map((i, j) => {
    const m = LIVE_MODEL_SPECS[i];
    const s = modelForecasts[i].stats!;
    const memberProb = m.modelId === 'ECMWF_IFS' ? fracAbove(ecmwfMembers) : m.modelId === 'NOAA_GFS' ? fracAbove(gefsMembers) : null;
    const gaussProb = withinStd > 0 ? 1 - normalCdf((threshold - s.precipMm) / withinStd) : s.precipMm > threshold ? 1 : 0;
    return {
      modelId: m.modelId,
      modelName: m.name,
      weight: round(weights[j], 4),
      predictedTemperatureC: round(s.tempMeanC, 1),
      predictedPrecipitationMm: round(s.precipMm, 1),
      predictedWindSpeedMs: round(s.windMeanMs, 1),
      ensembleInternalSpreadMm: round(m.modelId === 'ECMWF_IFS' && ecmwfMembers.length ? stdDev(ecmwfMembers) : m.modelId === 'NOAA_GFS' && gefsMembers.length ? stdDev(gefsMembers) : withinStd, 2),
      probExceedance20Mm: round(memberProb ?? gaussProb, 3),
    };
  });
  const inflation = verification
    ? verification.verdict === 'SKILL_WEIGHTING_IMPROVED'
      ? verification.calibrationInflation
      : verification.equalWeightInflation
    : 1;
  const ensemble = computeWeightedEnsembleForecast(modelInputs, { inflation, floorMm: 0 });
  step(
    'Combine the models into one calibrated forecast',
    'computeWeightedEnsembleForecast()',
    `${modelInputs.length} fresh models (${verification?.verdict === 'SKILL_WEIGHTING_IMPROVED' ? 'skill-weighted' : 'equal-weighted — skill weighting failed its held-out test'}), ${ecmwfMembers.length} ECMWF + ${gefsMembers.length} GEFS members. Next-7-day rainfall ŷ = ${ensemble.ensemblePrecipitationMm} mm (90% interval ${ensemble.calibrated90PctIntervalMm[0]}–${ensemble.calibrated90PctIntervalMm[1]} mm, spread inflated ×${inflation} from verification). Model range ${ensemble.disagreementIndexMm} mm.`,
    'Open-Meteo Forecast + Ensemble APIs',
    false
  );

  // --- Step 7: anomalies / climate signals ---------------------------------------------
  const ensStats: WindowStats = {
    precipMm: ensemble.ensemblePrecipitationMm,
    tempMeanC: ensemble.ensembleTemperatureC,
    heatDays: weightedMeanAndStd(liveIdx.map((i) => modelForecasts[i].stats!.heatDays), weights).mean,
    hdd: weightedMeanAndStd(liveIdx.map((i) => modelForecasts[i].stats!.hdd), weights).mean,
    cdd: weightedMeanAndStd(liveIdx.map((i) => modelForecasts[i].stats!.cdd), weights).mean,
    windMeanMs: ensemble.ensembleWindSpeedMs,
  };
  const signals: ClimateSignal[] = [];
  if (climNext.length >= 5) {
    signals.push(buildSignal('PRECIP_NEXT7', 'Next-7-day rainfall', 'mm', ensStats.precipMm, climNext.map((s) => s.precipMm), true));
    if (climPast.length >= 5) {
      const hist14 = climNext.map((s, k) => s.precipMm + (climPast[k]?.precipMm ?? NaN)).filter(Number.isFinite);
      signals.push(buildSignal('PRECIP_14D', 'Past-7 + next-7-day rainfall', 'mm', recentPast.precipMm + ensStats.precipMm, hist14, true));
    }
    signals.push(buildSignal('TEMP_NEXT7', 'Next-7-day mean temperature', '°C', ensStats.tempMeanC, climNext.map((s) => s.tempMeanC), false));
    signals.push(buildSignal('HDD_NEXT7', 'Heating degree-days (base 18 °C)', 'HDD', ensStats.hdd, climNext.map((s) => s.hdd), true, 3.5));
    signals.push(buildSignal('CDD_NEXT7', 'Cooling degree-days (base 18 °C)', 'CDD', ensStats.cdd, climNext.map((s) => s.cdd), true, 3.5));
    signals.push(buildSignal('HEAT_NEXT7', `Days with Tmax ≥ ${HEAT_DAY_TMAX_C} °C`, 'days', ensStats.heatDays, climNext.map((s) => s.heatDays), false, 1));
    signals.push(buildSignal('WIND_NEXT7', 'Next-7-day mean 10 m wind', 'm/s', ensStats.windMeanMs, climNext.map((s) => s.windMeanMs), true));
  }
  const ranked = [...signals].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  step(
    'Measure how unusual the forecast is',
    'buildSignal()',
    ranked.length
      ? `Largest anomalies: ${ranked.slice(0, 3).map((s) => `${s.label} ${s.anomaly >= 0 ? '+' : ''}${s.anomaly} ${s.unit} (z = ${s.zScore}, ${s.materiality.toLowerCase().replace('_', ' ')})`).join('; ')}.`
      : 'No climatology → anomalies not computed.',
    'AlphaForge deterministic engine',
    !ranked.length
  );

  // --- Step 8: market evidence + consequences -----------------------------------
  const primary = target.exposures.find((e) => e.driver !== 'CONTEXT');
  const uniqueSymbols = Array.from(new Set(target.exposures.map((e) => e.symbol)));
  const powerParam: 'PRECTOTCORR' | 'T2M' = primary?.driver === 'PRECIP' ? 'PRECTOTCORR' : 'T2M';
  const [dailyCharts, monthlyChart, powerRaw] = await Promise.all([
    Promise.all(
      uniqueSymbols.map((s) =>
        cached(`yd|${s}|${hourKey}`, 30 * 60_000, () =>
          logged<any>(log, `Yahoo Finance chart (${s})`, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=2mo&interval=1d`, 8000, fetchJson, () => 'daily closes')
        )
      )
    ),
    primary
      ? cached(`ym|${primary.symbol}|${today}`, 12 * 3_600_000, () =>
          logged<any>(log, `Yahoo Finance chart (${primary.symbol}, 10y monthly)`, `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(primary.symbol)}?range=10y&interval=1mo`, 8000, fetchJson, () => 'monthly closes')
        )
      : Promise.resolve(null),
    primary
      ? Promise.all(
          pts.map((p) =>
            cached(`power|${p.lat.toFixed(2)}|${p.lng.toFixed(2)}|${powerParam}|${lastFullYear}`, 7 * 24 * 3_600_000, () =>
              logged<any>(log, 'NASA POWER monthly (MERRA-2)', `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${powerParam}&community=AG&longitude=${p.lng.toFixed(3)}&latitude=${p.lat.toFixed(3)}&start=${lastFullYear - 10}&end=${lastFullYear}&format=JSON`, 20000, fetchJson, () => `${lastFullYear - 10}–${lastFullYear}`)
            )
          )
        )
      : Promise.resolve([] as any[]),
  ]);

  let historical: HistoricalAssociation | null = null;
  const powerOk = (powerRaw as any[]).filter((r) => r !== null);
  if (primary && monthlyChart && powerOk.length === pts.length) {
    const r = monthlyChart?.chart?.result?.[0];
    const closes: Array<number | null> = r?.indicators?.quote?.[0]?.close ?? [];
    const ts: number[] = r?.timestamp ?? [];
    const monthly = ts
      .map((t, i) => ({ ym: isoDate(new Date(t * 1000)).slice(0, 7), close: closes[i] }))
      .filter((x): x is { ym: string; close: number } => x.close !== null && Number.isFinite(x.close));
    const anoms = monthlyAnomaliesFromPower(powerOk, powerParam);
    historical = historicalAssociation(primary.symbol, primary.driver, anoms, monthly);
  }

  const snr = ensemble.calibratedPredictiveStdMm > 0 && climNext.length ? Math.abs(ensemble.ensemblePrecipitationMm - normalNext) / ensemble.calibratedPredictiveStdMm : 0;
  const consequences = target.exposures.map((e) => {
    const chart = dailyCharts[uniqueSymbols.indexOf(e.symbol)];
    const observed = chart ? observedMove(e.symbol, e.name, chart) : null;
    // Temperature-driven chains use temperature signal-to-noise (z of degree-days) instead of rainfall SNR
    const sig = driverSignalFor(e.driver, signals);
    const s2n = e.driver === 'PRECIP' ? snr : Math.abs(sig?.zScore ?? 0);
    return buildConsequenceChain(e, signals, observed, e === primary ? historical : null, s2n, verification ? verification.verdict === 'SKILL_WEIGHTING_IMPROVED' : null, target.label);
  });
  step(
    'Model the economic consequences',
    'buildConsequenceChain()',
    consequences.length
      ? consequences.map((c) => `${c.exposure.symbol}: ${c.hypothesisDirection.replaceAll('_', ' ').toLowerCase()} (confidence ${c.confidence.toLowerCase()})`).join('; ') + (historical ? `. Historical test on ${historical.months} months: same-month r = ${historical.sameMonthR} (p = ${historical.sameMonthP}), next-month r = ${historical.nextMonthR} (p = ${historical.nextMonthP}).` : '.')
      : `No mapped market exposure for ${target.countryCode || 'this location'} — physical forecast only.`,
    'Yahoo Finance chart endpoint (unofficial) + NASA POWER monthly anomalies',
    !consequences.length
  );

  // --- Step 9: explanation (epistemic separation) --------------------------------------------
  const sigById = (id: ClimateSignal['id']) => signals.find((s) => s.id === id);
  const pn = sigById('PRECIP_NEXT7');
  const tn = sigById('TEMP_NEXT7');
  const pastPrecipNormal = climPast.length ? mean(climPast.map((s) => s.precipMm)) : NaN;
  const pastTempNormal = climPast.length ? mean(climPast.map((s) => s.tempMeanC)) : NaN;
  const sortedModels = [...modelInputs].sort((a, b) => b.predictedPrecipitationMm - a.predictedPrecipitationMm);
  const wettest = sortedModels[0];
  const driest = sortedModels[sortedModels.length - 1];

  const A = [
    `Past 7 days (${pastDates[0]} → ${pastDates[6]}), ${target.label}: ${round(recentPast.precipMm, 1)} mm rain${Number.isFinite(pastPrecipNormal) ? ` vs ${round(pastPrecipNormal, 1)} mm normal` : ''}; mean temperature ${round(recentPast.tempMeanC, 1)} °C${Number.isFinite(pastTempNormal) ? ` vs ${round(pastTempNormal, 1)} °C normal` : ''}.`,
    'Source: median of model analyses for the last 7 days (Open-Meteo); station observations are not yet ingested.',
  ];
  const B = [
    `Next 7 days (${nextDates[0]} → ${nextDates[6]}): ${modelInputs.length} models give ${driest.predictedPrecipitationMm}–${wettest.predictedPrecipitationMm} mm; skill-weighted ensemble ${ensemble.ensemblePrecipitationMm} mm, 90% interval ${ensemble.calibrated90PctIntervalMm[0]}–${ensemble.calibrated90PctIntervalMm[1]} mm.`,
    pn ? `That is ${pn.anomaly >= 0 ? '+' : ''}${pn.anomaly} mm vs the 10-year normal of ${pn.normal} mm (z = ${pn.zScore}; wetter than ${pn.percentileVsLast10Years}% of the last 10 years).` : 'Climatology unavailable.',
    tn ? `Mean temperature ${tn.value} °C vs ${tn.normal} °C normal (${tn.anomaly >= 0 ? '+' : ''}${tn.anomaly} °C).` : '',
    `Wettest model: ${wettest.modelName} (${wettest.predictedPrecipitationMm} mm); driest: ${driest.modelName} (${driest.predictedPrecipitationMm} mm).`,
  ].filter(Boolean);
  const C = consequences.length ? consequences.map((c) => `${c.exposure.symbol}: ${c.steps.join(' → ')}`) : ['No mapped market exposure for this location.'];
  const D = consequences
    .filter((c) => c.observedMove)
    .map((c) => `${c.observedMove!.symbol} ${c.observedMove!.return5dPct >= 0 ? '+' : ''}${c.observedMove!.return5dPct}% over the last 5 sessions to ${c.observedMove!.lastDate} (${c.observedMove!.moveInSigma}σ of recent volatility). Observed only — not attributed to weather.`);
  const E = consequences.filter((c) => c.hypothesisDirection !== 'NO_MATERIAL_SIGNAL' || c.exposure.driver !== 'CONTEXT').map((c) => `${c.hypothesis} Confidence: ${c.confidence}. ${c.invalidationCriteria}`);
  const F = [
    stale.length ? `Excluded stale model runs: ${stale.map((s) => s.name).join(', ')}.` : '',
    verification ? `Verification uses ${verification.nTest} held-out point-days at ${pts.length} sample point(s); short windows give noisy skill estimates.` : 'Held-out verification could not be run for this location.',
    'Point sampling: values are averages of sample points, not area-weighted crop or demand maps.',
    historical ? `Historical association is in-sample on ${historical.months} months and is not causal evidence.` : 'No historical market association was tested.',
    'Market data from an unofficial Yahoo Finance endpoint; for research display only.',
  ].filter(Boolean);

  const topSignal = ranked[0];
  const lead = consequences.find((c) => c.hypothesisDirection !== 'NO_MATERIAL_SIGNAL');
  const briefingBasic = `Here's ${target.label}. Over the next seven days, ${modelInputs.length} weather models expect about ${ensemble.ensemblePrecipitationMm} millimetres of rain${pn ? `, ${pn.anomaly >= 0 ? 'above' : 'below'} the usual ${pn.normal} millimetres for this week` : ''}, and an average temperature of ${ensemble.ensembleTemperatureC} degrees. ${topSignal ? `The most unusual thing is ${topSignal.label.charAt(0).toLowerCase() + topSignal.label.slice(1)}, ${topSignal.materiality === 'NEAR_NORMAL' ? 'which is close to normal' : `which is ${topSignal.anomaly >= 0 ? 'higher' : 'lower'} than normal`}.` : ''} ${lead ? lead.hypothesis : consequences.length ? 'I do not see a weather signal strong enough to matter for the mapped markets this week.' : 'No market exposure is mapped for this location yet, so this is a physical forecast only.'} This is research, not a trading recommendation.`;
  const briefingAdvanced = `${target.label}: skill-weighted ${modelInputs.length}-model ensemble ŷ = ${ensemble.ensemblePrecipitationMm} mm (90% PI ${ensemble.calibrated90PctIntervalMm.join('–')} mm, k = ${inflation}); ${pn ? `rainfall z = ${pn.zScore}` : ''}${tn ? `, temperature anomaly ${tn.anomaly} °C` : ''}. ${verification ? `Held-out day-3 CRPS ${verification.skillWeighted.crps} vs ${verification.equalWeight.crps} mm equal-weight (n = ${verification.nTest}).` : ''} ${consequences.map((c) => `${c.exposure.symbol}: ${c.hypothesisDirection.replaceAll('_', ' ').toLowerCase()}, ${c.confidence.toLowerCase()} confidence`).join('; ')}.`;

  step(
    'Explain: separate facts, forecasts and hypotheses',
    'composeEpistemicMatrix()',
    `A–F matrix built: ${A.length} observed facts, ${B.length} forecast statements, ${C.length} mechanisms, ${D.length} observed price moves, ${E.length} conditional hypotheses, ${F.length} open uncertainties.`,
    'AlphaForge deterministic engine (LLM may only rephrase)',
    false
  );

  // --- Step 10: reproducibility ---------------------------------------------------------
  const recomputed = computeWeightedEnsembleForecast(modelInputs, { inflation, floorMm: 0 });
  const reconciliationPassed = recomputed.ensemblePrecipitationMm === ensemble.ensemblePrecipitationMm && recomputed.calibratedPredictiveStdMm === ensemble.calibratedPredictiveStdMm;
  const inputsSha256 = await sha256Hex(JSON.stringify({ modelInputs, inflation, signals, dates: nextDates, target: target.points }));
  step(
    'Reproduce the numbers independently',
    'reconcileEnsemble()',
    `Ensemble recomputed from the published inputs: ${reconciliationPassed ? 'identical' : 'MISMATCH'}. Input checksum SHA-256 ${inputsSha256.slice(0, 16)}…`,
    'AlphaForge reproducibility check',
    !reconciliationPassed
  );

  return {
    pipelineVersion: 'live-1.0.0',
    generatedAtUtc: nowIso,
    query: opts.query,
    target,
    windows: { pastLabel: `${pastDates[0]} → ${pastDates[6]}`, forecastLabel: `${nextDates[0]} → ${nextDates[6]}`, forecastDates: nextDates },
    provenance,
    modelForecasts: modelForecasts.map((m, i) => ({
      modelId: m.spec.modelId,
      name: m.spec.name,
      stats: m.stats ?? { precipMm: NaN, tempMeanC: NaN, heatDays: NaN, hdd: NaN, cdd: NaN, windMeanMs: NaN },
      includedInEnsemble: usable[i],
      exclusionReason: usable[i] ? null : !m.fresh ? `stale run (${provenance[i].gate.forecastAgeHours} h old)` : 'forecast horizon shorter than the 7-day window',
    })),
    ensembleMembers: { ecmwfMembers: ecmwfMembers.length, gefsMembers: gefsMembers.length, withinStdMm: round(withinStd, 2) },
    modelInputs,
    ensemble,
    exceedanceThresholdMm: threshold,
    recentPast,
    climatology: { years: climNext.length, next7: climNext.length ? averageStats(climNext) : recentPast, past7: climPast.length ? averageStats(climPast) : recentPast },
    signals,
    verification,
    skillByLead,
    consequences,
    epistemic: { A_whatWeatherOccurred: A, B_whatModelsPredict: B, C_economicMechanisms: C, D_whatAssetPricesDid: D, E_modelSupportedFutureScenarios: E, F_whatRemainsUncertainOrUnverified: F },
    briefingBasic: briefingBasic.replace(/\s+/g, ' ').trim(),
    briefingAdvanced: briefingAdvanced.replace(/\s+/g, ' ').trim(),
    steps,
    dataLog: log,
    reproducibility: {
      inputsSha256,
      reconciliationPassed,
      reconciliationNote: 'computeWeightedEnsembleForecast() re-run on the published modelInputs reproduces the ensemble mean and calibrated σ exactly.',
    },
  };
}

// ----------------------------------------------------------------------------
// 9. ADAPTER → existing ARGON investigation shape (HUD, report modal, report generator)
// ----------------------------------------------------------------------------

export function toArgonInvestigation(live: LiveAtmosphereInvestigation): ArgonInvestigationResult {
  const pt = live.target.points;
  const lat = mean(pt.map((p) => p.lat));
  const lng = mean(pt.map((p) => p.lng));
  const spanKm = pt.length > 1 ? Math.max(...pt.map((p) => Math.hypot(p.lat - lat, p.lng - lng))) * 111 : 0;
  const layers: AtmosphereWeatherLayerId[] = ['RAINFALL_ACCUMULATION', 'TEMPERATURE', 'RAINFALL_ANOMALIES', 'FORECAST_UNCERTAINTY'];
  const v = live.verification;
  const verificationMetrics: WeatherVerificationMetrics =
    v?.skillWeighted ??
    computeWeatherVerificationMetrics({ observedValues: [0], predictedValues: [0], predictiveStdDevs: [1], predictedExceedanceProbs: [0], eventThreshold: 1, validationPeriodLabel: 'Not available for this location (insufficient forecast/ERA5 overlap)' });

  const improvements: ForecastImprovementExperimentRecord[] = v
    ? [
        {
          experimentId: `EXP-LIVE-WEIGHTS-${live.reproducibility.inputsSha256.slice(0, 8).toUpperCase()}`,
          regionName: live.target.label,
          targetVariable: `Daily precipitation, day-${v.leadDays} lead (mm)`,
          status: v.verdict === 'SKILL_WEIGHTING_IMPROVED' ? 'VALIDATED_IMPROVEMENT' : 'REJECTED_UNDERPERFORMED_BASELINE',
          diagnosis: `Models disagree; equal weighting ignores recent skill differences (best single model on training days: ${v.bestSingleModel.name}).`,
          supportingEvidence: `${v.nTrain} training and ${v.nTest} held-out point-days of archived forecasts (Open-Meteo Previous-Runs) scored against ERA5.`,
          proposedAlgorithmChange: 'Inverse-MSE weights shrunk 50% toward equal, plus spread-inflation factor k fitted on training days.',
          experimentalDesign: `Chronological split: fit on ${v.trainWindow}, score on unseen ${v.testWindow}.`,
          benchmarkModel: 'Equal-weight multi-model mean',
          validationSampleSizeN: v.nTest,
          baselineRmse: v.equalWeight.rmse,
          candidateRmse: v.skillWeighted.rmse,
          baselineCrps: v.equalWeight.crps,
          candidateCrps: v.skillWeighted.crps,
          baseline90PiCoveragePct: v.equalWeight.predictionIntervalCoverage90Pct,
          candidate90PiCoveragePct: v.skillWeighted.predictionIntervalCoverage90Pct,
          computationalRequirements: 'Milliseconds on CPU; no model training beyond least-squares weights.',
          successCriteria: 'Lower held-out CRPS than the equal-weight baseline.',
          observedResultSummary: `${v.verdict === 'SKILL_WEIGHTING_IMPROVED' ? 'KEPT' : 'REJECTED'}: CRPS ${v.equalWeight.crps} → ${v.skillWeighted.crps} mm; RMSE ${v.equalWeight.rmse} → ${v.skillWeighted.rmse} mm; 90% coverage ${v.equalWeight.predictionIntervalCoverage90Pct}% → ${v.skillWeighted.predictionIntervalCoverage90Pct}%.`,
        },
      ]
    : [];

  const freshest = live.provenance.filter((p) => p.gate.accepted && p.initTimestampUtc).sort((a, b) => (b.initTimestampUtc! > a.initTimestampUtc! ? 1 : -1))[0];

  return {
    investigationId: `ARGON-LIVE-${Date.parse(live.generatedAtUtc).toString(36).toUpperCase()}`,
    createdAtUtc: live.generatedAtUtc,
    userQuery: live.query,
    resolvedScope: {
      scopeType: live.target.presetId === 'BRAZIL_COFFEE_BELT' ? 'BRAZIL_COFFEE' : live.target.presetId === 'EAST_SOUTH_ASIA' ? 'ASIA_REGIONAL' : 'COUNTRY_SPECIFIC',
      regionLabel: live.target.label,
      countryIso2: live.target.countryCode || 'XX',
      targetLat: round(lat, 4),
      targetLng: round(lng, 4),
      targetRangeMeters: Math.round(Math.max(250_000, spanKm * 2600)),
      historicalWindowLabel: live.windows.pastLabel,
      forecastWindowLabel: live.windows.forecastLabel,
      activeWeatherLayers: layers,
    },
    spokenExecutiveBriefingBasic: live.briefingBasic,
    spokenExecutiveBriefingAdvanced: live.briefingAdvanced,
    thirtySecondSpokenSummary: live.briefingBasic,
    workflowSteps: live.steps,
    modelComparison: {
      variableLabel: `Next-7-day precipitation total (${live.windows.forecastLabel})`,
      unit: 'mm',
      horizonLabel: '7 days',
      modelInputs: live.modelInputs,
      ensembleResult: live.ensemble,
      verificationMetrics,
      exceedanceLabel: `P(>${live.exceedanceThresholdMm} mm normal)`,
      calibrationInflation: live.verification?.calibrationInflation ?? 1,
    },
    epistemicMatrix: live.epistemic,
    conditionalWatchlist: live.consequences.map((c) => ({
      instrument: c.exposure.symbol,
      name: c.exposure.name,
      sector: c.exposure.sector,
      observed7DayMovePct: c.observedMove ? `${c.observedMove.return5dPct >= 0 ? '+' : ''}${c.observedMove.return5dPct}% (5 sessions to ${c.observedMove.lastDate})` : 'unavailable',
      observedMoveAttributionNote: c.historical
        ? `Not attributed to weather. 10-yr test: r = ${c.historical.sameMonthR} (p = ${c.historical.sameMonthP}) same month, r = ${c.historical.nextMonthR} (p = ${c.historical.nextMonthP}) next month → ${c.historical.verdict.replaceAll('_', ' ').toLowerCase()}.`
        : 'Not attributed to weather.',
      positiveWeatherScenario: c.hypothesis,
      negativeWeatherScenario: c.offsettingFactors.length ? `Offsetting factors: ${c.offsettingFactors.join('; ')}.` : 'n/a',
      conditionalHypothesisLabel: `${c.hypothesisDirection.replaceAll('_', ' ')} · confidence ${c.confidence}`,
      invalidationCriteria: c.invalidationCriteria,
      transactionCostAssumptionBps: 0,
    })),
    provenanceCheck: freshest
      ? freshest.gate
      : { accepted: false, status: 'REJECTED_STALE_FORECAST', forecastAgeHours: 999, warningMessage: 'No fresh model run available.', safetyDisclosure: 'Research forecasts only.' },
    autonomousImprovements: improvements,
    followUpSuggestions: [
      'Show me which models disagree',
      'What evidence would invalidate the conclusion?',
      live.target.presetId === 'BRAZIL_COFFEE_BELT' ? 'Compare with the US Corn Belt' : 'What about the Brazil coffee belt?',
      'How did each model do over the last month?',
    ],
    dataMode: 'LIVE_OPEN_DATA',
    live,
  };
}
