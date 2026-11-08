import React, { useState } from 'react';
import {
  QuantPhysicsConfig,
  QuantPhysicsModelType,
  QuantPhysicsSimulationResult,
  simulateQuantPhysicsSDE,
} from '../engine/quantEngine';

export const QuantPhysicsLab: React.FC = () => {
  const [sim, setSim] = useState<QuantPhysicsSimulationResult>(() =>
    simulateQuantPhysicsSDE()
  );
  const [config, setConfig] = useState<QuantPhysicsConfig>(sim.config);

  const runSimulation = async (override?: Partial<QuantPhysicsConfig>) => {
    const nextCfg: QuantPhysicsConfig = { ...config, ...override };
    setConfig(nextCfg);
    try {
      const response = await fetch('/api/quantphysics/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextCfg),
      });
      if (response.ok) {
        const data: QuantPhysicsSimulationResult = await response.json();
        setSim(data);
      } else {
        setSim(simulateQuantPhysicsSDE(nextCfg));
      }
    } catch {
      setSim(simulateQuantPhysicsSDE(nextCfg));
    }
  };

  const ts = sim.timeSeries;
  const svgW = 740;
  const svgH = 250;
  const padL = 50;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const minY = Math.min(...ts.map((d) => Math.min(d.lowerBand05, d.samplePath1, d.samplePath2))) * 0.985;
  const maxY = Math.max(...ts.map((d) => Math.max(d.upperBand95, d.samplePath1, d.samplePath2))) * 1.015;

  const xPos = (i: number) => padL + (i / Math.max(1, ts.length - 1)) * plotW;
  const yPos = (val: number) =>
    padT + plotH - ((val - minY) / Math.max(0.01, maxY - minY)) * plotH;

  const polyMean = ts.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.meanPath).toFixed(1)}`).join(' ');
  const polyP1 = ts.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.samplePath1).toFixed(1)}`).join(' ');
  const polyP2 = ts.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.samplePath2).toFixed(1)}`).join(' ');
  const polyBand = [
    ...ts.map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.upperBand95).toFixed(1)}`),
    ...[...ts].reverse().map((d, i) => `${xPos(ts.length - 1 - i).toFixed(1)},${yPos(d.lowerBand05).toFixed(1)}`),
  ].join(' ');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <div className="text-xs font-mono text-cyan-400 tracking-wide">
          QUANTPHYSICS STOCHASTIC CALCULUS MODULE · {sim.checksum.slice(0, 19)}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
          QuantPhysics Laboratory — Stochastic Processes &amp; Statistical Mechanics
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Investigates Ornstein-Uhlenbeck mean-reverting dynamics, Heston stochastic volatility clustering,
          Langevin restoring potentials, and Shannon entropy scaling against Geometric Brownian Motion baselines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 bg-[#0B0F19] border border-slate-800 rounded-md p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-3">
            Stochastic Differential Equation Parameters
          </h2>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Physics-Informed Stochastic Model
            </label>
            {(
              [
                { id: 'ORNSTEIN_UHLENBECK', label: 'Ornstein-Uhlenbeck Mean Reversion' },
                { id: 'LANGEVIN_POTENTIAL', label: 'Langevin Anharmonic Potential Well' },
                { id: 'HESTON_STOCH_VOL', label: 'Heston Stochastic Volatility' },
                { id: 'GBM_BASELINE', label: 'Geometric Brownian Motion (Baseline)' },
              ] as { id: QuantPhysicsModelType; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => runSimulation({ model: m.id })}
                className={`w-full px-3 py-2 text-xs font-medium rounded-md border text-left transition-colors ${
                  config.model === m.id
                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="qp-kappa" className="text-slate-300">
                Restoring / Reversion Velocity (κ)
              </label>
              <span className="font-mono text-cyan-400 tabular-nums">
                {config.kappaMeanReversion.toFixed(1)}
              </span>
            </div>
            <input
              id="qp-kappa"
              type="range"
              min={0.5}
              max={18.0}
              step={0.5}
              value={config.kappaMeanReversion}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, kappaMeanReversion: Number(e.target.value) }))
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="qp-sigma" className="text-slate-300">
                Thermal Diffusion Volatility (σ)
              </label>
              <span className="font-mono text-cyan-400 tabular-nums">
                {(config.sigmaDiffusion * 100).toFixed(0)}%
              </span>
            </div>
            <input
              id="qp-sigma"
              type="range"
              min={0.08}
              max={0.65}
              step={0.02}
              value={config.sigmaDiffusion}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, sigmaDiffusion: Number(e.target.value) }))
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => runSimulation()}
            className="w-full py-2.5 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-md transition-colors"
          >
            Simulate SDE Ensemble
          </button>

          <div className="pt-3 border-t border-slate-800 text-xs space-y-2">
            <div className="text-slate-400">Governing Stochastic Differential Equation:</div>
            <code className="block bg-slate-950 border border-slate-800 p-2.5 rounded text-[11px] font-mono text-cyan-300 break-all">
              {sim.formulaLatex}
            </code>
            <div className="text-slate-400 text-[11px]">
              <strong className="text-slate-200">Documented Failure Mode:</strong> {sim.failureModes}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Hurst Exponent (H)</div>
              <div className="text-2xl font-mono font-semibold text-cyan-400 mt-1 tabular-nums">
                {sim.hurstExponent.toFixed(3)}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">
                {sim.hurstExponent < 0.48 ? 'Anti-Persistent (Mean-Rev)' : 'Diffusive / Persistent'}
              </div>
            </div>

            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Shannon Entropy (H_S)</div>
              <div className="text-2xl font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                {sim.shannonEntropyBits.toFixed(3)} bits
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">Distributional complexity</div>
            </div>

            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Relaxation Half-Life</div>
              <div className="text-2xl font-mono font-semibold text-amber-400 mt-1 tabular-nums">
                {sim.halfLifeDays} days
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">
                Drift slope: {sim.kramersMoyalDriftSlope}
              </div>
            </div>

            <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-4">
              <div className="text-xs text-slate-400">Empirical Calibration RMSE</div>
              <div className="text-2xl font-mono font-semibold text-emerald-400 mt-1 tabular-nums">
                {sim.empiricalComparisonRmse}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">vs PIT Spread Residuals</div>
            </div>
          </div>

          <div className="bg-[#0B0F19] border border-slate-800 rounded-md p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100">
                Stochastic Phase-Space Ensemble &amp; 90% Confidence Envelope
              </h3>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-cyan-400">━ Ensemble Mean</span>
                <span className="text-amber-400">━ Realization #1 (+6% Displaced)</span>
                <span className="text-emerald-400">━ Realization #2 (-6% Displaced)</span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-60 select-none"
                role="img"
                aria-label="QuantPhysics Stochastic Trajectory Ensemble"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                  const val = minY + f * (maxY - minY);
                  const y = yPos(val);
                  return (
                    <g key={i}>
                      <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                      <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                        {val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                <polygon points={polyBand} fill="rgba(6, 182, 212, 0.14)" />
                <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={polyP1} />
                <polyline fill="none" stroke="#10b981" strokeWidth="1.5" points={polyP2} />
                <polyline fill="none" stroke="#06b6d4" strokeWidth="2.5" points={polyMean} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
