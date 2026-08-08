#!/usr/bin/env node
/**
 * Prefetch in-browser model artifacts for local Vite serving.
 *
 * Default: Gemma 4 E2B LiteRT web (~2.0GB) → .models/gemma-4-E2B-it-web/
 * Also: Qwen3 0.6B LiteRT, Ministral spike, legacy WebLLM/MLC packages.
 * Served in `pnpm dev` at /models/<id>/ (see vite.config.js). Never shipped in `pnpm build`.
 *
 * Usage:
 *   pnpm models:fetch
 *   pnpm models:fetch -- --model gemma-4-E2B-it-web
 *   pnpm models:fetch -- --model qwen3-0.6B-litert
 *   pnpm models:fetch -- --model ministral-3-3B-litert
 *   pnpm models:fetch -- --model gemma-4-E2B-it-q4f16_1-MLC
 *   pnpm models:fetch -- --dry-run
 *   pnpm models:fetch -- --force
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = path.join(ROOT, '.models');

const CATALOG = {
  'gemma-4-E2B-it-web': {
    kind: 'files',
    hfRepo: 'litert-community/gemma-4-E2B-it-litert-lm',
    approxBytes: 2.0e9,
    files: [
      { path: 'gemma-4-E2B-it-web.litertlm', outName: 'gemma-4-E2B-it-web.litertlm' },
    ],
  },
  'qwen3-0.6B-litert': {
    kind: 'files',
    hfRepo: 'litert-community/Qwen3-0.6B',
    approxBytes: 0.6e9,
    files: [
      { path: 'Qwen3-0.6B.litertlm', outName: 'Qwen3-0.6B.litertlm' },
    ],
  },
  'ministral-3-3B-litert': {
    kind: 'files',
    hfRepo: 'litert-community/Ministral-3-3B-Reasoning-2512',
    approxBytes: 2.2e9,
    files: [
      { path: 'model.litertlm', outName: 'model.litertlm' },
    ],
  },
  'gemma-4-E2B-it-q4f16_1-MLC': {
    kind: 'tree',
    hfRepo: 'welcoma/gemma-4-E2B-it-q4f16_1-MLC',
    approxBytes: 2.7e9,
    skipNames: new Set(['.gitattributes', 'README.md']),
  },
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const modelFlagIdx = args.indexOf('--model');
const modelId =
  modelFlagIdx >= 0 ? args[modelFlagIdx + 1] : 'gemma-4-E2B-it-web';

if (!CATALOG[modelId]) {
  console.error(`Unknown model "${modelId}". Known: ${Object.keys(CATALOG).join(', ')}`);
  process.exit(1);
}

const entry = CATALOG[modelId];
const outDir = path.join(MODELS_DIR, modelId);
const HF_API = `https://huggingface.co/api/models/${entry.hfRepo}/tree/main`;
const HF_RESOLVE = `https://huggingface.co/${entry.hfRepo}/resolve/main`;

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function listAllFiles(apiUrl) {
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`HF tree failed (${res.status}): ${apiUrl}`);
  const items = await res.json();
  const files = [];
  for (const item of items) {
    if (item.type === 'directory') {
      const nested = await listAllFiles(
        `https://huggingface.co/api/models/${entry.hfRepo}/tree/main/${item.path}`,
      );
      files.push(...nested);
    } else if (item.type === 'file') {
      const base = path.posix.basename(item.path);
      if (entry.skipNames?.has(base)) continue;
      files.push({
        path: item.path,
        size: item.lfs?.size || item.size || 0,
      });
    }
  }
  return files;
}

async function downloadFile(relPath, destRel, expectedSize) {
  const dest = path.join(outDir, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (!force && fs.existsSync(dest)) {
    const st = fs.statSync(dest);
    if (expectedSize > 0 && st.size === expectedSize) {
      return { skipped: true, bytes: st.size };
    }
    if (expectedSize <= 0 && st.size > 0) {
      return { skipped: true, bytes: st.size };
    }
  }

  if (dryRun) {
    return { skipped: false, bytes: expectedSize, dryRun: true };
  }

  const url = `${HF_RESOLVE}/${relPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  if (!res.body) throw new Error(`Empty body: ${url}`);

  const tmp = `${dest}.partial`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  const st = fs.statSync(tmp);
  if (expectedSize > 0 && st.size !== expectedSize) {
    fs.unlinkSync(tmp);
    throw new Error(`Size mismatch for ${relPath}: got ${st.size}, expected ${expectedSize}`);
  }
  fs.renameSync(tmp, dest);
  return { skipped: false, bytes: st.size };
}

async function main() {
  console.log(`[models:fetch] model=${modelId}`);
  console.log(`[models:fetch] repo=https://huggingface.co/${entry.hfRepo}`);
  console.log(`[models:fetch] out=${path.relative(ROOT, outDir)} (~${formatBytes(entry.approxBytes)})`);
  if (dryRun) console.log('[models:fetch] dry-run — no files written');

  let files;
  if (entry.kind === 'files') {
    // Resolve sizes from HF tree for the listed files.
    const tree = await listAllFiles(HF_API);
    const byPath = new Map(tree.map((f) => [f.path, f]));
    files = entry.files.map((f) => {
      const meta = byPath.get(f.path);
      return {
        path: f.path,
        outName: f.outName || f.path,
        size: meta?.size || 0,
      };
    });
  } else {
    files = (await listAllFiles(HF_API)).map((f) => ({ ...f, outName: f.path }));
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  const total = files.reduce((sum, f) => sum + (f.size || 0), 0);
  console.log(`[models:fetch] ${files.length} files, ${formatBytes(total)}`);

  fs.mkdirSync(outDir, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  let bytes = 0;

  for (const file of files) {
    process.stdout.write(`  ${file.path} (${formatBytes(file.size)}) … `);
    try {
      const result = await downloadFile(file.path, file.outName, file.size);
      if (result.dryRun) {
        console.log('would fetch');
      } else if (result.skipped) {
        skipped += 1;
        bytes += result.bytes;
        console.log('ok (cached)');
      } else {
        downloaded += 1;
        bytes += result.bytes;
        console.log('ok');
      }
    } catch (err) {
      console.log('FAIL');
      console.error(err.message || err);
      process.exit(1);
    }
  }

  const marker = {
    modelId,
    hfRepo: entry.hfRepo,
    fetchedAt: new Date().toISOString(),
    fileCount: files.length,
    bytes,
    dryRun,
  };
  if (!dryRun) {
    fs.writeFileSync(path.join(outDir, '.labs-model.json'), JSON.stringify(marker, null, 2) + '\n');
  }

  console.log(
    `[models:fetch] done — downloaded ${downloaded}, reused ${skipped}. Serve with pnpm dev → /models/${modelId}/`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
