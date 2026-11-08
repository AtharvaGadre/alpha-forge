import React, { useState } from 'react';
import {
  SlippageSimulationConfig,
  SlippageSimulationResult,
  ExecutionScheduleType,
  MarketRegimeType,
  runSlippageMonteCarlo,
} from '../engine/slippageMonteCarlo';

interface Props {
  simResult: SlippageSimulationResult;
  onUpdateResult: (res: SlippageSimulationResult) => void;
}

const SYMBOL_PRESETS: Record<
  string,
  { price: number; adv: number; vol: number; spread: number; label: string }
> = {
  'NVDA-EQ': { price: 142.5, adv: 1500000, vol: 0.38, spread: 4.2, label: 'NVDA · High-Beta Semicon' },
  'MSFT-EQ': { price: 428.0, adv: 1800000, vol: 0.22, spread: 2.8, label: 'MSFT · Mega-Cap Core' },
  'SPY-ETF': { price: 585.0, adv: 4500000, vol: 0.16, spread: 1.4, label: 'SPY · S&P 500 Index ETF' },
  'SMH-SEMI': { price: 254.0, adv: 950000, vol: 0.34, spread: 3.9, label: 'SMH · Semiconductor Basket' },
  'IWM-SMALL': { price: 221.0, adv: 1100000, vol: 0.29, spread: 5.6, label: 'IWM · Small-Cap Liquidity Proxy' },
};

