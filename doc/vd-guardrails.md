# vd-guardrails

Canonical shared-service documentation for the public `guardrails/*` modules exported by Vanduo Labs.

This module family centralizes deterministic validation and safety composition used across:

- `vd-ai-chat`
- `vd-ai-draw`
- `vd-neptune-search`

## Purpose and Scope

`guardrails/*` exists to provide a single, reusable policy layer that works in both UI and headless code paths.

- **Deterministic validation**: reject malformed or unsafe inputs before expensive runtime work.
- **System-prompt guardrails**: compose explicit safety and behavior policies for LLM components.
- **Shared result/error contracts**: standardize allow/block outcomes and thrown error shape.

## Module Map

### `./guardrails/core.js`

Shared contracts and helpers used by both LLM and search guardrails:

- `normalizeText(value)`
- `allow(meta?)`
- `block({ code, message, matchedPatternIds?, meta? })`
- `toGuardrailError(result, fallbackMessage?)`

### `./guardrails/llm.js`

LLM policy surface used by `vd-ai-chat` and `vd-ai-draw`:

- `BASE_FOSS_GUARDRAILS_SYSTEM_PROMPT`
- `DEFAULT_LLM_GUARD_PATTERNS`
- `LLM_BLOCK_MESSAGE`
- `validateLlmInput(input)`
- `buildChatSystemPrompt(options?)`
- `buildDrawSystemPrompt(options)`
- `chatGuardrails`
- `drawGuardrails`

### `./guardrails/search.js`

Search-specific deterministic hardening used by `vd-neptune-search`:

- `normalizeSearchQuery(query, options?)`
- `validateSearchQuery(query, options?)`
- `validateSearchIndexDocument(doc)`
- `validateSearchIndexPayload(payload, options?)`
- `validateVectorPayload(payload, options?)`
- `safeDocHref(baseUrl, route)`
- `sanitizeIconClass(icon)`
- `searchGuardrails`

## Threat Model Split

Guardrails are intentionally split by runtime behavior and risk surface.

- **LLM guardrails (`./guardrails/llm.js`)**
  - Target instruction-following generators (`vd-ai-chat`, `vd-ai-draw`).
  - Combine deterministic input blocking (regex pattern matching, max length, empty checks) with system-prompt policy composition.
- **Search guardrails (`./guardrails/search.js`)**
  - Target retrieval/ranking workloads (`vd-neptune-search`).
  - Focus on deterministic query hygiene, payload/schema validation, finite-vector checks, and render-path sanitization.
  - Not framed as classic prompt-jailbreak defense, because semantic search is embedding extraction + ranking, not chat completion.

## API Reference

### Core helpers (`./guardrails/core.js`)

#### `normalizeText(value): string`

Normalizes whitespace to single spaces and trims boundaries.

#### `allow(meta?): GuardrailResult`

Returns `{ allowed: true }` plus optional metadata.

#### `block(params): GuardrailResult`

Returns a blocked result with canonical fields:

- `allowed: false`
- `code`
- `message`
- optional `matchedPatternIds`
- optional `meta`

#### `toGuardrailError(result, fallbackMessage?): GuardrailError`

Converts a blocked (or generic) result into a structured error.

Produced error shape:

- `name = 'GuardrailError'`
- `code` (from result code or `guardrail.blocked` fallback)
- `reason` (same text as message)
- `guardrail` (attached original `GuardrailResult`)

### LLM helpers (`./guardrails/llm.js`)

#### `DEFAULT_LLM_GUARD_PATTERNS`

Default deterministic block patterns for common prompt-injection/jailbreak classes:

- instruction override attempts
- system prompt extraction attempts
- role/persona rebinding
- delimiter breakout framing
- jailbreak framing patterns

#### `validateLlmInput(input): GuardrailResult`

Validates prompt text (`string` or options object) and returns allow/block result.

- Blocks empty input (`llm.input.empty`)
- Blocks over-length input (`llm.input.too_long`)
- Blocks matched guard patterns (`llm.input.blocked`)

