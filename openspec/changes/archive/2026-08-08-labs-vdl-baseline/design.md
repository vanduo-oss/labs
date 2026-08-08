## Context

See proposal.md — Why. Working tree already implements the Labs `vdl` baseline: renamed Labs Vue components (`Vdl*`), LiteRT-default `ai-chat.js`, Neptune mount-time semantic preload, composer UX, and Vanduo Labs system prompt in `guardrails/llm.js`. `@vanduo-oss/vd3` stays on its existing `Vd*` surface. This design records how that baseline is structured so archive can sync empty `openspec/specs/` from deltas.

## Goals / Non-Goals

**Goals:**
- Capture accurate behavior contracts for naming, chat, Neptune preload, and guardrails.
- Keep apply as verification + checkbox completion against the existing tree (not a rewrite).
- Leave OpenSpec doctor healthy after archive sync.

**Non-Goals:**
- Renaming or wrapping vd3 APIs.
- Reworking CDN imports / SRI in this change (policy docs are a separate repo hygiene task).
- Expanding guardrails pattern sets or changing model weights.

## Decisions

1. **Capability split (four specs)**  
   Separate `vdl-naming`, `vdl-ai-chat`, `vdl-neptune-search`, and `vdl-guardrails` so future deltas can touch one product area without rewriting a monolith.  
   *Alternative considered:* one `labs-baseline` spec — rejected as harder to evolve.

2. **LiteRT default vs MLC experimental**  
   Default path uses `@litert-lm/core` Gemma packages with conversation state; community MLC Gemma remains selectable but labeled experimental with latest-turn workaround.  
   *Alternative considered:* drop MLC Gemma entirely — rejected to keep escape hatches for WebLLM users.

3. **Headless ESM + Labs Vue shell**  
   Product behavior lives in `ai-chat.js` / `neptune-search.js` / `guardrails/*`; Labs site UX lives in `src/components/Vdl*.vue` consuming `@vanduo-oss/vd3`. Specs describe observable UX/API behavior, not Vue internals.

4. **Brownfield apply**  
   Tasks verify existing behavior (docs + focused tests) and mark complete; no duplicate implementation pass unless a gap is found.

## Risks / Trade-offs

- [Spec drift vs tree] → Mitigation: scenarios mirror `doc/vdl-*.md` and current code paths; focused unit tests for guardrails.
- [MLC multi-turn limitations surprise users] → Mitigation: experimental labeling + docs note latest-turn workaround.
- [Semantic preload cost on low-end devices] → Mitigation: background-only; fuzzy path stays usable.

## Migration Plan

No deploy migration. On archive, sync delta specs into `openspec/specs/<capability>/spec.md`. Rollback is revert of the OpenSpec archive commit if needed; product code is already live in the working tree.
