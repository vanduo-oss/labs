## Context

See proposal.md — Why. Labs currently vendors engine ESM at the repo root and packages them as `@vanduo-oss/vdl-engines`. Engines are already published as `@vanduo-oss/vdl-ai-chat` / `@vanduo-oss/vdl-hybrid-search`. ts-school already consumes those packages with injected `loadLiteRT` / `loadFuse` / `loadTransformers`.

## Goals / Non-Goals

**Goals:**
- Rewire labs demos/tests to npm packages end-to-end
- Delete engine forks; retire vdl-engines packaging
- Keep playground UX (Vue UIs, model-eval, Gemma demos, corpus)
- Green format/lint/unit/build gates

**Non-Goals:**
- Publishing any package to npm
- Changing vd3 design-system APIs
- Promoting the vanilla `NeptuneSearchUI` DOM class (Vue `VdlHybridSearchUI` is the labs UI)

## Decisions

1. **Private package name `@vanduo-oss/labs`** — clear playground identity; no `exports`/`files`/`publishConfig`.
   - Alternative: keep `@vanduo-oss/vdl-engines` private — rejected; name implies publishing engines.

2. **`HybridSearch` + rename Vue file to `VdlHybridSearchUI.vue`** — align with package API; keep CSS class prefix `.vdl-neptune-*` for now to limit test churn, or migrate selectors if cheap.
   - Alternative: keep Neptune naming in Vue only — rejected per phase-3 rename ask.

3. **Inject loaders in Vue demos** — follow ts-school: `loadLiteRT: () => import('@litert-lm/core')`, `loadFuse` from `fuse.js`, `loadTransformers` from `@huggingface/transformers`. Add `@litert-lm/core` as a labs dependency if needed for Vite resolution.
   - Alternative: rely on package CDN defaults — fragile under CSP / offline demos.

4. **Indexer wrapper** — `utils/hybrid-search-indexer.mjs` runs the package `scripts/hybrid-search-indexer.mjs`, then copies `search-index.json` / `vectors.json` into labs `data/` (package script writes relative to its own package root).
   - Alternative: keep full local indexer fork — rejected (duplication).

5. **Playwright harness** — import HybridSearch / AiChat / guardrails from `node_modules/@vanduo-oss/*/dist/...` (python static server) or Vite-resolved bare imports. Keep a test-only DOM UI harness extracted from the old `NeptuneSearchUI` under `tests/fixtures/` so e2e UI specs stay runnable without republishing a DOM UI.
   - Alternative: rewrite all e2e UI tests to mount Vue via Vite now — larger rewrite; defer if harness extract is faster and keeps gates green.

6. **`.npmrc`** — mirror ts-school `minimum-release-age-exclude[]=@vanduo-oss/*` (and related supply-chain pins as appropriate for labs).

7. **Vite static copy** — stop copying deleted engines; keep `model-eval.js`, `data`, `doc`, `favicon.svg`.

## Risks / Trade-offs

- [NeptuneSearchUI deleted with engine] → Mitigation: test-only fixture DOM UI for Playwright; production UI is Vue.
- [Package indexer writes to package `data/`] → Mitigation: wrapper copies into labs `data/`.
- [Unit tests import absolute `/ai-chat.js` paths] → Mitigation: rewrite imports to package dist paths or Vite.
- [Version constants rename `VDL_NEPTUNE_SEARCH_VERSION` → `VDL_HYBRID_SEARCH_VERSION`] → Mitigation: update App.vue / docs accordingly.

## Migration Plan

1. OpenSpec artifacts + validate
2. package.json / .npmrc / pnpm install
3. Rewire imports + rename Vue component + indexer wrapper + vite/eslint
4. Update tests/harness
5. Delete forks
6. Docs + live specs + archive change
7. Run format:check, lint, test:unit, build

## Open Questions

None — package export names (`HybridSearch`, `labsMarkdownToHtml`) and versions are known from published packages / ts-school.
