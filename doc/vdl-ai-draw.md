# vdl-ai-draw

In-browser AI-assisted SVG canvas powered by **Gemma 4** WebGPU tool calling and **`@vanduo-oss/vd3-cbun/draw`**.

- **Version**: `v0.1.0`
- **Source**: `labs/src/components/VdlAiDrawUI.vue`
- **Harness**: `labs/src/demos/draw-tools.js`
- **Dependencies**: `@vanduo-oss/vd3`, `@vanduo-oss/vd3-cbun`, `@vanduo-oss/vdl-ai-chat`, `@litert-lm/core`

---

## Overview

`vdl-ai-draw` is an experimental interactive drawing environment that bridges deterministic vector canvas editing with local generative AI. The AI runs directly in the user's browser using **LiteRT WebGPU** and natively invokes tool calls to manipulate the SVG drawing board in real time.

### Key Capabilities

1. **Local-First WebGPU Inference**: Runs Gemma 4 E4B / E2B entirely on device without sending canvas data to any external server.
2. **Two-step harness (plan → draw)**: Unknown/complex prompts first get a short **planner** turn (JSON `DrawPlan`, no tools). The host validates/compresses and retains `lastPlan`. A second **cleared-context draw** turn receives only numbered tool instructions. Known recipes (flags, math axes, star/heart/smiley, **hexagon grids**) still use a **regex host plan** — one draw call, no planner LLM.
3. **Context-Aware AI**: Injects a sanitized representation of the current SVG DOM into the LLM system prompt on every turn so the AI "sees" what you draw (execute/fallback phases; planner uses canvas size + lastPlan only).
4. **Structured Tool Calling Protocol**: The AI emits structured XML/JSON function calls which execute directly on the `VdDrawCore` engine.
5. **Parametric curve recipes**: `add_curve` samples sine / spiral / star / etc. in TypeScript so the model does not invent sparse polylines.
6. **Code-mode geometry**: `eval_geometry` runs a short sandboxed JS sampler (`Math.sin` loops) and returns points.
7. **Deterministic Guardrails**: FOSS jailbreak / prompt-injection guardrails plus SVG sanitization.

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
|  |  |  SVG Vector Canvas  |  | <== |  |  Gemma 4 E4B LLM    |  |  |
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
- **Two-step `runDrawTurn`**: regex-known intents → host plan → draw. Everything else → LLM planner (`generate`, tools cleared) → validate/merge `lastPlan` → cleared-context draw (`generateWithTools` + slim execute policy). Invalid planner JSON retries once, then falls back to a single tool loop on the raw user text. Follow-ups merge into `lastPlan` and replay the full plan. Fulfill stays scoped to the **current** user message only.
- **Assistant text matches the canvas**: the visible reply is authored from `list_shapes` / `getShapes()` after tools run. A success claim is never shown when the canvas is empty or unchanged — this is global, not only flag/math. Raw DrawPlan JSON (`"steps"` / `"op":`) is never echoed; the harness uses “Nothing was drawn…” or a canvas summary instead. LLM plans may show a short `Plan: …` line above the harness reply.
- **Stacking**: `place="center"` no longer overwrites an explicit `y`. Repeating the same bbox (the usual “three `place=center` rectangles” mistake) auto-offsets `y` so the last fill cannot cover the others. `place="stack"` appends the next full-width band. `fillColor` / `color` are accepted as fill for solid bands.
- Recipe / embedding retrieval for large catalogs is deferred — keep CRUD tools always in context; index recipes later with static embeddings when the library exceeds ~30 entries. Do **not** load a second WebGPU LLM beside Gemma.

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
10. `draw a small house with a yellow sun` — exercises the **plan → draw** path (not a regex chip). Expect Planning… then Drawing… and at least one shape on the canvas.

Success = stacked flags show every band; a later math prompt does **not** leave the flag on screen; a star/smiley/heart/hex-grid request leaves those shapes on the canvas; assistant text matches the canvas (never “I have drawn…” or raw DrawPlan JSON on an empty board); no “I cannot draw a flag / sine” apology; unknown scenes go through the two-step harness.

### Automated tests

```bash
pnpm test:unit -- tests/unit/draw-tools.spec.ts   # CI-safe executor + intent tests
pnpm test:local                                   # real Gemma requests on this Mac
```

`pnpm test:local` runs `tests/local/ai-draw-inference.spec.ts` when `RUN_AI_DRAW_INFERENCE=1` **or** the host is `darwin/arm64` (Apple Silicon). It is ignored by `pnpm test` / Linux CI. Default model is Gemma 4 E2B (`AI_DRAW_MODEL=gemma-4-E4B-it-web` to match the UI). Prefetch weights with `pnpm models:fetch`. Use `AI_DRAW_HEADED=1` if headless Chromium fails WebGPU.

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
