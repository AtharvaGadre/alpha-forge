# DATA_SOURCES.md & SECURITY.md & CONTRIBUTING.md

## 1. Market Data Provenance & Licensing
AlphaForge ships with a deterministic, clearly labeled **Synthetic Point-in-Time Multi-Regime Institutional Demonstration Dataset (`AF-PIT-EQ-2020-2026-v2.4`)** spanning 24 liquid large-cap and mid-cap equities/ETFs across 4 distinct volatility regimes (Calm Expansion, Inflationary Tightening, Liquidity Shock, and High-Dispersion Recovery).
- **Corporate Actions**: Explicitly models split adjustments and dividend reinvestment timestamps.
- **Survivorship Bias Disclosure**: Synthetic delisting events are included in the universe to prevent survivorship inflation; any user-imported historical CSV must declare whether delisted constituents are present.

## 2. Security Policy (`SECURITY.md`)
- **Zero Client-Side Secrets**: `GEMINI_API_KEY` is accessed strictly inside `server.ts` on the Node.js backend. No API keys or credentials are ever bundled into the browser or committed to git.
- **Sandboxed Expression Evaluation**: AlphaGenome factor expressions are parsed via a strict typed AST grammar rather than `eval()` or arbitrary code execution.

## 3. Contributing (`CONTRIBUTING.md`)
All pull requests must pass `npm test` (`node:test` mathematical invariant suite) and `npm run lint` (`tsc --noEmit`) before merge.
