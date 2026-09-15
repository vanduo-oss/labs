#!/usr/bin/env node
/**
 * Draw-harness evaluation runner (local WebGPU inference).
 *
 * Usage:
 *   pnpm model-eval:draw
 *   pnpm model-eval:draw -- --models gemma-4-E2B-it-web,gemma-4-E4B-it-web
 *   AI_DRAW_FAST_PLANNER=1 pnpm model-eval:draw -- --models gemma-4-E2B-it-web
 *
 * Spawns its own Vite server (or reuses MODEL_EVAL_DRAW_BASE_URL), drives
 * tests/fixtures/ai-draw-harness.html per model, scores every case against
 * utils/model-eval-draw-suite.json, and writes JSON + markdown reports under
 * data/model-eval-reports/draw/.
 *
 * Gated to darwin/arm64 or RUN_AI_DRAW_INFERENCE=1 — CI must not download
 * models or require WebGPU (mirrors tests/local gating).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data/model-eval-reports/draw');
const HARNESS_PATH = '/tests/fixtures/ai-draw-harness.html';

function supportedPlatform() {
  if (process.env.RUN_AI_DRAW_INFERENCE === '1') return true;
  if (process.env.CI) return false;
  return process.platform === 'darwin' && process.arch === 'arm64';
}

const args = process.argv.slice(2);
const modelsIdx = args.indexOf('--models');
const models =
  (modelsIdx >= 0 ? args[modelsIdx + 1] : process.env.MODEL_EVAL_DRAW_MODELS) ||
  'gemma-4-E2B-it-web,gemma-4-E4B-it-web';
const modelIds = models
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const PORT = Number(process.env.MODEL_EVAL_DRAW_PORT || 8793);
const BASE = (process.env.MODEL_EVAL_DRAW_BASE_URL || `http://127.0.0.1:${PORT}`).replace(
  /\/$/,
  '',
);
const CASE_TIMEOUT_MS = Number(process.env.MODEL_EVAL_DRAW_CASE_TIMEOUT_MS || 5 * 60 * 1000);
const LOAD_TIMEOUT_MS = Number(process.env.MODEL_EVAL_DRAW_LOAD_TIMEOUT_MS || 20 * 60 * 1000);
const FAST_PLANNER = process.env.AI_DRAW_FAST_PLANNER === '1';

if (!supportedPlatform()) {
  console.error(
    '[model-eval:draw] skipped: requires darwin/arm64 or RUN_AI_DRAW_INFERENCE=1 (WebGPU inference).',
  );
  process.exit(0);
}

const suite = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'utils/model-eval-draw-suite.json'), 'utf8'),
);

/** @param {string} url @param {number} timeoutMs */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server did not start at ${url}`);
}

/** @param {Promise<any>} p @param {number} ms @param {string} label */
function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} after ${ms}ms`)), ms)),
  ]);
}

