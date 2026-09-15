/**
 * Verbose trace logger for AI Draw.
 *
 * Sends structured log events to the Vite dev endpoint (/api/dev-log) which writes
 * them to `logs/aidraw-<date>.log` in the project root (gitignored), and logs to
 * the browser console for live inspection.
 */

/**
 * Log an AI Draw event to project logs and browser console.
 *
 * @param {string} tag Short category identifier (e.g. 'PLAN_PROMPT', 'THINKING', 'PLAN_OUTPUT', 'TOOL_CALL', 'CANVAS_STATE', 'ERROR')
 * @param {string} title Human-readable description
 * @param {unknown} [data] Payload or object to inspect
 * @param {'INFO' | 'WARN' | 'ERROR' | 'DEBUG'} [level='INFO']
 */
export async function logAiDrawEvent(tag, title, data = {}, level = 'INFO') {
  try {
    const timestamp = new Date().toISOString();
    const style =
      level === 'ERROR'
        ? 'color: #ef4444; font-weight: bold;'
        : level === 'WARN'
          ? 'color: #f59e0b; font-weight: bold;'
          : 'color: #38bdf8; font-weight: bold;';

    if (level === 'ERROR') {
      console.error(`[AiDraw:${tag}] ${title}`, data);
    } else if (level === 'WARN') {
      console.warn(`[AiDraw:${tag}] ${title}`, data);
    } else {
      console.log(`%c[AiDraw:${tag}] %c${title}`, style, 'color: inherit;', data);
    }

    if (typeof fetch === 'function') {
      fetch('/api/dev-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp,
          tag,
          title,
          data,
          level,
        }),
      }).catch(() => {});
    }
  } catch {
    // Fail silently in offline or production environments
  }
}
