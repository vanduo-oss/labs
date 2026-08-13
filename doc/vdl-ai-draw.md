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
2. **Context-Aware AI**: Injects a sanitized representation of the current SVG DOM into the LLM system prompt on every turn so the AI "sees" what you draw.
3. **Structured Tool Calling Protocol**: The AI emits structured XML/JSON function calls which execute directly on the `VdDrawCore` engine.
4. **Parametric curve recipes**: `add_curve` samples sine / spiral / star / etc. in TypeScript so the model does not invent sparse polylines.
5. **Code-mode geometry**: `eval_geometry` runs a short sandboxed JS sampler (`Math.sin` loops) and returns points.
6. **Deterministic Guardrails**: FOSS jailbreak / prompt-injection guardrails plus SVG sanitization.

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

| Tool | Action | Parameters |
|:---|:---|:---|
| `add_shape` | Injects a primitive | `type` (rectangle, ellipse, line, text, freehand), coords, `points` (≥32 for smooth curves), `place`, `smooth` |
| `add_curve` | Parametric recipe (TypeScript sampler) | `kind` (sine, cosine, wave, spiral, polygon, star, arc, heart), `bounds` / `place`, `samples`, `cycles`, `stroke` |
| `eval_geometry` | Sandboxed JS → shape payload | `code` arrow fn receiving `{ Math, width, height }` |
| `update_shape` | Patch shape by ID (incl. `points`) | `shapeId`, position, dimension, color, opacity, `points`, `smooth` |
| `remove_shape` | Deletes a shape | `shapeId` |
| `clear_canvas` | Wipes all vector elements | None |
| `get_canvas` | Returns sanitized SVG markup | None |
| `list_shapes` | Lists active shapes & bounding boxes | None |

**Harness notes**

- AI-created multi-point lines set `arrowEnd: false` and `smooth: true` (Catmull-Rom cubics in `pointsToPath`).
- Sparse polylines while the user asked for a sine/wave get a `too_few_samples` warning so the tool loop can retry with `add_curve`.
- Unknown `add_shape` types are rejected (no silent rectangle).
- Recipe / embedding retrieval for large catalogs is deferred — keep CRUD tools always in context; index recipes later with static embeddings when the library exceeds ~30 entries. Do **not** load a second WebGPU LLM beside Gemma.

---

## Manual dogfood script

Open `http://localhost:3000/#demos/aidraw`, load Gemma, then try:

1. `red sine in center of canvas` — expect a dense smooth wave via `add_curve`, not a 3-point zigzag.
2. `clear it — draw a 5-point star`
3. `smooth spiral in the middle`
4. `draw a green heart`
5. `use eval_geometry to plot y = sin(x) across the canvas in blue`

Success = smooth curves on the first or second tool round, no “I cannot draw a sine” apology.

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
- **eval_geometry sandbox**: Frozen `Function` with only `{ Math, width, height }`; rejects `fetch`, `document`, `window`, `import`, etc. Max 256 points.
