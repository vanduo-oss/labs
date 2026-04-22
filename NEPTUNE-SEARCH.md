# vd-neptune-search — In-Browser Hybrid Search

Zero-dependency, client-side hybrid search engine for the Vanduo documentation site. Combines instant fuzzy text matching with semantic vector search — entirely in the browser, no server API or LLM calls.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          User Types Query                                │
│                      "how do I style a glass card?"                      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌───────────────────────────┐   ┌─────────────────────────────────────┐
│  LAYER 1: Fuse.js         │   │  LAYER 2: Transformers.js           │
│  (triggers on keystroke)  │   │  (triggers on Enter / submit)       │
│                           │   │                                     │
│  • Lazy-loads on first    │   │  • Lazy-loads vectors.json + model  │
│    keystroke              │   │    on first submit (~23MB once)     │
│  • Fuzzy match across:    │   │  • Embeds query with MiniLM-L6-v2   │
│    title (2.5), headings  │   │  • Cosine similarity vs all docs    │
│    (2.0), keywords (2.5), │   │  • Returns top 10 (score > 0.30)    │
│    bodyText (1.0),        │   │  • Computation: <10ms for 500 docs  │
│    classes (1.5),         │   │                                     │
│    chunks.text (0.8)      │   │                                     │
│  • Threshold: 0.45        │   │                                     │
│  • Returns top 20         │   │                                     │
└──────────┬────────────────┘   └──────────────────┬──────────────────┘
           │                                        │
           └──────────────┬─────────────────────────┘
                          ▼
              ┌───────────────────────┐
              │   Merge & Rank        │
              │                       │
              │  1. Score-sort across │
              │     semantic + fuzzy  │
              │  2. Deduplicate docs  │
              │  3. Cap at maxResults │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │   Render Result Cards │
              │   [AI] or [Fuzzy]     │
              └───────────────────────┘
```

## Features

- **Zero runtime npm dependencies** — Fuse.js and Transformers.js load from CDN on demand
- **Dual interface** — headless `NeptuneSearch` API + `NeptuneSearchUI` DOM component
- **Graceful degradation** — falls back to fuzzy-only if semantic fails
- **Keyboard accessible** — full Arrow/Enter/Escape navigation, Cmd+K shortcut
- **ARIA compliant** — combobox pattern with activedescendant management
- **ES module** — single `.js` file, tree-shakeable exports

## Tuning Update (Apr 2026)

Hybrid search parameters were tuned against a curated 81-query benchmark set covering exact matches, synonyms, intent-style queries, and compound queries.

- Final benchmark: **MRR 0.9938**, **Top-1 98.8% (80/81)**, **Top-3 100%**, **Top-5 100%**
- Final defaults: `fuseThreshold=0.45`, `semanticThreshold=0.30`, `keywords` weight `2.5`
- Merge strategy: score-sorted interleave across semantic and fuzzy (deduped by `doc.id`)
- Embedding input in the indexer now includes: `title + category + keywords + headings + bodyText` (capped at 512 chars)
- Repro harness: `utils/neptune-benchmark.mjs` with query set in `utils/benchmark-queries.json`

## Quick Start

### Headless API

```javascript
import { NeptuneSearch } from './neptune-search.js';

const search = new NeptuneSearch();

// Fuzzy search (instant, no network beyond index fetch)
const fuzzy = await search.search('button', { mode: 'fuzzy' });
console.log(fuzzy.merged); // [{ doc, score, source: 'fuzzy' }]

// Hybrid search (fuzzy + semantic, Enter-key behavior)
const hybrid = await search.search('how do I make a button', { mode: 'hybrid' });
console.log(hybrid.merged); // [{ doc, score, source: 'semantic'|'fuzzy' }]
```

### UI Component

```javascript
import { NeptuneSearch, NeptuneSearchUI } from './neptune-search.js';

const search = new NeptuneSearch();
const ui = new NeptuneSearchUI({
  container: document.getElementById('search-mount'),
  search,
  onResultClick: (result) => {
    console.log('Selected:', result.doc.title);
    window.location.hash = result.doc.route;
  },
});

