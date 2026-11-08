# REPRODUCIBILITY.md & RESEARCH_STANDARDS.md

## 1. Deterministic Seeding & Checksums
Every simulation in AlphaForge uses a seeded `Mulberry32` pseudo-random number generator and Box-Muller normal transform (`src/engine/prng.ts`). Given an identical `(seed, datasetSnapshotId, parameterConfig)` tuple, the Monte Carlo Slippage Engine, QuantPhysics SDE solver, and Walk-Forward Backtester produce bit-identical floating-point outputs across runs.

## 2. Point-in-Time Discipline & Bias Controls
- **Look-Ahead Prevention**: Signals at time $t$ are computed strictly from data with availability timestamp $\tau_{\text{avail}} \le t$, and trades execute at $t + 1$ incorporating realistic execution slippage.
- **Holdout Segregation**: Every experiment partitions the timeline into **Exploration/Train (60%)**, **Validation (20%)**, and **Untouched Out-of-Sample Holdout (20%)**. Repeated tuning on the validation/holdout set triggers an automatic `CONTAMINATED_HOLDOUT` warning badge in the Experiment Registry.

## 3. Verification Commands
```bash
npm install
npm test
npm run lint
npm run build
```
