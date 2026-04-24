# vd-ai-draw

In-browser **AI Collaborative Pixel Canvas** powered by WebLLM + WebGPU.

The AI can "see" a black-and-white pixel canvas (serialized as compact text) and draw on it by emitting `DRAW`/`ERASE` commands or full `[CANVAS]` blocks. Fully private, running entirely locally in your browser.

- Component version: {{COMPONENT_VERSION}}
- Live labs site: **https://labs.vanduo.dev**

### Quick Start

```javascript
import { AiDraw, AiDrawUI } from './ai-draw.js';

const draw = new AiDraw();
const ui = new AiDrawUI({
  container: document.getElementById('draw-mount'),
  draw
});

ui.mount();
```

### Features

- **1-bit pixel canvas** — black & white only, so the grid stays compact in the prompt.
- **Configurable sizes** — 32×32, 64×64 (default), or 128×128. A 64×64 grid is ~4 KB of text, safe for ~8K context windows.
- **AI can "see"** — every message automatically includes the current canvas state in `[CANVAS]…[/CANVAS]` format.
- **AI can draw** — the model outputs `DRAW x y` / `ERASE x y` commands or a full `[CANVAS]` block; the UI parses and applies them in real time.
- **Drawing tools** — pencil (1px), brush (3px), eraser, plus grid overlay toggle and clear.
- **Explicit interaction** — user draws freely, then sends a chat message to ask the AI to look, comment, or improve.
- **Same model picker** as `vd-ai-chat` — Gemma 2B (Fast), Qwen2.5 1.5B (Balanced), Llama 3.2 3B (Quality), Qwen2.5 Coder 1.5B (Coder).
- **Hardware detection** — shows WebGPU support, adapter name, and `shader-f16` compatibility before loading.
- **Shared deterministic guardrails** — regex scanner from `guardrails/llm.js` blocks known prompt-injection patterns before they reach the model.
- **Headless-safe validation** — deterministic checks run in both UI and `AiDraw.generate()`, so non-UI consumers get the same guardrails.
- **Draw-specific prompt composition** — `buildDrawSystemPrompt()` from `guardrails/llm.js` combines shared FOSS safety policy with draw/canvas instruction policy for structured output control.

For direct shared guardrails API usage (core contracts, LLM helpers, and search-policy split), see [doc/vd-guardrails.md](./vd-guardrails.md).

### Canvas Format

The canvas is serialized as plain text using `.` for empty pixels and `#` for filled pixels:

```
[CANVAS]
................
.....####.......
....#....#......
....#....#......
.....####.......
................
[/CANVAS]
```

Coordinates are 0-indexed: `x` goes left-to-right (0 to width−1), `y` goes top-to-bottom (0 to height−1).

### How the AI Draws

1. **Individual commands** (good for small edits):
   ```
   DRAW 10 12
   ERASE 15 20
   ```

2. **Full canvas block** (good for large changes):
   ```
   [CANVAS]
   (complete grid)
   [/CANVAS]
   ```

Both are parsed automatically after the model finishes streaming.

### Browser Caching & Loading Behavior

The `vd-ai-draw` component requires the user to explicitly click "Load AI Model" to initiate the WebGPU engine. This is an intentional design choice to prevent hijacking the user's GPU and network bandwidth immediately upon page load.

**What happens when the page is refreshed?**
- **The Download is Cached:** WebLLM automatically utilizes the browser's native Cache API. After the initial ~1.5GB network download, the model weights are stored securely on the user's hard drive.
- **VRAM Initialization:** Even though the files are cached locally, a page refresh destroys the active WebAssembly memory and WebGPU context. When the user clicks "Load AI Model" *after* a refresh, the component skips the network download and rapidly reads the weights from the local cache directly into the GPU's VRAM. This process takes only a few seconds depending on the user's hardware.

### Acknowledgments, Technologies & Attribution

Building a fully private, in-browser AI collaborator with robust guardrails is only possible thanks to the incredible ecosystem of open-source tools and frameworks. We extend our deepest gratitude to the creators and maintainers of the following technologies:

#### Core AI & Inference
- **[WebLLM (@mlc-ai/web-llm)](https://webllm.mlc.ai/)**: The core inference engine powering this component. WebLLM brings large language model chat directly to web browsers using WebGPU acceleration and WebAssembly, enabling completely private, local execution.
- **[Gemma (Google DeepMind)](https://ai.google.dev/gemma)**, **[Llama (Meta)](https://www.llama.com/)**, and **[Qwen (Alibaba Cloud)](https://qwenlm.github.io/)**: `vd-ai-draw` uses MLC-compiled quantized variants from these model families to provide fast, balanced, quality, and code-focused options in-browser.
- **[WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)**: The modern web standard that allows web applications to access the device's underlying graphics processing unit (GPU) for highly parallelized computation.

#### Security & Guardrails
The deterministic prompt injection scanner in `vd-ai-draw` relies on open-source regex patterns compiled, tested, and refined by the cybersecurity community. These patterns form our crucial first line of defense against jailbreaks and prompt leaks. We credit the authors of the following FOSS projects for their foundational research:
- **[LlmGuard (North-Shore-AI)](https://github.com/North-Shore-AI/LlmGuard)**: Comprehensive security protection for LLM applications including prompt injection detection.
- **[ai-guardian (itdove)](https://github.com/itdove/ai-guardian)**: A robust security layer for detecting manipulation attempts before they reach AI models.
- **[llm-prompt-guard (npm package)](https://www.npmjs.com/package/llm-prompt-guard)**: A sub-millisecond prompt injection firewall designed for TypeScript and JavaScript ecosystems.

#### UI & Design
- **[Vanduo Framework](https://github.com/vanduo-oss/framework)**: The CSS framework powering the responsive, glassmorphic UI components.
- **[Phosphor Icons](https://phosphoricons.com/)**: The clean, consistent iconography used throughout the interface.
