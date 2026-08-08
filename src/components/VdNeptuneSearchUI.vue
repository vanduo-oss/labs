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
  debounceMs: { type: Number, default: 150 },
  showSemanticHint: { type: Boolean, default: true },
  emptyMessage: {
    type: String,
    default: 'No docs found. Try another query or pick a category filter.',
  },
});

const emit = defineEmits(['result-click']);

const rootEl = ref(null);
const inputEl = ref(null);
const query = ref('');
const results = ref([]);
const selectedIndex = ref(-1);
const dropdownOpen = ref(false);
const loading = ref(false);
const loadingMessage = ref('');
const statusMessage = ref('');
const activeCategory = ref('all');
const categories = ref([]);
const shortQueryHint = ref(false);
const listboxId = `vd-neptune-results-${Math.random().toString(36).slice(2, 9)}`;

let engine = null;
let ownsEngine = false;
let debounceTimer = null;
let semanticSeq = 0;
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
    engine = new NeptuneSearch({
      indexUrl: props.indexUrl,
      vectorsUrl: props.vectorsUrl,
    });
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

async function runFuzzy(rawQuery) {
  const eng = await ensureEngine();
  semanticSeq += 1;
  const seq = semanticSeq;
  loading.value = true;
  loadingMessage.value = 'Searching…';
  statusMessage.value = '';
  openDropdown();
  try {
    const result = await eng.search(rawQuery, { mode: 'fuzzy' });
    if (seq !== semanticSeq) return;
    results.value = result.merged;
    selectedIndex.value = -1;
    shortQueryHint.value = false;
    if (!results.value.length) statusMessage.value = props.emptyMessage;
  } finally {
    if (seq === semanticSeq) {
      loading.value = false;
      loadingMessage.value = '';
    }
  }
}

async function runHybrid(rawQuery) {
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
    openDropdown();
    return;
  }

  clearTimeout(debounceTimer);
  const seq = ++semanticSeq;
  results.value = [];
  selectedIndex.value = -1;
  shortQueryHint.value = false;
  loading.value = true;
  loadingMessage.value = 'Searching with AI…';
  statusMessage.value = '';
  openDropdown();

  try {
    const result = await eng.search(normalized, { mode: 'hybrid' });
    if (seq !== semanticSeq) return;
    results.value = result.merged;
    if (!results.value.length) statusMessage.value = props.emptyMessage;
  } catch (err) {
    console.warn('[VdNeptuneSearchUI] hybrid search failed', err);
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

function onInput() {
  const engMin = engine?.queryMinLength ?? 2;
  const engMax = engine?.queryMaxLength ?? 240;
  const normalized = normalizeSearchQuery(query.value, { maxLength: engMax });
  clearTimeout(debounceTimer);
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
  debounceTimer = setTimeout(() => {
    runFuzzy(normalized);
  }, props.debounceMs);
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
      else runHybrid(query.value);
      return;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    runHybrid(query.value);
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
  await ensureEngine();
  unsubscribeSemantic = engine.onSemanticProgress((data) => {
    if (data.stage === 'loading-model' || data.stage === 'downloading') {
      loading.value = true;
      loadingMessage.value = data.message || 'Loading search model…';
      openDropdown();
    } else if (data.stage === 'ready' || data.stage === 'error') {
      if (!results.value.length) loading.value = false;
      if (data.stage === 'ready') loadingMessage.value = '';
    }
  });

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
  if (unsubscribeSemantic) unsubscribeSemantic();
  engine = null;
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
  <div ref="rootEl" class="vd-neptune-search">
    <div v-if="categories.length" class="vd-neptune-filters" role="list" aria-label="Filter by category">
      <button
        type="button"
        class="vd-neptune-filter-chip"
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
        class="vd-neptune-filter-chip"
        :class="{ 'is-active': activeCategory === cat.name }"
        role="listitem"
        @click="setCategory(cat.name)"
      >
        {{ cat.name }}
        <span class="vd-neptune-filter-count">{{ cat.count }}</span>
      </button>
    </div>

    <div class="vd-neptune-input-wrap">
      <VdIcon name="magnifying-glass" class="vd-neptune-input-icon" aria-hidden="true" />
      <input
        ref="inputEl"
        v-model="query"
        type="search"
        class="vd-neptune-input"
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
      <span v-if="showSemanticHint" class="vd-neptune-hint" aria-hidden="true">
        <kbd>Enter</kbd> AI
      </span>
    </div>

    <div
      :id="listboxId"
      class="vd-neptune-dropdown"
      role="listbox"
      :hidden="!dropdownOpen"
    >
      <div v-if="loading" class="vd-neptune-loader" role="status">
        <VdSpinner size="sm" />
        <span>{{ loadingMessage || 'Searching…' }}</span>
      </div>

      <p
        v-else-if="shortQueryHint || statusMessage"
        class="vd-neptune-empty"
        role="status"
      >
        {{ statusMessage || emptyMessage }}
      </p>

      <div
        v-for="(result, index) in filteredResults"
        :id="`${listboxId}-opt-${index}`"
        :key="result.doc.id"
        class="vd-neptune-result"
        :class="{ 'is-selected': index === selectedIndex }"
        role="option"
        :aria-selected="index === selectedIndex ? 'true' : 'false'"
        tabindex="-1"
        @click="selectResult(result)"
        @mouseenter="selectedIndex = index"
      >
        <div class="vd-neptune-result-header">
          <span class="vd-neptune-result-icon">
            <VdIcon :name="iconName(result.doc)" />
          </span>
          <span class="vd-neptune-result-title">{{ result.doc.title }}</span>
          <span class="vd-neptune-result-trail">
            <span class="vd-neptune-result-category">{{ result.doc.category }}</span>
            <span
              class="vd-neptune-badge"
              :class="
                result.source === 'semantic'
                  ? 'vd-neptune-badge-semantic'
                  : 'vd-neptune-badge-fuzzy'
              "
            >
              {{ result.source === 'semantic' ? 'AI' : 'Fuzzy' }}
            </span>
          </span>
        </div>
        <div v-if="snippetFor(result.doc)" class="vd-neptune-result-body">
          {{ snippetFor(result.doc) }}
        </div>
        <div class="vd-neptune-result-footer">
          <div class="vd-neptune-result-keywords">
            <span
              v-for="kw in (result.doc.keywords || []).slice(0, 3)"
              :key="kw"
              class="vd-neptune-keyword"
              >{{ kw }}</span
            >
          </div>
          <a
            class="vd-neptune-result-link"
            :href="hrefFor(result.doc)"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
            >Open docs →</a
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vd-neptune-search {
  position: relative;
  width: 100%;
}

.vd-neptune-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.85rem;
}

.vd-neptune-filter-chip {
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

.vd-neptune-filter-chip.is-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-alpha-10, rgba(var(--vd-color-primary-rgb), 0.12));
}

