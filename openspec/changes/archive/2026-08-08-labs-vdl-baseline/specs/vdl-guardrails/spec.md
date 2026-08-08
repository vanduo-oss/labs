## Purpose

Shared deterministic guardrails for Labs LLM and search paths, including Vanduo Labs system-prompt context for chat.

## ADDED Requirements

### Requirement: Guardrails modules remain available
Labs MUST retain shared guardrails modules covering LLM input validation / system-prompt composition, search-policy helpers, and shared result/error contracts.

#### Scenario: LLM input validation remains callable
- **WHEN** a consumer validates chat input through the LLM guardrails API
- **THEN** known prompt-injection patterns are blocked before generation

#### Scenario: Search helpers remain callable
- **WHEN** a consumer validates search index payloads or sanitizes doc hrefs via search guardrails
- **THEN** the helpers remain available as a shared Labs service

### Requirement: System prompt includes Vanduo Labs context
The chat system prompt composed for supported models MUST identify Vanduo Labs as part of vanduo-oss and MUST mention that the organization ships vd3 (UI) and vd3-cbun.

#### Scenario: Prompt mentions ecosystem context
- **WHEN** the chat system prompt is built for a model that accepts a system role
- **THEN** the prompt text includes Vanduo Labs / vanduo-oss context and references to vd3 and vd3-cbun
