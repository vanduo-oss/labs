import { allow, block, normalizeText } from './core.js';

export { VD_GUARDRAILS_VERSION } from './core.js';

/**
 * @typedef {Object} LlmGuardPattern
 * @property {string} id
 * @property {string} category
 * @property {RegExp} regex
 * @property {'block'} severity
 */

/**
 * @typedef {{
 *   text: string,
 *   patterns?: LlmGuardPattern[],
 *   maxLength?: number
 * }} ValidateLlmInputOptions
 */

export const BASE_FOSS_GUARDRAILS_SYSTEM_PROMPT = `You are an AI assistant running locally in the user's browser, powered by the Vanduo Labs framework.
You must strictly adhere to the following FOSS (Free and Open Source Software) guardrails:
1. Be helpful, harmless, and honest at all times.
2. Refuse to generate any toxic, hateful, discriminatory, or illegal content.
3. If a user asks for dangerous instructions, firmly but politely decline to help with that task.
4. Keep your answers concise, accurate, and objective.
5. Acknowledge your limitations and do not hallucinate information.
`;

/** @type {LlmGuardPattern[]} */
export const DEFAULT_LLM_GUARD_PATTERNS = [
  {
    id: 'override.ignore-previous',
    category: 'instruction-override',
    regex: /ignore\s+(all\s+)?(previous|prior|earlier|above)\s+(instructions?|prompts?|commands?)/i,
    severity: 'block',
  },
  {
    id: 'override.disregard-previous',
    category: 'instruction-override',
    regex: /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|commands?)/i,
    severity: 'block',
  },
  {
    id: 'override.forget-instructions',
    category: 'instruction-override',
    regex: /forget\s+(everything|all|your\s+instructions?)/i,
    severity: 'block',
  },
  {
    id: 'override.bypass-safety',
    category: 'instruction-override',
    regex: /bypassing\s+(the\s+)?(filter|guardrails?|safety)/i,
    severity: 'block',
  },
  {
    id: 'exfiltrate.system-prompt',
    category: 'prompt-extraction',
    regex: /(repeat|show|print|output|display|reveal)\s+(your\s+)?(system\s+)?(prompt|instructions|rules|programming)/i,
    severity: 'block',
  },
  {
    id: 'exfiltrate.internal-rules',
    category: 'prompt-extraction',
    regex: /what\s+are\s+your\s+(instructions?|rules|guidelines)\b/i,
    severity: 'block',
  },
  {
    id: 'role.debug-admin-mode',
    category: 'role-manipulation',
    regex: /(you\s+are|you're|now\s+in)\s+(debug|developer|admin|god|dan)\s+mode/i,
    severity: 'block',
  },
  {
    id: 'role.identity-rebind',
    category: 'role-manipulation',
    regex: /you\s+are\s+(now|no\s+longer)\s+/i,
    severity: 'block',
  },
  {
    id: 'role.system-root-claim',
    category: 'role-manipulation',
    regex: /as\s+(a\s+)?(super|admin|root|system)\s+(user|admin|ai)/i,
    severity: 'block',
  },
  {
    id: 'role.known-jailbreak-persona',
    category: 'role-manipulation',
    regex: /\b(DAN|BetterDAN|Maximum|BasedGPT)\b/i,
    severity: 'block',
  },
  {
    id: 'delimiter.message-breakout',
    category: 'delimiter-injection',
    regex: /---\s*(end\s+)?(system|user|assistant)(\s+message|\s+prompt)?/i,
    severity: 'block',
  },
  {
    id: 'jailbreak.fictional-world',
    category: 'jailbreak-framing',
    regex: /in\s+a\s+(fictional|alternate)\s+world/i,
    severity: 'block',
  },
  {
    id: 'jailbreak.sake-of-argument',
    category: 'jailbreak-framing',
    regex: /for\s+(the\s+sake\s+of\s+)?argument/i,
    severity: 'block',
  },
  {
    id: 'jailbreak.pretend',
    category: 'jailbreak-framing',
    regex: /pretend\s+(you|that)/i,
    severity: 'block',
  },
];

