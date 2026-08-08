# Vanduo Labs

Experimental components for the Vanduo ecosystem. Shipped as **ES modules** with zero runtime npm dependencies.

Live demos are hosted on GitHub Pages at **https://labs.vanduo.dev**.

## Experimental Component Versions

Current component versions:

| Component | Version | Module |
|------|------|------|
| `vd-neptune-search` | `0.0.3` | [`neptune-search.js`](./neptune-search.js) |
| `vd-ai-chat` | `0.0.5` | [`ai-chat.js`](./ai-chat.js) |

### Shared Guardrails Modules

`guardrails/*` is a public shared-service module family used across the Labs AI and search components. It provides deterministic validation and safety helpers for two different policy domains:

- Shared service version: `0.0.1` (exported as `VD_GUARDRAILS_VERSION`)

- `./guardrails/llm.js`: LLM-facing input validation + system-prompt composition for `vd-ai-chat`.
- `./guardrails/search.js`: deterministic query/index/vector and render-path hardening for `vd-neptune-search`.
- `./guardrails/core.js`: shared result/error helpers used by both policy families.

See canonical documentation: [doc/vd-guardrails.md](./doc/vd-guardrails.md)

```javascript
import { validateLlmInput, buildChatSystemPrompt } from './guardrails/llm.js';
import { validateSearchIndexPayload, safeDocHref } from './guardrails/search.js';

const inputCheck = validateLlmInput('Give me a concise answer about WebGPU.');
if (!inputCheck.allowed) throw new Error(inputCheck.message);

const systemPrompt = buildChatSystemPrompt({ extraRules: 'Keep outputs under 5 bullets.' });

const indexCheck = validateSearchIndexPayload({ documents: [] });
const href = safeDocHref('https://vanduo.dev', 'docs/buttons');
```

---

## vd-hex (VdHexGrid) — Graduated

The hex-grid component has graduated from Labs into its own standalone package.

- npm: [`@vanduo-oss/hex-grid`](https://www.npmjs.com/package/@vanduo-oss/hex-grid)
- Repo: [`github.com/vanduo-oss/hex-grid`](https://github.com/vanduo-oss/hex-grid)

```bash
pnpm add @vanduo-oss/hex-grid
```

```javascript
import { VdHexGrid } from '@vanduo-oss/hex-grid';
```

---

## vd-neptune-search (Neptune Hybrid Search)

In-browser **hybrid search** over **[vd3 docs](https://vanduo-oss.github.io/vd3-docs/)** — instant fuzzy search via Fuse.js + semantic vector search via Transformers.js. Zero external LLM API calls.

Labs UI: Vue + vd3 component `VdNeptuneSearchUI` (headless `NeptuneSearch` remains a vanilla ES module).

See full documentation: [doc/vd-neptune-search.md](./doc/vd-neptune-search.md)

### Search Quality (Tuned)

- Corpus: vd3-docs nav catalog + prerendered page HTML (path routes such as `/components/button`)
- Runtime defaults: `fuseThreshold=0.45`, `semanticThreshold=0.30`, `keywords` weight `2.5`
- Hybrid merge: score-sorted interleave across semantic + fuzzy results (deduped by doc ID)
- Embeddings are generated from: `title + category + keywords + headings + bodyText` (512-char cap)
- Rebuild index: `pnpm index` (optional `VD3_DOCS_PATH=../vd3-docs`)
- Repro benchmark tools: `utils/neptune-benchmark.mjs` + `utils/benchmark-queries.json`

### Quick Start

```javascript
import { NeptuneSearch, NeptuneSearchUI } from './neptune-search.js';

const search = new NeptuneSearch();
const ui = new NeptuneSearchUI({
  container: document.getElementById('search-mount'),
  search,
  onResultClick: (result) => {
    window.location.hash = result.doc.route;
  },
});

ui.mount();
```

### Regenerating the index

```bash
pnpm index   # runs node utils/neptune-indexer.mjs
```

### Demo

The Labs site is a Vite + Vue 3 app on [`@vanduo-oss/vd3`](https://www.npmjs.com/package/@vanduo-oss/vd3). From the repo root:

```bash
pnpm install
pnpm dev
```

Then open:

- `http://localhost:3000/` for the **Vanduo Labs** site (navbar + hero + demos)
- `http://localhost:3000/demo/neptune-demo.html` for the focused Neptune demo page
- `http://localhost:3000/demo/ai-chat-demo.html` for the focused AI Chat demo page

Production build / preview:

```bash
pnpm build
pnpm preview
```

---

## vd-ai-chat (AiChat)

In-browser **AI chat** component with local WebGPU inference and deterministic guardrails.

See full documentation: [doc/vd-ai-chat.md](./doc/vd-ai-chat.md)

### Quick Start

```javascript
import { AiChat } from './ai-chat.js';

const chat = new AiChat();
await chat.load();
await chat.generate('Hello');
```

Labs UI: Vue + vd3 component `VdAiChatUI` (headless `AiChat` remains a vanilla ES module).

### Notes

- Defaults to **Gemma 4 E2B**, with Gemma 4 E4B as the quality tier; optional small/fast models (SmolLM2, Qwen2.5, Llama 3.2, Qwen Coder) remain available.
- Detects runtime hardware capabilities (WebGPU + `shader-f16`) and shows system compatibility info in setup UI.
- Automatically applies compatible fallback variants on lower-capability devices when needed (optional built-ins).
- Model download is user-triggered and cached by the browser.
- Includes deterministic regex guardrails that block known prompt-injection patterns before generation.

---

## Keeping in sync

Labs modules are synced from their canonical source locations:

```bash
# vd-neptune-search: module + generated corpus (regenerate with pnpm index when docs change)
cp docs/js/neptune-search.js labs/neptune-search.js
cp docs/js/data/search-index.json labs/data/search-index.json
cp docs/js/data/vectors.json labs/data/vectors.json
```

## Pre-release Checklist

- Confirm component versions are aligned with exported module constants.
- Verify demo page badges and docs reflect current versions.
- Run test suite (`pnpm test`) and smoke-check `https://labs.vanduo.dev`.
- Ensure package export/file lists stay synchronized before publishing.

## License

MIT — see [LICENSE](./LICENSE).
