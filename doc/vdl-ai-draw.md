# vdl-ai-draw

In-browser AI-assisted SVG canvas powered by **Gemma 4** WebGPU tool calling and **`@vanduo-oss/vdl-cbun/draw`**.

- **Version**: `v0.1.0`
- **Source**: `labs/src/components/VdlAiDrawUI.vue`
- **Harness**: `labs/src/demos/draw-tools.js`
- **Dependencies**: `@vanduo-oss/vd3`, `@vanduo-oss/vdl-cbun`, `@vanduo-oss/vdl-ai-chat`, `@litert-lm/core`

---

## Overview

`vdl-ai-draw` is an experimental interactive drawing environment that bridges deterministic vector canvas editing with local generative AI. The AI runs directly in the user's browser using **LiteRT WebGPU** and natively invokes tool calls to manipulate the SVG drawing board in real time.

### Key Capabilities

1. **Local-First WebGPU Inference**: Runs Gemma 4 E2B (default) / E4B entirely on device without sending canvas data to any external server.
2. **Host-first plan execution**: Unknown/complex prompts get a short **planner** turn (JSON `DrawPlan`, no tools). The host validates/compresses the plan, retains `lastPlan`, and **executes the steps directly** — no second model pass. The cleared-context `generateWithTools` loop remains only as a **fallback** for turns with no valid plan (missing planner, invalid JSON, empty merged plan). Known recipes (flags, math axes, star/heart/smiley, stencils, **hexagon grids**) use a **regex host plan** — zero model calls.
3. **Read-only question turns**: Questions about the canvas ("what is on canvas now ?") are answered from the harness-authored canvas summary — never planned, never drawn.
4. **Context-Aware AI**: Injects a sanitized representation of the current SVG DOM into the LLM system prompt on execute/fallback phases; planner uses canvas size + lastPlan only; the QA phase uses canvas facts only.
5. **Structured Tool Calling Protocol**: The fallback loop emits structured XML/JSON function calls which execute directly on the `VdDrawCore` engine.
6. **Parametric curve recipes**: `add_curve` samples sine / spiral / star / etc. in TypeScript so the model does not invent sparse polylines.
7. **Code-mode geometry**: `eval_geometry` runs a short sandboxed JS sampler (`Math.sin` loops) and returns points.
8. **Deterministic Guardrails**: FOSS jailbreak / prompt-injection guardrails plus SVG sanitization.
9. **Fast planner experiment (flagged, off by default)**: optional WebLLM Qwen3-0.6B planner for the planning turn only — see below.

---

## Architecture & Data Flow

```
+-------------------------------------------------------------------+
|                        VdlAiDrawUI Component                      |
|                                                                   |
|  +---------------------------+     +---------------------------+  |
|  |    VdDraw (vd3-cbun)      |     |     Chat Panel (WebGPU)   |  |
|  |                           |     |                           |  |
|  |  +---------------------+  |     |  +---------------------+  |  |
|  |  |  SVG Vector Canvas  |  | <== |  |  Gemma 4 E2B LLM    |  |  |
|  |  +---------------------+  | ==> |  +---------------------+  |  |
|  |                           |     |                           |  |
|  +---------------------------+     +---------------------------+  |
+-------------------------------------------------------------------+
```

### Canvas Tools Executed by AI

| Tool            | Action                                 | Parameters                                                                                                                                      |
| :-------------- | :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `add_shape`     | Injects a primitive                    | `type` (rectangle, ellipse, line, text, freehand), coords, `points` (≥32 for smooth curves), `place`, `smooth`                                  |
| `add_curve`     | Parametric recipe (TypeScript sampler) | `kind` (sine, cosine, tangent, hyperbola, parabola, wave, spiral, polygon, star, arc, heart), `bounds` / `place`, `samples`, `cycles`, `stroke` |
| `eval_geometry` | Sandboxed JS → shape payload           | `code` arrow fn receiving `{ Math, width, height }`                                                                                             |
| `update_shape`  | Patch shape by ID (incl. `points`)     | `shapeId`, position, dimension, color, opacity, `points`, `smooth`                                                                              |
| `remove_shape`  | Deletes a shape                        | `shapeId`                                                                                                                                       |
| `clear_canvas`  | Wipes all vector elements              | None                                                                                                                                            |
| `get_canvas`    | Returns sanitized SVG markup           | None                                                                                                                                            |
| `list_shapes`   | Lists active shapes & bounding boxes   | None                                                                                                                                            |

**Harness notes**

