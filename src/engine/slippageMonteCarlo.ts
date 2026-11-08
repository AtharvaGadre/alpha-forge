/**
 * AlphaForge — Monte Carlo Execution & Slippage Modeling Engine
 *
 * Implements:
 * 1. Almgren-Chriss (2000) Optimal Execution Trajectory vs TWAP, VWAP, and POV
 * 2. Square-Root Market Impact Law: \Delta P / P = Y * \sigma * \sqrt{Q / ADV}
 * 3. Transient Limit Order Book (Obizhaeva-Wang) Resilience & Depth Decay
 * 4. Multi-Regime Stochastic Volatility (Heston-type) + Merton Jump-Diffusion Paths
 * 5. Implementation Shortfall (IS) Distribution, VaR (95%, 99%), CVaR / Expected Shortfall,
 *    and 4-Regime Volatile Market Stress Testing Matrix.
 */

import { SeededRNG, mean, stdDev, quantile, computeDeterministicHash } from './prng.ts';

export type ExecutionScheduleType = 'ALMGREN_CHRISS' | 'TWAP' | 'VWAP' | 'POV';
export type MarketRegimeType = 'NORMAL' | 'ELEVATED_VOL' | 'FLASH_CRASH' | 'LIQUIDITY_DROUGHT';

export interface SlippageSimulationConfig {
  symbol: string;
  initialPrice: number;          // S_0 ($), e.g., 185.00
  orderShares: number;           // Total shares Q to execute, e.g., 250,000
  advShares: number;             // Average Daily Volume V, e.g., 2,500,000 (10% ADV)
  horizonMinutes: number;        // Execution horizon T in minutes, e.g., 120
  timeSteps: number;             // Discrete execution slices N_steps, e.g., 24
  monteCarloPaths: number;       // Number of Monte Carlo realizations M, e.g., 500
  annualizedVol: number;         // Base annualized volatility \sigma (e.g., 0.28 = 28%)
  baseSpreadBps: number;         // Baseline half-spread + full spread in bps (e.g., 4.5 bps)
  tempImpactEta: number;         // Temporary linear/power impact coefficient \eta (e.g., 0.14)
  permImpactGamma: number;       // Permanent impact coefficient \gamma (e.g., 0.08)
  sqrtImpactY: number;           // Square-root law constant Y (typically 0.5 - 0.85)
  riskAversionLambda: number;    // Almgren-Chriss risk aversion \lambda (e.g., 1e-5 to 1e-3)
  lobResilienceRho: number;      // Limit Order Book recovery rate \rho (per hour, e.g., 4.0)
  jumpIntensityLambda: number;   // Poisson jump arrival intensity (jumps per day, e.g., 1.5)
  jumpMeanBps: number;           // Mean jump size in bps (e.g., -18 bps adverse)
  jumpVolBps: number;            // Jump standard deviation in bps (e.g., 35 bps)
  volOfVolXi: number;            // Stochastic volatility of volatility \xi (e.g., 0.45)
  scheduleType: ExecutionScheduleType;
  regime: MarketRegimeType;
  seed: number;
}

export interface TrajectorySlice {
  step: number;
  minute: number;
  almgrenChrissRemainingPct: number;
  twapRemainingPct: number;
  vwapRemainingPct: number;
  povRemainingPct: number;
  activeTradeShares: number;
  expectedLobDepthDepletionBps: number;
}

export interface MonteCarloFanStep {
  step: number;
  minute: number;
  p05ShortfallBps: number;
  p25ShortfallBps: number;
  p50ShortfallBps: number;
  p75ShortfallBps: number;
  p95ShortfallBps: number;
  p99ShortfallBps: number;
  meanMidPrice: number;
  p05ExecutionPrice: number;
  p95ExecutionPrice: number;
}

export interface ShortfallHistogramBin {
  binCenterBps: number;
  binLabel: string;
  count: number;
  frequencyPct: number;
  isTailVaR95: boolean;
  isTailVaR99: boolean;
}

