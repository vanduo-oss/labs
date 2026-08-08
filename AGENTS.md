# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Vanduo Labs is a static **Vite + Vue 3** demo site that showcases experimental browser components shipped as zero-dependency ES modules:

- `vd-neptune-search` (`neptune-search.js`) — in-browser hybrid fuzzy (Fuse.js) + semantic (Transformers.js) search over a bundled docs corpus in `data/`.
- `vd-ai-chat` (`ai-chat.js`) — in-browser LLM chat that runs models locally via **WebGPU** (defaults to Gemma 4 E2B).
- `guardrails/*` — shared validation/safety helpers used by both components.

There is a single dev service (the Vite dev server); there is no backend, database, or external API.

### Running (see `package.json` scripts / `README.md` for the canonical list)

- `pnpm dev` — Vite dev server on `http://localhost:3000`. Key routes: `/` (Labs site), `/demo/neptune-demo.html`, `/demo/ai-chat-demo.html`.
- `pnpm build` / `pnpm preview` — production build/preview (also port 3000).

### Testing

- `pnpm test` runs the **Playwright** suite (`tests/`). Tests execute the ES modules inside a real Chromium browser via a fixture harness; they are not plain Node unit tests.
- Playwright spins up its own static file server (`python3 -m http.server 8790`, see `playwright.config.ts`) serving the repo root — it does NOT use the Vite dev server, so `pnpm test` works even if `pnpm dev` is not running.
- The Playwright browser binary is installed during environment setup (`playwright install chromium`); the dev-container system libraries persist in the snapshot.

### Linting

There is no lint tooling in this repo (no ESLint config and no `lint` npm script). "Running lint" is a no-op here.

### Non-obvious gotchas

- `vd-ai-chat` requires **WebGPU** to actually download/run a model, which is not available in headless/CI browsers. Its logic is covered by headless Playwright tests that mock the inference engine; do not expect the live model download to work in the cloud VM. Use the **Neptune search** demo for end-to-end manual verification instead — it runs fully in-browser (fuzzy is instant; the semantic model loads client-side after a few seconds).
