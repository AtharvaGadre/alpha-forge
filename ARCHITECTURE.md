# ARCHITECTURE.md — AlphaForge System Architecture

## 1. High-Level Topology
AlphaForge operates as a modular full-stack TypeScript/Node.js and React 19 analytical platform with deterministic numerical engines shared between server and client for zero-drift reproducibility:

```
+-----------------------------------------------------------------------------------+
|                        ALPHAFORGE RESEARCH TERMINAL (React 19)                    |
|  [Overview] [Execution & Slippage MC] [Factor Lab] [Backtester] [QuantPhysics]    |
|  [Agent Observatory] [Improvement Lab] [30-Section Reports] [Experiment Registry] |
+-----------------------------------------+-----------------------------------------+
                                          | REST JSON (/api/*)
+-----------------------------------------v-----------------------------------------+
|                        EXPRESS & DETERMINISTIC QUANT SERVER                       |
|  - /api/health               : System health, data snapshot version & provenance  |
|  - /api/slippage/montecarlo  : Almgren-Chriss + Jump-Diffusion MC Slippage Engine |
|  - /api/backtest/run         : Walk-forward TC-aware factor backtesting engine    |
|  - /api/agents/run-cycle     : 13-Role Cooperating Agent Pipeline (@google/genai) |
|  - /api/reports/validate     : 30-Section Scientific Report & Audit Reconciler    |
+-----------------------------------------------------------------------------------+
```

## 2. Numerical & Microstructure Modules
1. **`src/engine/slippageMonteCarlo.ts`**:
   - Models implementation shortfall $IS = \sum_{k=1}^N n_k \tilde{S}_k - X S_0$ under stochastic volatility, Poisson price jumps, bid-ask spread widening, temporary linear/power-law impact $\eta(v_k)$, and permanent market impact $\gamma(n_k)$.
   - Solves the Almgren-Chriss boundary value problem for urgency parameter $\kappa = \sqrt{\lambda \sigma^2 / \eta}$.
2. **`src/engine/quantEngine.ts`**:
   - Point-in-time cross-sectional equity universe generator with realistic corporate actions (splits, dividends), regime switches (Calm, Elevated, Crisis/Volatile), and benchmark tracking.
   - Computes Spearman Rank IC, IC decay across horizons $h \in \{1, 2, 5, 10, 20\}$, quantile spreads, and block-bootstrap 95% confidence intervals.
