/**
 * vdl-neptune-search — In-browser Hybrid Search for Vanduo Docs
 *
 * Provides both a headless API (NeptuneSearch) and a UI component
 * (NeptuneSearchUI) for fuzzy + semantic hybrid search over
 * documentation content.
 *
 * Zero runtime npm dependencies. Libraries loaded from CDN on demand.
 *
 * @example
 * import { NeptuneSearch, NeptuneSearchUI } from './neptune-search.js';
 *
 * const search = new NeptuneSearch();
 * const ui = new NeptuneSearchUI({ container: document.getElementById('app'), search });
 * ui.mount();
 */

import {
  normalizeSearchQuery,
  safeDocHref,
  sanitizeIconClass,
  validateSearchIndexPayload,
  validateSearchQuery,
  validateVectorPayload,
} from './guardrails/search.js';

// ═══════════════════════════════════════════════════════════════════════
// CDN Configuration
// ═══════════════════════════════════════════════════════════════════════

const CDN = {
  fuse: [
    'https://cdn.jsdelivr.net/npm/fuse.js@7/dist/fuse.basic.mjs',
    'https://unpkg.com/fuse.js@7/dist/fuse.basic.mjs',
  ],
  transformers: [
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm',
    'https://esm.sh/@huggingface/transformers@3',
  ],
};

export const VDL_NEPTUNE_SEARCH_VERSION = '0.0.3';

export const DEFAULT_DOCS_BASE_URL = 'https://vanduo-oss.github.io/vd3-docs';

// ═══════════════════════════════════════════════════════════════════════
// Math Helpers
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute cosine similarity between two normalized vectors.
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot; // Vectors are already normalized
}

/**
 * Compute cosine similarity between a query vector and all document vectors.
 */
