#!/usr/bin/env node
/**
 * Neptune Benchmark Harness
 *
 * Usage:
 *   node utils/neptune-benchmark.mjs
 *   node utils/neptune-benchmark.mjs --fuseThreshold=0.3 --semanticBoost=1.5
 *
 * Scores hybrid search quality against a curated query suite using
 * real search-index.json + vectors.json data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';
import { pipeline } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Load data ──────────────────────────────────────────────────────────

const indexPath = path.join(PROJECT_ROOT, 'data/search-index.json');
const vectorsPath = path.join(PROJECT_ROOT, 'data/vectors.json');
const queriesPath = path.join(PROJECT_ROOT, 'utils/benchmark-queries.json');

const { documents: docs } = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
const vectorsData = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8'));
const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));

const docMap = new Map(docs.map(d => [d.id, d]));
const vectors = vectorsData.documents;

// ── Parse CLI overrides ────────────────────────────────────────────────

const overrides = {};
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([\w.]+)=(.+)$/);
  if (m) {
    const val = m[2];
    const num = Number(val);
    const finalVal = val === 'true' ? true : val === 'false' ? false : (!isNaN(num) && val !== '') ? num : val;
    const keys = m[1].split('.');
    if (keys.length === 1) {
      overrides[keys[0]] = finalVal;
    } else {
      let obj = overrides;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = obj[keys[i]] || {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = finalVal;
    }
  }
}

// ── Default config (matches neptune-search.js defaults) ───────────────

const defaultKeys = [
  { name: 'title', weight: 2.5 },
  { name: 'headings', weight: 2.0 },
  { name: 'keywords', weight: 1.5 },
  { name: 'bodyText', weight: 1.0 },
  { name: 'classes', weight: 1.5 },
  { name: 'chunks.text', weight: 0.8 },
];

const config = {
  fuseThreshold: 0.45,
  semanticThreshold: 0.30,
  maxResults: 20,
  semanticBoost: 1.0,
  modelName: 'Xenova/all-MiniLM-L6-v2',
  mergeMode: 'interleave', // 'concat' = semantic-first blocks, 'interleave' = score-sorted
  fuseKeys: [
    ...defaultKeys.map(k => ({
      ...k,
      weight: overrides.fuseKeys?.[k.name] ?? k.weight,
    })),
    ...(overrides.fuseKeys?.category !== undefined ? [{ name: 'category', weight: overrides.fuseKeys.category }] : []),
    ...(overrides.fuseKeys?.tab !== undefined ? [{ name: 'tab', weight: overrides.fuseKeys.tab }] : []),
  ],
  ...Object.fromEntries(Object.entries(overrides).filter(([k]) => !['fuseKeys'].includes(k))),
};

console.log('🔱 Neptune Benchmark');
console.log('Queries:', queries.length);
console.log('Docs:', docs.length);
console.log('Config:', JSON.stringify(config, null, 2));
console.log('');

// ── Math helpers (identical to neptune-search.js) ─────────────────────

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function rankBySimilarity(queryVec, vectors, threshold) {
  return vectors
    .map(doc => ({ id: doc.id, score: cosineSimilarity(queryVec, doc.embedding) }))
    .filter(r => r.score > threshold && isFinite(r.score))
    .sort((a, b) => b.score - a.score);
}

// ── Search functions ───────────────────────────────────────────────────

function fuzzySearch(query) {
  if (!query || query.length < 2) return [];
  const fuse = new Fuse(docs, {
    keys: config.fuseKeys,
    threshold: config.fuseThreshold,
    includeScore: true,
    shouldSort: true,
    minMatchCharLength: 2,
  });
  return fuse.search(query, { limit: config.maxResults });
}

function mergeResults(fuzzyResults, semanticResults) {
  const boosted = semanticResults
    .map(sr => {
      const doc = docMap.get(sr.id);
      if (!doc) return null;
      return { doc, score: sr.score * config.semanticBoost, source: 'semantic' };
    })
    .filter(Boolean);

  const fuzzyMapped = fuzzyResults
    .map(fr => ({ doc: fr.item, score: 1 - fr.score, source: 'fuzzy' }));

  if (config.mergeMode === 'interleave') {
    const seen = new Set();
    const merged = [];
    // Combine and sort by score descending, deduping
    const all = [...boosted, ...fuzzyMapped].sort((a, b) => b.score - a.score);
    for (const r of all) {
      if (!seen.has(r.doc.id)) {
        seen.add(r.doc.id);
        merged.push(r);
      }
    }
    return merged.slice(0, config.maxResults);
  }

  // Original concat mode: semantic block first, then fuzzy fills gaps
  const seen = new Set();
  const merged = [];
  const sortedBoosted = boosted.sort((a, b) => b.score - a.score);
  for (const r of sortedBoosted) {
    seen.add(r.doc.id);
    merged.push(r);
  }
  const filled = fuzzyMapped
    .filter(fr => !seen.has(fr.doc.id))
    .sort((a, b) => b.score - a.score);
  for (const r of filled) merged.push(r);
  return merged.slice(0, config.maxResults);
}

// ── Semantic embedding (one-time model load) ───────────────────────────

let extractor = null;

async function initSemantic() {
  if (extractor) return;
  console.log('🧠 Loading embedding model (one-time)...');
  extractor = await pipeline('feature-extraction', config.modelName, { quantized: true });
  console.log('🧠 Model ready.\n');
}

async function semanticSearch(query) {
  if (!query || query.length < 2) return [];
  const output = await extractor(query, { pooling: 'mean', normalize: true });
  const queryVec = Array.from(output.data);
  return rankBySimilarity(queryVec, vectors, config.semanticThreshold).slice(0, 10);
}

// ── Scoring ────────────────────────────────────────────────────────────

function scoreResult(expectedId, merged) {
  const idx = merged.findIndex(r => r.doc.id === expectedId);
  if (idx === -1) return { rank: Infinity, reciprocal: 0, inTop1: 0, inTop3: 0, inTop5: 0 };
  const rank = idx + 1;
  return {
    rank,
    reciprocal: 1 / rank,
    inTop1: rank === 1 ? 1 : 0,
    inTop3: rank <= 3 ? 1 : 0,
    inTop5: rank <= 5 ? 1 : 0,
  };
}

// ── Main benchmark loop ────────────────────────────────────────────────

async function main() {
  await initSemantic();

  const results = [];
  let totalMRR = 0;
  let totalTop1 = 0;
  let totalTop3 = 0;
  let totalTop5 = 0;
  let totalRank = 0;
  let count = 0;

  for (const q of queries) {
    const fuzzy = fuzzySearch(q.query);
    const semantic = await semanticSearch(q.query);
    const merged = mergeResults(fuzzy, semantic);
    const s = scoreResult(q.expected, merged);

    totalMRR += s.reciprocal;
    totalTop1 += s.inTop1;
    totalTop3 += s.inTop3;
    totalTop5 += s.inTop5;
    if (s.rank !== Infinity) totalRank += s.rank;
    count++;

    const bestSemantic = semantic.find(r => r.id === q.expected);
    const bestFuzzy = fuzzy.find(r => r.item.id === q.expected);

    results.push({
      query: q.query,
      expected: q.expected,
      rank: s.rank === Infinity ? '—' : s.rank,
      reciprocal: s.reciprocal.toFixed(3),
      semanticScore: bestSemantic ? bestSemantic.score.toFixed(3) : '—',
      fuzzyScore: bestFuzzy ? (1 - bestFuzzy.score).toFixed(3) : '—',
      topDoc: merged[0]?.doc.id ?? '—',
      topDocSource: merged[0]?.source ?? '—',
    });
  }

  // Print per-query results
  console.log('Per-query results:');
  console.log('─'.repeat(110));
  console.log(
    `${'Query'.padEnd(25)} | ${'Exp'.padEnd(18)} | ${'Rank'.padStart(4)} | ${'MRR'.padStart(6)} | ${'SemSc'.padStart(6)} | ${'FuzSc'.padStart(6)} | ${'TopDoc'.padEnd(18)} | ${'Src'.padEnd(5)}`
  );
  console.log('─'.repeat(110));
  for (const r of results) {
    console.log(
      `${r.query.slice(0, 25).padEnd(25)} | ${r.expected.slice(0, 18).padEnd(18)} | ${String(r.rank).padStart(4)} | ${r.reciprocal.padStart(6)} | ${r.semanticScore.padStart(6)} | ${r.fuzzyScore.padStart(6)} | ${r.topDoc.slice(0, 18).padEnd(18)} | ${r.topDocSource.padEnd(5)}`
    );
  }

  // Summary
  const n = queries.length;
  console.log('─'.repeat(110));
  console.log('\n📊 Summary');
  console.log(`MRR:           ${(totalMRR / n).toFixed(4)}`);
  console.log(`Top-1 Acc:     ${(totalTop1 / n * 100).toFixed(1)}% (${totalTop1}/${n})`);
  console.log(`Top-3 Acc:     ${(totalTop3 / n * 100).toFixed(1)}% (${totalTop3}/${n})`);
  console.log(`Top-5 Acc:     ${(totalTop5 / n * 100).toFixed(1)}% (${totalTop5}/${n})`);
  console.log(`Avg Rank:      ${count > 0 ? (totalRank / count).toFixed(2) : '—'} (among found)`);
}

main().catch(err => {
  console.error('💥 Benchmark failed:', err);
  process.exit(1);
});