ui.mount();
```

## Architecture

### Two-Layer Hybrid Search

| Layer | Trigger | Engine | Data |
|-------|---------|--------|------|
| **Fuzzy** | Every keystroke (debounced 150ms) | Fuse.js v7 (CDN) | `data/search-index.json` |
| **Semantic** | Enter key / form submit | Transformers.js v3 + `Xenova/all-MiniLM-L6-v2` (CDN, ~23MB) | `data/vectors.json` |
| **Merge** | After both complete | Custom ranker | Score-sorted interleave across semantic + fuzzy, deduped, capped |

### Lazy Loading

Both layers initialize on first use:

- **Fuse.js** loads on the first keystroke (or first `initFuzzy()` call)
- **Transformers.js + model** loads on the first Enter key press (or first `initSemantic()` call)
- The model download (~23MB) happens once per browser session; subsequent uses hit the browser cache
- Init is promise-cached: concurrent callers share the same in-flight initialization

### Graceful Degradation

| Failure Mode | Behavior |
|--------------|----------|
| CDN blocked / network error (Fuse.js) | `search()` throws; caller handles |
| CDN blocked / network error (Transformers.js) | `_semanticFailed` flag set; `search()` falls back to fuzzy-only with `console.warn` |
| Model download fails mid-stream | Same as above; subsequent Enter presses use fuzzy-only |
| Query < 2 characters | Returns empty results immediately |
| Vector references missing doc ID | `console.warn` emitted; result silently skipped |
| Semantic init failed on this instance | `_semanticFailed` is set. Direct `await initSemantic()` / `await semanticSearch()` throw; `search()` catches failures and degrades (hybrid → fuzzy-only). Create a new `NeptuneSearch` to retry semantic loading |

## API Reference

### Types

```typescript
interface SearchOptions {
  mode?: 'fuzzy' | 'semantic' | 'hybrid';
}

interface SearchProgressData {
  stage: 'loading-model' | 'downloading' | 'ready' | 'error';
  message: string;
  progress?: { loaded: number; total: number };
}

interface SearchResults {
  query: string;
  mode: 'fuzzy' | 'semantic' | 'hybrid';
  fuzzy: FuseResult[];
  semantic: SemanticResult[];
  merged: MergedResult[];
}

interface FuseResult {
  item: Document;
  score: number; // 0 = perfect match, 1 = no match
}

interface SemanticResult {
  id: string;
  score: number; // cosine similarity, 0–1
}

interface MergedResult {
  doc: Document;
  score: number; // normalized relevance score
  source: 'semantic' | 'fuzzy';
}

interface Document {
  id: string;
  title: string;
  category: string;
  tab: string;
  route: string;
  icon: string;
  keywords: string[];
  headings: string[];
  bodyText: string;
  classes: string[];
  chunks: Chunk[];
}

