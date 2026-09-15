## Why

Unknown-scene draws ("draw a small house with a yellow sun") burn two Gemma turns: a planner turn that emits a JSON DrawPlan, then a cleared-context draw turn where the same model re-emits tool calls from numbered instructions. When the draw pass underperforms, the host already executes the plan anyway (`PLAN_FULFILLMENT`). That second turn is mostly wasted latency — the single biggest cost in the plan→draw path — and E4B defaults make prefill slower than it needs to be.

## What Changes

- **Host-first execution**: validated DrawPlans (host recipes and LLM plans) are executed directly by the harness via `execute()`. The LLM `generateWithTools` pass becomes a fallback for turns with no valid plan (planner missing/invalid JSON). Emits a new `executing` phase instead of `drawing` for this path.
- **E2B default**: `VdlAiDrawUI` defaults to `gemma-4-E2B-it-web` (~3x faster prefill than E4B); E4B remains selectable as "Quality".
- **Fast planner experiment (flagged, default off)**: optional WebLLM Qwen3-0.6B planner via a second `AiChat` instance (`TINY_MODEL_ID`) used for planning only. Gemma loads lazily only if the LLM fallback pass is needed. Never two concurrent generations; never two LiteRT engines.
- **Draw eval suite**: `pnpm model-eval:draw` measures plan validity, shapes drawn, and wall time per prompt/model against the local inference harness, writing reports under `data/model-eval-reports/draw/`.

## Capabilities

### New Capabilities

- `vdl-ai-draw`: Host-first DrawPlan execution, phase contract, tiny-planner flag rules, and eval suite requirements.

### Modified Capabilities

None (engines stay published packages; no `vd3` surface changes).

## Impact

- Labs-only: `src/demos/draw-intent.js` (runDrawTurn), `src/components/VdlAiDrawUI.vue`, new `src/demos/draw-planner-webllm.js`, `utils/model-eval-draw-*`, tests, docs.
- Supersedes the blanket "never load a second WebGPU LLM" note in `doc/vdl-ai-draw.md` with a precise rule.
- Follow-up (out of scope): upstream `@vanduo-oss/vdl-ai-chat` proposal to adopt LiteRT-LM `AutoToolChat` parallel tool execution for the fallback loop.

## Status

Proposed.
