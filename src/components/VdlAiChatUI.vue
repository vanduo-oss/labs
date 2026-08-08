<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  VdButton,
  VdCard,
  VdIcon,
  VdModal,
  VdProgress,
  VdSpinner,
} from '@vanduo-oss/vd3';
import {
  AiChat,
  MODEL_GROUPS,
  MODEL_OPTIONS,
  getModelDisplayName,
  getModelOption,
} from '../../ai-chat.js';
import { labsMarkdownToHtml } from '../../labs-md-to-html.js';

const MODEL_CACHE_FLAG_PREFIX = 'vdl-ai-chat-model-cached:';

const props = defineProps({
  chat: { type: Object, default: null },
});

/**
 * Inference engines (LiteRT / WebLLM WASM) must not live inside Vue reactivity
 * (Proxy breaks bindings) and only one runtime should exist per tab.
 * Keep AiChat as a plain module singleton.
 * @type {AiChat | null}
 */
let chat = null;

const selectedModelId = ref(MODEL_OPTIONS[0].id);
const systemInfo = ref(null);
const loaded = ref(false);
const loading = ref(false);
const progressPct = ref(0);
const progressText = ref('');
const statusText = ref('Offline');
const statusTone = ref('muted');
const fallbackNote = ref('');
const cacheHint = ref('');
const inputText = ref('');
const messages = ref([]);
const streaming = ref(false);
const tokenCount = ref(null);
const clearModalOpen = ref(false);
const storageUsage = ref('—');
const storageQuota = ref('—');
const storagePct = ref(0);
const errorBanner = ref('');
const messagesEl = ref(null);
const stickToBottom = ref(true);

let unsubProgress = null;

const displayTitle = computed(() => `AI Chat (${getModelDisplayName(selectedModelId.value)})`);

const groupedModels = computed(() =>
  MODEL_GROUPS.map((group) => ({
    ...group,
    models: MODEL_OPTIONS.filter((m) => (m.group || 'optional') === group.id).map((model) => {
      const resolved = resolveModelForSystem(model.id);
      return {
        ...model,
        resolved,
        cached: isModelLikelyCached(model.id),
        label: buildOptionLabel(model, resolved),
      };
    }),
  })),
);

function cacheFlagKey(modelId) {
  return `${MODEL_CACHE_FLAG_PREFIX}${modelId}`;
}

function isModelLikelyCached(modelId) {
  try {
    return localStorage.getItem(cacheFlagKey(modelId)) === '1';
  } catch {
    return false;
  }
}

function markModelCached(modelId) {
  try {
    localStorage.setItem(cacheFlagKey(modelId), '1');
  } catch {
    /* ignore */
  }
}

function resolveModelForSystem(modelId) {
  const option = getModelOption(modelId);
  if (!option || !systemInfo.value) {
    return { modelId, changed: false, unavailable: false, reason: '' };
  }
  const missing = (option.requires || []).filter((feature) => {
    if (feature === 'shader-f16') return !systemInfo.value.shaderF16;
    return true;
  });
  if (missing.length && option.fallbackId) {
    return {
      modelId: option.fallbackId,
      changed: true,
      unavailable: false,
      reason: `Using compatibility fallback (${option.fallbackId}) because shader-f16 is not available.`,
    };
  }
  if (missing.length) {
    return {
      modelId,
      changed: false,
      unavailable: true,
      reason: `This model requires ${missing.join(', ')}. Choose another model on this device.`,
    };
  }
  return { modelId, changed: false, unavailable: false, reason: '' };
}

function buildOptionLabel(model, resolved) {
  const flags = [];
  if (model.experimental) flags.push('Experimental');
  if (isModelLikelyCached(model.id)) flags.push('Cached');
  if (resolved.unavailable) flags.push('Unavailable');
  return `${model.label}${flags.length ? ` — ${flags.join(' — ')}` : ''}`;
}

