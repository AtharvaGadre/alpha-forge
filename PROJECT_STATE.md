# PROJECT_STATE.md — AlphaForge System Status

## Current Phase
- **Active Milestone**: M0–M10 Complete (All Vertical Slices Implemented, Unit-Tested, and Browser-Verified)
- **Last Verified State**: Production-ready build (`npm test`, `npm run lint`, `npm run build` all passing with 0 errors).

## Completed Functionality
1. **Phase 0 Governance & Documentation**:
   - Created `AGENTS.md`, `PROJECT_STATE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `REPRODUCIBILITY.md`, `DATA_SOURCES.md`, `RESEARCH_STANDARDS.md`, `SECURITY.md`, `README.md`, and `.github/workflows/ci-research.yml`.
2. **Monte Carlo Execution & Slippage Risk Laboratory (`src/engine/slippageMonteCarlo.ts` & `src/components/SlippageMonteCarloLab.tsx`)**:
   - **Almgren-Chriss (2000) Optimal Execution Trajectory** ($\sinh(\kappa(T-t))/\sinh(\kappa T)$, urgency $\kappa = \sqrt{\lambda \sigma^2 / \eta}$) compared side-by-side against **TWAP**, **VWAP**, and **POV**.
   - **Square-Root Market Impact Law** ($\Delta P / P = Y \cdot \sigma_{\text{daily}} \sqrt{Q / V_{\text{ADV}}}$) + **Obizhaeva-Wang Limit Order Book Resilience** ($\exp(-\rho \Delta t)$).
   - **Stochastic Volatility & Jump-Diffusion Paths**: Heston mean-reverting volatility clustering ($\xi$) + Merton Poisson jump shocks ($\lambda_J$) + dynamic bid-ask spread widening.
   - **Tail Risk & Stress Testing**: Implementation Shortfall distribution histogram, $\text{VaR}_{95}$, $\text{CVaR}_{95}$, $\text{VaR}_{99}$, $\text{CVaR}_{99}$, cost component attribution, and a **4-Regime Volatile Market Stress Matrix** (*Normal Equilibrium*, *Elevated Macro Volatility*, *Flash Crash / Jump Cascade*, *Order Book Liquidity Drought*).
3. **Quantitative Factor Discovery, Walk-Forward Backtester & AlphaGenome (`src/engine/quantEngine.ts` & `src/components/FactorBacktestStudio.tsx`)**:
   - 6 canonical and physics-inspired factor families with formal LaTeX formulas, Rank IC, IC Decay curves, Quantile Q1–Q5 spreads, and cross-sectional correlation matrix.
   - Transaction-cost and slippage-aware walk-forward backtester with 60% Train / 20% Validation / 20% Locked Out-of-Sample Holdout segregation, block-bootstrap 95% confidence intervals, and Deflated Sharpe Ratio.
   - AlphaGenome Symbolic Regression & Multi-Objective Pareto Frontier explorer.
4. **QuantPhysics Laboratory (`src/components/QuantPhysicsLab.tsx`)**:
   - Interactive stochastic differential equation simulator for Ornstein-Uhlenbeck, Langevin Anharmonic Potential, Heston Stochastic Volatility, and GBM baselines with Hurst Exponent ($H$) and Shannon Entropy ($H_S$).
5. **13-Role Autonomous Research Agents, Improvement Engine & 30-Section Reports (`src/engine/researchOrchestrator.ts` & `src/components/AutonomousGovernanceHub.tsx`)**:
   - Server-side Gemini (`@google/genai` `gemini-3.8-flash`) integration in `server.ts` with deterministic mathematical validation fallback.
   - 15-field diagnostic Improvement Cards (`PROPOSED → APPROVED → RUNNING → EVALUATED → ACCEPTED/REJECTED`) with Before/After empirical validation.
   - Exhaustive 30-Section Scientific Report Generator with independent reconciliation audit check and `.MD` download.
- **Immutable Experiment Registry** with SHA-256 checksums and Holdout Contamination tracking.
6. **WorldPulse 3.0 — Photorealistic Global Financial Intelligence (`src/engine/worldPulseCountryEngine.ts`, `src/engine/worldPulseEngine.ts`, `src/components/WorldPulseGlobe3D.tsx`, `src/components/WorldPulseApp.tsx`)**:
   - **Photorealistic 3D Globe + 3D Metropolitan City Explorer + Google Maps Platform Integration (`@vis.gl/react-google-maps`)**:
     - Provisioned Google Maps Platform API key for user-selected Cloud project `uclagentverse26lon-5553` with `internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}`.
     - High-resolution satellite, bathymetric, and relief globe texture with country boundary polygon highlighting, 3D metropolitan building clusters (e.g., `"Explore London 3D"`), and verified directional flow arrows (`VERIFIED_DIRECTIONAL_ARROWS`).
   - **Global Country Explorer & Landmark Service**:
     - Reusable country pipeline (`COUNTRY_REGISTRY` + `resolveCountryOrUnseenProfile` for unseen jurisdictions) with live Wikimedia Commons / Wikipedia REST API landmark imagery (`/api/worldpulse/v3/landmark/:slug`) and instant SVG architectural fallbacks (e.g., *Tower Bridge, London*; *Manhattan Skyline, New York*; *Tokyo Tower, Tokyo*; *Eiffel Tower, Paris*; *Gateway of India, Mumbai*; *Taipei 101, Taipei*).
     - Explicit distinction between political capital and primary financial centre (e.g., India: New Delhi vs. Mumbai) and between stock-exchange listing venue and foreign revenue exposure (e.g., FTSE 100 ~76% international revenue).
   - **Persistent `BASIC | ADVANCED` User Mode Switch & `"Explain what I'm looking at"` Control**:
     - **BASIC Mode (Public Access)**: Defaults strictly to 2 layers (`1. News & Verified Events`, `2. Major Financial Markets`), compact news panel with 3 progressive explanation depths (*Quick 15s*, *Understand More*, *Full Quant*), and evidence-based credibility audits.
     - **ADVANCED Mode (Quant Lab)**: Exposes all 9 geospatial layers, Markowitz / Black-Litterman / HRP weights, HMM regime states, Options/Volatility surfaces, QuantPhysics SDE calibrations, Judge Counterfactual `"Why?"` Recalculator, and Adversarial Prompt-Injection Sandbox.
     - Shared `GeographicContext` across all AlphaForge laboratories (`Execution & Slippage`, `Factors & Backtest`, `QuantPhysics`, and `Agents & 30-Sec Reports`).

## Verification Status
- **Unit Tests (`node:test`)**: 8/8 suites passing (`src/engine/quantEngine.test.ts`), including Milestone 11 ARGON Atmosphere Engine (`src/engine/argonAtmosphereEngine.ts`).
- **TypeScript & Build**: `tsc --noEmit`, `vite build`, and Cloud Run native ESM execution (`node server.ts`) passing cleanly.
- **Browser Verification**: Verified WorldPulse 3.0 Photorealistic Globe, ARGON Voice Assistant HUD, Asia 10-step workflow, Brazil Coffee 28-section report viewer, responsive Mobile/Tablet/Desktop viewports, and zero console errors via headless Chromium (`playwright-cli`).
