<template>
  <VdCard class="vdl-ai-draw-card vdl-card-glow vd-glass" :aria-busy="loading ? 'true' : 'false'">
    <!-- Main Split View: Canvas Left (Big), ts-school Sidebar Right -->
    <div class="ai-draw-main">
      <!-- CANVAS PANEL (LEFT) -->
      <div class="ai-draw-canvas-panel">
        <div class="ai-draw-canvas-wrap">
          <VdDraw
            ref="drawRef"
            :data="drawDocument"
            :tool="selectedTool"
            :show-grid="true"
            @change="onCanvasChange"
            @ready="onCanvasReady"
          />
          <div v-if="aiDrawing" class="ai-draw-ai-indicator">
            <VdIcon name="sparkle" size="sm" />
            <span>AI is drawing…</span>
          </div>
        </div>
      </div>

      <!-- CHAT SIDEBAR (RIGHT - ts-school style) -->
      <div class="ai-draw-chat-panel" aria-label="AI Draw Assistant">
        <!-- Titlebar Header -->
        <header class="ts-ai-sidebar-header">
          <div class="ts-ai-sidebar-titlebar">
            <VdIcon name="chat-circle" size="sm" aria-hidden="true" />
            <div class="ts-ai-sidebar-title">
              <strong>Ask AI Draw</strong>
              <span class="vd-text-muted vd-text-sm" aria-hidden="true">·</span>
              <span class="vd-text-muted vd-text-sm">{{ statusText }}</span>
            </div>
          </div>
          <VdButton
            variant="ghost"
            size="sm"
            aria-label="Clear chat history"
            :disabled="streaming || messages.length === 0"
            @click="clearChat"
          >
            <VdIcon name="trash" aria-hidden="true" />
          </VdButton>
        </header>

        <!-- Model Selection Bar -->
        <div class="ts-ai-sidebar-modelbar">
          <label for="vdl-ai-draw-model">Model</label>
          <select
            id="vdl-ai-draw-model"
            v-model="modelId"
            class="ts-ai-model-select"
            :disabled="loading || streaming"
          >
            <option v-for="model in gemmaModels" :key="model.id" :value="model.id">
              {{ model.label }}
            </option>
          </select>
          <VdButton
            size="sm"
            class="ts-ai-load-btn"
            :class="{ 'is-awaiting-load': !loaded && !loading }"
            :disabled="loading || streaming"
            :loading="loading"
            @click="loadModel"
          >
            {{ loaded ? 'Reload' : 'Load model' }}
          </VdButton>
        </div>

        <!-- Load Progress Bar -->
        <div
          v-if="loading || progressText"
          class="ts-ai-load-progress"
          role="status"
          aria-live="polite"
        >
          <VdProgress :value="progressPct" />
          <div class="vd-text-sm vd-text-muted">{{ progressText }}</div>
          <p v-if="freezeHint" class="vd-text-sm vd-text-muted" style="font-style: italic">
            {{ freezeHint }}
          </p>
        </div>

        <!-- Error Banner -->
        <p
          v-if="errorText"
          class="vd-text-sm"
          style="padding: 0.5rem 1rem; color: var(--vd-color-danger, #b91c1c)"
        >
          {{ errorText }}
        </p>

        <!-- Messages Feed -->
        <div ref="messagesEl" class="ts-ai-messages">
          <div v-if="messages.length === 0" class="ai-draw-empty-state">
            <VdIcon name="pencil-simple" size="lg" />
            <p>
              Load Gemma 4 locally, then ask your assistant to draw shapes or inspect your canvas.
            </p>
            <p class="vd-text-sm vd-text-muted">
              Example: "Draw a green rectangle at (100, 100)" or "red sine in the center"
            </p>
          </div>
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="ts-ai-bubble"
            :class="[
              msg.role === 'user' ? 'is-user' : 'is-assistant',
              msg.kind === 'policy' ? 'is-policy' : '',
            ]"
          >
            <template v-if="msg.role === 'user'">{{ msg.content }}</template>
            <VdAlert v-else-if="msg.kind === 'policy'" variant="danger" role="alert">
              <VdIcon name="shield-warning" aria-hidden="true" />
              <span>{{ msg.content }}</span>
            </VdAlert>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else class="ts-ai-bubble-md" v-html="renderMarkdown(msg.content)" />
          </div>
        </div>

        <!-- Footer Composer -->
        <footer class="ts-ai-sidebar-footer">
          <div class="ts-ai-composer-row">
            <textarea
              ref="composerEl"
              v-model="inputText"
              rows="2"
              placeholder="Ask the AI to draw something… (Enter to send)"
              :disabled="!loaded || loading || streaming"
              @keydown="onComposerKey"
            />
            <VdButton
              variant="primary"
              :disabled="!loaded || loading || streaming || !inputText.trim()"
              @click="send"
            >
              Send
            </VdButton>
          </div>
        </footer>
      </div>
    </div>
  </VdCard>