- AI-created multi-point lines set `arrowEnd: false` and `smooth: true` (Catmull-Rom cubics in `pointsToPath`).
- Sparse polylines while the user asked for a sine/wave get a `too_few_samples` warning so the tool loop can retry with `add_curve`.
- Unknown `add_shape` types are rejected (no silent rectangle). `add_shape type=polygon` / `hexagon` is **not** a primitive — `validateDrawPlan` coerces it to `add_curve kind=polygon sides=6` (bounds from points / place) and normalizes `stroke-width` → `strokeWidth`. Planner policy forbids `add_shape type=polygon`.
- **Hexagon grid recipe**: prompts like `hexagon grid of 9 identical hex cells` (N parsed from the prompt, default 9, cap 12) become a host `DrawPlan` of `add_curve kind=polygon sides=6` cells in a compact **pointy-top** honeycomb (3×3 for nine; odd rows offset by half a cell). `generatePlan` is skipped. If the model emits nothing or the wrong tools, `fulfillHexGridIntent` still draws the grid with distinct bounds (not nine `place=center` stacks).
- **Intent normalize** (`normalizeDrawUserIntent`): simple flags / stacked stripes become a host `DrawPlan` of explicit rectangles so Gemma is not asked to “paint a national flag”. No planner LLM for those chips. After the tool loop, `fulfillStackedBandIntent` adds or repositions any missing band (small models often emit one rectangle and claim they drew three).
- **Two-step `runDrawTurn` → host-first execution**: regex-known intents → host plan. Everything else → LLM planner (`generate`, tools cleared) → validate/merge `lastPlan` → **host executes the steps directly** (`executing` phase; LLM plans wipe the canvas first so merged follow-ups replay without duplicates). Invalid planner JSON retries once, then falls back to a single cleared-context tool loop on the raw user text — the only path that still uses `generateWithTools`. Follow-ups merge into `lastPlan` and replay the full plan. Fulfill stays scoped to the **current** user message only.
- **Question turns are read-only**: prompts shaped as questions about the canvas (no action verb, or "what can you draw?" capability phrasing) route to an `answering` phase with no tools registered. The model receives `formatCanvasQuestionPrompt` — a harness-authored canvas summary plus the question — and may only phrase it; the reply passes through the same honesty guards (`assistantClaimConflictsWithCanvas`). Nothing is ever drawn, cleared, or re-planned by a question.
- **Assistant text matches the canvas**: the visible reply is authored from `list_shapes` / `getShapes()` after tools run. A success claim is never shown when the canvas is empty or unchanged — this is global, not only flag/math. Raw DrawPlan JSON (`"steps"` / `"op":`) is never echoed; the harness uses “Nothing was drawn…” or a canvas summary instead. LLM plans may show a short `Plan: …` line above the harness reply.
- **Stacking**: `place="center"` no longer overwrites an explicit `y`. Repeating the same bbox (the usual “three `place=center` rectangles” mistake) auto-offsets `y` so the last fill cannot cover the others. `place="stack"` appends the next full-width band. `fillColor` / `color` are accepted as fill for solid bands.
- **Model policy**: one generative engine by default — Gemma 4 E2B (default; ~3× faster prefill than E4B, 2 GB vs 3 GB download). E4B stays selectable as the quality option. LiteRT-LM JS reliably loads only Gemma `*-it-web` builds today (Qwen/Ministral `.litertlm` PrefillDecode probes fail to load), so Gemma is the only in-browser native tool-calling executor.
- **Fast planner experiment** (`vdl-ai-draw-tiny-planner` flag): when enabled, the planning turn routes to WebLLM Qwen3-0.6B via a second planning-only `AiChat` (`TINY_MODEL_ID`; tools never registered on it). Three hard rules: (1) the tiny planner gets the **compact planner prompt** (`compactPlannerUserPrompt`) because Qwen3-0.6B has a 4K context window — the full prompt plus WebLLM history measured ~4900 tokens and overflowed; (2) its conversation **resets before every plan** (planning is stateless); (3) Gemma loads lazily only if the fallback tool loop actually needs it, and never two engines generate concurrently or two LiteRT engines exist per page. Any load/generate failure (including context overflow) disables the fast planner for the session with a status message; the persisted user flag is untouched. Promotion of the default is gated on `pnpm model-eval:draw` numbers (plan validity within 5% of Gemma and ≥2× faster planning).
- Recipe / embedding retrieval for large catalogs is deferred — keep CRUD tools always in context; index recipes later with static embeddings when the library exceeds ~30 entries. Never load a second LiteRT engine beside Gemma; the only sanctioned second model is the flagged WebLLM tiny planner above. Upstream follow-up: adopt LiteRT-LM `AutoToolChat` parallel tool execution inside `@vanduo-oss/vdl-ai-chat` for the fallback loop.

---

