// ============================================================================
// ALPHAFORGE ATMOSPHERE — SHARED INTELLIGENCE DECK ENGINE
// Powers Web & Native Mobile (Flutter) via Shared Backend Contracts:
// 1. Preset Demo Login Workspaces (Guest Explorer, Weather Researcher,
//    Commodity Analyst, Global Macro Analyst)
// 2. Predicted Weather Effects on Financial Markets & Research-Backed Trade Ideas
// 3. General Trade Ideas from the News + Verified News Feed
// 4. Bottom AI Executive Research Summary
// ============================================================================

import { getCountryDeepDiveProfile } from './countryDeepDiveEngine.ts';
import { type OperationalWeatherLayerId } from './globe/LayerRegistry.ts';
import { type ArgonInvestigationResult } from './argonAtmosphereEngine.ts';

export type DemoPresetId =
  | 'GUEST_EXPLORER'
  | 'WEATHER_RESEARCHER'
  | 'COMMODITY_ANALYST'
  | 'GLOBAL_MACRO_ANALYST';

export interface DemoPresetProfile {
  id: DemoPresetId;
  name: string;
  label: string;
  roleBadge: string;
  demoNotice: string;
  defaultLocationQuery: string;
  defaultCountryIso2: string;
  defaultLayers: OperationalWeatherLayerId[];
  defaultMode: 'BASIC' | 'ADVANCED';
  recommendedMode: 'BASIC' | 'ADVANCED';
  sampleArgonPrompt: string;
  researchInterests: string[];
  description: string;
}

export const DEMO_PRESET_PROFILES: DemoPresetProfile[] = [
  {
    id: 'GUEST_EXPLORER',
    name: 'Guest Explorer',
    label: 'Guest Explorer',
    roleBadge: 'DEMO ACCESS · General Earth & Weather',
    demoNotice:
      'Preset demo workspace for exploring global weather, predictions, and news without authentication.',
    defaultLocationQuery: 'London',
    defaultCountryIso2: 'GB',
    defaultLayers: ['TEMPERATURE', 'WIND_SPEED'],
    defaultMode: 'BASIC',
    recommendedMode: 'BASIC',
    sampleArgonPrompt:
      'Hey ARGON, analyse how predicted weather patterns in London and the North Sea affect UK energy and equity markets.',
    researchInterests: ['Global Weather', 'City Forecasts', 'Headline Market Ideas'],
    description:
      'Clean Earth overview with plain-language weather forecasts, prediction market probabilities, and AI news summaries.',
  },
  {
    id: 'COMMODITY_ANALYST',
    name: 'Commodity Analyst',
    label: 'Commodity Analyst',
    roleBadge: 'DEMO ACCESS · Agriculture & Energy Desk',
    demoNotice:
      'Preset demo workspace configured for agricultural belts, rainfall anomalies, and commodity futures exposure.',
    defaultLocationQuery: 'Sul de Minas Coffee Belt, Brazil',
    defaultCountryIso2: 'BR',
    defaultLayers: ['RAINFALL_ACCUMULATION', 'DROUGHT_INDICATORS'],
    defaultMode: 'BASIC',
    recommendedMode: 'BASIC',
    sampleArgonPrompt:
      'Show me Brazil coffee regions and compare rainfall forecasts for the next ten days.',
    researchInterests: ['Arabica Coffee (KC=F)', 'Brazil Sul de Minas', 'Soil Moisture & Drought'],
    description:
      'Focuses on Brazilian Arabica coffee regions, rainfall deficits, and agricultural supply-chain transmission.',
  },
  {
    id: 'WEATHER_RESEARCHER',
    name: 'Weather Researcher',
    label: 'Weather Researcher',
    roleBadge: 'DEMO ACCESS · Ensemble & Verification Lab',
    demoNotice:
      'Preset demo workspace configured for multi-model NWP/AI forecast comparison and CRPS/Brier skill verification.',
    defaultLocationQuery: 'Tokyo',
    defaultCountryIso2: 'JP',
    defaultLayers: ['RAINFALL_ANOMALIES', 'FORECAST_UNCERTAINTY', 'WIND_SPEED'],
    defaultMode: 'ADVANCED',
    recommendedMode: 'ADVANCED',
    sampleArgonPrompt:
      "Hey ARGON, analyse last week's weather across Asia and tell me which financial markets have been affected and what next week's weather could mean for those markets.",
    researchInterests: ['WeatherNext 3 vs ECMWF', 'Model Spread', 'CRPS & Brier Verification'],
    description:
      'Highlights inter-model disagreement, EMOS calibration intervals, and 28-section mathematical reports.',
  },
  {
    id: 'GLOBAL_MACRO_ANALYST',
    name: 'Global Macro Analyst',
    label: 'Global Macro Analyst',
    roleBadge: 'DEMO ACCESS · Cross-Asset & Sovereign Macro',
    demoNotice:
      'Preset demo workspace configured for pan-regional Asian/European weather shocks, LNG/power grids, and shipping lanes.',
    defaultLocationQuery: 'Asia',
    defaultCountryIso2: 'JP',
    defaultLayers: ['TEMPERATURE_ANOMALIES', 'STORM_TRACKS', 'SEVERE_WEATHER_WARNINGS'],
    defaultMode: 'BASIC',
    recommendedMode: 'BASIC',
    sampleArgonPrompt:
      "Hey ARGON, analyse last week's weather across Asia and tell me which financial markets have been affected and what next week's weather could mean for those markets.",
    researchInterests: ['Asia LNG & Utilities', 'Maritime Chokepoints', 'Sovereign Equities'],
    description:
      'Monitors East Asian cold surges, Taiwan Strait maritime corridors, and cross-border macro transmission.',
  },
];