.vd-neptune-filter-count {
  opacity: 0.7;
  font-size: 0.72rem;
}

.vd-neptune-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.vd-neptune-input-icon {
  position: absolute;
  left: 0.85rem;
  color: var(--text-muted);
  pointer-events: none;
}

.vd-neptune-input {
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

.vd-neptune-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.vd-neptune-hint {
  position: absolute;
  right: 0.75rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.vd-neptune-hint kbd {
  font: inherit;
  border: 1px solid var(--border-color);
  border-radius: 0.3rem;
  padding: 0.05rem 0.3rem;
  margin-right: 0.2rem;
}

.vd-neptune-dropdown {
  margin-top: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  max-height: min(60vh, 28rem);
  overflow: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

.vd-neptune-dropdown[hidden] {
  display: none !important;
}

.vd-neptune-loader,
.vd-neptune-empty {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 1rem 1.1rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.vd-neptune-result {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}

.vd-neptune-result:last-child {
  border-bottom: 0;
}

.vd-neptune-result.is-selected,
.vd-neptune-result:hover {
  background: var(--bg-secondary);
}

.vd-neptune-result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.vd-neptune-result-icon {
  color: var(--color-primary);
  display: inline-flex;
}

.vd-neptune-result-title {
  font-weight: 650;
  color: var(--text-primary);
  flex: 1 1 auto;
  min-width: 0;
}

.vd-neptune-result-trail {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.vd-neptune-result-category {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.vd-neptune-badge {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
}

.vd-neptune-badge-fuzzy {
  background: rgba(var(--vd-color-info-rgb), 0.18);
  color: var(--vd-color-info);
}

.vd-neptune-badge-semantic {
  background: rgba(var(--vd-color-primary-rgb), 0.18);
  color: var(--color-primary);
}

.vd-neptune-result-body {
  margin-top: 0.4rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.45;
}

.vd-neptune-result-footer {
  margin-top: 0.55rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  align-items: center;
  justify-content: space-between;
}

.vd-neptune-result-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.vd-neptune-keyword {
  font-size: 0.72rem;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.vd-neptune-result-link {
  color: var(--color-primary);
  font-size: 0.8rem;
  text-decoration: none;
  white-space: nowrap;
}

.vd-neptune-result-link:hover {
  text-decoration: underline;
}

@media (max-width: 600px) {
  .vd-neptune-input {
    padding-right: 3.5rem;
  }

  .vd-neptune-hint {
    font-size: 0.65rem;
  }
}
</style>
