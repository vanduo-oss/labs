#!/usr/bin/env node
/**
 * Headed Chromium runner for vdl-model-eval.
 *
 * Usage:
 *   pnpm model-eval
 *   pnpm model-eval -- --models gemma-4-E2B-it-web,qwen3-0.6B-litert
 *   MODEL_EVAL_BASE_URL=http://localhost:3000 pnpm model-eval
 *
 * Expects Vite (`pnpm dev`) serving the repo, or set MODEL_EVAL_BASE_URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data/model-eval-reports/latest');
const PROFILE = path.resolve(ROOT, '.models/.model-eval-profile');

const args = process.argv.slice(2);
const modelsIdx = args.indexOf('--models');
const models =
  modelsIdx >= 0
    ? args[modelsIdx + 1]
    : process.env.MODEL_EVAL_MODELS || 'gemma-4-E2B-it-web,qwen3-0.6B-litert';

const base = (process.env.MODEL_EVAL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const timeoutMs = Number(process.env.MODEL_EVAL_TIMEOUT_MS || 45 * 60 * 1000);
const url = `${base}/demo/model-eval-harness.html?autorun=1&models=${encodeURIComponent(models)}`;

fs.mkdirSync(PROFILE, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('[model-eval] opening', url);

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: process.env.MODEL_EVAL_HEADLESS === '1',
  channel: process.env.MODEL_EVAL_CHANNEL || 'chrome',
  // Local WebGPU/model eval only (isolated PROFILE). --disable-web-security
  // relaxes CORS for cross-origin model asset fetches — not for production web.
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--disable-web-security'],
  viewport: { width: 1200, height: 900 },
});

const page = context.pages()[0] || (await context.newPage());
page.on('console', (msg) => {
  console.log(`[browser:${msg.type()}]`, msg.text());
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForFunction(() => window.__VDL_MODEL_EVAL_DONE__ === true, null, {
  timeout: timeoutMs,
});

const payload = await page.evaluate(() => ({
  report: window.__VDL_MODEL_EVAL_REPORT__ || null,
  html: window.__VDL_MODEL_EVAL_HTML__ || '',
  error: window.__VDL_MODEL_EVAL_ERROR__ || null,
}));

await context.close();

if (payload.error || !payload.report) {
  console.error('[model-eval] failed:', payload.error || 'missing report');
  process.exitCode = 1;
  process.exit();
}

const reportPath = path.join(OUT_DIR, 'report.json');
const htmlPath = path.join(OUT_DIR, 'index.html');
fs.writeFileSync(reportPath, `${JSON.stringify(payload.report, null, 2)}\n`);
fs.writeFileSync(htmlPath, payload.html || '<!DOCTYPE html><title>empty</title>');

console.log('[model-eval] wrote', path.relative(ROOT, reportPath));
console.log('[model-eval] wrote', path.relative(ROOT, htmlPath));

const rates = payload.report.summary?.passRates || {};
for (const [id, rate] of Object.entries(rates)) {
  console.log(`  ${id}: ${rate == null ? 'n/a' : `${Math.round(rate * 100)}%`}`);
}
