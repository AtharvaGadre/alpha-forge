# AlphaForge — Autonomous Quantitative Research Laboratory

**Repository:** `https://github.com/AtharvaGadre/agent-verse-project`  
**Principal Architect Background:** MPhys Physics (University of Sheffield) · MSc Computational Finance (UCL) · Industrial experience in Azure Databricks, Data Factory, SQL, Python, C#, and algorithmic strategy optimization.

---

## 1. Project Motivation & Overview
AlphaForge is a production-grade, open-source autonomous quantitative research laboratory engineered to bridge the gap between theoretical signal discovery and institutional execution reality. Rather than relying on zero-cost or static slippage assumptions, AlphaForge subjects every factor hypothesis to **Monte Carlo microstructure execution simulations**, **Almgren-Chriss optimal liquidation trajectories**, **Square-Root market impact laws**, **Obizhaeva-Wang limit order book resilience decay**, and **Merton jump-diffusion tail shocks**.

## 2. Core Mathematical & Engineering Capabilities
1. **Monte Carlo Execution & Slippage Risk Laboratory (`src/engine/slippageMonteCarlo.ts`)**:
   - **Almgren-Chriss (2000) Optimal Trajectory**: Solves $x(t_k) = Q \frac{\sinh(\kappa(T-t_k))}{\sinh(\kappa T)}$ with urgency $\kappa = \sqrt{\frac{\lambda \sigma^2}{\eta}}$, benchmarked side-by-side against TWAP, U-profile VWAP, and dynamic POV schedules.
   - **Square-Root Market Impact Law**: $\Delta P / P = Y \cdot \sigma_{\text{daily}} \sqrt{Q / V_{\text{ADV}}}$.
   - **Stochastic Volatility & Jump Cascades**: Simulates $M \in [100, 2000]$ paths combining Heston mean-reverting volatility ($\xi$), Poisson jumps ($\lambda_J$), dynamic bid-ask spread widening, and transient order-book depth recovery ($\rho$).
   - **Tail-Risk Shortfall Analytics**: Full Implementation Shortfall histogram, $\text{VaR}_{95}$, $\text{CVaR}_{95}$ (Expected Shortfall), $\text{VaR}_{99}$, $\text{CVaR}_{99}$, and a **4-Regime Volatile Market Stress Matrix** (*Normal Equilibrium*, *Elevated Macro Volatility*, *Flash Crash / Jump Cascade*, and *Order Book Liquidity Drought*).
2. **Point-in-Time Factor Research & Walk-Forward Backtesting (`src/engine/quantEngine.ts`)**:
   - 6 canonical and physics-inspired factor families with Rank IC, IC Decay curves, Quantile Q1–Q5 spreads, factor correlation matrices, and 60% Train / 20% Validation / 20% Locked Out-of-Sample Holdout walk-forward backtests.
3. **QuantPhysics SDE Extension (`src/components/QuantPhysicsLab.tsx`)**:
   - Interactive stochastic differential equation simulations for Ornstein-Uhlenbeck, Heston Stochastic Volatility, Langevin Anharmonic Potential, and GBM baselines with Hurst exponent ($H$) and Shannon entropy ($H_S$) diagnostics.
4. **13-Role Autonomous Research Agents, Improvement Engine & 30-Section Reports (`src/engine/researchOrchestrator.ts`)**:
   - Cooperating specialist agents backed by server-side Gemini (`@google/genai`) + deterministic validation guardrails, 15-field Improvement Cards (`PROPOSED → APPROVED → RUNNING → EVALUATED → ACCEPTED/REJECTED`), and an Exhaustive 30-Section Scientific Report Generator.

## 3. Reproducible Local Setup & Verification
```bash
npm install
npm test          # Runs deterministic node:test suite via tsx
npm run lint      # Runs TypeScript strict check (tsc --noEmit)
npm run build     # Builds production bundle
npm run dev       # Launches Express + Vite full-stack server on http://localhost:3000
```
