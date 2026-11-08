# AGENTS.md — Persistent Autonomous Agent Instructions

## 1. Mission & Identity
AlphaForge is an open-source, institutional-grade Autonomous Quantitative Research Laboratory engineered for empirical factor discovery, Monte Carlo execution & slippage modeling, physics-informed stochastic modeling (QuantPhysics), and multi-agent scientific research validation.

**Principal Architect Profile**:
- MPhys Physics (University of Sheffield) & MSc Computational Finance (UCL)
- Expertise in stochastic calculus, statistical mechanics, Azure Databricks/Data Factory, Python/C#/TypeScript numerical pipelines, and algorithmic execution optimization.

## 2. Core Engineering Principles
1. **Deterministic Calculation Invariant**: Never allow an LLM to fabricate numerical backtest figures, IC values, Sharpe ratios, or Monte Carlo execution tail metrics. All financial and mathematical metrics are computed by deterministic algorithms in `src/engine/quantEngine.ts` and `src/engine/slippageMonteCarlo.ts`.
2. **Server-Side AI Orchestration**: All Gemini API invocations happen strictly in `server.ts` using `@google/genai` (`gemini-3.8-flash` / `gemini-4-argon`) with `User-Agent: aistudio-build`. If `GEMINI_API_KEY` is unconfigured or offline, the server degrades gracefully to deterministic algorithmic synthesis without breaking any research workflows.
3. **Zero Fabrication & Full Traceability**: Every claim in a generated 30-section report maps to an immutable `experimentId` and SHA-256 parameter/dataset checksum in `src/engine/experimentRegistry.ts`.

## 3. Verification & Resume Protocol
- Run deterministic unit tests first: `npx --yes tsx --test src/engine/quantEngine.test.ts`
- Run TypeScript check and build: `npm run lint && npm run build`
- Inspect `PROJECT_STATE.md` before starting any new milestone.