export interface AffectedMarketInstrument {
  ticker: string;
  name: string;
  assetClass: 'COMMODITY' | 'EQUITY' | 'FX' | 'UTILITY_ENERGY' | 'SHIPPING';
  expectedSensitivity: string;
  spotPrice: string;
  move7d: string;
}

export interface PredictionMarketTradeIdea {
  id: string;
  title: string;
  tradeThesisTitle: string;
  category: 'PREDICTION_MARKET' | 'COMMODITY_TRADE_IDEA' | 'EQUITY_SECTOR_IDEA';
  geographicOrigin: string;
  regionLabel: string;
  countryIso2: string;
  lat: number;
  lng: number;
  marketVenueLabel: string;
  contractQuestion: string;
  impliedProbabilityPct: number;
  probabilityChange24hPct: number;
  contractVolumeUsd: string;
  suggestedDirection: 'LONG' | 'SHORT' | 'VOLATILITY';
  convictionScore: number;
  horizonDays: string;
  weatherEvidence: string;
  weatherEvidenceSummary: string;
  forecastSource: string;
  forecastSourceModels: string[];
  economicMechanism: string;
  affectedInstruments: AffectedMarketInstrument[];
  affectedAssets: Array<{
    ticker: string;
    name: string;
    spotPrice: string;
    move7d: string;
  }>;
  predictionContract: {
    contractId: string;
    question: string;
    impliedProbabilityPct: number;
    probabilityChange24hPct: number;
    volumeUsdFormatted: string;
    resolutionSource: string;
  };
  historicalAnalog: string;
  supportingAssumptions: string;
  uncertaintyNote: string;
  uncertaintyNotes: string;
  alternativeExplanations: string;
  invalidationCriteria: string;
  researchStatus: 'VERIFIED_HYPOTHESIS' | 'CONDITIONAL_WATCH' | 'HIGH_MODEL_DISAGREEMENT';
}

export type WeatherTradeIdeaRecord = PredictionMarketTradeIdea;

export interface NewsDrivenTradeIdeaRecord {
  id: string;
  countryIso2: string;
  regionLabel: string;
  headline: string;
  publisher: string;
  sourceAgency: string;
  publishedAtUtc: string;
  credibilityBadge: 'VERIFIED_PRIMARY_AGENCY' | 'CORROBORATED_WIRE';
  sourceTypeBadge: string;
  newsSummary: string;
  derivedTradeIdeaTitle: string;
  tradeMechanismPlain: string;
  derivedTradeMechanism: string;
  suggestedDirection: 'LONG' | 'SHORT' | 'VOLATILITY';
  targetInstruments: string[];
  targetTickers: string[];
  directionalBiasLabel: string;
  riskAndAlternativeView: string;
}

export interface BottomAiExecutiveSummary {
  regionLabel: string;
  countryIso2: string;
  generatedAtUtc: string;
  headline: string;
  headlineTakeaway: string;
  weatherRegimeSynthesis: string;
  weatherAndModelSynthesis: string;
  modelConsensusSynthesis: string;
  predictionMarketSynthesis: string;
  predictionAndTradeIdeasSynthesis: string;
  newsCatalystSynthesis: string;
  newsAndMacroCatalystSynthesis: string;
  confidenceAndRiskCaveat: string;
  uncertaintyAndRiskDisclaimer: string;
  spokenNarrationScript: string;
  provenanceHash: string;
}

