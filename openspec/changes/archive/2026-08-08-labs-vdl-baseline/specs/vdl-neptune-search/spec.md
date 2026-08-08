## Purpose

Hybrid in-browser docs search that warms the semantic path early so Enter-triggered AI search feels responsive.

## ADDED Requirements

### Requirement: Semantic preload on mount
When the Neptune search UI mounts, the system MUST start preloading the semantic search path (embedding model / transformers stack) in the background without blocking the fuzzy search path.

#### Scenario: Mount starts semantic warmup
- **WHEN** `VdlNeptuneSearchUI` or the headless Neptune UI mounts successfully
- **THEN** semantic preload begins without requiring the user to press Enter first

#### Scenario: Fuzzy remains available during preload
- **WHEN** semantic preload is still in progress
- **THEN** the user can still use fuzzy / instant search results
