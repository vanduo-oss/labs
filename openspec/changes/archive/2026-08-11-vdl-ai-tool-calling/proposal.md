## Why

Product apps (starting with ts-school) need in-browser Gemma chat that can call host tools — search, read context, propose editor edits — under the same FOSS guardrails. Labs `AiChat` today only does free-form generate; there is no tool registration, validation, or tool-response loop.

## What Changes

- Extend headless `AiChat` with `registerTools`, injectable system prompt options, and `generateWithTools` (LiteRT Gemma E2B/E4B only).
- Add tool-call allowlist + argument validation in `guardrails/` before host execution.
- Prefer native LiteRT `Preface.tools` / `tool_calls` when the pinned runtime supports it; otherwise use a constrained XML tool protocol with the same host executor.
- Disable tools on WebLLM / experimental model paths with a clear error.
- Add eslint + prettier scripts for headless modules and unit coverage for the tool loop.
- Document the API in `doc/vdl-ai-chat.md` / `doc/vdl-guardrails.md`.

## Capabilities

### New Capabilities

- `vdl-ai-tools`: Allowlisted tool registration, validation, and multi-round tool-calling loop for LiteRT Gemma chat.

### Modified Capabilities

- `vdl-ai-chat`: Expose tool-capable generate path and injectable product system context on LiteRT defaults.
- `vdl-guardrails`: Add tool-arg validation helpers and product-aware system prompt composition.

## Impact

- Touches labs `vdl` surface only (`ai-chat.js`, `guardrails/*`, docs, tests). Does not change `@vanduo-oss/vd3` APIs.
- Downstream consumers (ts-school) will depend on the published engines package after `vdl-publish-engines`.


## Status

Engine tool-calling shipped in published `@vanduo-oss/vdl-ai-chat`. Labs will consume that package; this change is closed as done-elsewhere.