async function detectSystemInfo() {
  const info = {
    webgpuSupported: !!navigator.gpu,
    adapterName: null,
    shaderF16: false,
    error: null,
  };
  if (!navigator.gpu) return info;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      info.error = 'No adapter found';
      return info;
    }
    info.adapterName = adapter.name || 'Unknown adapter';
    info.shaderF16 = !!(adapter.features && adapter.features.has('shader-f16'));
  } catch (err) {
    info.error = err?.message || 'Adapter detection failed';
  }
  return info;
}

function applySelection(modelId) {
  selectedModelId.value = modelId;
  const resolved = resolveModelForSystem(modelId);
  fallbackNote.value = resolved.changed || resolved.unavailable ? resolved.reason : '';
  cacheHint.value = isModelLikelyCached(modelId) || isModelLikelyCached(resolved.modelId)
    ? 'This model looks cached in your browser — reload should skip a full download.'
    : 'First load downloads model weights into browser cache.';
  if (!loaded.value && chat) {
    void chat.setModelId(resolved.modelId).catch(() => {
      /* ignore while loading */
    });
  }
}

function isNearBottom(el, threshold = 80) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function onMessagesScroll() {
  stickToBottom.value = isNearBottom(messagesEl.value);
}

async function scrollToLatest(force = false) {
  await nextTick();
  const el = messagesEl.value;
  if (!el) return;
  if (force || stickToBottom.value) {
    el.scrollTop = el.scrollHeight;
    stickToBottom.value = true;
  }
}

async function refreshStoragePanel() {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage || 0;
      const quota = est.quota || 0;
      storageUsage.value = formatBytes(usage);
      storageQuota.value = quota ? formatBytes(quota) : '—';
      storagePct.value = quota ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
    }
  } catch {
    storageUsage.value = '—';
    storageQuota.value = '—';
    storagePct.value = 0;
  }
}

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function loadModel() {
  if (!chat || loading.value) return;
  const catalogId = selectedModelId.value;
  const resolved = resolveModelForSystem(catalogId);
  if (resolved.unavailable) {
    errorBanner.value = resolved.reason;
    return;
  }
  errorBanner.value = '';
  applySelection(catalogId);
  await chat.setModelId(resolved.modelId, { resetMessages: true });
  // Keep the catalog option selected (fallback IDs are not in the <select>).
  selectedModelId.value = catalogId;
  loading.value = true;
  progressPct.value = 0;
  progressText.value = getModelOption(catalogId)?.backend === 'litert'
    ? 'Initializing LiteRT WebGPU engine…'
    : 'Initializing WebGPU engine…';
  statusTone.value = 'warn';
  statusText.value = 'Loading…';
  try {
    await chat.load();
    markModelCached(catalogId);
    markModelCached(resolved.modelId);
    loaded.value = true;
    statusTone.value = 'ok';
    statusText.value = `Online (${getModelDisplayName(catalogId)})`;
    progressText.value = '';
    stickToBottom.value = true;
    await refreshStoragePanel();
  } catch (err) {
    statusTone.value = 'danger';
    statusText.value = 'Error';
    progressText.value = err?.message || 'Failed to load model.';
    errorBanner.value = progressText.value;
  } finally {
    loading.value = false;
  }
}

async function switchModel() {
  if (!chat || loading.value || streaming.value) return;
  const resolved = resolveModelForSystem(selectedModelId.value);
  if (resolved.unavailable) {
    errorBanner.value = resolved.reason;
    return;
  }
  if (resolved.modelId === chat.modelId && loaded.value) return;
  loaded.value = false;
  messages.value = [];
  tokenCount.value = null;
  stickToBottom.value = true;
  chat.reset();
  await loadModel();
}

async function sendMessage() {
  if (!chat || !loaded.value || streaming.value) return;
  const text = inputText.value.trim();
  if (!text) return;
  errorBanner.value = '';
  inputText.value = '';
  messages.value.push({ role: 'user', content: text });
  messages.value.push({ role: 'assistant', content: '' });
  const assistantIdx = messages.value.length - 1;
  streaming.value = true;
  stickToBottom.value = true;
  await scrollToLatest(true);
  try {
    await chat.generate(
      text,
      (partial) => {
        messages.value[assistantIdx] = { role: 'assistant', content: partial };
        void scrollToLatest();
      },
      (usage) => {
        tokenCount.value = usage?.total_tokens ?? null;
      },
    );
  } catch (err) {
    const msg = err?.message || 'Generation failed.';
    errorBanner.value = msg;
    messages.value[assistantIdx] = {
      role: 'assistant',
      content: `⚠️ ${msg}`,
    };
  } finally {
    streaming.value = false;
    await scrollToLatest(true);
  }
}

