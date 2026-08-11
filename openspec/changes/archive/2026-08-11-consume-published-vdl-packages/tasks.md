## 1. Package + tooling

- [x] 1.1 Update `package.json`: name `@vanduo-oss/labs`, `private: true`, remove engines `exports`/`files`/`publishConfig`; add `@vanduo-oss/vdl-ai-chat` / `@vanduo-oss/vdl-hybrid-search` (+ `@litert-lm/core` if needed); point lint/format at `src/` + `model-eval.js` + `utils/`; set `index` to hybrid-search indexer wrapper
- [x] 1.2 Add/update `.npmrc` with `minimum-release-age-exclude[]=@vanduo-oss/*` (align with ts-school as needed)
- [x] 1.3 Add `utils/hybrid-search-indexer.mjs` thin wrapper that runs the package indexer and copies artifacts into labs `data/`
- [x] 1.4 Run `pnpm install` and refresh the lockfile from the registry

## 2. Rewire demos

- [x] 2.1 Rewire `VdlAiChatUI.vue` to `@vanduo-oss/vdl-ai-chat` + `/markdown`; inject `loadLiteRT` where needed
- [x] 2.2 Rename `VdlNeptuneSearchUI.vue` → `VdlHybridSearchUI.vue`; use `HybridSearch` + package search guardrails; inject `loadFuse` / `loadTransformers`
- [x] 2.3 Update `App.vue`, `src/demos/*`, and version/doc links for HybridSearch naming
- [x] 2.4 Update `vite.config.js` static copy targets (drop engine forks; keep model-eval/data/doc/favicon)
- [x] 2.5 Update `eslint.config.js` for remaining labs JS (no deleted engines)

## 3. Tests

- [x] 3.1 Update unit specs to import from published package paths
- [x] 3.2 Update `tests/fixtures/neptune-harness.html` (and any DOM UI helper) for `HybridSearch`
- [x] 3.3 Update e2e `vdl-neptune-search.spec.ts` for HybridSearch naming / selectors as needed

## 4. Delete forks

- [x] 4.1 Delete `ai-chat.js`, `neptune-search.js`, `labs-md-to-html.js`, `guardrails/`, and `utils/neptune-indexer.mjs`

## 5. Docs + OpenSpec close-out

- [x] 5.1 Rewrite README for playground + npm engines (do not publish vdl-engines)
- [x] 5.2 Update `doc/vdl-ai-chat.md`, hybrid-search doc (rename/retitle from neptune), `doc/vdl-guardrails.md`
- [x] 5.3 Update live openspec specs + `openspec/config.yaml` context
- [x] 5.4 Run `pnpm format:check`, `pnpm lint`, `pnpm test:unit`, `pnpm build` until green
- [x] 5.5 Validate change and archive `consume-published-vdl-packages`
