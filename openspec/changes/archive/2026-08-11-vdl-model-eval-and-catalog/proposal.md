## Why

SmolLM2-360M hallucinates Labs branding (e.g. “Vandouno”) and cannot be trusted as a Tiny fallback. Labs also needs a local multi-model evaluation harness and a place to publish results — separate from Interactive Demos — while exploring multi-architecture LiteRT (Gemma + Qwen3, spike Ministral) on the existing CDN runtime.

## What Changes

- Replace Tiny with LiteRT Qwen3-0.6B; prune outdated WebLLM optionals (SmolLM2, Qwen2.5-1.5B, Llama-3.2-3B); refresh peers (Qwen3-1.7B, Phi-4-mini); keep Gemma 4 LiteRT default.
- Label LiteRT models as `web-official` / `portable` / `experimental` spike; add Ministral LiteRT only if spike loads.
- Add headless `vdl-model-eval` (suite, scorers, concurrency planner, HTML/JSON reports) plus `pnpm model-eval` Playwright WebGPU runner.
- Add Labs **Tools** site section (`#tools/model-eval`) with docs + report UI/charts — not in Interactive Demos.
- Add `@vanduo-oss/vd3-cbun` for eval charts on the Tools page.

## Capabilities

### New Capabilities
- `vdl-model-eval`: Local on-computer model evaluation harness, report format, and Tools-section presentation.
- `vdl-tools-nav`: Labs site Tools route for on-computer helper tools (not demos).

### Modified Capabilities
- `vdl-ai-chat`: Multi-architecture LiteRT catalog; Tiny id; honest support labels; remove SmolLM2 Tiny.

## Impact

- Labs `vdl` surface: `ai-chat.js`, new `model-eval.js`, `utils/*`, `src/App.vue`, new `VdlModelEvalUI`, `doc/*`, package exports/scripts.
- Dependency: `@vanduo-oss/vd3-cbun` (charts). `@vanduo-oss/vd3` APIs unchanged.
- Local-only WebGPU eval (not CI); unit tests cover scorers and catalog ids.
