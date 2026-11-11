import type { ClimateSignal, LiveAtmosphereInvestigation, ResolvedTarget } from './liveAtmospherePipeline.ts';

export type CommoditySector = 'Grains & oilseeds' | 'Soft commodities' | 'Energy' | 'Industrial metals' | 'Precious metals' | 'Livestock';
type RuleKind = 'CROP_RAIN' | 'CROP_HEAT' | 'COLD' | 'DEMAND' | 'WIND' | 'DISRUPTION';
export interface DriverRule { kind: RuleKind; label: string; mechanism: string }
export interface CommodityRegion { id: string; name: string; country: string; lat: number; lng: number; activeMonths?: number[] }
export interface CommodityDefinition {
  id: string; name: string; symbol: string; sector: CommoditySector; unit: string;
  regions: CommodityRegion[]; rules: DriverRule[]; horizon: string;
  fundamentals: string[]; invalidation: string; weatherRole: 'DIRECT' | 'INDIRECT' | 'LIMITED';
}
const r = (id: string, name: string, country: string, lat: number, lng: number, activeMonths?: number[]): CommodityRegion => ({ id, name, country, lat, lng, activeMonths });
const rain: DriverRule = { kind: 'CROP_RAIN', label: 'Rainfall & crop water', mechanism: 'A rainfall deficit can stress crops; unusually heavy rain can disrupt harvest or increase disease. Near-normal rain alone is not a bearish price forecast.' };
const heat: DriverRule = { kind: 'CROP_HEAT', label: 'Crop heat stress', mechanism: 'Anomalously frequent days above 32°C may reduce crop productivity. Thresholds are a screening proxy, not a calibrated yield model.' };
const cold: DriverRule = { kind: 'COLD', label: 'Cold exposure', mechanism: 'A sub-zero seven-day mean would warrant frost investigation. Daily minimum temperatures are needed to detect individual frost events.' };
const demand: DriverRule = { kind: 'DEMAND', label: 'Heating & cooling demand', mechanism: 'More heating or cooling degree-days can increase fuel demand; fewer can reduce it. Storage and generation mix can offset the effect.' };
const wind: DriverRule = { kind: 'WIND', label: 'Renewable substitution', mechanism: 'Lower wind can increase dispatchable generation demand. Surface wind is only a proxy for turbine-height output.' };
const disruption: DriverRule = { kind: 'DISRUPTION', label: 'Physical disruption', mechanism: 'Exceptional rainfall may interrupt mines, transport or production. Rainfall alone does not establish an outage.' };
const cropRules = [rain, heat, cold];
const grains = ['Crop progress and yield reports', 'Export demand and inventories', 'USD and competing origins'];
const energy = ['Storage and inventory releases', 'Production and outages', 'Forward curve and transport constraints'];
const metals = ['Exchange inventories', 'Industrial demand and PMIs', 'USD, real yields and production reports'];
const c = (id: string, name: string, symbol: string, sector: CommoditySector, unit: string, regions: CommodityRegion[], rules: DriverRule[], fundamentals: string[], weatherRole: CommodityDefinition['weatherRole'] = 'DIRECT'): CommodityDefinition => ({ id, name, symbol, sector, unit, regions, rules, fundamentals, weatherRole, horizon: sector === 'Energy' ? 'Days to weeks' : 'Weeks to months', invalidation: 'Reassess if the anomaly disappears, the relevant exposure is outside its sensitive season, observed production is unaffected, or inventories and demand offset the physical effect.' });

