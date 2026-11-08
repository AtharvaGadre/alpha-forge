# SECURITY.md

- Never commit `.env` or API tokens.
- All LLM requests run server-side in `server.ts` using `@google/genai` with `process.env.GEMINI_API_KEY`.
- Factor expressions and slippage models execute through deterministic, bounds-checked mathematical ASTs.
