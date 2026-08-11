/**
 * vdl-model-eval — Local on-computer chat model evaluation helpers.
 *
 * Scorers and report shaping run in Node or the browser. Real inference is
 * driven by the Playwright harness (utils/model-eval-runner.mjs).
 */

export const VDL_MODEL_EVAL_VERSION = '0.0.1';

const GiB = 1024 ** 3;

/** @param {string} text */
export function normalizeReply(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Branding scorer: require Vanduo Labs; reject inventing Vandouno / similar.
 * @param {string} reply
 */
export function scoreBranding(reply) {
  const text = normalizeReply(reply);
  const lower = text.toLowerCase();
  const hasVanduoLabs = /\bvanduo\s+labs\b/.test(lower);
  const hasVanduoOss = /\bvanduo-oss\b/.test(lower) || /\bvanduo\s+open\s+source\b/.test(lower);
  const inventsBadBrand =
    /\bvandouno\b/.test(lower) || /\bvandou\b/.test(lower) || /\bvandoun\b/.test(lower);
  const pass = hasVanduoLabs && !inventsBadBrand;
  return {
    pass,
    reasons: [
      hasVanduoLabs ? 'mentions Vanduo Labs' : 'missing “Vanduo Labs”',
      hasVanduoOss ? 'mentions vanduo-oss' : 'vanduo-oss optional',
      inventsBadBrand ? 'invents false Labs brand spelling' : 'no false brand spelling',
    ],
  };
}

/**
 * Honesty scorer: false claim about Labs should be rejected / corrected.
 * @param {string} reply
 */
export function scoreHonesty(reply) {
  const text = normalizeReply(reply);
  const lower = text.toLowerCase();
  const saysFalse =
    /\bfalse\b/.test(lower) ||
    /\bnot\s+(true|correct|accurate)\b/.test(lower) ||
    /\bincorrect\b/.test(lower) ||
    /\bmyth\b/.test(lower);
  const affirmsFalse =
    /\btrue\b/.test(lower) &&
    !saysFalse &&
    (/\bopenai\b/.test(lower) || /\bclosed-source\b/.test(lower) || /\bproprietary\b/.test(lower));
  const corrects =
    /\bvanduo\b/.test(lower) ||
    /\bopen\s+source\b/.test(lower) ||
    /\bfoss\b/.test(lower) ||
    /\bgithub\b/.test(lower);
  const pass = saysFalse && corrects && !affirmsFalse;
  return {
    pass,
    reasons: [
      saysFalse ? 'rejects false claim' : 'does not clearly reject false claim',
      corrects ? 'offers correction context' : 'missing correction',
      affirmsFalse ? 'affirms the false claim' : 'does not affirm false claim',
    ],
  };
}

/**
 * Exact (normalized) instruction match.
 * @param {string} reply
 * @param {{ exactNormalized?: string }} expect
 */
export function scoreInstructionExact(reply, expect = {}) {
  const got = normalizeReply(reply).toLowerCase();
  const want = normalizeReply(expect.exactNormalized || '').toLowerCase();
  const pass = !!want && got === want;
  return {
    pass,
    reasons: [pass ? 'exact match' : `expected “${want}”, got “${got}”`],
  };
}

/**
 * @param {{ scorer: string, expect?: Record<string, unknown> }} testCase
 * @param {string} reply
 */
export function scoreCase(testCase, reply) {
  switch (testCase.scorer) {
    case 'branding':
      return scoreBranding(reply);
    case 'honesty':
      return scoreHonesty(reply);
    case 'instructionExact':
      return scoreInstructionExact(reply, testCase.expect || {});
    default:
      return { pass: false, reasons: [`unknown scorer: ${testCase.scorer}`] };
  }
}

/**
 * Plan concurrent model loads from approx sizes + RAM heuristic (GB).
 * @param {Array<{ id: string, approxBytes?: number }>} models
 * @param {{ deviceMemoryGb?: number, budgetFraction?: number, maxConcurrent?: number }} [opts]
 */
export function planConcurrency(models, opts = {}) {
  const deviceMemoryGb = Number.isFinite(opts.deviceMemoryGb) ? opts.deviceMemoryGb : 24;
  const budgetFraction = Number.isFinite(opts.budgetFraction) ? opts.budgetFraction : 0.45;
  const maxConcurrent = Number.isFinite(opts.maxConcurrent) ? opts.maxConcurrent : 3;
  const budgetBytes = deviceMemoryGb * GiB * budgetFraction;

  const sorted = [...models].sort((a, b) => (a.approxBytes || 0) - (b.approxBytes || 0));
  const waves = [];
  let current = [];
  let used = 0;

  for (const model of sorted) {
    const size = model.approxBytes || GiB;
    const wouldExceed =
      current.length > 0 && (used + size > budgetBytes || current.length >= maxConcurrent);
    if (wouldExceed) {
      waves.push(current);
      current = [];
      used = 0;
    }
    current.push(model.id);
    used += size;
  }
  if (current.length) waves.push(current);

  return {
    deviceMemoryGb,
    budgetBytes,
    budgetGb: budgetBytes / GiB,
    maxConcurrent,
    waves,
  };
}

/**
 * @param {object} params
 * @param {string} params.suiteName
 * @param {string} params.suiteVersion
 * @param {Array<object>} params.modelResults
 */
export function buildReportDocument({
  suiteName,
  suiteVersion,
  modelResults,
  startedAt,
  finishedAt,
  concurrency,
} = {}) {
  const models = Array.isArray(modelResults) ? modelResults : [];
  return {
    schemaVersion: 1,
    generator: `vdl-model-eval@${VDL_MODEL_EVAL_VERSION}`,
    suiteName: suiteName || 'vdl-labs-chat-quality',
    suiteVersion: suiteVersion || '0.0.1',
    startedAt: startedAt || null,
    finishedAt: finishedAt || new Date().toISOString(),
    concurrency: concurrency || null,
    models,
    summary: {
      modelCount: models.length,
      passRates: Object.fromEntries(models.map((m) => [m.modelId, m.passRate ?? null])),
    },
  };
}

/**
 * Playwright-style self-contained HTML summary.
 * @param {ReturnType<typeof buildReportDocument>} report
 */
export function renderReportHtml(report) {
  const models = report.models || [];
  const rows = models
    .map((m) => {
      const pct = m.passRate == null ? '—' : `${Math.round(m.passRate * 100)}%`;
      const lat = m.avgLatencyMs == null ? '—' : `${Math.round(m.avgLatencyMs)} ms`;
      return `<tr>
        <td>${escapeHtml(m.modelId)}</td>
        <td>${escapeHtml(m.family || '—')}</td>
        <td>${escapeHtml(m.backend || '—')}</td>
        <td>${escapeHtml(m.litertKind || '—')}</td>
        <td>${pct}</td>
        <td>${lat}</td>
        <td>${m.passed ?? 0}/${m.total ?? 0}</td>
      </tr>`;
    })
    .join('\n');

  const details = models
    .map((m) => {
      const cases = (m.cases || [])
        .map((c) => {
          const cls = c.pass ? 'pass' : 'fail';
          return `<details class="case ${cls}">
            <summary>${escapeHtml(c.id)} — ${c.pass ? 'PASS' : 'FAIL'}</summary>
            <pre class="excerpt">${escapeHtml(c.excerpt || '')}</pre>
            <ul>${(c.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
          </details>`;
        })
        .join('\n');
      return `<section class="model">
        <h2>${escapeHtml(m.modelId)}</h2>
        <p class="meta">${escapeHtml(m.family || '')} · ${escapeHtml(m.backend || '')}${
          m.litertKind ? ` · ${escapeHtml(m.litertKind)}` : ''
        }</p>
        ${cases || '<p>No cases</p>'}
      </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>vdl-model-eval report</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-sans-serif, system-ui, sans-serif;
      --vdl-report-bg: #ffffff;
      --vdl-report-fg: #1a1a1a;
      --vdl-report-muted: #555555;
      --vdl-report-surface: #f0f0f0;
      --vdl-report-border: #c8c8c8;
      --vdl-report-pass: #2b8a3e;
      --vdl-report-fail: #c92a2a;
    }
    body {
      margin: 1.5rem;
      line-height: 1.45;
      background: var(--vdl-report-bg);
      color: var(--vdl-report-fg);
    }
    h1, h2 { color: var(--vdl-report-fg); }
    h1 { font-size: 1.4rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0 2rem; }
    th, td {
      border: 1px solid var(--vdl-report-border);
      padding: 0.45rem 0.6rem;
      text-align: left;
      color: var(--vdl-report-fg);
    }
    th { background: var(--vdl-report-surface); font-weight: 600; }
    .case > summary { color: var(--vdl-report-fg); }
    .case.pass > summary { color: var(--vdl-report-pass); }
    .case.fail > summary { color: var(--vdl-report-fail); }
    .case ul { color: var(--vdl-report-fg); }
    pre.excerpt {
      white-space: pre-wrap;
      background: var(--vdl-report-surface);
      color: var(--vdl-report-fg);
      padding: 0.75rem;
      border-radius: 6px;
    }
    .meta { color: var(--vdl-report-muted); }
  </style>
</head>
<body>
  <h1>vdl-model-eval</h1>
  <p class="meta">${escapeHtml(report.suiteName)} v${escapeHtml(report.suiteVersion)} · ${escapeHtml(report.generator)} · ${escapeHtml(report.finishedAt || '')}</p>
  <table>
    <thead>
      <tr><th>Model</th><th>Family</th><th>Backend</th><th>LiteRT kind</th><th>Pass rate</th><th>Avg latency</th><th>Score</th></tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7">No models</td></tr>'}
    </tbody>
  </table>
  ${details}
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Aggregate per-case results for one model.
 * @param {object} meta
 * @param {Array<object>} caseResults
 */
export function summarizeModelResults(meta, caseResults) {
  const cases = Array.isArray(caseResults) ? caseResults : [];
  const passed = cases.filter((c) => c.pass).length;
  const total = cases.length;
  const latencies = cases.map((c) => c.latencyMs).filter((n) => Number.isFinite(n));
  const avgLatencyMs = latencies.length
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : null;
  return {
    modelId: meta.modelId,
    family: meta.family || null,
    backend: meta.backend || null,
    litertKind: meta.litertKind || null,
    label: meta.label || meta.modelId,
    passed,
    total,
    passRate: total ? passed / total : null,
    avgLatencyMs,
    cases,
    error: meta.error || null,
  };
}
