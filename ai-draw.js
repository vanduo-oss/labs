import { labsMarkdownToHtml } from './labs-md-to-html.js';
import {
  buildDrawSystemPrompt,
  DEFAULT_LLM_GUARD_PATTERNS,
  validateLlmInput,
} from './guardrails/llm.js';
import { toGuardrailError } from './guardrails/core.js';

/**
 * vd-ai-draw — In-browser AI Collaborative Pixel Canvas for Vanduo Labs
 *
 * Provides a headless API (AiDraw) and a UI component (AiDrawUI)
 * for running Gemma models directly in the browser using WebGPU.
 * The AI can "see" a 1-bit pixel canvas (serialized as text) and
 * draw on it by emitting DRAW/ERASE commands or full [CANVAS] blocks.
 *
 * @example
 * import { AiDraw, AiDrawUI } from './ai-draw.js';
 *
 * const draw = new AiDraw();
 * const ui = new AiDrawUI({ container: document.getElementById('app'), draw });
 * ui.mount();
 */

// ═══════════════════════════════════════════════════════════════════════
// CDN Configuration
// ═══════════════════════════════════════════════════════════════════════

const CDN = {
  webllm: 'https://esm.run/@mlc-ai/web-llm'
};

export const VD_AI_DRAW_VERSION = '0.0.2';

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

const MODEL_CACHE_FLAG_PREFIX = 'vd-ai-draw-model-cached:';

function getModelOption(modelId) {
  return MODEL_OPTIONS.find((m) => m.id === modelId) || null;
}

function getModelDisplayName(modelId) {
  const option = getModelOption(modelId);
  if (!option) return modelId;
  return option.label.split('(~')[0].replace(/\s+-\s+\w+$/, '').trim();
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
    console.error('[AiDraw] Failed to load WebLLM from CDN:', err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PixelCanvas — 1-bit grid state
// ═══════════════════════════════════════════════════════════════════════

export class PixelCanvas {
  constructor(options = {}) {
    this.width = options.width || 64;
    this.height = options.height || 64;
    this.pixels = new Uint8Array(this.width * this.height);
  }

  _idx(x, y) {
    return y * this.width + x;
  }

  setPixel(x, y, value) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.pixels[this._idx(x, y)] = value ? 1 : 0;
  }

  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.pixels[this._idx(x, y)];
  }

  togglePixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = this._idx(x, y);
    this.pixels[idx] = this.pixels[idx] ? 0 : 1;
  }

  clear() {
    this.pixels.fill(0);
  }

  drawLine(x0, y0, x1, y1, value) {
    // Bresenham's line algorithm
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.setPixel(x0, y0, value);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  drawCircle(cx, cy, r, value) {
    // Midpoint circle algorithm
    cx = Math.round(cx);
    cy = Math.round(cy);
    r = Math.round(r);
    let x = r;
    let y = 0;
    let err = 0;

    while (x >= y) {
      this.setPixel(cx + x, cy + y, value);
      this.setPixel(cx + y, cy + x, value);
      this.setPixel(cx - y, cy + x, value);
      this.setPixel(cx - x, cy + y, value);
      this.setPixel(cx - x, cy - y, value);
      this.setPixel(cx - y, cy - x, value);
      this.setPixel(cx + y, cy - x, value);
      this.setPixel(cx + x, cy - y, value);
      if (err <= 0) {
        y += 1;
        err += 2 * y + 1;
      }
      if (err > 0) {
        x -= 1;
        err -= 2 * x + 1;
      }
    }
  }

  fillRect(x, y, w, h, value) {
    const x0 = Math.max(0, Math.min(this.width - 1, x));
    const y0 = Math.max(0, Math.min(this.height - 1, y));
    const x1 = Math.max(0, Math.min(this.width - 1, x + w - 1));
    const y1 = Math.max(0, Math.min(this.height - 1, y + h - 1));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        this.pixels[this._idx(xx, yy)] = value ? 1 : 0;
      }
    }
  }

  toTextGrid() {
    const lines = [];
    for (let y = 0; y < this.height; y++) {
      let row = '';
      for (let x = 0; x < this.width; x++) {
        row += this.pixels[this._idx(x, y)] ? '#' : '.';
      }
      lines.push(row);
    }
    return lines.join('\n');
  }

  fromTextGrid(text) {
    if (!text) return;
    const lines = text.split('\n');
    for (let y = 0; y < this.height && y < lines.length; y++) {
      const line = lines[y];
      for (let x = 0; x < this.width && x < line.length; x++) {
        const ch = line[x];
        this.pixels[this._idx(x, y)] = (ch === '#' || ch === '1' || ch === 'X' || ch === '*') ? 1 : 0;
      }
    }
  }

  applyCommand(line) {
    // DRAW x y
    // ERASE x y
    const trimmed = line.trim();
    const drawMatch = trimmed.match(/^DRAW\s+(\d+)\s+(\d+)$/i);
    if (drawMatch) {
      this.setPixel(parseInt(drawMatch[1], 10), parseInt(drawMatch[2], 10), 1);
      return true;
    }
    const eraseMatch = trimmed.match(/^ERASE\s+(\d+)\s+(\d+)$/i);
    if (eraseMatch) {
      this.setPixel(parseInt(eraseMatch[1], 10), parseInt(eraseMatch[2], 10), 0);
      return true;
    }
    return false;
  }

  resize(newWidth, newHeight) {
    const old = this.pixels;
    const oldW = this.width;
    const oldH = this.height;
    this.width = newWidth;
    this.height = newHeight;
    this.pixels = new Uint8Array(newWidth * newHeight);
    const copyW = Math.min(oldW, newWidth);
    const copyH = Math.min(oldH, newHeight);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        this.pixels[y * newWidth + x] = old[y * oldW + x];
      }
    }
  }

  clone() {
    const c = new PixelCanvas({ width: this.width, height: this.height });
    c.pixels.set(this.pixels);
    return c;
  }
}

