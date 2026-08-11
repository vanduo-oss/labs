## ADDED Requirements

### Requirement: Multi-architecture catalog with honest LiteRT labels
The model catalog MUST keep Gemma 4 E2B LiteRT as the default web-official path, MAY expose LiteRT spikes for other families labeled `spike` / experimental, and MUST offer a capable Tiny peer when LiteRT portable loads are blocked by the runtime.

#### Scenario: Tiny Qwen3 WebLLM is available
- **WHEN** a user opens the model picker
- **THEN** a Tiny Qwen3 0.6B WebLLM option is listed

#### Scenario: Official Gemma web remains default
- **WHEN** a user opens Labs AI chat without choosing another model
- **THEN** the default remains Gemma 4 E2B LiteRT with web-official support

### Requirement: Tiny model is not SmolLM2
The recommended Tiny / weak-device model MUST NOT be SmolLM2-360M.

#### Scenario: Weak-device recommendation
- **WHEN** load-capacity heuristics recommend a Tiny model
- **THEN** the recommended model id is the Qwen3 0.6B Tiny entry (WebLLM)

### Requirement: Outdated optional WebLLM models removed
The catalog MUST NOT offer SmolLM2-360M, Qwen2.5-1.5B, or Llama-3.2-3B as selectable options.

#### Scenario: Removed models absent from picker
- **WHEN** the model picker lists optional WebLLM peers
- **THEN** SmolLM2-360M, Qwen2.5-1.5B, and Llama-3.2-3B are not present

## MODIFIED Requirements

### Requirement: LiteRT Gemma is the default chat path
The default model MUST be Gemma 4 E2B via LiteRT-LM, and that path MUST preserve real multi-turn conversation context across turns in a session. Additional LiteRT families MAY be offered as non-default options without changing the default identity.

#### Scenario: Default model identity
- **WHEN** a user opens Labs AI chat without choosing another model
- **THEN** the selected default is Gemma 4 E2B on the LiteRT path

#### Scenario: Multi-turn on LiteRT
- **WHEN** the user sends a follow-up message on the LiteRT Gemma default after a prior assistant reply
- **THEN** generation uses conversation context from prior turns (not latest-turn-only)

#### Scenario: Multi-turn on WebLLM Qwen3 Tiny
- **WHEN** the user chats on WebLLM Qwen3 0.6B after a prior assistant reply
- **THEN** generation uses conversation context from prior turns
