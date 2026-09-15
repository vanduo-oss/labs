import { TINY_MODEL_ID } from '@vanduo-oss/vdl-ai-chat';

/**
 * Experimental tiny planner: WebLLM Qwen3-0.6B used for DrawPlan generation only.
 *
 * Rules (see doc/vdl-ai-draw.md):
 * - Planning-only: no tools are ever registered on this engine.
 * - At most one generation runs at a time across the page.
 * - Gemma stays the tool-executing model; it is loaded by the host UI only when
 *   the fallback tool loop actually needs it.
 * - Load failures disable the planner for the rest of the session (the
 *   persisted user flag in localStorage is left untouched).
 */

/** @typedef {{ generatePlan: (prompt: string) => Promise<string | null>, disable: () => void, dispose: () => Promise<void>, readonly id: string, readonly disabled: boolean }} TinyDrawPlanner */

/**
 * @param {{
 *   loadLiteRT?: () => Promise<unknown>,
 *   onFail?: (message: string) => unknown,
 *   createChat?: () => Promise<{ generate: Function, isLoaded?: () => boolean, dispose?: () => Promise<void> }>,
 * } | undefined} [opts]
 * @returns {TinyDrawPlanner}
 */
export function createTinyDrawPlanner(opts = {}) {
  const loadLiteRT =
    typeof opts.loadLiteRT === 'function' ? opts.loadLiteRT : async () => import('@litert-lm/core');
  const onFail = typeof opts.onFail === 'function' ? opts.onFail : null;
  const createChat =
    typeof opts.createChat === 'function'
      ? opts.createChat
      : async () => {
          const mod = await import('@vanduo-oss/vdl-ai-chat');
          return new mod.AiChat({
            modelId: TINY_MODEL_ID,
            loadLiteRT,
            systemPromptOptions: { product: 'AI Draw' },
          });
        };

  let disabled = false;
  /** @type {Promise<Awaited<ReturnType<typeof createChat>> | null> | null} */
  let chatPromise = null;

  function fail(message) {
    if (disabled) return;
    disabled = true;
    chatPromise = null;
    onFail?.(message);
  }

  /**
   * Lazily construct and load the planning-only chat. Never throws.
   *
   * @returns {Promise<Awaited<ReturnType<typeof createChat>> | null>}
   */
  function ensureChat() {
    if (disabled) return Promise.resolve(null);
    if (!chatPromise) {
      chatPromise = (async () => {
        try {
          const chat = await createChat();
          await chat.load();
          if (typeof chat.isLoaded === 'function' && !chat.isLoaded()) {
            throw new Error('Tiny planner model load did not complete.');
          }
          return chat;
        } catch (err) {
          console.error('[vdl-ai-draw] fast planner unavailable:', err);
          fail(`Fast planner unavailable (${err?.message || 'load failed'}); using Gemma.`);
          return null;
        }
      })();
    }
    return chatPromise;
  }

  return {
    get id() {
      return TINY_MODEL_ID;
    },
    get disabled() {
      return disabled;
    },
    /**
     * Generate a DrawPlan JSON string, or null when the tiny planner cannot
     * serve this turn (caller falls back to the primary model).
     *
     * Planning is stateless: the conversation resets before every plan so
     * prior turns never eat into the small (4K) context window.
     *
     * @param {string} prompt
     */
    async generatePlan(prompt) {
      if (disabled) return null;
      const chat = await ensureChat();
      if (!chat || disabled) return null;
      try {
        if (typeof chat.reset === 'function') chat.reset();
        const out = await chat.generate(prompt);
        return out == null ? '' : String(out);
      } catch (err) {
        const message = String(err?.message || err);
        console.error('[vdl-ai-draw] fast planner generate failed:', err);
        fail(
          /context window|prompt tokens|sliding_window/i.test(message)
            ? 'Fast planner prompt exceeded the tiny model context; using Gemma.'
            : `Fast planner failed (${message}); using Gemma.`,
        );
        return null;
      }
    },
    /** Stop using the planner for this session without disposing weights. */
    disable() {
      disabled = true;
    },
    /** Release engine resources (page teardown / eval runs). */
    async dispose() {
      disabled = true;
      const pending = chatPromise;
      chatPromise = null;
      if (!pending) return;
      try {
        const chat = await pending;
        if (chat && typeof chat.dispose === 'function') await chat.dispose();
      } catch {
        /* best effort */
      }
    },
  };
}

/** localStorage key behind the "Fast planner" toggle (persisted user preference). */
export const TINY_PLANNER_FLAG_KEY = 'vdl-ai-draw-tiny-planner';

/**
 * Session-only enablement check shared by tests and the eval runner.
 *
 * @param {Storage | undefined} [storage]
 */
export function readTinyPlannerFlag(
  storage = typeof window !== 'undefined' ? window.localStorage : undefined,
) {
  try {
    return storage?.getItem(TINY_PLANNER_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Persist or clear the fast-planner preference.
 *
 * @param {boolean} on
 * @param {Storage | undefined} [storage]
 */
export function writeTinyPlannerFlag(
  on,
  storage = typeof window !== 'undefined' ? window.localStorage : undefined,
) {
  try {
    if (on) storage?.setItem(TINY_PLANNER_FLAG_KEY, '1');
    else storage?.removeItem(TINY_PLANNER_FLAG_KEY);
  } catch {
    /* storage unavailable — session-only */
  }
}
