import { labsMarkdownToHtml } from './labs-md-to-html.js';
import {
  buildChatSystemPrompt,
  DEFAULT_LLM_GUARD_PATTERNS,
  validateLlmInput,
} from './guardrails/llm.js';
import { toGuardrailError } from './guardrails/core.js';

/**
 * vd-ai-chat — In-browser AI Chat for Vanduo Labs
 *
 * Provides a headless API (AiChat) and a UI component (AiChatUI)
 * for running Gemma models directly in the browser using WebGPU.
 *
 * @example
 * import { AiChat, AiChatUI } from './ai-chat.js';
 *
 * const chat = new AiChat();
 * const ui = new AiChatUI({ container: document.getElementById('app'), chat });
 * ui.mount();
 */

// ═══════════════════════════════════════════════════════════════════════
// CDN Configuration
// ═══════════════════════════════════════════════════════════════════════

const CDN = {
  webllm: 'https://esm.run/@mlc-ai/web-llm'
};

export const VD_AI_CHAT_VERSION = '0.0.4';

let _webllmModule = null;

const MODEL_OPTIONS = [
  {
    id: 'gemma-2b-it-q4f16_1-MLC',
    label: 'Gemma 2B (~1.5GB) - Fast (Default)',
    tier: 'Fast',
    requires: ['shader-f16'],
    fallbackId: 'gemma-2b-it-q4f32_1-MLC'
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B (~1.6GB) - Balanced',
    tier: 'Balanced',
    requires: [],
    fallbackId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B (~2.3GB) - Quality',
    tier: 'Quality',
    requires: [],
    fallbackId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC'
  },
  {
    id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 Coder 1.5B (~1.6GB) - Coder',
    tier: 'Coder',
    requires: [],
    fallbackId: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC'
  },
  // Gemma 4 E2B temporarily disabled: upstream artifact returns empty responses (zero tokens generated).
  // Re-enable when welcoma/gemma-4-E2B-it-q4f16_1-MLC releases a fixed version.
  // {
  //   id: 'gemma-4-E2B-it-q4f16_1-MLC',
  //   label: 'Gemma 4 E2B (~2.7GB)',
  //   tier: 'Gemma 4',
  //   requires: ['shader-f16'],
  //   experimental: true,
  //   overrides: {
  //     context_window_size: 4096,
  //     sliding_window_size: -1
  //   },
  //   modelUrl: 'https://huggingface.co/welcoma/gemma-4-E2B-it-q4f16_1-MLC',
  //   modelLibUrl: 'https://huggingface.co/welcoma/gemma-4-E2B-it-q4f16_1-MLC/resolve/main/libs/gemma-4-E2B-it-q4f16_1-MLC-webgpu.wasm'
  // }
];

const MODEL_CACHE_FLAG_PREFIX = 'vd-ai-chat-model-cached:';
const DEFAULT_GENERATION_CONFIG = {
  max_tokens: 512,
  temperature: 0.7,
  top_p: 0.9,
};

function getModelOption(modelId) {
  return MODEL_OPTIONS.find((m) => m.id === modelId) || null;
}

function getModelDisplayName(modelId) {
  const option = getModelOption(modelId);
  if (!option) return modelId;
  return option.label.split('(~')[0].replace(/\s+-\s+\w+$/, '').trim();
}

function buildModelAppConfig(modelId) {
  const option = getModelOption(modelId);
  if (!option?.modelUrl || !option?.modelLibUrl) return null;
  return {
    model_list: [
      {
        model: option.modelUrl,
        model_id: option.id,
        model_lib: option.modelLibUrl,
        required_features: option.requires || [],
        overrides: option.overrides || undefined
      }
    ]
  };
}

function normalizeCompletionText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((part) => normalizeCompletionText(part)).join('');
  }
  if (value && typeof value === 'object') {
    return normalizeCompletionText(value.text ?? value.content ?? value.value ?? '');
  }
  return '';
}

function extractCompletionChoiceText(choice) {
  if (!choice) return '';
  return (
    normalizeCompletionText(choice.delta?.content) ||
    normalizeCompletionText(choice.delta?.text) ||
    normalizeCompletionText(choice.message?.content) ||
    normalizeCompletionText(choice.text)
  );
}

function extractCompletionResponseText(response) {
  const choice = response?.choices?.[0];
  return extractCompletionChoiceText(choice);
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  const n = Number(bytes);
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v < 10 && u > 0 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}

