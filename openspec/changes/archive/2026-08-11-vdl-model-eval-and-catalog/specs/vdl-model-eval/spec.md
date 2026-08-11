## Purpose

Provides a local on-computer harness to evaluate in-browser chat models against a curated suite, emit Playwright-style HTML/JSON reports, and present published results on Labs Tools.

## ADDED Requirements

### Requirement: Curated evaluation suite
The eval harness MUST run a documented prompt suite covering Labs branding accuracy, honesty (admit mistakes), and basic instruction-following, and MUST score each case as pass or fail with a recorded model response excerpt.

#### Scenario: Branding case fails inventing Vandouno
- **WHEN** a model response invents the misspelling “Vandouno” (or equivalent) for Vanduo Labs
- **THEN** the branding case is scored fail

#### Scenario: Branding case requires Vanduo Labs
- **WHEN** a model is asked what site/org hosts the demo
- **THEN** a passing response includes “Vanduo Labs” (case-insensitive) and does not invent a false Labs brand spelling

### Requirement: Architecture-comparable reports
Eval reports MUST identify each model by id, backend, and family so LiteRT Gemma can be compared to LiteRT Qwen3 (and optional WebLLM peers) in the same run.

#### Scenario: Report lists family and backend
- **WHEN** an eval run completes for two models on different families
- **THEN** the JSON report includes per-model pass rate, latency metrics, backend, and family fields

### Requirement: Published report artifacts
A successful local eval run MUST write JSON results and a self-contained HTML summary under a Labs-served reports directory that the Tools UI can load.

#### Scenario: Latest report path
- **WHEN** `pnpm model-eval` finishes successfully
- **THEN** results are available under `data/model-eval-reports/latest/` (JSON and HTML)

### Requirement: Concurrency respects resource budget
The runner MUST plan parallel model loads from approximate model size and a device RAM heuristic so concurrent residency stays within a configurable budget (targeting Apple Silicon ~24GB class machines).

#### Scenario: Tiny plus Gemma concurrency
- **WHEN** the planner evaluates Gemma 4 E2B (~2GB) and Qwen3 0.6B LiteRT (~0.6GB) on a 24GB-class heuristic
- **THEN** both MAY be scheduled concurrently without exceeding the configured memory budget

### Requirement: CI does not require WebGPU inference
Automated CI MUST validate scorers and report shaping with fixtures; it MUST NOT require real WebGPU model loads.

#### Scenario: Unit scorer fixtures
- **WHEN** unit tests run in CI
- **THEN** branding/honesty scorers are exercised with fixture strings without loading a model
