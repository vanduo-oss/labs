# Vanduo Labs

Experimental components for the Vanduo ecosystem. Shipped as **ES modules** with zero runtime npm dependencies.

Live demos are hosted on GitHub Pages at **https://labs.vanduo.dev**.

## Experimental Component Versions

Current component versions:

| Component | Version | Module |
|------|------|------|
| `vd-hex` | `0.0.1` | [`hex-grid.js`](./hex-grid.js) |
| `vd-neptune-search` | `0.0.1` | [`neptune-search.js`](./neptune-search.js) |
| `vd-ai-chat` | `0.0.2` | [`ai-chat.js`](./ai-chat.js) |

---

## vd-hex (VdHexGrid)

Interactive **hex-grid** toolkit for the browser: canvas rendering, pan/zoom, hex selection, terrain helpers, and optional grid rotation.

See full documentation: [doc/vd-hex.md](./doc/vd-hex.md)

### Files

| File | Role |
|------|------|
| [`hex-grid.js`](./hex-grid.js) | `VdHexGrid` class — canvas grid, events, pan/zoom, terrain API |
| [`utils/hex-math.js`](./utils/hex-math.js) | Axial coordinates, pixel mapping, corners, neighbors, terrain metadata |

### Usage

```javascript
import { VdHexGrid } from './hex-grid.js';

const grid = new VdHexGrid({
  element: document.getElementById('container'),
  canvas: document.getElementById('canvas'),
  size: 30,
  width: 15,
  height: 10,
  rotation: 0
});

grid.on('select', (hex) => {
  console.log(hex.q, hex.r);
});
```

---

## vd-neptune-search (Neptune Hybrid Search)

In-browser **hybrid search** over Vanduo Docs — instant fuzzy search via Fuse.js + semantic vector search via Transformers.js. Zero external LLM API calls.

See full documentation: [doc/vd-neptune-search.md](./doc/vd-neptune-search.md)

### Search Quality (Tuned)

- Benchmark quality (Apr 2026): **MRR 0.9938**, **Top-1 98.8% (80/81)**, **Top-3 100%**, **Top-5 100%**
- Runtime defaults: `fuseThreshold=0.45`, `semanticThreshold=0.30`, `keywords` weight `2.5`
- Hybrid merge: score-sorted interleave across semantic + fuzzy results (deduped by doc ID)
- Embeddings are generated from: `title + category + keywords + headings + bodyText` (512-char cap)
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

From this `labs/` directory (repository root for the static server), run:

```bash
pnpm run demo:serve
```

Then open:

- `http://localhost:3000/` for the standalone **Vanduo Labs** page (navbar + hero + `vd-hex` + `vd-neptune-search`)
- `http://localhost:3000/demo/neptune-demo` (or `/demo/neptune-demo.html`) for the focused Neptune demo page

Serving only `demo/` breaks module and data URLs (`../neptune-search.js` and `../data/*` must resolve under the same origin).

---

## vd-ai-chat (AiChat)

In-browser **AI chat** component with local WebGPU inference and deterministic guardrails.

See full documentation: [doc/vd-ai-chat.md](./doc/vd-ai-chat.md)

### Quick Start

```javascript
import { AiChat, AiChatUI } from './ai-chat.js';

const chat = new AiChat();
const ui = new AiChatUI({
  container: document.getElementById('chat-mount'),
  chat,
});

ui.mount();
```

### Notes

- Defaults to smaller Gemma 2B for fast startup, with additional Balanced/Quality/Coder model tiers.
- Detects runtime hardware capabilities (WebGPU + `shader-f16`) and shows system compatibility info in setup UI.
- Automatically applies compatible fallback variants on lower-capability devices when needed.
- Model download is user-triggered and cached by the browser.
- Includes deterministic regex guardrails that block known prompt-injection patterns before generation.

---

## Keeping in sync

The canonical copies live under the Vanduo **framework** repository (`framework/js/`). When you change a Labs component, edit the framework file first, then copy so both stay aligned:

```bash
# Example: from the monorepo root, after editing framework/js
cp framework/js/components/vd-hex.js labs/hex-grid.js
cp framework/js/utils/hex-math.js labs/utils/hex-math.js

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
