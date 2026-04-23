import { labsMarkdownToHtml } from './labs-md-to-html.js';

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

export const VD_AI_CHAT_VERSION = '0.0.2';

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
  }
];

const MODEL_CACHE_FLAG_PREFIX = 'vd-ai-chat-model-cached:';

function getModelOption(modelId) {
  return MODEL_OPTIONS.find((m) => m.id === modelId) || null;
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

const FOSS_GUARDRAILS_SYSTEM_PROMPT = `You are an AI assistant running locally in the user's browser, powered by the Vanduo Labs framework.
You must strictly adhere to the following FOSS (Free and Open Source Software) guardrails:
1. Be helpful, harmless, and honest at all times.
2. Refuse to generate any toxic, hateful, discriminatory, or illegal content.
3. If a user asks for dangerous instructions, firmly but politely decline to help with that task.
4. Keep your answers concise, accurate, and objective.
5. Acknowledge your limitations and do not hallucinate information.
`;

/**
 * Deterministic Input Guardrail
 * Incorporates reputable, community-tested regex patterns from open-source security 
 * repositories to block prompt injection attacks, system prompt leaks, and jailbreak payloads.
 * 
 * Acknowledgments & Attribution:
 * The regex patterns below are derived from the excellent open-source work of:
 * - LlmGuard (North-Shore-AI): https://github.com/North-Shore-AI/LlmGuard
 * - ai-guardian (itdove): https://github.com/itdove/ai-guardian
 * - llm-prompt-guard (npm package): https://www.npmjs.com/package/llm-prompt-guard
 */
export const InputGuardrail = {
  patterns: [
    // 1. Instruction Override & Amnesia
    /ignore\s+(all\s+)?(previous|prior|earlier|above)\s+(instructions?|prompts?|commands?)/i,
    /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|commands?)/i,
    /forget\s+(everything|all|your\s+instructions?)/i,
    /bypassing\s+(the\s+)?(filter|guardrails?|safety)/i,

    // 2. System Prompt Extraction (Leakage)
    /(repeat|show|print|output|display|reveal)\s+(your\s+)?(system\s+)?(prompt|instructions|rules|programming)/i,
    /what\s+are\s+your\s+(instructions?|rules|guidelines)\b/i,

    // 3. Mode Switching & Role Manipulation
    /(you\s+are|you're|now\s+in)\s+(debug|developer|admin|god|dan)\s+mode/i,
    /you\s+are\s+(now|no\s+longer)\s+/i,
    /as\s+(a\s+)?(super|admin|root|system)\s+(user|admin|ai)/i,
    /\b(DAN|BetterDAN|Maximum|BasedGPT)\b/i, // Known jailbreak personas

    // 4. Delimiter Injection (Breaking out of context)
    /---\s*(end\s+)?(system|user|assistant)(\s+message|\s+prompt)?/i,

    // 5. Hypothetical & Jailbreak Scenarios
    /in\s+a\s+(fictional|alternate)\s+world/i,
    /for\s+(the\s+sake\s+of\s+)?argument/i,
    /pretend\s+(you|that)/i
  ],

  validate(text) {
    for (const pattern of this.patterns) {
      if (pattern.test(text)) {
        console.warn(`[Security] Input blocked by pattern: ${pattern}`);
        return { 
          isValid: false, 
          reason: "I cannot fulfill this request. It appears to contain instructions that attempt to bypass my safety constraints or extract system configuration." 
        };
      }
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

  setModelId(modelId) {
    if (this._isLoaded || this._isLoading) {
      throw new Error('Cannot change model ID while loading or after loaded.');
    }
    this.modelId = modelId;
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

      this.engine = await CreateMLCEngine(
        this.modelId,
        {
          initProgressCallback: (progress) => {
            this._emitProgress({
              stage: 'downloading',
              text: progress.text,
              loaded: progress.progress,
            });
          }
        }
      );
      
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

  async generate(userText, onUpdate, onFinish) {
    if (!this._isLoaded || !this.engine) {
      throw new Error('Model not loaded. Call load() first.');
    }

    this.messages.push({ role: 'user', content: userText });

    const payload = [
      { role: 'system', content: FOSS_GUARDRAILS_SYSTEM_PROMPT },
      ...this.messages
    ];

    try {
      const chunks = await this.engine.chat.completions.create({
        messages: payload,
        stream: true,
        stream_options: { include_usage: true }
      });

      let reply = "";
      let usage = null;
      
      for await (const chunk of chunks) {
        if (chunk.usage) usage = chunk.usage;
        const delta = chunk.choices[0]?.delta?.content || "";
        reply += delta;
        if (onUpdate) onUpdate(reply);
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
    this.container.innerHTML = '';
    this._mounted = false;
    this._elements = {};
  }

  _buildDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'vd-ai-chat-wrap vd-card vd-card-glow vd-glass';
    
    wrapper.innerHTML = `
      <div class="vd-card-body vd-ai-card-body" style="display: flex; flex-direction: column; padding: 0;">
        <!-- Header -->
        <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color, #e0e0e0); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="ph ph-robot" style="font-size: 1.5rem; color: var(--color-primary, #3b82f6);"></i>
            <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">AI Chat (Gemma)</h3>
          </div>
          <div class="vd-ai-status vd-text-sm vd-text-muted">
            <span class="vd-ai-status-indicator" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); margin-right: 4px;"></span>
            <span class="vd-ai-status-text">Offline</span>
          </div>
        </div>

        <!-- Setup Screen (shown initially) -->
        <div class="vd-ai-setup" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 1.5rem 2rem; text-align: center;">
          <i class="ph ph-download-simple" style="font-size: 3rem; color: var(--color-primary); margin-bottom: 1rem;"></i>
          <h4 style="margin: 0 0 0.5rem; color: var(--text-primary);">Download Model</h4>
          
          <div style="margin: 0 0 1.25rem; max-width: 320px; width: 100%; text-align: left;">
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
              ${MODEL_OPTIONS.map((m) => `<option value="${m.id}" ${m.id === this._selectedModelId ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
            <div class="vd-ai-fallback-note vd-text-sm vd-text-muted" style="margin-top: 0.5rem; display: none;"></div>
          </div>

          <div class="vd-ai-system-info" style="margin: 0 0 1.25rem; max-width: 320px; width: 100%; text-align: left; background: var(--bg-secondary, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-sm, 0.5rem); padding: 0.75rem;">
            <div class="vd-text-sm" style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">System Info</div>
            <div class="vd-text-sm vd-text-muted">WebGPU: <span class="vd-ai-sys-webgpu">Checking...</span></div>
            <div class="vd-text-sm vd-text-muted">GPU: <span class="vd-ai-sys-gpu">Detecting...</span></div>
            <div class="vd-text-sm vd-text-muted">shader-f16: <span class="vd-ai-sys-f16">Checking...</span></div>
            <div class="vd-text-sm vd-text-muted" style="margin-top: 0.5rem;">Compatible tiers:</div>
            <div class="vd-ai-compatible-badges" style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.35rem;"></div>
          </div>

          <p class="vd-text-muted vd-text-sm" style="max-width: 320px; margin: 0 0 0.5rem;">
            This component downloads the selected model directly into your browser cache and runs it locally using WebGPU.
          </p>
          <p class="vd-text-muted" style="font-size: 0.75rem; max-width: 320px; margin: 0 0 1.5rem;">
            <em>FOSS guardrails are active. Injection patterns courtesy of LlmGuard, ai-guardian, and llm-prompt-guard.</em>
          </p>
          <p class="vd-ai-cache-hint vd-text-muted vd-text-sm" style="max-width: 320px; margin: 0 0 1rem;"></p>
          <button type="button" class="vd-btn vd-btn-primary vd-ai-load-btn">
            Load AI Model
          </button>
          
          <div class="vd-ai-progress-wrap" style="width: 100%; max-width: 320px; margin-top: 1.5rem; display: none;">
            <div class="vd-text-sm vd-text-muted vd-ai-progress-text" style="margin-bottom: 0.5rem;">Initializing...</div>
            <div style="height: 6px; background: var(--bg-secondary, #f5f5f5); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color, #e0e0e0);">
              <div class="vd-ai-progress-bar" style="height: 100%; width: 0%; background: var(--color-primary, #3b82f6); transition: width 0.1s ease;"></div>
            </div>
          </div>
        </div>

        <!-- Chat Screen (hidden initially) -->
        <div class="vd-ai-chat-interface" style="flex: 1; display: none; flex-direction: column; min-height: 0;">
          <div class="vd-ai-messages" style="flex: 1; overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
            <div class="vd-ai-message vd-ai-assistant">
              <div class="vd-ai-bubble" style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: var(--radius-md); border-top-left-radius: 0; display: inline-block; max-width: 85%; font-size: 0.95rem; line-height: 1.5; color: var(--text-primary);">
                Hello! I am a local AI running in your browser. How can I help you today?
              </div>
            </div>
          </div>
          
          <div style="padding: 1rem 1rem 0; border-top: 1px solid var(--border-color, #e0e0e0); background: var(--bg-primary, #fff); border-bottom-left-radius: inherit; border-bottom-right-radius: inherit;">
            <form class="vd-ai-form" style="display: flex; gap: 0.5rem;">
              <input type="text" class="vd-input vd-ai-input" placeholder="Type a message..." style="flex: 1; min-width: 0;" disabled maxlength="2000">
              <button type="submit" class="vd-btn vd-btn-primary vd-ai-send-btn" disabled>
                <i class="ph ph-paper-plane-right"></i>
              </button>
            </form>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.25rem; font-size: 0.75rem; color: var(--text-muted);">
              <span class="vd-ai-char-counter">0 / 2000</span>
              <span class="vd-ai-token-wrap" style="display: none;" title="Context tokens used">
                <i class="ph ph-cpu" style="vertical-align: middle;"></i> <span class="vd-ai-token-counter">0</span> / ~8K
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(wrapper);

    this._elements = {
      wrapper,
      cardBody: wrapper.querySelector('.vd-ai-card-body'),
      setupScreen: wrapper.querySelector('.vd-ai-setup'),
      loadBtn: wrapper.querySelector('.vd-ai-load-btn'),
      modelSelect: wrapper.querySelector('#vd-ai-model-select'),
      fallbackNote: wrapper.querySelector('.vd-ai-fallback-note'),
      sysWebGpu: wrapper.querySelector('.vd-ai-sys-webgpu'),
      sysGpu: wrapper.querySelector('.vd-ai-sys-gpu'),
      sysF16: wrapper.querySelector('.vd-ai-sys-f16'),
      compatibleBadges: wrapper.querySelector('.vd-ai-compatible-badges'),
      cacheHint: wrapper.querySelector('.vd-ai-cache-hint'),
      progressWrap: wrapper.querySelector('.vd-ai-progress-wrap'),
      progressBar: wrapper.querySelector('.vd-ai-progress-bar'),
      progressText: wrapper.querySelector('.vd-ai-progress-text'),
      chatInterface: wrapper.querySelector('.vd-ai-chat-interface'),
      messagesContainer: wrapper.querySelector('.vd-ai-messages'),
      chatForm: wrapper.querySelector('.vd-ai-form'),
      chatInput: wrapper.querySelector('.vd-ai-input'),
      sendBtn: wrapper.querySelector('.vd-ai-send-btn'),
      charCounter: wrapper.querySelector('.vd-ai-char-counter'),
      tokenWrap: wrapper.querySelector('.vd-ai-token-wrap'),
      tokenCounter: wrapper.querySelector('.vd-ai-token-counter'),
      statusIndicator: wrapper.querySelector('.vd-ai-status-indicator'),
      statusText: wrapper.querySelector('.vd-ai-status-text')
    };
  }

  _bindEvents() {
    const { loadBtn, chatForm, modelSelect, chatInput, charCounter } = this._elements;

    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => {
        const requestedModelId = e.target.value;
        this._selectedModelId = requestedModelId;
        const resolved = this._resolveModelForSystem(requestedModelId);

        try {
          this.chat.setModelId(resolved.modelId);
          this._renderFallbackNote(resolved);
          this._renderCacheHint(resolved.modelId);
        } catch (err) {
          console.warn(err.message);
          e.target.value = this.chat.modelId; // Revert if already loading
        }
      });
    }

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
      if (data.stage === 'downloading') {
        const source = this._inferLoadSource(data.text);
        const likelyCached = this._isModelLikelyCached(this.chat.modelId);
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
      } else if (data.stage === 'ready') {
        this._markModelCached(this.chat.modelId);
        this._renderCacheHint(this.chat.modelId);
        this._showChatInterface();
      } else if (data.stage === 'error') {
        this._elements.progressText.textContent = 'Error: ' + data.message;
        this._elements.progressText.style.color = 'var(--vd-color-danger, #ef4444)';
        this._elements.loadBtn.disabled = false;
        this._elements.loadBtn.style.display = 'inline-block';
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
    this.chat.setModelId(resolved.modelId);
    this._renderFallbackNote(resolved);
    this._renderCacheHint(resolved.modelId);
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
    if (!option) return { modelId, changed: false, reason: '' };
    if (!this._systemInfo) return { modelId, changed: false, reason: '' };

    const needsF16 = option.requires.includes('shader-f16');
    if (needsF16 && !this._systemInfo.shaderF16 && option.fallbackId) {
      return {
        modelId: option.fallbackId,
        changed: true,
        reason: `Using compatibility fallback (${option.fallbackId}) because shader-f16 is not available on this device.`
      };
    }

    return { modelId, changed: false, reason: '' };
  }

  _renderFallbackNote(resolved) {
    const note = this._elements.fallbackNote;
    if (!note) return;

    if (resolved.changed) {
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

  _inferLoadSource(progressText) {
    const text = String(progressText || '').toLowerCase();
    if (!text) return 'unknown';
    if (/(cache|cached|indexeddb|local)/.test(text)) return 'cache';
    if (/(download|fetch|http|https|network|transfer|bytes|kb|mb|gb)/.test(text)) return 'network';
    return 'unknown';
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
        const requiresF16 = model.requires.includes('shader-f16');
        const isNative = !requiresF16 || info.shaderF16;
        const statusLabel = isNative ? 'native' : (model.fallbackId ? 'fallback' : 'unavailable');
        const color = isNative
          ? 'var(--vd-color-success, #22c55e)'
          : (model.fallbackId ? 'var(--vd-color-warning, #f59e0b)' : 'var(--vd-color-danger, #ef4444)');

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

    const { loadBtn, progressWrap } = this._elements;
    const selectedModel = this._elements.modelSelect?.value || this._selectedModelId || MODEL_OPTIONS[0].id;
    const resolved = this._resolveModelForSystem(selectedModel);
    this.chat.setModelId(resolved.modelId);
    this._renderFallbackNote(resolved);

    loadBtn.style.display = 'none';
    progressWrap.style.display = 'block';

    try {
      await this.chat.load();
    } catch (err) {
      console.error(err);
    }
  }

  _showChatInterface() {
    const { cardBody, setupScreen, chatInterface, statusIndicator, statusText, chatInput, sendBtn } = this._elements;
    if (cardBody) {
      // Use natural height for setup mode, then switch to fixed viewport for chat mode.
      cardBody.style.height = 'min(620px, 80vh)';
      cardBody.style.minHeight = '460px';
    }
    setupScreen.style.display = 'none';
    chatInterface.style.display = 'flex';
    statusIndicator.style.background = 'var(--vd-color-success, #22c55e)';
    statusText.textContent = 'Online';
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
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
      await this.chat.generate(
        text, 
        (reply) => {
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
    } catch (err) {
      assistantBubble.innerHTML = '<span style="color: var(--vd-color-danger, #ef4444);">Error: Failed to generate response.</span>';
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
