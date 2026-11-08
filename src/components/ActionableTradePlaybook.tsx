// ============================================================================
// ALPHAFORGE ATMOSPHERE — STEP 3 • ACTIONABLE TRADE PLAYBOOK
// Matches the exact reference UI ("What Trades To Act On (<Country>)") with:
// - Segmented Filter: All Signals (7) | Prediction Mkts (3) | Traditional Mkts (4)
// - Binary Prediction Market Cards (Market Odds vs Model Fair Odds, +Edge, Payout,
//   Why Act, Traditional Hedge, Act: Buy YES ($5k))
// - Traditional Stock & Commodity Insights ("Which Stocks To Buy & What Is
//   Affecting What": Weather -> AIS Ships & Car-Park Recon -> Central Bank Policy
//   -> Stock Price Impact)
// ============================================================================

import React, { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  CloudRain,
  Compass,
  Cpu,
  DollarSign,
  Landmark,
  Layers,
  Ship,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { getCountryDeepDiveProfile } from '../engine/countryDeepDiveEngine';
import { useAtmosphereStore } from '../state/atmosphereStore';
import { FixtureBanner, LiveResearchIdeas } from './LiveVerificationPanel';

export interface ActionableTradePlaybookProps {
  countryIso2: string;
  timelineOffsetHours: number;
  onSelectTickerOrRegion?: (query: string) => void;
}

type SignalFilterTab = 'ALL' | 'PREDICTION' | 'TRADITIONAL';

interface BinaryPredictionSignal {
  id: string;
  actionLabel: 'BUY YES' | 'BUY NO';
  sourceDriverBadge: string;
  edgePct: number;
  payoutMultiplier: string;
  question: string;
  marketOddsCents: number;
  modelFairOddsCents: number;
  whyActExplanation: string;
  traditionalHedgeTicker: string;
  orderButtonLabel: string;
}

interface TraditionalStockSignal {
  id: string;
  actionBadge: 'BUY / LONG' | 'OVERWEIGHT' | 'TACTICAL LONG' | 'HEDGE / PAIR';
  ticker: string;
  companyName: string;
  sector: string;
  currentSpotLabel: string;
  targetMovePct: string;
  convictionScore: number;
  rewardRiskRatio: string;
  whatIsAffectingWhat: {
    weatherEffect: string;
    shipsAndReconEffect: string;
    monetaryAndFiscalEffect: string;
  };
  whyBuySummary: string;
  invalidationTrigger: string;
  orderButtonLabel: string;
}

export const ActionableTradePlaybook: React.FC<
  ActionableTradePlaybookProps
> = ({ countryIso2, timelineOffsetHours, onSelectTickerOrRegion }) => {
  const atmosphere = useAtmosphereStore();
  const [activeFilter, setActiveFilter] = useState<SignalFilterTab>('ALL');
  const [executedOrders, setExecutedOrders] = useState<Record<string, string>>(
    {}
  );

  const cleanIso = (countryIso2 || 'SE').toUpperCase();
  const profile = getCountryDeepDiveProfile(cleanIso);

  const ships = profile.shipsInAndOut;
  const exportShipsCount = ships.filter(
    (s) => s.direction === 'SHIP_OUT_EXPORT'
  ).length;
  const totalCargoUsdM = Math.round(
    ships.reduce((acc, s) => acc + s.estimatedCargoValueUsdM, 0)
  );

  const horizonLabel =
    timelineOffsetHours === 0
      ? 'Horizon: Live (0h)'
      : timelineOffsetHours > 0
      ? `Horizon: +${timelineOffsetHours}h Forecast`
      : `Horizon: ${timelineOffsetHours}h Replay`;

  const topTickersList = profile.stocksProfile.topStocksToWatch
    .map((s) => s.ticker)
    .join(', ');

  // Build the 3 Binary Prediction Market Signals tailored to the selected country
  // (With exact Sweden numbers matching the reference screenshot when Sweden / SE is selected)
  const isSweden = profile.iso2 === 'SE';
  const isBrazil = profile.iso2 === 'BR';

  const predictionSignals: BinaryPredictionSignal[] = [
    {
      id: `PM-SIG-${profile.iso2}-1`,
      actionLabel: 'BUY YES',
      sourceDriverBadge: `${profile.stocksProfile.centralBankName} Rate & CPI Nowcast`,
      edgePct: 15,
      payoutMultiplier: '1.43x Payout',
      question: isSweden
        ? 'Sveriges Riksbank cuts policy rate by another 25–50 bps to ≤2.50% at next meeting?'
        : isBrazil
        ? 'Will Sul de Minas cumulative 10-day rainfall remain below 25 mm (INMET gauge average) & trigger KC=F breakout?'
        : `${profile.stocksProfile.centralBankName} adjusts policy stance at next meeting as ${profile.weatherProfile.instituteAcronym} energy/food CPI shifts?`,
      marketOddsCents: 70,
      modelFairOddsCents: 85,
      whyActExplanation: isSweden
        ? `Prediction market prices YES at 70¢, whereas AlphaForge’s CPI + hydro energy nowcast prices true probability at 85% (+15% net probability edge). Bullish OMXS30, Swedish retail (AXFO.ST), and real estate (BALD-B.ST).`
        : `Prediction market prices YES at 70¢, whereas AlphaForge’s ${profile.weatherProfile.instituteAcronym} weather + CPI nowcast prices true probability at 85% (+15% net probability edge). Directly reprices ${profile.stocksProfile.benchmarkIndexName} and ${topTickersList}.`,
      traditionalHedgeTicker: profile.stocksProfile.benchmarkIndexName.split(
        ' '
      )[0],
      orderButtonLabel: 'Act: Buy YES ($5k)',
    },
    {
      id: `PM-SIG-${profile.iso2}-2`,
      actionLabel: 'BUY YES',
      sourceDriverBadge: `${profile.stocksProfile.supermarketOccupancyPct}% Car-Park & ${ships.length} AIS Ships`,
      edgePct: 18,
      payoutMultiplier: '1.64x Payout',
      question: isSweden
        ? 'Swedish Q4 Industrial & Defense Exports exceed SEK 520B on US/EU orders?'
        : `${profile.countryName} Q4 Export & Retail Volume beats consensus on ${profile.stocksProfile.supermarketOccupancyPct}% optical occupancy & ${exportShipsCount} export vessels?`,
      marketOddsCents: 61,
      modelFairOddsCents: 79,
      whyActExplanation: `Live optical car-park occupancy (${profile.stocksProfile.supermarketOccupancyPct}% at ${profile.stocksProfile.supermarketReconName}) and ${exportShipsCount} outbound export ships ($${totalCargoUsdM}M tracked cargo) give a +18% informational edge over consensus odds.`,
      traditionalHedgeTicker:
        profile.stocksProfile.topStocksToWatch[0]?.ticker || 'OMXS30',
      orderButtonLabel: 'Act: Buy YES ($5k)',
    },
    {
      id: `PM-SIG-${profile.iso2}-3`,
      actionLabel: 'BUY YES',
      sourceDriverBadge: `${profile.weatherProfile.instituteAcronym} Weather & Grid/Crop Ensemble`,
      edgePct: 16,
      payoutMultiplier: '1.56x Payout',
      question: `Will ${profile.weatherProfile.instituteAcronym} 7-day anomaly (${profile.weatherProfile.precipitationOrHydroAnomalyPct}) persist and drive >3.5% move in ${profile.commoditiesProfile.primaryCommoditiesLabel}?`,
      marketOddsCents: 64,
      modelFairOddsCents: 80,
      whyActExplanation: `6-model weather ensemble (WeatherNext 3, ECMWF IFS, GraphCast) confirms ${profile.weatherProfile.temperatureAnomalyC} and ${profile.weatherProfile.precipitationOrHydroAnomalyPct}, pricing fair odds at 80¢ vs 64¢ market consensus (+16% edge).`,
      traditionalHedgeTicker:
        profile.commoditiesProfile.trackedCommodities[0]?.symbol ||
        profile.stocksProfile.topStocksToWatch[0]?.ticker ||
        'KC=F',
      orderButtonLabel: 'Act: Buy YES ($5k)',
    },
  ];

  // Build the 4 Traditional Market Stock & Commodity Signals ("Which Stocks To Buy & What Is Affecting What")
  const baseStocks = profile.stocksProfile.topStocksToWatch;
  const primaryComm = profile.commoditiesProfile.trackedCommodities[0];

  const traditionalSignals: TraditionalStockSignal[] = [
    {
      id: `TRAD-SIG-${profile.iso2}-1`,
      actionBadge: 'BUY / LONG',
      ticker: isSweden
        ? 'VOLV-B.ST'
        : baseStocks[0]?.ticker || 'KC=F',
      companyName: isSweden
        ? 'AB Volvo (Heavy Industrial & Electrified Transport)'
        : baseStocks[0]?.companyName || profile.stocksProfile.benchmarkIndexName,
      sector: isSweden
        ? 'Industrial Manufacturing & Export Logistics'
        : baseStocks[0]?.sector || 'Flagship Equity Leader',
      currentSpotLabel: isSweden
        ? 'SEK 284.50'
        : profile.stocksProfile.benchmarkSpot,
      targetMovePct: '+5.8% Target (14d)',
      convictionScore: 91,
      rewardRiskRatio: '2.6x R/R',
      whatIsAffectingWhat: {
        weatherEffect: `${profile.weatherProfile.instituteAcronym} forecast (${profile.weatherProfile.precipitationOrHydroAnomalyPct}, ${profile.weatherProfile.temperatureAnomalyC}) stabilizes regional hydro/industrial power input costs and keeps North Sea / Baltic shipping lanes open.`,
        shipsAndReconEffect: `${exportShipsCount} outbound AIS cargo vessels (${ships[0]?.vesselName || 'Active Ro-Ro/Container Carrier'} carrying $${ships[0]?.estimatedCargoValueUsdM || 85}M) confirm strong physical order-book deliveries.`,
        monetaryAndFiscalEffect: `${profile.stocksProfile.centralBankName} policy (${profile.stocksProfile.policyRateLabel}) and ${profile.fxPairLabel} exchange rate boost export operating margins.`,
      },
      whyBuySummary: isSweden
        ? 'Buy VOLV-B.ST: Lower Nordic hydro-electricity industrial power costs (+38 mm SMHI reservoir surplus) + 4 outbound Gothenburg heavy-machinery vessels + Riksbank 2.75% rate-cut tailwind.'
        : `Buy ${baseStocks[0]?.ticker || 'Leader'}: Direct beneficiary of ${profile.weatherProfile.instituteAcronym} physical conditions, $${totalCargoUsdM}M tracked maritime trade flow, and ${profile.stocksProfile.centralBankName} policy stance.`,
      invalidationTrigger: `Stop/invalidate if ${profile.weatherProfile.instituteAcronym} 72h forecast reverses by >1.5σ or port berth congestion spikes.`,
      orderButtonLabel: `Act: Buy ${
        isSweden ? 'VOLV-B.ST' : baseStocks[0]?.ticker || 'LONG'
      } ($10k)`,
    },
    {
      id: `TRAD-SIG-${profile.iso2}-2`,
      actionBadge: 'BUY / LONG',
      ticker: isSweden
        ? 'ATCO-A.ST'
        : baseStocks[1]?.ticker || 'SBUX',
      companyName: isSweden
        ? 'Atlas Copco AB (Precision Industrial & Grid Compressors)'
        : baseStocks[1]?.companyName || 'Consumer & Retail Benchmark',
      sector: isSweden
        ? 'Industrial Capital Goods & Energy Transition'
        : baseStocks[1]?.sector || 'Domestic Demand & Retail',
      currentSpotLabel: isSweden
        ? 'SEK 192.80'
        : profile.stocksProfile.benchmarkSpot,
      targetMovePct: '+4.9% Target (14d)',
      convictionScore: 88,
      rewardRiskRatio: '2.3x R/R',
      whatIsAffectingWhat: {
        weatherEffect: `${profile.weatherProfile.implicationsForGridAndCrops}`,
        shipsAndReconEffect: `Optical satellite & street-level AI recon shows ${profile.stocksProfile.supermarketOccupancyPct}% occupancy (${profile.stocksProfile.supermarketCarsCounted}) at ${profile.stocksProfile.supermarketReconName}, confirming domestic capex & consumer resilience.`,
        monetaryAndFiscalEffect: `${profile.stocksProfile.fiscalPolicySummary}`,
      },
      whyBuySummary: isSweden
        ? 'Buy ATCO-A.ST: Semiconductor & green-grid compressor demand backed by 91% Stockholm optical activity telemetry and cheap Nordic baseload hydro power.'
        : `Buy ${baseStocks[1]?.ticker || 'Sector Leader'}: Supported by ${profile.stocksProfile.supermarketOccupancyPct}% optical car-park activity (${profile.stocksProfile.supermarketSalesPrediction}) and supportive fiscal capex.`,
      invalidationTrigger: `Invalidate if domestic PMI or optical retail footfall drops below 72% baseline.`,
      orderButtonLabel: `Act: Buy ${
        isSweden ? 'ATCO-A.ST' : baseStocks[1]?.ticker || 'LONG'
      } ($10k)`,
    },
    {
      id: `TRAD-SIG-${profile.iso2}-3`,
      actionBadge: 'OVERWEIGHT',
      ticker: isSweden
        ? 'AXFO.ST'
        : baseStocks[2]?.ticker || primaryComm?.symbol || 'OMXS30',
      companyName: isSweden
        ? 'Axfood AB / ICA Retail & Cold-Chain Distribution'
        : baseStocks[2]?.companyName ||
          primaryComm?.commodityName ||
          'Commodity & Supply Chain Leader',
      sector: 'Food/Retail Cold-Chain & Weather-Sensitive Margins',
      currentSpotLabel: isSweden
        ? 'SEK 268.40'
        : profile.stocksProfile.benchmarkSpot,
      targetMovePct: '+4.2% Target (10d)',
      convictionScore: 85,
      rewardRiskRatio: '2.1x R/R',
      whatIsAffectingWhat: {
        weatherEffect: `Predicted weather (${profile.weatherProfile.expectedPatternForecast}) directly drives cold-chain refrigeration load, crop procurement prices, and household grocery basket size.`,
        shipsAndReconEffect: `Street-view camera recon at ${profile.stocksProfile.supermarketReconName} counted ${profile.stocksProfile.supermarketCarsCounted} (${profile.stocksProfile.supermarketOccupancyPct}% full) → ${profile.stocksProfile.supermarketSalesPrediction}.`,
        monetaryAndFiscalEffect: `${profile.stocksProfile.monetaryPolicySummary}`,
      },
      whyBuySummary: `Buy ${
        isSweden
          ? 'AXFO.ST'
          : baseStocks[2]?.ticker || primaryComm?.symbol || 'Retail'
      }: Optical parking-lot recon (${
        profile.stocksProfile.supermarketOccupancyPct
      }% occupancy) + ${
        profile.weatherProfile.instituteAcronym
      } weather-driven grocery/energy demand.`,
      invalidationTrigger:
        'Invalidate if cold-chain logistics costs rise >8% faster than retail CPI pass-through.',
      orderButtonLabel: `Act: Buy ${
        isSweden
          ? 'AXFO.ST'
          : baseStocks[2]?.ticker || primaryComm?.symbol || 'LONG'
      } ($10k)`,
    },
    {
      id: `TRAD-SIG-${profile.iso2}-4`,
      actionBadge: 'TACTICAL LONG',
      ticker: isSweden
        ? 'OMXS30'
        : primaryComm?.symbol ||
          profile.stocksProfile.benchmarkIndexName.split(' ')[0],
      companyName: `${profile.stocksProfile.benchmarkIndexName} & ${profile.commoditiesProfile.primaryCommoditiesLabel}`,
      sector: 'Macro Index & Physical Commodity Basket',
      currentSpotLabel: profile.stocksProfile.benchmarkSpot,
      targetMovePct: '+3.9% Target (21d)',
      convictionScore: 84,
      rewardRiskRatio: '2.2x R/R',
      whatIsAffectingWhat: {
        weatherEffect: `${profile.weatherProfile.economicAndMarketEffects}`,
        shipsAndReconEffect: `${profile.commoditiesProfile.supplyChainStatusHeadline} ($${totalCargoUsdM}M across ${ships.length} AIS vessels).`,
        monetaryAndFiscalEffect: `${profile.stocksProfile.policyImpactOnEquities}`,
      },
      whyBuySummary: `Tactical Long ${
        isSweden
          ? 'OMXS30'
          : primaryComm?.symbol ||
            profile.stocksProfile.benchmarkIndexName.split(' ')[0]
      }: Synthesizes ${profile.weatherProfile.instituteAcronym} weather anomaly, ${
        ships.length
      } live AIS ships, and ${
        profile.stocksProfile.centralBankName
      } policy into a single liquid macro position.`,
      invalidationTrigger: `Invalidate on central bank hawkish surprise or >2σ reversal in ${profile.weatherProfile.instituteAcronym} ensemble.`,
      orderButtonLabel: `Act: Buy ${
        isSweden
          ? 'OMXS30'
          : primaryComm?.symbol ||
            profile.stocksProfile.benchmarkIndexName.split(' ')[0]
      } ($10k)`,
    },
  ];

  const handleActOnSignal = (id: string, label: string) => {
    setExecutedOrders((prev) => ({
      ...prev,
      [id]: `Executed Paper Order: ${label} at ${new Date().toLocaleTimeString()}`,
    }));
  };

  const liveInvestigation = atmosphere.activeInvestigation.live;
  if (liveInvestigation) {
    return (
      <section
        id="actionable-trade-playbook"
        data-testid="actionable-trade-playbook"
        className="rounded-3xl bg-[#070d19] border border-emerald-500/30 p-5 sm:p-7 shadow-2xl"
      >
        <LiveResearchIdeas live={liveInvestigation} />
      </section>
    );
  }

  return (
    <section
      id="actionable-trade-playbook"
      data-testid="actionable-trade-playbook"
      className="rounded-3xl bg-[#070d19] border border-emerald-500/30 p-5 sm:p-7 shadow-2xl space-y-6"
    >
      <FixtureBanner />
      {/* Top Badges matching reference screenshot */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-semibold tracking-wider uppercase">
            STEP 3 • ACTIONABLE TRADE PLAYBOOK
          </span>
          <span className="px-3 py-1 rounded-md bg-slate-900/90 border border-sky-500/30 text-sky-300 font-mono text-xs">
            {horizonLabel}
          </span>
        </div>

        {/* Quick Country Switcher Pills including Sweden, Brazil, UK, Japan, US */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-400 mr-1">
            Playbook Country:
          </span>
          {[
            { label: 'Sweden (SE)', query: 'Stockholm' },
            { label: 'Brazil (BR)', query: 'Sul de Minas Coffee Belt, Brazil' },
            { label: 'UK (GB)', query: 'London' },
            { label: 'Japan (JP)', query: 'Tokyo' },
            { label: 'USA (US)', query: 'New York' },
          ].map((c) => {
            const active =
              (c.label.includes('SE') && profile.iso2 === 'SE') ||
              (c.label.includes('BR') && profile.iso2 === 'BR') ||
              (c.label.includes('GB') && profile.iso2 === 'GB') ||
              (c.label.includes('JP') && profile.iso2 === 'JP') ||
              (c.label.includes('US') && profile.iso2 === 'US');
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => onSelectTickerOrRegion?.(c.query)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                    : 'bg-slate-900/80 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Title & Subtitle matching reference screenshot */}
      <div>
        <h2
          data-testid="playbook-country-heading"
          className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight"
        >
          What Trades To Act On ({profile.countryName})
        </h2>
        <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed max-w-5xl">
          Combining {profile.weatherProfile.instituteAcronym} weather
          simulations (
          {isSweden
            ? '+38 mm'
            : profile.weatherProfile.precipitationOrHydroAnomalyPct}
          ), {ships.length} live AIS cargo vessels (${totalCargoUsdM}M tracked
          goods), and {profile.stocksProfile.centralBankName} macro indicators (
          {profile.stocksProfile.policyRateLabel}) yields high-conviction setups
          in both traditional markets ({profile.stocksProfile.benchmarkIndexName}{' '}
          / {isSweden ? 'VOLV-B.ST, ATCO-A.ST' : topTickersList}) and binary
          prediction markets.
        </p>
      </div>

      {/* Segmented Filter Bar: All Signals (7) | Prediction Mkts (3) | Traditional Mkts (4) */}
      <div
        role="tablist"
        aria-label="Trade Playbook Signal Filter"
        className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#040811] border border-slate-800/90 max-w-2xl"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'ALL'}
          data-testid="playbook-tab-all"
          onClick={() => setActiveFilter('ALL')}
          className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeFilter === 'ALL'
              ? 'bg-emerald-950/90 text-white border border-emerald-400/50 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Signals (7)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'PREDICTION'}
          data-testid="playbook-tab-prediction"
          onClick={() => setActiveFilter('PREDICTION')}
          className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeFilter === 'PREDICTION'
              ? 'bg-emerald-950/90 text-white border border-emerald-400/50 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Prediction Mkts (3)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeFilter === 'TRADITIONAL'}
          data-testid="playbook-tab-traditional"
          onClick={() => setActiveFilter('TRADITIONAL')}
          className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeFilter === 'TRADITIONAL'
              ? 'bg-emerald-950/90 text-white border border-emerald-400/50 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Traditional Mkts (4)
        </button>
      </div>

      {/* =====================================================================
          PART 1: PREDICTION MARKETS (BINARY EVENT ODDS VS MODEL)
      ===================================================================== */}
      {(activeFilter === 'ALL' || activeFilter === 'PREDICTION') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-amber-400/90 px-1">
            <span>PREDICTION MARKETS (BINARY EVENT ODDS VS MODEL)</span>
            <span>EDGE &amp; PAYOUT</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {predictionSignals.map((sig) => (
              <article
                key={sig.id}
                data-testid={`prediction-signal-card-${sig.id}`}
                className="rounded-2xl bg-[#0b1220] border border-amber-500/35 p-5 flex flex-col justify-between space-y-4 shadow-xl"
              >
                <div className="space-y-4">
                  {/* Top Badge Row: ▲ BUY YES + Source Driver + Edge + Payout */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="px-2.5 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold leading-tight text-center">
                        ▲ BUY
                        <br />
                        YES
                      </div>
                      <div className="text-xs font-mono text-slate-300 leading-snug">
                        {sig.sourceDriverBadge}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold text-center">
                        +{sig.edgePct}%
                        <br />
                        Edge
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 font-mono text-xs font-bold text-center">
                        {sig.payoutMultiplier.split(' ')[0]}
                        <br />
                        Payout
                      </div>
                    </div>
                  </div>

                  {/* Contract Question */}
                  <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                    {sig.question}
                  </h3>

                  {/* Market Odds vs Model Fair Odds Progress Bar */}
                  <div className="p-3.5 rounded-xl bg-[#111a2e] border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300">
                        Market Odds:{' '}
                        <strong className="text-amber-400">
                          {sig.marketOddsCents}¢ ({sig.marketOddsCents}%)
                        </strong>
                      </span>
                      <span className="text-slate-300">
                        Model Fair Odds:{' '}
                        <strong className="text-emerald-400">
                          {sig.modelFairOddsCents}¢ ({sig.modelFairOddsCents}%)
                        </strong>
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-emerald-500/35 absolute top-0 left-0"
                        style={{ width: `${sig.modelFairOddsCents}%` }}
                      />
                      <div
                        className="h-full rounded-full bg-amber-400 relative"
                        style={{ width: `${sig.marketOddsCents}%` }}
                      />
                    </div>
                  </div>

                  {/* Why Act Explanation */}
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    <strong className="text-sky-300">Why Act:</strong>{' '}
                    {sig.whyActExplanation}
                  </p>
                </div>

                {/* Card Footer: Traditional Hedge + Act: Buy YES ($5k) */}
                <div className="pt-3 border-t border-slate-800/90 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-mono text-slate-400">
                      Traditional Hedge:{' '}
                      <strong className="text-white">
                        {sig.traditionalHedgeTicker}
                      </strong>
                    </div>
                    <button
                      type="button"
                      data-testid={`act-btn-${sig.id}`}
                      onClick={() =>
                        handleActOnSignal(sig.id, sig.orderButtonLabel)
                      }
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-xs font-extrabold transition-colors shadow-md cursor-pointer"
                    >
                      {sig.orderButtonLabel}
                    </button>
                  </div>
                  {executedOrders[sig.id] && (
                    <div className="text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{executedOrders[sig.id]}</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          PART 2: TRADITIONAL MARKETS (WHICH STOCKS TO BUY & WHAT IS AFFECTING WHAT)
      ===================================================================== */}
      {(activeFilter === 'ALL' || activeFilter === 'TRADITIONAL') && (
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400 px-1">
            <span>
              TRADITIONAL MARKETS — INSIGHTS ON STOCKS HAPPENING (WHICH TO BUY
              &amp; WHAT IS AFFECTING WHAT)
            </span>
            <span>WEATHER + AIS SHIPS + POLICY → STOCK IMPACT</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {traditionalSignals.map((stk) => (
              <article
                key={stk.id}
                data-testid={`traditional-signal-card-${stk.id}`}
                className="rounded-2xl bg-[#0b1220] border border-emerald-500/30 p-5 flex flex-col justify-between space-y-4 shadow-xl"
              >
                <div className="space-y-3.5">
                  {/* Top Row: Action Badge + Ticker + Target Move + Conviction */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold">
                        ▲ {stk.actionBadge}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 font-mono text-sm font-extrabold text-white">
                        {stk.ticker}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ({stk.currentSpotLabel})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-bold">
                        {stk.targetMovePct}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/40 text-sky-300 font-mono text-xs font-bold">
                        {stk.rewardRiskRatio}
                      </span>
                    </div>
                  </div>

                  {/* Company Name & Sector */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      {stk.companyName}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Sector: {stk.sector} • Conviction Score:{' '}
                      <strong className="text-emerald-300">
                        {stk.convictionScore}/100
                      </strong>
                    </div>
                  </div>

                  {/* WHAT IS AFFECTING WHAT (3-Pillar Causal Breakdown) */}
                  <div className="p-3.5 rounded-xl bg-[#111a2e] border border-slate-800 space-y-2.5 text-xs">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300">
                      What Is Affecting What (Live Causal Drivers):
                    </div>

                    <div className="flex items-start gap-2">
                      <CloudRain className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-sky-300">
                          1. Predicted Weather Impact:
                        </strong>{' '}
                        <span className="text-slate-200">
                          {stk.whatIsAffectingWhat.weatherEffect}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Ship className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-emerald-300">
                          2. AIS Ships &amp; Optical Recon:
                        </strong>{' '}
                        <span className="text-slate-200">
                          {stk.whatIsAffectingWhat.shipsAndReconEffect}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Landmark className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-300">
                          3. Monetary &amp; Fiscal Policy:
                        </strong>{' '}
                        <span className="text-slate-200">
                          {stk.whatIsAffectingWhat.monetaryAndFiscalEffect}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Why Buy / Act Now */}
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    <strong className="text-emerald-300">
                      Why Buy / Act Now:
                    </strong>{' '}
                    {stk.whyBuySummary}
                  </p>
                </div>

                {/* Footer: Invalidation + Act Button */}
                <div className="pt-3 border-t border-slate-800/90 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 max-w-[65%]">
                      <strong className="text-rose-300">Risk / Stop:</strong>{' '}
                      {stk.invalidationTrigger}
                    </span>
                    <button
                      type="button"
                      data-testid={`act-stock-btn-${stk.id}`}
                      onClick={() =>
                        handleActOnSignal(stk.id, stk.orderButtonLabel)
                      }
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-xs font-extrabold transition-colors shadow-md cursor-pointer"
                    >
                      {stk.orderButtonLabel}
                    </button>
                  </div>
                  {executedOrders[stk.id] && (
                    <div className="text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{executedOrders[stk.id]}</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