export const SlippageMonteCarloLab: React.FC<Props> = ({ simResult, onUpdateResult }) => {
  const [config, setConfig] = useState<SlippageSimulationConfig>(simResult.config);
  const [isRunning, setIsRunning] = useState(false);
  const [hoverStep, setHoverStep] = useState<number | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'FAN_SHORTFALL' | 'TRAJECTORIES'>('FAN_SHORTFALL');

  const executeSimulation = async (override?: Partial<SlippageSimulationConfig>) => {
    const nextCfg: SlippageSimulationConfig = { ...config, ...override };
    setConfig(nextCfg);
    setIsRunning(true);
    try {
      const response = await fetch('/api/slippage/montecarlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextCfg),
      });
      if (response.ok) {
        const data: SlippageSimulationResult = await response.json();
        onUpdateResult(data);
      } else {
        onUpdateResult(runSlippageMonteCarlo(nextCfg));
      }
    } catch {
      onUpdateResult(runSlippageMonteCarlo(nextCfg));
    } finally {
      setIsRunning(false);
    }
  };

  const handleSymbolChange = (sym: string) => {
    const preset = SYMBOL_PRESETS[sym];
    if (!preset) return;
    executeSimulation({
      symbol: sym,
      initialPrice: preset.price,
      advShares: preset.adv,
      annualizedVol: preset.vol,
      baseSpreadBps: preset.spread,
    });
  };

  const handleExportCsv = () => {
    const headers = [
      'Step,Minute,AC_Remaining_Pct,TWAP_Remaining_Pct,VWAP_Remaining_Pct,POV_Remaining_Pct,P05_Shortfall_Bps,P50_Shortfall_Bps,P95_Shortfall_Bps,P99_Shortfall_Bps,LOB_Depletion_Bps',
    ];
    const rows = simResult.trajectories.map((t, i) => {
      const f = simResult.fanChart[i] || simResult.fanChart[0];
      return `${t.step},${t.minute},${t.almgrenChrissRemainingPct},${t.twapRemainingPct},${t.vwapRemainingPct},${t.povRemainingPct},${f.p05ShortfallBps},${f.p50ShortfallBps},${f.p95ShortfallBps},${f.p99ShortfallBps},${t.expectedLobDepthDepletionBps}`;
    });
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alphaforge-slippage-mc-${simResult.config.symbol}-${simResult.config.regime}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG Fan Chart Geometry
  const svgW = 760;
  const svgH = 290;
  const padL = 52;
  const padR = 24;
  const padT = 20;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const fan = simResult.fanChart;
  const minFanY = Math.min(0, ...fan.map((d) => d.p05ShortfallBps));
  const maxFanY = Math.max(10, ...fan.map((d) => d.p99ShortfallBps)) * 1.08;

  const xPos = (idx: number) => padL + (idx / Math.max(1, fan.length - 1)) * plotW;
  const yPosFan = (val: number) =>
    padT + plotH - ((val - minFanY) / Math.max(1, maxFanY - minFanY)) * plotH;

  const buildPolygon = (upperKey: keyof (typeof fan)[0], lowerKey: keyof (typeof fan)[0]) => {
    const topPts = fan.map((d, i) => `${xPos(i).toFixed(1)},${yPosFan(Number(d[upperKey])).toFixed(1)}`);
    const botPts = [...fan]
      .reverse()
      .map((d, i) => {
        const origIdx = fan.length - 1 - i;
        return `${xPos(origIdx).toFixed(1)},${yPosFan(Number(d[lowerKey])).toFixed(1)}`;
      });
    return [...topPts, ...botPts].join(' ');
  };

  const buildPolyline = (key: keyof (typeof fan)[0]) =>
    fan.map((d, i) => `${xPos(i).toFixed(1)},${yPosFan(Number(d[key])).toFixed(1)}`).join(' ');

  // Trajectory SVG helpers (0% to 100%)
  const yPosPct = (pct: number) => padT + plotH - (pct / 100) * plotH;
  const buildTrajLine = (key: 'almgrenChrissRemainingPct' | 'twapRemainingPct' | 'vwapRemainingPct' | 'povRemainingPct') =>
    simResult.trajectories
      .map((t, i) => `${xPos(i).toFixed(1)},${yPosPct(t[key]).toFixed(1)}`)
      .join(' ');

  const inspectedIdx = hoverStep !== null && fan[hoverStep] ? hoverStep : fan.length - 1;
  const inspectedFan = fan[inspectedIdx] || fan[0];
  const inspectedTraj = simResult.trajectories[inspectedIdx] || simResult.trajectories[0];

  const maxHistFreq = Math.max(1, ...simResult.histogram.map((h) => h.frequencyPct));

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono text-cyan-400 tracking-wide">
            MICROSTRUCTURE & STOCHASTIC EXECUTION ENGINE · {simResult.checksum.slice(0, 19)}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
            Monte Carlo Execution &amp; Slippage Risk Laboratory
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Simulates implementation shortfall across Heston stochastic volatility, Merton Poisson price jumps,
            Obizhaeva-Wang transient order-book resilience, and Almgren-Chriss hyperbolic execution trajectories.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Download Trajectory CSV
          </button>
          <button
            type="button"
            onClick={() => executeSimulation()}
            disabled={isRunning}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            {isRunning ? 'Simulating Paths...' : 'Run Monte Carlo Simulation'}
          </button>
        </div>
      </div>

      {/* Main Asymmetric Split Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Parameter & Control Column (4 cols on 12-col grid) */}
        <aside className="lg:col-span-4 bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Execution &amp; Microstructure Parameters
            </h2>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              M = {config.monteCarloPaths} paths
            </span>
          </div>

          {/* Instrument & Schedule Selectors */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="slippage-symbol-select"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Target Instrument &amp; Liquidity Profile
              </label>
              <select
                id="slippage-symbol-select"
                value={config.symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {Object.entries(SYMBOL_PRESETS).map(([sym, info]) => (
                  <option key={sym} value={sym}>
                    {info.label} (S0=${info.price}, ADV={(info.adv / 1e6).toFixed(2)}M)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Market Volatility &amp; Liquidity Regime
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'NORMAL', label: 'Normal Equilibrium' },
                    { id: 'ELEVATED_VOL', label: 'Elevated Macro Vol' },
                    { id: 'FLASH_CRASH', label: 'Flash Crash Jump' },
                    { id: 'LIQUIDITY_DROUGHT', label: 'Liquidity Drought' },
                  ] as { id: MarketRegimeType; label: string }[]
                ).map((reg) => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => executeSimulation({ regime: reg.id })}
                    className={`px-2.5 py-2 text-xs font-medium rounded-md border text-left transition-colors whitespace-nowrap truncate ${
                      config.regime === reg.id
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {reg.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Execution Trajectory Algorithm
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'ALMGREN_CHRISS', label: 'Almgren-Chriss' },
                    { id: 'TWAP', label: 'Uniform TWAP' },
                    { id: 'VWAP', label: 'Intraday VWAP' },
                    { id: 'POV', label: 'Dynamic POV' },
                  ] as { id: ExecutionScheduleType; label: string }[]
                ).map((sched) => (
                  <button
                    key={sched.id}
                    type="button"
                    onClick={() => executeSimulation({ scheduleType: sched.id })}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                      config.scheduleType === sched.id
                        ? 'bg-slate-100 text-slate-950 border-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sched.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Continuous Numerical Scrubbers */}
          <div className="space-y-3.5 pt-2 border-t border-slate-800/80">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="order-shares-range" className="text-slate-300">
                  Order Size Q (Shares)
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {config.orderShares.toLocaleString()} ({simResult.participationRateAdvPct}% ADV)
                </span>
              </div>
              <input
                id="order-shares-range"
                type="range"
                min={25000}
                max={600000}
                step={25000}
                value={config.orderShares}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, orderShares: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="vol-range" className="text-slate-300">
                  Base Annualized Volatility (σ)
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {(config.annualizedVol * 100).toFixed(0)}%
                </span>
              </div>
              <input
                id="vol-range"
                type="range"
                min={0.1}
                max={0.95}
                step={0.02}
                value={config.annualizedVol}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, annualizedVol: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="risk-aversion-range" className="text-slate-300">
                  Almgren-Chriss Risk Aversion (λ)
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {config.riskAversionLambda.toExponential(1)} (κ={simResult.urgencyKappa})
                </span>
              </div>
              <input
                id="risk-aversion-range"
                type="range"
                min={0.00002}
                max={0.0012}
                step={0.00004}
                value={config.riskAversionLambda}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, riskAversionLambda: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="temp-eta-range" className="text-slate-300">
                  Temporary Impact Coeff (η) &amp; Sqrt-Y
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  η={config.tempImpactEta.toFixed(2)} · Y={config.sqrtImpactY.toFixed(2)}
                </span>
              </div>
              <input
                id="temp-eta-range"
                type="range"
                min={0.05}
                max={0.45}
                step={0.01}
                value={config.tempImpactEta}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, tempImpactEta: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="lob-rho-range" className="text-slate-300">
                  LOB Resilience Recovery Rate (ρ / hr)
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {config.lobResilienceRho.toFixed(1)}/hr (τ½={simResult.halfLifeMinutes}m)
                </span>
              </div>
              <input
                id="lob-rho-range"
                type="range"
                min={0.8}
                max={8.0}
                step={0.2}
                value={config.lobResilienceRho}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, lobResilienceRho: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="mc-paths-range" className="text-slate-300">
                  Monte Carlo Realizations (M)
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {config.monteCarloPaths} paths
                </span>
              </div>
              <input
                id="mc-paths-range"
                type="range"
                min={100}
                max={1200}
                step={100}
                value={config.monteCarloPaths}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, monteCarloPaths: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => executeSimulation()}
            className="w-full py-2.5 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-md transition-colors"
          >
            Recompute Stochastic Slippage Surface
          </button>
        </aside>

        {/* Right Analytical Stage (8 cols on 12-col grid) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Top 4-Card Telemetry Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Expected Shortfall E[IS]</div>
              <div className="mt-1 flex items-baseline">
                <span
                  data-testid="metric-expected-shortfall"
                  className="text-2xl font-mono font-semibold text-slate-100 tabular-nums"
                >
                  {simResult.expectedShortfallBps.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">bps</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                ${simResult.expectedShortfallUsd.toLocaleString()} · σ={simResult.stdDevShortfallBps} bps
              </div>
            </div>

            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Execution VaR / CVaR (95%)</div>
              <div className="mt-1 flex items-baseline">
                <span
                  data-testid="metric-cvar95"
                  className="text-2xl font-mono font-semibold text-amber-400 tabular-nums"
                >
                  {simResult.cvar95Bps.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">bps CVaR</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                VaR 95%: {simResult.var95Bps.toFixed(2)} bps
              </div>
            </div>

            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Extreme Tail Risk (99%)</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-rose-400 tabular-nums">
                  {simResult.cvar99Bps.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">bps CVaR</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                VaR 99%: {simResult.var99Bps.toFixed(2)} bps
              </div>
            </div>

            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Square-Root Law &amp; Urgency</div>
              <div className="mt-1 flex items-baseline">
                <span className="text-2xl font-mono font-semibold text-cyan-400 tabular-nums">
                  {simResult.squareRootLawEstimateBps.toFixed(2)}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1.5">bps √Q/V</span>
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                κ={simResult.urgencyKappa} · Notional ${(simResult.orderNotionalUsd / 1e6).toFixed(2)}M
              </div>
            </div>
          </div>

          {/* Primary Interactive Canvas Card: Fan Chart & Inventory Trajectories */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {activeChartTab === 'FAN_SHORTFALL'
                    ? 'Monte Carlo Implementation Shortfall Fan Trajectory (P05 / P25 / P50 / P75 / P95 / P99)'
                    : 'Almgren-Chriss Optimal Liquidation Trajectory vs TWAP, VWAP & POV'}
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5 tabular-nums">
                  Slice t={inspectedFan.minute}m · Median Shortfall: {inspectedFan.p50ShortfallBps} bps ·
                  P95 Band: {inspectedFan.p95ShortfallBps} bps · AC Inventory:{' '}
                  {inspectedTraj.almgrenChrissRemainingPct}% · LOB Depletion:{' '}
                  {inspectedTraj.expectedLobDepthDepletionBps} bps
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveChartTab('FAN_SHORTFALL')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    activeChartTab === 'FAN_SHORTFALL'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Shortfall Fan (bps)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChartTab('TRAJECTORIES')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    activeChartTab === 'TRAJECTORIES'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Inventory &amp; LOB Curves
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {activeChartTab === 'FAN_SHORTFALL' ? (
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-64 cursor-crosshair select-none"
                  role="img"
                  aria-label="Monte Carlo Implementation Shortfall Fan Chart"
                >
                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                    const val = minFanY + frac * (maxFanY - minFanY);
                    const y = yPosFan(val);
                    return (
                      <g key={idx}>
                        <line
                          x1={padL}
                          y1={y}
                          x2={svgW - padR}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padL - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[10px] font-mono"
                        >
                          {val.toFixed(0)} bps
                        </text>
                      </g>
                    );
                  })}

                  {/* P05 - P99 Outer Tail Envelope */}
                  <polygon
                    points={buildPolygon('p99ShortfallBps', 'p05ShortfallBps')}
                    fill="rgba(244, 63, 94, 0.10)"
                  />
                  {/* P05 - P95 Envelope */}
                  <polygon
                    points={buildPolygon('p95ShortfallBps', 'p05ShortfallBps')}
                    fill="rgba(245, 158, 11, 0.14)"
                  />
                  {/* P25 - P75 Interquartile Envelope */}
                  <polygon
                    points={buildPolygon('p75ShortfallBps', 'p25ShortfallBps')}
                    fill="rgba(6, 182, 212, 0.22)"
                  />

                  {/* P99, P95, P50, P05 Lines */}
                  <polyline
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    points={buildPolyline('p99ShortfallBps')}
                  />
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    points={buildPolyline('p95ShortfallBps')}
                  />
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    points={buildPolyline('p50ShortfallBps')}
                  />
                  <polyline
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                    points={buildPolyline('p05ShortfallBps')}
                  />

                  {/* Interactive Hover Slices */}
                  {fan.map((d, i) => (
                    <g key={d.step}>
                      <rect
                        x={xPos(i) - plotW / fan.length / 2}
                        y={padT}
                        width={plotW / fan.length}
                        height={plotH}
                        fill="transparent"
                        onMouseEnter={() => setHoverStep(i)}
                      />
                      {i % 4 === 0 && (
                        <text
                          x={xPos(i)}
                          y={svgH - 8}
                          textAnchor="middle"
                          className="fill-slate-400 text-[10px] font-mono"
                        >
                          {d.minute}m
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Active Crosshair */}
                  <line
                    x1={xPos(inspectedIdx)}
                    y1={padT}
                    x2={xPos(inspectedIdx)}
                    y2={svgH - padB}
                    stroke="#38bdf8"
                    strokeWidth="1"
                  />
                  <circle
                    cx={xPos(inspectedIdx)}
                    cy={yPosFan(inspectedFan.p50ShortfallBps)}
                    r="4"
                    fill="#06b6d4"
                  />
                </svg>
              ) : (
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-64 cursor-crosshair select-none"
                  role="img"
                  aria-label="Almgren-Chriss vs TWAP, VWAP, POV Inventory Schedules"
                >
                  {[0, 25, 50, 75, 100].map((pct) => {
                    const y = yPosPct(pct);
                    return (
                      <g key={pct}>
                        <line
                          x1={padL}
                          y1={y}
                          x2={svgW - padR}
                          y2={y}
                          stroke="#1e293b"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={padL - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[10px] font-mono"
                        >
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    points={buildTrajLine('almgrenChrissRemainingPct')}
                  />
                  <polyline
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    points={buildTrajLine('twapRemainingPct')}
                  />
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.8"
                    points={buildTrajLine('vwapRemainingPct')}
                  />
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="2 3"
                    points={buildTrajLine('povRemainingPct')}
                  />

                  {simResult.trajectories.map((t, i) => (
                    <g key={t.step}>
                      <rect
                        x={xPos(i) - plotW / simResult.trajectories.length / 2}
                        y={padT}
                        width={plotW / simResult.trajectories.length}
                        height={plotH}
                        fill="transparent"
                        onMouseEnter={() => setHoverStep(i)}
                      />
                      {i % 4 === 0 && (
                        <text
                          x={xPos(i)}
                          y={svgH - 8}
                          textAnchor="middle"
                          className="fill-slate-400 text-[10px] font-mono"
                        >
                          {t.minute}m
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400">
              {activeChartTab === 'FAN_SHORTFALL' ? (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-cyan-400">━ Median Shortfall (P50)</span>
                  <span className="text-amber-400">━ 95% VaR Boundary (P95)</span>
                  <span className="text-rose-400">┅ 99% Extreme Jump Boundary (P99)</span>
                  <span className="text-slate-400">┅ Favorable Execution (P05)</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-cyan-400">━ Almgren-Chriss Optimal (κ={simResult.urgencyKappa})</span>
                  <span className="text-slate-400">┅ Linear TWAP</span>
                  <span className="text-amber-400">━ U-Profile VWAP</span>
                  <span className="text-emerald-400">┅ Adaptive POV</span>
                </div>
              )}
              <span>Hover chart to inspect slice microstructure</span>
            </div>
          </div>

          {/* Two-Column Row: Distribution Histogram + Microstructure Attribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shortfall Histogram */}
            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  Shortfall Distribution &amp; Tail VaR
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  95% VaR: {simResult.var95Bps} bps
                </span>
              </div>
              <div className="h-44 flex items-end gap-1.5 pt-4 pb-2 border-b border-slate-800">
                {simResult.histogram.map((bin, idx) => {
                  const heightPct = Math.max(4, (bin.frequencyPct / maxHistFreq) * 100);
                  const barColor = bin.isTailVaR99
                    ? 'bg-rose-500'
                    : bin.isTailVaR95
                    ? 'bg-amber-400'
                    : 'bg-cyan-500/75';
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center justify-end h-full group"
                      title={`${bin.binCenterBps} bps: ${bin.count} paths (${bin.frequencyPct}%)`}
                    >
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-xs transition-opacity group-hover:opacity-100 ${barColor}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-2 tabular-nums">
                <span>Min: {simResult.histogram[0]?.binLabel} bps</span>
                <span className="text-cyan-400">E[IS]: {simResult.expectedShortfallBps} bps</span>
                <span className="text-amber-400">VaR95: {simResult.var95Bps} bps</span>
                <span className="text-rose-400">Max: {simResult.histogram[simResult.histogram.length - 1]?.binLabel} bps</span>
              </div>
            </div>

            {/* Cost Component Attribution */}
            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  Microstructure Slippage Attribution
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  Decomposed by Source
                </span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Bid-Ask Spread Widening', val: simResult.costBreakdown.spreadCostBps, color: 'bg-cyan-400' },
                  { label: 'Temporary Impact (Almgren-Chriss η)', val: simResult.costBreakdown.tempImpactBps, color: 'bg-sky-400' },
                  { label: 'Transient LOB Depth Depletion (ρ)', val: simResult.costBreakdown.lobDepletionBps, color: 'bg-indigo-400' },
                  { label: 'Permanent Price Drift (γ)', val: simResult.costBreakdown.permImpactBps, color: 'bg-emerald-400' },
                  { label: 'Square-Root Meta-Order Overlay', val: simResult.costBreakdown.squareRootOverlayBps, color: 'bg-amber-400' },
                  { label: 'Merton Poisson Jump Tail Shock', val: simResult.costBreakdown.jumpTailShockBps, color: 'bg-rose-400' },
                ].map((item) => {
                  const pct = Math.min(
                    100,
                    Math.max(4, (item.val / Math.max(1, simResult.expectedShortfallBps)) * 100)
                  );
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="font-mono text-slate-200 tabular-nums">
                          {item.val.toFixed(2)} bps
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-xs overflow-hidden">
                        <div style={{ width: `${pct}%` }} className={`h-full ${item.color}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4-Regime Volatile Market Stress Matrix & Schedule Comparison */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5 overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  4-Regime Volatile Market Stress Matrix
                </h3>
                <span className="text-xs font-mono text-slate-400">Click row to switch regime</span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                    <th className="py-2 pr-2">Regime</th>
                    <th className="py-2 px-2 text-right">Eff Vol</th>
                    <th className="py-2 px-2 text-right">E[IS]</th>
                    <th className="py-2 px-2 text-right">CVaR 95%</th>
                    <th className="py-2 pl-2 text-right">VaR 99%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono tabular-nums">
                  {simResult.regimeStressMatrix.map((row) => {
                    const isCurrent = row.regime === config.regime;
                    return (
                      <tr
                        key={row.regime}
                        onClick={() => executeSimulation({ regime: row.regime })}
                        className={`cursor-pointer transition-colors ${
                          isCurrent ? 'bg-cyan-500/10 text-cyan-200' : 'hover:bg-slate-900/70 text-slate-300'
                        }`}
                      >
                        <td className="py-2.5 pr-2 font-sans font-medium">
                          {row.regimeLabel}
                        </td>
                        <td className="py-2.5 px-2 text-right">{row.effectiveVolPct}%</td>
                        <td className="py-2.5 px-2 text-right">{row.expectedShortfallBps} bps</td>
                        <td className="py-2.5 px-2 text-right text-amber-400">{row.cvar95Bps} bps</td>
                        <td className="py-2.5 pl-2 text-right text-rose-400">{row.var99Bps} bps</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5 overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-100">
                  Algorithmic Schedule Benchmark
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  κ={simResult.urgencyKappa} Optimal Urgency
                </span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                    <th className="py-2 pr-2">Schedule</th>
                    <th className="py-2 px-2 text-right">E[Cost]</th>
                    <th className="py-2 px-2 text-right">VaR 95%</th>
                    <th className="py-2 px-2 text-right">CVaR 95%</th>
                    <th className="py-2 pl-2 text-right">1st-Half %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono tabular-nums">
                  {simResult.scheduleComparison.map((sc) => {
                    const isSelected = sc.schedule === config.scheduleType;
                    return (
                      <tr
                        key={sc.schedule}
                        onClick={() => executeSimulation({ scheduleType: sc.schedule })}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-cyan-500/10 text-cyan-200' : 'hover:bg-slate-900/70 text-slate-300'
                        }`}
                      >
                        <td className="py-2.5 pr-2 font-sans font-medium">{sc.label}</td>
                        <td className="py-2.5 px-2 text-right">{sc.expectedCostBps} bps</td>
                        <td className="py-2.5 px-2 text-right">{sc.var95Bps} bps</td>
                        <td className="py-2.5 px-2 text-right text-amber-400">{sc.cvar95Bps} bps</td>
                        <td className="py-2.5 pl-2 text-right">{sc.frontLoadRatioPct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
