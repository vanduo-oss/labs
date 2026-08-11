## Why

Search and AI chat engines now live in published npm packages (`@vanduo-oss/vdl-hybrid-search`, `@vanduo-oss/vdl-ai-chat`). Labs still vendors forks (`neptune-search.js`, `ai-chat.js`, `guardrails/`) and publishes `@vanduo-oss/vdl-engines`, which drifts from the real SoT and confuses consumers.

## What Changes

- **BREAKING**: Retire `@vanduo-oss/vdl-engines` packaging (`exports` / `files` / `publishConfig`); rename the private demo package to `@vanduo-oss/labs`
- Depend on `@vanduo-oss/vdl-ai-chat@^0.1.0` and `@vanduo-oss/vdl-hybrid-search@^0.1.1` from the npm registry
- Rewire Vue demos, tests, and scripts to consume those packages (`HybridSearch` naming; inject CSP-friendly loaders)
- Delete local engine forks (`ai-chat.js`, `neptune-search.js`, `labs-md-to-html.js`, `guardrails/`, `utils/neptune-indexer.mjs`)
- Keep model-eval, Gemma demos, Vue UIs, and the data corpus as labs playground assets
- Update README, docs, and live OpenSpec specs so labs is a demo playground, not an engine SoT

## Capabilities

### New Capabilities

- `vdl-package-consumption`: labs installs and imports published VDL engine packages; no local engine SoT; CI/site still builds

### Modified Capabilities

- `vdl-neptune-search`: rename product surface to HybridSearch / hybrid-search docs while keeping Vue demo behavior; engine comes from npm
- `vdl-ai-chat`: headless engine and markdown helpers come from `@vanduo-oss/vdl-ai-chat` (not local `ai-chat.js`)
- `vdl-guardrails`: guardrails are consumed from published package subpaths, not a labs-owned `guardrails/` tree

## Impact

- Labs `vdl` Vue surface (`VdlAiChatUI`, rename `VdlNeptuneSearchUI` → `VdlHybridSearchUI`) and demos/tests/docs
- `package.json`, `.npmrc`, `vite.config.js`, `eslint.config.js`, Playwright harnesses
- Does **not** change `@vanduo-oss/vd3` APIs
- Does **not** publish anything to npm