/** Coverage registry, not fabricated market data. Regions are explicit sample points, never claimed as global production coverage. */
export const COMMODITIES: CommodityDefinition[] = [
  c('corn', 'Corn', 'ZC=F', 'Grains & oilseeds', 'US¢/bushel', [r('iowa', 'Iowa · US Corn Belt', 'US', 42.03, -93.62, [4,5,6,7,8,9]), r('parana', 'Paraná · Brazil', 'BR', -24.95, -53.46, [1,2,3,4,5,6])], cropRules, grains),
  c('wheat', 'Wheat', 'ZW=F', 'Grains & oilseeds', 'US¢/bushel', [r('kansas', 'Kansas · US Plains', 'US', 38.84, -97.61, [3,4,5,6,9,10]), r('nsw', 'New South Wales · Australia', 'AU', -32.25, 148.60, [5,6,7,8,9,10,11])], cropRules, grains),
  c('soybeans', 'Soybeans', 'ZS=F', 'Grains & oilseeds', 'US¢/bushel', [r('mato-grosso', 'Mato Grosso · Brazil', 'BR', -12.54, -55.72, [10,11,12,1,2,3]), r('illinois', 'Illinois · United States', 'US', 40.11, -88.24, [5,6,7,8,9])], cropRules, grains),
  c('soy-oil', 'Soybean oil', 'ZL=F', 'Grains & oilseeds', 'US¢/lb', [r('illinois', 'Illinois · United States', 'US', 40.11, -88.24, [5,6,7,8,9])], cropRules, [...grains, 'Crush margins and biofuel mandates'], 'INDIRECT'),
  c('soy-meal', 'Soybean meal', 'ZM=F', 'Grains & oilseeds', 'USD/short ton', [r('mato-grosso', 'Mato Grosso · Brazil', 'BR', -12.54, -55.72, [10,11,12,1,2,3])], cropRules, [...grains, 'Feed demand and crush margins'], 'INDIRECT'),
  c('rice', 'Rough rice', 'ZR=F', 'Grains & oilseeds', 'USD/cwt', [r('arkansas', 'Arkansas · United States', 'US', 34.50, -91.55, [4,5,6,7,8,9])], cropRules, [...grains, 'Irrigation and export policy']),
  c('oats', 'Oats', 'ZO=F', 'Grains & oilseeds', 'US¢/bushel', [r('saskatchewan', 'Saskatchewan · Canada', 'CA', 52.13, -106.67, [5,6,7,8,9])], cropRules, grains),
  c('coffee', 'Arabica coffee', 'KC=F', 'Soft commodities', 'US¢/lb', [r('minas', 'Minas Gerais · Brazil', 'BR', -21.55, -45.43, [1,2,3,4,5,6,7,8,9,10,11,12])], cropRules, ['Flowering, frost and harvest stage', 'Certified stocks and exports', 'BRL and producer selling']),
  c('cocoa', 'Cocoa', 'CC=F', 'Soft commodities', 'USD/tonne', [r('daloa', 'Daloa · Côte d’Ivoire', 'CI', 6.88, -6.45), r('kumasi', 'Kumasi · Ghana', 'GH', 6.69, -1.62)], [rain, heat], ['Port arrivals and grindings', 'Disease and farm inputs', 'Producer policy and inventories']),
  c('sugar', 'Raw sugar', 'SB=F', 'Soft commodities', 'US¢/lb', [r('sao-paulo', 'São Paulo · Brazil', 'BR', -21.17, -47.81, [4,5,6,7,8,9,10,11]), r('maharashtra', 'Maharashtra · India', 'IN', 18.52, 73.86)], cropRules, ['Cane crush and sugar/ethanol allocation', 'Export restrictions', 'BRL and energy prices']),
  c('cotton', 'Cotton', 'CT=F', 'Soft commodities', 'US¢/lb', [r('lubbock', 'West Texas · United States', 'US', 33.58, -101.85, [5,6,7,8,9,10])], cropRules, ['Crop condition and abandonment', 'Textile demand and exports', 'Irrigation and inventories']),
  c('orange-juice', 'Orange juice', 'OJ=F', 'Soft commodities', 'US¢/lb', [r('florida', 'Central Florida · United States', 'US', 28.04, -81.95), r('sao-paulo', 'São Paulo · Brazil', 'BR', -21.17, -47.81)], cropRules, ['Citrus disease and fruit count', 'Storm damage and processing', 'Inventories and retail demand']),
  c('lumber', 'Lumber', 'LBR=F', 'Soft commodities', 'USD/1,000 board ft', [r('bc', 'British Columbia · Canada', 'CA', 53.92, -122.75)], [disruption, heat], ['Housing starts and mortgage rates', 'Mill curtailments', 'Fire restrictions and rail access'], 'INDIRECT'),
  c('natural-gas', 'Natural gas', 'NG=F', 'Energy', 'USD/MMBtu', [r('texas', 'Texas · United States', 'US', 32.78, -96.80), r('northeast', 'Northeast · United States', 'US', 40.71, -74.01)], [demand, wind], energy),
  c('crude-oil', 'WTI crude oil', 'CL=F', 'Energy', 'USD/barrel', [r('gulf', 'US Gulf Coast · Houston', 'US', 29.76, -95.37)], [disruption], [...energy, 'OPEC policy and global demand'], 'INDIRECT'),
  c('brent', 'Brent crude oil', 'BZ=F', 'Energy', 'USD/barrel', [r('north-sea', 'North Sea · Aberdeen', 'GB', 57.15, -2.09)], [disruption], [...energy, 'OPEC policy and geopolitical supply'], 'INDIRECT'),
  c('heating-oil', 'Heating oil', 'HO=F', 'Energy', 'USD/gallon', [r('northeast', 'Northeast · United States', 'US', 40.71, -74.01)], [demand], [...energy, 'Refinery runs and distillate balances']),
  c('gasoline', 'Gasoline', 'RB=F', 'Energy', 'USD/gallon', [r('gulf', 'US Gulf Coast · Houston', 'US', 29.76, -95.37)], [disruption], [...energy, 'Driving demand and refinery margins'], 'INDIRECT'),
  c('copper', 'Copper', 'HG=F', 'Industrial metals', 'USD/lb', [r('antofagasta', 'Antofagasta · Chile', 'CL', -23.65, -70.40)], [disruption], [...metals, 'Mine water access and treatment charges'], 'INDIRECT'),
  c('aluminium', 'Aluminium', 'ALI=F', 'Industrial metals', 'USD/tonne', [r('yunnan', 'Yunnan · China', 'CN', 25.04, 102.72)], [], [...metals, 'Hydropower reservoirs and smelter curtailments'], 'LIMITED'),
  c('nickel', 'Nickel', 'JJN', 'Industrial metals', 'ETN proxy', [r('sulawesi', 'Sulawesi · Indonesia', 'ID', -3.98, 122.51)], [disruption], [...metals, 'Indonesian production and battery demand', 'JJN is an ETN proxy, not a nickel futures quote'], 'INDIRECT'),
  c('iron-ore', 'Iron ore', 'TIO=F', 'Industrial metals', 'USD/tonne', [r('pilbara', 'Pilbara · Western Australia', 'AU', -20.31, 118.58)], [disruption], [...metals, 'Steel margins and port stocks', 'Cyclone warnings and port closures'], 'INDIRECT'),
  c('gold', 'Gold', 'GC=F', 'Precious metals', 'USD/troy oz', [r('johannesburg', 'Gauteng · South Africa', 'ZA', -26.20, 28.04)], [], ['Real yields and USD', 'Central-bank buying and ETF flows', 'Risk demand and mine output'], 'LIMITED'),
  c('silver', 'Silver', 'SI=F', 'Precious metals', 'USD/troy oz', [r('zacatecas', 'Zacatecas · Mexico', 'MX', 22.77, -102.58)], [disruption], [...metals, 'Solar demand and gold/silver relationship'], 'INDIRECT'),
  c('platinum', 'Platinum', 'PL=F', 'Precious metals', 'USD/troy oz', [r('rustenburg', 'Rustenburg · South Africa', 'ZA', -25.67, 27.24)], [disruption], ['Auto-catalyst and industrial demand', 'Mine output and electricity availability', 'USD and substitution'], 'INDIRECT'),
  c('palladium', 'Palladium', 'PA=F', 'Precious metals', 'USD/troy oz', [r('rustenburg', 'Rustenburg · South Africa', 'ZA', -25.67, 27.24)], [disruption], ['Auto production and catalyst substitution', 'Russian supply and inventories', 'USD'], 'INDIRECT'),
  c('cattle', 'Live cattle', 'LE=F', 'Livestock', 'US¢/lb', [r('amarillo', 'Texas Panhandle · United States', 'US', 35.22, -101.83, [5,6,7,8,9])], [heat], ['Feed costs and placements', 'Slaughter weights and herd size', 'Beef demand'], 'INDIRECT'),
  c('hogs', 'Lean hogs', 'HE=F', 'Livestock', 'US¢/lb', [r('iowa', 'Iowa · United States', 'US', 42.03, -93.62, [5,6,7,8,9])], [heat], ['Feed costs and herd size', 'Disease and slaughter data', 'Export and retail demand'], 'INDIRECT'),
];
export const COMMODITY_ENGINE_VERSION = 'commodity-pressure-v2';
export const SECTORS = [...new Set(COMMODITIES.map(c => c.sector))];
export interface DriverReading { label: string; signalId: string; value: number | null; normal: number | null; anomaly: number | null; unit: string; zScore: number | null; pressure: 'UP' | 'DOWN' | 'NEUTRAL' | 'UNKNOWN'; mechanism: string; caveat: string }
export interface CommodityForecast {
  commodityId: string; regionId: string; generatedAtUtc: string; sourceGeneratedAtUtc: string;
  status: 'UPWARD_PRESSURE' | 'DOWNWARD_PRESSURE' | 'MIXED' | 'NO_MATERIAL_SIGNAL' | 'INSUFFICIENT_EVIDENCE';
  drivers: DriverReading[]; seasonActive: boolean; headline: string; limitations: string[];
  evidence: { modelCount: number; climateYears: number; weatherVerification: boolean; priceModelValidated: false; inputHash: string; experimentId: string; engineVersion: string; parametersSha256?: string };
  market: LiveAtmosphereInvestigation['consequences'][number]['observedMove'];
  diagnostics?: {
    models: LiveAtmosphereInvestigation['modelForecasts'];
    verification: LiveAtmosphereInvestigation['verification'];
    signals: LiveAtmosphereInvestigation['signals'];
    provenance: LiveAtmosphereInvestigation['provenance'];
  };
  sources: LiveAtmosphereInvestigation['dataLog'];
  fundamentals: string[]; weatherWindow: string; target: ResolvedTarget;
}