let viteProc = null;
try {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('not-serving');
  console.log('[model-eval:draw] reusing server at', BASE);
} catch {
  console.log('[model-eval:draw] spawning vite at', BASE);
  viteProc = spawn(
    'pnpm',
    ['exec', 'vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  viteProc.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
  await waitForServer(BASE, 60_000);
}

const browser = await chromium.launch({
  headless: process.env.AI_DRAW_HEADED !== '1',
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (err) => console.error('[browser:error]', err));

/**
 * Score one case result against its expectation.
 * @param {Record<string, any>} r harness result
 * @param {Record<string, any>} expect suite expectation
 */
function scoreCase(r, expect) {
  /** @type {Array<{ check: string, ok: boolean }>} */
  const checks = [];
  const add = (check, ok) => checks.push({ check, ok: Boolean(ok) });
  const snap = r.snapshot || {};
  const rects = (r.shapes || []).filter((s) => s.type === 'rectangle');

  if (expect.simplified != null) add('simplified', r.simplified === expect.simplified);
  if (expect.kind != null) add('kind', r.kind === expect.kind);
  if (expect.planSource != null) add('planSource', r.planSource === expect.planSource);
  if (expect.planSourceIn) add('planSource', expect.planSourceIn.includes(r.planSource));
  if (expect.minShapes != null) add('minShapes', (r.shapes || []).length >= expect.minShapes);
  if (expect.distinctRectY != null) {
    add(
      'distinctRectY',
      new Set(rects.map((s) => Math.round(Number(s.y)))).size >= expect.distinctRectY,
    );
  }
  if (expect.hasAxes != null) add('hasAxes', snap.hasAxes === expect.hasAxes);
  if (expect.looksLikeStar != null)
    add('looksLikeStar', snap.looksLikeStar === expect.looksLikeStar);
  if (expect.looksLikeFace != null)
    add('looksLikeFace', snap.looksLikeFace === expect.looksLikeFace);
  return { passed: checks.every((c) => c.ok), checks };
}

/** @type {Record<string, any>} */
const report = {
  version: suite.version,
  suite: suite.name,
  generatedAt: new Date().toISOString(),
  host: { platform: `${process.platform}/${process.arch}`, fastPlanner: FAST_PLANNER },
  models: {},
};

for (const modelId of modelIds) {
  console.log(`[model-eval:draw] loading ${modelId} …`);
  const flagParam = FAST_PLANNER ? '?fastPlanner=1' : '';
  await page.goto(`${BASE}${HARNESS_PATH}${flagParam}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__vdlAiDrawReady === true, null, { timeout: 30_000 });
  if (!(await page.evaluate(() => Boolean(navigator.gpu)))) {
    throw new Error('WebGPU required for draw model-eval');
  }
  if (FAST_PLANNER) {
    await page.evaluate(() => window.localStorage.setItem('vdl-ai-draw-tiny-planner', '1'));
  }
  await withTimeout(
    page.evaluate(async (id) => window.__vdlAiDrawLoad(id), modelId),
    LOAD_TIMEOUT_MS,
    `model load ${modelId}`,
  );

  /** @type {Array<Record<string, any>>} */
  const results = [];
  for (const testCase of suite.cases) {
    await page.evaluate(async () => void (await window.__vdlAiDrawClear()));
    const started = Date.now();
    try {
      const raw = await withTimeout(
        page.evaluate(async (prompt) => {
          const r = await window.__vdlAiDrawPrompt(prompt);
          return {
            simplified: r.simplified,
            kind: r.kind,
            planSource: r.planSource,
            planValid: Boolean(r.plan && ((r.plan.steps || []).length > 0 || r.plan.clear)),
            shapes: (r.shapes || []).map((s) => ({
              type: s.type,
              y: s.y,
              fill: s.fill,
              pointCount: s.pointCount ?? s.points?.length ?? 0,
            })),
            snapshot: r.snapshot,
            reply: r.reply,
            toolError: r.toolError || null,
          };
        }, testCase.prompt),
        CASE_TIMEOUT_MS,
        `case ${testCase.id}`,
      );
      const wallMs = Date.now() - started;
      const { passed, checks } = scoreCase(raw, testCase.expect || {});
      results.push({
        id: testCase.id,
        category: testCase.category,
        wallMs,
        passed,
        checks,
        ...raw,
      });
      console.log(
        `  ${passed ? 'PASS' : 'FAIL'} ${testCase.id} (${(wallMs / 1000).toFixed(1)}s, ${raw.shapes.length} shapes)`,
      );
    } catch (err) {
      results.push({
        id: testCase.id,
        category: testCase.category,
        wallMs: Date.now() - started,
        passed: false,
        error: err?.message || String(err),
      });
      console.error(`  ERROR ${testCase.id}: ${err?.message || err}`);
    }
  }

  const llmCases = results.filter((r) => ['unknown-scene'].includes(r.category));
  const passedCount = results.filter((r) => r.passed).length;
  const med = (arr) =>
    arr.length ? arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)] : null;
  report.models[modelId] = {
    passRate: passedCount / results.length,
    passed: passedCount,
    total: results.length,
    planValidityRate: llmCases.length
      ? llmCases.filter((r) => r.planValid).length / llmCases.length
      : null,
    medianWallMsByCategory: Object.fromEntries(
      [...new Set(results.map((r) => r.category))].map((cat) => [
        cat,
        med(results.filter((r) => r.category === cat).map((r) => r.wallMs)),
      ]),
    ),
    cases: results,
  };
}

await browser.close();
if (viteProc) viteProc.kill();

fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const jsonPath = path.join(OUT_DIR, `draw-${stamp}.json`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const mdLines = [
  `# vdl-ai-draw eval — ${report.generatedAt}`,
  '',
  `Host: \`${report.host.platform}\`${FAST_PLANNER ? ' · fast planner ON' : ''}`,
  '',
  '| model | pass | plan validity | median scene ms |',
  '| ----- | ---- | ------------- | --------------- |',
];
for (const [id, m] of Object.entries(report.models)) {
  const sceneMs = m.medianWallMsByCategory['unknown-scene'];
  mdLines.push(
    `| ${id} | ${m.passed}/${m.total} (${Math.round(m.passRate * 100)}%) | ${
      m.planValidityRate == null ? 'n/a' : `${Math.round(m.planValidityRate * 100)}%`
    } | ${sceneMs == null ? 'n/a' : `${(sceneMs / 1000).toFixed(1)}s`} |`,
  );
}
mdLines.push('', `JSON: ${path.relative(ROOT, jsonPath)}`, '');
fs.writeFileSync(path.join(OUT_DIR, 'latest.md'), mdLines.join('\n'));

console.log('[model-eval:draw] wrote', path.relative(ROOT, jsonPath));
console.log(
  '[model-eval:draw] wrote',
  path.relative(ROOT, 'data/model-eval-reports/draw/latest.md'),
);