function formatCanvasForPrompt(canvas) {
  return `[CANVAS]\n${canvas.toTextGrid()}\n[/CANVAS]`;
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
// AiDraw — Headless API
// ═══════════════════════════════════════════════════════════════════════

export class AiDraw {
  static VERSION = VD_AI_DRAW_VERSION;

  constructor(options = {}) {
    this.modelId = options.modelId || MODEL_OPTIONS[0].id;
    this.engine = null;
    this.messages = [];
    this._progressSubscribers = [];
    this._isLoaded = false;
    this._isLoading = false;
    this._isGenerating = false;
    this._generationAbortController = null;
    this._fallbackDrawCounter = 0;
    this.canvas = new PixelCanvas({ width: options.canvasWidth || 64, height: options.canvasHeight || 64 });
    this._canvasHistory = [];
  }

  setModelId(modelId, options = {}) {
    const { resetMessages = false } = options;
    if (this._isLoading) {
      throw new Error('Cannot change model ID while loading.');
    }

    if (this._isLoaded && this.modelId !== modelId) {
      try {
        const maybePromise = this.engine?.unload?.();
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {});
        }
      } catch {
        // Ignore teardown errors
      }
      this.engine = null;
      this._isLoaded = false;
    }

    this.modelId = modelId;
    if (resetMessages) {
      this.reset();
    }
  }

  resizeCanvas(width, height) {
    this.canvas.resize(width, height);
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

  isLoading() {
    return this._isLoading;
  }

  isGenerating() {
    return this._isGenerating;
  }

  stopGeneration() {
    if (!this._isGenerating) return false;
    if (this._generationAbortController) {
      this._generationAbortController.abort();
    }
    try {
      this.engine?.interruptGenerate?.();
    } catch {
      // Best-effort interrupt. Some backends may not expose this API.
    }
    return true;
  }

  _isDrawIntent(text) {
    if (!text) return false;
    const t = String(text).toLowerCase();
    return /\b(draw|sketch|paint|doodle|pattern|random|surprise|guess|make\s+something|create\s+something)\b/.test(t);
  }

  _seedFromText(seedText = '') {
    return Array.from(String(seedText))
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 2166136261);
  }

  _drawFallbackStar() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    this.canvas.clear();
    const outerR = Math.max(8, Math.floor(Math.min(w, h) * 0.32));
    const innerR = Math.max(4, Math.floor(outerR * 0.42));
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const angle = (-Math.PI / 2) + (i * Math.PI / 5);
      const r = i % 2 === 0 ? outerR : innerR;
      pts.push({
        x: Math.round(cx + Math.cos(angle) * r),
        y: Math.round(cy + Math.sin(angle) * r)
      });
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      this.canvas.drawLine(a.x, a.y, b.x, b.y, 1);
    }
    this.canvas.fillRect(cx - 1, cy - 1, 3, 3, 1);
  }

  _drawFallbackDogFace() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2) + 2;
    const r = Math.max(9, Math.floor(Math.min(w, h) * 0.24));

    this.canvas.clear();
    this.canvas.drawCircle(cx, cy, r, 1);
    this.canvas.drawCircle(cx - Math.floor(r * 0.8), cy - Math.floor(r * 0.7), Math.max(3, Math.floor(r * 0.45)), 1);
    this.canvas.drawCircle(cx + Math.floor(r * 0.8), cy - Math.floor(r * 0.7), Math.max(3, Math.floor(r * 0.45)), 1);

    const eyeOffsetX = Math.max(3, Math.floor(r * 0.35));
    const eyeY = cy - Math.max(2, Math.floor(r * 0.2));
    this.canvas.fillRect(cx - eyeOffsetX - 1, eyeY - 1, 2, 2, 1);
    this.canvas.fillRect(cx + eyeOffsetX, eyeY - 1, 2, 2, 1);

    const noseY = cy + Math.max(1, Math.floor(r * 0.15));
    this.canvas.fillRect(cx - 1, noseY - 1, 3, 2, 1);
    this.canvas.drawLine(cx, noseY + 1, cx, noseY + Math.max(3, Math.floor(r * 0.35)), 1);
    this.canvas.drawLine(cx, noseY + Math.max(3, Math.floor(r * 0.35)), cx - Math.max(3, Math.floor(r * 0.35)), noseY + Math.max(5, Math.floor(r * 0.5)), 1);
    this.canvas.drawLine(cx, noseY + Math.max(3, Math.floor(r * 0.35)), cx + Math.max(3, Math.floor(r * 0.35)), noseY + Math.max(5, Math.floor(r * 0.5)), 1);
  }

  _drawFallbackRandomPattern(seedText = '') {
    const seed = this._seedFromText(`${seedText}|${this._fallbackDrawCounter}`);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const mode = seed % 3;
    this.canvas.clear();

    if (mode === 0) {
      const maxR = Math.max(4, Math.floor(Math.min(w, h) / 3));
      this.canvas.drawCircle(cx, cy, maxR, 1);
      this.canvas.drawCircle(cx, cy, Math.max(2, Math.floor(maxR * 0.62)), 1);
      this.canvas.drawLine(2, cy, w - 3, cy, 1);
      this.canvas.drawLine(cx, 2, cx, h - 3, 1);
    } else if (mode === 1) {
      for (let i = 0; i < 9; i++) {
        const y = 2 + i * Math.max(2, Math.floor(h / 10));
        this.canvas.drawLine(2, y, w - 3, (y + (i % 2 === 0 ? 4 : -4) + h) % h, 1);
      }
      this.canvas.drawCircle(cx, cy, Math.max(5, Math.floor(Math.min(w, h) * 0.2)), 1);
    } else {
      for (let i = 0; i < 12; i++) {
        const x0 = (seed + i * 17) % w;
        const y0 = ((seed >>> 6) + i * 13) % h;
        const x1 = (x0 + 10 + (i * 3)) % w;
        const y1 = (y0 + 8 + (i * 5)) % h;
        this.canvas.drawLine(x0, y0, x1, y1, 1);
      }
    }

    let x = seed % w;
    let y = (seed >>> 8) % h;
    for (let i = 0; i < Math.max(14, Math.floor((w + h) / 7)); i++) {
      x = (x + 7 + (seed % 5)) % w;
      y = (y + 11 + ((seed >>> 4) % 7)) % h;
      this.canvas.fillRect(x - 1, y - 1, 3, 3, 1);
    }
  }

  _applyIntentFallbackDrawing(userText = '') {
    this._fallbackDrawCounter += 1;
    const t = String(userText).toLowerCase();
    if (/\bstar\b/.test(t)) {
      this._drawFallbackStar();
      return 'I drew a star on the canvas.';
    }
    if (/\bdog\b/.test(t)) {
      this._drawFallbackDogFace();
      return 'I drew a simple dog face on the canvas.';
    }

    this._drawFallbackRandomPattern(userText);
    return 'I drew a fresh random pattern on the canvas.';
  }

  async generate(userText, onUpdate, onFinish) {
    const guardrailCheck = validateLlmInput({ text: userText });
    if (!guardrailCheck.allowed) {
      throw toGuardrailError(guardrailCheck);
    }

    if (!this._isLoaded || !this.engine) {
      throw new Error('Model not loaded. Call load() first.');
    }
    if (this._isGenerating) {
      throw new Error('Generation is already in progress.');
    }

    const drawIntent = this._isDrawIntent(userText);

    // Build the user message that includes the canvas state
    const canvasBlock = formatCanvasForPrompt(this.canvas);
    const drawDirective = drawIntent
      ? '\n\n[DRAWING_REQUEST]\nUser is explicitly asking for a drawing update. You must change the canvas this turn.\n[/DRAWING_REQUEST]'
      : '';
    const augmentedUserText = `${userText}${drawDirective}\n\n${canvasBlock}`;

    this.messages.push({ role: 'user', content: augmentedUserText });

    const systemPrompt = buildDrawSystemPrompt({
      width: this.canvas.width,
      height: this.canvas.height,
    });

    const payload = [
      { role: 'system', content: systemPrompt },
      ...this.messages
    ];

    this._isGenerating = true;
    this._generationAbortController = new AbortController();

    try {
      const chunks = await this.engine.chat.completions.create({
        messages: payload,
        stream: true,
        stream_options: { include_usage: true }
      });

      let reply = "";
      let usage = null;
      let aborted = false;

      for await (const chunk of chunks) {
        if (this._generationAbortController?.signal.aborted) {
          aborted = true;
          break;
        }
        if (chunk.usage) usage = chunk.usage;
        const delta = chunk.choices[0]?.delta?.content || "";
        reply += delta;
        if (onUpdate) onUpdate(reply);
      }

      // Parse canvas changes from the reply
      let { cleanedReply, canvasChanged } = this._parseCanvasCommands(reply);
      let fallbackUsed = false;
      let fallbackMessage = '';

      if (!canvasChanged && drawIntent && !aborted) {
        fallbackMessage = this._applyIntentFallbackDrawing(userText);
        fallbackUsed = true;
        canvasChanged = true;
        cleanedReply = fallbackMessage;
      }

      this.messages.push({ role: 'assistant', content: fallbackUsed ? fallbackMessage : reply });
      if (onFinish && usage) onFinish(usage, canvasChanged, { aborted });
      return { reply: cleanedReply, rawReply: reply, canvasChanged, aborted, fallbackUsed };
    } catch (err) {
      if (this._generationAbortController?.signal.aborted) {
        return { reply: '', rawReply: '', canvasChanged: false, aborted: true, fallbackUsed: false };
      }
      console.error('[AiDraw] Generation error:', err);
      throw err;
    } finally {
      this._isGenerating = false;
      this._generationAbortController = null;
    }
  }

  _normalizeCanvasGrid(text) {
    if (!text) return '';
    const normalizedLines = String(text)
      .split('\n')
      .map((line) => line.trim())
      .map((line) => line.replace(/^\d+\s*[:|]\s*/, ''))
      .map((line) => line.replace(/[|]/g, ''))
      .map((line) => line.replace(/\s+/g, ''))
      .map((line) => line.replace(/[^.#01Xx*]/g, ''))
      .filter((line) => line.length > 0);

    if (!normalizedLines.length) return '';

    const gridLines = normalizedLines
      .slice(0, this.canvas.height)
      .map((line) => line.slice(0, this.canvas.width).padEnd(this.canvas.width, '.'));

    if (!gridLines.length) return '';
    return gridLines.join('\n');
  }

  _extractLikelyCanvasBlocks(text) {
    if (!text) return [];
    const lines = String(text).split('\n');
    const blocks = [];
    let start = -1;

    const flush = (endIndex) => {
      if (start < 0) return;
      const candidate = lines.slice(start, endIndex).join('\n').trim();
      if (candidate) blocks.push(candidate);
      start = -1;
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const cleaned = trimmed
        .replace(/^\d+\s*[:|]\s*/, '')
        .replace(/[|]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^.#01Xx*]/g, '');
      const drawableDensity = cleaned.length >= Math.max(8, Math.floor(this.canvas.width * 0.5));

      if (drawableDensity) {
        if (start < 0) start = i;
      } else {
        flush(i);
      }
    }
    flush(lines.length);

    return blocks.filter((block) => block.split('\n').length >= Math.max(4, Math.floor(this.canvas.height * 0.25)));
  }

  _parseCanvasCommands(reply) {
    let cleanedReply = reply;
    let canvasChanged = false;

    // Parse [CANVAS]...[CANVAS] blocks
    const canvasBlockRegex = /\[CANVAS\]\n?([\s\S]*?)\n?\[\/CANVAS\]/gi;
    let match;
    while ((match = canvasBlockRegex.exec(reply)) !== null) {
      const gridText = this._normalizeCanvasGrid(match[1]);
      if (gridText) {
        this.canvas.fromTextGrid(gridText);
        canvasChanged = true;
      }
      cleanedReply = cleanedReply.replace(match[0], '');
    }

    // Parse fenced code blocks that may contain loose canvas text
    const fencedBlocks = [...reply.matchAll(/```(?:\w+)?\n?([\s\S]*?)```/g)];
    for (const fenced of fencedBlocks) {
      const normalized = this._normalizeCanvasGrid(fenced[1]);
      if (!normalized) continue;
      this.canvas.fromTextGrid(normalized);
      canvasChanged = true;
      cleanedReply = cleanedReply.replace(fenced[0], '');
    }

    // Parse DRAW x y / ERASE x y commands (accepts loose formatting like DRAW(10, 8) or DRAW x=10 y=8)
    const commandRegex = /\b(DRAW|ERASE)\s*(?:\(?\s*(?:x\s*=\s*)?(\d{1,4})\s*[, ]\s*(?:y\s*=\s*)?(\d{1,4})\s*\)?)/gim;
    let cmdMatch;
    while ((cmdMatch = commandRegex.exec(reply)) !== null) {
      const op = cmdMatch[1].toUpperCase();
      const x = parseInt(cmdMatch[2], 10);
      const y = parseInt(cmdMatch[3], 10);
      this.canvas.applyCommand(`${op} ${x} ${y}`);
      canvasChanged = true;
      cleanedReply = cleanedReply.replace(cmdMatch[0], '');
    }

    // Parse raw grid-looking blocks even when model forgot [CANVAS] tags.
    if (!canvasChanged) {
      const rawBlocks = this._extractLikelyCanvasBlocks(reply);
      for (const block of rawBlocks) {
        const normalized = this._normalizeCanvasGrid(block);
        if (!normalized) continue;
        this.canvas.fromTextGrid(normalized);
        canvasChanged = true;
        cleanedReply = cleanedReply.replace(block, '');
      }
    }

    // Clean up extra blank lines left by removed commands
    cleanedReply = cleanedReply.replace(/\n{3,}/g, '\n\n').trim();

    return { cleanedReply, canvasChanged };
  }

  reset() {
    this.messages = [];
    this.canvas.clear();
    this._canvasHistory = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// AiDrawUI — DOM Component
// ═══════════════════════════════════════════════════════════════════════

export class AiDrawUI {
  static VERSION = VD_AI_DRAW_VERSION;

  constructor(options = {}) {
    this.container = options.container;
    this.draw = options.draw || new AiDraw();
    this._mounted = false;
    this._elements = {};
    this._systemInfo = null;
    this._selectedModelId = this.draw.modelId;
    this._tool = 'pencil'; // pencil, brush, eraser
    this._pixelSize = 8;
    this._isDrawing = false;
    this._lastPixel = null;
    this._showGrid = true;
    this._canvasResizeObserver = null;
  }

  mount() {
    if (this._mounted) return;
    if (!this.container) throw new Error('AiDrawUI requires a container element');

    this._buildDOM();
    this._bindEvents();
    this._initSystemInfo();
    this._renderCanvas();
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
    this._disconnectCanvasResizeObserver();
    this._unbindCanvasEvents();
    this.container.innerHTML = '';
    this._mounted = false;
    this._elements = {};
  }

  _buildDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = 'vd-ai-draw-wrap vd-card vd-card-glow vd-glass';

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
        .vd-ai-draw-wrap .vd-ai-setup-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 0.65rem 0.75rem;
          width: 100%;
          max-width: 40rem;
          margin: 0 0 0.5rem;
        }
        .vd-ai-draw-wrap .vd-ai-chat-composer {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.75rem 1rem 0.2rem;
          border-top: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-primary, #fff);
        }
        .vd-ai-draw-wrap .vd-ai-form {
          display: flex;
          align-items: stretch;
          gap: 0.65rem;
        }
        .vd-ai-draw-wrap .vd-ai-chat-subbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 0.2rem 0 0.45rem;
          font-size: 0.75rem;
        }
        .vd-ai-draw-wrap .vd-ai-clear-storage-btn {
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
        .vd-ai-draw-wrap .vd-ai-clear-storage-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vd-ai-draw-wrap .vd-ai-switch-btn {
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
        .vd-ai-draw-wrap .vd-ai-chat-model-select {
          min-height: 2.1rem;
        }
        .vd-ai-draw-wrap .vd-ai-setup-grid {
          width: 100%;
          max-width: 56rem;
          margin: 0 auto 1.25rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1rem 1.35rem;
          align-items: flex-start;
          text-align: left;
        }
        .vd-ai-draw-wrap .vd-ai-storage-panel {
          background: var(--bg-secondary, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: var(--radius-sm, 0.5rem);
          padding: 0.8rem 0.9rem;
        }
        .vd-ai-draw-wrap .vd-ai-storage-meter-track {
          height: 5px;
          background: var(--bg-primary, #fff);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 0.45rem;
          border: 1px solid var(--border-color, #e2e8f0);
        }
        .vd-ai-draw-wrap .vd-ai-storage-meter-fill {
          height: 100%;
          width: 0%;
          background: var(--color-primary, #3b82f6);
          transition: width 0.35s ease;
        }
        .vd-ai-draw-wrap .vd-ai-modal-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.45);
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
        }
        .vd-ai-draw-wrap .vd-ai-modal-overlay.vd-ai-modal-on {
          display: flex;
        }
        .vd-ai-draw-wrap .vd-ai-modal {
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
        .vd-ai-draw-wrap .vd-ai-modal .vd-ai-modal-list {
          margin: 0.4rem 0 0.25rem 1.1rem;
          padding: 0;
          line-height: 1.5;
          font-size: 0.88rem;
          color: var(--text-muted, #6b7280);
        }
        .vd-ai-draw-wrap .vd-ai-modal .vd-ai-modal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 0.65rem;
          justify-content: flex-end;
          margin-top: 1.2rem;
        }

        /* Canvas-specific styles */
        .vd-ai-draw-wrap .vd-ai-draw-workspace {
          display: none;
          flex-direction: column;
          min-height: 50vh;
          height: min(75vh, 52rem);
          max-height: 80vh;
          min-width: 0;
          border-top: 1px solid var(--border-color, #e0e0e0);
        }
        .vd-ai-draw-wrap .vd-ai-draw-canvas-area {
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
          padding: 0.75rem;
          gap: 0.5rem;
        }
        .vd-ai-draw-wrap .vd-ai-canvas-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0;
        }
        .vd-ai-draw-wrap .vd-ai-canvas-toolbar .vd-ai-tool-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          min-height: 2rem;
          padding: 0.35rem 0.65rem;
          border-radius: var(--radius-sm, 0.5rem);
          border: 1px solid var(--border-color, #d1d5db);
          background: var(--bg-secondary, #f8fafc);
          color: var(--text-primary, #111);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
        }
        .vd-ai-draw-wrap .vd-ai-canvas-toolbar .vd-ai-tool-btn.is-active {
          border-color: var(--color-primary, #3b82f6);
          background: rgba(59, 130, 246, 0.15);
          color: var(--color-primary, #3b82f6);
        }
        .vd-ai-draw-wrap .vd-ai-canvas-wrap {
          flex: 1 1 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          background: var(--bg-secondary, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: var(--radius-sm, 0.5rem);
          overflow: hidden;
          position: relative;
        }
        .vd-ai-draw-wrap .vd-ai-canvas-el {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          width: 64px;
          height: 64px;
          cursor: crosshair;
          touch-action: none;
        }
        .vd-ai-draw-wrap .vd-ai-canvas-size-select {
          min-height: 2rem;
          padding: 0.35rem 0.5rem;
          border-radius: var(--radius-sm, 0.5rem);
          border: 1px solid var(--border-color, #d1d5db);
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #111);
          font-size: 0.8rem;
        }
        .vd-ai-draw-wrap .vd-ai-canvas-dim-label {
          font-size: 0.75rem;
          color: var(--text-muted, #6b7280);
          white-space: nowrap;
        }
        .vd-ai-draw-wrap .vd-ai-chat-area {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
          max-height: 45%;
          border-top: 1px solid var(--border-color, #e0e0e0);
        }
        .vd-ai-draw-wrap .vd-ai-messages {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .vd-ai-draw-wrap .vd-ai-draw-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--color-primary, #3b82f6);
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 999px;
          padding: 0.15rem 0.45rem;
          margin-left: 0.5rem;
        }
        @media (min-width: 768px) {
          .vd-ai-draw-wrap .vd-ai-draw-workspace {
            flex-direction: row;
          }
          .vd-ai-draw-wrap .vd-ai-draw-canvas-area {
            flex: 1 1 55%;
            border-right: 1px solid var(--border-color, #e0e0e0);
            border-top: none;
          }
          .vd-ai-draw-wrap .vd-ai-chat-area {
            flex: 1 1 45%;
            max-height: none;
            border-top: none;
            border-left: 1px solid var(--border-color, #e0e0e0);
          }
        }
      </style>
      <div class="vd-card-body vd-ai-card-body" style="display: flex; flex-direction: column; min-height: 0; padding: 0; flex: 1 1 auto;">
        <!-- Header -->
        <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-color, #e0e0e0); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="ph ph-paint-brush" style="font-size: 1.5rem; color: var(--color-primary, #3b82f6);"></i>
            <h3 class="vd-ai-title" style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">AI Draw</h3>
          </div>
          <div class="vd-ai-header-status vd-text-sm vd-text-muted">
            <span class="vd-ai-load-source-badge" data-vd-badge-zone="header" aria-live="polite"></span>
            <span>
              <span class="vd-ai-status-indicator" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); margin-right: 4px;"></span>
              <span class="vd-ai-status-text">Offline</span>
            </span>
          </div>
        </div>

        <!-- Setup block -->
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
                  title="Why fallback? Some models require GPU features (like shader-f16). If your device lacks a required feature, vd-ai-draw automatically loads a compatible fallback model."
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
          <p class="vd-text-muted vd-text-sm" style="max-width: 40rem; margin: 0 0 0.5rem; width: 100%;">
            The AI can "see" and draw on a pixel canvas. Draw something, then ask the AI what it sees or to improve it.
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

        <!-- Draw workspace (shown after load) -->
        <div class="vd-ai-draw-workspace">
          <!-- Canvas area -->
          <div class="vd-ai-draw-canvas-area">
            <div class="vd-ai-canvas-toolbar">
              <button type="button" class="vd-ai-tool-btn is-active" data-tool="pencil" title="Pencil (1px)">
                <i class="ph ph-pencil-simple"></i> Pencil
              </button>
              <button type="button" class="vd-ai-tool-btn" data-tool="brush" title="Brush (3px)">
                <i class="ph ph-paint-brush"></i> Brush
              </button>
              <button type="button" class="vd-ai-tool-btn" data-tool="eraser" title="Eraser">
                <i class="ph ph-eraser"></i> Eraser
              </button>
              <button type="button" class="vd-ai-tool-btn" data-tool="grid" title="Toggle grid">
                <i class="ph ph-grid-four"></i> Grid
              </button>
              <div style="width: 1px; height: 1.25rem; background: var(--border-color); margin: 0 0.25rem;"></div>
              <button type="button" class="vd-ai-tool-btn" data-action="clear" title="Clear canvas">
                <i class="ph ph-trash"></i> Clear
              </button>
              <div style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
                <span class="vd-ai-canvas-dim-label">Canvas:</span>
                <select class="vd-ai-canvas-size-select" id="vd-ai-canvas-size">
                  <option value="32">32 x 32</option>
                  <option value="64" selected>64 x 64</option>
                  <option value="128">128 x 128</option>
                </select>
                <span class="vd-ai-canvas-dim-label vd-ai-canvas-dim-warning" style="display: none; color: var(--vd-color-warning, #f59e0b);">⚠ Large canvas</span>
              </div>
            </div>
            <div class="vd-ai-canvas-wrap">
              <canvas class="vd-ai-canvas-el" id="vd-ai-canvas"></canvas>
            </div>
          </div>

          <!-- Chat area -->
          <div class="vd-ai-chat-area">
            <div class="vd-ai-messages">
              <div class="vd-ai-message vd-ai-assistant">
                <div class="vd-ai-bubble" style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 0.75rem 1rem; border-radius: var(--radius-md); border-top-left-radius: 0; display: inline-block; max-width: 85%; font-size: 0.95rem; line-height: 1.5; color: var(--text-primary);">
                  Hello! I am a local AI artist. Draw something on the canvas, then ask me what I see or to help you improve it!
                </div>
              </div>
            </div>
            <div class="vd-ai-chat-composer">
              <form class="vd-ai-form">
                <input type="text" class="vd-input vd-ai-input" placeholder="Ask me about your drawing..." style="flex: 1; min-width: 0; min-height: 2.5rem; padding: 0.5rem 0.75rem;" disabled maxlength="2000">
                <button type="submit" class="vd-btn vd-btn-primary vd-ai-send-btn" style="min-width: 2.7rem; min-height: 2.5rem; padding: 0 0.7rem; display: inline-flex; align-items: center; justify-content: center;" disabled>
                  <i class="ph ph-paper-plane-right" style="font-size: 1.1rem;"></i>
                </button>
                <button
                  type="button"
                  class="vd-btn vd-ai-stop-btn"
                  style="min-width: 2.7rem; min-height: 2.5rem; padding: 0 0.7rem; display: none; align-items: center; justify-content: center; border: 1px solid var(--vd-color-danger, #ef4444); color: var(--vd-color-danger, #ef4444);"
                  title="Stop generation"
                >
                  <i class="ph ph-stop-circle" style="font-size: 1.1rem;"></i>
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
            <li>Local "model cached" markers used by this UI</li>
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
      workspace: wrapper.querySelector('.vd-ai-draw-workspace'),
      canvasEl: wrapper.querySelector('#vd-ai-canvas'),
      canvasWrap: wrapper.querySelector('.vd-ai-canvas-wrap'),
      toolBtns: wrapper.querySelectorAll('.vd-ai-tool-btn[data-tool]'),
      canvasSizeSelect: wrapper.querySelector('#vd-ai-canvas-size'),
      canvasDimWarning: wrapper.querySelector('.vd-ai-canvas-dim-warning'),
      messagesContainer: wrapper.querySelector('.vd-ai-messages'),
      chatForm: wrapper.querySelector('.vd-ai-form'),
      chatInput: wrapper.querySelector('.vd-ai-input'),
      sendBtn: wrapper.querySelector('.vd-ai-send-btn'),
      stopBtn: wrapper.querySelector('.vd-ai-stop-btn'),
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
    this._updateModelTitle(this.draw.modelId);
    this._renderModelCacheBadges();
    this._updateSwitchButtonState();
    this._setupCanvas();
  }

  _setupCanvas() {
    const canvas = this._elements.canvasEl;
    if (!canvas) return;
    const { width, height } = this.draw.canvas;
    canvas.width = width;
    canvas.height = height;
    this._attachCanvasResizeObserver();
    this._syncCanvasDisplaySize();
    this._renderCanvas();
  }

  _attachCanvasResizeObserver() {
    if (this._canvasResizeObserver || typeof ResizeObserver === 'undefined') return;
    const canvasWrap = this._elements.canvasWrap;
    if (!canvasWrap) return;
    this._canvasResizeObserver = new ResizeObserver(() => {
      this._syncCanvasDisplaySize();
    });
    this._canvasResizeObserver.observe(canvasWrap);
  }

  _disconnectCanvasResizeObserver() {
    if (!this._canvasResizeObserver) return;
    this._canvasResizeObserver.disconnect();
    this._canvasResizeObserver = null;
  }

  _syncCanvasDisplaySize() {
    const canvas = this._elements.canvasEl;
    const canvasWrap = this._elements.canvasWrap;
    if (!canvas || !canvasWrap) return;
    const width = canvasWrap.clientWidth;
    const height = canvasWrap.clientHeight;
    if (!width || !height) return;

    const side = Math.max(96, Math.floor(Math.min(width, height) - 12));
    canvas.style.width = `${side}px`;
    canvas.style.height = `${side}px`;
  }

  _renderCanvas() {
    const canvas = this._elements.canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height, pixels } = this.draw.canvas;

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Draw pixels
    ctx.fillStyle = '#000000';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[y * width + x]) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Grid overlay
    if (this._showGrid && width <= 64) {
      ctx.strokeStyle = 'rgba(128,128,128,0.15)';
      ctx.lineWidth = 1 / (canvas.clientWidth / width || 1);
      ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y++) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }
  }

  _bindEvents() {
    const { loadBtn, chatForm, modelSelect, switchModelBtn, clearStorageBtn, chatInput, charCounter, canvasSizeSelect, stopBtn } = this._elements;

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

    if (canvasSizeSelect) {
      canvasSizeSelect.addEventListener('change', (e) => {
        const size = parseInt(e.target.value, 10);
        this._handleCanvasResize(size);
      });
    }

    // Tool buttons
    this._elements.toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool === 'grid') {
          this._showGrid = !this._showGrid;
          btn.classList.toggle('is-active', this._showGrid);
          this._renderCanvas();
          return;
        }
        this._tool = tool;
        this._elements.toolBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.tool === tool && tool !== 'grid'));
      });
    });

    // Action buttons (clear)
    const actionBtns = this._elements.wrapper.querySelectorAll('.vd-ai-tool-btn[data-action]');
    actionBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'clear') {
          this.draw.canvas.clear();
          this._renderCanvas();
        }
      });
    });

    // Canvas drawing events
    this._bindCanvasEvents();

    loadBtn.addEventListener('click', () => this._handleLoadModel());
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this._handleStopGeneration());
    }
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSendMessage();
    });

    this.draw.onProgress((data) => {
      if (data.stage === 'init') {
        this._applyLoadSourceBadges({ mode: 'unknown', fromDownload: false, message: data.message });
        if (this._elements.progressWrap?.style.display === 'block') {
          this._elements.progressText.textContent = data.message || 'Initializing...';
          this._elements.progressText.style.color = '';
        }
      } else if (data.stage === 'downloading') {
        const source = this._inferLoadSource(data.text);
        const likelyCached = this._isModelLikelyCached(this.draw.modelId);
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
        this._markModelCached(this.draw.modelId);
        this._markModelCached(this._selectedModelId);
        this._renderModelOptions();
        this._renderModelCacheBadges();
        this._renderCacheHint(this.draw.modelId);
        this._updateModelTitle(this.draw.modelId);
        this._updateSwitchButtonState();
        this._refreshStoragePanel();
        if (this._elements.progressWrap) {
          this._elements.progressWrap.style.display = 'none';
        }
        this._showWorkspace();
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

  _bindCanvasEvents() {
    const canvas = this._elements.canvasEl;
    if (!canvas) return;

    this._canvasPointerDown = (e) => {
      e.preventDefault();
      this._isDrawing = true;
      const pos = this._getCanvasPos(e);
      this._lastPixel = pos;
      this._paintAt(pos.x, pos.y);
    };

    this._canvasPointerMove = (e) => {
      if (!this._isDrawing) return;
      e.preventDefault();
      const pos = this._getCanvasPos(e);
      if (this._lastPixel) {
        this._paintLine(this._lastPixel.x, this._lastPixel.y, pos.x, pos.y);
      }
      this._lastPixel = pos;
    };

    this._canvasPointerUp = () => {
      this._isDrawing = false;
      this._lastPixel = null;
    };

    this._canvasPointerLeave = () => {
      this._isDrawing = false;
      this._lastPixel = null;
    };

    canvas.addEventListener('mousedown', this._canvasPointerDown);
    canvas.addEventListener('mousemove', this._canvasPointerMove);
    canvas.addEventListener('mouseup', this._canvasPointerUp);
    canvas.addEventListener('mouseleave', this._canvasPointerLeave);

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this._canvasPointerDown(e.touches[0]);
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        this._canvasPointerMove(e.touches[0]);
      }
    }, { passive: false });
    canvas.addEventListener('touchend', this._canvasPointerUp);
    canvas.addEventListener('touchcancel', this._canvasPointerUp);
  }

  _unbindCanvasEvents() {
    const canvas = this._elements.canvasEl;
    if (!canvas) return;
    canvas.removeEventListener('mousedown', this._canvasPointerDown);
    canvas.removeEventListener('mousemove', this._canvasPointerMove);
    canvas.removeEventListener('mouseup', this._canvasPointerUp);
    canvas.removeEventListener('mouseleave', this._canvasPointerLeave);
  }

  _getCanvasPos(event) {
    const canvas = this._elements.canvasEl;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = event.clientX !== undefined ? event.clientX : 0;
    const clientY = event.clientY !== undefined ? event.clientY : 0;
    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top) * scaleY)
    };
  }

  _paintAt(x, y) {
    const tool = this._tool;
    if (tool === 'pencil') {
      this.draw.canvas.setPixel(x, y, 1);
    } else if (tool === 'brush') {
      this.draw.canvas.fillRect(x - 1, y - 1, 3, 3, 1);
    } else if (tool === 'eraser') {
      this.draw.canvas.setPixel(x, y, 0);
    }
    this._renderCanvas();
  }

  _paintLine(x0, y0, x1, y1) {
    const tool = this._tool;
    if (tool === 'pencil') {
      this.draw.canvas.drawLine(x0, y0, x1, y1, 1);
    } else if (tool === 'brush') {
      // Draw a 3px thick line by stepping and filling 3x3 at each point
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      let cx = x0;
      let cy = y0;
      while (true) {
        this.draw.canvas.fillRect(cx - 1, cy - 1, 3, 3, 1);
        if (cx === x1 && cy === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
      }
    } else if (tool === 'eraser') {
      this.draw.canvas.drawLine(x0, y0, x1, y1, 0);
    }
    this._renderCanvas();
  }

  _handleCanvasResize(size) {
    this.draw.resizeCanvas(size, size);
    const canvas = this._elements.canvasEl;
    if (canvas) {
      canvas.width = size;
      canvas.height = size;
    }
    this._syncCanvasDisplaySize();
    this._renderCanvas();
    if (this._elements.canvasDimWarning) {
      this._elements.canvasDimWarning.style.display = size >= 128 ? 'inline' : 'none';
    }
  }

  async _initSystemInfo() {
    const info = await this._detectSystemInfo();
    this._systemInfo = info;
    this._renderSystemInfo();

    const modelSelect = this._elements.modelSelect;
    if (!modelSelect) return;
    const requested = modelSelect.value || this._selectedModelId || MODEL_OPTIONS[0].id;
    const resolved = this._resolveModelForSystem(requested);
    this.draw.setModelId(resolved.modelId);
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
    return `${option.label}${cached ? ' - Cached' : ''}`;
  }

  _renderModelOptions() {
    const { modelSelect } = this._elements;
    const optionsMarkup = MODEL_OPTIONS.map((m) => {
      const selected = m.id === this._selectedModelId ? 'selected' : '';
      return `<option value="${m.id}" ${selected}>${this._buildModelOptionLabel(m.id)}</option>`;
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
    title.textContent = `AI Draw (${getModelDisplayName(modelId)})`;
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
      // Ignore storage errors
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

    if (!this.draw.isLoaded() && !this.draw.isLoading()) {
      this.draw.setModelId(resolved.modelId);
      this._updateModelTitle(resolved.modelId);
    }

    this._updateSwitchButtonState();
  }

  _updateClearStorageButtonState() {
    const btn = this._elements.clearStorageBtn;
    if (!btn) return;
    const loading = this.draw.isLoading();
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
    const loading = this.draw.isLoading();
    const loaded = this.draw.isLoaded();
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
    loadBtn.disabled = false;
    loadBtn.textContent = 'Load AI Model';
  }

  _updateSwitchButtonState() {
    this._updateClearStorageButtonState();
    this._updateLoadButtonState();
    const button = this._elements.switchModelBtn;
    const modelSelect = this._elements.modelSelect;
    if (!button || !modelSelect) return;

    const hasLoadedModel = this.draw.isLoaded();
    const loading = this.draw.isLoading();
    const resolvedSelectedModelId = this._resolveModelForSystem(this._selectedModelId).modelId;
    const sameAsActive = resolvedSelectedModelId === this.draw.modelId;

    modelSelect.disabled = loading;
    button.disabled = !hasLoadedModel || loading || sameAsActive;

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
    if (this.draw.isLoaded() || this.draw.isLoading()) return;

    const { progressWrap } = this._elements;
    const selectedModel = this._elements.modelSelect?.value || this._selectedModelId || MODEL_OPTIONS[0].id;
    const resolved = this._resolveModelForSystem(selectedModel);
    this.draw.setModelId(resolved.modelId);
    this._renderFallbackNote(resolved);
    this._updateModelTitle(resolved.modelId);
    this._updateSwitchButtonState();

    progressWrap.style.display = 'block';
    this._elements.progressText.style.color = '';

    const loadPromise = this.draw.load();
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
    if (!this.draw.isLoaded() || this.draw.isLoading()) return;

    const resolved = this._resolveModelForSystem(this._selectedModelId);
    if (resolved.modelId === this.draw.modelId) return;

    this.draw.setModelId(resolved.modelId);
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
      const loadPromise = this.draw.load();
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

  _showWorkspace() {
    const { cardBody, workspace, statusIndicator, statusText, chatInput, sendBtn } = this._elements;
    if (cardBody) {
      cardBody.style.height = 'auto';
      cardBody.style.minHeight = '0';
    }
    workspace.style.display = 'flex';
    statusIndicator.style.background = 'var(--vd-color-success, #22c55e)';
    statusText.textContent = `Online (${getModelDisplayName(this.draw.modelId)})`;
    chatInput.disabled = false;
    sendBtn.disabled = false;
    this._updateSwitchButtonState();
    chatInput.focus();
    requestAnimationFrame(() => this._syncCanvasDisplaySize());
    this._renderCanvas();
  }

  _setGenerationUiState(isGenerating) {
    const { chatInput, sendBtn, stopBtn } = this._elements;
    if (chatInput) chatInput.disabled = isGenerating;
    if (sendBtn) sendBtn.disabled = isGenerating;
    if (stopBtn) {
      stopBtn.style.display = isGenerating ? 'inline-flex' : 'none';
      stopBtn.disabled = !isGenerating;
      stopBtn.title = isGenerating ? 'Stop generation' : '';
    }
  }

  _handleStopGeneration() {
    if (!this.draw.isGenerating()) return;
    this.draw.stopGeneration();
    const stopBtn = this._elements.stopBtn;
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.title = 'Stopping...';
    }
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

      statusIndicator.style.background = this.draw.isLoaded()
        ? 'var(--vd-color-success, #22c55e)'
        : 'var(--text-muted)';
      statusText.textContent = this.draw.isLoaded()
        ? `Online (${getModelDisplayName(this.draw.modelId)})`
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
    const { chatInput, messagesContainer, charCounter, tokenWrap, tokenCounter } = this._elements;
    const text = chatInput.value.trim();
    if (!text) return;

    this._appendMessage('user', text);
    chatInput.value = '';
    charCounter.textContent = '0 / 2000';
    this._setGenerationUiState(true);

    const guardrailCheck = InputGuardrail.validate(text);
    if (!guardrailCheck.isValid) {
      this._appendMessage('assistant', `<span style="color: var(--vd-color-danger, #ef4444);"><i class="ph ph-shield-warning" style="vertical-align: middle; margin-right: 4px;"></i> Guardrail blocked request: ${guardrailCheck.reason}</span>`);
      this._setGenerationUiState(false);
      chatInput.focus();
      return;
    }

    const assistantBubble = this._appendMessage('assistant', '<span class="vd-ai-typing">...</span>');

    try {
      const { reply, canvasChanged, aborted } = await this.draw.generate(
        text,
        (reply) => {
          assistantBubble.innerHTML = labsMarkdownToHtml(reply.replace(/\\n/g, '\n'));
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        },
        (usage) => {
          if (usage && tokenWrap && tokenCounter) {
            tokenWrap.style.display = 'inline-block';
            tokenCounter.textContent = usage.total_tokens;
            if (usage.total_tokens > 7000) {
              tokenWrap.style.color = 'var(--vd-color-warning, #f59e0b)';
            }
          }
        }
      );

      assistantBubble.innerHTML = labsMarkdownToHtml(reply.replace(/\\n/g, '\n'));

      if (canvasChanged) {
        this._renderCanvas();
        const badge = document.createElement('span');
        badge.className = 'vd-ai-draw-badge';
        badge.innerHTML = '<i class="ph ph-pencil-simple"></i> drew on canvas';
        assistantBubble.appendChild(badge);
      }
      if (aborted) {
        const stopBadge = document.createElement('span');
        stopBadge.className = 'vd-ai-draw-badge';
        stopBadge.style.color = 'var(--vd-color-warning, #f59e0b)';
        stopBadge.style.borderColor = 'rgba(245, 158, 11, 0.45)';
        stopBadge.style.background = 'rgba(245, 158, 11, 0.12)';
        stopBadge.innerHTML = '<i class="ph ph-stop-circle"></i> stopped';
        assistantBubble.appendChild(stopBadge);
      }
    } catch (err) {
      assistantBubble.innerHTML = '<span style="color: var(--vd-color-danger, #ef4444);">Error: Failed to generate response.</span>';
    } finally {
      this._setGenerationUiState(false);
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
      bubble.innerHTML = contentHtml;
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
