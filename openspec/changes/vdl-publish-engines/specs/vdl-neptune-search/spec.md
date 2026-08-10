# vdl-neptune-search Specification (delta)

## Modified Requirements

### Requirement: Corpus-agnostic index loading

NeptuneSearch MUST load any payload that passes search-index / vector guardrails validation, not only vd3-docs routes.

#### Scenario: Alternate curriculum-shaped corpus

- **GIVEN** a fixture index with lesson-shaped documents
- **WHEN** fuzzy search runs against that index
- **THEN** matching documents are returned without requiring vd3-docs base URLs
