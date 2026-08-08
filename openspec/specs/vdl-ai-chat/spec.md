# vdl-ai-chat Specification

## Purpose
In-browser WebGPU AI chat with LiteRT Gemma as the default path, optional experimental MLC models, and Labs composer UX conventions.
## Requirements
### Requirement: LiteRT Gemma is the default chat path
The default model MUST be Gemma 4 E2B via LiteRT-LM, and that path MUST preserve real multi-turn conversation context across turns in a session.

#### Scenario: Default model identity
- **WHEN** a user opens Labs AI chat without choosing another model
- **THEN** the selected default is Gemma 4 E2B on the LiteRT path

#### Scenario: Multi-turn on LiteRT
- **WHEN** the user sends a follow-up message on the LiteRT Gemma default after a prior assistant reply
- **THEN** generation uses conversation context from prior turns (not latest-turn-only)

### Requirement: Community MLC Gemma is experimental
Community WebLLM/MLC Gemma packages MAY remain available but MUST be labeled experimental, and the product MUST NOT treat their native multi-turn behavior as reliable.

#### Scenario: Experimental labeling
- **WHEN** the model picker lists a community MLC Gemma option
- **THEN** the option is marked experimental (or equivalent user-facing signal)

### Requirement: Composer Enter sends and list sticks to bottom
Labs chat UI MUST send on Enter (Shift+Enter inserts a newline) and MUST keep the message list scrolled to the latest content while the user is near the bottom.

#### Scenario: Enter sends
- **WHEN** the composer has focus and the user presses Enter without Shift
- **THEN** the current message is submitted

#### Scenario: Stick to bottom while near bottom
- **WHEN** new assistant tokens arrive and the user is already near the bottom of the message list
- **THEN** the list remains scrolled to show the latest content

