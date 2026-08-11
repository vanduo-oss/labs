# Vanduo Labs

Demo playground for the Vanduo ecosystem. Labs **consumes** published VDL engines from npm — it is **not** an engine source of truth and does **not** publish `@vanduo-oss/vdl-engines`.

Live demos: **https://labs.vanduo.dev**

## Engines (npm)

| Package | Role |
|------|------|
| [`@vanduo-oss/vdl-hybrid-search`](https://www.npmjs.com/package/@vanduo-oss/vdl-hybrid-search) | Headless `HybridSearch` + search guardrails |
| [`@vanduo-oss/vdl-ai-chat`](https://www.npmjs.com/package/@vanduo-oss/vdl-ai-chat) | Headless `AiChat` + LLM/tools guardrails + markdown |
| Labs-local `model-eval.js` | Model evaluation harness used by the Tools demo |

```bash
pnpm add @vanduo-oss/vdl-hybrid-search @vanduo-oss/vdl-ai-chat
```

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

- npm: [`@vanduo-oss/hex-grid`](https://www.npmjs.com/package/@vanduo-oss/hex-grid)
- Repo: [`github.com/vanduo-oss/hex-grid`](https://github.com/vanduo-oss/hex-grid)

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
pnpm model-eval     # Tools page #tools/model-eval — see doc/vdl-model-eval.md
```

---

## Develop

```bash
pnpm install
pnpm dev
```

- `http://localhost:3000/` — Labs site
- `http://localhost:3000/demo/hybrid-search-demo.html`
- `http://localhost:3000/demo/ai-chat-demo.html`

```bash
pnpm format:check && pnpm lint && pnpm test:unit && pnpm build
```

Theme controls use a `vdl-` localStorage prefix so preferences do not collide with vd3-docs on shared Pages origins.

## Support / Contributing

Maintained by vanduo-oss; external contributions are not accepted at this time. Security: [SECURITY.md](./SECURITY.md).

## Credits

Home page liquid atmosphere is inspired by Cameron Knight’s
[Interactive Liquid Gradient using Three.js](https://codepen.io/cameronknight/pen/ogxWmBP)
(CodePen). Labs ships a vanilla WebGL reimplementation bound to vd3 tokens.

## License

MIT — see [LICENSE](./LICENSE).