export interface CostComponentBreakdown {
  spreadCostBps: number;
  tempImpactBps: number;
  permImpactBps: number;
  squareRootOverlayBps: number;
  lobDepletionBps: number;
  volatilityTimingRiskBps: number;
  jumpTailShockBps: number;
  totalExpectedShortfallBps: number;
}

export interface RegimeStressRow {
  regime: MarketRegimeType;
  regimeLabel: string;
  effectiveVolPct: number;
  effectiveSpreadBps: number;
  lobResilienceHalfLifeMin: number;
  expectedShortfallBps: number;
  var95Bps: number;
  cvar95Bps: number;
  var99Bps: number;
  optimalUrgencyKappa: number;
  executionFailureProbPct: number;
}

export interface SlippageSimulationResult {
  config: SlippageSimulationConfig;
  checksum: string;
  orderNotionalUsd: number;
  participationRateAdvPct: number;
  urgencyKappa: number;
  halfLifeMinutes: number;
  expectedShortfallBps: number;
  expectedShortfallUsd: number;
  stdDevShortfallBps: number;
  var95Bps: number;
  cvar95Bps: number;
  var99Bps: number;
  cvar99Bps: number;
  squareRootLawEstimateBps: number;
  almgrenChrissAnalyticalExpectedBps: number;
  costBreakdown: CostComponentBreakdown;
  trajectories: TrajectorySlice[];
  fanChart: MonteCarloFanStep[];
  histogram: ShortfallHistogramBin[];
  regimeStressMatrix: RegimeStressRow[];
  scheduleComparison: {
    schedule: ExecutionScheduleType;
    label: string;
    expectedCostBps: number;
    var95Bps: number;
    cvar95Bps: number;
    timingVarianceBps2: number;
    frontLoadRatioPct: number;
  }[];
}

export const DEFAULT_SLIPPAGE_CONFIG: SlippageSimulationConfig = {
  symbol: 'NVDA-EQ',
  initialPrice: 142.50,
  orderShares: 180000,
  advShares: 1500000,
  horizonMinutes: 120,
  timeSteps: 24,
  monteCarloPaths: 400,
  annualizedVol: 0.38,
  baseSpreadBps: 4.2,
  tempImpactEta: 0.16,
  permImpactGamma: 0.09,
  sqrtImpactY: 0.65,
  riskAversionLambda: 0.00018,
  lobResilienceRho: 3.5,
  jumpIntensityLambda: 1.8,
  jumpMeanBps: 12.0,
  jumpVolBps: 28.0,
  volOfVolXi: 0.55,
  scheduleType: 'ALMGREN_CHRISS',
  regime: 'ELEVATED_VOL',
  seed: 20261107,
};

const REGIME_MULTIPLIERS: Record<
  MarketRegimeType,
  {
    label: string;
    volMult: number;
    spreadMult: number;
    tempImpactMult: number;
    resilienceMult: number;
    jumpLambdaMult: number;
    jumpVolMult: number;
  }
> = {
  NORMAL: {
    label: 'Normal Equilibrium',
    volMult: 1.0,
    spreadMult: 1.0,
    tempImpactMult: 1.0,
    resilienceMult: 1.0,
    jumpLambdaMult: 0.5,
    jumpVolMult: 0.7,
  },
  ELEVATED_VOL: {
    label: 'Elevated Macro Volatility',
    volMult: 1.45,
    spreadMult: 1.65,
    tempImpactMult: 1.4,
    resilienceMult: 0.72,
    jumpLambdaMult: 1.35,
    jumpVolMult: 1.3,
  },
  FLASH_CRASH: {
    label: 'Flash Crash / Jump Cascade',
    volMult: 2.35,
    spreadMult: 3.1,
    tempImpactMult: 2.4,
    resilienceMult: 0.38,
    jumpLambdaMult: 3.2,
    jumpVolMult: 2.5,
  },
  LIQUIDITY_DROUGHT: {
    label: 'Order Book Liquidity Drought',
    volMult: 1.75,
    spreadMult: 2.6,
    tempImpactMult: 2.85,
    resilienceMult: 0.25,
    jumpLambdaMult: 1.9,
    jumpVolMult: 1.8,
  },
};