interface Chunk {
  type: 'paragraph' | 'list-item' | 'class';
  text: string;
  heading: string;
}
```

### NeptuneSearch

#### Constructor

```typescript
new NeptuneSearch(options?: NeptuneSearchOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `indexUrl` | `string` | `'./data/search-index.json'` | URL to fetch the document corpus |
| `vectorsUrl` | `string` | `'./data/vectors.json'` | URL to fetch pre-computed embeddings |
| `fuseThreshold` | `number` | `0.45` | Fuse.js match threshold (0 = exact, 1 = match anything) |
| `semanticThreshold` | `number` | `0.30` | Minimum cosine similarity for semantic results |
| `maxResults` | `number` | `20` | Maximum results returned by `search()` and `mergeResults()` |
| `semanticBoost` | `number` | `1.0` | Multiplier applied to semantic scores before merge. Higher values push semantic results further ahead. |
| `modelName` | `string` | `'Xenova/all-MiniLM-L6-v2'` | HuggingFace model identifier for semantic search |

#### Methods

##### `initFuzzy(): Promise<void>`

Initializes the fuzzy search layer. Fetches `search-index.json`, loads Fuse.js from CDN, and builds the search index. Idempotent — concurrent callers share the same in-flight promise.

```javascript
await search.initFuzzy();
```

##### `fuzzySearch(query: string): FuseResult[]`

Performs a fuzzy search query. Returns immediately (no async). Requires `initFuzzy()` to have completed first. Returns empty array for queries shorter than 2 characters.

```javascript
const results = search.fuzzySearch('button');
// [{ item: { id: 'buttons', title: 'Buttons', ... }, score: 0.12 }]
```

##### `initSemantic(): Promise<void>`

Initializes the semantic search layer. Downloads Transformers.js and the embedding model from CDN, then loads `vectors.json`. Idempotent — concurrent callers share the same in-flight promise. Emits progress events via `onSemanticProgress()`. If a previous init attempt failed, throws until you create a new `NeptuneSearch` instance.

```javascript
await search.initSemantic();
```

##### `semanticSearch(query: string): Promise<SemanticResult[]>`

Performs a semantic search query. Embeds the query using MiniLM-L6-v2 and computes cosine similarity against all document vectors. Returns top 10 results above `semanticThreshold`. Awaits `initSemantic()` internally (no need to pre-call). Use `initSemantic()` + `onSemanticProgress()` only when you want eager loading or download progress before the first semantic query.

```javascript
const results = await search.semanticSearch('how do I style cards');
// [{ id: 'glass', score: 0.72 }, { id: 'buttons', score: 0.31 }]
```

##### `search(query: string, options?: SearchOptions): Promise<SearchResults>`

Unified search method. Always initializes fuzzy layer first. Returns raw results from both layers plus a merged/ranked list.

```javascript
const result = await search.search('glass card', { mode: 'hybrid' });
console.log(result.fuzzy.length);     // raw Fuse.js results
console.log(result.semantic.length);  // raw semantic results
console.log(result.merged.length);    // merged, deduped, ranked
```

**Modes:**

| Mode | Behavior |
|------|----------|
| `'fuzzy'` | Runs fuzzy search only. `merged` contains fuzzy results with inverted scores. |
| `'semantic'` | Runs semantic search only. `merged` contains semantic results. |
| `'hybrid'` | Runs both, merges via `mergeResults()`. Results are score-sorted across semantic and fuzzy. |

Throws `Error` if `mode` is not one of the three valid values.

##### `mergeResults(fuzzyResults: FuseResult[], semanticResults: SemanticResult[]): MergedResult[]`

Merges two result sets into a single ranked list. Algorithm:

1. Map semantic results through `_docMap`, apply `semanticBoost` multiplier
2. Map fuzzy results to normalized scores (`1 - Fuse score`)
3. Combine both lists, sort by score descending, and dedupe by document ID
4. Cap at `maxResults`

Throws `Error` if called before `initFuzzy()` has completed.

```javascript
const merged = search.mergeResults(fuzzyResults, semanticResults);
// [{ doc, score: 0.72, source: 'semantic' }, { doc, score: 0.88, source: 'fuzzy' }]
```

##### `getDocById(id: string): Document | null`

Looks up a document by ID using the internal `Map` index. Returns `null` if not found.

```javascript
const doc = search.getDocById('buttons');
```

##### `isSemanticReady(): boolean`

Returns `true` if the semantic layer has been fully initialized.

```javascript
if (search.isSemanticReady()) {
  console.log('Semantic search available');
}
```

##### `onSemanticProgress(callback: (data: SearchProgressData) => void): () => void`

Subscribes to semantic initialization progress events. Returns an unsubscribe function.

```javascript
const unsubscribe = search.onSemanticProgress((data) => {
  switch (data.stage) {
    case 'loading-model':
      console.log(data.message); // "Loading search model (one-time download)..."
      break;
    case 'downloading':
      console.log(data.message); // "Downloading model… 45%"
      break;
    case 'ready':
      console.log('Model ready');
      break;
    case 'error':
      console.error(data.message);
      break;
  }
});

// Later:
unsubscribe();
```

##### `NeptuneSearch.resetCDNCache(): void` (static)

Clears the module-level CDN module cache. After calling, the next `initFuzzy()` or `initSemantic()` will re-download libraries from CDN. Useful for testing or hot-reloading scenarios.

```javascript
NeptuneSearch.resetCDNCache();
```

### Named exports (testing / advanced)

The module also exports **`cosineSimilarity(a, b)`** and **`rankBySimilarity(queryVec, vectors, threshold?)`** for unit tests and custom tooling. Typical site integrations should use **`NeptuneSearch`** only.

### NeptuneSearchUI

#### Constructor

```typescript
new NeptuneSearchUI(options: NeptuneSearchUIOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `HTMLElement` | *(required)* | DOM element to mount the search UI into |
| `search` | `NeptuneSearch` | *(required)* | Headless search instance |
| `onResultClick` | `(result: MergedResult) => void` | `() => {}` | Callback fired when a result is clicked or selected via Enter |
| `placeholder` | `string` | `'Search docs…'` | Input placeholder text |
| `debounceMs` | `number` | `150` | Debounce delay for fuzzy search on keystroke |
| `showSemanticHint` | `boolean` | `true` | Show "Enter for AI search" hint in the input |
| `baseUrl` | `string` | `'https://vanduo.dev'` | Base URL for result card "Open docs" links |
| `emptyMessage` | `string` | `'No docs found. Try a different query or browse categories below.'` | Message shown when search returns no results |

#### Methods

##### `mount(): void`

Builds the DOM, binds event listeners, and injects default styles. Idempotent — calling `mount()` on an already-mounted instance is a no-op.

```javascript
ui.mount();
```

##### `destroy(): void`

Unbinds all event listeners, clears the container, and resets internal state. Idempotent — calling `destroy()` on an unmounted instance is a no-op.

```javascript
ui.destroy();
```

#### Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| `ArrowDown` | Dropdown open with results | Move selection down |
| `ArrowUp` | Dropdown open with results | Move selection up (or deselect) |
| `Enter` | Result selected | Trigger `onResultClick` for selected result |
| `Enter` | No selection, results visible | Run hybrid (semantic) search |
| `Enter` | No results, input focused | Run hybrid (semantic) search |
| `Escape` | Dropdown open | Close dropdown and blur input |
| `Cmd+K` / `Ctrl+K` | Anywhere on page | Focus search input |

#### ARIA Attributes

The UI implements the [WAI-ARIA Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

| Element | Attribute | Behavior |
|---------|-----------|----------|
| `<input>` | `role="combobox"` | Identifies as combobox |
| `<input>` | `aria-autocomplete="list"` | Suggests list-based completions |
| `<input>` | `aria-haspopup="listbox"` | Indicates popup list |
| `<input>` | `aria-expanded` | `true` when dropdown visible, `false` otherwise |
| `<input>` | `aria-controls="vd-neptune-results"` | Links to results listbox |
| `<input>` | `aria-activedescendant` | ID of currently highlighted result |
| Results container | `role="listbox"` | Identifies as listbox |
| Each result | `role="option"` | Identifies as selectable option |
| Each result | `aria-selected` | `true` for highlighted result |

## Data Files

### `data/search-index.json`

Pre-built document corpus for Fuse.js. Structure:

```json
{
  "documents": [
    {
      "id": "buttons",
      "title": "Buttons",
      "category": "Components",
      "tab": "components",
      "route": "docs/buttons",
      "icon": "ph-cursor-click",
      "keywords": ["button", "click", "submit"],
      "headings": ["Button Variants", "Button Sizes"],
      "bodyText": "Buttons are interactive elements that trigger actions...",
      "classes": [".vd-btn", ".vd-btn-primary"],
      "chunks": [
        { "type": "paragraph", "text": "Primary buttons stand out.", "heading": "Button Variants" }
      ]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique document identifier |
| `title` | `string` | Display title |
| `category` | `string` | Category grouping (e.g., "Components") |
| `tab` | `string` | Tab context ("pages", "components", etc.) |
| `route` | `string` | URL fragment for navigation |
| `icon` | `string` | Phosphor icon class (e.g., "ph-cursor-click") |
| `keywords` | `string[]` | Manual keyword tags |
| `headings` | `string[]` | Extracted h2–h4 headings from HTML |
| `bodyText` | `string` | Concatenated paragraph/list text (capped at 8000 chars) |
| `classes` | `string[]` | CSS class names (e.g., ".vd-btn-primary") |
| `chunks` | `Chunk[]` | Structured text chunks grouped by heading context |

### `data/vectors.json`

Pre-computed 384-dimensional embeddings for semantic search. Structure:

```json
{
  "model": "Xenova/all-MiniLM-L6-v2",
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "dimensions": 384,
  "documents": [
    {
      "id": "buttons",
      "embedding": [0.012, -0.045, 0.089, ...]
    }
  ]
}
```

Each embedding is pre-normalized, so cosine similarity is a simple dot product.

## Indexer

The indexer (`utils/neptune-indexer.mjs`) regenerates both data files from source HTML.

### Usage

```bash
pnpm index   # or: node utils/neptune-indexer.mjs
```

### What It Does

1. Reads `sections.json` manifest from `../docs/sections/`
2. For each HTML fragment:
   - Extracts headings (h2–h4), paragraphs, list items, CSS classes, alerts, demo titles
   - Builds structured chunks grouped by heading context
   - Concatenates body text (capped at 8000 chars)
3. Writes `data/search-index.json`
4. Loads `@xenova/transformers` with `Xenova/all-MiniLM-L6-v2` (quantized)
5. Generates embeddings for each document (text: `title. category. keywords. headings. bodyText`, capped at 512 chars)
6. Writes `data/vectors.json`
7. Validates consistency: every doc ID exists in vectors and vice versa. Exits with error on mismatch.

### Requirements

- Node.js
- `@xenova/transformers` (dev dependency)
- Source HTML files at `../docs/sections/`
- `sections.json` manifest

## Testing

### Running Tests

```bash
pnpm test          # Run all tests (headless Chromium)
pnpm test:ui       # Run with Playwright UI mode
pnpm test:headed   # Run in headed browser
pnpm report        # Show last test report
```

### Test Structure

| Test File | Type | Coverage |
|-----------|------|----------|
| `tests/unit/neptune-search.spec.ts` | Unit | Math helpers (cosine similarity), `rankBySimilarity`, `mergeResults` (capping, dedup, deterministic tie behavior, score-order merge, `semanticBoost`) |
| `tests/e2e/vd-neptune-search.spec.ts` | E2E | Fuzzy search, semantic search, hybrid merge, UI mounting, input debouncing, keyboard navigation (Arrow/Enter/Escape), Cmd+K focus, result click callback, mount/destroy/remount lifecycle, ARIA attributes |
| `tests/fixtures/neptune-harness.html` | Fixture | Test harness with mock data (3 docs, 384-dim vectors), mocked semantic extractor |

Tests run against a local HTTP server (Python `http.server` on port 8790) using Playwright with Chromium (desktop + mobile viewport).

## CDN & Caching

### Libraries

| Library | Primary URL | Fallback |
|---------|-------------|----------|
| Fuse.js v7 | `https://cdn.jsdelivr.net/npm/fuse.js@7/dist/fuse.basic.mjs` | `https://unpkg.com/fuse.js@7/dist/fuse.basic.mjs` |
| Transformers.js v3 (ESM `import`) | `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm` | `https://esm.sh/@huggingface/transformers@3` |

### Caching Behavior

- **Module-level singletons**: `_fuseModule` and `_transformersModule` are cached at module scope. Once loaded, all `NeptuneSearch` instances share the same library reference.
- **Browser cache**: The Transformers.js model (~23MB) is cached by the browser after first download. Subsequent sessions skip the download.
- **Reset**: Call `NeptuneSearch.resetCDNCache()` to clear module-level caches (useful for testing or hot-reloading).

## File Structure

```
labs/
├── neptune-search.js              # Core: NeptuneSearch + NeptuneSearchUI (~1000 lines)
├── NEPTUNE-SEARCH.md              # This documentation
├── package.json                   # Package: @vanduo-oss/labs-vd-neptune-search
├── data/
│   ├── search-index.json          # Pre-built Fuse.js document corpus
│   └── vectors.json               # Pre-computed 384-dim embeddings
├── utils/
│   └── neptune-indexer.mjs        # Build script to regenerate data files
├── demo/
│   └── neptune-demo.html          # Interactive demo with debug panel
├── tests/
│   ├── unit/
│   │   └── neptune-search.spec.ts # Unit tests
│   ├── e2e/
│   │   └── vd-neptune-search.spec.ts # E2E tests
│   └── fixtures/
│       └── neptune-harness.html   # Test harness
└── playwright.config.ts           # Playwright configuration
```

## Troubleshooting

### Common Issues

**`neptune-search.js` or `/data/*.json` 404 in the browser**
- Serve the **`labs/`** directory, not `labs/demo/`. The demo page imports `../neptune-search.js` and loads `../data/search-index.json`, which resolve to `/neptune-search.js` and `/data/...` on the server. From `labs/`, run `pnpm run demo:serve` and open `http://localhost:3000/demo/neptune-demo`.

**"Failed to load search index" error**
- Verify `indexUrl` points to a valid, accessible JSON file
- Check that the JSON has a `documents` array at the top level

**"Semantic search failed" warning in console**
- CDN may be blocked by network policy or ad blocker
- Check browser DevTools Network tab for failed requests to jsDelivr / esm.sh under `@huggingface/transformers@3`, or failed dynamic module loads in the Console
- Search will fall back to fuzzy-only automatically

**Model download takes too long**
- First download is ~23MB; subsequent loads use browser cache
- Monitor progress via `onSemanticProgress()` callback
- No workaround — the model must download at least once

**Short queries return empty results**
- Queries shorter than 2 characters are rejected immediately (both fuzzy and semantic)
- This is intentional to prevent meaningless matches

**"Vector references missing doc id" warning**
- `vectors.json` contains an embedding for a doc ID not in `search-index.json`
- Re-run the indexer to regenerate both files in sync: `pnpm index`

**`mergeResults` throws "requires initFuzzy()"**
- `mergeResults()` was called before `initFuzzy()` completed
- Always call `search()` (which auto-initializes) rather than calling `mergeResults()` directly, or await `initFuzzy()` first

### Debug Tips

- From `labs/`, run `pnpm run demo:serve`, then open `/demo/neptune-demo.html` over HTTP to interactively test search with a debug panel showing raw fuzzy, semantic, and merged results
- Use `onSemanticProgress()` to monitor model download progress
- Call `await search.initSemantic()` early if you want the model ready before the first `semanticSearch()` (optional — `semanticSearch()` initializes the layer itself)

## License

MIT