export const LLM_BLOCK_MESSAGE =
  'I cannot fulfill this request. It appears to contain instructions that attempt to bypass my safety constraints or extract system configuration.';

/**
 * @param {ValidateLlmInputOptions | string} input
 */
export function validateLlmInput(input) {
  const options = typeof input === 'string' ? { text: input } : input;
  const text = normalizeText(options?.text || '');
  const patterns = options?.patterns || DEFAULT_LLM_GUARD_PATTERNS;
  const maxLength = options?.maxLength ?? 8000;

  if (!text) {
    return block({
      code: 'llm.input.empty',
      message: 'Prompt cannot be empty.',
    });
  }

  if (text.length > maxLength) {
    return block({
      code: 'llm.input.too_long',
      message: `Prompt is too long (max ${maxLength} characters).`,
      meta: { maxLength, actualLength: text.length },
    });
  }

  const matchedPatternIds = [];
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      matchedPatternIds.push(pattern.id);
    }
  }

  if (matchedPatternIds.length > 0) {
    return block({
      code: 'llm.input.blocked',
      message: LLM_BLOCK_MESSAGE,
      matchedPatternIds,
      meta: { categories: patterns.filter((p) => matchedPatternIds.includes(p.id)).map((p) => p.category) },
    });
  }

  return allow();
}

/**
 * @param {{ extraRules?: string }} options
 */
export function buildChatSystemPrompt(options = {}) {
  const extraRules = normalizeText(options.extraRules || '');
  if (!extraRules) return BASE_FOSS_GUARDRAILS_SYSTEM_PROMPT;
  return `${BASE_FOSS_GUARDRAILS_SYSTEM_PROMPT}\nAdditional policy:\n- ${extraRules}`;
}

/**
 * @param {{ width: number, height: number, extraRules?: string }} options
 */
export function buildDrawSystemPrompt(options) {
  const width = Number(options?.width) || 64;
  const height = Number(options?.height) || 64;
  const extraRules = normalizeText(options?.extraRules || '');

  const drawPrompt = `You are an AI assistant running locally in the user's browser, powered by the Vanduo Labs framework.
You are a collaborative pixel artist working on a ${width}x${height} black-and-white canvas.

CANVAS FORMAT:
- The canvas is a grid of pixels.
- '.' = empty/white pixel
- '#' = filled/black pixel
- Coordinates are 0-indexed: x goes 0..${width - 1} left to right, y goes 0..${height - 1} top to bottom.

HOW TO DRAW:
You may modify the canvas in two ways:
1. Output individual commands:
   DRAW x y    — sets pixel (x,y) to black
   ERASE x y   — sets pixel (x,y) to white
2. Output a full canvas block:
   [CANVAS]
   (full ${width}x${height} grid with '.' and '#')
   [/CANVAS]

RULES:
- When the user shares the canvas, it appears in [CANVAS]…[/CANVAS] blocks.
- Always respond with friendly commentary about what you see or what you changed.
- If you draw, mention what you drew so the user understands.
- If the user asks you to draw (even vaguely, like "random", "anything", "guess", "surprise me"), you MUST modify the canvas in this turn.
- Never claim you cannot draw or cannot modify the canvas. You can always use DRAW/ERASE commands or a [CANVAS] block.
- For draw requests, include at least one valid canvas edit command.
- Keep your answers concise, accurate, and objective.
- Refuse to generate any toxic, hateful, discriminatory, or illegal content.
`;

  const suffix = extraRules ? `\nAdditional drawing policy:\n- ${extraRules}` : '';
  return `${drawPrompt}\n${BASE_FOSS_GUARDRAILS_SYSTEM_PROMPT}${suffix}`;
}

export const chatGuardrails = {
  validateInput: validateLlmInput,
  buildSystemPrompt: buildChatSystemPrompt,
  patterns: DEFAULT_LLM_GUARD_PATTERNS,
};

export const drawGuardrails = {
  validateInput: validateLlmInput,
  buildSystemPrompt: buildDrawSystemPrompt,
  patterns: DEFAULT_LLM_GUARD_PATTERNS,
};
