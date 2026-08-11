## 1. Guardrails tool validation

- [x] 1.1 Add `validateToolCall` (+ types) to `guardrails/llm.js` (or `guardrails/tools.js` re-exported)
- [x] 1.2 Extend `buildChatSystemPrompt` for `product` / `extra` / `toolsEnabled`
- [x] 1.3 Unit tests for allowlist, oversized args, empty name

## 2. AiChat tool API

- [x] 2.1 Add `registerTools`, `systemPromptOptions`, `_tools`, native/XML detection
- [x] 2.2 Implement `generateWithTools` loop with maxRounds and LiteRT-only gate
- [x] 2.3 Wire preface tools when native path is available; XML fallback otherwise
- [x] 2.4 Unit tests with mock conversation / XML parser (no WebGPU)

## 3. Quality toolchain

- [x] 3.1 Add eslint + prettier config and `lint` / `format` / `format:check` scripts for headless modules
- [x] 3.2 Update `doc/vdl-ai-chat.md` and `doc/vdl-guardrails.md`
- [x] 3.3 Run focused unit tests / lint / format:check