## Draw eval suite

```bash
pnpm model-eval:draw                                  # E2B + E4B baseline
pnpm model-eval:draw -- --models gemma-4-E2B-it-web   # single model
AI_DRAW_FAST_PLANNER=1 pnpm model-eval:draw           # exercise Qwen3-0.6B planning
```

Runs `utils/model-eval-draw-runner.mjs`: spawns its own Vite server (port 8793), drives `tests/fixtures/ai-draw-harness.html`, executes every case in `utils/model-eval-draw-suite.json` (dogfood prompts + unknown scenes), and scores plan source, shape counts, and wall time. Reports land in `data/model-eval-reports/draw/` (JSON + `latest.md` comparison table). Gated to darwin/arm64 or `RUN_AI_DRAW_INFERENCE=1`; CI never downloads models. Use it to compare planner candidates (E2B vs E4B vs fast-planner) before changing defaults.

---

## Manual dogfood script

Open `http://localhost:3000/#demos/aidraw`, load Gemma, then try (or click the example chips):

1. `paint big fat nice Lithuanian flag (yellow-green-red)` — three stacked filled rectangles (yellow / green / red), **no refusal**.
2. `draw x y axis and sin, cosin, tan and hyperbola on them - as in maths` — axes + sin/cos/tan/hyperbola; a previous flag is cleared.
3. `draw a five pointed star` — five-point star via `add_curve kind=star`, even if the model emits no tools.
4. `pls draw a hexagon grid of 9 identical hex cells` — nine pointy-top hex cells via `add_curve kind=polygon sides=6` (host honeycomb; no planner JSON in chat).
5. `draw a yellow smiley face` — constructed 😊 (circle + eyes + mouth arc), not a Unicode glyph.
6. `draw a green heart` — parametric heart recipe.
7. `ok, three fat big rectangle lines stacked: yellow on top, then green then red` — all three bands visible (not only the last red).
8. `clear canvas - draw x y axis and sin, cosin, tan and hyperbola on them - as in maths` — same math plot after an explicit clear.
9. Full screen (canvas control or chat header) — big canvas + chat; example chips overlay the **empty** canvas, then sit in the chat **Try** row once shapes exist. **Exit full screen** in the top bar, or Escape.
10. `draw a small house with a yellow sun` — exercises the plan path (not a regex chip). Expect Planning… then shapes appear directly (**host-executed**; a second Drawing… pass appears only when the planner JSON was invalid and the fallback loop runs). At least one shape on the canvas.
11. `what is on canvas now ?` — read-only answer turn: status shows Thinking…, nothing is drawn or cleared, reply describes the canvas.
12. Fast planner toggle (sidebar) — with it on, unknown scenes plan via Qwen3-0.6B (WebLLM download ~0.6 GB on first use); status shows "Fast planner…" notes only on failure; Gemma still runs any fallback pass.

Success = stacked flags show every band; a later math prompt does **not** leave the flag on screen; a star/smiley/heart/hex-grid request leaves those shapes on the canvas; assistant text matches the canvas (never “I have drawn…” or raw DrawPlan JSON on an empty board); no “I cannot draw a flag / sine” apology; unknown scenes draw after a single planning turn; questions never modify the canvas.

### Automated tests

```bash
pnpm test:unit -- tests/unit/draw-tools.spec.ts   # CI-safe executor + intent tests
pnpm test:local                                   # real Gemma requests on this Mac
```

`pnpm test:local` runs `tests/local/ai-draw-inference.spec.ts` when `RUN_AI_DRAW_INFERENCE=1` **or** the host is `darwin/arm64` (Apple Silicon). It is ignored by `pnpm test` / Linux CI. Default model is Gemma 4 E2B, matching the UI (`AI_DRAW_MODEL=gemma-4-E4B-it-web` to switch). Prefetch weights with `pnpm models:fetch`. Use `AI_DRAW_HEADED=1` if headless Chromium fails WebGPU.

---

## Component Integration

```html
<script setup>
  import VdlAiDrawUI from './components/VdlAiDrawUI.vue';
</script>

<template>
  <VdlAiDrawUI />
</template>
```

---

## Security & Safety

- **SVG Sanitization**: All incoming AI-generated SVG shapes and canvas exports pass through `sanitizeSvgString()` to strip `<script>`, `<foreignObject>`, and event handlers (`on*`).
- **Input Guardrails**: Prompt inputs are validated using `validateLlmInput()` from `vdl-ai-chat/guardrails` before execution.
- **eval_geometry sandbox**: Constrained `Function` with a frozen number-only Math surface; rejects `fetch`, `document`, `window`, `.constructor`, etc. Max 256 points.
