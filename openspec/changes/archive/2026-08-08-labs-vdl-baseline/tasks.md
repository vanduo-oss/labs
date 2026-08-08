## 1. Naming baseline

- [x] 1.1 Confirm Labs Vue components / CSS / product ids use `Vdl` / `vdl-` and shell still imports `@vanduo-oss/vd3` `Vd*` unchanged
- [x] 1.2 Confirm docs/README use `vdl-*` product names (not `vd-*` for Labs modules)

## 2. AI chat baseline

- [x] 2.1 Confirm LiteRT Gemma E2B is default with multi-turn path; MLC Gemma labeled experimental
- [x] 2.2 Confirm Labs composer Enter-to-send + stick-to-bottom scroll behavior in `VdlAiChatUI` / docs
- [x] 2.3 Confirm Vanduo Labs system prompt (vanduo-oss, vd3, vd3-cbun) via `buildChatSystemPrompt`

## 3. Neptune + guardrails baseline

- [x] 3.1 Confirm semantic preload starts on Neptune UI mount (Vue + headless)
- [x] 3.2 Confirm shared `guardrails/{core,llm,search}.js` remain wired and documented

## 4. Verification

- [x] 4.1 Run focused unit tests (`tests/unit/guardrails.spec.ts` and/or `tests/unit/neptune-search.spec.ts`)
- [x] 4.2 Run `openspec validate labs-vdl-baseline` (or equivalent) before archive