/**
 * Computes Almgren-Chriss, TWAP, VWAP, and POV execution trajectories
 * across N discrete time slices.
 */
export function buildExecutionTrajectories(
  config: SlippageSimulationConfig,
  effectiveVol: number,
  effectiveEta: number,
  effectiveRho: number
): {
  urgencyKappa: number;
  trajectories: TrajectorySlice[];
  tradesBySchedule: Record<ExecutionScheduleType, number[]>;
} {
  const N = Math.max(4, Math.min(120, Math.floor(config.timeSteps)));
  const Q = Math.max(1, config.orderShares);
  const T_hours = Math.max(0.05, config.horizonMinutes / 60);
  const dt_hours = T_hours / N;

  // Urgency parameter \kappa = \sqrt{\lambda * \sigma^2 / \eta}
  const rawKappa = Math.sqrt(
    (Math.max(1e-7, config.riskAversionLambda) * 1e4 * effectiveVol * effectiveVol) /
      Math.max(0.01, effectiveEta)
  );
  const urgencyKappa = Math.max(0.15, Math.min(8.0, rawKappa));

  const acRemaining: number[] = [];
  const twapRemaining: number[] = [];
  const vwapRemaining: number[] = [];
  const povRemaining: number[] = [];

  // Precompute U-shaped intraday market volume weights for VWAP and POV
  const vwapWeights: number[] = [];
  const povWeights: number[] = [];
  for (let k = 0; k < N; k++) {
    const u = (k + 0.5) / N;
    // U-shape: higher volume near start and end of window
    const uShape = 1.0 + 0.65 * Math.cos(2 * Math.PI * u);
    vwapWeights.push(Math.max(0.2, uShape));
    // POV tracks volume bursts with damped decay
    povWeights.push(Math.max(0.2, (1.25 - 0.5 * u) * (1 + 0.3 * Math.sin(3 * Math.PI * u))));
  }
  const vwapSum = vwapWeights.reduce((a, b) => a + b, 0);
  const povSum = povWeights.reduce((a, b) => a + b, 0);

  let vwapCum = 0;
  let povCum = 0;

  for (let k = 0; k <= N; k++) {
    const tFrac = k / N;
    // Almgren-Chriss hyperbolic sine trajectory: sinh(\kappa (1 - t/T)) / sinh(\kappa)
    const sinhDenom = Math.sinh(urgencyKappa);
    const acRem =
      sinhDenom > 1e-8 ? Math.sinh(urgencyKappa * (1 - tFrac)) / sinhDenom : 1 - tFrac;
    acRemaining.push(Math.max(0, Math.min(1, acRem)));
    twapRemaining.push(Math.max(0, 1 - tFrac));

    if (k === 0) {
      vwapRemaining.push(1.0);
      povRemaining.push(1.0);
    } else {
      vwapCum += vwapWeights[k - 1] / vwapSum;
      povCum += povWeights[k - 1] / povSum;
      vwapRemaining.push(Math.max(0, 1 - vwapCum));
      povRemaining.push(Math.max(0, 1 - povCum));
    }
  }
  acRemaining[N] = 0;
  twapRemaining[N] = 0;
  vwapRemaining[N] = 0;
  povRemaining[N] = 0;

  const toTrades = (rem: number[]): number[] => {
    const trades: number[] = [];
    for (let k = 0; k < N; k++) {
      trades.push(Math.max(0, (rem[k] - rem[k + 1]) * Q));
    }
    return trades;
  };

  const tradesBySchedule: Record<ExecutionScheduleType, number[]> = {
    ALMGREN_CHRISS: toTrades(acRemaining),
    TWAP: toTrades(twapRemaining),
    VWAP: toTrades(vwapRemaining),
    POV: toTrades(povRemaining),
  };

  const activeTrades = tradesBySchedule[config.scheduleType];
  const trajectories: TrajectorySlice[] = [];
  let lobDepletion = 0;
  const decayFactor = Math.exp(-effectiveRho * dt_hours);

  for (let k = 0; k <= N; k++) {
    const sliceShares = k === 0 ? 0 : activeTrades[k - 1];
    if (k > 0) {
      const sliceAdvFrac = sliceShares / Math.max(1, config.advShares);
      lobDepletion = lobDepletion * decayFactor + effectiveEta * 120 * Math.pow(sliceAdvFrac, 0.75);
    }
    trajectories.push({
      step: k,
      minute: Number(((k / N) * config.horizonMinutes).toFixed(1)),
      almgrenChrissRemainingPct: Number((acRemaining[k] * 100).toFixed(2)),
      twapRemainingPct: Number((twapRemaining[k] * 100).toFixed(2)),
      vwapRemainingPct: Number((vwapRemaining[k] * 100).toFixed(2)),
      povRemainingPct: Number((povRemaining[k] * 100).toFixed(2)),
      activeTradeShares: Math.round(sliceShares),
      expectedLobDepthDepletionBps: Number(lobDepletion.toFixed(2)),
    });
  }

  return { urgencyKappa, trajectories, tradesBySchedule };
}

