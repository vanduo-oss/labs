<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VdIcon, VdSpinner } from '@vanduo-oss/vd3';
import {
  DEFAULT_DOCS_BASE_URL,
  NeptuneSearch,
} from '../../neptune-search.js';
import {
  normalizeSearchQuery,
  safeDocHref,
  sanitizeIconClass,
  validateSearchQuery,
} from '../../guardrails/search.js';

const props = defineProps({
  search: { type: Object, default: null },
  indexUrl: { type: String, default: '/data/search-index.json' },
  vectorsUrl: { type: String, default: '/data/vectors.json' },
  baseUrl: { type: String, default: DEFAULT_DOCS_BASE_URL },
  placeholder: { type: String, default: 'Search vd3 docs…' },
  /** Debounce for auto hybrid/fuzzy search after typing pauses. */
  debounceMs: { type: Number, default: 350 },
  showSemanticHint: { type: Boolean, default: true },
  /** Autofocus the search input on mount when safe (skips modals / other fields). */
  autofocus: { type: Boolean, default: true },
  emptyMessage: {
    type: String,
    default: 'No docs found. Try another query or pick a category filter.',
  },
});

const emit = defineEmits(['result-click']);

/**
 * Reuse one NeptuneSearch per index/vectors URL across HMR / v-if remounts
 * so semantic preload is not restarted from scratch on every remount.
 * @type {import('../../neptune-search.js').NeptuneSearch | null}
 */
let sharedEngine = null;
let sharedEngineKey = '';

const rootEl = ref(null);
const inputEl = ref(null);
const query = ref('');
const results = ref([]);
const selectedIndex = ref(-1);
const dropdownOpen = ref(false);
const loading = ref(false);
const loadingMessage = ref('');
const statusMessage = ref('');
/** Subtle, non-blocking model download status (separate from search loading). */
const modelLoading = ref(false);
const modelProgressMessage = ref('');
const modelProgressPct = ref(0);
const activeCategory = ref('all');
const categories = ref([]);
const shortQueryHint = ref(false);
const listboxId = `vdl-neptune-results-${Math.random().toString(36).slice(2, 9)}`;

let engine = null;
let ownsEngine = false;
let debounceTimer = null;
let semanticSeq = 0;
let didEnrichOnReady = false;
let unsubscribeSemantic = null;
let keyboardHandler = null;
let clickOutsideHandler = null;

const filteredResults = computed(() => {
  if (activeCategory.value === 'all') return results.value;
  return results.value.filter((r) => r.doc?.category === activeCategory.value);
});

const activeDescendant = computed(() =>
  selectedIndex.value >= 0 ? `${listboxId}-opt-${selectedIndex.value}` : '',
);

function snippetFor(doc) {
  const body = String(doc?.bodyText || '').trim();
  if (body) return body.slice(0, 120);
  const chunk = (doc?.chunks || []).find((c) => c?.text)?.text;
  return chunk ? String(chunk).slice(0, 120) : '';
}

function iconName(doc) {
  return sanitizeIconClass(doc?.icon || 'file-text');
}

function hrefFor(doc) {
  return safeDocHref(props.baseUrl, doc?.route || '/');
}