export function rankBySimilarity(queryVec, vectors, threshold = 0.25) {
  return vectors
    .map(doc => {
      const score = cosineSimilarity(queryVec, doc.embedding);
      return { id: doc.id, score };
    })
    .filter(r => r.score > threshold && isFinite(r.score))
    .sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════════
// Library Loaders
// ═══════════════════════════════════════════════════════════════════════

let _fuseModule = null;
let _transformersModule = null;

async function loadFuse() {
  if (_fuseModule) return _fuseModule;
  const urls = Array.isArray(CDN.fuse) ? CDN.fuse : [CDN.fuse];
  let lastErr;
  for (const url of urls) {
    try {
      _fuseModule = await import(/* @vite-ignore */ url);
      return _fuseModule;
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn('[Neptune] Failed to load Fuse.js from any CDN:', lastErr?.message);
  throw lastErr;
}

async function loadTransformers() {
  if (_transformersModule) return _transformersModule;
  const urls = Array.isArray(CDN.transformers) ? CDN.transformers : [CDN.transformers];
  let lastErr;
  for (const url of urls) {
    try {
      _transformersModule = await import(/* @vite-ignore */ url);
      return _transformersModule;
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn('[Neptune] Failed to load Transformers.js from any CDN:', lastErr?.message);
  throw lastErr;
}

// ═══════════════════════════════════════════════════════════════════════
// NeptuneSearch — Headless API
// ═══════════════════════════════════════════════════════════════════════

export class NeptuneSearch {
  static VERSION = VDL_NEPTUNE_SEARCH_VERSION;

  constructor(options = {}) {
    this.indexUrl = options.indexUrl ?? './data/search-index.json';
    this.vectorsUrl = options.vectorsUrl ?? './data/vectors.json';
    this.fuseThreshold = options.fuseThreshold ?? 0.45;
    this.semanticThreshold = options.semanticThreshold ?? 0.30;
    this.maxResults = options.maxResults ?? 20;
    this.queryMinLength = options.queryMinLength ?? 2;
    this.queryMaxLength = options.queryMaxLength ?? 240;
    this.maxDocuments = options.maxDocuments ?? 5000;
    this.maxVectorDimensions = options.maxVectorDimensions ?? 4096;
    this.semanticBoost = options.semanticBoost ?? 1.0;
    this.modelName = options.modelName ?? 'Xenova/all-MiniLM-L6-v2';

    this._fuse = null;
    this._fusePromise = null;
    this._docs = null;
    this._docMap = null;
    this._vectors = null;
    this._extractor = null;
    this._semanticReady = false;
    this._semanticFailed = false;
    this._semanticPromise = null;
    this._progressSubscribers = [];
  }

  onSemanticProgress(callback) {
    this._progressSubscribers.push(callback);
    return () => {
      this._progressSubscribers = this._progressSubscribers.filter(cb => cb !== callback);
    };
  }

  _emitSemanticProgress(data) {
    for (const cb of this._progressSubscribers) cb(data);
  }

  // ── Fuzzy Layer ──────────────────────────────────────────────────────

  async initFuzzy() {
    if (!this._fusePromise) {
      this._fusePromise = (async () => {
        const response = await fetch(this.indexUrl);
        if (!response.ok) throw new Error(`Failed to load search index: ${response.status}`);
        const data = await response.json();
        const payloadCheck = validateSearchIndexPayload(data, { maxDocuments: this.maxDocuments });
        if (!payloadCheck.allowed) {
          throw new Error(payloadCheck.message || 'Search index payload validation failed.');
        }
        this._docs = data.documents;
        this._docMap = new Map(this._docs.map(d => [d.id, d]));

        const Fuse = await loadFuse();
        const FuseClass = Fuse.default ?? Fuse;
        this._fuse = new FuseClass(this._docs, {
          keys: [
            { name: 'title', weight: 2.5 },
            { name: 'headings', weight: 2.0 },
            { name: 'keywords', weight: 2.5 },
            { name: 'bodyText', weight: 1.0 },
            { name: 'classes', weight: 1.5 },
            { name: 'chunks.text', weight: 0.8 },
          ],
          threshold: this.fuseThreshold,
          includeScore: true,
          shouldSort: true,
          minMatchCharLength: 2,
        });
      })();
    }
    return this._fusePromise;
  }

  fuzzySearch(query) {
    if (!this._fuse) return [];
    const normalizedQuery = normalizeSearchQuery(query, { maxLength: this.queryMaxLength });
    const check = validateSearchQuery(normalizedQuery, {
      minLength: this.queryMinLength,
      maxLength: this.queryMaxLength,
    });
    if (!check.allowed) return [];
    return this._fuse.search(normalizedQuery, { limit: this.maxResults });
  }

  // ── Semantic Layer ───────────────────────────────────────────────────

  async initSemantic() {
    await this.initFuzzy();
    if (this._semanticReady) return;
    if (this._semanticFailed) {
      throw new Error('Semantic search previously failed; recreate NeptuneSearch instance to retry');
    }

    if (!this._semanticPromise) {
      this._semanticPromise = (async () => {
        this._emitSemanticProgress({ stage: 'loading-model', message: 'Loading search model (one-time download)...' });

        let vectorsData;
        try {
          const transformers = await loadTransformers();

          this._extractor = transformers.pipeline('feature-extraction', this.modelName, {
            quantized: true,
            progress_callback: (progress) => {
              if (progress?.status === 'progress') {
                this._emitSemanticProgress({
                  stage: 'downloading',
                  message: `Downloading model\u2026 ${Math.round((progress.loaded / progress.total) * 100)}%`,
                  progress,
                });
              }
            },
          });

          vectorsData = await fetch(this.vectorsUrl).then(r => {
            if (!r.ok) throw new Error(`Failed to load vectors: ${r.status}`);
            return r.json();
          });

          const vectorsCheck = validateVectorPayload(vectorsData, {
            maxDocuments: this.maxDocuments,
            maxDimensions: this.maxVectorDimensions,
          });
          if (!vectorsCheck.allowed) {
            throw new Error(vectorsCheck.message || 'Vector payload validation failed.');
          }

          const knownDocIds = new Set(this._docs.map((d) => d.id));
          const unknownVectorId = vectorsData.documents.find((row) => !knownDocIds.has(row.id));
          if (unknownVectorId) {
            throw new Error(`Vector payload references unknown doc id: ${unknownVectorId.id}`);
          }
        } catch (err) {
          this._semanticFailed = true;
          this._semanticPromise = null;
          this._emitSemanticProgress({ stage: 'error', message: err.message });
          throw err;
        }

        this._extractor = await this._extractor;
        this._vectors = vectorsData.documents;
        this._semanticReady = true;

        this._emitSemanticProgress({ stage: 'ready', message: 'Search model ready' });
      })();
    }
    return this._semanticPromise;
  }

  async semanticSearch(query) {
    await this.initSemantic();
    const normalizedQuery = normalizeSearchQuery(query, { maxLength: this.queryMaxLength });
    const check = validateSearchQuery(normalizedQuery, {
      minLength: this.queryMinLength,
      maxLength: this.queryMaxLength,
    });
    if (!check.allowed) return [];

    const output = await this._extractor(normalizedQuery, { pooling: 'mean', normalize: true });
    const queryVec = Array.from(output.data);

    return rankBySimilarity(queryVec, this._vectors, this.semanticThreshold).slice(0, 10);
  }

  // ── Hybrid Merge ─────────────────────────────────────────────────────

mergeResults(fuzzyResults, semanticResults) {
    if (!this._docMap) throw new Error('mergeResults requires initFuzzy() to be called first');

    const boosted = semanticResults
      .map(sr => {
        const doc = this._docMap.get(sr.id);
        if (!doc) {
          console.warn(`[Neptune] Vector references missing doc id: '${sr.id}'`);
          return null;
        }
        return { doc, score: sr.score * this.semanticBoost, source: 'semantic' };
      })
      .filter(Boolean);

    const fuzzyMapped = fuzzyResults
      .map(fr => ({ doc: fr.item, score: 1 - fr.score, source: 'fuzzy' }));

    const seen = new Set();
    const merged = [];

    // Score-sorted interleave: best result wins regardless of source
    const all = [...boosted, ...fuzzyMapped].sort((a, b) => b.score - a.score);
    for (const r of all) {
      if (!seen.has(r.doc.id)) {
        seen.add(r.doc.id);
        merged.push(r);
      }
    }

    return merged.slice(0, this.maxResults);
  }

  // ── Unified Search ───────────────────────────────────────────────────

  async search(query, { mode = 'hybrid' } = {}) {
    await this.initFuzzy();

    const normalizedQuery = normalizeSearchQuery(query, { maxLength: this.queryMaxLength });
    const queryCheck = validateSearchQuery(normalizedQuery, {
      minLength: this.queryMinLength,
      maxLength: this.queryMaxLength,
    });

    if (!['fuzzy', 'semantic', 'hybrid'].includes(mode)) {
      throw new Error(`Invalid search mode: "${mode}". Expected 'fuzzy', 'semantic', or 'hybrid'.`);
    }

    const result = {
      query: normalizedQuery,
      mode,
      fuzzy: [],
      semantic: [],
      merged: [],
    };

    if (!queryCheck.allowed) return result;

    if (mode === 'fuzzy' || mode === 'hybrid') {
      result.fuzzy = this.fuzzySearch(normalizedQuery);
    }

    if (mode === 'semantic' || mode === 'hybrid') {
      try {
        result.semantic = await this.semanticSearch(normalizedQuery);
      } catch (err) {
        console.warn('[Neptune] Semantic search failed:', err.message);
        // Degrade gracefully to fuzzy-only
      }
    }

    if (mode === 'hybrid') {
      result.merged = this.mergeResults(result.fuzzy, result.semantic);
    } else if (mode === 'fuzzy') {
      result.merged = result.fuzzy.map(fr => ({
        doc: fr.item,
        score: 1 - fr.score,
        source: 'fuzzy',
      }));
    } else {
      result.merged = result.semantic.map(sr => {
        const doc = this._docMap.get(sr.id);
        return { doc, score: sr.score, source: 'semantic' };
      }).filter(r => r.doc);
    }

    return result;
  }

  // ── Utilities ────────────────────────────────────────────────────────

  getDocById(id) {
    return this._docMap?.get(id) ?? null;
  }

  /** @returns {Array<Record<string, unknown>>} */
  getDocuments() {
    return Array.isArray(this._docs) ? this._docs.slice() : [];
  }

  isSemanticReady() {
    return this._semanticReady;
  }

  static resetCDNCache() {
    _fuseModule = null;
    _transformersModule = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// NeptuneSearchUI — DOM Component
// ═══════════════════════════════════════════════════════════════════════

export class NeptuneSearchUI {
  static VERSION = VDL_NEPTUNE_SEARCH_VERSION;

  constructor(options = {}) {
    this.container = options.container;
    this.search = options.search;
    this.onResultClick = options.onResultClick ?? (() => {});
    this.placeholder = options.placeholder ?? 'Search docs…';
    this.debounceMs = options.debounceMs ?? 150;
    this.showSemanticHint = options.showSemanticHint ?? true;
    this.baseUrl = options.baseUrl ?? DEFAULT_DOCS_BASE_URL;
    this.emptyMessage = options.emptyMessage ?? 'No docs found. Try another query or pick a category filter.';

    this._mounted = false;
    this._elements = {};
    this._debounceTimer = null;
    this._selectedIndex = -1;
    this._results = [];
    this._keyboardHandler = null;
    this._clickOutsideHandler = null;
    this._unsubscribeSemantic = null;
    /** Bumps when input/close/fuzzy runs so stale hybrid completions skip UI updates */
    this._semanticSeq = 0;
  }

  mount() {
    if (this._mounted) return;
    if (!this.container) throw new Error('NeptuneSearchUI requires a container element');

    this._buildDOM();
    this._bindEvents();
    this._mounted = true;
    // Warm Transformers.js + MiniLM in the background so Enter feels instant.
    // Fuzzy search remains available while this runs (non-blocking progress bar).
    this._preloadSemantic();
  }

  destroy() {
    if (!this._mounted) return;
    this._unbindEvents();
    this.container.innerHTML = '';
    this._mounted = false;
    this._elements = {};
    this._results = [];
    this._selectedIndex = -1;
  }

  /**
   * Kick off semantic init without awaiting. Safe to call repeatedly —
   * NeptuneSearch.initSemantic() is promise-cached per instance.
   */
  _preloadSemantic() {
    if (!this.search) return;
    this.search.initSemantic().catch((err) => {
      console.warn('[NeptuneUI] Semantic preload failed:', err?.message || err);
    });
  }

  // ── DOM Construction ─────────────────────────────────────────────────

  _buildDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'vdl-neptune-search';
    wrapper.innerHTML = `
      <div class="vdl-neptune-input-wrap">
        <input
          type="text"
          class="vdl-neptune-input"
          placeholder="${this._esc(this.placeholder)}"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          role="combobox"
          aria-label="Search documentation"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-controls="vdl-neptune-results"
          aria-activedescendant=""
        />
        <span class="vdl-neptune-hint" aria-hidden="true">
          ${this.showSemanticHint ? '<kbd>Enter</kbd> for AI search' : ''}
        </span>
      </div>
      <div class="vdl-neptune-dropdown" id="vdl-neptune-results" role="listbox" hidden>
        <div class="vdl-neptune-loader" hidden>
          <span class="vdl-neptune-spinner"></span>
          <span class="vdl-neptune-loader-text">Searching with AI…</span>
        </div>
        <div class="vdl-neptune-results"></div>
        <div class="vdl-neptune-empty" hidden>${this._esc(this.emptyMessage)}</div>
      </div>
      <div class="vdl-neptune-progress" hidden>
        <div class="vdl-neptune-progress-bar"></div>
        <span class="vdl-neptune-progress-text"></span>
      </div>
    `;

    this.container.appendChild(wrapper);

    this._elements = {
      wrapper,
      input: wrapper.querySelector('.vdl-neptune-input'),
      dropdown: wrapper.querySelector('.vdl-neptune-dropdown'),
      results: wrapper.querySelector('.vdl-neptune-results'),
      empty: wrapper.querySelector('.vdl-neptune-empty'),
      loader: wrapper.querySelector('.vdl-neptune-loader'),
      progress: wrapper.querySelector('.vdl-neptune-progress'),
      progressBar: wrapper.querySelector('.vdl-neptune-progress-bar'),
      progressText: wrapper.querySelector('.vdl-neptune-progress-text'),
      hint: wrapper.querySelector('.vdl-neptune-hint'),
    };
  }

  // ── Event Binding ────────────────────────────────────────────────────

  _bindEvents() {
    const input = this._elements.input;

    input.addEventListener('input', this._onInput.bind(this));
    input.addEventListener('keydown', this._onKeyDown.bind(this));
    input.addEventListener('focus', () => this._openDropdown());

    this._keyboardHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        input.focus();
      }
      if (e.key === 'Escape' && !this._elements.dropdown.hidden) {
        e.preventDefault();
        this._closeDropdown();
        input.blur();
      }
    };
    document.addEventListener('keydown', this._keyboardHandler);

    this._clickOutsideHandler = (e) => {
      if (!this._elements.wrapper.contains(e.target)) {
        this._closeDropdown();
      }
    };
    document.addEventListener('click', this._clickOutsideHandler);

    if (this.search) {
      this._unsubscribeSemantic = this.search.onSemanticProgress((data) => {
        this._onSemanticProgress(data);
      });
    }
  }

  _unbindEvents() {
    if (this._keyboardHandler) {
      document.removeEventListener('keydown', this._keyboardHandler);
    }
    if (this._clickOutsideHandler) {
      document.removeEventListener('click', this._clickOutsideHandler);
    }
    if (this._unsubscribeSemantic) {
      this._unsubscribeSemantic();
      this._unsubscribeSemantic = null;
    }
  }

  // ── Event Handlers ───────────────────────────────────────────────────

  _onInput(e) {
    const query = normalizeSearchQuery(e.target.value, {
      maxLength: this.search?.queryMaxLength ?? 240,
    });

    clearTimeout(this._debounceTimer);
    this._semanticSeq++;
    this._elements.loader.hidden = true;

    const queryCheck = validateSearchQuery(query, {
      minLength: this.search?.queryMinLength ?? 2,
      maxLength: this.search?.queryMaxLength ?? 240,
    });
    if (!queryCheck.allowed) {
      this._clearResults();
      return;
    }

    this._debounceTimer = setTimeout(async () => {
      await this._runFuzzy(query);
    }, this.debounceMs);
  }

  _onKeyDown(e) {
    const { dropdown, results, input } = this._elements;

    if (!dropdown.hidden && this._results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._selectedIndex = Math.min(this._selectedIndex + 1, this._results.length - 1);
        this._updateSelection();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._selectedIndex = Math.max(this._selectedIndex - 1, -1);
        this._updateSelection();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this._selectedIndex >= 0) {
          this._selectResult(this._results[this._selectedIndex]);
        } else {
          // Enter without selection → semantic search
          this._runSemantic(input.value.trim());
        }
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this._runSemantic(input.value.trim());
      return;
    }
  }

  _onSemanticProgress(data) {
    if (!this._mounted) return;
    const { progress, progressBar, progressText } = this._elements;
    if (data.stage === 'loading-model' || data.stage === 'downloading') {
      progress.hidden = false;
      progressText.textContent = data.message;
      if (data.progress?.loaded && data.progress?.total) {
        const pct = Math.round((data.progress.loaded / data.progress.total) * 100);
        progressBar.style.width = `${pct}%`;
    } else {
        progressBar.style.width = '0%';
    }
    } else if (data.stage === 'ready') {
      progress.hidden = true;
      progressBar.style.width = '0%';
    } else if (data.stage === 'error') {
      progress.hidden = true;
      progressBar.style.width = '0%';
      progressText.textContent = '';
    }
  }

  // ── Search Execution ─────────────────────────────────────────────────

  async _runFuzzy(query) {
    if (!this.search) return;
    this._semanticSeq++;
    const seq = this._semanticSeq;
    const result = await this.search.search(query, { mode: 'fuzzy' });
    if (seq !== this._semanticSeq) return;
    this._results = result.merged;
    this._selectedIndex = -1;
    this._elements.loader.hidden = true;
    this._renderResults();
  }

  async _runSemantic(query) {
    if (!this.search) return;
    const normalizedQuery = normalizeSearchQuery(query, {
      maxLength: this.search.queryMaxLength ?? 240,
    });
    const queryCheck = validateSearchQuery(normalizedQuery, {
      minLength: this.search.queryMinLength ?? 2,
      maxLength: this.search.queryMaxLength ?? 240,
    });
    if (!queryCheck.allowed) return;

    clearTimeout(this._debounceTimer);
    const seq = this._semanticSeq;
    this._results = [];
    this._selectedIndex = -1;
    this._elements.empty.hidden = true;
    this._elements.results.innerHTML = '';
    this._elements.loader.hidden = false;
    this._elements.dropdown.hidden = false;
    this._elements.input.setAttribute('aria-expanded', 'true');

    try {
      const result = await this.search.search(normalizedQuery, { mode: 'hybrid' });
      if (seq !== this._semanticSeq) return;
      this._results = result.merged;
      this._selectedIndex = -1;
      this._elements.loader.hidden = true;
      this._renderResults();
    } catch (err) {
      console.warn('[NeptuneUI] Semantic search error:', err);
      if (seq !== this._semanticSeq) return;
      this._elements.loader.hidden = true;
      const result = await this.search.search(normalizedQuery, { mode: 'fuzzy' });
      if (seq !== this._semanticSeq) return;
      this._results = result.merged;
      this._renderResults();
    } finally {
      this._elements.loader.hidden = true;
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────

  _renderResults() {
    const { results, empty, dropdown, hint, loader } = this._elements;

    loader.hidden = true;

    if (this._results.length === 0) {
      results.innerHTML = '';
      empty.hidden = false;
      dropdown.hidden = false;
      hint.hidden = !this.showSemanticHint;
      return;
    }

    empty.hidden = true;
    dropdown.hidden = false;
    hint.hidden = true;

    results.innerHTML = this._results.map((r, i) => this._renderResultCard(r, i)).join('');

    // Bind click handlers
    results.querySelectorAll('.vdl-neptune-result').forEach((el, i) => {
      el.addEventListener('click', () => this._selectResult(this._results[i]));
      el.addEventListener('mouseenter', () => {
        this._selectedIndex = i;
        this._updateSelection();
      });
    });
  }

  _renderResultCard(result, index) {
    const { doc, source } = result;
    const safeIcon = sanitizeIconClass(doc.icon || 'ph-file-text');
    const href = safeDocHref(this.baseUrl, doc.route);
    const badge = source === 'semantic'
      ? '<span class="vdl-neptune-badge vdl-neptune-badge-semantic">AI</span>'
      : '<span class="vdl-neptune-badge vdl-neptune-badge-fuzzy">Fuzzy</span>';

    const keywords = (doc.keywords || []).slice(0, 3).map(k =>
      `<span class="vdl-neptune-keyword">${this._esc(k)}</span>`
    ).join('');

    return `
      <div
        class="vdl-neptune-result"
        id="vdl-neptune-result-${index}"
        role="option"
        data-index="${index}"
        tabindex="-1"
      >
        <div class="vdl-neptune-result-header">
          <span class="vdl-neptune-result-icon"><i class="ph ph-${this._esc(safeIcon)}"></i></span>
          <span class="vdl-neptune-result-title">${this._esc(doc.title)}</span>
          <span class="vdl-neptune-result-trail">
            <span class="vdl-neptune-result-category">${this._esc(doc.category)}</span>
            ${badge}
          </span>
        </div>
        <div class="vdl-neptune-result-body">
          ${this._esc(doc.bodyText?.slice(0, 100) || '')}…
        </div>
        <div class="vdl-neptune-result-footer">
          <div class="vdl-neptune-result-keywords">${keywords}</div>
          <a
            class="vdl-neptune-result-link"
            href="${this._esc(href)}"
            target="_blank"
            rel="noopener noreferrer"
            onclick="event.stopPropagation()"
          >Open docs →</a>
        </div>
      </div>
    `;
  }

  _updateSelection() {
    const items = this._elements.results.querySelectorAll('.vdl-neptune-result');
    items.forEach((el, i) => {
      el.classList.toggle('is-selected', i === this._selectedIndex);
      el.setAttribute('aria-selected', String(i === this._selectedIndex));
    });
    const input = this._elements.input;
    if (this._selectedIndex >= 0 && items[this._selectedIndex]) {
      const activeId = items[this._selectedIndex].getAttribute('id') || `vdl-neptune-result-${this._selectedIndex}`;
      items[this._selectedIndex].setAttribute('id', activeId);
      input.setAttribute('aria-activedescendant', activeId);
      input.setAttribute('aria-expanded', 'true');
      items[this._selectedIndex].scrollIntoView({ block: 'nearest' });
    } else {
      input.setAttribute('aria-activedescendant', '');
      input.setAttribute('aria-expanded', String(this._results.length > 0));
    }
  }

  _selectResult(result) {
    this.onResultClick(result);
    this._closeDropdown();
  }

  _clearResults() {
    this._semanticSeq++;
    this._results = [];
    this._selectedIndex = -1;
    this._elements.results.innerHTML = '';
    this._elements.empty.hidden = true;
    this._elements.loader.hidden = true;
    this._elements.dropdown.hidden = true;
    this._elements.hint.hidden = !this.showSemanticHint;
  }

  _openDropdown() {
    if (this._results.length > 0) {
      this._elements.dropdown.hidden = false;
      this._elements.input.setAttribute('aria-expanded', 'true');
    }
  }

  _closeDropdown() {
    this._semanticSeq++;
    this._elements.dropdown.hidden = true;
    this._elements.loader.hidden = true;
    this._elements.input.setAttribute('aria-expanded', 'false');
    this._elements.input.setAttribute('aria-activedescendant', '');
  }

  // ── Utilities ────────────────────────────────────────────────────────

  _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Default Styles (injected once)
// ═══════════════════════════════════════════════════════════════════════

const NEPTUNE_STYLES = `
.vdl-neptune-search {
  position: relative;
  font-family: var(--font-family-sans, system-ui, sans-serif);
  width: 100%;
  max-width: none;
  margin: 0;
}

.vdl-neptune-input-wrap {
  position: relative;
}

.vdl-neptune-input {
  width: 100%;
  padding: 0.75rem 1rem;
  padding-right: 7rem;
  font-size: 1rem;
  line-height: 1.5;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: var(--radius-md, 0.5rem);
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #1f2937);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.vdl-neptune-input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.vdl-neptune-hint {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--text-muted, #6b7280);
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.vdl-neptune-hint kbd {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
  font-family: inherit;
  background: var(--bg-secondary, #f5f5f5);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: var(--radius-sm, 0.25rem);
  color: var(--text-muted, #6b7280);
}

.vdl-neptune-dropdown {
  margin-top: 0.5rem;
  max-height: min(60vh, 28rem);
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: var(--radius-md, 0.5rem);
  box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1));
}

.vdl-neptune-result {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, #f0f0f0);
  transition: background 0.1s ease;
}

.vdl-neptune-result:last-child {
  border-bottom: none;
}

.vdl-neptune-result:hover,
.vdl-neptune-result.is-selected {
  background: var(--bg-secondary, #f8f9fa);
}

.vdl-neptune-result-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.vdl-neptune-result-icon {
  color: var(--color-primary, #3b82f6);
  font-size: 1.125rem;
  line-height: 1;
  flex-shrink: 0;
}

.vdl-neptune-result-title {
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  flex: 1 1 12rem;
  min-width: 0;
}

.vdl-neptune-result-trail {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-left: auto;
}

.vdl-neptune-result-category {
  font-size: 0.75rem;
  color: var(--text-muted, #6b7280);
  background: var(--bg-secondary, #f5f5f5);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-sm, 0.25rem);
}

.vdl-neptune-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  padding: 0.125rem 0.375rem;
  border-radius: var(--radius-sm, 0.25rem);
}

.vdl-neptune-badge-semantic {
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary, #3b82f6);
}

.vdl-neptune-badge-fuzzy {
  background: rgba(107, 114, 128, 0.1);
  color: var(--text-muted, #6b7280);
}

.vdl-neptune-result-body {
  font-size: 0.8125rem;
  color: var(--text-muted, #6b7280);
  line-height: 1.4;
  margin-bottom: 0.375rem;
}

.vdl-neptune-result-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.vdl-neptune-result-keywords {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.vdl-neptune-keyword {
  font-size: 0.6875rem;
  color: var(--text-muted, #6b7280);
  background: var(--bg-secondary, #f5f5f5);
  padding: 0.0625rem 0.375rem;
  border-radius: var(--radius-sm, 0.25rem);
}

.vdl-neptune-result-link {
  font-size: 0.8125rem;
  color: var(--color-primary, #3b82f6);
  text-decoration: none;
  font-weight: 500;
}

.vdl-neptune-result-link:hover {
  text-decoration: underline;
}

.vdl-neptune-empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-muted, #6b7280);
}

.vdl-neptune-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 1rem;
  border-bottom: 1px solid var(--border-color, #f0f0f0);
  background: var(--bg-secondary, #f8f9fa);
}

.vdl-neptune-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--border-color, #e0e0e0);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: vdl-neptune-spin 0.8s linear infinite;
}

@keyframes vdl-neptune-spin {
  to { transform: rotate(360deg); }
}

.vdl-neptune-loader-text {
  font-size: 0.875rem;
  color: var(--text-muted, #6b7280);
}

.vdl-neptune-progress {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: var(--radius-md, 0.5rem);
  border: 1px solid var(--border-color, #e0e0e0);
}

.vdl-neptune-progress-bar {
  height: 4px;
  background: var(--color-primary, #3b82f6);
  border-radius: 2px;
  width: 0%;
  transition: width 0.3s ease;
}

.vdl-neptune-progress-text {
  display: block;
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted, #6b7280);
}
`;

let _stylesInjected = false;

function injectStyles() {
  if (_stylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = NEPTUNE_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}

// Auto-inject styles when UI is mounted
const originalMount = NeptuneSearchUI.prototype.mount;
NeptuneSearchUI.prototype.mount = function (...args) {
  injectStyles();
  return originalMount.call(this, ...args);
};
