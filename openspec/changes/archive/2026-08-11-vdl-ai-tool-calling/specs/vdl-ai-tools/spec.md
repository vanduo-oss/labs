# vdl-ai-tools Specification

## Purpose

Allowlisted, validated tool calling for in-browser LiteRT Gemma chat so product hosts can run agentic loops without bypassing FOSS guardrails.

## Requirements

### Requirement: Tools register with JSON Schema declarations

`AiChat` MUST accept tool definitions with a unique `name`, human `description`, and JSON-Schema `parameters` object. Registration MUST replace any prior tool set for that instance.

#### Scenario: Register tools

- **WHEN** a host calls `registerTools([{ name, description, parameters }])`
- **THEN** subsequent tool-capable generation uses those definitions

### Requirement: Tool args validated before host execute

Before invoking the host `execute` callback, Labs MUST validate the tool name against the registered allowlist and MUST reject malformed or oversized arguments via shared guardrails helpers.

#### Scenario: Unknown tool is blocked

- **GIVEN** tools registered as `search_curriculum` only
- **WHEN** the model requests tool `delete_everything`
- **THEN** execute is not called and the loop receives a structured tool error

#### Scenario: Oversized args are blocked

- **WHEN** tool arguments JSON exceeds the configured max payload size
- **THEN** execute is not called and validation fails deterministically

### Requirement: Multi-round generateWithTools loop

`generateWithTools(userText, { execute, maxRounds })` MUST run generate → tool_calls → execute → tool_response until a final assistant text reply or `maxRounds` is exhausted. User input MUST still pass `validateLlmInput` first.

#### Scenario: Happy path tool then answer

- **GIVEN** a LiteRT Gemma model is loaded and a mock execute returns `{ ok: true }`
- **WHEN** generateWithTools receives a user turn that triggers one tool call
- **THEN** execute runs once and the method returns a non-empty final assistant string

#### Scenario: maxRounds stops the loop

- **WHEN** the model keeps requesting tools beyond maxRounds
- **THEN** generation stops and an error is raised (or a final partial reply policy documented by AiChat)

### Requirement: Tools disabled outside LiteRT Gemma

WebLLM and experimental/spike models MUST NOT run `generateWithTools`.

#### Scenario: WebLLM rejects tools

- **WHEN** the selected model is a WebLLM backend
- **WHEN** the host calls generateWithTools
- **THEN** the call fails with a clear tools-unsupported error before execute
