/**
 * Test-only DOM UI harness for HybridSearch.
 * Production labs UI is Vue `VdlHybridSearchUI`; this preserves Playwright e2e coverage
 * of the former NeptuneSearchUI behaviors against the published engine.
 */
import {
  normalizeSearchQuery,
  safeDocHref,
  sanitizeIconClass,
  validateSearchQuery,
} from '/node_modules/@vanduo-oss/vdl-hybrid-search/dist/guardrails/search.js';

// NeptuneSearchUI — DOM Component
// ═══════════════════════════════════════════════════════════════════════

export class HybridSearchDomUI {
  static VERSION = 'test-harness';

  constructor(options = {}) {
    this.container = options.container;
    this.search = options.search;
    this.onResultClick = options.onResultClick ?? (() => {});
    this.placeholder = options.placeholder ?? 'Search docs…';
    this.debounceMs = options.debounceMs ?? 350;
    this.showSemanticHint = options.showSemanticHint ?? true;
    this.autofocus = options.autofocus ?? true;
    this.baseUrl = options.baseUrl ?? 'https://vanduo-oss.github.io/vd3-docs';
    this.emptyMessage = options.emptyMessage ?? 'No docs found. Try another query or pick a category filter.';

    this._mounted = false;
    this._elements = {};
    this._debounceTimer = null;
    this._selectedIndex = -1;
    this._results = [];
    this._keyboardHandler = null;
    this._clickOutsideHandler = null;
    this._unsubscribeSemantic = null;
    /** Last accepted query string (for enrich-on-ready). */
    this._lastQuery = '';
    /** Ensures model-ready enrichment runs at most once per warm-up. */
    this._didEnrichOnReady = false;
    /** Bumps when input/close/fuzzy runs so stale hybrid completions skip UI updates */
    this._semanticSeq = 0;
  }

  mount() {
    if (this._mounted) return;
    if (!this.container) throw new Error('HybridSearchDomUI requires a container element');

    this._buildDOM();
    this._bindEvents();
    this._mounted = true;
    // Warm Transformers.js + MiniLM in the background so hybrid auto-search is ready sooner.
    // Fuzzy search remains available while this runs (non-blocking progress bar).
    this._preloadSemantic();
    this._tryAutofocus();
  }

  destroy() {
    if (!this._mounted) return;
    clearTimeout(this._debounceTimer);
    this._unbindEvents();
    this.container.innerHTML = '';
    this._mounted = false;
    this._elements = {};
    this._results = [];
    this._selectedIndex = -1;
    this._lastQuery = '';
    this._didEnrichOnReady = false;
  }

  /**
   * Kick off semantic init without awaiting. Safe to call repeatedly —
   * HybridSearch.initSemantic() is promise-cached per instance.
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
          ${this.showSemanticHint ? 'AI · fuzzy' : ''}
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

  /**
   * Focus search when safe: skip open modals and other text fields, but allow
   * taking focus from buttons after mount.
   */
  _tryAutofocus() {
    if (!this.autofocus || !this._elements.input) return;
    const ae = document.activeElement;
    if (ae?.closest?.('dialog, [role="dialog"], [aria-modal="true"]')) return;
    if (ae && ae !== this._elements.input) {
      const tag = ae.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        ae.isContentEditable
      ) {
        return;
      }
    }
    this._elements.input.focus({ preventScroll: true });
  }

  // ── Event Handlers ───────────────────────────────────────────────────

  _onInput(e) {
    this._scheduleSearch(e.target.value);
  }

  _onKeyDown(e) {
    const { dropdown, input } = this._elements;

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
          this._scheduleSearch(input.value, { immediate: true });
        }
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this._scheduleSearch(input.value, { immediate: true });
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
      // Enrich current query once when the model first becomes ready.
      if (!this._didEnrichOnReady && this._lastQuery) {
        this._didEnrichOnReady = true;
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
          this._runSearch(this._lastQuery);
        }, 0);
      }
    } else if (data.stage === 'error') {
      progress.hidden = true;
      progressBar.style.width = '0%';
      progressText.textContent = '';
    }
  }

  // ── Search Execution ─────────────────────────────────────────────────

  _scheduleSearch(rawQuery, { immediate = false } = {}) {
    if (!this.search) return;
    const query = normalizeSearchQuery(rawQuery, {
      maxLength: this.search.queryMaxLength ?? 240,
    });

    clearTimeout(this._debounceTimer);
    this._semanticSeq++;
    this._elements.loader.hidden = true;

    const queryCheck = validateSearchQuery(query, {
      minLength: this.search.queryMinLength ?? 2,
      maxLength: this.search.queryMaxLength ?? 240,
    });
    if (!queryCheck.allowed) {
      this._lastQuery = '';
      this._clearResults();
      return;
    }

    this._lastQuery = query;
    if (immediate) {
      this._runSearch(query, { forceHybrid: true });
      return;
    }
    this._debounceTimer = setTimeout(() => {
      this._runSearch(query);
    }, this.debounceMs);
  }

  async _runSearch(query, { forceHybrid = false } = {}) {
    if (!this.search) return;
    const normalizedQuery = normalizeSearchQuery(query, {
      maxLength: this.search.queryMaxLength ?? 240,
    });
    const queryCheck = validateSearchQuery(normalizedQuery, {
      minLength: this.search.queryMinLength ?? 2,
      maxLength: this.search.queryMaxLength ?? 240,
    });
    if (!queryCheck.allowed) return;

    const useHybrid = forceHybrid || this.search.isSemanticReady();
    const seq = ++this._semanticSeq;
    this._lastQuery = normalizedQuery;
    this._results = [];
    this._selectedIndex = -1;
    this._elements.empty.hidden = true;
    this._elements.results.innerHTML = '';
    this._elements.loader.hidden = false;
    const loaderText = this._elements.loader.querySelector('.vdl-neptune-loader-text');
    if (loaderText) {
      loaderText.textContent = useHybrid ? 'Searching with AI…' : 'Searching…';
    }
    this._elements.dropdown.hidden = false;
    this._elements.input.setAttribute('aria-expanded', 'true');

    try {
      const result = await this.search.search(normalizedQuery, {
        mode: useHybrid ? 'hybrid' : 'fuzzy',
      });
      if (seq !== this._semanticSeq) return;
      this._results = result.merged;
      this._selectedIndex = -1;
      this._elements.loader.hidden = true;
      this._renderResults();
    } catch (err) {
      console.warn('[NeptuneUI] Search error:', err);
      if (seq !== this._semanticSeq) return;
      this._elements.loader.hidden = true;
      const result = await this.search.search(normalizedQuery, { mode: 'fuzzy' });
      if (seq !== this._semanticSeq) return;
      this._results = result.merged;
      this._renderResults();
    } finally {
      if (seq === this._semanticSeq) {
        this._elements.loader.hidden = true;
      }
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
    this._lastQuery = '';
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
const originalMount = HybridSearchDomUI.prototype.mount;
HybridSearchDomUI.prototype.mount = function (...args) {
  injectStyles();
  return originalMount.call(this, ...args);
};


/** @deprecated alias for Playwright harness compatibility */
export { HybridSearchDomUI as NeptuneSearchUI };