function onComposerKeydown(event) {
  if (event.key !== 'Enter') return;
  if (event.shiftKey || event.isComposing) return;
  event.preventDefault();
  sendMessage();
}

function isLikelyModelStorageName(name) {
  return /(webllm|mlc|onnx|wasm|gguf|gemma|llama|qwen|smol|model)/i.test(String(name || ''));
}

async function clearModelStorage() {
  let deletedCacheStores = 0;
  let deletedDatabases = 0;
  let deletedFlags = 0;
  try {
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MODEL_CACHE_FLAG_PREFIX)) toDelete.push(key);
    }
    for (const key of toDelete) {
      localStorage.removeItem(key);
      deletedFlags += 1;
    }
  } catch {
    /* ignore */
  }

  if (typeof caches !== 'undefined' && caches.keys) {
    const keys = await caches.keys();
    for (const key of keys) {
      if (!isLikelyModelStorageName(key)) continue;
      if (await caches.delete(key)) deletedCacheStores += 1;
    }
  }

  if (indexedDB?.databases && indexedDB.deleteDatabase) {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      const name = db?.name;
      if (!name || !isLikelyModelStorageName(name)) continue;
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => {
          deletedDatabases += 1;
          resolve();
        };
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    }
  }

  clearModalOpen.value = false;
  loaded.value = false;
  messages.value = [];
  tokenCount.value = null;
  if (chat) chat.reset();
  statusTone.value = 'muted';
  statusText.value = 'Offline';
  errorBanner.value = `Cleared ${deletedFlags} markers, ${deletedCacheStores} caches, ${deletedDatabases} databases.`;
  await refreshStoragePanel();
}

function renderMarkdown(text) {
  try {
    return labsMarkdownToHtml(String(text || ''));
  } catch {
    return String(text || '');
  }
}

onMounted(async () => {
  // Reuse one AiChat/WebLLM runtime for the tab (HMR / v-if remount safe).
  if (props.chat) chat = props.chat;
  else if (!chat) chat = new AiChat();

  selectedModelId.value = chat.modelId || MODEL_OPTIONS[0].id;
  systemInfo.value = await detectSystemInfo();
  applySelection(selectedModelId.value);
  loaded.value = !!chat.isLoaded?.();
  if (loaded.value) {
    statusTone.value = 'ok';
    statusText.value = `Online (${getModelDisplayName(chat.modelId)})`;
  }
  if (unsubProgress) unsubProgress();
  unsubProgress = chat.onProgress((data) => {
    if (data.stage === 'init') {
      progressText.value = data.message || 'Initializing…';
    } else if (data.stage === 'downloading') {
      progressPct.value = Math.round((data.loaded || 0) * 100);
      progressText.value = data.text || 'Preparing model…';
      statusText.value = `Loading ${progressPct.value}%`;
      statusTone.value = 'warn';
    } else if (data.stage === 'ready') {
      progressPct.value = 100;
      progressText.value = data.message || 'Ready';
    } else if (data.stage === 'error') {
      progressText.value = data.message || 'Error';
      statusTone.value = 'danger';
      statusText.value = 'Error';
    }
  });
  await refreshStoragePanel();
  document.addEventListener('visibilitychange', refreshStoragePanel);
});

onBeforeUnmount(() => {
  // Do not unload the WASM engine here — remount / HMR must reuse the same runtime.
  if (unsubProgress) {
    unsubProgress();
    unsubProgress = null;
  }
  document.removeEventListener('visibilitychange', refreshStoragePanel);
});

watch(
  () => props.chat,
  (next) => {
    if (next) chat = next;
  },
);
</script>

