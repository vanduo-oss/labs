# vdl-ai-chat

In-browser **AI Chat** powered by **LiteRT-LM** (Gemma 4) and optional WebLLM models, all on WebGPU.

Fully private, running entirely locally in your browser. FOSS guardrails enforced via strict system prompt.

- Component version: {{COMPONENT_VERSION}}
- Live labs site: **https://labs.vanduo.dev**

### Quick Start

**Headless engine (vanilla ESM):**

```javascript
import { AiChat } from '@vanduo-oss/vdl-ai-chat';

const chat = new AiChat();
await chat.load();
const reply = await chat.generate('Hello');
```

**Labs Vue + vd3 UI:**

```vue
<script setup>
import VdlAiChatUI from './src/components/VdlAiChatUI.vue';
</script>

<template>
  <VdlAiChatUI />
</template>
```

The Labs site uses Vue `VdlAiChatUI` on top of the published `@vanduo-oss/vdl-ai-chat` package.

### Local model mirror (dev)

For faster local loads of the default **Gemma 4 E2B** LiteRT package (~2.0GB), prefetch once into a gitignored folder and let Vite serve it (not included in `pnpm build` / GitHub Pages):

```bash
pnpm models:fetch          # downloads into .models/gemma-4-E2B-it-web/
pnpm models:fetch -- --model qwen3-0.6B-litert
pnpm models:fetch -- --model ministral-3-3B-litert   # experimental spike
pnpm models:fetch -- --dry-run
pnpm models:fetch -- --model gemma-4-E2B-it-q4f16_1-MLC   # optional legacy WebLLM package
pnpm dev                   # serves mirror at /models/<id>/
```

`AiChat.load()` probes `/models/<id>/…` and prefers that mirror when present; otherwise it uses the Hugging Face URLs.

### Features

- Default model is **Gemma 4 E2B** (`gemma-4-E2B-it-web`) via Google **LiteRT-LM** (`@litert-lm/core`) with real multi-turn conversation context.
- **Multi-architecture intent:** Gemma stays on LiteRT web-official; Tiny is **WebLLM Qwen3 0.6B** (SmolLM2 removed). LiteRT Qwen3 / Ministral remain catalog spikes but **load is blocked** until PrefillDecode works in LiteRT-LM.js.
- Legacy community **WebLLM/MLC** Gemma packages remain available but experimental: native multi-turn context is unreliable there (latest-turn-only workaround).
- Model picker is grouped:
  - **Gemma 4:** E2B (Fast / default, web-official), E4B (Quality)
  - **Qwen 3:** 0.6B MLC (Tiny) — replaces SmolLM2
  - **Experimental:** LiteRT Qwen3 / Ministral spikes (see below), Gemma 4 MLC peers
  - **Optional (WebLLM):** Qwen3 1.7B (Balanced), Phi-4 mini (Alt Quality), Qwen2.5 Coder 1.5B

### LiteRT spike notes (Labs) — observed 2026-08-08

| Artifact | HF resolve | Browser status with `@litert-lm/core` (CDN) |
|----------|------------|-----------------------------------------------|
| Gemma `*-it-web.litertlm` | public | **Works** (WebGPU / `GPU_ARTISAN` stream load) |
| `Qwen3-0.6B.litertlm` | public | **Blocked in Labs UI** — PrefillDecode; `GPU_ARTISAN` → `Streaming … not supported yet`; `Backend.GPU` non-stream `createEngine` → `null function` |
| Ministral `model.litertlm` | public | Same PrefillDecode class — catalog spike only; Load disabled with clear reason |

Google’s JS docs still list only Gemma web builds as supported. Labs keeps the spikes visible (labeled **Runtime unsupported**) so the gap is honest, but `AiChat.load()` refuses before download. Prefer Gemma 4 LiteRT or WebLLM Tiny (Qwen3 0.6B MLC) for chat.

SmolLM2-360M was removed: it hallucinated Labs branding (e.g. “Vandouno”) and is unsuitable as Tiny.

For architecture A/B reports, see [vdl-model-eval](./vdl-model-eval.md) (`#tools/model-eval`).
- Displays **System Info** at runtime (WebGPU support, adapter name, `shader-f16` support).
- Shows compatibility badges per tier (`native`, `fallback`, `unavailable`, `experimental`) to set user expectations.
- Automatically applies model fallbacks (typically `q4f32_1`) for optional built-in WebLLM models when required features are unavailable. Gemma 4 variants require `shader-f16`.
- Downloads and caches the selected model directly in the browser.
- Runs inference via WebGPU for high performance without a backend server.
- Uses shared FOSS guardrails (`@vanduo-oss/vdl-ai-chat/guardrails/llm`) to enforce harmlessness and objectivity.
- System context (`buildChatSystemPrompt`) is sent for LiteRT Gemma and optional WebLLM models that support a system role. Community MLC Gemma (`gemma4` + WebLLM) omits system messages (template limitation that truncates replies); those runs rely on the deterministic input scanner only.
- Includes a deterministic regex scanner to fast-reject known prompt injections and jailbreaks before they reach the model.
- Enforces deterministic input validation in both UI and headless API (`AiChat.generate()`), so non-UI consumers cannot bypass guardrails.
- **Tool calling (LiteRT Gemma only):** `registerTools(defs)` + `generateWithTools(text, { execute, maxRounds })` run an allowlisted tool loop. Prefers native LiteRT `Preface.tools` when the runtime accepts it; otherwise uses a constrained XML `<tool_call>` protocol with the same host `execute` callback. WebLLM / experimental models throw `TOOLS_UNSUPPORTED_ERROR`.
- Injectable product context via `systemPromptOptions` / `setSystemPromptOptions({ product, extra })` composed through `buildChatSystemPrompt`.
- Labs UI is `VdlAiChatUI` (Vue + `@vanduo-oss/vd3`); headless `AiChat` stays a vanilla ES module.
- Composer: **Enter** sends, **Shift+Enter** inserts a newline. The message list sticks to the latest reply while you are near the bottom.