#### `buildChatSystemPrompt(options?): string`

Returns `BASE_FOSS_GUARDRAILS_SYSTEM_PROMPT` and appends normalized `extraRules` when provided.

#### `buildDrawSystemPrompt(options): string`

Builds draw/canvas instruction policy (dimensions + output contract) and appends base FOSS safety policy.

#### `chatGuardrails` / `drawGuardrails`

Preset objects that bundle:

- `validateInput`
- `buildSystemPrompt`
- `patterns`

### Search helpers (`./guardrails/search.js`)

#### `normalizeSearchQuery(query, options?): string`

Normalizes and length-bounds query text.

#### `validateSearchQuery(query, options?): GuardrailResult`

Deterministically validates search query shape and quality.

- empty
- too short / too long
- pathological repeated-character sequence

#### `validateSearchIndexDocument(doc): GuardrailResult`

Validates one index document’s required fields and safe route/icon constraints.

#### `validateSearchIndexPayload(payload, options?): GuardrailResult`

Validates index payload shape, document count limits, per-document validity, and duplicate IDs.

#### `validateVectorPayload(payload, options?): GuardrailResult`

Validates vector payload shape, row count limits, embedding dimensions, and finite numeric values.

#### `safeDocHref(baseUrl, route): string`

Builds safe docs links. Falls back to `https://vanduo.dev` for unsafe base URLs and returns `#` for unsafe routes.

#### `sanitizeIconClass(icon): string`

Returns safe icon class, otherwise fallback `ph-file-text`.

#### `searchGuardrails`

Preset object bundling all search validation/sanitization helpers.

## Return Contracts and Error Behavior

### `GuardrailResult`

From `./guardrails/core.js` JSDoc:

```ts
interface GuardrailResult {
  allowed: boolean;
  code?: string;
  message?: string;
  matchedPatternIds?: string[];
  meta?: Record<string, unknown>;
}
```

### `GuardrailError`

Returned by `toGuardrailError()`:

```ts
type GuardrailError = Error & {
  code?: string;
  reason?: string;
  guardrail?: GuardrailResult;
};
```

## Usage Examples

### Headless LLM input validation before generation

```javascript
import { validateLlmInput } from './guardrails/llm.js';
import { toGuardrailError } from './guardrails/core.js';

const check = validateLlmInput({
  text: userPrompt,
  maxLength: 8000,
});

if (!check.allowed) {
  throw toGuardrailError(check);
}
```

### Custom system prompt building for chat and draw

```javascript
import { buildChatSystemPrompt, buildDrawSystemPrompt } from './guardrails/llm.js';

const chatPrompt = buildChatSystemPrompt({
  extraRules: 'Prefer concise bullet points.',
});

const drawPrompt = buildDrawSystemPrompt({
  width: 64,
  height: 64,
  extraRules: 'Favor geometric symmetry when possible.',
});
```

### Search index/vector validation at load time

```javascript
import { validateSearchIndexPayload, validateVectorPayload } from './guardrails/search.js';
import { toGuardrailError } from './guardrails/core.js';

const indexCheck = validateSearchIndexPayload(indexPayload);
if (!indexCheck.allowed) throw toGuardrailError(indexCheck);

const vectorCheck = validateVectorPayload(vectorPayload);
if (!vectorCheck.allowed) throw toGuardrailError(vectorCheck);
```

### Safe link creation for UI render paths

```javascript
import { safeDocHref, sanitizeIconClass } from './guardrails/search.js';

const href = safeDocHref('https://vanduo.dev', doc.route);
const icon = sanitizeIconClass(doc.icon);
```

## Compatibility Notes

`ai-chat.js` and `ai-draw.js` still export `InputGuardrail` for compatibility with existing integrations.

Preferred shared API for new code is `./guardrails/llm.js`, especially:

- `validateLlmInput()`
- `buildChatSystemPrompt()`
- `buildDrawSystemPrompt()`