<template>
  <VdCard class="vdl-ai-chat-wrap vdl-card-glow vd-glass">
    <div class="vdl-ai-header">
      <div class="vdl-ai-header-left">
        <VdIcon name="robot" />
        <h3 class="vdl-ai-title">{{ displayTitle }}</h3>
      </div>
      <div class="vdl-ai-header-status">
        <span class="vdl-ai-status-dot" :data-tone="statusTone"></span>
        <span>{{ statusText }}</span>
      </div>
    </div>

    <div v-if="!loaded" class="vdl-ai-setup">
      <VdIcon name="download-simple" class="vdl-ai-setup-icon" />
      <div class="vdl-ai-setup-grid">
        <div class="vdl-ai-setup-col">
          <label class="vdl-form-label" for="vdl-ai-model-select">Model</label>
          <select
            id="vdl-ai-model-select"
            class="vd-select vdl-ai-model-select"
            :value="selectedModelId"
            :disabled="loading"
            @change="applySelection($event.target.value)"
          >
            <optgroup v-for="group in groupedModels" :key="group.id" :label="group.label">
              <option
                v-for="model in group.models"
                :key="model.id"
                :value="model.id"
                :disabled="model.resolved.unavailable"
              >
                {{ model.label }}
              </option>
            </optgroup>
          </select>
          <p v-if="fallbackNote" class="vdl-ai-note">{{ fallbackNote }}</p>
          <p v-if="cacheHint" class="vdl-ai-note">{{ cacheHint }}</p>
          <div class="vdl-ai-cache-badges">
            <span
              v-for="model in MODEL_OPTIONS"
              :key="model.id"
              class="vdl-ai-mini-badge"
              :data-cached="isModelLikelyCached(model.id) ? '1' : '0'"
            >
              {{ model.tier }}
              {{ isModelLikelyCached(model.id) ? 'cached' : 'not cached' }}
            </span>
          </div>
        </div>

        <aside class="vdl-ai-storage-panel" aria-label="Local storage for this site">
          <div class="vdl-ai-storage-title">Storage &amp; memory</div>
          <div class="vd-text-sm vd-text-muted">
            This origin: <strong>{{ storageUsage }}</strong>
          </div>
          <div class="vd-text-sm vd-text-muted">Quota: {{ storageQuota }}</div>
          <div class="vdl-ai-storage-meter" aria-hidden="true">
            <div class="vdl-ai-storage-meter-fill" :style="{ width: storagePct + '%' }"></div>
          </div>
          <p class="vdl-ai-fineprint">
            Includes Cache Storage / IndexedDB for this page. GPU memory is not available to the page.
          </p>
        </aside>
      </div>

      <div class="vdl-ai-system-info">
        <div class="vdl-ai-storage-title">System Info</div>
        <div class="vd-text-sm vd-text-muted">
          WebGPU:
          {{
            systemInfo
              ? systemInfo.webgpuSupported
                ? 'Supported'
                : 'Not supported'
              : 'Checking…'
          }}
        </div>
        <div class="vd-text-sm vd-text-muted">
          GPU: {{ systemInfo?.adapterName || systemInfo?.error || 'Detecting…' }}
        </div>
        <div class="vd-text-sm vd-text-muted">
          shader-f16:
          {{
            systemInfo
              ? systemInfo.shaderF16
                ? 'Supported'
                : 'Unavailable'
              : 'Checking…'
          }}
        </div>
        <div class="vdl-ai-compat-row">
          <span
            v-for="model in MODEL_OPTIONS"
            :key="'compat-' + model.id"
            class="vdl-ai-mini-badge"
            :data-state="
              resolveModelForSystem(model.id).unavailable
                ? 'unavailable'
                : resolveModelForSystem(model.id).changed
                  ? 'fallback'
                  : model.experimental
                    ? 'experimental'
                    : 'native'
            "
          >
            {{ model.tier }}:
            {{
              resolveModelForSystem(model.id).unavailable
                ? 'unavailable'
                : resolveModelForSystem(model.id).changed
                  ? 'fallback'
                  : model.experimental
                    ? 'experimental'
                    : 'native'
            }}
          </span>
        </div>
      </div>

      <p class="vd-text-muted vd-text-sm">
        Gemma 4 is the primary family. Optional small/fast models are available when you need a
        lighter download. Inference stays in your browser.
      </p>

      <div v-if="loading || progressText" class="vdl-ai-progress">
        <VdProgress :value="progressPct" />
        <div class="vd-text-sm vd-text-muted">{{ progressText }}</div>
      </div>

      <p v-if="errorBanner" class="vdl-ai-error" role="alert">{{ errorBanner }}</p>

      <div class="vdl-ai-setup-actions">
        <VdButton variant="primary" :loading="loading" :disabled="loading" @click="loadModel">
          <VdIcon name="download-simple" />
          Load AI Model
        </VdButton>
        <VdButton variant="secondary" :disabled="loading" @click="clearModalOpen = true">
          <VdIcon name="trash" />
          Clear storage
        </VdButton>
      </div>
    </div>

    <div v-else class="vdl-ai-chat-interface">
      <div class="vdl-ai-toolbar">
        <select
          class="vd-select vdl-ai-model-select"
          :value="selectedModelId"
          :disabled="loading || streaming"
          @change="applySelection($event.target.value)"
        >
          <optgroup v-for="group in groupedModels" :key="'live-' + group.id" :label="group.label">
            <option
              v-for="model in group.models"
              :key="'live-' + model.id"
              :value="model.id"
              :disabled="model.resolved.unavailable"
            >
              {{ model.label }}
            </option>
          </optgroup>
        </select>
        <VdButton size="sm" variant="secondary" :disabled="loading || streaming" @click="switchModel">
          Switch model
        </VdButton>
        <VdButton size="sm" variant="ghost" :disabled="loading || streaming" @click="clearModalOpen = true">
          Clear storage
        </VdButton>
      </div>

      <div
        ref="messagesEl"
        class="vdl-ai-messages"
        aria-live="polite"
        @scroll.passive="onMessagesScroll"
      >
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="vdl-ai-message"
          :data-role="msg.role"
        >
          <div class="vdl-ai-message-role">{{ msg.role === 'user' ? 'You' : 'Assistant' }}</div>
          <div class="vdl-ai-message-body" v-html="renderMarkdown(msg.content)"></div>
        </div>
        <div v-if="!messages.length" class="vdl-ai-empty">Ask anything. Answers stay on this device.</div>
      </div>

      <form class="vdl-ai-form" @submit.prevent="sendMessage">
        <textarea
          v-model="inputText"
          class="vdl-ai-input"
          rows="3"
          maxlength="2000"
          placeholder="Message the local model… (Enter to send, Shift+Enter for newline)"
          :disabled="streaming"
          @keydown="onComposerKeydown"
        ></textarea>
        <div class="vdl-ai-form-meta">
          <span class="vd-text-sm vd-text-muted">{{ inputText.length }} / 2000</span>
          <span v-if="tokenCount != null" class="vd-text-sm vd-text-muted">Tokens: {{ tokenCount }}</span>
          <VdButton type="submit" variant="primary" :loading="streaming" :disabled="streaming || !inputText.trim()">
            <VdIcon v-if="!streaming" name="paper-plane-tilt" />
            <VdSpinner v-else size="sm" />
            Send
          </VdButton>
        </div>
      </form>
      <p v-if="errorBanner" class="vdl-ai-error" role="alert">{{ errorBanner }}</p>
    </div>
  </VdCard>

  <VdModal v-model:open="clearModalOpen" title="Clear model storage?" size="md">
    <p>
      This removes Cache Storage / IndexedDB / local markers this chat stored for
      <strong>this site only</strong>. The next load may download again.
    </p>
    <ul>
      <li>Cache Storage entries that look like MLC / WebLLM model files</li>
      <li>Matching IndexedDB databases</li>
      <li>Local “model cached” markers</li>
    </ul>
    <template #footer>
      <VdButton variant="secondary" @click="clearModalOpen = false">Cancel</VdButton>
      <VdButton variant="danger" @click="clearModelStorage">Clear storage</VdButton>
    </template>
  </VdModal>
