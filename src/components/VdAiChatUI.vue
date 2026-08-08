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

const MODEL_CACHE_FLAG_PREFIX = 'vd-ai-chat-model-cached:';

const props = defineProps({
  chat: { type: Object, default: null },
});

const engine = ref(null);
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
  cacheHint.value = isModelLikelyCached(resolved.modelId)
    ? 'This model looks cached in your browser — reload should skip a full download.'
    : 'First load downloads model weights into browser cache.';
  if (!loaded.value && engine.value) {
    try {
      engine.value.setModelId(resolved.modelId);
    } catch {
      /* ignore while loading */
    }
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
  if (!engine.value || loading.value) return;
  const resolved = resolveModelForSystem(selectedModelId.value);
  if (resolved.unavailable) {
    errorBanner.value = resolved.reason;
    return;
  }
  errorBanner.value = '';
  applySelection(selectedModelId.value);
  engine.value.setModelId(resolved.modelId, { resetMessages: true });
  selectedModelId.value = resolved.modelId;
  loading.value = true;
  progressPct.value = 0;
  progressText.value = 'Initializing WebGPU engine…';
  statusTone.value = 'warn';
  statusText.value = 'Loading…';
  try {
    await engine.value.load();
    markModelCached(resolved.modelId);
    loaded.value = true;
    statusTone.value = 'ok';
    statusText.value = `Online (${getModelDisplayName(resolved.modelId)})`;
    progressText.value = '';
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
  if (!engine.value || loading.value || streaming.value) return;
  const resolved = resolveModelForSystem(selectedModelId.value);
  if (resolved.unavailable) {
    errorBanner.value = resolved.reason;
    return;
  }
  if (resolved.modelId === engine.value.modelId && loaded.value) return;
  loaded.value = false;
  messages.value = [];
  tokenCount.value = null;
  engine.value.reset();
  await loadModel();
}

async function sendMessage() {
  if (!engine.value || !loaded.value || streaming.value) return;
  const text = inputText.value.trim();
  if (!text) return;
  errorBanner.value = '';
  inputText.value = '';
  messages.value.push({ role: 'user', content: text });
  messages.value.push({ role: 'assistant', content: '' });
  const assistantIdx = messages.value.length - 1;
  streaming.value = true;
  try {
    await engine.value.generate(
      text,
      (partial) => {
        messages.value[assistantIdx] = { role: 'assistant', content: partial };
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
    await nextTick();
  }
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
  engine.value = props.chat || new AiChat();
  selectedModelId.value = engine.value.modelId || MODEL_OPTIONS[0].id;
  systemInfo.value = await detectSystemInfo();
  applySelection(selectedModelId.value);
  loaded.value = !!engine.value.isLoaded?.();
  if (loaded.value) {
    statusTone.value = 'ok';
    statusText.value = `Online (${getModelDisplayName(engine.value.modelId)})`;
  }
  unsubProgress = engine.value.onProgress((data) => {
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
  if (unsubProgress) unsubProgress();
  document.removeEventListener('visibilitychange', refreshStoragePanel);
  try {
    engine.value?.engine?.unload?.();
  } catch {
    /* ignore */
  }
  engine.value = null;
});

watch(
  () => props.chat,
  (next) => {
    if (next) engine.value = next;
  },
);
</script>

<template>
  <VdCard class="vd-ai-chat-wrap vd-card-glow vd-glass">
    <div class="vd-ai-header">
      <div class="vd-ai-header-left">
        <VdIcon name="robot" />
        <h3 class="vd-ai-title">{{ displayTitle }}</h3>
      </div>
      <div class="vd-ai-header-status">
        <span class="vd-ai-status-dot" :data-tone="statusTone"></span>
        <span>{{ statusText }}</span>
      </div>
    </div>

    <div v-if="!loaded" class="vd-ai-setup">
      <VdIcon name="download-simple" class="vd-ai-setup-icon" />
      <div class="vd-ai-setup-grid">
        <div class="vd-ai-setup-col">
          <label class="vd-form-label" for="vd-ai-model-select">Model</label>
          <select
            id="vd-ai-model-select"
            class="vd-select vd-ai-model-select"
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
          <p v-if="fallbackNote" class="vd-ai-note">{{ fallbackNote }}</p>
          <p v-if="cacheHint" class="vd-ai-note">{{ cacheHint }}</p>
          <div class="vd-ai-cache-badges">
            <span
              v-for="model in MODEL_OPTIONS"
              :key="model.id"
              class="vd-ai-mini-badge"
              :data-cached="isModelLikelyCached(model.id) ? '1' : '0'"
            >
              {{ model.tier }}
              {{ isModelLikelyCached(model.id) ? 'cached' : 'not cached' }}
            </span>
          </div>
        </div>

        <aside class="vd-ai-storage-panel" aria-label="Local storage for this site">
          <div class="vd-ai-storage-title">Storage &amp; memory</div>
          <div class="vd-text-sm vd-text-muted">
            This origin: <strong>{{ storageUsage }}</strong>
          </div>
          <div class="vd-text-sm vd-text-muted">Quota: {{ storageQuota }}</div>
          <div class="vd-ai-storage-meter" aria-hidden="true">
            <div class="vd-ai-storage-meter-fill" :style="{ width: storagePct + '%' }"></div>
          </div>
          <p class="vd-ai-fineprint">
            Includes Cache Storage / IndexedDB for this page. GPU memory is not available to the page.
          </p>
        </aside>
      </div>

      <div class="vd-ai-system-info">
        <div class="vd-ai-storage-title">System Info</div>
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
        <div class="vd-ai-compat-row">
          <span
            v-for="model in MODEL_OPTIONS"
            :key="'compat-' + model.id"
            class="vd-ai-mini-badge"
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

      <div v-if="loading || progressText" class="vd-ai-progress">
        <VdProgress :value="progressPct" />
        <div class="vd-text-sm vd-text-muted">{{ progressText }}</div>
      </div>

      <p v-if="errorBanner" class="vd-ai-error" role="alert">{{ errorBanner }}</p>

      <div class="vd-ai-setup-actions">
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

    <div v-else class="vd-ai-chat-interface">
      <div class="vd-ai-toolbar">
        <select
          class="vd-select vd-ai-model-select"
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

      <div class="vd-ai-messages" aria-live="polite">
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="vd-ai-message"
          :data-role="msg.role"
        >
          <div class="vd-ai-message-role">{{ msg.role === 'user' ? 'You' : 'Assistant' }}</div>
          <div class="vd-ai-message-body" v-html="renderMarkdown(msg.content)"></div>
        </div>
        <div v-if="!messages.length" class="vd-ai-empty">Ask anything. Answers stay on this device.</div>
      </div>

      <form class="vd-ai-form" @submit.prevent="sendMessage">
        <textarea
          v-model="inputText"
          class="vd-ai-input"
          rows="3"
          maxlength="2000"
          placeholder="Message the local model…"
          :disabled="streaming"
        ></textarea>
        <div class="vd-ai-form-meta">
          <span class="vd-text-sm vd-text-muted">{{ inputText.length }} / 2000</span>
          <span v-if="tokenCount != null" class="vd-text-sm vd-text-muted">Tokens: {{ tokenCount }}</span>
          <VdButton type="submit" variant="primary" :loading="streaming" :disabled="streaming || !inputText.trim()">
            <VdIcon v-if="!streaming" name="paper-plane-tilt" />
            <VdSpinner v-else size="sm" />
            Send
          </VdButton>
        </div>
      </form>
      <p v-if="errorBanner" class="vd-ai-error" role="alert">{{ errorBanner }}</p>
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
.vd-ai-chat-wrap {
  width: 100%;
}

.vd-ai-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.vd-ai-header-left {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-primary);
}

.vd-ai-title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.vd-ai-header-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.vd-ai-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--text-muted);
}

.vd-ai-status-dot[data-tone='ok'] {
  background: var(--vd-color-success, #22c55e);
}
.vd-ai-status-dot[data-tone='warn'] {
  background: var(--vd-color-warning, #f59e0b);
}
.vd-ai-status-dot[data-tone='danger'] {
  background: var(--vd-color-danger, #ef4444);
}

.vd-ai-setup {
  padding: 1.25rem 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: stretch;
}

.vd-ai-setup-icon {
  font-size: 2.5rem;
  color: var(--color-primary);
  align-self: center;
}

.vd-ai-setup-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.vd-ai-setup-col,
.vd-ai-storage-panel,
.vd-ai-system-info {
  flex: 1 1 16rem;
  min-width: 0;
}

.vd-ai-storage-panel,
.vd-ai-system-info {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  padding: 0.85rem;
}

.vd-ai-storage-title {
  font-weight: 650;
  margin-bottom: 0.45rem;
  color: var(--text-primary);
}

.vd-form-label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.vd-ai-model-select {
  width: 100%;
  padding: 0.55rem 0.65rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.vd-ai-note,
.vd-ai-fineprint {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.vd-ai-cache-badges,
.vd-ai-compat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
}

.vd-ai-mini-badge {
  font-size: 0.7rem;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.vd-ai-mini-badge[data-cached='1'],
.vd-ai-mini-badge[data-state='native'] {
  border-color: rgba(var(--vd-color-success-rgb, 34, 197, 94), 0.45);
  color: var(--vd-color-success, #22c55e);
}

.vd-ai-mini-badge[data-state='fallback'] {
  border-color: rgba(var(--vd-color-warning-rgb, 245, 158, 11), 0.45);
  color: var(--vd-color-warning, #f59e0b);
}

.vd-ai-mini-badge[data-state='unavailable'] {
  border-color: rgba(var(--vd-color-danger-rgb, 239, 68, 68), 0.45);
  color: var(--vd-color-danger, #ef4444);
}

.vd-ai-mini-badge[data-state='experimental'] {
  border-color: rgba(var(--vd-color-info-rgb, 59, 130, 246), 0.45);
  color: var(--vd-color-info, #3b82f6);
}

.vd-ai-storage-meter {
  margin-top: 0.45rem;
  height: 0.4rem;
  border-radius: 999px;
  background: var(--bg-tertiary, var(--bg-primary));
  overflow: hidden;
}

.vd-ai-storage-meter-fill {
  height: 100%;
  background: var(--color-primary);
}

.vd-ai-setup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.vd-ai-progress {
  display: grid;
  gap: 0.4rem;
}

.vd-ai-error {
  margin: 0;
  color: var(--vd-color-danger, #ef4444);
  font-size: 0.88rem;
}

.vd-ai-chat-interface {
  display: flex;
  flex-direction: column;
  min-height: min(62vh, 44rem);
  max-height: 70vh;
}

.vd-ai-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.vd-ai-toolbar .vd-ai-model-select {
  flex: 1 1 14rem;
}

.vd-ai-messages {
  flex: 1 1 auto;
  overflow: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.vd-ai-message {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  padding: 0.75rem 0.9rem;
}

.vd-ai-message[data-role='user'] {
  background: rgba(var(--vd-color-primary-rgb), 0.08);
}

.vd-ai-message-role {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.vd-ai-message-body {
  color: var(--text-primary);
  line-height: 1.55;
  font-size: 0.95rem;
}

.vd-ai-empty {
  color: var(--text-muted);
  text-align: center;
  margin: auto;
}

.vd-ai-form {
  border-top: 1px solid var(--border-color);
  padding: 0.85rem 1rem 1rem;
  display: grid;
  gap: 0.55rem;
}

.vd-ai-input {
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

.vd-ai-form-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  justify-content: flex-end;
}
</style>
