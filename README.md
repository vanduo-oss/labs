# Vanduo Labs

Demo playground for the Vanduo ecosystem. Labs dogfoods **sibling vanduo-oss Labs repos** (`vdl-*`) via `link:../vdl-*` — it is **not** an engine source of truth and does **not** publish a `vdl-*` npm family.

Live demos: **https://labs.vanduo.dev**

## Sibling Labs repos (`vdl-*`)

Clone these beside Labs (same parent directory) so `link:../vdl-*` resolves:

| Repo | Role |
|------|------|
| [`vanduo-oss/vdl-cbun`](https://github.com/vanduo-oss/vdl-cbun) | Widgets: code-editor, draw, hex-grid, music-player (`#widgets/*`); Vite aliases into sibling `dist/` |
| [`vanduo-oss/vdl-hybrid-search`](https://github.com/vanduo-oss/vdl-hybrid-search) | Headless `HybridSearch` + search guardrails |
| [`vanduo-oss/vdl-ai-chat`](https://github.com/vanduo-oss/vdl-ai-chat) | Headless `AiChat` + LLM/tools guardrails + markdown |
| Labs-local `model-eval.js` | Model evaluation harness (CLI / standalone; not listed on the live site) |

```javascript
import { HybridSearch } from '@vanduo-oss/vdl-hybrid-search';
import { AiChat } from '@vanduo-oss/vdl-ai-chat';
import { validateToolCall } from '@vanduo-oss/vdl-ai-chat/guardrails/tools';
import Fuse from 'fuse.js';

const search = new HybridSearch({
  indexUrl: '/data/search-index.json',
  vectorsUrl: '/data/vectors.json',
  loadFuse: async () => ({ default: Fuse }),
  loadTransformers: async () => import('@huggingface/transformers'),
});

const chat = new AiChat({
  loadLiteRT: async () => import('@litert-lm/core'),
});
```

Guardrails docs: [doc/vdl-guardrails.md](./doc/vdl-guardrails.md)

---

## vd-hex (VdHexGrid) — Graduated

Hex-grid now lives in Labs [`vdl-cbun`](https://github.com/vanduo-oss/vdl-cbun) (`#widgets/hex-grid`). It is **not** published under `@vanduo-oss/hex-grid` on npm (that package is unpublished).

---

## vdl-hybrid-search (demo)

In-browser hybrid search over **[vd3 docs](https://vanduo-oss.github.io/vd3-docs/)** — fuzzy (Fuse.js) + semantic (Transformers.js). Labs UI: `VdlHybridSearchUI`.

See [doc/vdl-hybrid-search.md](./doc/vdl-hybrid-search.md).

```bash
pnpm index   # utils/hybrid-search-indexer.mjs → data/search-index.json + data/vectors.json
```

---

## vdl-ai-chat (demo)

In-browser AI chat (LiteRT Gemma default, WebLLM fallbacks) with FOSS guardrails. Labs UI: `VdlAiChatUI`.

See [doc/vdl-ai-chat.md](./doc/vdl-ai-chat.md).

```bash
pnpm models:fetch   # optional local .models/ mirror for faster dev
pnpm model-eval     # local CLI eval harness — see doc/vdl-model-eval.md
```

---

## vdl-ai-draw (in-repo / local)

Alpha — **not listed** on the live Labs site. AI-assisted SVG canvas: host-executed DrawPlans from Gemma 4 (E2B default) with a regex recipe fast-path, read-only question turns, and an optional flagged WebLLM Qwen3-0.6B fast planner. Standalone: `demo/ai-draw-demo.html`. Labs UI: `VdlAiDrawUI`.

See [doc/vdl-ai-draw.md](./doc/vdl-ai-draw.md).

```bash
pnpm model-eval:draw   # darwin/arm64: plan-validity + latency baseline per model
```

---

## vdl-model-eval (in-repo / local)

Alpha — **not listed** on the live Labs site (Tools nav removed). Local CLI + harness for scoring published models; report UI stays available via `demo/model-eval-harness.html` and `VdlModelEvalUI` for local use.

See [doc/vdl-model-eval.md](./doc/vdl-model-eval.md).

---

## Develop

Expect sibling checkouts:

```text
0_vanduo/
  labs/
  vdl-ai-chat/
  vdl-hybrid-search/
  vdl-cbun/
```

```bash
pnpm install
pnpm dev
```

- `http://localhost:3000/` — Labs site
- `http://localhost:3000/demo/hybrid-search-demo.html`
- `http://localhost:3000/demo/ai-chat-demo.html`
- `http://localhost:3000/demo/ai-draw-demo.html` — local only (not on live demos)
- `http://localhost:3000/demo/model-eval-harness.html` — local only

```bash
pnpm format:check && pnpm lint && pnpm test:unit && pnpm build
pnpm test:local    # optional: Gemma drawing requests on macOS arm64 / RUN_AI_DRAW_INFERENCE=1
```

Theme controls use `app.use(VanduoVue, { storagePrefix: 'vdl-' })` so preferences do not collide with vd3-docs on shared Pages origins. First visit shows a mandatory terms gate (AI Act transparency + experimental demos); decline opens a farewell screen.

## Support / Contributing

Maintained by vanduo-oss; external contributions are not accepted at this time. Security: [SECURITY.md](./SECURITY.md).

## Credits

Home page liquid atmosphere is inspired by Cameron Knight’s
[Interactive Liquid Gradient using Three.js](https://codepen.io/cameronknight/pen/ogxWmBP)
(CodePen). Labs ships a vanilla WebGL reimplementation bound to vd3 tokens.

## License

MIT — see [LICENSE](./LICENSE).
