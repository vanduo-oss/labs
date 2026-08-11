# vdl-guardrails Specification

## Purpose
Shared deterministic guardrails for Labs LLM and search paths, including Vanduo Labs system-prompt context for chat.
## Requirements
### Requirement: Guardrails modules remain available
Labs MUST obtain guardrails from the published engine packages (`@vanduo-oss/vdl-ai-chat/guardrails/*` for LLM/tools and `@vanduo-oss/vdl-hybrid-search/guardrails/search` for search) rather than a labs-owned `guardrails/` source tree.

#### Scenario: LLM input validation remains callable
- **WHEN** a consumer validates chat input through the LLM guardrails API from `@vanduo-oss/vdl-ai-chat/guardrails/llm`
- **THEN** known prompt-injection patterns are blocked before generation

#### Scenario: Search helpers remain callable
- **WHEN** a consumer validates search index payloads or sanitizes doc hrefs via `@vanduo-oss/vdl-hybrid-search/guardrails/search`
- **THEN** the helpers remain available without a local labs `guardrails/` SoT

### Requirement: System prompt includes Vanduo Labs context
The chat system prompt composed for supported models MUST identify Vanduo Labs as part of vanduo-oss and MUST mention that the organization ships vd3 (UI) and vd3-cbun.

#### Scenario: Prompt mentions ecosystem context
- **WHEN** the chat system prompt is built for a model that accepts a system role
- **THEN** the prompt text includes Vanduo Labs / vanduo-oss context and references to vd3 and vd3-cbun