export function commodityTarget(commodity: CommodityDefinition, region: CommodityRegion): ResolvedTarget {
  return { label: region.name, countryCode: region.country, points: [{ name: region.name, lat: region.lat, lng: region.lng }], presetId: `COMMODITY_${commodity.id}_${region.id}`, resolution: 'PRESET', matchedText: commodity.name,
    // CONTEXT deliberately avoids applying the old rainfall-only price model to another commodity.
    exposures: [{ symbol: commodity.symbol, name: commodity.name, sector: commodity.sector === 'Energy' ? 'ENERGY' : commodity.sector.includes('metals') ? 'METALS' : commodity.sector === 'Livestock' ? 'LIVESTOCK' : 'AGRICULTURE', driver: 'CONTEXT' }] };
}

/** Rules identify conditional physical pressure; they never generate returns, targets, or financial probabilities. */
export function buildCommodityForecast(commodity: CommodityDefinition, region: CommodityRegion, live: LiveAtmosphereInvestigation): CommodityForecast {
  const month = new Date(live.generatedAtUtc).getUTCMonth() + 1;
  const seasonActive = !region.activeMonths || region.activeMonths.includes(month);
  const get = (id: ClimateSignal['id']) => live.signals.find(s => s.id === id);
  const drivers = commodity.rules.map(rule => {
    let sig: ClimateSignal | undefined;
    let pressure: DriverReading['pressure'] = 'NEUTRAL';
    let caveat = seasonActive ? 'Conditional mechanism; price response is not calibrated.' : 'Outside this region’s broad sensitivity window; directional inference withheld.';
    if (rule.kind === 'CROP_RAIN') {
      sig = get('PRECIP_NEXT7');
      if (sig && sig.zScore <= -1) pressure = 'UP';
      if (sig && sig.zScore >= 2) { pressure = 'UP'; caveat += ' Excess rain needs crop-stage and soil-moisture confirmation.'; }
    } else if (rule.kind === 'CROP_HEAT') {
      sig = get('HEAT_NEXT7');
      if (sig && sig.zScore >= 1 && sig.value > 0) pressure = 'UP';
    } else if (rule.kind === 'COLD') {
      sig = get('TEMP_NEXT7');
      if (sig && sig.value < 0 && sig.zScore <= -1) pressure = 'UP';
      caveat += ' Weekly means cannot detect overnight frost; daily minima are not available in this screen.';
    } else if (rule.kind === 'DEMAND') {
      const h = get('HDD_NEXT7'), c = get('CDD_NEXT7');
      // A cold winter is not offset by irrelevant CDD; select the climatologically dominant load.
      sig = (h?.normal ?? 0) >= (c?.normal ?? 0) ? h : c;
      if (sig && Math.abs(sig.zScore) >= 1) pressure = sig.zScore > 0 ? 'UP' : 'DOWN';
    } else if (rule.kind === 'WIND') {
      sig = get('WIND_NEXT7');
      if (sig && Math.abs(sig.zScore) >= 1) pressure = sig.zScore < 0 ? 'UP' : 'DOWN';
    } else {
      sig = get('PRECIP_NEXT7');
      if (sig && sig.zScore >= 2) pressure = 'UP';
      caveat += ' Outage/port confirmation required; storm and cyclone tracks are not inferred from rain.';
    }
    const usable = sig && [sig.value, sig.normal, sig.anomaly, sig.zScore].every(Number.isFinite);
    if (!usable) pressure = 'UNKNOWN';
    else if (!seasonActive) pressure = 'NEUTRAL';
    return { label: rule.label, signalId: sig?.id ?? '', value: usable ? sig!.value : null, normal: usable ? sig!.normal : null, anomaly: usable ? sig!.anomaly : null, unit: sig?.unit ?? '', zScore: usable ? sig!.zScore : null, pressure, mechanism: rule.mechanism, caveat };
  });
  const up = drivers.some(d => d.pressure === 'UP'), down = drivers.some(d => d.pressure === 'DOWN');
  const status: CommodityForecast['status'] = !drivers.length || drivers.every(d => d.pressure === 'UNKNOWN') ? 'INSUFFICIENT_EVIDENCE' : up && down ? 'MIXED' : up ? 'UPWARD_PRESSURE' : down ? 'DOWNWARD_PRESSURE' : 'NO_MATERIAL_SIGNAL';
  const headline = status === 'INSUFFICIENT_EVIDENCE' ? 'Weather alone does not support a directional outlook.' : status === 'MIXED' ? 'Physical drivers point in different directions.' : status === 'NO_MATERIAL_SIGNAL' ? 'No material seasonal weather pressure detected.' : `${status === 'UPWARD_PRESSURE' ? 'Upward' : 'Downward'} conditional price pressure; confirm with fundamentals.`;
  return { commodityId: commodity.id, regionId: region.id, generatedAtUtc: live.generatedAtUtc, sourceGeneratedAtUtc: live.generatedAtUtc, status, drivers, seasonActive, headline,
    limitations: ['Regional sample point, not a production-weighted global forecast.', 'Seven-day weather window; market transmission may take longer.', 'No validated out-of-sample price model: no price target, return estimate or calibrated probability.', ...(commodity.weatherRole !== 'DIRECT' ? ['Weather is an indirect or limited driver for this commodity; fundamentals may dominate.'] : []), ...(!live.verification ? ['Held-out weather verification unavailable.'] : []), commodity.invalidation],
    evidence: { engineVersion: COMMODITY_ENGINE_VERSION, modelCount: live.modelForecasts.filter(m => m.includedInEnsemble).length, climateYears: live.climatology.years, weatherVerification: !!live.verification, priceModelValidated: false, inputHash: live.reproducibility.inputsSha256, experimentId: `CF-${commodity.id}-${region.id}-${live.reproducibility.inputsSha256.slice(0,12)}` },
    market: live.consequences.find(c => c.exposure.symbol === commodity.symbol)?.observedMove ?? null,
    diagnostics: { models: live.modelForecasts, verification: live.verification, signals: live.signals, provenance: live.provenance ?? [] },
    sources: live.dataLog, fundamentals: commodity.fundamentals, weatherWindow: live.windows.forecastLabel, target: live.target };
}
