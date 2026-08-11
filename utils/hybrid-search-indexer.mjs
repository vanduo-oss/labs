#!/usr/bin/env node
/**
 * Thin wrapper around `@vanduo-oss/vdl-hybrid-search`'s indexer.
 *
 * The package script writes into its own package `data/` directory.
 * This wrapper runs it, then copies `search-index.json` / `vectors.json`
 * into this repo's `data/` for the labs demos.
 *
 * Usage:
 *   pnpm index
 *   VD3_DOCS_PATH=../vd3-docs pnpm index
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const labsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const labsData = path.join(labsRoot, 'data');

const pkgJson = require.resolve('@vanduo-oss/vdl-hybrid-search/package.json');
const pkgRoot = path.dirname(pkgJson);
const indexer = path.join(pkgRoot, 'scripts', 'hybrid-search-indexer.mjs');
const pkgData = path.join(pkgRoot, 'data');

if (!fs.existsSync(indexer)) {
  console.error(`Missing package indexer at ${indexer}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [indexer], {
  stdio: 'inherit',
  env: process.env,
  cwd: pkgRoot,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

fs.mkdirSync(labsData, { recursive: true });
for (const file of ['search-index.json', 'vectors.json']) {
  const src = path.join(pkgData, file);
  const dest = path.join(labsData, file);
  if (!fs.existsSync(src)) {
    console.error(`Indexer did not produce ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  console.log(`📦 copied ${file} → ${path.relative(labsRoot, dest)}`);
}
