## ADDED Requirements

### Requirement: HybridSearch engine comes from npm
The labs hybrid search demo MUST construct search via `HybridSearch` from `@vanduo-oss/vdl-hybrid-search` (not a local `neptune-search.js` / `NeptuneSearch` SoT). Search guardrails MUST be imported from `@vanduo-oss/vdl-hybrid-search/guardrails/search`.

#### Scenario: Vue demo uses HybridSearch
- **WHEN** the hybrid search Vue UI initializes without an injected engine
- **THEN** it constructs `HybridSearch` from the published package

#### Scenario: Search guardrails from package subpath
- **WHEN** the UI validates queries or sanitizes doc hrefs
- **THEN** it uses helpers from `@vanduo-oss/vdl-hybrid-search/guardrails/search`

## MODIFIED Requirements

### Requirement: Semantic preload on mount
When the hybrid search UI mounts, the system MUST start preloading the semantic search path (embedding model / transformers stack) in the background without blocking the fuzzy search path.

#### Scenario: Mount starts semantic warmup
- **WHEN** `VdlHybridSearchUI` mounts successfully
- **THEN** semantic preload begins without requiring the user to press Enter first

#### Scenario: Fuzzy remains available during preload
- **WHEN** semantic preload is still in progress
- **THEN** the user can still use fuzzy / instant search results

### Requirement: Debounced auto hybrid search
The hybrid search UI MUST run search automatically after the user pauses typing, without requiring Enter. While the semantic model is not ready, results MAY be fuzzy-only; once ready, searches MUST use hybrid mode. Enter MUST still submit hybrid search immediately (canceling any pending debounce).

#### Scenario: Typing pauses triggers search
- **WHEN** the user types a valid query and pauses for the debounce interval
- **THEN** search runs without requiring Enter

#### Scenario: Enter submits immediately
- **WHEN** the user presses Enter with no result selected
- **THEN** any pending debounce is canceled and hybrid search runs immediately

#### Scenario: Enrich when model becomes ready
- **WHEN** semantic preload completes and a valid query is still in the input
- **THEN** results are refreshed with hybrid search

### Requirement: Autofocus search on mount
When the hybrid search UI mounts, the system SHOULD focus the search input so the user can type immediately, unless focus is already in a modal or another text field.

#### Scenario: Safe autofocus
- **WHEN** the UI mounts and no modal or other text field holds focus
- **THEN** the search input receives focus
