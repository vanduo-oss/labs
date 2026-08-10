# vdl-ai-chat Specification (delta)

## Modified Requirements

### Requirement: LiteRT Gemma supports tool-capable generation

In addition to `generate()`, LiteRT Gemma E2B/E4B MUST expose `generateWithTools` that preserves multi-turn conversation context and integrates registered tools when present.

#### Scenario: Tools optional for plain generate

- **WHEN** tools are registered but the host calls `generate()`
- **THEN** generation proceeds without requiring tool execution

#### Scenario: System prompt can include product context

- **WHEN** AiChat is constructed with `{ systemPromptOptions: { product, extra } }`
- **THEN** the LiteRT conversation preface uses the composed prompt from guardrails