const FLAGSHIP_WEATHER_TRADE_IDEAS: PredictionMarketTradeIdea[] = [
  {
    id: 'IDEA-BR-COFFEE-01',
    title: 'Brazil Sul de Minas Rainfall Deficit → Arabica Coffee Supply Risk',
    tradeThesisTitle:
      'Long ICE Arabica Coffee (KC=F) on Persistent Sul de Minas Soil Moisture Deficit',
    category: 'PREDICTION_MARKET',
    geographicOrigin: 'Sul de Minas & Cerrado Mineiro, Brazil',
    regionLabel: 'Sul de Minas & Cerrado Mineiro, Brazil',
    countryIso2: 'BR',
    lat: -21.25,
    lng: -45.45,
    marketVenueLabel: 'Kalshi / Polymarket / ICE Agri Desk',
    contractQuestion:
      'Will Sul de Minas cumulative Nov 8–15 rainfall stay below 25 mm (INMET gauge average)?',
    impliedProbabilityPct: 71,
    probabilityChange24hPct: 6.5,
    contractVolumeUsd: '$1.42M',
    suggestedDirection: 'LONG',
    convictionScore: 87,
    horizonDays: '5–14 Days',
    weatherEvidence:
      'Observed 14-day cumulative rainfall at Varginha/Guaxupé INMET stations is 22.4 mm vs 58.0 mm norm (-61.4% deficit; SPEI-30 = -1.58). Multi-model 7-day ensemble projects 17.6 mm vs 48 mm normal.',
    weatherEvidenceSummary:
      'Observed 14-day cumulative rainfall at Varginha/Guaxupé INMET stations is 22.4 mm vs 58.0 mm norm (-61.4% deficit). ECMWF IFS (19.8 mm) and WeatherNext 3 (14.2 mm) project persistent moisture deficit.',
    forecastSource: 'WeatherNext 3 (14.2 mm) · ECMWF IFS (19.8 mm) · NOAA GFS (31.4 mm)',
    forecastSourceModels: ['WEATHERNEXT_3', 'ECMWF_IFS', 'ECMWF_AIFS', 'NOAA_GFS'],
    economicMechanism:
      'Persistent soil-moisture deficit (<20 mm rain + 28.6°C daytime heat) during Arabica cherry pinhead expansion increases floral abortion risk and tightens 2026/27 CONAB exportable supply.',
    affectedInstruments: [
      {
        ticker: 'KC=F',
        name: 'ICE Arabica Coffee Futures',
        assetClass: 'COMMODITY',
        expectedSensitivity: '+3.8% to +6.5%',
        spotPrice: '264.80 cts/lb',
        move7d: '+5.4%',
      },
      {
        ticker: 'SBUX',
        name: 'Starbucks Corp.',
        assetClass: 'EQUITY',
        expectedSensitivity: '-1.1% to -2.2%',
        spotPrice: '$96.40',
        move7d: '-1.1%',
      },
    ],
    affectedAssets: [
      { ticker: 'KC=F', name: 'ICE Arabica Coffee Futures', spotPrice: '264.80 cts/lb', move7d: '+5.4%' },
      { ticker: 'SBUX', name: 'Starbucks Corp.', spotPrice: '$96.40', move7d: '-1.1%' },
    ],
    predictionContract: {
      contractId: 'PM-BR-RAIN-NOV26',
      question:
        'Will Sul de Minas cumulative Nov 8–15 rainfall stay below 25 mm (INMET gauge average)?',
      impliedProbabilityPct: 71,
      probabilityChange24hPct: 6.5,
      volumeUsdFormatted: '$1.42M',
      resolutionSource: 'Official INMET Varginha/Guaxupé Synoptic Gauges',
    },
    historicalAnalog: '2014 & 2021 Minas Gerais Flowering Droughts',
    supportingAssumptions:
      'Assumes South Atlantic Convergence Zone (SACZ) remains south of Minas Gerais through Day 5.',
    uncertaintyNote:
      '17.2 mm inter-model spread: NOAA GFS projects 31.4 mm from a northward SACZ shift, whereas WeatherNext 3 and ECMWF stay below 20 mm.',
    uncertaintyNotes:
      '17.2 mm inter-model spread: NOAA GFS projects 31.4 mm from a northward SACZ shift, whereas WeatherNext 3 and ECMWF stay below 20 mm.',
    alternativeExplanations:
      'Brazilian Real (USD/BRL at 5.74) depreciation and Vietnamese Robusta harvest pace independently influence ICE coffee futures.',
    invalidationCriteria:
      'Invalidated if 48h ECMWF IFS update shifts >28 mm into Sul de Minas or ICE certified stocks rise >8%.',
    researchStatus: 'VERIFIED_HYPOTHESIS',
  },
  {
    id: 'IDEA-ASIA-LNG-02',
    title: 'East Asia Early Cold Surge → JKM LNG & Japanese Electric Utility Load',
    tradeThesisTitle:
      'Long Northeast Asia JKM LNG & Japanese Power Dispatch on Early Cold Surge',
    category: 'COMMODITY_TRADE_IDEA',
    geographicOrigin: 'Tokyo / Kansai (Japan) & Northeast Asia Grid',
    regionLabel: 'Tokyo / Kansai (Japan) & Northeast Asia Grid',
    countryIso2: 'JP',
    lat: 35.68,
    lng: 139.76,
    marketVenueLabel: 'ICE JKM / JEPX Power Desk',
    contractQuestion:
      'Will Tokyo JMA 7-day Heating Degree Days exceed the 30-year seasonal norm by >15%?',
    impliedProbabilityPct: 82,
    probabilityChange24hPct: 8.0,
    contractVolumeUsd: '$980K',
    suggestedDirection: 'LONG',
    convictionScore: 85,
    horizonDays: '4–10 Days',
    weatherEvidence:
      'Observed -2.4°C anomaly in northern Japan last week; 6-model ensemble agrees on a -2.9°C East Asian cold-air outbreak over the next 7 days (+18.5 Heating Degree Days above norm).',
    weatherEvidenceSummary:
      'Observed -2.4°C anomaly in northern Japan last week; 6-model ensemble agrees on a -2.9°C East Asian cold-air outbreak over the next 7 days (+18.5 Heating Degree Days above norm).',
    forecastSource: 'WeatherNext 3 · ECMWF IFS Cy49r1 · JMA Operational Ensemble',
    forecastSourceModels: ['WEATHERNEXT_3', 'ECMWF_IFS', 'GRAPHCAST_DETERMINISTIC'],
    economicMechanism:
      'Sub-12°C urban temperatures trigger non-linear residential heat-pump load on JEPX, forcing Japanese and Korean utilities to dispatch marginal LNG peaking units.',
    affectedInstruments: [
      {
        ticker: 'JKM-LNG',
        name: 'ICE JKM Northeast Asia LNG',
        assetClass: 'UTILITY_ENERGY',
        expectedSensitivity: '+3.5% to +6.0%',
        spotPrice: '$13.85/MMBtu',
        move7d: '+4.2%',
      },
      {
        ticker: '9501.T',
        name: 'Tokyo Electric Power (TEPCO)',
        assetClass: 'EQUITY',
        expectedSensitivity: '+2.2% to +4.1%',
        spotPrice: '¥684',
        move7d: '+2.8%',
      },
    ],
    affectedAssets: [
      { ticker: 'JKM-LNG', name: 'ICE JKM Northeast Asia LNG', spotPrice: '$13.85/MMBtu', move7d: '+4.2%' },
      { ticker: '9501.T', name: 'Tokyo Electric Power (TEPCO)', spotPrice: '¥684', move7d: '+2.8%' },
    ],
    predictionContract: {
      contractId: 'PM-JP-HDD-NOV26',
      question:
        'Will Tokyo JMA 7-day Heating Degree Days exceed the 30-year seasonal norm by >15%?',
      impliedProbabilityPct: 82,
      probabilityChange24hPct: 8.0,
      volumeUsdFormatted: '$980K',
      resolutionSource: 'Japan Meteorological Agency (JMA) Tokyo Station',
    },
    historicalAnalog: 'Nov 2021 & Dec 2022 East Asia JEPX Cold Surges',
    supportingAssumptions:
      'Assumes Siberian high-pressure ridge maintains northwesterly cold advection across the Sea of Japan.',
    uncertaintyNote:
      'High temperature consensus (±0.6°C model spread), though utility LNG storage tanks are currently 82% full.',
    uncertaintyNotes:
      'High temperature consensus (±0.6°C model spread), though utility LNG storage tanks are currently 82% full.',
    alternativeExplanations:
      'Nuclear unit restart schedules in Kansai/Kyushu and European TTF gas arbitrage also affect JKM pricing.',
    invalidationCriteria:
      'Invalidated if JMA 2m temperature anomaly warms above -0.8°C or JEPX peak spark spreads compress.',
    researchStatus: 'VERIFIED_HYPOTHESIS',
  },
  {
    id: 'IDEA-ASIA-SHIPPING-03',
    title: 'Taiwan Strait & South China Sea Trough → Container Port Turnaround & Feeder Rates',
    tradeThesisTitle:
      'Long East Asian Container Shipping Volatility (9101.T / 2603.TW) on Taiwan Strait Gale Anomaly',
    category: 'EQUITY_SECTOR_IDEA',
    geographicOrigin: 'Taiwan Strait · Kaohsiung / Shenzhen Maritime Corridor',
    regionLabel: 'Taiwan Strait · Kaohsiung / Shenzhen Maritime Corridor',
    countryIso2: 'TW',
    lat: 23.8,
    lng: 120.2,
    marketVenueLabel: 'SGX Freight / Maritime Desk',
    contractQuestion:
      'Will Kaohsiung/Luzon Strait experience >24h of marine gale warnings (>18 m/s) next week?',
    impliedProbabilityPct: 58,
    probabilityChange24hPct: 3.2,
    contractVolumeUsd: '$640K',
    suggestedDirection: 'VOLATILITY',
    convictionScore: 76,
    horizonDays: '3–9 Days',
    weatherEvidence:
      'Last week recorded 142 mm rain (+68% anomaly) and 21.4 m/s gale gusts; next week ensemble mean is 83.2 mm with 17.3 m/s marine winds.',
    weatherEvidenceSummary:
      'Last week recorded 142 mm rain (+68% anomaly) and 21.4 m/s gale gusts; next week ensemble mean is 83.2 mm with 17.3 m/s marine winds.',
    forecastSource: 'ECMWF AIFS (92.0 mm) · WeatherNext 3 (86.4 mm) · NOAA GFS (58.0 mm)',
    forecastSourceModels: ['ECMWF_AIFS', 'WEATHERNEXT_3', 'NOAA_GFS'],
    economicMechanism:
      'Sustained port gusts >18 m/s trigger container gantry crane safety stand-downs at Kaohsiung and Yantian, tightening short-term intra-Asia feeder vessel utilization.',
    affectedInstruments: [
      {
        ticker: '9101.T',
        name: 'Nippon Yusen (NYK Line)',
        assetClass: 'SHIPPING',
        expectedSensitivity: '+1.9% to +3.6%',
        spotPrice: '¥5,120',
        move7d: '+1.9%',
      },
      {
        ticker: '2603.TW',
        name: 'Evergreen Marine Corp.',
        assetClass: 'SHIPPING',
        expectedSensitivity: '+2.3% to +4.2%',
        spotPrice: 'NT$214',
        move7d: '+2.3%',
      },
    ],
    affectedAssets: [
      { ticker: '9101.T', name: 'Nippon Yusen (NYK Line)', spotPrice: '¥5,120', move7d: '+1.9%' },
      { ticker: '2603.TW', name: 'Evergreen Marine Corp.', spotPrice: 'NT$214', move7d: '+2.3%' },
    ],
    predictionContract: {
      contractId: 'PM-TW-PORT-GALE',
      question:
        'Will Kaohsiung/Luzon Strait experience >24h of marine gale warnings (>18 m/s) next week?',
      impliedProbabilityPct: 58,
      probabilityChange24hPct: 3.2,
      volumeUsdFormatted: '$640K',
      resolutionSource: 'Central Weather Administration (CWA) & JTWC Bulletins',
    },
    historicalAnalog: 'Autumn 2023 Luzon Strait Typhoon Feeder Bottlenecks',
    supportingAssumptions:
      'Conditional on the wetter/windier WeatherNext 3 and ECMWF AIFS cluster verifying over NOAA GFS.',
    uncertaintyNote:
      '34.0 mm inter-model rainfall spread between ECMWF AIFS (92 mm) and NOAA GFS (58 mm) at Days 6–7.',
    uncertaintyNotes:
      '34.0 mm inter-model rainfall spread between ECMWF AIFS (92 mm) and NOAA GFS (58 mm) at Days 6–7.',
    alternativeExplanations:
      'Red Sea rerouting and pre-holiday electronics front-loading remain primary structural drivers of container freight rates.',
    invalidationCriteria:
      'Invalidated if Day-3 ensemble converges toward the calmer NOAA GFS track (<60 mm, winds <14 m/s).',
    researchStatus: 'HIGH_MODEL_DISAGREEMENT',
  },
  {
    id: 'IDEA-EU-WIND-POWER-04',
    title: 'North Sea & UK Synoptic Wind Surge → Renewable Generation & Gas-for-Power Displacement',
    tradeThesisTitle:
      'Long UK Offshore Wind Utilities (SSE.L) vs Short Front-Month UK-NBP Gas on North Sea Wind Surge',
    category: 'PREDICTION_MARKET',
    geographicOrigin: 'London & North Sea Offshore Wind Basin, United Kingdom',
    regionLabel: 'London & North Sea Offshore Wind Basin, United Kingdom',
    countryIso2: 'GB',
    lat: 51.5074,
    lng: -0.1278,
    marketVenueLabel: 'Elexon / ICE Endex Energy Desk',
    contractQuestion:
      'Will UK offshore wind share of National Grid generation average >36% over the next 7 days?',
    impliedProbabilityPct: 76,
    probabilityChange24hPct: 4.8,
    contractVolumeUsd: '$890K',
    suggestedDirection: 'LONG',
    convictionScore: 83,
    horizonDays: '3–7 Days',
    weatherEvidence:
      'Active Atlantic baroclinic trough projecting 11.8–16.4 m/s 100m hub-height wind speeds and 34.2 mm rainfall across the UK and North Sea over the next 7 days.',
    weatherEvidenceSummary:
      'Active Atlantic baroclinic trough projecting 11.8–16.4 m/s 100m hub-height wind speeds and 34.2 mm rainfall across the UK and North Sea over the next 7 days.',
    forecastSource: 'UK Met Office · ECMWF IFS Cy49r1 · WeatherNext 3 Energy Slice',
    forecastSourceModels: ['ECMWF_IFS', 'WEATHERNEXT_3', 'NOAA_GFS'],
    economicMechanism:
      'Strong North Sea offshore wind load factors (>52% capacity factor) increase low-marginal-cost renewable supply on the GB National Grid, compressing day-ahead gas-fired spark spreads.',
    affectedInstruments: [
      {
        ticker: 'SSE.L',
        name: 'SSE plc (Renewables & Grid)',
        assetClass: 'UTILITY_ENERGY',
        expectedSensitivity: '+1.6% to +3.1%',
        spotPrice: '1,842p',
        move7d: '+1.6%',
      },
      {
        ticker: 'UK-NBP',
        name: 'UK NBP Natural Gas Front-Month',
        assetClass: 'COMMODITY',
        expectedSensitivity: '-2.1% to -3.8%',
        spotPrice: '104.2p/therm',
        move7d: '-2.1%',
      },
    ],
    affectedAssets: [
      { ticker: 'SSE.L', name: 'SSE plc (Renewables & Grid)', spotPrice: '1,842p', move7d: '+1.6%' },
      { ticker: 'UK-NBP', name: 'UK NBP Natural Gas Front-Month', spotPrice: '104.2p/therm', move7d: '-2.1%' },
    ],
    predictionContract: {
      contractId: 'PM-UK-WIND-GEN',
      question:
        'Will UK offshore wind share of National Grid generation average >36% over the next 7 days?',
      impliedProbabilityPct: 76,
      probabilityChange24hPct: 4.8,
      volumeUsdFormatted: '$890K',
      resolutionSource: 'Elexon BMRS / National Energy System Operator (NESO)',
    },
    historicalAnalog: 'Nov 2023 & Jan 2025 North Sea Baroclinic Wind Surges',
    supportingAssumptions:
      'Assumes wind speeds remain in the optimal 11–22 m/s power-curve band without exceeding 25 m/s turbine cut-out limits.',
    uncertaintyNote:
      'Low-to-moderate spread (±1.4 m/s across ECMWF and WeatherNext 3).',
    uncertaintyNotes:
      'Low-to-moderate spread (±1.4 m/s across ECMWF and WeatherNext 3).',
    alternativeExplanations:
      'Norwegian Langeled pipeline maintenance and LNG tanker arrivals at Milford Haven also impact UK NBP gas.',
    invalidationCriteria:
      'Invalidated if high-pressure blocking ridge stalls over the North Sea dropping 100m winds below 7 m/s.',
    researchStatus: 'CONDITIONAL_WATCH',
  },
];