</template>

<script setup>
import { ref, shallowRef, computed, reactive, onBeforeUnmount, onMounted, nextTick } from 'vue';
import { VdButton, VdCard, VdIcon, VdProgress, VdAlert } from '@vanduo-oss/vd3';
import { VdDraw } from '@vanduo-oss/vd3-cbun/draw';
import '@vanduo-oss/vd3-cbun/draw/css';
import {
  validateLlmInput,
  LLM_BLOCK_MESSAGE,
  LLM_OUTPUT_BLOCK_MESSAGE,
} from '@vanduo-oss/vdl-ai-chat/guardrails/llm';
import { labsMarkdownToHtml } from '@vanduo-oss/vdl-ai-chat/markdown';

import {
  DRAW_TOOL_DEFS,
  composeDrawSystemExtra,
  createDrawToolExecutor,
} from '../demos/draw-tools.js';
import '../styles/ai-draw-demo.css';

const gemmaModels = ref([
  { id: 'gemma-4-E4B-it-web', label: 'Gemma 4 E4B (Recommended)' },
  { id: 'gemma-4-E2B-it-web', label: 'Gemma 4 E2B (Lighter)' },
]);

const drawRef = ref(null);
const drawDocument = reactive({ shapes: [], viewport: { x: 0, y: 0, scale: 1 } });
const selectedTool = ref('draw');
const modelId = ref('gemma-4-E4B-it-web');

const loaded = ref(false);
const loading = ref(false);
const streaming = ref(false);

const statusText = ref('Model not loaded');
const progressPct = ref(0);
const progressText = ref('');
const freezeHint = ref('');
const errorText = ref('');
const inputText = ref('');

const messages = ref([]);
const messagesEl = ref(null);
const composerEl = ref(null);
const chatRef = shallowRef(null);
const aiDrawing = ref(false);

function onCanvasReady() {
  // VdDraw core instance is ready
}

function onCanvasChange() {
  // Shape count / document changed
}

let progressUnsub = null;
let describeLoadProgressFn = null;

function currentSystemExtra() {
  return composeDrawSystemExtra({
    editor: drawRef.value,
    canvasWidth: 1000,
    canvasHeight: 800,
    selectedTool: selectedTool.value,
    selectedColor: '#000000',
  });
}

async function ensureChat() {
  if (chatRef.value) return chatRef.value;

  const mod = await import('@vanduo-oss/vdl-ai-chat');
  describeLoadProgressFn = mod.describeLoadProgress;

  const chat = new mod.AiChat({
    modelId: modelId.value,
    toolProtocol: 'auto',
    loadLiteRT: async () => import('@litert-lm/core'),
    systemPromptOptions: {
      product: 'AI Draw',
      extra: currentSystemExtra(),
    },
  });

  chat.registerTools([...DRAW_TOOL_DEFS]);
  chatRef.value = chat;
  return chat;
}

function refreshSystemPrompt(instance) {
  instance.setSystemPromptOptions({
    product: 'AI Draw',
    extra: currentSystemExtra(),
  });
}

