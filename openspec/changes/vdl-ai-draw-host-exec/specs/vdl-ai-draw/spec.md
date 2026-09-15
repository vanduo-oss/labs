# vdl-ai-draw Specification (delta)

## ADDED Requirements

### Requirement: Host-first DrawPlan execution

The draw harness MUST execute any validated DrawPlan directly through the host tool executor without a model tool-calling pass, for both host recipe plans (`planSource: 'host'`) and LLM planner plans (`planSource: 'llm'`).

#### Scenario: Valid LLM plan skips the model draw pass

- **WHEN** the planner returns JSON that `validateDrawPlan` accepts with at least one step
- **THEN** the harness emits an `executing` phase and draws the steps via `execute()` without calling `generateWithTools`
- **AND** the visible reply is authored from the resulting canvas state

#### Scenario: Replayed LLM plan wipes before redrawing

- **WHEN** an LLM plan is executed host-side (fresh or merged follow-up)
- **THEN** the canvas is cleared before the merged step list is replayed so earlier shapes are not duplicated

#### Scenario: Invalid planning falls back to the tool loop

- **WHEN** no planner is provided, the planner output is not valid JSON after its retry, or the merged plan has no actionable steps
- **THEN** the turn falls back to the existing cleared-context `generateWithTools` loop with the raw user text
- **AND** post-turn fulfill safety nets (math plots, stacked bands, named recipes) still run

#### Scenario: Per-step failures do not abort the turn

- **WHEN** one planned step throws during host execution
- **THEN** the error is logged, remaining steps still run, and the reply stays honest about the final canvas

### Requirement: E2B default model

The AI Draw UI MUST default to `gemma-4-E2B-it-web`, keeping `gemma-4-E4B-it-web` selectable as the quality option.

#### Scenario: Fresh visitor sees E2B selected

- **WHEN** the AI Draw demo loads with no stored model preference
- **THEN** the model select shows Gemma 4 E2B as the default

### Requirement: Read-only question turns

Prompts that ask about the canvas instead of requesting a change MUST route to an `answering` phase with no tools registered, and MUST NOT draw, clear, or re-plan anything.

#### Scenario: Canvas question is answered without drawing

- **WHEN** the user sends "what is on canvas now ?"
- **THEN** the harness answers from the canvas summary (model-phrased when available), the shape set is unchanged, and no planner or tool pass runs

#### Scenario: Draw requests phrased as questions still draw

- **WHEN** the user sends "can you draw a star?"
- **THEN** the prompt is treated as a draw request, not a question

### Requirement: Small-context fast planner prompts

The fast planner (Qwen3-0.6B, 4K window) MUST receive the compact planner prompt and MUST run stateless — resetting its conversation before every plan.

#### Scenario: Compact prompt fits the tiny context

- **WHEN** planning routes through the fast planner
- **THEN** the compact prompt (schema + rules + request + previous plan) is used instead of the full few-shot prompt, and prior planning turns do not accumulate into the context

#### Scenario: Context overflow degrades permanently

- **WHEN** the tiny planner reports a context-window overflow
- **THEN** it disables itself for the session, reports a short status message, and Gemma plans the turn instead

### Requirement: Flagged tiny planner experiment

An optional fast-planner mode MAY route the planning call to WebLLM Qwen3-0.6B through a second `AiChat` instance used for planning only. It MUST be off by default, persisted behind an explicit user toggle, and MUST keep LiteRT Gemma as the only engine that executes tools.

#### Scenario: Tiny planner handles a valid plan without loading Gemma tools

- **WHEN** fast-planner mode is enabled and Qwen3-0.6B produces a valid plan
- **THEN** no second generative pass runs and Gemma weights load lazily only if the fallback tool loop is required

#### Scenario: Tiny planner failure degrades gracefully

- **WHEN** the tiny planner fails to load or generate
- **THEN** the flag disables itself for the session with a status message and planning falls back to Gemma without losing the turn

#### Scenario: Never concurrent generation

- **WHEN** the tiny planner and Gemma are both loaded
- **THEN** at most one generation runs at a time and at most one LiteRT engine exists per page

### Requirement: Draw evaluation suite

A local eval command MUST measure per-prompt plan validity, shapes drawn, and wall time against real models using the AI Draw inference harness, writing reports under `data/model-eval-reports/draw/`. CI MUST NOT require WebGPU inference.

#### Scenario: Baseline comparison report

- **WHEN** `pnpm model-eval:draw` runs for two models on darwin/arm64
- **THEN** a JSON report and markdown summary compare plan validity rate, median wall time, and shape counts per case