async function ensureEngine() {
  if (engine) return engine;
  if (props.search) {
    engine = props.search;
    ownsEngine = false;
  } else {
    const key = `${props.indexUrl}\0${props.vectorsUrl}`;
    if (sharedEngine && sharedEngineKey === key) {
      engine = sharedEngine;
    } else {
      engine = new NeptuneSearch({
        indexUrl: props.indexUrl,
        vectorsUrl: props.vectorsUrl,
      });
      sharedEngine = engine;
      sharedEngineKey = key;
    }
    ownsEngine = true;
  }
  await engine.initFuzzy();
  const docs = engine.getDocuments();
  const counts = new Map();
  for (const doc of docs) {
    const key = doc.category || 'Other';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  categories.value = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
  return engine;
}

/** Background warm of Transformers.js + MiniLM; does not block typing/fuzzy. */
function preloadSemantic(eng) {
  if (!eng || eng.isSemanticReady?.()) {
    modelLoading.value = false;
    modelProgressMessage.value = '';
    modelProgressPct.value = 0;
    return;
  }
  eng.initSemantic().catch((err) => {
    console.warn('[VdlNeptuneSearchUI] Semantic preload failed:', err?.message || err);
  });
}

function openDropdown() {
  dropdownOpen.value = true;
}

function closeDropdown() {
  dropdownOpen.value = false;
  selectedIndex.value = -1;
}

function clearResultsUI({ keepShortHint = false } = {}) {
  semanticSeq += 1;
  results.value = [];
  selectedIndex.value = -1;
  loading.value = false;
  loadingMessage.value = '';
  if (!keepShortHint) shortQueryHint.value = false;
  statusMessage.value = '';
  dropdownOpen.value = false;
}

/**
 * Focus search when safe: skip open modals and other text fields, but allow
 * taking focus from buttons (e.g. demo card) after Neptune mounts.
 */
function tryAutofocusInput() {
  if (!props.autofocus) return;
  const ae = document.activeElement;
  if (ae?.closest?.('dialog, [role="dialog"], [aria-modal="true"]')) return;
  if (ae && ae !== inputEl.value) {
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
  inputEl.value?.focus({ preventScroll: true });
}

/**
 * Run search for the current query.
 * - Auto path: hybrid when semantic is ready, otherwise fuzzy (live while model loads).
 * - Immediate/Enter path: always hybrid (awaits model if still warming).
 */
async function runSearch(rawQuery, { forceHybrid = false } = {}) {
  const eng = await ensureEngine();
  const normalized = normalizeSearchQuery(rawQuery, {
    maxLength: eng.queryMaxLength ?? 240,
  });
  const check = validateSearchQuery(normalized, {
    minLength: eng.queryMinLength ?? 2,
    maxLength: eng.queryMaxLength ?? 240,
  });
  if (!check.allowed) {
    shortQueryHint.value = Boolean(normalized);
    statusMessage.value = normalized
      ? `Type at least ${eng.queryMinLength ?? 2} characters to search.`
      : '';
    if (normalized) openDropdown();
    else clearResultsUI();
    return;
  }

  const useHybrid = forceHybrid || Boolean(eng.isSemanticReady?.());
  const seq = ++semanticSeq;
  selectedIndex.value = -1;
  shortQueryHint.value = false;
  loading.value = true;
  loadingMessage.value = useHybrid ? 'Searching with AI…' : 'Searching…';
  statusMessage.value = '';
  openDropdown();

  try {
    const result = await eng.search(normalized, {
      mode: useHybrid ? 'hybrid' : 'fuzzy',
    });
    if (seq !== semanticSeq) return;
    results.value = result.merged;
    if (!results.value.length) statusMessage.value = props.emptyMessage;
  } catch (err) {
    console.warn('[VdlNeptuneSearchUI] search failed', err);
    if (seq !== semanticSeq) return;
    const fallback = await eng.search(normalized, { mode: 'fuzzy' });
    if (seq !== semanticSeq) return;
    results.value = fallback.merged;
    if (!results.value.length) statusMessage.value = props.emptyMessage;
  } finally {
    if (seq === semanticSeq) {
      loading.value = false;
      loadingMessage.value = '';
    }
  }
}

function scheduleSearch(rawQuery, { immediate = false } = {}) {
  const engMin = engine?.queryMinLength ?? 2;
  const engMax = engine?.queryMaxLength ?? 240;
  const normalized = normalizeSearchQuery(rawQuery, { maxLength: engMax });
  clearTimeout(debounceTimer);
  // Invalidate in-flight responses while the user keeps typing.
  semanticSeq += 1;
  loading.value = false;
  loadingMessage.value = '';

  const check = validateSearchQuery(normalized, {
    minLength: engMin,
    maxLength: engMax,
  });
  if (!check.allowed) {
    results.value = [];
    selectedIndex.value = -1;
    if (normalized && normalized.length < engMin) {
      shortQueryHint.value = true;
      statusMessage.value = `Type at least ${engMin} characters to search.`;
      openDropdown();
    } else {
      clearResultsUI();
    }
    return;
  }

  shortQueryHint.value = false;
  if (immediate) {
    runSearch(normalized, { forceHybrid: true });
    return;
  }
  debounceTimer = setTimeout(() => {
    runSearch(normalized);
  }, props.debounceMs);
}

function onInput() {
  scheduleSearch(query.value);
}

function onKeyDown(e) {
  const list = filteredResults.value;
  if (dropdownOpen.value && list.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex.value = Math.min(selectedIndex.value + 1, list.length - 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex.value >= 0) selectResult(list[selectedIndex.value]);
      else scheduleSearch(query.value, { immediate: true });
      return;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    scheduleSearch(query.value, { immediate: true });
  }
}

function selectResult(result) {
  if (!result) return;
  emit('result-click', result);
  const href = hrefFor(result.doc);
  if (href && href !== '#') {
    window.open(href, '_blank', 'noopener,noreferrer');
  }
  closeDropdown();
}

function setCategory(name) {
  activeCategory.value = name;
  selectedIndex.value = -1;
  if (query.value.trim()) openDropdown();
}

onMounted(async () => {
  const eng = await ensureEngine();
  unsubscribeSemantic = eng.onSemanticProgress((data) => {
    // Keep model progress out of the results dropdown so typing/fuzzy stay free.
    if (data.stage === 'loading-model' || data.stage === 'downloading') {
      modelLoading.value = true;
      modelProgressMessage.value = data.message || 'Loading search model…';
      if (data.progress?.loaded && data.progress?.total) {
        modelProgressPct.value = Math.round((data.progress.loaded / data.progress.total) * 100);
      } else if (data.stage === 'loading-model') {
        modelProgressPct.value = 0;
      }
    } else if (data.stage === 'ready' || data.stage === 'error') {
      modelLoading.value = false;
      modelProgressMessage.value = '';
      modelProgressPct.value = 0;
      // Enrich current query once when the model first becomes ready.
      if (data.stage === 'ready' && !didEnrichOnReady && query.value.trim()) {
        didEnrichOnReady = true;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          runSearch(query.value);
        }, 0);
      }
    }
  });

  preloadSemantic(eng);
  tryAutofocusInput();

  keyboardHandler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      inputEl.value?.focus();
      openDropdown();
    }
    if (e.key === 'Escape' && dropdownOpen.value) {
      e.preventDefault();
      closeDropdown();
      inputEl.value?.blur();
    }
  };
  document.addEventListener('keydown', keyboardHandler);

  clickOutsideHandler = (e) => {
    if (rootEl.value && !rootEl.value.contains(e.target)) closeDropdown();
  };
  document.addEventListener('click', clickOutsideHandler);
});

onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
  if (keyboardHandler) document.removeEventListener('keydown', keyboardHandler);
  if (clickOutsideHandler) document.removeEventListener('click', clickOutsideHandler);
  if (unsubscribeSemantic) {
    unsubscribeSemantic();
    unsubscribeSemantic = null;
  }
  // Keep sharedEngine alive for HMR / v-if remount; only drop the local ref.
  engine = null;
  didEnrichOnReady = false;
});

watch(
  () => props.search,
  () => {
    engine = null;
    ownsEngine = false;
  },
);

defineExpose({
  focus: () => inputEl.value?.focus(),
  getEngine: () => engine,
});
</script>

<template>
  <div ref="rootEl" class="vdl-neptune-search">
    <div v-if="categories.length" class="vdl-neptune-filters" role="list" aria-label="Filter by category">
      <button
        type="button"
        class="vdl-neptune-filter-chip"
        :class="{ 'is-active': activeCategory === 'all' }"
        role="listitem"
        @click="setCategory('all')"
      >
        All
      </button>
      <button
        v-for="cat in categories"
        :key="cat.name"
        type="button"
        class="vdl-neptune-filter-chip"
        :class="{ 'is-active': activeCategory === cat.name }"
        role="listitem"
        @click="setCategory(cat.name)"
      >
        {{ cat.name }}
        <span class="vdl-neptune-filter-count">{{ cat.count }}</span>
      </button>
    </div>

    <div class="vdl-neptune-input-wrap">
      <VdIcon name="magnifying-glass" class="vdl-neptune-input-icon" aria-hidden="true" />
      <input
        ref="inputEl"
        v-model="query"
        type="search"
        class="vdl-neptune-input"
        :placeholder="placeholder"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        role="combobox"
        aria-label="Search documentation"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        :aria-expanded="dropdownOpen ? 'true' : 'false'"
        :aria-controls="listboxId"
        :aria-activedescendant="activeDescendant"
        :aria-busy="loading ? 'true' : 'false'"
        @input="onInput"
        @keydown="onKeyDown"
        @focus="openDropdown"
      />
      <span v-if="showSemanticHint" class="vdl-neptune-hint" aria-hidden="true">
        AI · fuzzy
      </span>
    </div>

    <div
      :id="listboxId"
      class="vdl-neptune-dropdown"
      role="listbox"
      :hidden="!dropdownOpen"
    >
      <div v-if="loading" class="vdl-neptune-loader" role="status">
        <VdSpinner size="sm" />
        <span>{{ loadingMessage || 'Searching…' }}</span>
      </div>

      <p
        v-else-if="shortQueryHint || statusMessage"
        class="vdl-neptune-empty"
        role="status"
      >
        {{ statusMessage || emptyMessage }}
      </p>

      <div
        v-for="(result, index) in filteredResults"
        :id="`${listboxId}-opt-${index}`"
        :key="result.doc.id"
        class="vdl-neptune-result"
        :class="{ 'is-selected': index === selectedIndex }"
        role="option"
        :aria-selected="index === selectedIndex ? 'true' : 'false'"
        tabindex="-1"
        @click="selectResult(result)"
        @mouseenter="selectedIndex = index"
      >
        <div class="vdl-neptune-result-header">
          <span class="vdl-neptune-result-icon">
            <VdIcon :name="iconName(result.doc)" />
          </span>
          <span class="vdl-neptune-result-title">{{ result.doc.title }}</span>
          <span class="vdl-neptune-result-trail">
            <span class="vdl-neptune-result-category">{{ result.doc.category }}</span>
            <span
              class="vdl-neptune-badge"
              :class="
                result.source === 'semantic'
                  ? 'vdl-neptune-badge-semantic'
                  : 'vdl-neptune-badge-fuzzy'
              "
            >
              {{ result.source === 'semantic' ? 'AI' : 'Fuzzy' }}
            </span>
          </span>
        </div>
        <div v-if="snippetFor(result.doc)" class="vdl-neptune-result-body">
          {{ snippetFor(result.doc) }}
        </div>
        <div class="vdl-neptune-result-footer">
          <div class="vdl-neptune-result-keywords">
            <span
              v-for="kw in (result.doc.keywords || []).slice(0, 3)"
              :key="kw"
              class="vdl-neptune-keyword"
              >{{ kw }}</span
            >
          </div>
          <a
            class="vdl-neptune-result-link"
            :href="hrefFor(result.doc)"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
            >Open docs →</a
          >
        </div>
      </div>
    </div>

    <div
      v-if="modelLoading"
      class="vdl-neptune-progress"
      role="status"
      aria-live="polite"
    >
      <div
        class="vdl-neptune-progress-bar"
        :style="{ width: `${modelProgressPct}%` }"
      />
      <span class="vdl-neptune-progress-text">{{ modelProgressMessage }}</span>
    </div>
  </div>