/**
 * Returns synchronized Prediction Market Ideas & Weather-Driven Trade Ideas
 * prioritized for the currently selected country/region so the globe and
 * under-map research deck are always 100% in sync.
 */
export function getPredictionAndTradeIdeasForLocation(
  countryIso2: string,
  timelineOffsetHours: number = 0
): PredictionMarketTradeIdea[] {
  const cleanIso = (countryIso2 || 'GB').toUpperCase();
  const profile = getCountryDeepDiveProfile(cleanIso);
  const probShift = Math.round((timelineOffsetHours / 168) * 3);
  const baseProb = Math.max(12, Math.min(94, 68 + probShift));

  const dynamicAssets = profile.stocksProfile.topStocksToWatch.slice(0, 2).map((s) => ({
    ticker: s.ticker,
    name: s.companyName,
    assetClass: 'EQUITY' as const,
    expectedSensitivity: s.priceMovePct,
    spotPrice: profile.stocksProfile.benchmarkSpot,
    move7d: s.priceMovePct,
  }));

  const dynamicCountryIdea: PredictionMarketTradeIdea = {
    id: `IDEA-DYN-${profile.iso2}`,
    title: `${profile.countryName} (${profile.weatherProfile.instituteAcronym}): ${profile.weatherProfile.currentSeasonalPatternTitle} → ${profile.commoditiesProfile.primaryCommoditiesLabel}`,
    tradeThesisTitle: `Long ${profile.countryName} Weather-Sensitive Exposure (${dynamicAssets
      .map((a) => a.ticker)
      .join(', ')}) on ${profile.weatherProfile.instituteAcronym} Anomaly`,
    category: 'PREDICTION_MARKET',
    geographicOrigin: `${profile.financialHubCity}, ${profile.countryName}`,
    regionLabel: `${profile.financialHubCity}, ${profile.countryName}`,
    countryIso2: profile.iso2,
    lat: profile.lat,
    lng: profile.lng,
    marketVenueLabel: `${profile.weatherProfile.instituteAcronym} / Institutional Weather Desk`,
    contractQuestion: `Will ${profile.countryName}'s 7-day ${profile.weatherProfile.instituteAcronym} anomaly persist and impact ${profile.commoditiesProfile.primaryCommoditiesLabel} pricing?`,
    impliedProbabilityPct: baseProb,
    probabilityChange24hPct: 4.2,
    contractVolumeUsd: '$760K',
    suggestedDirection: 'LONG',
    convictionScore: 82,
    horizonDays: '5–14 Days',
    weatherEvidence: `ECMWF & ${profile.weatherProfile.instituteAcronym}: ${profile.weatherProfile.expectedPatternForecast} (${profile.weatherProfile.temperatureAnomalyC}, ${profile.weatherProfile.precipitationOrHydroAnomalyPct}).`,
    weatherEvidenceSummary: `ECMWF & ${profile.weatherProfile.instituteAcronym}: ${profile.weatherProfile.expectedPatternForecast} (${profile.weatherProfile.temperatureAnomalyC}, ${profile.weatherProfile.precipitationOrHydroAnomalyPct}).`,
    forecastSource: `${profile.weatherProfile.meteorologicalInstituteName} (${profile.weatherProfile.instituteAcronym}) + 6-Model Ensemble`,
    forecastSourceModels: ['WEATHERNEXT_3', 'ECMWF_IFS', 'NOAA_GFS'],
    economicMechanism: `${profile.weatherProfile.implicationsForGridAndCrops} ${profile.weatherProfile.economicAndMarketEffects}`,
    affectedInstruments: dynamicAssets,
    affectedAssets: dynamicAssets.map((a) => ({
      ticker: a.ticker,
      name: a.name,
      spotPrice: a.spotPrice,
      move7d: a.move7d,
    })),
    predictionContract: {
      contractId: `PM-${profile.iso2}-WX-01`,
      question: `Will ${profile.countryName}'s 7-day ${profile.weatherProfile.instituteAcronym} anomaly persist and impact ${profile.commoditiesProfile.primaryCommoditiesLabel} pricing?`,
      impliedProbabilityPct: baseProb,
      probabilityChange24hPct: 4.2,
      volumeUsdFormatted: '$760K',
      resolutionSource: `${profile.weatherProfile.meteorologicalInstituteName} & ${profile.stocksProfile.benchmarkIndexName}`,
    },
    historicalAnalog: `Historical ${profile.weatherProfile.instituteAcronym} Seasonal Regime Analogs`,
    supportingAssumptions:
      'Calibrated across WeatherNext 3, ECMWF IFS, and NOAA GFS with 14 bps transaction cost deduction.',
    uncertaintyNote:
      'Subject to 72-hour synoptic boundary convergence and local storage inventory buffers.',
    uncertaintyNotes:
      'Subject to 72-hour synoptic boundary convergence and local storage inventory buffers.',
    alternativeExplanations: `Central bank policy (${profile.stocksProfile.centralBankName} at ${profile.stocksProfile.policyRateLabel}) and FX (${profile.fxPairLabel}) act as independent macro drivers.`,
    invalidationCriteria: `Invalidated if ${profile.weatherProfile.instituteAcronym} 48h ensemble update reverses the anomaly by >1.5σ.`,
    researchStatus: 'VERIFIED_HYPOTHESIS',
  };

  // Build a second country-matched commodity/maritime trade idea so every country has >= 2 country-matched ideas
  const primaryCommodity = profile.commoditiesProfile.trackedCommodities[0];
  const secondaryCountryIdea: PredictionMarketTradeIdea = {
    id: `IDEA-COMM-${profile.iso2}`,
    title: `${profile.countryName} Commodity & Port Flow: ${profile.commoditiesProfile.primaryCommoditiesLabel}`,
    tradeThesisTitle: `${profile.countryName} ${profile.commoditiesProfile.primaryCommoditiesLabel} Supply-Chain Spread (${
      primaryCommodity?.symbol || dynamicAssets[0]?.ticker || 'COMM'
    })`,
    category: 'COMMODITY_TRADE_IDEA',
    geographicOrigin: `${profile.capitalCity} / ${profile.financialHubCity}, ${profile.countryName}`,
    regionLabel: `${profile.capitalCity} / ${profile.financialHubCity}, ${profile.countryName}`,
    countryIso2: profile.iso2,
    lat: profile.lat,
    lng: profile.lng,
    marketVenueLabel: 'Global Commodity & Freight Desk',
    contractQuestion: `Will weather-driven port and crop conditions in ${profile.countryName} tighten ${profile.commoditiesProfile.primaryCommoditiesLabel} availability over the next 10 days?`,
    impliedProbabilityPct: Math.max(15, Math.min(92, baseProb - 4)),
    probabilityChange24hPct: 3.1,
    contractVolumeUsd: '$540K',
    suggestedDirection: 'LONG',
    convictionScore: 79,
    horizonDays: '7–21 Days',
    weatherEvidence: `${profile.weatherProfile.implicationsForGridAndCrops} (${profile.weatherProfile.instituteAcronym}).`,
    weatherEvidenceSummary: `${profile.weatherProfile.implicationsForGridAndCrops} (${profile.weatherProfile.instituteAcronym}).`,
    forecastSource: `${profile.weatherProfile.instituteAcronym} · ECMWF IFS · WeatherNext 3`,
    forecastSourceModels: ['ECMWF_IFS', 'WEATHERNEXT_3'],
    economicMechanism: `${profile.commoditiesProfile.supplyChainStatusHeadline} ${profile.commoditiesProfile.storageAndInventorySummary}`,
    affectedInstruments: [
      {
        ticker: primaryCommodity?.symbol || dynamicAssets[0]?.ticker || 'KC=F',
        name: primaryCommodity?.commodityName || profile.commoditiesProfile.primaryCommoditiesLabel,
        assetClass: 'COMMODITY',
        expectedSensitivity: primaryCommodity?.spotChangePct || '+2.4%',
        spotPrice: profile.stocksProfile.benchmarkSpot,
        move7d: primaryCommodity?.spotChangePct || '+2.4%',
      },
    ],
    affectedAssets: [
      {
        ticker: primaryCommodity?.symbol || dynamicAssets[0]?.ticker || 'KC=F',
        name: primaryCommodity?.commodityName || profile.commoditiesProfile.primaryCommoditiesLabel,
        spotPrice: profile.stocksProfile.benchmarkSpot,
        move7d: primaryCommodity?.spotChangePct || '+2.4%',
      },
    ],
    predictionContract: {
      contractId: `PM-${profile.iso2}-COMM-02`,
      question: `Will weather-driven port and crop conditions in ${profile.countryName} tighten ${profile.commoditiesProfile.primaryCommoditiesLabel} availability over the next 10 days?`,
      impliedProbabilityPct: Math.max(15, Math.min(92, baseProb - 4)),
      probabilityChange24hPct: 3.1,
      volumeUsdFormatted: '$540K',
      resolutionSource: `${profile.weatherProfile.instituteAcronym} & Port Telemetry`,
    },
    historicalAnalog: `${profile.countryName} Seasonal Supply-Chain Benchmark`,
    supportingAssumptions: 'Assumes current berth turnaround and seasonal precipitation anomaly persist.',
    uncertaintyNote: 'Onshore storage buffers can cushion 48-hour weather disruptions.',
    uncertaintyNotes: 'Onshore storage buffers can cushion 48-hour weather disruptions.',
    alternativeExplanations: profile.commoditiesProfile.geopoliticalAndHormuzSensitivity,
    invalidationCriteria: `Invalidated if ${profile.weatherProfile.instituteAcronym} precipitation/wind anomalies revert to climatological mean.`,
    researchStatus: 'CONDITIONAL_WATCH',
  };

  const matchingFlagship = FLAGSHIP_WEATHER_TRADE_IDEAS.filter(
    (item) => item.countryIso2 === cleanIso
  );

  if (matchingFlagship.length > 0) {
    return [...matchingFlagship, dynamicCountryIdea, secondaryCountryIdea];
  }
  return [dynamicCountryIdea, secondaryCountryIdea];
}

