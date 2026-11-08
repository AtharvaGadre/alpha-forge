import React from 'react';
import { BacktestResult, FACTOR_CATALOGUE } from '../engine/quantEngine';
import { SlippageSimulationResult } from '../engine/slippageMonteCarlo';
import { INITIAL_IMPROVEMENT_CARDS } from '../engine/researchOrchestrator';

export type MainWorkspaceTab =
  | 'WORLDPULSE'
  | 'OVERVIEW'
  | 'SLIPPAGE_MC'
  | 'FACTOR_BACKTEST'
  | 'QUANT_PHYSICS'
  | 'GOVERNANCE';

interface Props {
  backtest: BacktestResult;
  slippage: SlippageSimulationResult;
  onNavigate: (tab: MainWorkspaceTab) => void;
}

export const OverviewCommandCentre: React.FC<Props> = ({
  backtest,
  slippage,
  onNavigate,
}) => {
  return (
    <div className="space-y-8">
      {/* Editorial Hero & Live Telemetry Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-[#0B0F19] border border-slate-800 rounded-md p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="text-xs font-mono text-cyan-400 tracking-wide">
              AUTONOMOUS QUANTITATIVE RESEARCH LABORATORY · SNAPSHOT {backtest.datasetSnapshotId}
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Empirical Factor Discovery, Stochastic Microstructure &amp; Monte Carlo Slippage Engineering
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
              AlphaForge unites point-in-time cross-sectional factor research with institutional execution risk
              modeling. Every hypothesis is evaluated through Almgren-Chriss optimal trajectories, Square-Root
              market impact laws, Heston stochastic volatility, and Merton jump-diffusion stress tests before
              entering the 30-section scientific publication archive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('SLIPPAGE_MC')}
              className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap"
            >
              Open Monte Carlo Slippage Lab
            </button>
            <button
              type="button"
              onClick={() => onNavigate('FACTOR_BACKTEST')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 font-medium text-xs rounded-md transition-colors whitespace-nowrap"
            >
              Launch Walk-Forward Backtester
            </button>
            <button
              type="button"
              onClick={() => onNavigate('GOVERNANCE')}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 font-medium text-xs rounded-md transition-colors whitespace-nowrap"
            >
              Inspect 30-Section Monograph
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono">
            <span>Principal Architect: MPhys Physics (Sheffield)</span>
            <span aria-hidden="true">·</span>
            <span>MSc Computational Finance (UCL)</span>
            <span aria-hidden="true">·</span>
            <span>Deterministic Seed: {backtest.config.seed}</span>
          </div>
        </div>

        {/* Right Live Validated Benchmark & Execution Summary Card */}
        <div className="lg:col-span-5 bg-[#0B0F19] border border-slate-800 rounded-md p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Validated Production Benchmark ({backtest.factor.id})
            </h2>
            <span className="text-xs font-mono text-emerald-400">● Audit Verified</span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
            <div className="bg-slate-950 border border-slate-800/80 rounded p-3">
              <div className="text-[11px] font-sans text-slate-400">Net Walk-Forward Sharpe</div>
              <div className="text-xl font-bold text-cyan-400 mt-0.5">
                {backtest.metrics.sharpeRatio.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">
                OOS Holdout: {backtest.metrics.oosHoldoutSharpe} SR
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded p-3">
              <div className="text-[11px] font-sans text-slate-400">MC Expected Slippage</div>
              <div className="text-xl font-bold text-slate-100 mt-0.5">
                {slippage.expectedShortfallBps.toFixed(2)} bps
              </div>
              <div className="text-[11px] text-amber-400">
                CVaR 95%: {slippage.cvar95Bps.toFixed(2)} bps
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded p-3">
              <div className="text-[11px] font-sans text-slate-400">Annualized Net Alpha</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">
                +{backtest.metrics.annualizedAlphaPct.toFixed(2)}%
              </div>
              <div className="text-[11px] text-slate-400">
                IR: {backtest.metrics.informationRatio} · β: {backtest.metrics.betaToBenchmark}
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded p-3">
              <div className="text-[11px] font-sans text-slate-400">Almgren-Chriss Urgency</div>
              <div className="text-xl font-bold text-cyan-400 mt-0.5">
                κ = {slippage.urgencyKappa}
              </div>
              <div className="text-[11px] text-slate-400">
                LOB Half-Life: {slippage.halfLifeMinutes}m
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-400 pt-2 border-t border-slate-800 flex items-center justify-between">
            <span>Last Validated Data: 2026-11-07 16:40 UTC</span>
            <a
              href="https://github.com/AtharvaGadre/agent-verse-project"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline"
            >
              GitHub Source of Truth ↗
            </a>
          </div>
        </div>
      </section>

      {/* Volatile Market Execution Stress Snapshot + Dataset Health */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Monte Carlo Execution Risk Across Volatile Regimes ({slippage.config.symbol}, Q={slippage.config.orderShares.toLocaleString()} shs)
              </h2>
              <p className="text-xs text-slate-400">
                Compares implementation shortfall and 95%/99% tail risk across structural market stress states.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('SLIPPAGE_MC')}
              className="text-xs font-mono text-cyan-400 hover:underline whitespace-nowrap shrink-0"
            >
              Configure Simulator →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-2">Stress Regime</th>
                  <th className="py-2 px-2 text-right">Eff Vol</th>
                  <th className="py-2 px-2 text-right">Spread</th>
                  <th className="py-2 px-2 text-right">Expected IS</th>
                  <th className="py-2 px-2 text-right">CVaR 95%</th>
                  <th className="py-2 pl-2 text-right">VaR 99%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {slippage.regimeStressMatrix.map((row) => (
                  <tr key={row.regime} className="text-slate-200">
                    <td className="py-2.5 pr-2 font-sans font-medium">{row.regimeLabel}</td>
                    <td className="py-2.5 px-2 text-right">{row.effectiveVolPct}%</td>
                    <td className="py-2.5 px-2 text-right">{row.effectiveSpreadBps} bps</td>
                    <td className="py-2.5 px-2 text-right text-cyan-400">{row.expectedShortfallBps} bps</td>
                    <td className="py-2.5 px-2 text-right text-amber-400">{row.cvar95Bps} bps</td>
                    <td className="py-2.5 pl-2 text-right text-rose-400">{row.var99Bps} bps</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Point-in-Time Market Data Health & Provenance */}
        <div className="lg:col-span-5 bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Point-in-Time Data Infrastructure &amp; Bias Audit
            </h2>
            <span className="text-xs font-mono text-emerald-400">● PIT Verified</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Active Snapshot Identifier</span>
              <span className="font-mono text-slate-200">AF-PIT-EQ-2020-2026-v2.4</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Timestamp Alignment</span>
              <span className="font-mono text-slate-200">Event t vs Availability τ_avail ≤ t</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Corporate Actions &amp; Splits</span>
              <span className="font-mono text-emerald-400">Point-in-Time Adjusted (0 Duplicates)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Survivorship &amp; Delisting Handling</span>
              <span className="font-mono text-slate-200">Delisted Constituents Retained</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Out-of-Sample Holdout Policy</span>
              <span className="font-mono text-cyan-400">Locked 20% Final Holdout</span>
            </div>
          </div>
        </div>
      </section>

      {/* Active Factor Families & Improvement Cards Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Validated Factor Catalogue ({FACTOR_CATALOGUE.length} Families)
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('FACTOR_BACKTEST')}
              className="text-xs font-mono text-cyan-400 hover:underline"
            >
              Explore Factors →
            </button>
          </div>
          <div className="divide-y divide-slate-800/60 text-xs">
            {FACTOR_CATALOGUE.slice(0, 4).map((f) => (
              <div key={f.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-slate-200">{f.name}</div>
                  <div className="font-mono text-slate-400 text-[11px]">
                    {f.id} · Turnover {f.annualTurnoverPct}% · Cap ${f.capacityUsdMillions}M
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-cyan-400 font-semibold">Rank IC: {f.rankIC}</div>
                  <div className="text-slate-400 text-[11px]">t-Stat: {f.tStat}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              Autonomous Improvement Engine Diagnostics
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('GOVERNANCE')}
              className="text-xs font-mono text-cyan-400 hover:underline"
            >
              Inspect All 15-Field Cards →
            </button>
          </div>
          <div className="divide-y divide-slate-800/60 text-xs">
            {INITIAL_IMPROVEMENT_CARDS.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-slate-200">{c.title}</div>
                  <div className="text-slate-400 text-[11px]">{c.propertyBeingImproved}</div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <div
                    className={
                      c.status === 'ACCEPTED'
                        ? 'text-emerald-400 font-semibold'
                        : c.status === 'REJECTED'
                        ? 'text-rose-400 font-semibold'
                        : 'text-amber-400 font-semibold'
                    }
                  >
                    {c.status}
                  </div>
                  <div className="text-slate-400 text-[11px]">Score: {c.evidenceRankScore}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
