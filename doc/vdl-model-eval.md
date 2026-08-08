# vdl-model-eval

**Version:** {{COMPONENT_VERSION}}

Local on-computer helper to evaluate in-browser chat models against a curated suite (branding, honesty, instruction-following), emit Playwright-style HTML/JSON reports, and publish results on the Labs **Tools** page.

This is **not** an Interactive Demo — it lives under `#tools/model-eval`.

## Quick start

```bash
pnpm models:fetch -- --model gemma-4-E2B-it-web
pnpm models:fetch -- --model qwen3-0.6B-litert
pnpm dev   # terminal A
pnpm model-eval -- --models gemma-4-E2B-it-web,qwen3-0.6B-litert   # terminal B
```

Writes:

- `data/model-eval-reports/latest/report.json`
- `data/model-eval-reports/latest/index.html`

## Headless API

```js
import {
  scoreBranding,
  scoreHonesty,
  planConcurrency,
  buildReportDocument,
  renderReportHtml,
} from './model-eval.js';
```

- **Scorers** run offline (unit-tested with fixtures).
- **Concurrency planner** schedules waves from `approxBytes` + RAM heuristic (default 24GB × 45%).
- **Harness** (`demo/model-eval-harness.html`) loads models via `AiChat` on WebGPU.

## Suite

See [`utils/model-eval-suite.json`](../utils/model-eval-suite.json). Cases include the known Tiny failure mode: inventing “Vandouno” fails branding.

## CI note

CI validates scorers only. Full WebGPU eval is local/manual (same constraint as Gemma smoke).
