# vdl-tools-nav Specification

## Purpose
Adds a Labs site Tools section for on-computer helper tools, separate from Interactive Demos, starting with model evaluation documentation and published reports.
## Requirements
### Requirement: Tools route exists outside demos
The Labs site MUST expose a top-level Tools route that is not part of the Interactive Demos slug set.

#### Scenario: Navigate to tools
- **WHEN** a user opens `#tools`
- **THEN** the Tools panel is shown with vdl-model-eval as the single tool (report UI and docs) and Interactive Demos content is not the active panel

#### Scenario: Model eval tool deep link
- **WHEN** a user opens `#tools/model-eval`
- **THEN** the same Model Eval tool detail (docs and/or report UI) is shown

### Requirement: Model Eval is not an Interactive Demo card
Model Eval MUST NOT appear in the Interactive Demos card grid (`DEMO_SLUGS`).

#### Scenario: Demos grid excludes model-eval
- **WHEN** a user views `#demos`
- **THEN** Model Eval is not listed among Interactive Demo cards

### Requirement: Tools use vd3 and may use vd3-cbun charts
The Tools Model Eval UI MUST use `@vanduo-oss/vd3` components and MAY render charts via `@vanduo-oss/vd3-cbun` without renaming design-system APIs.

#### Scenario: Charts render from published report
- **WHEN** a published eval report JSON is available
- **THEN** the Tools Model Eval UI can display pass-rate or latency charts using vd3-cbun chart components

