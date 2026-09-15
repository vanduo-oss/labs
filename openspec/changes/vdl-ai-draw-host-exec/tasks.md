# Tasks

## 1. Host-first execution (`src/demos/draw-intent.js`)

- [x] In `runDrawTurn`, treat an empty merged LLM plan (no steps, no clear) as a planning failure so the turn falls back to the tool loop.
- [x] Execute validated plans host-side: emit `onPhase('executing')`, run `clear_canvas` when `plan.clear`/intent wants clear or the plan is a replayed LLM plan, then run each step via `execute()` with per-step error logging.
- [x] Keep the `generateWithTools` fallback only for turns with no valid plan; keep post-turn fulfill branches and canvas-honest replies unchanged.
- [x] Update JSDoc for the new phase name.
- [x] Read-only question turns: `isCanvasQuestion` detection, `answering` phase, `generateAnswer` hook, grounded `formatCanvasQuestionPrompt`, honest local fallback reply.

## 2. UI (`src/components/VdlAiDrawUI.vue`)

- [x] Default model → `gemma-4-E2B-it-web`; relabel options (E2B Recommended, E4B Quality).
- [x] Map `executing` phase to "Drawing…" status without resetting the chat conversation.
- [x] Add "Fast planner" experimental toggle persisted at `vdl-ai-draw-tiny-planner`.
- [x] Route questions to an "answering" phase and wire `generateAnswer`.

## 3. Tiny planner experiment (`src/demos/draw-planner-webllm.js`)

- [x] Factory creating a lazy planning-only chat on `TINY_MODEL_ID`; no tools registered.
- [x] Gemma stays unloaded until the fallback pass actually needs it; auto-disable the flag for the session on load failure.
- [x] Unit tests with a mocked chat factory.
- [x] Stateless resets before every plan; compact planner prompt for the 4K window (context-overflow bug found in dogfood).

## 4. Eval suite (`utils/`)

- [x] `utils/model-eval-draw-suite.json` covering the dogfood prompts plus unknown scenes.
- [x] `utils/model-eval-draw-runner.mjs` driving `tests/fixtures/ai-draw-harness.html` via Playwright Chromium; writes JSON+MD reports under `data/model-eval-reports/draw/`.
- [x] `pnpm model-eval:draw` script; gated to darwin/arm64 or `RUN_AI_DRAW_INFERENCE=1`.
- [ ] Run baseline E2B vs E4B; commit reports.

## 5. Tests

- [x] Update `tests/unit/draw-tools.spec.ts`: host-first phase expectations, no planner call for host plans, fallback unchanged, llm-plan replay wipes before redrawing, star/hex modelReply changes, question turns, compact prompt.
- [x] New `tests/unit/draw-planner-webllm.spec.ts`.
- [x] Update `tests/local/ai-draw-inference.spec.ts` unknown-scene expectations and harness phases.

## 6. Docs

- [x] `doc/vdl-ai-draw.md`: architecture update, model policy, fast-planner flag + compact-prompt note, question turns, eval suite section.
- [x] README ai-draw section.

## Verification

- [x] `pnpm format:check && pnpm lint && pnpm test:unit && pnpm build`
- [ ] `pnpm test:local` (darwin/arm64)
- [ ] `pnpm model-eval:draw` baseline E2B vs E4B report committed