</template>

<style scoped>
.vdl-ai-chat-wrap {
  width: 100%;
}

.vdl-ai-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.vdl-ai-header-left {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-primary);
}

.vdl-ai-title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.vdl-ai-header-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.vdl-ai-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--text-muted);
}

.vdl-ai-status-dot[data-tone='ok'] {
  background: var(--vd-color-success, #22c55e);
}
.vdl-ai-status-dot[data-tone='warn'] {
  background: var(--vd-color-warning, #f59e0b);
}
.vdl-ai-status-dot[data-tone='danger'] {
  background: var(--vd-color-danger, #ef4444);
}

.vdl-ai-setup {
  padding: 1.25rem 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: stretch;
}

.vdl-ai-setup-icon {
  font-size: 2.5rem;
  color: var(--color-primary);
  align-self: center;
}

.vdl-ai-setup-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.vdl-ai-setup-col,
.vdl-ai-storage-panel,
.vdl-ai-system-info {
  flex: 1 1 16rem;
  min-width: 0;
}

.vdl-ai-storage-panel,
.vdl-ai-system-info {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  padding: 0.85rem;
}

.vdl-ai-storage-title {
  font-weight: 650;
  margin-bottom: 0.45rem;
  color: var(--text-primary);
}

.vdl-form-label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.vdl-ai-model-select {
  width: 100%;
  padding: 0.55rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.vdl-ai-note,
.vdl-ai-fineprint {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.vdl-ai-cache-badges,
.vdl-ai-compat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.vdl-ai-mini-badge {
  font-size: 0.7rem;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.vdl-ai-mini-badge[data-cached='1'],
.vdl-ai-mini-badge[data-state='native'] {
  border-color: rgba(var(--vd-color-success-rgb, 34, 197, 94), 0.45);
  color: var(--vd-color-success, #22c55e);
}

.vdl-ai-mini-badge[data-state='fallback'] {
  border-color: rgba(var(--vd-color-warning-rgb, 245, 158, 11), 0.45);
  color: var(--vd-color-warning, #f59e0b);
}

.vdl-ai-mini-badge[data-state='unavailable'] {
  border-color: rgba(var(--vd-color-danger-rgb, 239, 68, 68), 0.45);
  color: var(--vd-color-danger, #ef4444);
}

.vdl-ai-mini-badge[data-state='experimental'] {
  border-color: rgba(var(--vd-color-info-rgb, 59, 130, 246), 0.45);
  color: var(--vd-color-info, #3b82f6);
}

.vdl-ai-storage-meter {
  margin-top: 0.45rem;
  height: 0.4rem;
  border-radius: 999px;
  background: var(--bg-tertiary, var(--bg-primary));
  overflow: hidden;
}

.vdl-ai-storage-meter-fill {
  height: 100%;
  background: var(--color-primary);
}

.vdl-ai-setup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.vdl-ai-progress {
  display: grid;
  gap: 0.4rem;
}

.vdl-ai-error {
  margin: 0;
  color: var(--vd-color-danger, #ef4444);
  font-size: 0.88rem;
}

.vdl-ai-chat-interface {
  display: flex;
  flex-direction: column;
  min-height: min(62vh, 44rem);
  max-height: 70vh;
}

.vdl-ai-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.vdl-ai-toolbar .vdl-ai-model-select {
  flex: 1 1 14rem;
}

.vdl-ai-messages {
  flex: 1 1 auto;
  overflow: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.vdl-ai-message {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  padding: 0.75rem 0.9rem;
}

.vdl-ai-message[data-role='user'] {
  background: rgba(var(--vd-color-primary-rgb), 0.08);
}

.vdl-ai-message-role {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.vdl-ai-message-body {
  color: var(--text-primary);
  line-height: 1.55;
  font-size: 0.95rem;
}

.vdl-ai-empty {
  color: var(--text-muted);
  text-align: center;
  margin: auto;
}

.vdl-ai-form {
  border-top: 1px solid var(--border-color);
  padding: 0.85rem 1rem 1rem;
  display: grid;
  gap: 0.55rem;
}

.vdl-ai-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 4.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 0.7rem 0.8rem;
  font: inherit;
}

.vdl-ai-form-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  justify-content: flex-end;
}
</style>
