# vd-ai-chat

In-browser **AI Chat** powered by WebLLM + WebGPU with Gemma-first defaults.

Fully private, running entirely locally in your browser. FOSS guardrails enforced via strict system prompt.

- Component version: **`{{COMPONENT_VERSION}}`**
- Live labs site: **https://labs.vanduo.dev**

### Quick Start

```javascript
import { AiChat, AiChatUI } from './ai-chat.js';

const chat = new AiChat();
const ui = new AiChatUI({
  container: document.getElementById('chat-mount'),
  chat
});

ui.mount();
```

### Features

- Default model is the smaller **Gemma 2B** (`gemma-2b-it-q4f16_1-MLC`) for fast startup.
- Includes a curated 4-tier model picker:
  - **Fast:** Gemma 2B
  - **Balanced:** Qwen2.5 1.5B
  - **Quality:** Llama 3.2 3B
  - **Coder:** Qwen2.5 Coder 1.5B
- Displays **System Info** at runtime (WebGPU support, adapter name, `shader-f16` support).
- Shows compatibility badges per tier (`native`, `fallback`, `unavailable`) to set user expectations.
- Automatically applies model fallbacks (typically `q4f32_1`) when required features are unavailable.
- Downloads and caches the selected model directly in the browser.
- Runs inference via WebGPU for high performance without a backend server.
- Uses FOSS guardrails to enforce harmlessness and objectivity.
- Includes a deterministic regex scanner to fast-reject known prompt injections and jailbreaks before they reach the model.
- Built entirely with Vanduo framework UI components.

### Browser Caching & Loading Behavior

The `vd-ai-chat` component requires the user to explicitly click "Load AI Model" to initiate the WebGPU engine. This is an intentional design choice to prevent hijacking the user's GPU and network bandwidth immediately upon page load. 

**What happens when the page is refreshed?**
- **The Download is Cached:** WebLLM automatically utilizes the browser's native Cache API. After the initial ~1.5GB network download, the model weights are stored securely on the user's hard drive.
- **VRAM Initialization:** Even though the files are cached locally, a page refresh destroys the active WebAssembly memory and WebGPU context. When the user clicks "Load AI Model" *after* a refresh, the component skips the network download and rapidly reads the weights from the local cache directly into the GPU's VRAM. This process takes only a few seconds depending on the user's hardware.

### Acknowledgments, Technologies & Attribution

Building a fully private, in-browser AI chat with robust guardrails is only possible thanks to the incredible ecosystem of open-source tools and frameworks. We extend our deepest gratitude to the creators and maintainers of the following technologies:

#### Core AI & Inference
- **[WebLLM (@mlc-ai/web-llm)](https://webllm.mlc.ai/)**: The core inference engine powering this component. WebLLM brings large language model chat directly to web browsers using WebGPU acceleration and WebAssembly, enabling completely private, local execution.
- **[Gemma (Google DeepMind)](https://ai.google.dev/gemma)**, **[Llama (Meta)](https://www.llama.com/)**, and **[Qwen (Alibaba Cloud)](https://qwenlm.github.io/)**: `vd-ai-chat` uses MLC-compiled quantized variants from these model families to provide fast, balanced, quality, and code-focused options in-browser.
- **[WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)**: The modern web standard that allows web applications to access the device's underlying graphics processing unit (GPU) for highly parallelized computation.

#### Security & Guardrails
The deterministic prompt injection scanner in `vd-ai-chat` relies on open-source regex patterns compiled, tested, and refined by the cybersecurity community. These patterns form our crucial first line of defense against jailbreaks and prompt leaks. We credit the authors of the following FOSS projects for their foundational research:
- **[LlmGuard (North-Shore-AI)](https://github.com/North-Shore-AI/LlmGuard)**: Comprehensive security protection for LLM applications including prompt injection detection.
- **[ai-guardian (itdove)](https://github.com/itdove/ai-guardian)**: A robust security layer for detecting manipulation attempts before they reach AI models.
- **[llm-prompt-guard (npm package)](https://www.npmjs.com/package/llm-prompt-guard)**: A sub-millisecond prompt injection firewall designed for TypeScript and JavaScript ecosystems.

#### UI & Design
- **[Vanduo Framework](https://github.com/vanduo-oss/framework)**: The CSS framework powering the responsive, glassmorphic UI components.
- **[Phosphor Icons](https://phosphoricons.com/)**: The clean, consistent iconography used throughout the chat interface.
