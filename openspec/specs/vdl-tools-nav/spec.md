# vdl-tools-nav Specification

## Purpose
Documents that Labs model-eval tooling lives in-repo (CLI, harness, docs, report UI components) and is **not** exposed as a top-level Tools route on the live Labs SPA. Interactive Demos and Widgets remain the public surface; alpha helpers stay local.

## Requirements
### Requirement: Live SPA does not expose a Tools route
The Labs site MUST NOT expose a top-level Tools nav item or `#tools` panel. Hash `#tools` / `#tools/*` MUST fall through like other unknown routes (home).

#### Scenario: Tools hash is not a live route
- **WHEN** a user opens `#tools` or `#tools/model-eval` on the Labs SPA
- **THEN** the site does not show a Tools panel and treats the hash as an unknown route (home)

#### Scenario: Site dock omits Tools
- **WHEN** a user views the Labs site dock
- **THEN** Home, Widgets, Demos, and About are listed (no Tools link)

### Requirement: Model Eval is not an Interactive Demo card
Model Eval MUST NOT appear in the Interactive Demos card grid (`DEMO_SLUGS`).

#### Scenario: Demos grid excludes model-eval
- **WHEN** a user views `#demos`
- **THEN** Model Eval is not listed among Interactive Demo cards

### Requirement: In-repo Model Eval capability remains available locally
Labs MUST keep model-eval as an in-repo capability: CLI (`pnpm model-eval`), standalone harness (`demo/model-eval-harness.html`), docs (`doc/vdl-model-eval.md`), and UI components that MAY use `@vanduo-oss/vd3` and `@vanduo-oss/vd3-charts` — without requiring a live Tools page.

#### Scenario: Local harness and CLI remain
- **WHEN** a developer runs local Labs tooling
- **THEN** they can use `pnpm model-eval` and/or open `demo/model-eval-harness.html` without a public Tools route

#### Scenario: Charts render from published report (local UI)
- **WHEN** a published eval report JSON is available and the Model Eval UI is opened locally
- **THEN** the UI can display pass-rate or latency charts using vd3-charts components
