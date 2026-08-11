## ADDED Requirements

### Requirement: AiChat engine comes from npm
The labs AI chat demo MUST import `AiChat` and related catalog helpers from `@vanduo-oss/vdl-ai-chat`, and MUST import markdown rendering from `@vanduo-oss/vdl-ai-chat/markdown` (for example `labsMarkdownToHtml`). Labs MUST NOT treat a local `ai-chat.js` / `labs-md-to-html.js` as the engine SoT.

#### Scenario: Vue chat UI imports published package
- **WHEN** `VdlAiChatUI` loads the chat engine and markdown helper
- **THEN** imports resolve from `@vanduo-oss/vdl-ai-chat` and `@vanduo-oss/vdl-ai-chat/markdown`

#### Scenario: Loader injection available for CSP-friendly demos
- **WHEN** the chat UI constructs `AiChat` in the Vite demo shell
- **THEN** it MAY inject `loadLiteRT` (and related loaders) so inference stacks load from same-origin / bundled modules rather than blocked CDNs
