# vd-ai-chat

In-browser **AI Chat** powered by WebLLM + WebGPU with **Gemma 4** as the primary model family.

Fully private, running entirely locally in your browser. FOSS guardrails enforced via strict system prompt.

- Component version: {{COMPONENT_VERSION}}
- Live labs site: **https://labs.vanduo.dev**

### Quick Start

**Headless engine (vanilla ESM):**

```javascript
import { AiChat } from './ai-chat.js';

const chat = new AiChat();
await chat.load();
const reply = await chat.generate('Hello');
```

**Labs Vue + vd3 UI:**

```vue
<script setup>
import VdAiChatUI from './src/components/VdAiChatUI.vue';
</script>

<template>
  <VdAiChatUI />
</template>
```

Legacy imperative `AiChatUI` remains exported from `ai-chat.js` for compatibility; the Labs site uses `VdAiChatUI`.

### Local model mirror (dev)

For faster local loads of the default **Gemma 4 E2B** package (~2.7GB), prefetch once into a gitignored folder and let Vite serve it (not included in `pnpm build` / GitHub Pages):

```bash
pnpm models:fetch          # downloads into .models/gemma-4-E2B-it-q4f16_1-MLC/
pnpm models:fetch -- --dry-run
pnpm dev                   # serves mirror at /models/<id>/
```

`AiChat.load()` probes `/models/<id>/mlc-chat-config.json` and prefers that mirror when present; otherwise it uses the Hugging Face URLs.

### Features

- Default model is **Gemma 4 E2B** (`gemma-4-E2B-it-q4f16_1-MLC`) for the Gemma 4 family.
- Model picker is grouped:
  - **Gemma 4 (primary):** E2B (Fast / default), E4B (Quality)
  - **Optional:** SmolLM2 360M (Tiny), Qwen2.5 1.5B (Balanced), Llama 3.2 3B (Alt Quality), Qwen2.5 Coder 1.5B (Coder)
- Displays **System Info** at runtime (WebGPU support, adapter name, `shader-f16` support).
- Shows compatibility badges per tier (`native`, `fallback`, `unavailable`, `experimental`) to set user expectations.
- Automatically applies model fallbacks (typically `q4f32_1`) for optional built-in WebLLM models when required features are unavailable. Gemma 4 variants require `shader-f16`.
- Downloads and caches the selected model directly in the browser.
- Runs inference via WebGPU for high performance without a backend server.
- Uses shared FOSS guardrails (`guardrails/llm.js`) to enforce harmlessness and objectivity.
- Includes a deterministic regex scanner to fast-reject known prompt injections and jailbreaks before they reach the model.
- Enforces deterministic input validation in both UI and headless API (`AiChat.generate()`), so non-UI consumers cannot bypass guardrails.
- Labs UI is `VdAiChatUI` (Vue + `@vanduo-oss/vd3`); headless `AiChat` stays a vanilla ES module.

For direct shared guardrails API usage (core contracts, LLM helpers, and search-policy split), see [doc/vd-guardrails.md](./vd-guardrails.md).

### Browser Caching & Loading Behavior

The `vd-ai-chat` component requires the user to explicitly click "Load AI Model" to initiate the WebGPU engine. This is an intentional design choice to prevent hijacking the user's GPU and network bandwidth immediately upon page load. 

**What happens when the page is refreshed?**
- **The Download is Cached:** WebLLM automatically utilizes the browser's native Cache API. After the initial multi‑GB network download (model-dependent), the model weights are stored securely on the user's hard drive.
- **VRAM Initialization:** Even though the files are cached locally, a page refresh destroys the active WebAssembly memory and WebGPU context. When the user clicks "Load AI Model" *after* a refresh, the component skips the network download and rapidly reads the weights from the local cache directly into the GPU's VRAM. This process takes only a few seconds depending on the user's hardware.

### Acknowledgments, Technologies & Attribution

Building a fully private, in-browser AI chat with robust guardrails is only possible thanks to the incredible ecosystem of open-source tools and frameworks. We extend our deepest gratitude to the creators and maintainers of the following technologies:

#### Core AI & Inference
- **[WebLLM (@mlc-ai/web-llm)](https://webllm.mlc.ai/)**: The core inference engine powering this component. WebLLM brings large language model chat directly to web browsers using WebGPU acceleration and WebAssembly, enabling completely private, local execution.
- **[Gemma 4 (Google DeepMind)](https://ai.google.dev/gemma)**: Primary local models (E2B / E4B) via community MLC/WebLLM packages.
- **[SmolLM2](https://huggingface.co/HuggingFaceTB)**, **[Llama (Meta)](https://www.llama.com/)**, and **[Qwen (Alibaba Cloud)](https://qwenlm.github.io/)**: Optional small/fast MLC-compiled variants for lighter or specialized local runs.
- **[WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)**: The modern web standard that allows web applications to access the device's underlying graphics processing unit (GPU) for highly parallelized computation.

#### Security & Guardrails
The deterministic prompt injection scanner in `vd-ai-chat` relies on open-source regex patterns compiled, tested, and refined by the cybersecurity community. These patterns form our crucial first line of defense against jailbreaks and prompt leaks. We credit the authors of the following FOSS projects for their foundational research:
- **[LlmGuard (North-Shore-AI)](https://github.com/North-Shore-AI/LlmGuard)**: Comprehensive security protection for LLM applications including prompt injection detection.
- **[ai-guardian (itdove)](https://github.com/itdove/ai-guardian)**: A robust security layer for detecting manipulation attempts before they reach AI models.
- **[llm-prompt-guard (npm package)](https://www.npmjs.com/package/llm-prompt-guard)**: A sub-millisecond prompt injection firewall designed for TypeScript and JavaScript ecosystems.

#### UI & Design
- **[@vanduo-oss/vd3](https://github.com/vanduo-oss/vd3)**: Vanduo UI for Vue 3 used by the Labs site shell (tokens, components, theme).
- **[Phosphor Icons](https://phosphoricons.com/)**: The clean, consistent iconography used throughout the chat interface.
