# AlphaForge — Autonomous Quantitative Research Laboratory

**Repository:** `https://github.com/AtharvaGadre/alpha-forge`  
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

## 3. AlphaForge Atmosphere — Live Pipeline (`src/engine/liveAtmospherePipeline.ts`)
ARGON answers questions about **any place** ("Hey ARGON, what could next week's rainfall mean for Brazilian coffee?", "Nairobi", "-21.5, -45.4") with numbers computed from live public data — no fixtures:

| Stage | What runs | Data |
| :--- | :--- | :--- |
| **Resolve** | Region presets (coffee belt, Corn Belt, Texas, NW Europe, Asia, India, cocoa belt) or exact-match geocoding | Open-Meteo Geocoding |
| **Predict** | 8 global models (ECMWF IFS & AIFS, GFS, ICON, UKMO, ARPEGE, JMA, GEM) + ECMWF ENS (51) & GEFS (31) members; stale runs (> 24 h) and short-horizon models are excluded with a stated reason | Open-Meteo Forecast, Ensemble, model metadata |
| **Verify** | What each model forecast 1/3/5 days ahead over the last 40 days, scored against ERA5. Inverse-MSE weights + spread inflation are fitted on the older half and **kept only if they beat equal weights on the unseen newer half** (CRPS) | Open-Meteo Previous-Runs, ERA5 |
| **Model consequences** | 10-year same-week climatology → rainfall / temperature / degree-day / heat / wind anomalies (z-scores) → transmission chains to mapped instruments, observed 5-session price moves, and a 10-year monthly weather-vs-returns test (Pearson r, p) | ERA5, NASA POWER, Yahoo Finance chart endpoint (unofficial) |
| **Explain** | A–F matrix separating observed weather, forecasts, mechanisms, observed prices, conditional hypotheses (with invalidation criteria) and open uncertainties; Gemini may only rephrase these numbers | — |
| **Reproduce** | Ensemble re-computed from published inputs; SHA-256 of all inputs | — |

```bash
curl "http://localhost:3000/api/v2/atmosphere/investigate?q=Brazil%20coffee"   # full JSON incl. every source URL
npm run smoke:live -- "How will the weather in Texas affect power demand next week?"
```
If the live providers are unreachable, ARGON falls back to the built-in demo fixture and labels it **OFFLINE DEMO FIXTURE** in the UI. Free Open-Meteo/Yahoo endpoints are for non-commercial research use; commercial deployment needs the corresponding paid plans.

## 4. Reproducible Local Setup & Verification
```bash
npm install
npm test          # Deterministic maths + live-pipeline unit tests (offline, mocked APIs)
npm run lint      # Runs TypeScript strict check (tsc --noEmit)
npm run build     # Builds production bundle
npm run dev       # Launches Express + Vite full-stack server on http://localhost:3000
```
