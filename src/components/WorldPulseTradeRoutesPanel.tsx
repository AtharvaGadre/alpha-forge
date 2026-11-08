import React, { useMemo, useState } from 'react';
import {
  type CountryTradeRouteCorridor,
  type TradeDeepDiveDimension,
} from '../engine/worldToAlphaEngine.ts';

export type TradeRouteFilterMode = 'ALL' | 'EXPORT_ONLY' | 'IMPORT_ONLY' | 'HIDDEN';

interface WorldPulseTradeRoutesPanelProps {
  countryIso2: string;
  countryName: string;
  tradeRoutes: CountryTradeRouteCorridor[];
  selectedRouteId: string | null;
  onSelectRoute: (route: CountryTradeRouteCorridor) => void;
  tradeFilterMode: TradeRouteFilterMode;
  onChangeTradeFilterMode: (mode: TradeRouteFilterMode) => void;
  onSelectPartnerCountry?: (partnerIso2: string) => void;
}

export const WorldPulseTradeRoutesPanel: React.FC<
  WorldPulseTradeRoutesPanelProps
> = ({
  countryIso2,
  countryName,
  tradeRoutes,
  selectedRouteId,
  onSelectRoute,
  tradeFilterMode,
  onChangeTradeFilterMode,
  onSelectPartnerCountry,
}) => {
  const [deepDiveTab, setDeepDiveTab] =
    useState<TradeDeepDiveDimension>('OVERVIEW_BALANCE');

  const filteredRoutes = useMemo(() => {
    if (tradeFilterMode === 'EXPORT_ONLY') {
      return tradeRoutes.filter((r) => r.direction === 'EXPORT');
    }
    if (tradeFilterMode === 'IMPORT_ONLY') {
      return tradeRoutes.filter((r) => r.direction === 'IMPORT');
    }
    return tradeRoutes;
  }, [tradeRoutes, tradeFilterMode]);

  const activeRoute: CountryTradeRouteCorridor = useMemo(() => {
    return (
      filteredRoutes.find((r) => r.id === selectedRouteId) ||
      filteredRoutes[0] ||
      tradeRoutes[0]
    );
  }, [filteredRoutes, selectedRouteId, tradeRoutes]);

  const summaryStats = useMemo(() => {
    const exportsList = tradeRoutes.filter((r) => r.direction === 'EXPORT');
    const importsList = tradeRoutes.filter((r) => r.direction === 'IMPORT');
    const totalExportUsdB = exportsList.reduce(
      (acc, r) => acc + r.annualVolumeUsdBillions,
      0
    );
    const totalImportUsdB = importsList.reduce(
      (acc, r) => acc + r.annualVolumeUsdBillions,
      0
    );
    return {
      exportCount: exportsList.length,
      importCount: importsList.length,
      totalExportUsdB: Number(totalExportUsdB.toFixed(1)),
      totalImportUsdB: Number(totalImportUsdB.toFixed(1)),
      netBalanceUsdB: Number((totalExportUsdB - totalImportUsdB).toFixed(1)),
    };
  }, [tradeRoutes]);

  if (!activeRoute) return null;

  const deepDiveTabs: Array<{
    id: TradeDeepDiveDimension;
    label: string;
    subtitle: string;
  }> = [
    {
      id: 'OVERVIEW_BALANCE',
      label: '1. Corridor Overview & Volume',
      subtitle: 'Bilateral flow, transit days & transport mode',
    },
    {
      id: 'GOODS_COMMODITIES',
      label: '2. Traded Goods & Commodities',
      subtitle: 'Category shares, value ($B) & supply-chain role',
    },
    {
      id: 'CHOKEPOINTS_TARIFFS',
      label: '3. Chokepoints & Tariff Policy',
      subtitle: 'Maritime bottlenecks, FTA rules & disruption risk',
    },
    {
      id: 'STOCKS_FX_IMPACT',
      label: '4. Stocks, Shipping & FX to Watch',
      subtitle: 'Equities, futures & currency pairs tied to route',
    },
  ];

  return (
    <section
      aria-label={`Selected Country Two-Colour Trade Routes for ${countryName}`}
      className="rounded-2xl bg-slate-900/95 border border-slate-800 p-5 shadow-xl space-y-4"
    >
      {/* Top Header: Selected Country Trade Summary + Two-Colour Filter (Exports Emerald | Imports Amber) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-mono font-bold text-emerald-300">
              EXPORTS (EMERALD) · ${summaryStats.totalExportUsdB}B
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[11px] font-mono font-bold text-amber-300">
              IMPORTS (AMBER) · ${summaryStats.totalImportUsdB}B
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
              Tracked Balance:{' '}
              <strong
                className={
                  summaryStats.netBalanceUsdB >= 0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }
              >
                {summaryStats.netBalanceUsdB >= 0 ? '+' : ''}$
                {summaryStats.netBalanceUsdB}B
              </strong>
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-1.5">
            {countryName} ({countryIso2}) — Two-Colour Global Trade Routes &amp; Deep-Dive Explorer
          </h2>
          <p className="text-xs text-slate-300">
            On the 3D Globe above,{' '}
            <strong className="text-emerald-400">Emerald Green lines</strong>{' '}
            show outbound <strong>Exports</strong> from {countryName} and{' '}
            <strong className="text-amber-400">Amber Gold lines</strong> show
            inbound <strong>Imports</strong> into {countryName}. Click any route
            to dive into goods, chokepoints, tariffs, and stocks.
          </p>
        </div>

        {/* Two-Colour Globe & List Filter Buttons */}
        <div
          role="group"
          aria-label="Filter Country Trade Routes by Export or Import"
          className="inline-flex flex-wrap sm:flex-nowrap rounded-xl bg-slate-950 border border-slate-800 p-1 gap-1 self-start shrink-0"
        >
          <button
            type="button"
            onClick={() => onChangeTradeFilterMode('ALL')}
            className={` whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tradeFilterMode === 'ALL'
                ? 'bg-cyan-400 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            All Routes ({tradeRoutes.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeTradeFilterMode('EXPORT_ONLY')}
            className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tradeFilterMode === 'EXPORT_ONLY'
                ? 'bg-emerald-400 text-slate-950 font-bold'
                : 'text-emerald-300 hover:bg-emerald-500/15'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 border border-slate-950 shrink-0" />
            Exports Only ({summaryStats.exportCount})
          </button>
          <button
            type="button"
            onClick={() => onChangeTradeFilterMode('IMPORT_ONLY')}
            className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tradeFilterMode === 'IMPORT_ONLY'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-amber-300 hover:bg-amber-500/15'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 border border-slate-950 shrink-0" />
            Imports Only ({summaryStats.importCount})
          </button>
        </div>
      </div>

      {/* Corridor Selector Cards (Emerald for Export | Amber for Import) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredRoutes.map((route) => {
          const isSelected = route.id === activeRoute.id;
          const isExport = route.direction === 'EXPORT';
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onSelectRoute(route)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? isExport
                    ? 'bg-emerald-950/30 border-emerald-400 shadow-lg'
                    : 'bg-amber-950/30 border-amber-400 shadow-lg'
                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`whitespace-nowrap inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    isExport
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isExport ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  {isExport
                    ? `EXPORT: ${route.selectedCountryIso2} → ${route.partnerIso2}`
                    : `IMPORT: ${route.partnerIso2} → ${route.selectedCountryIso2}`}
                </span>
                <span className="text-xs font-mono font-bold text-white whitespace-nowrap">
                  ${route.annualVolumeUsdBillions}B
                </span>
              </div>

              <div className="text-xs font-bold text-slate-100 mt-1.5 line-clamp-1">
                {isExport
                  ? `To ${route.partnerCountryName} (${route.partnerHubName.split('/')[0].trim()})`
                  : `From ${route.partnerCountryName} (${route.partnerHubName.split('/')[0].trim()})`}
              </div>

              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {route.topTradedGoods.map((g) => g.categoryName).join(' · ')}
              </p>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 pt-1.5 border-t border-slate-800/80">
                <span>YoY: +{route.yoyGrowthPct}%</span>
                <span>Transit: {route.avgTransitDays}d</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Broader Deep-Dive Options Switcher (4 Dimensions for the Selected Trade Corridor) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold ${
                activeRoute.direction === 'EXPORT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {activeRoute.direction === 'EXPORT'
                ? `OUTBOUND EXPORT CORRIDOR (${activeRoute.selectedCountryIso2} → ${activeRoute.partnerIso2})`
                : `INBOUND IMPORT CORRIDOR (${activeRoute.partnerIso2} → ${activeRoute.selectedCountryIso2})`}
            </span>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {activeRoute.headline}
            </h3>
          </div>

          {onSelectPartnerCountry && (
            <button
              type="button"
              onClick={() => onSelectPartnerCountry(activeRoute.partnerIso2)}
              className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-xs font-semibold text-cyan-300 self-start"
            >
              Switch Globe to Partner ({activeRoute.partnerCountryName}) →
            </button>
          )}
        </div>

        {/* 4 Broader Exploration Dimension Tabs */}
        <div
          role="tablist"
          aria-label="Trade Route Deep-Dive Dimensions"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
        >
          {deepDiveTabs.map((tab) => {
            const isTabActive = deepDiveTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isTabActive}
                onClick={() => setDeepDiveTab(tab.id)}
                className={`text-left px-3 py-2 rounded-xl border transition-all ${
                  isTabActive
                    ? 'bg-slate-900 border-cyan-400/80 shadow-md'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  className={`text-xs font-bold ${
                    isTabActive ? 'text-cyan-300' : 'text-slate-200'
                  }`}
                >
                  {tab.label}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {tab.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        {/* Deep-Dive Content Panel based on Selected Tab */}
        {deepDiveTab === 'OVERVIEW_BALANCE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-semibold text-cyan-300">
                Why This Corridor Matters for {activeRoute.selectedCountryName}{' '}
                &amp; {activeRoute.partnerCountryName}
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {activeRoute.plainEnglishSummary}
              </p>
              <div className="text-xs text-slate-400 pt-1">
                <strong className="text-slate-200">Partner Hub:</strong>{' '}
                {activeRoute.partnerHubName} ·{' '}
                <strong className="text-slate-200">Chokepoint:</strong>{' '}
                {activeRoute.chokepointName}
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 gap-2.5 font-mono">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400">ANNUAL VOLUME</div>
                <div
                  className={`text-base font-bold mt-0.5 ${
                    activeRoute.direction === 'EXPORT'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  ${activeRoute.annualVolumeUsdBillions} Billion
                </div>
                <div className="text-[11px] text-slate-400">
                  YoY Growth: +{activeRoute.yoyGrowthPct}%
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400">AVG TRANSIT</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {activeRoute.avgTransitDays} Days
                </div>
                <div className="text-[11px] text-cyan-300 truncate">
                  {activeRoute.primaryTransportMode.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 col-span-2">
                <div className="text-[10px] text-slate-400">
                  TOP TRADED CATEGORIES ON THIS ROUTE
                </div>
                <div className="text-xs text-slate-200 font-sans mt-1">
                  {activeRoute.topTradedGoods
                    .map((g) => `${g.categoryName} (${g.sharePct}%)`)
                    .join(' · ')}
                </div>
              </div>
            </div>
          </div>
        )}

        {deepDiveTab === 'GOODS_COMMODITIES' && (
          <div className="space-y-3 pt-1">
            <div className="text-xs font-semibold text-emerald-300">
              Product &amp; Commodity Breakdown on {activeRoute.selectedCountryIso2}{' '}
              ↔ {activeRoute.partnerIso2} Corridor (${activeRoute.annualVolumeUsdBillions}B/yr)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activeRoute.topTradedGoods.map((good) => (
                <div
                  key={good.categoryName}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      {good.categoryName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold">
                      ${good.annualValueUsdB}B ({good.sharePct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        activeRoute.direction === 'EXPORT'
                          ? 'bg-emerald-400'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, good.sharePct * 1.4)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {good.supplyChainRole}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {deepDiveTab === 'CHOKEPOINTS_TARIFFS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300">
                  Physical Chokepoint &amp; Transit Vulnerability
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    activeRoute.chokepointRiskLevel === 'CRITICAL' ||
                    activeRoute.chokepointRiskLevel === 'ELEVATED'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  RISK: {activeRoute.chokepointRiskLevel}
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {activeRoute.chokepointName}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Average transit duration is{' '}
                <strong className="text-white">
                  {activeRoute.avgTransitDays} days
                </strong>{' '}
                via{' '}
                {activeRoute.primaryTransportMode
                  .toLowerCase()
                  .replace(/_/g, ' ')}
                . Any port congestion, canal draft restriction, or naval escort
                surcharge along {activeRoute.chokepointName} directly impacts
                inventory lead times.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="text-xs font-semibold text-cyan-300">
                Tariff Regime, Trade Policy &amp; Macro Sensitivity
              </div>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {activeRoute.tariffAndPolicyNote}
              </p>
            </div>
          </div>
        )}

        {deepDiveTab === 'STOCKS_FX_IMPACT' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {activeRoute.impactedTickersAndFx.map((asset) => (
              <div
                key={asset.symbol}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {asset.symbol}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                    {asset.assetClass.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs font-bold text-white">{asset.name}</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {asset.sensitivityNote}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
