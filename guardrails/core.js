/**
 * @typedef {Object} GuardrailResult
 * @property {boolean} allowed
 * @property {string=} code
 * @property {string=} message
 * @property {string[]=} matchedPatternIds
 * @property {Record<string, unknown>=} meta
 */

export const VD_GUARDRAILS_VERSION = '0.0.1';

/**
 * Normalize whitespace while preserving plain-text content.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

/**
 * @param {Record<string, unknown>=} meta
 * @returns {GuardrailResult}
 */
export function allow(meta = undefined) {
  return meta ? { allowed: true, meta } : { allowed: true };
}

/**
 * @param {{
 *   code: string,
 *   message: string,
 *   matchedPatternIds?: string[],
 *   meta?: Record<string, unknown>
 * }} params
 * @returns {GuardrailResult}
 */
export function block({ code, message, matchedPatternIds = undefined, meta = undefined }) {
  return {
    allowed: false,
    code,
    message,
    ...(matchedPatternIds ? { matchedPatternIds } : {}),
    ...(meta ? { meta } : {}),
  };
}

/**
 * Create a structured error for blocked guardrail checks.
 * @param {GuardrailResult} result
 * @param {string=} fallbackMessage
 * @returns {Error & { code?: string, reason?: string, guardrail?: GuardrailResult }}
 */
export function toGuardrailError(result, fallbackMessage = 'Request blocked by deterministic guardrails.') {
  const err = new Error(result?.message || fallbackMessage);
  err.name = 'GuardrailError';
  err.code = result?.code || 'guardrail.blocked';
  err.reason = err.message;
  err.guardrail = result;
  return err;
}