async function loadModel() {
  errorText.value = '';
  loading.value = true;
  progressPct.value = 0;
  progressText.value = '';
  freezeHint.value = '';
  statusText.value = 'Loading model...';

  try {
    const chat = await ensureChat();

    if (progressUnsub) {
      progressUnsub();
    }

    progressUnsub = chat.onProgress((p) => {
      if (!describeLoadProgressFn) {
        if (typeof p.message === 'string' && p.message) statusText.value = p.message;
        return;
      }
      try {
        const desc = describeLoadProgressFn(p);
        progressPct.value = desc.progressPct;
        progressText.value = desc.progressText;
        statusText.value = desc.statusText;
        freezeHint.value = desc.freezeHint || '';
      } catch {
        if (typeof p.message === 'string' && p.message) statusText.value = p.message;
      }
    });

    await chat.setModelId(modelId.value, { resetMessages: true, force: true });
    refreshSystemPrompt(chat);
    chat.registerTools([...DRAW_TOOL_DEFS]);
    await chat.load();
    if (typeof chat.isLoaded === 'function' && !chat.isLoaded()) {
      throw new Error('Model load did not complete.');
    }
    loaded.value = true;
    statusText.value = 'Ready';
  } catch (err) {
    console.error(err);
    errorText.value = 'Failed to load model: ' + err.message;
    statusText.value = 'Error loading model';
  } finally {
    loading.value = false;
    progressText.value = '';
    freezeHint.value = '';
    if (progressUnsub) {
      progressUnsub();
      progressUnsub = null;
    }
  }
}

async function send() {
  const text = inputText.value.trim();
  if (!text || streaming.value || !loaded.value) return;

  inputText.value = '';
  streaming.value = true;
  statusText.value = 'Generating...';

  messages.value.push({ role: 'user', content: text });
  messages.value.push({ role: 'assistant', content: '' });

  const aiMsgIdx = messages.value.length - 1;
  const scrollToBottom = () => {
    nextTick(() => {
      if (messagesEl.value) {
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
      }
    });
  };

  scrollToBottom();

  const val = validateLlmInput({ text });
  if (!val.allowed) {
    messages.value[aiMsgIdx] = {
      role: 'assistant',
      kind: 'policy',
      content:
        "I can only help with drawing and canvas-related tasks. Let me know what you'd like to create!",
    };
    streaming.value = false;
    statusText.value = 'Ready';
    scrollToBottom();
    return;
  }

  try {
    const chat = chatRef.value;
    refreshSystemPrompt(chat);

    const execute = createDrawToolExecutor({
      getEditor: () => drawRef.value,
      getUserHint: () => text,
      canvasSize: { width: 1000, height: 800 },
    });

    aiDrawing.value = true;

    await chat.generateWithTools(text, {
      execute,
      maxRounds: 6,
      onUpdate: (partial) => {
        messages.value[aiMsgIdx].content = partial;
        scrollToBottom();
      },
    });

    if (
      messages.value[aiMsgIdx].content === LLM_BLOCK_MESSAGE ||
      messages.value[aiMsgIdx].content === LLM_OUTPUT_BLOCK_MESSAGE
    ) {
      messages.value[aiMsgIdx].kind = 'policy';
      messages.value[aiMsgIdx].content =
        "I can only help with drawing and canvas-related tasks. Let me know what you'd like to create!";
    }
  } catch (err) {
    console.error(err);
    if (err.message?.includes('guardrail') || err.message?.includes('policy')) {
      messages.value[aiMsgIdx].kind = 'policy';
      messages.value[aiMsgIdx].content =
        "I can only help with drawing and canvas-related tasks. Let me know what you'd like to create!";
    } else if (
      err.message?.includes('tools unsupported') ||
      err.message?.includes('not support tools')
    ) {
      aiDrawing.value = false;
      try {
        await chatRef.value.generate(text, (partial) => {
          messages.value[aiMsgIdx].content = partial;
          scrollToBottom();
        });
      } catch (e) {
        messages.value[aiMsgIdx].content = 'Error generating response.';
      }
    } else {
      messages.value[aiMsgIdx].content = 'Error generating response.';
    }
  } finally {
    streaming.value = false;
    aiDrawing.value = false;
    statusText.value = 'Ready';
    scrollToBottom();
    nextTick(() => {
      composerEl.value?.focus();
    });
  }
}

function clearChat() {
  messages.value = [];
}

function onComposerKey(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}

function renderMarkdown(content) {
  return labsMarkdownToHtml(content);
}

onBeforeUnmount(() => {
  if (progressUnsub) {
    progressUnsub();
  }
  if (chatRef.value) {
    chatRef.value.dispose();
  }
});
</script>