For direct shared guardrails API usage (core contracts, LLM helpers, and search-policy split), see [doc/vdl-guardrails.md](./vdl-guardrails.md).

### CDN / dependency pinning

Headless Labs modules load heavy browser deps via **ESM CDN imports** (jsDelivr / esm.run), for example WebLLM, LiteRT-LM, and (in Neptune) Fuse.js + Transformers.js. `@vanduo-oss/vd3` for the Labs Vue shell stays an **npm package** dependency (already versioned via the lockfile).

**Recommended approach (policy):**

- Prefer **version-pinned** CDN URLs (exact package versions) over floating `latest` / unpinned `+esm` / bare `esm.run/@pkg` entries where the CDN supports it.
- For static `<script>` tags, optionally add **SRI** later; for dynamic `import()`, pin the URL and upgrade deliberately on a periodic cadence.
- Do not treat major-only pins (e.g. `@7`, `@3`) as fully locked — tighten to exact versions when practical.
- Keep model weight URLs on known HF / LiteRT community paths; local `.models/` mirrors are for dev only and are not shipped in `dist/`.

This is documentation of the preferred hardening path; a full pin/SRI pass across every import is optional follow-up work.

### Browser Caching & Loading Behavior

The `vdl-ai-chat` component requires the user to explicitly click "Load AI Model" to initiate the WebGPU engine. This is an intentional design choice to prevent hijacking the user's GPU and network bandwidth immediately upon page load.

**What happens when the page is refreshed?**
- **VRAM Initialization:** A page refresh destroys the active WebAssembly memory and WebGPU context. The user must click **Load** again; GPU upload / shader compile still takes a few seconds.
- **LiteRT Gemma weights (default E2B/E4B path):** After the first successful download, Labs stores the `.litertlm` bytes in the origin **Cache Storage** bucket `vdl-litert-models` and sets a `vdl-ai-chat-model-cached:<modelId>` localStorage flag. Later loads prefer that bucket and report progress source `cache` (UI: “From cache”) instead of re-fetching Hugging Face. Profile / clear-storage deletes that bucket.
- **WebLLM / MLC models:** Continue to rely on WebLLM’s own Cache API behavior for multi-file MLC packages.
- **Dev `/models/` mirror:** When `pnpm models:fetch` has populated `.models/`, LiteRT prefers same-origin `/models/<id>/…` and reports source `local`.

Do **not** assume the opaque HTTP disk cache alone is enough for Hugging Face LFS URLs — the explicit Cache Storage layer is the durable path for LiteRT.

### Acknowledgments, Technologies & Attribution

Building a fully private, in-browser AI chat with robust guardrails is only possible thanks to the incredible ecosystem of open-source tools and frameworks. We extend our deepest gratitude to the creators and maintainers of the following technologies:

#### Core AI & Inference
- **[WebLLM (@mlc-ai/web-llm)](https://webllm.mlc.ai/)**: The core inference engine powering this component. WebLLM brings large language model chat directly to web browsers using WebGPU acceleration and WebAssembly, enabling completely private, local execution.
- **[Gemma 4 (Google DeepMind)](https://ai.google.dev/gemma)**: Primary LiteRT web models (E2B / E4B) plus experimental MLC peers.
- **[Qwen3](https://qwenlm.github.io/)**, **[Phi-4 (Microsoft)](https://huggingface.co/microsoft)**, **[Ministral (Mistral)](https://mistral.ai/)**: Multi-architecture LiteRT / WebLLM peers for Labs experimentation.
- **[WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)**: The modern web standard that allows web applications to access the device's underlying graphics processing unit (GPU) for highly parallelized computation.

#### Security & Guardrails
The deterministic prompt injection scanner in `vdl-ai-chat` relies on open-source regex patterns compiled, tested, and refined by the cybersecurity community. These patterns form our crucial first line of defense against jailbreaks and prompt leaks. We credit the authors of the following FOSS projects for their foundational research:
- **[LlmGuard (North-Shore-AI)](https://github.com/North-Shore-AI/LlmGuard)**: Comprehensive security protection for LLM applications including prompt injection detection.
- **[ai-guardian (itdove)](https://github.com/itdove/ai-guardian)**: A robust security layer for detecting manipulation attempts before they reach AI models.
- **[llm-prompt-guard (npm package)](https://www.npmjs.com/package/llm-prompt-guard)**: A sub-millisecond prompt injection firewall designed for TypeScript and JavaScript ecosystems.

#### UI & Design
- **[@vanduo-oss/vd3](https://github.com/vanduo-oss/vd3)**: Vanduo UI for Vue 3 used by the Labs site shell (tokens, components, theme).
- **[Phosphor Icons](https://phosphoricons.com/)**: The clean, consistent iconography used throughout the chat interface.
