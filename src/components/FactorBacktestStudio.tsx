import React, { useState } from 'react';
import {
  BacktestConfig,
  BacktestResult,
  BacktestSlippageModel,
  FACTOR_CATALOGUE,
  getFactorCorrelationMatrix,
  runDeterministicBacktest,
} from '../engine/quantEngine';

interface Props {
  backtest: BacktestResult;
  onUpdateBacktest: (res: BacktestResult) => void;
}

const ALPHAGENOME_PARETO_ARCHIVE = [
  {
    exprId: 'AG-GEN42-01',
    expression: 'hmm_prob_calm(vix,21) * mom_12_1 - (1 - hmm_prob_calm(vix,21)) * rank(vol_21d) * rev_5d',
    complexityNodes: 14,
    oosRankIC: 0.068,
    netSharpe: 1.88,
    annualTurnoverPct: 245,
    paretoOptimal: true,
  },
  {
    exprId: 'AG-GEN42-02',
    expression: '-ou_s_score(pca_residual(ret_1d, 3), window=60) * exp(-shannon_entropy(ret_1d, 21))',
    complexityNodes: 11,
    oosRankIC: 0.062,
    netSharpe: 1.79,
    annualTurnoverPct: 310,
    paretoOptimal: true,
  },
  {
    exprId: 'AG-GEN38-09',
    expression: 'rank(ts_sum(residual_ret(close, spy, 252), 231) / ts_std(ret_1d, 63))',
    complexityNodes: 9,
    oosRankIC: 0.056,
    netSharpe: 1.61,
    annualTurnoverPct: 142,
    paretoOptimal: true,
  },
  {
    exprId: 'AG-GEN35-14',
    expression: '-rank(downside_semivar(ret_1d, 63) / upside_semivar(ret_1d, 63))',
    complexityNodes: 7,
    oosRankIC: 0.046,
    netSharpe: 1.44,
    annualTurnoverPct: 118,
    paretoOptimal: true,
  },
  {
    exprId: 'AG-GEN19-44',
    expression: 'pow(rank(volume / adv_20d), 4) * ts_skew(ret_1d, 10) * ts_kurt(ret_1d, 10)',
    complexityNodes: 49,
    oosRankIC: 0.019,
    netSharpe: 0.58,
    annualTurnoverPct: 890,
    paretoOptimal: false,
  },
];

