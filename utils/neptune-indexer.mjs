#!/usr/bin/env node
/**
 * Neptune Indexer — Build script for vd-neptune-search
 *
 * Extracts text from Vanduo Docs HTML fragments, builds a structured
 * search index for Fuse.js, and generates vector embeddings for
 * semantic search via Transformers.js.
 *
 * Usage:
 *   node utils/neptune-indexer.mjs
 *
 * Outputs:
 *   data/search-index.json  — Document corpus for Fuse.js
 *   data/vectors.json       — Pre-computed embeddings
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCS_SECTIONS = path.resolve(PROJECT_ROOT, '../docs/sections');
const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');

// ── Text extraction helpers ───────────────────────────────────────────

function stripTags(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(html) {
  const headings = [];
  const re = /<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[2]).trim();
    if (text) headings.push(text);
  }
  return headings;
}

function extractParagraphs(html) {
  const texts = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text) texts.push(text);
  }
  return texts;
}

function extractListItems(html) {
  const texts = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text) texts.push(text);
  }
  return texts;
}

function extractClasses(html) {
  const classes = [];
  // Match <td><code>.vd-...</code></td> patterns
  const re = /<td>\s*<code>([\s\S]*?)<\/code>\s*<\/td>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text && text.startsWith('.vd-')) classes.push(text);
  }
  return [...new Set(classes)];
}

function extractAlerts(html) {
  const texts = [];
  const re = /<div[^>]*class="[^"]*vd-alert[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text) texts.push(text);
  }
  return texts;
}

function extractDemoTitles(html) {
  const titles = [];
  const re = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text) titles.push(text);
  }
  return titles;
}

function extractChunks(html) {
  const chunks = [];
  let currentHeading = '';

  // Simple line-based chunking: group content by nearest preceding heading
  const lines = html.split(/(?=<h[2-4][^>]*>)/i);

  for (const block of lines) {
    const headingMatch = block.match(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/i);
    if (headingMatch) {
      currentHeading = stripTags(headingMatch[2]).trim();
    }

    // Extract paragraphs in this block
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pm;
    while ((pm = pRe.exec(block)) !== null) {
      const text = stripTags(pm[1]).trim();
      if (text && text.length > 10) {
        chunks.push({ type: 'paragraph', text, heading: currentHeading });
      }
    }

    // Extract list items
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let lm;
    while ((lm = liRe.exec(block)) !== null) {
      const text = stripTags(lm[1]).trim();
      if (text && text.length > 5) {
        chunks.push({ type: 'list-item', text, heading: currentHeading });
      }
    }

    // Extract table rows (class reference)
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let tm;
    while ((tm = trRe.exec(block)) !== null) {
      const cells = [];
      const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let dm;
      while ((dm = tdRe.exec(tm[1])) !== null) {
        cells.push(stripTags(dm[1]).trim());
      }
      if (cells.length >= 2) {
        const className = cells[0];
        const description = cells[1];
        if (className && description) {
          chunks.push({ type: 'class', text: `${className} — ${description}`, heading: currentHeading });
        }
      }
    }
  }

  return chunks;
}

// ── Document builder ──────────────────────────────────────────────────

function buildDocument(entry, html) {
  const headings = extractHeadings(html);
  const paragraphs = extractParagraphs(html);
  const listItems = extractListItems(html);
  const classes = extractClasses(html);
  const alerts = extractAlerts(html);
  const demoTitles = extractDemoTitles(html);
  const chunks = extractChunks(html);

  const bodyText = [
    ...paragraphs,
    ...listItems,
    ...alerts,
    ...demoTitles.filter(t => !headings.includes(t)),
  ].join('. ');

  return {
    id: entry.id,
    title: entry.title,
    category: entry.category || 'Page',
    tab: entry.tab || 'pages',
    route: entry.tab === 'pages' ? entry.id : `docs/${entry.id}`,
    icon: entry.icon || 'ph-file-text',
    keywords: entry.keywords || [],
    headings,
    bodyText: bodyText.slice(0, 8000), // Cap to keep embeddings manageable
    classes,
    chunks,
  };
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('🔱 Neptune Indexer starting...\n');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Read manifest
  const manifestPath = path.join(DOCS_SECTIONS, 'sections.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const entries = [];

  // Collect pages
  for (const page of manifest.pages) {
    entries.push({ ...page, category: 'Page', tab: 'pages' });
  }

  // Collect tabs/sections
  for (const [tabKey, tab] of Object.entries(manifest.tabs)) {
    for (const category of tab.categories) {
      for (const section of category.sections) {
        entries.push({
          ...section,
          category: category.name,
          tab: tabKey,
        });
      }
    }
  }

  console.log(`Found ${entries.length} entries to index`);

  // Build documents
  const documents = [];
  const failed = [];

  for (const entry of entries) {
    const filePath = path.join(DOCS_SECTIONS, entry.file);
    if (!fs.existsSync(filePath)) {
      failed.push(entry.file);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf-8');
    const doc = buildDocument(entry, html);
    documents.push(doc);
  }

  if (failed.length) {
    console.warn(`⚠️  Missing ${failed.length} files:`, failed.slice(0, 5).join(', '), failed.length > 5 ? '...' : '');
  }

  console.log(`✅ Built ${documents.length} documents`);

  // Write search index
  const indexPath = path.join(DATA_DIR, 'search-index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ documents }, null, 2));
  const indexSize = (fs.statSync(indexPath).size / 1024).toFixed(1);
  console.log(`📝 search-index.json written (${indexSize} KB)`);

  // Generate embeddings
  console.log('\n🧠 Loading embedding model...');
  const { pipeline } = await import('@xenova/transformers');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true,
  });

  console.log('🧠 Generating embeddings...');
  const vectors = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const text = `${doc.title}. ${doc.category}. ${doc.keywords.join('. ')}. ${doc.headings.join('. ')}. ${doc.bodyText}`.slice(0, 512);
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    vectors.push({ id: doc.id, embedding });

    if ((i + 1) % 10 === 0 || i === documents.length - 1) {
      console.log(`  ${i + 1}/${documents.length} done`);
    }
  }

  const vectorsPath = path.join(DATA_DIR, 'vectors.json');
  fs.writeFileSync(vectorsPath, JSON.stringify({
    model: 'Xenova/all-MiniLM-L6-v2',
    generatedAt: new Date().toISOString(),
    dimensions: vectors[0]?.embedding.length || 384,
    documents: vectors,
  }, null, 2));
  const vectorsSize = (fs.statSync(vectorsPath).size / 1024).toFixed(1);
  console.log(`🧬 vectors.json written (${vectorsSize} KB)`);

  // Validate consistency between index and vectors
  const indexIds = new Set(documents.map(d => d.id));
  const vectorIds = new Set(vectors.map(v => v.id));
  const missingFromVectors = [...indexIds].filter(id => !vectorIds.has(id));
  const orphanVectors = [...vectorIds].filter(id => !indexIds.has(id));

  if (missingFromVectors.length) {
    console.error(`❌ ${missingFromVectors.length} docs missing from vectors:`, missingFromVectors.join(', '));
  }
  if (orphanVectors.length) {
    console.error(`❌ ${orphanVectors.length} orphan vectors:`, orphanVectors.join(', '));
  }
  if (missingFromVectors.length || orphanVectors.length) {
    process.exit(1);
  }

  console.log('\n✨ Indexing complete!');
}

main().catch(err => {
  console.error('💥 Indexer failed:', err);
  process.exit(1);
});