</template>

<style scoped>
.vdl-neptune-search {
  position: relative;
  width: 100%;
}

.vdl-neptune-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.85rem;
}

.vdl-neptune-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.vdl-neptune-filter-chip.is-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-alpha-10, rgba(var(--vd-color-primary-rgb), 0.12));
}

.vdl-neptune-filter-count {
  opacity: 0.7;
  font-size: 0.72rem;
}

.vdl-neptune-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.vdl-neptune-input-icon {
  position: absolute;
  left: 0.85rem;
  color: var(--text-muted);
  pointer-events: none;
}

.vdl-neptune-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.85rem 4.5rem 0.85rem 2.6rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font: inherit;
  font-size: 1rem;
}

.vdl-neptune-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.vdl-neptune-hint {
  position: absolute;
  right: 0.75rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.vdl-neptune-dropdown {
  margin-top: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  max-height: min(60vh, 28rem);
  overflow: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

.vdl-neptune-dropdown[hidden] {
  display: none !important;
}

.vdl-neptune-loader,
.vdl-neptune-empty {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1rem 1.1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.vdl-neptune-result {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}

.vdl-neptune-result:last-child {
  border-bottom: 0;
}

.vdl-neptune-result.is-selected,
.vdl-neptune-result:hover {
  background: var(--bg-secondary);
}

.vdl-neptune-result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.vdl-neptune-result-icon {
  color: var(--color-primary);
  display: inline-flex;
}

.vdl-neptune-result-title {
  font-weight: 650;
  color: var(--text-primary);
  flex: 1 1 auto;
  min-width: 0;
}

.vdl-neptune-result-trail {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.vdl-neptune-result-category {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.vdl-neptune-badge {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
}

.vdl-neptune-badge-fuzzy {
  background: rgba(var(--vd-color-info-rgb), 0.18);
  color: var(--vd-color-info);
}

.vdl-neptune-badge-semantic {
  background: rgba(var(--vd-color-primary-rgb), 0.18);
  color: var(--color-primary);
}

.vdl-neptune-result-body {
  margin-top: 0.4rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.45;
}

.vdl-neptune-result-footer {
  margin-top: 0.55rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.vdl-neptune-result-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.vdl-neptune-keyword {
  font-size: 0.72rem;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.vdl-neptune-result-link {
  color: var(--color-primary);
  font-size: 0.8rem;
  text-decoration: none;
  white-space: nowrap;
}

.vdl-neptune-result-link:hover {
  text-decoration: underline;
}

.vdl-neptune-progress {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.vdl-neptune-progress-bar {
  height: 4px;
  background: var(--color-primary);
  border-radius: 2px;
  width: 0%;
  transition: width 0.3s ease;
}

.vdl-neptune-progress-text {
  display: block;
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 600px) {
  .vdl-neptune-input {
    padding-right: 3.5rem;
  }

  .vdl-neptune-hint {
    font-size: 0.65rem;
  }
}
</style>