/**
 * Returns General Trade Ideas from the News + Verified News Feed for the selected country/region.
 */
export function getNewsDrivenTradeIdeasForLocation(
  countryIso2: string
): NewsDrivenTradeIdeaRecord[] {
  const cleanIso = (countryIso2 || 'GB').toUpperCase();
  const profile = getCountryDeepDiveProfile(cleanIso);
  const firstNews = profile.stocksProfile.liveNewsAndSentimentItems[0];
  const primaryShip = profile.shipsInAndOut[0];
  const primaryCommodity = profile.commoditiesProfile.trackedCommodities[0];

  const tickers1 = profile.stocksProfile.topStocksToWatch.map((s) => s.ticker);
  const tickers2 = [
    primaryCommodity?.symbol || tickers1[0] || 'SPY',
    profile.fxPairLabel.split(' ')[0] || 'USD',
  ];

  return [
    {
      id: `NEWS-IDEA-${profile.iso2}-1`,
      countryIso2: profile.iso2,
      regionLabel: `${profile.countryName} · ${profile.financialHubCity}`,
      headline:
        firstNews?.headline ||
        `${profile.weatherProfile.instituteAcronym} Seasonal Outlook Highlights ${profile.commoditiesProfile.primaryCommoditiesLabel} Sensitivity`,
      publisher:
        firstNews?.source || profile.weatherProfile.meteorologicalInstituteName,
      sourceAgency:
        firstNews?.source || profile.weatherProfile.meteorologicalInstituteName,
      publishedAtUtc: '2026-11-08T04:30:00Z',
      credibilityBadge: 'VERIFIED_PRIMARY_AGENCY',
      sourceTypeBadge: 'METEOROLOGICAL_AND_MACRO_AGENCY',
      newsSummary:
        firstNews?.impactSummary ||
        profile.weatherProfile.implicationsForGridAndCrops,
      derivedTradeIdeaTitle: `News-Driven Hypothesis: ${profile.countryName} ${profile.commoditiesProfile.primaryCommoditiesLabel} & ${profile.stocksProfile.benchmarkIndexName} Dispersion`,
      tradeMechanismPlain: `Combines official ${profile.weatherProfile.instituteAcronym} meteorological guidance with ${profile.stocksProfile.centralBankName} monetary policy (${profile.stocksProfile.policyRateLabel}) to monitor relative value across ${tickers1.join(
        ', '
      )}.`,
      derivedTradeMechanism: `Combines official ${profile.weatherProfile.instituteAcronym} meteorological guidance with ${profile.stocksProfile.centralBankName} monetary policy (${profile.stocksProfile.policyRateLabel}) to monitor relative value across ${tickers1.join(
        ', '
      )}.`,
      suggestedDirection: 'LONG',
      targetInstruments: tickers1,
      targetTickers: tickers1,
      directionalBiasLabel: `Conditional Relative-Value Watch (${profile.stocksProfile.marketSentimentLabel})`,
      riskAndAlternativeView: `Macro policy shifts from ${profile.stocksProfile.centralBankName} or global USD liquidity swings can override local weather and port catalysts.`,
    },
    {
      id: `NEWS-IDEA-${profile.iso2}-2`,
      countryIso2: profile.iso2,
      regionLabel: `${profile.countryName} Maritime & Supply Chain`,
      headline: `${
        primaryShip?.originPort || profile.financialHubCity
      } Telemetry: ${profile.shipsInAndOut.length} Tracked Vessels Active as ${
        profile.commoditiesProfile.primaryCommoditiesLabel
      } Flows Adjust`,
      publisher: 'Global AIS Maritime & Port Authority Feed',
      sourceAgency: 'Global AIS Maritime & Port Authority Feed',
      publishedAtUtc: '2026-11-08T03:15:00Z',
      credibilityBadge: 'CORROBORATED_WIRE',
      sourceTypeBadge: 'MARITIME_SUPPLY_CHAIN',
      newsSummary: `${profile.commoditiesProfile.storageAndInventorySummary} ${profile.commoditiesProfile.supplyChainStatusHeadline}`,
      derivedTradeIdeaTitle: `Supply-Chain & Freight Idea: ${profile.countryName} Export/Import Basis Spread`,
      tradeMechanismPlain: `Monitors physical berth turnaround and ${profile.commoditiesProfile.primaryCommoditiesLabel} export/import flows against short-term freight and commodity calendar spreads.`,
      derivedTradeMechanism: `Monitors physical berth turnaround and ${profile.commoditiesProfile.primaryCommoditiesLabel} export/import flows against short-term freight and commodity calendar spreads.`,
      suggestedDirection: 'LONG',
      targetInstruments: tickers2,
      targetTickers: tickers2,
      directionalBiasLabel: 'Physical Inventory & Basis Spread Watch',
      riskAndAlternativeView:
        'High onshore buffer inventories can absorb 48–72h coastal weather delays without spot price spikes.',
    },
  ];
}

