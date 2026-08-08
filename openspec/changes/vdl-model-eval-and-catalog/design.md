## Context

See proposal.md — Why. Today `ai-chat.js` loads Gemma 4 via LiteRT CDN and optional WebLLM models including SmolLM2-360M. Eval is limited to mocked unit tests and a headed Gemma smoke runner. Site nav is home / about / demos only.

## Goals / Non-Goals

**Goals:**
- Multi-architecture LiteRT catalog with honest support labels
- Tiny = LiteRT Qwen3-0.6B; remove SmolLM2
- Local eval harness + Tools page for reports/charts
- Spike Ministral; ship only if load works

**Non-Goals:**
- Transformers.js chat backend
- Shipping `.models/` in dist
- Claiming Google official web support for non-Gemma LiteRT
- CI WebGPU inference

## Decisions

1. **Same LiteRT loader for all `.litertlm`** — Extend `MODEL_OPTIONS` metadata (`family`, `litertKind`) and per-model `maxNumTokens`; keep one `Engine.create` path. Alternative: separate engines per family — rejected as unnecessary.

2. **Tiny on LiteRT, not WebLLM** — Prefer architecture A/B on one runtime. WebLLM Qwen3-1.7B / Phi-4 / Coder remain optional peers.

3. **Eval via Playwright Chromium + harness page** — Reuse Gemma smoke pattern; browser loads `AiChat`. Scorers live in `model-eval.js` for unit testing offline.

4. **Tools ≠ Demos** — New `#tools` route; Model Eval never joins `DEMO_SLUGS`.

5. **Charts via `@vanduo-oss/vd3-cbun`** — Keep `@vanduo-oss/vd3` for shell; charts only on Tools eval UI.

6. **Ministral spike-gated** — Prefetch/attempt load; if fail, document in `doc/vdl-ai-chat.md` and omit from picker.

## Risks / Trade-offs

- [Non-official LiteRT models break after CDN update] → Label portable/experimental; eval catches regressions locally.
- [Parallel WebGPU OOMs] → Concurrency planner uses `approxBytes` + RAM heuristic; fall back to serial.
- [vd3-cbun API mismatch] → Thin adapter in UI; degrade to tables if chart import fails.

## Migration Plan

Ship catalog + Tools + sample report together. No user data migration. Weak-device copy updates to name Qwen3 Tiny.
