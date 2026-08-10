# vdl-guardrails Specification (delta)

## Modified Requirements

### Requirement: Product-aware system prompt composition

`buildChatSystemPrompt` MUST accept optional `product` and `extra` (or `extraRules`) fields so product hosts can inject role context while retaining the FOSS base prompt. When `product` is omitted, Labs Vanduo context MUST remain the default.

#### Scenario: Product context injected

- **WHEN** `buildChatSystemPrompt({ product: 'TypeScript School', extra: 'Cite lesson routes.' })` is called
- **THEN** the returned prompt includes the FOSS base rules and the product/extra text

### Requirement: Tool call validation helpers

Guardrails MUST export helpers to validate a tool invocation against an allowlist and JSON-Schema-like parameter constraints, including max argument payload size.

#### Scenario: Allowlist miss

- **WHEN** `validateToolCall({ name, args, allowlist, maxArgsBytes })` sees a name not in allowlist
- **THEN** it returns a blocked result and does not mark the call allowed