export const FactorBacktestStudio: React.FC<Props> = ({ backtest, onUpdateBacktest }) => {
  const [config, setConfig] = useState<BacktestConfig>(backtest.config);
  const [subTab, setSubTab] = useState<'BACKTEST' | 'FACTORS' | 'ALPHAGENOME'>('BACKTEST');
  const [isRunning, setIsRunning] = useState(false);

  const runBacktest = async (override?: Partial<BacktestConfig>) => {
    const nextCfg: BacktestConfig = { ...config, ...override };
    setConfig(nextCfg);
    setIsRunning(true);
    try {
      const response = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextCfg),
      });
      if (response.ok) {
        const data: BacktestResult = await response.json();
        onUpdateBacktest(data);
      } else {
        onUpdateBacktest(runDeterministicBacktest(nextCfg));
      }
    } catch {
      onUpdateBacktest(runDeterministicBacktest(nextCfg));
    } finally {
      setIsRunning(false);
    }
  };

  const corr = getFactorCorrelationMatrix();
  const series = backtest.series;
  const svgW = 760;
  const svgH = 260;
  const padL = 52;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const minRet = Math.min(
    -15,
    ...series.map((s) => Math.min(s.strategyCumReturnPct, s.benchmarkCumReturnPct))
  );
  const maxRet = Math.max(
    25,
    ...series.map((s) => Math.max(s.grossCumReturnPct, s.strategyCumReturnPct, s.benchmarkCumReturnPct))
  ) * 1.08;

  const xPos = (i: number) => padL + (i / Math.max(1, series.length - 1)) * plotW;
  const yPos = (val: number) =>
    padT + plotH - ((val - minRet) / Math.max(1, maxRet - minRet)) * plotH;

  const polyNet = series.map((s, i) => `${xPos(i).toFixed(1)},${yPos(s.strategyCumReturnPct).toFixed(1)}`).join(' ');
  const polyGross = series.map((s, i) => `${xPos(i).toFixed(1)},${yPos(s.grossCumReturnPct).toFixed(1)}`).join(' ');
  const polyBench = series.map((s, i) => `${xPos(i).toFixed(1)},${yPos(s.benchmarkCumReturnPct).toFixed(1)}`).join(' ');

  const trainEndX = xPos(Math.floor(series.length * 0.6));
  const valEndX = xPos(Math.floor(series.length * 0.8));

  return (
    <div className="space-y-6">
      {/* Header & Sub-View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono text-cyan-400 tracking-wide">
            POINT-IN-TIME QUANTITATIVE ENGINE · {backtest.experimentId} · {backtest.datasetSnapshotId}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
            Factor Discovery, Walk-Forward Backtesting &amp; AlphaGenome
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Evaluates cross-sectional predictive signals under explicit Almgren-Chriss and Square-Root slippage models
            with strict 60% Train / 20% Validation / 20% Untouched Out-of-Sample Holdout segregation.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md shrink-0">
          {(
            [
              { id: 'BACKTEST', label: 'Walk-Forward Backtest' },
              { id: 'FACTORS', label: 'Factor Catalogue & IC' },
              { id: 'ALPHAGENOME', label: 'AlphaGenome Pareto' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'BACKTEST' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Strategy Configuration Column */}
          <aside className="lg:col-span-4 bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-3">
              Walk-Forward Strategy Configuration
            </h2>

            <div>
              <label htmlFor="factor-select" className="block text-xs font-medium text-slate-300 mb-1">
                Quantitative Factor Signal
              </label>
              <select
                id="factor-select"
                value={config.factorId}
                onChange={(e) => runBacktest({ factorId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-100"
              >
                {FACTOR_CATALOGUE.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.id} · {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Transaction Slippage Model
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    { id: 'ALMGREN_CHRISS_DYNAMIC', label: 'Almgren-Chriss Dynamic Trajectory' },
                    { id: 'SQUARE_ROOT_LAW', label: 'Square-Root Impact Law (Y·σ·√Q/V)' },
                    { id: 'FIXED_BPS', label: 'Constant Baseline Slippage (bps)' },
                  ] as { id: BacktestSlippageModel; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => runBacktest({ slippageModel: m.id })}
                    className={`px-3 py-2 text-xs font-medium rounded-md border text-left transition-colors ${
                      config.slippageModel === m.id
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Rebalance Cadence (Trading Days)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([1, 5, 21] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => runBacktest({ rebalanceDays: days })}
                    className={`py-1.5 text-xs font-mono rounded-md border ${
                      config.rebalanceDays === days
                        ? 'bg-slate-100 text-slate-950 border-slate-100 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {days}D
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="bt-slippage-bps" className="text-slate-300">
                  Base Execution Slippage (bps)
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {config.baseSlippageBps.toFixed(1)} bps
                </span>
              </div>
              <input
                id="bt-slippage-bps"
                type="range"
                min={1.0}
                max={20.0}
                step={0.5}
                value={config.baseSlippageBps}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, baseSlippageBps: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="bt-vol-target" className="text-slate-300">
                  Annualized Volatility Target
                </label>
                <span className="font-mono text-cyan-400 tabular-nums">
                  {config.volatilityTargetPct.toFixed(0)}%
                </span>
              </div>
              <input
                id="bt-vol-target"
                type="range"
                min={6}
                max={28}
                step={2}
                value={config.volatilityTargetPct}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, volatilityTargetPct: Number(e.target.value) }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => runBacktest()}
              disabled={isRunning}
              className="w-full py-2.5 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-md transition-colors"
            >
              {isRunning ? 'Computing Walk-Forward...' : 'Run Deterministic Backtest'}
            </button>

            <div className="pt-3 border-t border-slate-800 text-xs space-y-1.5">
              <div className="text-slate-400 font-medium">Formal Factor Expression:</div>
              <code className="block bg-slate-950 border border-slate-800 p-2.5 rounded text-[11px] text-cyan-300 break-all">
                {backtest.factor.expressionCode}
              </code>
              <p className="text-slate-400 text-[11px] leading-relaxed pt-1">
                {backtest.factor.economicHypothesis}
              </p>
            </div>
          </aside>

          {/* Backtest Results Stage */}
          <div className="lg:col-span-8 space-y-6">
            {/* Key Performance Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
                <div className="text-xs text-slate-400">Net Sharpe Ratio</div>
                <div
                  data-testid="backtest-net-sharpe"
                  className="text-2xl font-mono font-semibold text-cyan-400 mt-1 tabular-nums"
                >
                  {backtest.metrics.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                  95% CI [{backtest.metrics.bootstrapSharpeCI95[0]}, {backtest.metrics.bootstrapSharpeCI95[1]}]
                </div>
              </div>

              <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
                <div className="text-xs text-slate-400">Net Annualized Return</div>
                <div className="text-2xl font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                  {backtest.metrics.annualizedReturnPct.toFixed(2)}%
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                  Gross: {backtest.metrics.grossAnnualizedReturnPct}% · Drag: -{backtest.metrics.totalTransactionDragPct}%
                </div>
              </div>

              <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
                <div className="text-xs text-slate-400">Max Drawdown &amp; Calmar</div>
                <div className="text-2xl font-mono font-semibold text-amber-400 mt-1 tabular-nums">
                  {backtest.metrics.maxDrawdownPct.toFixed(2)}%
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                  Calmar: {backtest.metrics.calmarRatio} · Sortino: {backtest.metrics.sortinoRatio}
                </div>
              </div>

              <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
                <div className="text-xs text-slate-400">Untouched OOS Holdout</div>
                <div className="text-2xl font-mono font-semibold text-emerald-400 mt-1 tabular-nums">
                  {backtest.metrics.oosHoldoutSharpe.toFixed(2)} SR
                </div>
                <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                  Deflated SR Prob: {backtest.metrics.deflatedSharpeProb}%
                </div>
              </div>
            </div>

            {/* Equity Curve Chart */}
            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Cumulative Performance &amp; Out-of-Sample Holdout Segregation
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Train (60%) · Validation (20%) · Locked OOS Holdout (20%)
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-cyan-400">━ Net Strategy</span>
                  <span className="text-emerald-400">┅ Gross Pre-Cost</span>
                  <span className="text-slate-400">━ Equal-Weight Benchmark</span>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-60 select-none"
                  role="img"
                  aria-label="Walk-Forward Cumulative Equity Curve"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                    const val = minRet + f * (maxRet - minRet);
                    const y = yPos(val);
                    return (
                      <g key={i}>
                        <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                        <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                          {val.toFixed(0)}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Train / Validation / OOS Holdout Vertical Split Lines */}
                  <line x1={trainEndX} y1={padT} x2={trainEndX} y2={svgH - padB} stroke="#475569" strokeDasharray="4 4" />
                  <text x={trainEndX - 6} y={padT + 12} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                    TRAIN (60%)
                  </text>
                  <line x1={valEndX} y1={padT} x2={valEndX} y2={svgH - padB} stroke="#f59e0b" strokeDasharray="4 4" />
                  <text x={valEndX + 6} y={padT + 12} textAnchor="start" className="fill-amber-400 text-[10px] font-mono">
                    OOS HOLDOUT (20%)
                  </text>

                  <polyline fill="none" stroke="#64748b" strokeWidth="1.5" points={polyBench} />
                  <polyline fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" points={polyGross} />
                  <polyline fill="none" stroke="#06b6d4" strokeWidth="2.4" points={polyNet} />
                </svg>
              </div>
            </div>

            {/* Regime Attribution Table & Recent Trade Ledger */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5 overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-100 mb-3">
                  Regime-Conditioned Performance Attribution
                </h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                      <th className="py-2 pr-2">Market Regime</th>
                      <th className="py-2 px-2 text-right">Ann Ret</th>
                      <th className="py-2 px-2 text-right">Sharpe</th>
                      <th className="py-2 px-2 text-right">Slippage</th>
                      <th className="py-2 pl-2 text-right">Max DD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono tabular-nums">
                    {backtest.regimeBreakdown.map((r) => (
                      <tr key={r.regime} className="text-slate-300">
                        <td className="py-2.5 pr-2 font-sans font-medium">{r.regime}</td>
                        <td className="py-2.5 px-2 text-right">{r.annualizedReturnPct}%</td>
                        <td className="py-2.5 px-2 text-right text-cyan-400">{r.sharpe}</td>
                        <td className="py-2.5 px-2 text-right text-amber-400">{r.avgSlippageBps} bps</td>
                        <td className="py-2.5 pl-2 text-right text-rose-400">{r.maxDrawdownPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5 overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-100 mb-3">
                  Point-in-Time Rebalance Execution Ledger
                </h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 px-2">Symbol</th>
                      <th className="py-2 px-2">Side</th>
                      <th className="py-2 px-2 text-right">Z-Score</th>
                      <th className="py-2 pl-2 text-right">Slippage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono tabular-nums">
                    {backtest.trades.slice(0, 6).map((tr, i) => (
                      <tr key={i} className="text-slate-300">
                        <td className="py-2 pr-2 text-slate-400">{tr.date}</td>
                        <td className="py-2 px-2 font-semibold text-slate-100">{tr.symbol}</td>
                        <td className={`py-2 px-2 ${tr.side === 'LONG' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {tr.side}
                        </td>
                        <td className="py-2 px-2 text-right">{tr.signalZScore}</td>
                        <td className="py-2 pl-2 text-right">{tr.realizedSlippageBps} bps</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'FACTORS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FACTOR_CATALOGUE.map((fac) => (
              <div
                key={fac.id}
                className="bg-[#0B0F19] border border-slate-800 rounded-md p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="text-xs font-mono text-cyan-400">
                    {fac.id} · {fac.family}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 mt-1">{fac.name}</h3>
                  <code className="block mt-2 bg-slate-950 border border-slate-800 p-2 rounded text-[11px] font-mono text-slate-300 break-all">
                    {fac.formulaLatex}
                  </code>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {fac.economicHypothesis}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Rank IC</span>
                      <span className="text-cyan-400 font-semibold">{fac.rankIC}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">t-Stat</span>
                      <span className="text-slate-100 font-semibold">{fac.tStat}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Q5-Q1 Spread</span>
                      <span className="text-emerald-400 font-semibold">
                        +{fac.quantileReturnsAnnualizedPct.spreadQ5MinusQ1}%
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSubTab('BACKTEST');
                      runBacktest({ factorId: fac.id });
                    }}
                    className="w-full py-2 px-3 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 rounded-md transition-colors"
                  >
                    Load in Walk-Forward Backtester
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Factor Correlation Matrix */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5 overflow-x-auto">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Cross-Sectional Factor Correlation Matrix
            </h3>
            <table className="w-full text-left border-collapse font-mono text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Factor ID</th>
                  {corr.labels.map((lbl) => (
                    <th key={lbl} className="py-2 px-3 text-right">
                      {lbl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {corr.matrix.map((row, rIdx) => (
                  <tr key={corr.labels[rIdx]}>
                    <td className="py-2 pr-3 font-semibold text-slate-200">{corr.labels[rIdx]}</td>
                    {row.map((val, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-2 px-3 text-right ${
                          rIdx === cIdx
                            ? 'text-cyan-400 font-semibold'
                            : val < 0
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {val.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'ALPHAGENOME' && (
        <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              AlphaGenome Symbolic Regression &amp; Multi-Objective Pareto Archive
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Evolutionary grammar constrained against future-information access. Optimizes Out-of-Sample Rank IC,
              Transaction-Cost-Adjusted Sharpe, and AST Expression Complexity.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-3">Lineage ID</th>
                  <th className="py-2.5 px-3">Symbolic Expression AST</th>
                  <th className="py-2.5 px-3 text-right">Nodes</th>
                  <th className="py-2.5 px-3 text-right">OOS Rank IC</th>
                  <th className="py-2.5 px-3 text-right">Net Sharpe</th>
                  <th className="py-2.5 pl-3 text-right">Pareto Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ALPHAGENOME_PARETO_ARCHIVE.map((item) => (
                  <tr key={item.exprId} className="text-slate-200">
                    <td className="py-3 pr-3 text-cyan-400">{item.exprId}</td>
                    <td className="py-3 px-3 text-slate-300 max-w-md truncate">{item.expression}</td>
                    <td className="py-3 px-3 text-right">{item.complexityNodes}</td>
                    <td className="py-3 px-3 text-right">{item.oosRankIC.toFixed(3)}</td>
                    <td className="py-3 px-3 text-right font-semibold">{item.netSharpe.toFixed(2)}</td>
                    <td
                      className={`py-3 pl-3 text-right ${
                        item.paretoOptimal ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.paretoOptimal ? '● Pareto Frontier' : '✖ Dominated (Overfit)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
