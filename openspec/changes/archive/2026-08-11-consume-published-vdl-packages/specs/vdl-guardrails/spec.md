## MODIFIED Requirements

### Requirement: Guardrails modules remain available
Labs MUST obtain guardrails from the published engine packages (`@vanduo-oss/vdl-ai-chat/guardrails/*` for LLM/tools and `@vanduo-oss/vdl-hybrid-search/guardrails/search` for search) rather than a labs-owned `guardrails/` source tree. Deterministic validation and safety helpers MUST remain callable for demos and tests.

#### Scenario: LLM input validation remains callable
- **WHEN** a consumer validates chat input through the LLM guardrails API from `@vanduo-oss/vdl-ai-chat/guardrails/llm`
- **THEN** known prompt-injection patterns are blocked before generation

#### Scenario: Search helpers remain callable
- **WHEN** a consumer validates search index payloads or sanitizes doc hrefs via `@vanduo-oss/vdl-hybrid-search/guardrails/search`
- **THEN** the helpers remain available without a local labs `guardrails/` SoT
