# DECISIONS.md — Architectural Decision Records (ADR)

## ADR-001: Deterministic Mathematical Engine Coupled with Server-Side Gemini Orchestration
- **Context**: LLMs can hallucinate numerical statistics if asked to calculate Sharpe ratios, p-values, or Monte Carlo tail percentiles directly.
- **Decision**: All numerical computations (Monte Carlo execution paths, Almgren-Chriss hyperbolic trajectories, Rank IC, walk-forward backtests, Ornstein-Uhlenbeck MLE, and bootstrap confidence intervals) are executed in pure deterministic TypeScript modules (`src/engine/*`) seeded with a deterministic PRNG (`Mulberry32`). Gemini (`gemini-3.8-flash`) is invoked strictly on the server (`server.ts`) to formulate hypotheses, critique experimental designs, and synthesize prose grounded in the deterministic numbers.

## ADR-002: Multi-Model Slippage & Execution Risk Framework
- **Context**: Volatile markets violate constant-slippage assumptions due to liquidity evaporation, spread widening, and jump risk.
- **Decision**: Implemented four complementary execution models:
  1. **Almgren-Chriss (2000)** analytical & stochastic optimal trajectories.
  2. **Square-Root Law** ($\Delta P / P = Y \sigma \sqrt{Q/V}$) calibrated to meta-order execution studies.
  3. **Limit Order Book Resilience & Spread Shock Model** under Merton Jump-Diffusion + Heston volatility clustering.
  4. **Regime-Conditioned Stress Matrix** across Normal, Elevated Volatility, Flash Crash, and Liquidity Drought regimes.