async function loadWebLLM() {
  if (_webllmModule) return _webllmModule;
  try {
    _webllmModule = await import(/* @vite-ignore */ CDN.webllm);
    return _webllmModule;
  } catch (err) {
    console.error('[AiChat] Failed to load WebLLM from CDN:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FOSS Guardrails (Deterministic Scanner & System Prompt)
// ═══════════════════════════════════════════════════════════════════════

export const InputGuardrail = {
  patterns: DEFAULT_LLM_GUARD_PATTERNS.map((pattern) => pattern.regex),

  validate(text) {
    const result = validateLlmInput({ text });
    if (!result.allowed) {
      return {
        isValid: false,
        reason: result.message,
      };
    }
    return { isValid: true };
  }
};

// ═══════════════════════════════════════════════════════════════════════
// AiChat — Headless API
// ═══════════════════════════════════════════════════════════════════════

export class AiChat {
  static VERSION = VD_AI_CHAT_VERSION;

  constructor(options = {}) {
    // Default to the smaller Gemma 2B model for speed.
    this.modelId = options.modelId || MODEL_OPTIONS[0].id;
    this.engine = null;
    this.messages = [];
    this._progressSubscribers = [];
    this._isLoaded = false;
    this._isLoading = false;
  }

  setModelId(modelId, options = {}) {
    const { resetMessages = false } = options;
    if (this._isLoading) {
      throw new Error('Cannot change model ID while loading.');
    }

    if (this._isLoaded && this.modelId !== modelId) {
      // Best-effort dispose. Some engines expose unload(), others do not.
      try {
        const maybePromise = this.engine?.unload?.();
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {});
        }
      } catch {
        // Ignore teardown errors and continue with fresh load.
      }
      this.engine = null;
      this._isLoaded = false;
    }

    this.modelId = modelId;
    if (resetMessages) {
      this.reset();
    }
  }

  onProgress(callback) {
    this._progressSubscribers.push(callback);
    return () => {
      this._progressSubscribers = this._progressSubscribers.filter(cb => cb !== callback);
    };
  }

  _emitProgress(data) {
    for (const cb of this._progressSubscribers) cb(data);
  }

  async load() {
    if (this._isLoaded) return;
    if (this._isLoading) throw new Error('Model is already loading.');

    this._isLoading = true;
    try {
      const { CreateMLCEngine } = await loadWebLLM();
      
      this._emitProgress({ stage: 'init', message: 'Initializing WebGPU engine...' });

      const appConfig = buildModelAppConfig(this.modelId);
      const engineConfig = {
        initProgressCallback: (progress) => {
          this._emitProgress({
            stage: 'downloading',
            text: progress.text,
            loaded: progress.progress,
          });
        }
      };
      if (appConfig) {
        engineConfig.appConfig = appConfig;
      }

      this.engine = await CreateMLCEngine(this.modelId, engineConfig);
      
      this._isLoaded = true;
      this._emitProgress({ stage: 'ready', message: 'Model loaded and ready!' });
    } catch (err) {
      this._emitProgress({ stage: 'error', message: err.message || 'Failed to load model.' });
      throw err;
    } finally {
      this._isLoading = false;
    }
  }

  isLoaded() {
    return this._isLoaded;
  }

  isLoading() {
    return this._isLoading;
  }

  async generate(userText, onUpdate, onFinish) {
    const guardrailCheck = validateLlmInput({ text: userText });
    if (!guardrailCheck.allowed) {
      throw toGuardrailError(guardrailCheck);
    }

    if (!this._isLoaded || !this.engine) {
      throw new Error('Model not loaded. Call load() first.');
    }

    this.messages.push({ role: 'user', content: userText });

    const payload = [
      { role: 'system', content: buildChatSystemPrompt() },
      ...this.messages
    ];

    try {
      const chunks = await this.engine.chat.completions.create({
        messages: payload,
        ...DEFAULT_GENERATION_CONFIG,
        stream: true,
        stream_options: { include_usage: true }
      });

      let reply = "";
      let usage = null;
      
      for await (const chunk of chunks) {
        if (chunk.usage) usage = chunk.usage;
        const delta = extractCompletionResponseText(chunk);
        if (!delta) continue;
        reply += delta;
        if (onUpdate) onUpdate(reply);
      }

      if (!reply.trim()) {
        const completion = await this.engine.chat.completions.create({
          messages: payload,
          ...DEFAULT_GENERATION_CONFIG,
          stream: false
        });
        reply = extractCompletionResponseText(completion);
        usage = completion?.usage || usage;
        if (reply && onUpdate) onUpdate(reply);
      }

      if (!reply.trim()) {
        throw new Error(`Model ${this.modelId} returned an empty response.`);
      }
      this.messages.push({ role: 'assistant', content: reply });
      if (onFinish && usage) onFinish(usage);
      return reply;
    } catch (err) {
      console.error('[AiChat] Generation error:', err);
      throw err;
    }
  }

  reset() {
    this.messages = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AiChatUI — DOM Component
// ═══════════════════════════════════════════════════════════════════════

export class AiChatUI {
  static VERSION = VD_AI_CHAT_VERSION;

  constructor(options = {}) {
    this.container = options.container;
    this.chat = options.chat || new AiChat();
    this._mounted = false;
    this._elements = {};
    this._systemInfo = null;
    this._selectedModelId = this.chat.modelId;
  }

  mount() {
    if (this._mounted) return;
    if (!this.container) throw new Error('AiChatUI requires a container element');

    this._buildDOM();
    this._bindEvents();
    this._initSystemInfo();
    this._mounted = true;
  }

  destroy() {
    if (!this._mounted) return;
    if (this._clearModalKeyHandler) {
      document.removeEventListener('keydown', this._clearModalKeyHandler);
      this._clearModalKeyHandler = null;
    }
    if (this._storageVisHandler) {
      document.removeEventListener('visibilitychange', this._storageVisHandler);
      this._storageVisHandler = null;
    }
    this.container.innerHTML = '';
    this._mounted = false;
    this._elements = {};
  }

  _buildDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'vd-ai-chat-wrap vd-card vd-card-glow vd-glass';
    
    wrapper.innerHTML = `
      <style>
        @keyframes vd-ai-load-source-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        .vd-ai-load-source-badge {
          display: none;
          align-items: center;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-radius: 999px;
          padding: 0.2rem 0.55rem;
          border: 1px solid;
          line-height: 1.2;
          white-space: nowrap;
        }
        .vd-ai-load-source-badge.vd-ai-load-source-badge--on {
          display: inline-flex;
          animation: vd-ai-load-source-pulse 2.4s ease-in-out infinite;
        }
        .vd-ai-header-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .vd-ai-chat-wrap .vd-ai-setup-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.65rem 0.75rem;
          width: 100%;
          max-width: 40rem;
          margin: 0 0 0.5rem;
        }
        .vd-ai-chat-wrap .vd-ai-chat-composer {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.75rem 1rem 0.2rem;
          border-top: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-primary, #fff);
        }
        .vd-ai-chat-wrap .vd-ai-form {
          display: flex;
          align-items: stretch;
          gap: 0.65rem;
        }
        .vd-ai-chat-wrap .vd-ai-chat-subbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 0.2rem 0 0.45rem;
          font-size: 0.75rem;
        }
        .vd-ai-chat-wrap .vd-ai-clear-storage-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          white-space: nowrap;
          min-height: 2.1rem;
          padding: 0.45rem 0.9rem;
          border-radius: 999px;
          border: 1px solid var(--vd-color-danger, #ef4444);
          background: rgba(239, 68, 68, 0.12);
          color: var(--vd-color-danger, #ef4444);
          font-size: 0.8rem;
          font-weight: 600;
          line-height: 1.2;
        }
        .vd-ai-chat-wrap .vd-ai-clear-storage-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vd-ai-chat-wrap .vd-ai-switch-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          white-space: nowrap;
          min-height: 2.1rem;
          min-width: 8.5rem;
          padding: 0.45rem 0.9rem;
          border-radius: 999px;
          border: 1px solid var(--color-primary, #3b82f6);
          background: rgba(59, 130, 246, 0.12);
          color: var(--color-primary, #3b82f6);
          font-size: 0.8rem;
          font-weight: 700;
          line-height: 1.2;
        }
        .vd-ai-chat-wrap .vd-ai-chat-model-select {
          min-height: 2.1rem;
        }
        .vd-ai-chat-wrap .vd-ai-setup-grid {
          width: 100%;
          max-width: 56rem;
          margin: 0 auto 1.25rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1rem 1.35rem;
          align-items: flex-start;
          text-align: left;
        }
        .vd-ai-chat-wrap .vd-ai-storage-panel {
          background: var(--bg-secondary, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: var(--radius-sm, 0.5rem);
          padding: 0.8rem 0.9rem;
        }
        .vd-ai-chat-wrap .vd-ai-storage-meter-track {
          height: 5px;
          background: var(--bg-primary, #fff);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 0.45rem;
          border: 1px solid var(--border-color, #e2e8f0);
        }
        .vd-ai-chat-wrap .vd-ai-storage-meter-fill {
          height: 100%;
          width: 0%;
          background: var(--color-primary, #3b82f6);
          transition: width 0.35s ease;
        }
        .vd-ai-chat-wrap .vd-ai-modal-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.45);
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
        }
        .vd-ai-chat-wrap .vd-ai-modal-overlay.vd-ai-modal-on {
          display: flex;
        }
        .vd-ai-chat-wrap .vd-ai-modal {
          max-width: 28rem;
          width: 100%;
          max-height: min(90vh, 32rem);
          overflow-y: auto;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #111);
          border-radius: var(--radius-md, 0.5rem);
          border: 1px solid var(--border-color, #e2e8f0);
          padding: 1.2rem 1.35rem;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.18);
        }
        .vd-ai-chat-wrap .vd-ai-modal .vd-ai-modal-list {
          margin: 0.4rem 0 0.25rem 1.1rem;
          padding: 0;
          line-height: 1.5;
          font-size: 0.88rem;
          color: var(--text-muted, #6b7280);
        }
        .vd-ai-chat-wrap .vd-ai-modal .vd-ai-modal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 0.65rem;
          justify-content: flex-end;
          margin-top: 1.2rem;
        }
      </style>
      <div class="vd-card-body vd-ai-card-body" style="display: flex; flex-direction: column; min-height: 0; padding: 0; flex: 1 1 auto;">
        <!-- Header -->
        <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color, #e0e0e0); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="ph ph-robot" style="font-size: 1.5rem; color: var(--color-primary, #3b82f6);"></i>
            <h3 class="vd-ai-title" style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">AI Chat</h3>
          </div>
          <div class="vd-ai-header-status vd-text-sm vd-text-muted">
            <span class="vd-ai-load-source-badge" data-vd-badge-zone="header" aria-live="polite"></span>
            <span>
              <span class="vd-ai-status-indicator" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); margin-right: 4px;"></span>
              <span class="vd-ai-status-text">Offline</span>
            </span>
          </div>
        </div>

        <!-- Setup block (stays visible; chat appears below) -->
        <div class="vd-ai-setup" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 1.5rem 1.5rem; text-align: center; flex: 0 0 auto; width: 100%;">
          <i class="ph ph-download-simple" style="font-size: 3rem; color: var(--color-primary); margin-bottom: 1rem;"></i>
          <h4 style="margin: 0 0 0.9rem; color: var(--text-primary);">Download Model</h4>
          
          <div class="vd-ai-setup-grid">
            <div class="vd-ai-setup-col-model" style="flex: 1 1 17rem; min-width: 0; max-width: 100%;">
              <label for="vd-ai-model-select" class="vd-form-label vd-text-sm vd-text-muted" style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.25rem;">
                <span>Select Model Size:</span>
                <span
                  class="vd-ai-fallback-help"
                  role="img"
                  aria-label="Why fallback"
                  title="Why fallback? Some models require GPU features (like shader-f16). If your device lacks a required feature, vd-ai-chat automatically loads a compatible fallback model."
                  style="display: inline-flex; align-items: center; justify-content: center; width: 1rem; height: 1rem; border-radius: 999px; border: 1px solid var(--border-color, #d1d5db); color: var(--text-muted, #6b7280); font-size: 0.72rem; cursor: help;"
                >?</span>
              </label>
              <select id="vd-ai-model-select" class="vd-select" style="width: 100%; padding: 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary);">
              </select>
              <div class="vd-ai-fallback-note vd-text-sm vd-text-muted" style="margin-top: 0.5rem; display: none;"></div>
              <div class="vd-ai-cache-badges" style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.6rem;"></div>
            </div>
            <aside class="vd-ai-storage-panel" style="flex: 1 1 14rem; min-width: 0; max-width: 100%;" aria-label="Local storage for this site">
              <div class="vd-text-sm" style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.55rem;">Storage &amp; memory</div>
              <div class="vd-text-sm vd-text-muted" style="line-height: 1.5;">This origin: <strong class="vd-ai-storage-usage" style="color: var(--text-primary); font-weight: 600;">—</strong></div>
              <div class="vd-text-sm vd-text-muted" style="line-height: 1.5; margin-top: 0.2rem">Quota: <span class="vd-ai-storage-quota">—</span></div>
              <div class="vd-ai-storage-meter-track" aria-hidden="true"><div class="vd-ai-storage-meter-fill"></div></div>
              <div class="vd-text-sm vd-text-muted vd-ai-js-heap-row" style="margin-top: 0.5rem; line-height: 1.45; display: none;">
                JS heap (approx.): <span class="vd-ai-js-heap">—</span>
              </div>
              <p class="vd-text-sm vd-text-muted" style="margin: 0.5rem 0 0; font-size: 0.72rem; line-height: 1.4;">
                <span class="vd-ai-storage-fineprint">“This origin” includes Cache Storage and IndexedDB for this page. It is an estimate of total usage, not only the model. GPU / WebGPU memory is not available to the page.</span>
              </p>
            </aside>
          </div>

          <div class="vd-ai-system-info" style="margin: 0 0 1.25rem; width: 100%; max-width: 56rem; text-align: left; background: var(--bg-secondary, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-sm, 0.5rem); padding: 0.75rem;">
            <div class="vd-text-sm" style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">System Info</div>
            <div class="vd-text-sm vd-text-muted">WebGPU: <span class="vd-ai-sys-webgpu">Checking...</span></div>
            <div class="vd-text-sm vd-text-muted">GPU: <span class="vd-ai-sys-gpu">Detecting...</span></div>
            <div class="vd-text-sm vd-text-muted">shader-f16: <span class="vd-ai-sys-f16">Checking...</span></div>
            <div class="vd-text-sm vd-text-muted" style="margin-top: 0.5rem;">Compatible tiers:</div>
            <div class="vd-ai-compatible-badges" style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem;"></div>
          </div>

          <p class="vd-text-muted vd-text-sm" style="max-width: 40rem; margin: 0 0 0.5rem; width: 100%;">
            This component downloads the selected model directly into your browser cache and runs it locally using WebGPU.
          </p>
          <p class="vd-text-muted" style="font-size: 0.75rem; max-width: 40rem; margin: 0 0 1.5rem; width: 100%;">
            <em>FOSS guardrails are active. Injection patterns courtesy of LlmGuard, ai-guardian, and llm-prompt-guard.</em>
          </p>
          <p class="vd-ai-cache-hint vd-text-muted vd-text-sm" style="max-width: 40rem; margin: 0 0 0.75rem; width: 100%;"></p>
          <div class="vd-ai-setup-actions">
            <button type="button" class="vd-btn vd-btn-primary vd-ai-load-btn">
              Load AI Model
            </button>
            <button type="button" class="vd-btn vd-ai-switch-btn">
              <i class="ph ph-arrows-clockwise" style="font-size: 0.95rem;"></i>
              <span>Switch Model</span>
            </button>
            <button type="button" class="vd-btn vd-ai-clear-storage-btn" title="No model cache recorded for this site yet" aria-label="Clear downloaded model storage from this browser">
              <i class="ph ph-trash" style="font-size: 0.95rem;" aria-hidden="true"></i>
              <span>Clear Storage</span>
            </button>
          </div>
          <div class="vd-ai-progress-wrap" style="width: 100%; max-width: 28rem; margin-top: 0.75rem; display: none;">
            <div class="vd-ai-progress-badge-row" style="margin: 0; display: none; align-items: center; justify-content: center;">
              <span class="vd-ai-load-source-badge" data-vd-badge-zone="progress" aria-hidden="true"></span>
            </div>
            <div class="vd-text-sm vd-text-muted vd-ai-progress-text" style="margin-bottom: 0.5rem;">Initializing...</div>
            <div style="height: 6px; background: var(--bg-secondary, #f5f5f5); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color, #e0e0e0);">
              <div class="vd-ai-progress-bar" style="height: 100%; width: 0%; background: var(--color-primary, #3b82f6); transition: width 0.1s ease;"></div>
            </div>
          </div>
        </div>

        <!-- Chat (below setup; shown after first successful load) -->
        <div class="vd-ai-chat-interface" style="flex: 0 0 auto; display: none; flex-direction: column; min-height: 50vh; height: min(62vh, 44rem); max-height: 70vh; min-width: 0; border-top: 1px solid var(--border-color, #e0e0e0);">
          <div class="vd-ai-messages" style="flex: 1; overflow-y: auto; min-height: 0; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
            <div class="vd-ai-message vd-ai-assistant">
              <div class="vd-ai-bubble" style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: var(--radius-md); border-top-left-radius: 0; display: inline-block; max-width: 85%; font-size: 0.95rem; line-height: 1.5; color: var(--text-primary);">
                Hello! I am a local AI running in your browser. How can I help you today?
              </div>
            </div>
          </div>
          
          <div class="vd-ai-chat-composer">
            <form class="vd-ai-form">
              <input type="text" class="vd-input vd-ai-input" placeholder="Type a message..." style="flex: 1; min-width: 0; min-height: 2.5rem; padding: 0.5rem 0.75rem;" disabled maxlength="2000">
              <button type="submit" class="vd-btn vd-btn-primary vd-ai-send-btn" style="min-width: 2.7rem; min-height: 2.5rem; padding: 0 0.7rem; display: inline-flex; align-items: center; justify-content: center;" disabled>
                <i class="ph ph-paper-plane-right" style="font-size: 1.1rem;"></i>
              </button>
            </form>
            <div class="vd-ai-chat-subbar" style="color: var(--text-muted, #6b7280); width: 100%;">
              <div class="vd-ai-chat-counters" style="display: inline-flex; align-items: center; gap: 0.75rem; font-size: 0.82rem; margin-left: auto;">
                <span class="vd-ai-char-counter">0 / 2000</span>
                <span class="vd-ai-token-wrap" style="display: none;" title="Context tokens used">
                  <i class="ph ph-cpu" style="vertical-align: middle;"></i> <span class="vd-ai-token-counter">0</span> / ~8K
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="vd-ai-modal-overlay vd-ai-clear-modal-overlay" aria-hidden="true">
        <div
          class="vd-ai-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vd-ai-clear-modal-title"
          aria-describedby="vd-ai-clear-modal-desc"
        >
          <h4 id="vd-ai-clear-modal-title" style="margin: 0 0 0.65rem; color: var(--text-primary, inherit); font-size: 1.05rem;">Clear model storage?</h4>
          <p id="vd-ai-clear-modal-desc" style="margin: 0 0 0.65rem; font-size: 0.9rem; line-height: 1.5; color: var(--text-primary, #374151);">
            This will remove data this chat stored in your browser for <strong>this site only</strong>. The next time you load a model, files may download from the network again.
          </p>
          <ul class="vd-ai-modal-list">
            <li>Cache Storage entries that look like MLC / WebLLM model files</li>
            <li>Matching IndexedDB databases (model / wasm related)</li>
            <li>Local “model cached” markers used by this UI</li>
          </ul>
          <p style="margin: 0.75rem 0 0; font-size: 0.82rem; line-height: 1.45; color: var(--text-muted, #6b7280);">
            It does <strong>not</strong> delete your chat history in this session. Your loaded model will stop working until you download again.
          </p>
          <div class="vd-ai-modal-actions">
            <button type="button" class="vd-btn vd-btn-secondary vd-ai-modal-cancel" style="min-height: 2.25rem;">Cancel</button>
            <button type="button" class="vd-btn vd-ai-modal-confirm" style="min-height: 2.25rem; border: 1px solid var(--vd-color-danger, #ef4444); background: rgba(239, 68, 68, 0.14); color: var(--vd-color-danger, #ef4444); font-weight: 600;">
              Clear storage
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(wrapper);

    this._elements = {
      wrapper,
      cardBody: wrapper.querySelector('.vd-ai-card-body'),
      title: wrapper.querySelector('.vd-ai-title'),
      setupScreen: wrapper.querySelector('.vd-ai-setup'),
      loadBtn: wrapper.querySelector('.vd-ai-load-btn'),
      modelSelect: wrapper.querySelector('#vd-ai-model-select'),
      cacheBadges: wrapper.querySelector('.vd-ai-cache-badges'),
      fallbackNote: wrapper.querySelector('.vd-ai-fallback-note'),
      sysWebGpu: wrapper.querySelector('.vd-ai-sys-webgpu'),
      sysGpu: wrapper.querySelector('.vd-ai-sys-gpu'),
      sysF16: wrapper.querySelector('.vd-ai-sys-f16'),
      compatibleBadges: wrapper.querySelector('.vd-ai-compatible-badges'),
      cacheHint: wrapper.querySelector('.vd-ai-cache-hint'),
      progressWrap: wrapper.querySelector('.vd-ai-progress-wrap'),
      progressBar: wrapper.querySelector('.vd-ai-progress-bar'),
      progressText: wrapper.querySelector('.vd-ai-progress-text'),
      loadSourceBadges: wrapper.querySelectorAll('.vd-ai-load-source-badge'),
      progressBadgeRow: wrapper.querySelector('.vd-ai-progress-badge-row'),
      chatInterface: wrapper.querySelector('.vd-ai-chat-interface'),
      messagesContainer: wrapper.querySelector('.vd-ai-messages'),
      chatForm: wrapper.querySelector('.vd-ai-form'),
      chatInput: wrapper.querySelector('.vd-ai-input'),
      sendBtn: wrapper.querySelector('.vd-ai-send-btn'),
      switchModelBtn: wrapper.querySelector('.vd-ai-switch-btn'),
      clearStorageBtn: wrapper.querySelector('.vd-ai-clear-storage-btn'),
      charCounter: wrapper.querySelector('.vd-ai-char-counter'),
      tokenWrap: wrapper.querySelector('.vd-ai-token-wrap'),
      tokenCounter: wrapper.querySelector('.vd-ai-token-counter'),
      statusIndicator: wrapper.querySelector('.vd-ai-status-indicator'),
      statusText: wrapper.querySelector('.vd-ai-status-text'),
      clearModalOverlay: wrapper.querySelector('.vd-ai-clear-modal-overlay'),
      clearModalCancel: wrapper.querySelector('.vd-ai-modal-cancel'),
      clearModalConfirm: wrapper.querySelector('.vd-ai-modal-confirm'),
      storageUsage: wrapper.querySelector('.vd-ai-storage-usage'),
      storageQuota: wrapper.querySelector('.vd-ai-storage-quota'),
      storageMeterFill: wrapper.querySelector('.vd-ai-storage-meter-fill'),
      jsHeapRow: wrapper.querySelector('.vd-ai-js-heap-row'),
      jsHeap: wrapper.querySelector('.vd-ai-js-heap')
    };

    this._renderModelOptions();
    this._updateModelTitle(this.chat.modelId);
    this._renderModelCacheBadges();
    this._updateSwitchButtonState();
  }

  _bindEvents() {
    const { loadBtn, chatForm, modelSelect, switchModelBtn, clearStorageBtn, chatInput, charCounter } = this._elements;

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        this._handleModelSelectionChange(e.target.value);
      });
    }

    if (switchModelBtn) {
      switchModelBtn.addEventListener('click', () => this._handleSwitchModel());
    }

    if (clearStorageBtn) {
      clearStorageBtn.addEventListener('click', () => this._handleClearModelStorage());
    }

    const { clearModalOverlay, clearModalCancel, clearModalConfirm } = this._elements;
    if (clearModalCancel) {
      clearModalCancel.addEventListener('click', () => this._closeClearStorageModal());
    }
    if (clearModalConfirm) {
      clearModalConfirm.addEventListener('click', () => {
        this._closeClearStorageModal({ restoreFocus: false });
        this._executeClearModelStorage();
      });
    }
    if (clearModalOverlay) {
      clearModalOverlay.addEventListener('click', (e) => {
        if (e.target === clearModalOverlay) this._closeClearStorageModal();
      });
    }

    this._storageVisHandler = () => {
      if (document.visibilityState === 'visible') {
        this._refreshStoragePanel();
      }
    };
    document.addEventListener('visibilitychange', this._storageVisHandler);

    if (chatInput) {
      chatInput.addEventListener('input', (e) => {
        charCounter.textContent = `${e.target.value.length} / 2000`;
      });
    }

    loadBtn.addEventListener('click', () => this._handleLoadModel());
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSendMessage();
    });

    this.chat.onProgress((data) => {
      if (data.stage === 'init') {
        this._applyLoadSourceBadges({ mode: 'unknown', fromDownload: false, message: data.message });
        if (this._elements.progressWrap?.style.display === 'block') {
          this._elements.progressText.textContent = data.message || 'Initializing...';
          this._elements.progressText.style.color = '';
        }
      } else if (data.stage === 'downloading') {
        const source = this._inferLoadSource(data.text);
        const likelyCached = this._isModelLikelyCached(this.chat.modelId);
        let mode = source;
        if (mode === 'unknown' && likelyCached) {
          mode = 'cache';
        }
        this._applyLoadSourceBadges({ mode, fromDownload: true, message: data.text });

        let prefix = 'Preparing model...';
        if (source === 'network') {
          prefix = 'Downloading model from web (first load may take a while).';
        } else if (source === 'cache') {
          prefix = 'Loading model from browser cache (no full re-download).';
        } else if (likelyCached) {
          prefix = 'Loading model from browser cache...';
        } else {
          prefix = 'Preparing model download...';
        }

        this._elements.progressText.textContent = data.text
          ? `${prefix} ${data.text}`
          : prefix;
        this._elements.progressBar.style.width = `${(data.loaded || 0) * 100}%`;
        this._elements.statusIndicator.style.background = 'var(--vd-color-warning, #f59e0b)';
        this._elements.statusText.textContent = `Loading ${Math.round((data.loaded || 0) * 100)}%`;
      } else if (data.stage === 'ready') {
        this._clearLoadSourceBadges();
        this._markModelCached(this.chat.modelId);
        this._markModelCached(this._selectedModelId);
        this._renderModelOptions();
        this._renderModelCacheBadges();
        this._renderCacheHint(this.chat.modelId);
        this._updateModelTitle(this.chat.modelId);
        this._updateSwitchButtonState();
        this._refreshStoragePanel();
        if (this._elements.progressWrap) {
          this._elements.progressWrap.style.display = 'none';
        }
        this._showChatInterface();
      } else if (data.stage === 'error') {
        this._clearLoadSourceBadges();
        this._elements.progressText.textContent = 'Error: ' + data.message;
        this._elements.progressText.style.color = 'var(--vd-color-danger, #ef4444)';
        this._elements.statusIndicator.style.background = 'var(--vd-color-danger, #ef4444)';
        this._elements.statusText.textContent = 'Error';
        this._updateSwitchButtonState();
      }
    });
  }

  async _initSystemInfo() {
    const info = await this._detectSystemInfo();
    this._systemInfo = info;
    this._renderSystemInfo();

    const modelSelect = this._elements.modelSelect;
    if (!modelSelect) return;
    const requested = modelSelect.value || this._selectedModelId || MODEL_OPTIONS[0].id;
    const resolved = this._resolveModelForSystem(requested);
    this._renderModelOptions();
    if (!resolved.unavailable) {
      this.chat.setModelId(resolved.modelId);
    }
    this._renderFallbackNote(resolved);
    this._renderCacheHint(resolved.modelId);
    this._updateModelTitle(resolved.modelId);
    this._syncModelSelectors();
    this._renderModelCacheBadges();
    this._updateSwitchButtonState();
    this._refreshStoragePanel();
  }

  async _refreshStoragePanel() {
    const {
      storageUsage,
      storageQuota,
      storageMeterFill,
      jsHeapRow,
      jsHeap
    } = this._elements;

    if (storageUsage) {
      if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
        try {
          const est = await navigator.storage.estimate();
          const u = est.usage ?? 0;
          const q = est.quota ?? 0;
          storageUsage.textContent = formatBytes(u);
          if (storageQuota) storageQuota.textContent = q > 0 ? formatBytes(q) : '—';
          if (storageMeterFill) {
            if (q > 0) {
              const pct = Math.min(100, Math.round((u / q) * 100));
              storageMeterFill.style.width = `${pct}%`;
            } else {
              storageMeterFill.style.width = '0%';
            }
          }
        } catch {
          storageUsage.textContent = 'Unavailable';
          if (storageQuota) storageQuota.textContent = '—';
          if (storageMeterFill) storageMeterFill.style.width = '0%';
        }
      } else {
        storageUsage.textContent = 'Not available';
        if (storageQuota) storageQuota.textContent = '—';
        if (storageMeterFill) storageMeterFill.style.width = '0%';
      }
    }

    if (jsHeapRow && jsHeap) {
      const m = typeof performance !== 'undefined' && performance.memory;
      if (m) {
        jsHeapRow.style.display = 'block';
        jsHeap.textContent = `${formatBytes(m.usedJSHeapSize)} / ${formatBytes(m.totalJSHeapSize)} (cap ${formatBytes(m.jsHeapSizeLimit)})`;
      } else {
        jsHeapRow.style.display = 'none';
      }
    }
  }

  _openClearStorageModal() {
    if (this._clearModalOpen) return;
    const { clearStorageBtn } = this._elements;
    if (clearStorageBtn?.disabled) return;

    const ov = this._elements.clearModalOverlay;
    if (!ov) {
      this._executeClearModelStorage();
      return;
    }
    this._clearModalOpen = true;
    ov.classList.add('vd-ai-modal-on');
    ov.setAttribute('aria-hidden', 'false');
    this._clearModalKeyHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this._closeClearStorageModal();
      }
    };
    document.addEventListener('keydown', this._clearModalKeyHandler);
    this._elements.clearModalCancel?.focus();
  }

  _closeClearStorageModal(options = {}) {
    const { restoreFocus = true } = options;
    const ov = this._elements.clearModalOverlay;
    if (ov) {
      ov.classList.remove('vd-ai-modal-on');
      ov.setAttribute('aria-hidden', 'true');
    }
    if (this._clearModalKeyHandler) {
      document.removeEventListener('keydown', this._clearModalKeyHandler);
      this._clearModalKeyHandler = null;
    }
    this._clearModalOpen = false;
    if (restoreFocus && this._elements.clearStorageBtn && !this._elements.clearStorageBtn.disabled) {
      this._elements.clearStorageBtn.focus();
    }
  }

  _buildModelOptionLabel(modelId) {
    const option = getModelOption(modelId);
    if (!option) return modelId;
    const cached = this._isModelLikelyCached(modelId);
    const resolved = this._resolveModelForSystem(modelId);
    const flags = [];
    if (option.experimental) flags.push('Experimental');
    if (cached) flags.push('Cached');
    if (resolved.unavailable) flags.push('Unavailable');
    return `${option.label}${flags.length ? ` - ${flags.join(' - ')}` : ''}`;
  }

  _renderModelOptions() {
    const { modelSelect } = this._elements;
    const optionsMarkup = MODEL_OPTIONS.map((m) => {
      const selected = m.id === this._selectedModelId ? 'selected' : '';
      const disabled = this._resolveModelForSystem(m.id).unavailable ? 'disabled' : '';
      return `<option value="${m.id}" ${selected} ${disabled}>${this._buildModelOptionLabel(m.id)}</option>`;
    }).join('');

    if (modelSelect) modelSelect.innerHTML = optionsMarkup;
    this._syncModelSelectors();
  }

  _syncModelSelectors() {
    const { modelSelect } = this._elements;
    if (modelSelect) modelSelect.value = this._selectedModelId;
  }

  _updateModelTitle(modelId) {
    const title = this._elements.title;
    if (!title) return;
    title.textContent = `AI Chat (${getModelDisplayName(modelId)})`;
  }

  _renderModelCacheBadges() {
    const badges = this._elements.cacheBadges;
    if (!badges) return;

    badges.innerHTML = MODEL_OPTIONS.map((model) => {
      const cached = this._isModelLikelyCached(model.id);
      const color = cached ? 'var(--vd-color-success, #22c55e)' : 'var(--text-muted, #6b7280)';
      const status = cached ? 'cached' : 'not cached';
      return `
        <span class="vd-text-sm" title="${model.id}" style="display: inline-flex; align-items: center; gap: 0.2rem; border: 1px solid ${color}; color: ${color}; border-radius: 999px; padding: 0.15rem 0.5rem; line-height: 1.1;">
          ${model.tier}: ${status}
        </span>
      `;
    }).join('');
  }

  async _detectSystemInfo() {
    const info = {
      webgpuSupported: !!navigator.gpu,
      adapterName: null,
      shaderF16: false,
      error: null
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
      return info;
    } catch (err) {
      info.error = err?.message || 'Adapter detection failed';
      return info;
    }
  }

  _resolveModelForSystem(modelId) {
    const option = getModelOption(modelId);
    if (!option) return { modelId, changed: false, unavailable: false, reason: '' };
    if (!this._systemInfo) return { modelId, changed: false, unavailable: false, reason: '' };

    const missingFeatures = (option.requires || []).filter((feature) => {
      if (feature === 'shader-f16') return !this._systemInfo.shaderF16;
      return true;
    });

    if (missingFeatures.length && option.fallbackId) {
      return {
        modelId: option.fallbackId,
        changed: true,
        unavailable: false,
        reason: `Using compatibility fallback (${option.fallbackId}) because shader-f16 is not available on this device.`
      };
    }

    if (missingFeatures.length) {
      return {
        modelId,
        changed: false,
        unavailable: true,
        reason: `This model requires ${missingFeatures.join(', ')} support on your GPU. Choose another model on this device.`
      };
    }

    return { modelId, changed: false, unavailable: false, reason: '' };
  }

  _renderFallbackNote(resolved) {
    const note = this._elements.fallbackNote;
    if (!note) return;

    if (resolved.changed || resolved.unavailable) {
      note.textContent = resolved.reason;
      note.style.display = 'block';
    } else {
      note.style.display = 'none';
      note.textContent = '';
    }
  }

  _cacheFlagKey(modelId) {
    return `${MODEL_CACHE_FLAG_PREFIX}${modelId}`;
  }

  _isModelLikelyCached(modelId) {
    try {
      return localStorage.getItem(this._cacheFlagKey(modelId)) === '1';
    } catch {
      return false;
    }
  }

  _hasAnyModelCacheFlags() {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(MODEL_CACHE_FLAG_PREFIX) && localStorage.getItem(key) === '1') {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  _markModelCached(modelId) {
    try {
      localStorage.setItem(this._cacheFlagKey(modelId), '1');
    } catch {
      // Ignore storage errors (private mode / disabled storage).
    }
  }

  _renderCacheHint(modelId) {
    const hint = this._elements.cacheHint;
    if (!hint) return;
    if (this._isModelLikelyCached(modelId)) {
      hint.textContent = 'This model appears cached in your browser. After refresh, loading is usually local and faster.';
    } else {
      hint.textContent = 'First load downloads model files from the web. Later loads usually use browser cache.';
    }
  }

  _handleModelSelectionChange(requestedModelId) {
    this._selectedModelId = requestedModelId;
    const resolved = this._resolveModelForSystem(requestedModelId);
    this._renderFallbackNote(resolved);
    this._renderCacheHint(resolved.modelId);
    this._syncModelSelectors();

    if (!resolved.unavailable && !this.chat.isLoaded() && !this.chat.isLoading()) {
      this.chat.setModelId(resolved.modelId);
      this._updateModelTitle(resolved.modelId);
    } else if (resolved.unavailable) {
      this._updateModelTitle(requestedModelId);
    }

    this._updateSwitchButtonState();
  }

  _updateClearStorageButtonState() {
    const btn = this._elements.clearStorageBtn;
    if (!btn) return;
    const loading = this.chat.isLoading();
    const canClear = this._hasAnyModelCacheFlags();
    const disabled = loading || !canClear;
    btn.disabled = disabled;
    if (canClear) {
      btn.title = 'Clear cache and IndexedDB model data stored for this site in your browser';
    } else {
      btn.title = 'No stored model is recorded for this site yet. Load a model once, then you can clear.';
    }
  }

  _updateLoadButtonState() {
    const loadBtn = this._elements.loadBtn;
    if (!loadBtn) return;
    const loading = this.chat.isLoading();
    const loaded = this.chat.isLoaded();
    if (loading) {
      loadBtn.disabled = true;
      loadBtn.textContent = 'Loading…';
      return;
    }
    if (loaded) {
      loadBtn.disabled = true;
      loadBtn.textContent = 'Model loaded';
      return;
    }
    const selectedModel = this._elements.modelSelect?.value || this._selectedModelId || MODEL_OPTIONS[0].id;
    const resolved = this._resolveModelForSystem(selectedModel);
    if (resolved.unavailable) {
      loadBtn.disabled = true;
      loadBtn.textContent = 'Unsupported model';
      return;
    }
    loadBtn.disabled = false;
    loadBtn.textContent = 'Load AI Model';
  }

  _updateSwitchButtonState() {
    this._updateClearStorageButtonState();
    this._updateLoadButtonState();
    const button = this._elements.switchModelBtn;
    const modelSelect = this._elements.modelSelect;
    if (!button || !modelSelect) return;

    const hasLoadedModel = this.chat.isLoaded();
    const loading = this.chat.isLoading();
    const resolvedSelected = this._resolveModelForSystem(this._selectedModelId);
    const resolvedSelectedModelId = resolvedSelected.modelId;
    const sameAsActive = resolvedSelectedModelId === this.chat.modelId;

    modelSelect.disabled = loading;
    button.disabled = !hasLoadedModel || loading || sameAsActive || resolvedSelected.unavailable;

    const buttonLabel = button.querySelector('span');
    if (buttonLabel) {
      buttonLabel.textContent = sameAsActive ? 'Current Model' : 'Switch Model';
    } else {
      button.textContent = sameAsActive ? 'Current Model' : 'Switch Model';
    }
    button.style.opacity = sameAsActive ? '0.75' : '1';
  }

  _inferLoadSource(progressText) {
    const text = String(progressText || '').toLowerCase();
    if (!text) return 'unknown';
    if (/(cache|cached|indexeddb|local)/.test(text)) return 'cache';
    if (/(download|fetch|http|https|network|transfer|bytes|kb|mb|gb)/.test(text)) return 'network';
    return 'unknown';
  }

  _applyLoadSourceBadges({ mode, fromDownload, message }) {
    const badges = this._elements.loadSourceBadges;
    if (!badges || !badges.length) return;

    const isNetwork = mode === 'network';
    const isCache = mode === 'cache';
    const label = isNetwork
      ? 'From web'
      : isCache
        ? 'From cache'
        : (fromDownload ? 'Loading' : 'Preparing');

    let title;
    if (isNetwork) {
      title = 'Downloading model from the web. First load may take a while.';
    } else if (isCache) {
      title = 'Loading from browser cache (no full re-download).';
    } else if (message) {
      title = String(message);
    } else {
      title = fromDownload ? 'Loading model…' : 'Starting…';
    }

    const color = isNetwork
      ? 'var(--vd-color-warning, #f59e0b)'
      : isCache
        ? 'var(--vd-color-success, #22c55e)'
        : 'var(--text-muted, #6b7280)';

    for (const el of badges) {
      el.textContent = label;
      el.title = title;
      el.style.borderColor = color;
      el.style.color = color;
      el.classList.add('vd-ai-load-source-badge--on');
    }
    const row = this._elements.progressBadgeRow;
    if (row) {
      row.style.display = 'flex';
      row.style.marginBottom = '0.45rem';
    }
  }

  _clearLoadSourceBadges() {
    const badges = this._elements.loadSourceBadges;
    if (!badges || !badges.length) return;
    for (const el of badges) {
      el.classList.remove('vd-ai-load-source-badge--on');
      el.textContent = '';
      el.removeAttribute('title');
      el.style.borderColor = '';
      el.style.color = '';
    }
    const row = this._elements.progressBadgeRow;
    if (row) {
      row.style.display = 'none';
      row.style.marginBottom = '0';
    }
  }

  _renderSystemInfo() {
    const { sysWebGpu, sysGpu, sysF16, compatibleBadges } = this._elements;
    const info = this._systemInfo;
    if (!info) return;

    if (sysWebGpu) {
      sysWebGpu.textContent = info.webgpuSupported ? 'Supported' : 'Not supported';
      sysWebGpu.style.color = info.webgpuSupported ? 'var(--vd-color-success, #22c55e)' : 'var(--vd-color-danger, #ef4444)';
    }

    if (sysGpu) {
      if (!info.webgpuSupported) {
        sysGpu.textContent = 'Unavailable';
      } else if (info.adapterName) {
        sysGpu.textContent = info.adapterName;
      } else if (info.error) {
        sysGpu.textContent = info.error;
      } else {
        sysGpu.textContent = 'Unknown adapter';
      }
    }

    if (sysF16) {
      if (!info.webgpuSupported) {
        sysF16.textContent = 'Unavailable';
        sysF16.style.color = 'var(--vd-color-danger, #ef4444)';
      } else {
        sysF16.textContent = info.shaderF16 ? 'Available' : 'Unavailable';
        sysF16.style.color = info.shaderF16 ? 'var(--vd-color-success, #22c55e)' : 'var(--vd-color-warning, #f59e0b)';
      }
    }

    if (compatibleBadges) {
      compatibleBadges.innerHTML = MODEL_OPTIONS.map((model) => {
        const resolved = this._resolveModelForSystem(model.id);
        const isNative = !resolved.changed && !resolved.unavailable;
        const statusLabel = resolved.unavailable
          ? 'unavailable'
          : (resolved.changed ? 'fallback' : (model.experimental ? 'experimental' : 'native'));
        const color = isNative
          ? 'var(--vd-color-success, #22c55e)'
          : (resolved.changed ? 'var(--vd-color-warning, #f59e0b)' : 'var(--vd-color-danger, #ef4444)');

        return `
          <span class="vd-text-sm" title="${model.id}" style="display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid ${color}; color: ${color}; border-radius: 999px; padding: 0.15rem 0.5rem; line-height: 1.1;">
            ${model.tier}: ${statusLabel}
          </span>
        `;
      }).join('');
    }
  }

  async _handleLoadModel() {
    if (!navigator.gpu) {
      alert("WebGPU is not supported in this browser. Please use Chrome/Edge 113+ or Safari 121+.");
      return;
    }
    if (this.chat.isLoaded() || this.chat.isLoading()) return;

    const { progressWrap } = this._elements;
    const selectedModel = this._elements.modelSelect?.value || this._selectedModelId || MODEL_OPTIONS[0].id;
    const resolved = this._resolveModelForSystem(selectedModel);
    if (resolved.unavailable) {
      this._renderFallbackNote(resolved);
      this._updateSwitchButtonState();
      return;
    }
    this.chat.setModelId(resolved.modelId);
    this._renderFallbackNote(resolved);
    this._updateModelTitle(resolved.modelId);
    this._updateSwitchButtonState();

    progressWrap.style.display = 'block';
    this._elements.progressText.style.color = '';

    const loadPromise = this.chat.load();
    this._updateSwitchButtonState();
    try {
      await loadPromise;
    } catch (err) {
      console.error(err);
    } finally {
      this._updateSwitchButtonState();
    }
  }

  async _handleSwitchModel() {
    if (!this.chat.isLoaded() || this.chat.isLoading()) return;

    const resolved = this._resolveModelForSystem(this._selectedModelId);
    if (resolved.unavailable || resolved.modelId === this.chat.modelId) {
      this._renderFallbackNote(resolved);
      this._updateSwitchButtonState();
      return;
    }

    this.chat.setModelId(resolved.modelId);
    this._renderFallbackNote(resolved);
    this._renderCacheHint(resolved.modelId);
    this._updateModelTitle(resolved.modelId);

    this._elements.statusIndicator.style.background = 'var(--vd-color-warning, #f59e0b)';
    this._elements.statusText.textContent = `Switching to ${getModelDisplayName(resolved.modelId)}...`;
    this._elements.chatInput.disabled = true;
    this._elements.sendBtn.disabled = true;

    const { progressWrap, progressText, progressBar } = this._elements;
    if (progressWrap) {
      progressWrap.style.display = 'block';
      if (progressText) {
        progressText.textContent = 'Switching model…';
        progressText.style.color = '';
      }
      if (progressBar) progressBar.style.width = '0%';
    }

    try {
      const loadPromise = this.chat.load();
      this._updateSwitchButtonState();
      await loadPromise;
    } catch (err) {
      console.error(err);
      this._elements.chatInput.disabled = false;
      this._elements.sendBtn.disabled = false;
    } finally {
      this._updateSwitchButtonState();
    }
  }

  _showChatInterface() {
    const { cardBody, chatInterface, statusIndicator, statusText, chatInput, sendBtn } = this._elements;
    if (cardBody) {
      // Let the card grow with content so chat can keep a stable minimum viewport height.
      cardBody.style.height = 'auto';
      cardBody.style.minHeight = '0';
    }
    chatInterface.style.minHeight = '50vh';
    chatInterface.style.height = 'min(62vh, 44rem)';
    chatInterface.style.maxHeight = '70vh';
    chatInterface.style.display = 'flex';
    statusIndicator.style.background = 'var(--vd-color-success, #22c55e)';
    statusText.textContent = `Online (${getModelDisplayName(this.chat.modelId)})`;
    chatInput.disabled = false;
    sendBtn.disabled = false;
    this._updateSwitchButtonState();
    chatInput.focus();
  }

  _isLikelyModelStorageName(name) {
    const normalized = String(name || '').toLowerCase();
    return /(webllm|mlc|onnx|wasm|gguf|gemma|llama|qwen|model)/.test(normalized);
  }

  _clearModelCacheFlags() {
    try {
      const toDelete = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(MODEL_CACHE_FLAG_PREFIX)) {
          toDelete.push(key);
        }
      }
      for (const key of toDelete) {
        localStorage.removeItem(key);
      }
      return toDelete.length;
    } catch {
      return 0;
    }
  }

  async _clearModelStorageArtifacts() {
    let deletedCacheStores = 0;
    let deletedDatabases = 0;
    const deletedFlags = this._clearModelCacheFlags();

    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      const keys = await caches.keys();
      for (const key of keys) {
        if (!this._isLikelyModelStorageName(key)) continue;
        const removed = await caches.delete(key);
        if (removed) deletedCacheStores += 1;
      }
    }

    if (
      typeof indexedDB !== 'undefined'
      && typeof indexedDB.databases === 'function'
      && typeof indexedDB.deleteDatabase === 'function'
    ) {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        const name = db?.name;
        if (!name || !this._isLikelyModelStorageName(name)) continue;
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

    return { deletedFlags, deletedCacheStores, deletedDatabases };
  }

  _handleClearModelStorage() {
    this._openClearStorageModal();
  }

  async _executeClearModelStorage() {
    const { clearStorageBtn, statusIndicator, statusText } = this._elements;
    if (clearStorageBtn) clearStorageBtn.disabled = true;
    statusIndicator.style.background = 'var(--vd-color-warning, #f59e0b)';
    statusText.textContent = 'Clearing model storage...';

    try {
      const result = await this._clearModelStorageArtifacts();
      this._renderModelOptions();
      this._renderModelCacheBadges();
      this._renderCacheHint(this._resolveModelForSystem(this._selectedModelId).modelId);
      this._updateSwitchButtonState();
      this._refreshStoragePanel();

      statusIndicator.style.background = this.chat.isLoaded()
        ? 'var(--vd-color-success, #22c55e)'
        : 'var(--text-muted)';
      statusText.textContent = this.chat.isLoaded()
        ? `Online (${getModelDisplayName(this.chat.modelId)})`
        : 'Offline';

      alert(
        `Model storage cleared.\n\nCache flags: ${result.deletedFlags}\nCache stores: ${result.deletedCacheStores}\nIndexedDB stores: ${result.deletedDatabases}`
      );
    } catch (err) {
      console.error(err);
      statusIndicator.style.background = 'var(--vd-color-danger, #ef4444)';
      statusText.textContent = 'Storage clear failed';
      alert('Failed to clear model storage. Please check browser permissions and try again.');
    } finally {
      this._updateSwitchButtonState();
      this._refreshStoragePanel();
    }
  }

  async _handleSendMessage() {
    const { chatInput, sendBtn, messagesContainer, charCounter, tokenWrap, tokenCounter } = this._elements;
    const text = chatInput.value.trim();
    if (!text) return;

    // Add user message
    this._appendMessage('user', text);
    chatInput.value = '';
    charCounter.textContent = '0 / 2000';
    chatInput.disabled = true;
    sendBtn.disabled = true;

    // Run deterministic input guardrail (LlamaFirewall style scanner)
    const guardrailCheck = InputGuardrail.validate(text);
    if (!guardrailCheck.isValid) {
      // Fast reject without invoking the WebGPU model
      this._appendMessage('assistant', `<span style="color: var(--vd-color-danger, #ef4444);"><i class="ph ph-shield-warning" style="vertical-align: middle; margin-right: 4px;"></i> Guardrail blocked request: ${guardrailCheck.reason}</span>`);
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
      return;
    }

    // Add empty assistant bubble
    const assistantBubble = this._appendMessage('assistant', '<span class="vd-ai-typing">...</span>');

    try {
      const finalReply = await this.chat.generate(
        text, 
        (reply) => {
          if (!reply) return;
          assistantBubble.innerHTML = labsMarkdownToHtml(reply.replace(/\\n/g, '\n'));
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        },
        (usage) => {
          if (usage && tokenWrap && tokenCounter) {
            tokenWrap.style.display = 'inline-block';
            tokenCounter.textContent = usage.total_tokens;
            
            // Turn warning color if nearing 8K limit
            if (usage.total_tokens > 7000) {
              tokenWrap.style.color = 'var(--vd-color-warning, #f59e0b)';
            }
          }
        }
      );
      if (finalReply && !assistantBubble.textContent.trim()) {
        assistantBubble.innerHTML = labsMarkdownToHtml(finalReply.replace(/\\n/g, '\n'));
      }
    } catch (err) {
      const message = err?.message || 'Failed to generate response.';
      assistantBubble.innerHTML = `<span style="color: var(--vd-color-danger, #ef4444);">Error: ${this._esc(message)}</span>`;
    } finally {
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  _appendMessage(role, contentHtml) {
    const { messagesContainer } = this._elements;
    const isUser = role === 'user';
    
    const wrapper = document.createElement('div');
    wrapper.className = `vd-ai-message vd-ai-${role}`;
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = isUser ? 'flex-end' : 'flex-start';

    const bubble = document.createElement('div');
    bubble.className = 'vd-ai-bubble';
    bubble.style.padding = '0.75rem 1rem';
    bubble.style.borderRadius = 'var(--radius-md, 0.5rem)';
    bubble.style.maxWidth = '85%';
    bubble.style.fontSize = '0.95rem';
    bubble.style.lineHeight = '1.5';
    bubble.style.color = isUser ? '#fff' : 'var(--text-primary)';
    
    if (isUser) {
      bubble.style.background = 'var(--color-primary, #3b82f6)';
      bubble.style.borderTopRightRadius = '0';
      bubble.innerHTML = this._esc(contentHtml).replace(/\n/g, '<br>');
    } else {
      bubble.style.background = 'var(--bg-secondary, #f5f5f5)';
      bubble.style.border = '1px solid var(--border-color, #e0e0e0)';
      bubble.style.borderTopLeftRadius = '0';
      bubble.innerHTML = contentHtml; // Allow raw HTML for streaming updates
    }

    wrapper.appendChild(bubble);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return bubble;
  }

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

// Inject keyframe animation for typing indicator
const typingStyle = document.createElement('style');
typingStyle.textContent = `
  @keyframes vd-ai-blink {
    0% { opacity: .2; }
    20% { opacity: 1; }
    100% { opacity: .2; }
  }
  .vd-ai-typing span {
    animation-name: vd-ai-blink;
    animation-duration: 1.4s;
    animation-iteration-count: infinite;
    animation-fill-mode: both;
  }
  .vd-ai-typing span:nth-child(2) { animation-delay: .2s; }
  .vd-ai-typing span:nth-child(3) { animation-delay: .4s; }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(typingStyle);
}
