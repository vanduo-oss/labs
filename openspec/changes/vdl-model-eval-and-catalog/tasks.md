## 1. LiteRT spike + catalog

- [x] 1.1 Extend `utils/fetch-ai-models.mjs` for Qwen3-0.6B LiteRT (and Ministral if probing)
- [x] 1.2 Spike-load Qwen3-0.6B via existing LiteRT path; attempt Ministral; document outcome
- [x] 1.3 Update `MODEL_OPTIONS` / groups / `TINY_MODEL_ID` (multi-arch LiteRT + refreshed WebLLM peers; remove SmolLM2/Qwen2.5-1.5B/Llama-3.2)
- [x] 1.4 Update `doc/vdl-ai-chat.md` and unit tests that hardcode removed models

## 2. vdl-model-eval core

- [x] 2.1 Add `model-eval.js` (scorers, suite runner API, report schema, concurrency planner)
- [x] 2.2 Add `utils/model-eval-suite.json` (branding, honesty, instruction-following)
- [x] 2.3 Export module + `pnpm model-eval` script in `package.json`
- [x] 2.4 Unit tests for scorers with fixture strings

## 3. Eval runner + published report

- [x] 3.1 Add browser harness `demo/model-eval-harness.html` + demo bootstrap
- [x] 3.2 Add `utils/model-eval-runner.mjs` (Playwright WebGPU, parallel workers)
- [x] 3.3 Commit a sample report under `data/model-eval-reports/latest/` (or fixture if live run unavailable)

## 4. Tools section UI

- [x] 4.1 Add `@vanduo-oss/vd3-cbun` dependency
- [x] 4.2 Add Tools route + Model Eval card in `src/App.vue` (not DEMO_SLUGS)
- [x] 4.3 Add `VdlModelEvalUI.vue` + `doc/vdl-model-eval.md`
- [x] 4.4 Wire Vite copy/build inputs as needed

## 5. Verify

- [x] 5.1 Run focused unit tests + `pnpm test`
- [x] 5.2 Mark OpenSpec tasks complete when implementation matches