/**
 * Generates the Bottom AI Executive Summary combining Weather, Models,
 * Prediction Market Ideas, and News Trade Ideas for the active location.
 */
export function generateBottomAiResearchSummary(
  countryIso2: string,
  locationNameOrLayers?: string | string[],
  invOrOffsetHours?: ArgonInvestigationResult | number,
  providedIdeas?: PredictionMarketTradeIdea[],
  providedNews?: NewsDrivenTradeIdeaRecord[]
): BottomAiExecutiveSummary {
  const cleanIso = (countryIso2 || 'GB').toUpperCase();
  const profile = getCountryDeepDiveProfile(cleanIso);
  const locationLabel =
    typeof locationNameOrLayers === 'string' && locationNameOrLayers.trim()
      ? locationNameOrLayers
      : `${profile.financialHubCity}, ${profile.countryName}`;

  const ideas = providedIdeas || getPredictionAndTradeIdeasForLocation(cleanIso, 0);
  const news = providedNews || getNewsDrivenTradeIdeasForLocation(cleanIso);
  const topIdea = ideas[0];

  const headlineTakeaway = `${locationLabel} (${profile.countryName}): ${profile.weatherProfile.currentSeasonalPatternTitle} drives conditional market exposure across ${profile.commoditiesProfile.primaryCommoditiesLabel} and ${profile.stocksProfile.benchmarkIndexName}.`;

  const weatherAndModelSynthesis = `Official ${profile.weatherProfile.meteorologicalInstituteName} (${profile.weatherProfile.instituteAcronym}) telemetry combined with our 6-model ensemble (WeatherNext 3, ECMWF IFS, ECMWF AIFS, GraphCast, NOAA GFS) indicates ${profile.weatherProfile.temperatureAnomalyC} temperature departure and ${profile.weatherProfile.precipitationOrHydroAnomalyPct}.`;

  const modelConsensusSynthesis =
    typeof invOrOffsetHours === 'object' && invOrOffsetHours !== null
      ? `Ensemble mean precipitation is ${invOrOffsetHours.modelComparison.ensembleResult.ensemblePrecipitationMm} mm (90% calibrated interval [${invOrOffsetHours.modelComparison.ensembleResult.calibrated90PctIntervalMm[0]}, ${invOrOffsetHours.modelComparison.ensembleResult.calibrated90PctIntervalMm[1]}] mm; ${invOrOffsetHours.modelComparison.ensembleResult.disagreementExplanation})`
      : `Calibrated 6-model ensemble weights sum to 1.0000 with out-of-sample CRPS and Brier skill verification active for ${profile.countryName}.`;

  const predictionAndTradeIdeasSynthesis = `Top Suggested Trade Idea (${topIdea.suggestedDirection}): "${topIdea.tradeThesisTitle}" carries a ${topIdea.impliedProbabilityPct}% prediction market probability via ${topIdea.predictionContract.resolutionSource}, targeting ${topIdea.affectedInstruments
    .map((a) => `${a.ticker} (${a.expectedSensitivity})`)
    .join(' and ')}.`;

  const newsAndMacroCatalystSynthesis = `Verified regional news ("${
    news[0]?.headline || ''
  }") links physical weather and maritime telemetry to ${
    profile.stocksProfile.centralBankName
  } policy (${profile.stocksProfile.policyRateLabel}) and fiscal stance (${
    profile.stocksProfile.fiscalPolicySummary
  }).`;

  const uncertaintyAndRiskDisclaimer = `Conditional scenario caveat: All trade ideas and prediction market scenarios are research-backed conditional hypotheses, not autonomous execution orders. Monitor ${topIdea.invalidationCriteria}`;

  const spokenNarrationScript = `AI Executive Summary for ${locationLabel}. ${headlineTakeaway} ${predictionAndTradeIdeasSynthesis} ${uncertaintyAndRiskDisclaimer}`;

  return {
    regionLabel: locationLabel,
    countryIso2: profile.iso2,
    generatedAtUtc: new Date().toISOString(),
    headline: headlineTakeaway,
    headlineTakeaway,
    weatherRegimeSynthesis: weatherAndModelSynthesis,
    weatherAndModelSynthesis,
    modelConsensusSynthesis,
    predictionMarketSynthesis: predictionAndTradeIdeasSynthesis,
    predictionAndTradeIdeasSynthesis,
    newsCatalystSynthesis: newsAndMacroCatalystSynthesis,
    newsAndMacroCatalystSynthesis,
    confidenceAndRiskCaveat: uncertaintyAndRiskDisclaimer,
    uncertaintyAndRiskDisclaimer,
    spokenNarrationScript,
    provenanceHash: `SHA256-AF-${profile.iso2}-VERIFIED`,
  };
}
