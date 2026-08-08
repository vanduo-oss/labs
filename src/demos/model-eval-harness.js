/**
 * Browser harness for vdl-model-eval.
 * Query: ?models=id1,id2&autorun=1
 */
import { AiChat, MODEL_OPTIONS, getModelOption } from '../../ai-chat.js';
import {
  scoreCase,
  summarizeModelResults,
  buildReportDocument,
  renderReportHtml,
  planConcurrency,
  VDL_MODEL_EVAL_VERSION,
} from '../../model-eval.js';
import suite from '../../utils/model-eval-suite.json';

const logEl = document.getElementById('log');
const params = new URLSearchParams(location.search);
const autorun = params.get('autorun') === '1';
const modelParam = params.get('models') || 'gemma-4-E2B-it-web,qwen3-0.6B-litert';

function log(line) {
  const text = typeof line === 'string' ? line : JSON.stringify(line, null, 2);
  console.log(text);
  if (logEl) {
    logEl.textContent += `${text}\n`;
  }
}

async function runModel(modelId, suite) {
  const option = getModelOption(modelId);
  if (!option) {
    return summarizeModelResults(
      { modelId, error: 'unknown model id' },
      [],
    );
  }

  const chat = new AiChat({ modelId });
  const caseResults = [];
  try {
    log(`[load] ${modelId}`);
    await chat.load();
    for (const testCase of suite.cases) {
      const t0 = performance.now();
      let reply = '';
      let error = null;
      try {
        reply = await chat.generate(testCase.prompt);
      } catch (err) {
        error = err?.message || String(err);
      }
      const latencyMs = performance.now() - t0;
      const scored = error
        ? { pass: false, reasons: [`generate error: ${error}`] }
        : scoreCase(testCase, reply);
      caseResults.push({
        id: testCase.id,
        category: testCase.category,
        pass: scored.pass,
        reasons: scored.reasons,
        latencyMs,
        excerpt: String(reply || error || '').slice(0, 600),
      });
      log(`[case] ${modelId} ${testCase.id} ${scored.pass ? 'PASS' : 'FAIL'}`);
      // Fresh conversation context between cases
      if (typeof chat.reset === 'function') {
        await chat.reset();
      } else {
        chat.messages = [];
      }
    }
  } catch (err) {
    return summarizeModelResults(
      {
        modelId,
        family: option.family,
        backend: option.backend,
        litertKind: option.litertKind || null,
        label: option.label,
        error: err?.message || String(err),
      },
      caseResults,
    );
  } finally {
    try {
      await chat.dispose();
    } catch {
      /* ignore */
    }
  }

  return summarizeModelResults(
    {
      modelId,
      family: option.family,
      backend: option.backend,
      litertKind: option.litertKind || null,
      label: option.label,
    },
    caseResults,
  );
}

async function runSuite() {
  const startedAt = new Date().toISOString();
  const modelIds = modelParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const models = modelIds.map((id) => {
    const opt = getModelOption(id) || MODEL_OPTIONS.find((m) => m.id === id);
    return { id, approxBytes: opt?.approxBytes || 2 * 1024 ** 3 };
  });
  // Serial by default for WebGPU stability (two LiteRT engines contend for GPU).
  // Opt into parallel waves with ?parallel=1 when comparing tiny peers only.
  const parallel = params.get('parallel') === '1';
  const concurrency = parallel
    ? planConcurrency(models, { deviceMemoryGb: 24 })
    : {
        deviceMemoryGb: 24,
        budgetBytes: 24 * 1024 ** 3 * 0.45,
        budgetGb: 10.8,
        maxConcurrent: 1,
        waves: modelIds.map((id) => [id]),
      };
  log(`[plan] parallel=${parallel} waves=${JSON.stringify(concurrency.waves)}`);

  const modelResults = [];
  for (const wave of concurrency.waves) {
    const batch = await Promise.all(wave.map((id) => runModel(id, suite)));
    modelResults.push(...batch);
  }

  const report = buildReportDocument({
    suiteName: suite.name,
    suiteVersion: suite.version,
    modelResults,
    startedAt,
    finishedAt: new Date().toISOString(),
    concurrency,
  });
  const html = renderReportHtml(report);

  window.__VDL_MODEL_EVAL_VERSION__ = VDL_MODEL_EVAL_VERSION;
  window.__VDL_MODEL_EVAL_REPORT__ = report;
  window.__VDL_MODEL_EVAL_HTML__ = html;
  window.__VDL_MODEL_EVAL_DONE__ = true;
  log('[done] report ready');
  return report;
}

window.__VDL_MODEL_EVAL_RUN__ = runSuite;

if (autorun) {
  runSuite().catch((err) => {
    log(`[fatal] ${err?.message || err}`);
    window.__VDL_MODEL_EVAL_ERROR__ = err?.message || String(err);
    window.__VDL_MODEL_EVAL_DONE__ = true;
  });
} else {
  log('Set ?autorun=1&models=… to run, or call window.__VDL_MODEL_EVAL_RUN__()');
}
