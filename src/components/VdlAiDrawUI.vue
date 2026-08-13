<template>
  <VdCard
    class="vdl-ai-draw-card vdl-card-glow vd-glass"
    :class="{ 'is-fullscreen-host': isFullscreen }"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <Teleport to="body" :disabled="!isFullscreen">
      <div
        ref="stageRef"
        class="vdl-ai-draw-stage"
        :class="{ 'is-fullscreen': isFullscreen }"
        data-testid="ai-draw-stage"
        :data-shape-count="shapeCount"
        :data-fullscreen="isFullscreen ? 'true' : 'false'"
      >
        <!-- Main Split View: Canvas Left (Big), ts-school Sidebar Right -->
        <div class="ai-draw-main">
          <!-- CANVAS PANEL (LEFT) -->
          <div class="ai-draw-canvas-panel">
            <div class="ai-draw-canvas-chrome">
              <div v-if="isFullscreen" class="ai-draw-canvas-chrome-title">
                <VdIcon name="pencil-simple" size="sm" aria-hidden="true" />
                <strong>AI Draw</strong>
                <span class="vd-text-muted vd-text-sm">{{ statusText }}</span>
              </div>
              <VdButton
                v-if="!isFullscreen"
                class="ai-draw-fs-toggle"
                variant="ghost"
                size="sm"
                data-testid="ai-draw-fullscreen-enter"
                aria-label="Enter full screen"
                aria-pressed="false"
                @click="enterFullscreen"
              >
                <VdIcon name="arrows-out" aria-hidden="true" />
                Full screen
              </VdButton>
              <VdButton
                v-else
                class="ai-draw-fs-toggle"
                variant="primary"
                size="sm"
                data-testid="ai-draw-fullscreen-exit"
                aria-label="Exit full screen"
                aria-pressed="true"
                @click="exitFullscreen"
              >
                <VdIcon name="arrows-in" aria-hidden="true" />
                Exit full screen
              </VdButton>
            </div>
            <div class="ai-draw-canvas-wrap">
              <VdDraw
                ref="drawRef"
                :tool="selectedTool"
                :show-grid="true"
                @change="onCanvasChange"
                @ready="onCanvasReady"
              />
              <div v-if="aiDrawing" class="ai-draw-ai-indicator">
                <VdIcon name="sparkle" size="sm" />
                <span>AI is drawing…</span>
              </div>
              <div
                v-if="chipLayout.canvasOverlay"
                class="ai-draw-canvas-prompt-overlay"
                data-testid="ai-draw-canvas-prompt-overlay"
              >
                <p class="ai-draw-canvas-prompt-kicker">Try a prompt the harness can draw</p>
                <div class="ai-draw-prompt-chips" role="list">
                  <button
                    v-for="prompt in examplePrompts"
                    :key="'overlay-' + prompt.id"
                    type="button"
                    class="ai-draw-prompt-chip"
                    role="listitem"
                    :disabled="streaming || loading"
                    :title="prompt.text"
                    @click="applyExamplePrompt(prompt.text)"
                  >
                    {{ prompt.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- CHAT SIDEBAR (RIGHT - ts-school style) -->
          <div
            class="ai-draw-chat-panel"
            aria-label="AI Draw Assistant"
            data-testid="ai-draw-chat-panel"
          >
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
                  Load Gemma 4 locally, then ask your assistant to draw shapes or inspect your
                  canvas.
                </p>
                <p v-if="chipLayout.chatEmptyChips" class="vd-text-sm vd-text-muted">
                  Try an example the harness can actually draw:
                </p>
                <p v-else class="vd-text-sm vd-text-muted">
                  Example prompts are on the canvas and above the input.
                </p>
                <div v-if="chipLayout.chatEmptyChips" class="ai-draw-prompt-chips" role="list">
                  <button
                    v-for="prompt in examplePrompts"
                    :key="prompt.id"
                    type="button"
                    class="ai-draw-prompt-chip"
                    role="listitem"
                    :disabled="streaming || loading"
                    :title="prompt.text"
                    @click="applyExamplePrompt(prompt.text)"
                  >
                    {{ prompt.label }}
                  </button>
                </div>
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
              <div
                v-if="chipLayout.chatTryRow"
                class="ai-draw-prompt-chips ai-draw-prompt-chips--footer"
                role="list"
                aria-label="Try an example"
              >
                <span class="ai-draw-prompt-chips-label">Try</span>
                <button
                  v-for="prompt in examplePrompts"
                  :key="'footer-' + prompt.id"
                  type="button"
                  class="ai-draw-prompt-chip"
                  role="listitem"
                  :disabled="streaming || loading"
                  :title="prompt.text"
                  @click="applyExamplePrompt(prompt.text)"
                >
                  {{ prompt.label }}
                </button>
              </div>
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
      </div>
    </Teleport>
  </VdCard>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
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
  DRAW_TOOL_MAX_ROUNDS,
  DRAW_EXAMPLE_PROMPTS,
  drawPromptChipLayout,
  composeDrawSystemExtra,
  composeDrawPlannerExtra,
  composeDrawExecuteExtra,
  createDrawToolExecutor,
  runDrawTurn,
} from '../demos/draw-tools.js';
import '../styles/ai-draw-demo.css';

const gemmaModels = ref([
  { id: 'gemma-4-E4B-it-web', label: 'Gemma 4 E4B (Recommended)' },
  { id: 'gemma-4-E2B-it-web', label: 'Gemma 4 E2B (Lighter)' },
]);

const examplePrompts = DRAW_EXAMPLE_PROMPTS;

const drawRef = ref(null);
const stageRef = ref(null);
const selectedTool = ref('draw');
const modelId = ref('gemma-4-E4B-it-web');

const loaded = ref(false);
const loading = ref(false);
const streaming = ref(false);
const isFullscreen = ref(false);
const shapeCount = ref(0);

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
/** @type {import('vue').Ref<object | null>} */
const lastDrawPlan = ref(null);

const chipLayout = computed(() =>
  drawPromptChipLayout({
    isFullscreen: isFullscreen.value,
    shapeCount: shapeCount.value,
    messageCount: messages.value.length,
  }),
);

function liveShapes() {
  const editor = drawRef.value;
  if (!editor) return [];
  if (typeof editor.getShapes === 'function') return editor.getShapes() || [];
  if (typeof editor.getInstance === 'function') {
    const inst = editor.getInstance();
    if (inst && typeof inst.getShapes === 'function') return inst.getShapes() || [];
    if (inst && typeof inst.toJSON === 'function') return inst.toJSON()?.shapes || [];
  }
  if (typeof editor.toJSON === 'function') return editor.toJSON()?.shapes || [];
  return [];
}

function refreshShapeCount() {
  shapeCount.value = liveShapes().length;
}

function pingCanvasResize() {
  const editor = drawRef.value;
  const inst = editor && typeof editor.getInstance === 'function' ? editor.getInstance() : editor;
  if (inst && typeof inst.resize === 'function') inst.resize();
}

function onCanvasReady() {
  refreshShapeCount();
  pingCanvasResize();
}

function onCanvasChange() {
  refreshShapeCount();
}

const APP_FULLSCREEN_CLASS = 'ai-draw-app-fullscreen';

function syncAppFullscreenClass(on) {
  document.body.classList.toggle(APP_FULLSCREEN_CLASS, on);
}

async function enterFullscreen() {
  isFullscreen.value = true;
  syncAppFullscreenClass(true);
  await nextTick();
  pingCanvasResize();
}

async function exitFullscreen() {
  isFullscreen.value = false;
  syncAppFullscreenClass(false);
  await nextTick();
  pingCanvasResize();
}

function onStageKeydown(event) {
  if (event.key === 'Escape' && isFullscreen.value) {
    event.preventDefault();
    exitFullscreen();
  }
}

function onWindowResize() {
  if (isFullscreen.value) pingCanvasResize();
}

function applyExamplePrompt(text) {
  const next = String(text || '').trim();
  if (!next) return;
  inputText.value = next;
  if (loaded.value && !loading.value && !streaming.value) {
    send();
  }
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

function applyDrawPhasePrompt(instance, phase) {
  if (!instance) return;
  if (phase === 'planning') {
    instance.registerTools([]);
    instance.setSystemPromptOptions({
      product: 'AI Draw',
      extra: composeDrawPlannerExtra({
        canvasWidth: 1000,
        canvasHeight: 800,
        lastPlan: lastDrawPlan.value,
      }),
    });
    return;
  }
  instance.registerTools([...DRAW_TOOL_DEFS]);
  if (phase === 'drawing') {
    instance.setSystemPromptOptions({
      product: 'AI Draw',
      extra: composeDrawExecuteExtra({
        editor: drawRef.value,
        canvasWidth: 1000,
        canvasHeight: 800,
        selectedTool: selectedTool.value,
        selectedColor: '#000000',
      }),
    });
    return;
  }
  instance.setSystemPromptOptions({
    product: 'AI Draw',
    extra: currentSystemExtra(),
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
    messages.value = [];
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

  const chat = chatRef.value;
  if (!chat) return;
  // Model <select> can change without Reload — refuse rather than run wrong weights.
  if (chat.modelId && chat.modelId !== modelId.value) {
    errorText.value = 'Model selection changed. Click Reload before sending.';
    return;
  }

  inputText.value = '';
  streaming.value = true;
  statusText.value = 'Working...';

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
    applyDrawPhasePrompt(chat, 'fallback');

    const execute = createDrawToolExecutor({
      getEditor: () => drawRef.value,
      getUserHint: () => text,
      canvasSize: { width: 1000, height: 800 },
    });

    aiDrawing.value = true;

    const result = await runDrawTurn({
      userText: text,
      execute,
      canvas: { width: 1000, height: 800 },
      lastPlan: lastDrawPlan.value,
      onPhase: (phase) => {
        if (phase === 'planning') statusText.value = 'Planning...';
        else if (phase === 'drawing') statusText.value = 'Drawing...';
        else statusText.value = 'Generating...';
        applyDrawPhasePrompt(chat, phase);
      },
      generatePlan: (prompt) => chat.generate(prompt),
      generateWithTools: (modelText) =>
        chat.generateWithTools(modelText, {
          execute,
          maxRounds: DRAW_TOOL_MAX_ROUNDS,
          onUpdate: (partial) => {
            messages.value[aiMsgIdx].content = partial;
            scrollToBottom();
          },
        }),
    });

    if (result.lastPlan) lastDrawPlan.value = result.lastPlan;
    else if (result.intent?.wantsClear || result.intent?.clearOnly) lastDrawPlan.value = null;

    const visible = result.reply || '';
    const planLine =
      result.planSummary && result.planSource === 'llm' ? `${result.planSummary}\n\n` : '';
    if (visible === LLM_BLOCK_MESSAGE || visible === LLM_OUTPUT_BLOCK_MESSAGE) {
      messages.value[aiMsgIdx] = {
        role: 'assistant',
        kind: 'policy',
        content:
          "I can only help with drawing and canvas-related tasks. Let me know what you'd like to create!",
      };
    } else if (
      result.modelReply === LLM_BLOCK_MESSAGE ||
      result.modelReply === LLM_OUTPUT_BLOCK_MESSAGE
    ) {
      messages.value[aiMsgIdx] = {
        role: 'assistant',
        kind: 'policy',
        content:
          "I can only help with drawing and canvas-related tasks. Let me know what you'd like to create!",
      };
    } else {
      messages.value[aiMsgIdx].content = `${planLine}${visible}`;
    }
  } catch (err) {
    console.error(err);
    if (err.message?.includes('guardrail') || err.message?.includes('policy')) {
      messages.value[aiMsgIdx].kind = 'policy';
      messages.value[aiMsgIdx].content =
        "I can only help with drawing and canvas-related tasks. Let me know what you'd like to create!";
    } else if (/maxRounds/i.test(err.message || '')) {
      messages.value[aiMsgIdx].content =
        'The drawing tools stopped before finishing. Check the canvas.';
    } else if (
      err.message?.includes('tools unsupported') ||
      err.message?.includes('not support tools')
    ) {
      aiDrawing.value = false;
      try {
        applyDrawPhasePrompt(chat, 'fallback');
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
    if (chatRef.value) applyDrawPhasePrompt(chatRef.value, 'fallback');
    refreshShapeCount();
    scrollToBottom();
    nextTick(() => {
      composerEl.value?.focus();
    });
  }
}

function clearChat() {
  messages.value = [];
  lastDrawPlan.value = null;
  if (chatRef.value && typeof chatRef.value.reset === 'function') {
    chatRef.value.reset();
  }
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

onMounted(() => {
  window.addEventListener('keydown', onStageKeydown);
  window.addEventListener('resize', onWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onStageKeydown);
  window.removeEventListener('resize', onWindowResize);
  if (isFullscreen.value) {
    exitFullscreen();
  }
  if (progressUnsub) {
    progressUnsub();
  }
  if (chatRef.value) {
    chatRef.value.dispose();
  }
});
</script>