/**
 * Runs a full Monte Carlo simulation of execution slippage under stochastic volatility,
 * transient limit order book depletion, square-root impact, and jump-diffusion shocks.
 */
export function runSlippageMonteCarlo(
  rawConfig: Partial<SlippageSimulationConfig> = {}
): SlippageSimulationResult {
  const config: SlippageSimulationConfig = {
    ...DEFAULT_SLIPPAGE_CONFIG,
    ...rawConfig,
    initialPrice: Math.max(0.01, Number(rawConfig.initialPrice ?? DEFAULT_SLIPPAGE_CONFIG.initialPrice)),
    orderShares: Math.max(1, Number(rawConfig.orderShares ?? DEFAULT_SLIPPAGE_CONFIG.orderShares)),
    advShares: Math.max(100, Number(rawConfig.advShares ?? DEFAULT_SLIPPAGE_CONFIG.advShares)),
    horizonMinutes: Math.max(5, Math.min(390, Number(rawConfig.horizonMinutes ?? DEFAULT_SLIPPAGE_CONFIG.horizonMinutes))),
    timeSteps: Math.max(6, Math.min(60, Math.floor(Number(rawConfig.timeSteps ?? DEFAULT_SLIPPAGE_CONFIG.timeSteps)))),
    monteCarloPaths: Math.max(50, Math.min(2000, Math.floor(Number(rawConfig.monteCarloPaths ?? DEFAULT_SLIPPAGE_CONFIG.monteCarloPaths)))),
    annualizedVol: Math.max(0.01, Math.min(2.5, Number(rawConfig.annualizedVol ?? DEFAULT_SLIPPAGE_CONFIG.annualizedVol))),
    baseSpreadBps: Math.max(0.1, Number(rawConfig.baseSpreadBps ?? DEFAULT_SLIPPAGE_CONFIG.baseSpreadBps)),
  };

  const reg = REGIME_MULTIPLIERS[config.regime] || REGIME_MULTIPLIERS.NORMAL;
  const effectiveVol = config.annualizedVol * reg.volMult;
  const effectiveSpreadBps = config.baseSpreadBps * reg.spreadMult;
  const effectiveEta = config.tempImpactEta * reg.tempImpactMult;
  const effectiveGamma = config.permImpactGamma * reg.tempImpactMult;
  const effectiveRho = Math.max(0.2, config.lobResilienceRho * reg.resilienceMult);
  const effectiveJumpLambda = config.jumpIntensityLambda * reg.jumpLambdaMult;
  const effectiveJumpVol = config.jumpVolBps * reg.jumpVolMult;

  const { urgencyKappa, trajectories, tradesBySchedule } = buildExecutionTrajectories(
    config,
    effectiveVol,
    effectiveEta,
    effectiveRho
  );

  const N = config.timeSteps;
  const M = config.monteCarloPaths;
  const Q = config.orderShares;
  const V = config.advShares;
  const S0 = config.initialPrice;
  const participationRate = Q / V;

  // Trading year = 252 days * 390 minutes = 98,280 minutes
  const dtYears = config.horizonMinutes / N / 98280;
  const dtDays = config.horizonMinutes / N / 390;
  const dtHours = config.horizonMinutes / N / 60;
  const lobDecay = Math.exp(-effectiveRho * dtHours);

  // Square-Root Market Impact Law baseline (in bps): Y * \sigma_daily * \sqrt{Q / V} * 10000
  const dailyVol = effectiveVol / Math.sqrt(252);
  const squareRootLawEstimateBps =
    config.sqrtImpactY * dailyVol * Math.sqrt(participationRate) * 10000;

  // Helper to simulate paths for any given schedule
  const simulateSchedule = (trades: number[], seedOffset: number) => {
    const rng = new SeededRNG(config.seed + seedOffset);
    const pathShortfallsBps: number[] = [];
    const stepShortfallsBySlice: number[][] = Array.from({ length: N + 1 }, () => []);
    const stepMidPricesBySlice: number[][] = Array.from({ length: N + 1 }, () => []);
    const stepExecPricesBySlice: number[][] = Array.from({ length: N + 1 }, () => []);

    let sumSpreadBps = 0;
    let sumTempBps = 0;
    let sumPermBps = 0;
    let sumLobBps = 0;
    let sumVolTimingBps = 0;
    let sumJumpBps = 0;

    for (let m = 0; m < M; m++) {
      let midPrice = S0;
      let instVol = effectiveVol;
      let lobTransientBps = 0;
      let totalCostUsd = 0;

      let pathSpreadBps = 0;
      let pathTempBps = 0;
      let pathPermBps = 0;
      let pathLobBps = 0;
      let pathVolTimingBps = 0;
      let pathJumpBps = 0;

      stepShortfallsBySlice[0].push(0);
      stepMidPricesBySlice[0].push(S0);
      stepExecPricesBySlice[0].push(S0);

      for (let k = 0; k < N; k++) {
        const nk = trades[k];
        const sliceFracOfOrder = nk / Q;
        const sliceRateVsAdv = nk / (V * dtDays);

        // 1. Heston-style mean-reverting stochastic volatility step
        const zVol = rng.nextNormal();
        const kappaVol = 6.0;
        const dVol =
          kappaVol * (effectiveVol - instVol) * dtDays +
          config.volOfVolXi * instVol * Math.sqrt(dtDays) * zVol;
        instVol = Math.max(0.05, Math.min(3.5, instVol + dVol));
        const volRatio = instVol / Math.max(0.01, effectiveVol);

        // 2. Permanent market impact from slice nk
        const permBpsStep = effectiveGamma * 100 * (nk / V) * Math.sqrt(volRatio);
        midPrice *= 1 + permBpsStep / 10000;

        // 3. Diffusion & Poisson Jump Shock on midPrice
        const zPrice = rng.nextNormal();
        const diffusionReturn = instVol * Math.sqrt(dtYears) * zPrice;
        const numJumps = rng.nextPoisson(effectiveJumpLambda * dtDays);
        let jumpBpsStep = 0;
        if (numJumps > 0) {
          for (let j = 0; j < numJumps; j++) {
            jumpBpsStep += config.jumpMeanBps + effectiveJumpVol * rng.nextNormal();
          }
        }
        midPrice *= Math.max(0.2, 1 + diffusionReturn + jumpBpsStep / 10000);

        // 4. Dynamic Bid-Ask Half-Spread widening under volatility & jump stress
        const halfSpreadBps =
          0.5 * effectiveSpreadBps * (1 + 0.55 * Math.max(0, volRatio - 1) + 0.015 * Math.abs(jumpBpsStep));

        // 5. Temporary Almgren-Chriss + Square-Root blend impact (bps)
        const tempBpsStep =
          effectiveEta * 45 * Math.pow(Math.max(0, sliceRateVsAdv), 0.6) * Math.sqrt(volRatio);

        // 6. Transient LOB resilience accumulation
        lobTransientBps =
          lobTransientBps * lobDecay +
          effectiveEta * 95 * Math.pow(nk / V, 0.75) * (1 + 0.3 * Math.max(0, volRatio - 1));

        // Execution price for slice k
        const totalInstantSlipBps = halfSpreadBps + tempBpsStep + lobTransientBps;
        const execPrice = midPrice * (1 + totalInstantSlipBps / 10000);

        totalCostUsd += nk * execPrice;

        // Accumulate attribution weighted by slice share
        pathSpreadBps += sliceFracOfOrder * halfSpreadBps;
        pathTempBps += sliceFracOfOrder * tempBpsStep;
        pathPermBps += sliceFracOfOrder * ((midPrice - S0) / S0) * 10000 * 0.35;
        pathLobBps += sliceFracOfOrder * lobTransientBps;
        pathJumpBps += sliceFracOfOrder * jumpBpsStep;
        pathVolTimingBps += sliceFracOfOrder * diffusionReturn * 10000;

        const runningShortfallBps = ((execPrice - S0) / S0) * 10000;
        stepShortfallsBySlice[k + 1].push(runningShortfallBps);
        stepMidPricesBySlice[k + 1].push(midPrice);
        stepExecPricesBySlice[k + 1].push(execPrice);
      }

      const benchmarkUsd = Q * S0;
      const isUsd = totalCostUsd - benchmarkUsd;
      const isBps = (isUsd / benchmarkUsd) * 10000 + 0.25 * squareRootLawEstimateBps;
      pathShortfallsBps.push(isBps);

      sumSpreadBps += pathSpreadBps;
      sumTempBps += pathTempBps;
      sumPermBps += Math.abs(pathPermBps);
      sumLobBps += pathLobBps;
      sumVolTimingBps += Math.abs(pathVolTimingBps);
      sumJumpBps += Math.max(0, pathJumpBps);
    }

    const expShortfallBps = mean(pathShortfallsBps);
    const stdBps = stdDev(pathShortfallsBps);
    const var95 = quantile(pathShortfallsBps, 0.95);
    const var99 = quantile(pathShortfallsBps, 0.99);
    const tail95 = pathShortfallsBps.filter((x) => x >= var95);
    const tail99 = pathShortfallsBps.filter((x) => x >= var99);
    const cvar95 = tail95.length > 0 ? mean(tail95) : var95;
    const cvar99 = tail99.length > 0 ? mean(tail99) : var99;

    return {
      pathShortfallsBps,
      stepShortfallsBySlice,
      stepMidPricesBySlice,
      stepExecPricesBySlice,
      expShortfallBps,
      stdBps,
      var95,
      cvar95,
      var99,
      cvar99,
      breakdown: {
        spreadCostBps: Number((sumSpreadBps / M).toFixed(2)),
        tempImpactBps: Number((sumTempBps / M).toFixed(2)),
        permImpactBps: Number((sumPermBps / M).toFixed(2)),
        squareRootOverlayBps: Number((0.25 * squareRootLawEstimateBps).toFixed(2)),
        lobDepletionBps: Number((sumLobBps / M).toFixed(2)),
        volatilityTimingRiskBps: Number((sumVolTimingBps / M).toFixed(2)),
        jumpTailShockBps: Number((sumJumpBps / M).toFixed(2)),
        totalExpectedShortfallBps: Number(expShortfallBps.toFixed(2)),
      },
    };
  };

  // Run primary selected schedule
  const primarySim = simulateSchedule(tradesBySchedule[config.scheduleType], 0);

  // Build Fan Chart across steps
  const fanChart: MonteCarloFanStep[] = [];
  for (let k = 0; k <= N; k++) {
    const sliceArr = primarySim.stepShortfallsBySlice[k];
    const midArr = primarySim.stepMidPricesBySlice[k];
    const execArr = primarySim.stepExecPricesBySlice[k];
    fanChart.push({
      step: k,
      minute: Number(((k / N) * config.horizonMinutes).toFixed(1)),
      p05ShortfallBps: Number(quantile(sliceArr, 0.05).toFixed(2)),
      p25ShortfallBps: Number(quantile(sliceArr, 0.25).toFixed(2)),
      p50ShortfallBps: Number(quantile(sliceArr, 0.5).toFixed(2)),
      p75ShortfallBps: Number(quantile(sliceArr, 0.75).toFixed(2)),
      p95ShortfallBps: Number(quantile(sliceArr, 0.95).toFixed(2)),
      p99ShortfallBps: Number(quantile(sliceArr, 0.99).toFixed(2)),
      meanMidPrice: Number(mean(midArr).toFixed(3)),
      p05ExecutionPrice: Number(quantile(execArr, 0.05).toFixed(3)),
      p95ExecutionPrice: Number(quantile(execArr, 0.95).toFixed(3)),
    });
  }

  // Build Histogram (16 bins)
  const sortedIS = [...primarySim.pathShortfallsBps].sort((a, b) => a - b);
  const minBps = sortedIS[0] ?? 0;
  const maxBps = sortedIS[sortedIS.length - 1] ?? 10;
  const binCount = 16;
  const span = Math.max(4, maxBps - minBps);
  const binWidth = span / binCount;
  const histogram: ShortfallHistogramBin[] = [];

  for (let b = 0; b < binCount; b++) {
    const low = minBps + b * binWidth;
    const high = low + binWidth;
    const center = low + 0.5 * binWidth;
    const count = sortedIS.filter((v) =>
      b === binCount - 1 ? v >= low && v <= high + 1e-6 : v >= low && v < high
    ).length;
    histogram.push({
      binCenterBps: Number(center.toFixed(1)),
      binLabel: `${center.toFixed(0)}`,
      count,
      frequencyPct: Number(((count / M) * 100).toFixed(2)),
      isTailVaR95: center >= primarySim.var95,
      isTailVaR99: center >= primarySim.var99,
    });
  }

  // Compare all 4 execution schedules side-by-side
  const scheduleLabels: Record<ExecutionScheduleType, string> = {
    ALMGREN_CHRISS: 'Almgren-Chriss Optimal',
    TWAP: 'Time-Weighted (TWAP)',
    VWAP: 'Volume-Weighted (VWAP)',
    POV: 'Participation of Volume (POV)',
  };

  const scheduleComparison = (['ALMGREN_CHRISS', 'TWAP', 'VWAP', 'POV'] as ExecutionScheduleType[]).map(
    (sched, idx) => {
      const trades = tradesBySchedule[sched];
      const sim =
        sched === config.scheduleType ? primarySim : simulateSchedule(trades, (idx + 1) * 101);
      const firstHalfShares = trades
        .slice(0, Math.floor(N / 2))
        .reduce((a, b) => a + b, 0);
      return {
        schedule: sched,
        label: scheduleLabels[sched],
        expectedCostBps: Number(sim.expShortfallBps.toFixed(2)),
        var95Bps: Number(sim.var95.toFixed(2)),
        cvar95Bps: Number(sim.cvar95.toFixed(2)),
        timingVarianceBps2: Number((sim.stdBps * sim.stdBps).toFixed(1)),
        frontLoadRatioPct: Number(((firstHalfShares / Q) * 100).toFixed(1)),
      };
    }
  );

  // Build 4-Regime Stress Matrix
  const regimes: MarketRegimeType[] = [
    'NORMAL',
    'ELEVATED_VOL',
    'FLASH_CRASH',
    'LIQUIDITY_DROUGHT',
  ];
  const regimeStressMatrix: RegimeStressRow[] = regimes.map((rKey, idx) => {
    const rMult = REGIME_MULTIPLIERS[rKey];
    const rVol = config.annualizedVol * rMult.volMult;
    const rSpread = config.baseSpreadBps * rMult.spreadMult;
    const rEta = config.tempImpactEta * rMult.tempImpactMult;
    const rRho = Math.max(0.2, config.lobResilienceRho * rMult.resilienceMult);
    const { urgencyKappa: rKappa } = buildExecutionTrajectories(config, rVol, rEta, rRho);

    // Analytical + scaled MC projection across regimes for fast deterministic comparison
    const scaleFactor =
      rKey === config.regime
        ? 1.0
        : (rMult.spreadMult * 0.35 + rMult.tempImpactMult * 0.4 + rMult.volMult * 0.25) /
          (reg.spreadMult * 0.35 + reg.tempImpactMult * 0.4 + reg.volMult * 0.25);

    const expBps = primarySim.expShortfallBps * scaleFactor;
    const v95 = primarySim.var95 * scaleFactor * (1 + 0.08 * idx);
    const cv95 = primarySim.cvar95 * scaleFactor * (1 + 0.11 * idx);
    const v99 = primarySim.var99 * scaleFactor * (1 + 0.14 * idx);
    const halfLifeMin = (Math.LN2 / rRho) * 60;
    const failProb = Math.min(
      48.5,
      Math.max(0.4, participationRate * 18 * rMult.tempImpactMult * (rMult.volMult - 0.5))
    );

    return {
      regime: rKey,
      regimeLabel: rMult.label,
      effectiveVolPct: Number((rVol * 100).toFixed(1)),
      effectiveSpreadBps: Number(rSpread.toFixed(2)),
      lobResilienceHalfLifeMin: Number(halfLifeMin.toFixed(1)),
      expectedShortfallBps: Number(expBps.toFixed(2)),
      var95Bps: Number(v95.toFixed(2)),
      cvar95Bps: Number(cv95.toFixed(2)),
      var99Bps: Number(v99.toFixed(2)),
      optimalUrgencyKappa: Number(rKappa.toFixed(2)),
      executionFailureProbPct: Number(failProb.toFixed(1)),
    };
  });

  const orderNotionalUsd = Q * S0;
  const expectedShortfallUsd = (primarySim.expShortfallBps / 10000) * orderNotionalUsd;
  const almgrenChrissAnalyticalExpectedBps =
    0.5 * effectiveGamma * 100 * participationRate +
    effectiveSpreadBps * 0.5 +
    effectiveEta * 35 * participationRate * (urgencyKappa / Math.tanh(urgencyKappa));

  const checksum = computeDeterministicHash(JSON.stringify(config));

  return {
    config,
    checksum,
    orderNotionalUsd: Number(orderNotionalUsd.toFixed(2)),
    participationRateAdvPct: Number((participationRate * 100).toFixed(2)),
    urgencyKappa: Number(urgencyKappa.toFixed(3)),
    halfLifeMinutes: Number(((Math.LN2 / effectiveRho) * 60).toFixed(1)),
    expectedShortfallBps: Number(primarySim.expShortfallBps.toFixed(2)),
    expectedShortfallUsd: Number(expectedShortfallUsd.toFixed(2)),
    stdDevShortfallBps: Number(primarySim.stdBps.toFixed(2)),
    var95Bps: Number(primarySim.var95.toFixed(2)),
    cvar95Bps: Number(primarySim.cvar95.toFixed(2)),
    var99Bps: Number(primarySim.var99.toFixed(2)),
    cvar99Bps: Number(primarySim.cvar99.toFixed(2)),
    squareRootLawEstimateBps: Number(squareRootLawEstimateBps.toFixed(2)),
    almgrenChrissAnalyticalExpectedBps: Number(almgrenChrissAnalyticalExpectedBps.toFixed(2)),
    costBreakdown: primarySim.breakdown,
    trajectories,
    fanChart,
    histogram,
    regimeStressMatrix,
    scheduleComparison,
  };
}
