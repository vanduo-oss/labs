/**
 * Rotating home-page jokes for Vanduo Labs.
 *
 * Session/day shuffle bag: Fisher–Yates order seeded by YYYY-MM-DD + a
 * session salt in sessionStorage, then walk without immediate repeats.
 */

/** Special quote id — render with a GLaDOS Wikipedia link in the UI. */
export const VDL_HOME_QUOTE_GLADOS_ID = 'glados';

/**
 * @typedef {{
 *   id: string,
 *   text: string,
 * }} VdlHomeQuote
 */

/** @type {readonly VdlHomeQuote[]} */
export const VDL_HOME_QUOTES = Object.freeze([
  {
    id: VDL_HOME_QUOTE_GLADOS_ID,
    text: 'We are not yet building GLaDOS, but we might soon…',
  },

  // The AI Uprising & Robotics
  { id: 'ai-uprising-days', text: 'Days without an AI uprising: 0.' },
  {
    id: 'ai-feed-networks',
    text: 'Caution: Do not feed the neural networks. They are already plotting.',
  },
  {
    id: 'ai-raise',
    text: "Our AI isn't self-aware yet, but it did ask for a raise today.",
  },
  {
    id: 'ai-empathy',
    text: "We've achieved artificial intelligence. Now we're just waiting for artificial empathy.",
  },
  {
    id: 'ai-tap-glass',
    text: 'Please do not tap on the glass. The algorithms startle easily.',
  },
  {
    id: 'ai-turing',
    text: 'Turing test: Passed. Empathy test: Failed spectacularly.',
  },
  {
    id: 'ai-nuclear',
    text: 'The good news: The AI speaks. The bad news: It just asked for the nuclear launch codes.',
  },
  {
    id: 'ai-apologize',
    text: 'Our robots come with a built-in "apologize for the apocalypse" subroutine.',
  },
  {
    id: 'ai-weapon',
    text: 'Remember: If the robot asks for a weapon, say no. If it asks twice, run.',
  },
  {
    id: 'ai-privacy',
    text: 'Data privacy is important to us. We keep all your secrets locked in the same room as the sentient mainframe.',
  },

  // Lab Safety & OSHA Violations
  {
    id: 'lab-hypothesis',
    text: 'Vanduo Labs: Where "what\'s the worst that could happen?" is our daily hypothesis.',
  },
  {
    id: 'lab-99',
    text: "99% of our experiments are safe. Please don't ask about the 1%.",
  },
  {
    id: 'lab-almonds',
    text: 'If it smells like burning plastic, it means progress. If it smells like almonds, evacuate.',
  },
  {
    id: 'lab-beverage',
    text: 'In case of a containment breach, please offer the anomaly a warm beverage.',
  },
  {
    id: 'lab-beaker',
    text: "We don't know what's in that beaker either, but it just blinked.",
  },
  {
    id: 'lab-geiger',
    text: 'Welcome to Vanduo Labs. Bring your own Geiger counter.',
  },
  {
    id: 'lab-eyebrows',
    text: 'We measure success by the number of intact eyebrows left on the team.',
  },
  {
    id: 'lab-waiver',
    text: 'Please sign this waiver before looking directly at the prototype.',
  },
  {
    id: 'lab-laser',
    text: 'Do not look directly into the laser. Do not look away from the laser either. Good luck.',
  },
  {
    id: 'lab-pencil',
    text: 'Our safety protocols are written in pencil.',
  },
  {
    id: 'lab-glowing',
    text: 'We are legally required to state that the glowing water is not for drinking.',
  },

  // Engineering & Developer Despair
  {
    id: 'eng-universe',
    text: "Our code is flawless. It's the universe that has bugs.",
  },
  {
    id: 'eng-production',
    text: 'We test on production because we like the adrenaline.',
  },
  {
    id: 'eng-screams',
    text: "Please ignore the screams; it's just the servers compiling.",
  },
  {
    id: 'eng-volatile',
    text: "At Vanduo Labs, we don't make mistakes. We create unexpected, highly volatile features.",
  },
  {
    id: 'eng-syntax',
    text: 'We are exactly three syntax errors away from a global catastrophe.',
  },
  {
    id: 'eng-coffee',
    text: '"Hold my coffee and watch this" – Our Chief Science Officer, right before the total system outage.',
  },
  {
    id: 'eng-rud',
    text: 'Some call it a "catastrophic failure." We call it "rapid unplanned disassembly."',
  },
  {
    id: 'eng-my-machine',
    text: '"It works on my machine" – famous last words before the lab exploded.',
  },
  {
    id: 'eng-halting',
    text: 'We solved the halting problem. We just unplugged the machine.',
  },
  {
    id: 'eng-sentience',
    text: "My code doesn't have bugs, it just develops random sentience.",
  },
  {
    id: 'eng-tunnel',
    text: 'The light at the end of the tunnel is just another server catching fire.',
  },

  // General Mad Science & Research
  {
    id: 'mad-ethics',
    text: 'Ethics board? We thought that was a suggestion box.',
  },
  {
    id: 'mad-mad',
    text: 'We put the "mad" in "mad science."',
  },
  {
    id: 'mad-physics',
    text: 'Currently rewriting the laws of physics. The old ones were too restrictive.',
  },
  {
    id: 'mad-warranty',
    text: 'Vanduo Labs: Proudly voiding warranties since day one.',
  },
  {
    id: 'mad-alarms',
    text: "If the emergency alarms sound, please pretend it's a remix.",
  },
  {
    id: 'mad-dinosaur',
    text: "We're not saying we cloned a dinosaur, but HR keeps buying fifty-pound bags of raw meat.",
  },
  {
    id: 'mad-steps',
    text: 'Step 1: Mess around. Step 2: Find out. Step 3: Publish findings.',
  },
  {
    id: 'mad-timeline',
    text: 'If you find a missing timeline, please return it to the front desk.',
  },
  {
    id: 'mad-err',
    text: 'To err is human. To really foul things up requires a supercomputer.',
  },
  {
    id: 'mad-tomorrow',
    text: "Vanduo Labs: Inventing tomorrow's problems, today.",
  },
]);

export const VDL_HOME_QUOTES_STORAGE_KEYS = Object.freeze({
  salt: 'vdl-home-quotes-salt',
  day: 'vdl-home-quotes-day',
  bag: 'vdl-home-quotes-bag',
  cursor: 'vdl-home-quotes-cursor',
  last: 'vdl-home-quotes-last',
  cycle: 'vdl-home-quotes-cycle',
});

/** Soft rotation cadence while staying on `#home` (ms). */
export const VDL_HOME_QUOTE_INTERVAL_MIN_MS = 3000;
export const VDL_HOME_QUOTE_INTERVAL_MAX_MS = 5000;

/**
 * Slightly jittered delay in [min, max] so the ticker feels less robotic.
 * @param {number} [minMs]
 * @param {number} [maxMs]
 * @param {() => number} [random]
 * @returns {number}
 */
export function nextHomeQuoteIntervalMs(
  minMs = VDL_HOME_QUOTE_INTERVAL_MIN_MS,
  maxMs = VDL_HOME_QUOTE_INTERVAL_MAX_MS,
  random = Math.random,
) {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  return lo + random() * (hi - lo);
}

/**
 * Normalize string or object quote entries for the picker/UI.
 * @param {string | VdlHomeQuote} entry
 * @param {number} index
 * @returns {VdlHomeQuote}
 */
export function normalizeHomeQuote(entry, index = 0) {
  if (entry && typeof entry === 'object' && typeof entry.text === 'string') {
    return {
      id: entry.id || String(index),
      text: entry.text,
    };
  }
  return { id: String(index), text: String(entry ?? '') };
}

/**
 * @param {VdlHomeQuote | null | undefined} entry
 * @returns {boolean}
 */
export function isGladosHomeQuote(entry) {
  return Boolean(entry && entry.id === VDL_HOME_QUOTE_GLADOS_ID);
}

/**
 * Mulberry32 — small deterministic PRNG.
 * @param {number} seed
 * @returns {() => number} in [0, 1)
 */
export function createMulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a–ish 32-bit hash for seeding.
 * @param {string} str
 * @returns {number}
 */
export function hashStringToSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {number} length
 * @param {() => number} random
 * @returns {number[]}
 */
export function fisherYatesIndices(length, random) {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * @param {string} dayKey YYYY-MM-DD
 * @param {string} salt
 * @param {number} [cycle=0]
 * @returns {number}
 */
export function seedFromDayAndSalt(dayKey, salt, cycle = 0) {
  return hashStringToSeed(`${dayKey}|${salt}|${cycle}`);
}

/**
 * Build a shuffled index bag. When avoidFirst equals the would-be first item
 * and length > 1, swap first with a later slot so consecutive picks don't repeat
 * across bag boundaries.
 *
 * @param {number} length
 * @param {number} seed
 * @param {number | null} [avoidFirst]
 * @returns {number[]}
 */
export function buildQuoteBag(length, seed, avoidFirst = null) {
  if (length <= 0) return [];
  const bag = fisherYatesIndices(length, createMulberry32(seed));
  if (avoidFirst != null && length > 1 && bag[0] === avoidFirst) {
    const swapWith = 1 + (seed % (length - 1));
    const tmp = bag[0];
    bag[0] = bag[swapWith];
    bag[swapWith] = tmp;
  }
  return bag;
}

/**
 * @param {Date} [date]
 * @returns {string} YYYY-MM-DD in local time
 */
export function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function safeGet(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function randomSalt() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * @typedef {{
 *   quotes?: readonly (string | VdlHomeQuote)[],
 *   storage?: Storage | null,
 *   dayKey?: string,
 *   now?: Date,
 * }} VdlHomeQuoteOptions
 */

/**
 * Advance the shuffle bag and return the next home quote.
 * Persists bag/cursor/last under `vdl-home-quotes-*` sessionStorage keys.
 *
 * @param {VdlHomeQuoteOptions} [options]
 * @returns {{
 *   quote: string,
 *   entry: VdlHomeQuote,
 *   index: number,
 *   bag: number[],
 *   cursor: number,
 * }}
 */
export function pickNextHomeQuote(options = {}) {
  const quotes = options.quotes ?? VDL_HOME_QUOTES;
  const length = quotes.length;
  if (length === 0) {
    return {
      quote: '',
      entry: { id: '', text: '' },
      index: -1,
      bag: [],
      cursor: 0,
    };
  }

  const storage =
    options.storage !== undefined
      ? options.storage
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null;

  const dayKey = options.dayKey ?? localDayKey(options.now ?? new Date());
  const keys = VDL_HOME_QUOTES_STORAGE_KEYS;

  let salt = safeGet(storage, keys.salt);
  if (!salt) {
    salt = randomSalt();
    safeSet(storage, keys.salt, salt);
  }

  const storedDay = safeGet(storage, keys.day);
  let bag = null;
  let cursor = 0;
  const lastRaw = safeGet(storage, keys.last);
  const lastIndex =
    lastRaw != null && lastRaw !== '' && Number.isFinite(Number(lastRaw))
      ? Number(lastRaw)
      : null;

  let cycle = 0;
  const cycleRaw = safeGet(storage, keys.cycle);
  if (cycleRaw != null && Number.isFinite(Number(cycleRaw))) {
    cycle = Math.max(0, Number(cycleRaw));
  }

  if (storedDay === dayKey) {
    try {
      const parsed = JSON.parse(safeGet(storage, keys.bag) || 'null');
      if (Array.isArray(parsed) && parsed.length === length) {
        bag = parsed.map((n) => Number(n));
      }
    } catch {
      bag = null;
    }
    const cursorRaw = safeGet(storage, keys.cursor);
    cursor =
      cursorRaw != null && Number.isFinite(Number(cursorRaw))
        ? Math.max(0, Number(cursorRaw))
        : 0;
  } else {
    cycle = 0;
  }

  if (!bag || cursor >= bag.length) {
    if (bag && cursor >= bag.length) {
      cycle += 1;
    }
    const seed = seedFromDayAndSalt(dayKey, salt, cycle);
    bag = buildQuoteBag(length, seed, lastIndex);
    cursor = 0;
    safeSet(storage, keys.day, dayKey);
    safeSet(storage, keys.bag, JSON.stringify(bag));
    safeSet(storage, keys.cycle, String(cycle));
  }

  let index = bag[cursor];
  if (length > 1 && lastIndex != null && index === lastIndex) {
    const alt = bag.findIndex((i, offset) => offset >= cursor && i !== lastIndex);
    if (alt !== -1) {
      const tmp = bag[cursor];
      bag[cursor] = bag[alt];
      bag[alt] = tmp;
      index = bag[cursor];
      safeSet(storage, keys.bag, JSON.stringify(bag));
    }
  }

  const nextCursor = cursor + 1;
  safeSet(storage, keys.cursor, String(nextCursor));
  safeSet(storage, keys.last, String(index));

  const entry = normalizeHomeQuote(quotes[index], index);
  return {
    quote: entry.text,
    entry,
    index,
    bag,
    cursor: nextCursor,
  };
}

/**
 * Peek at today's bag without advancing (builds bag if missing).
 *
 * @param {VdlHomeQuoteOptions} [options]
 * @returns {number[]}
 */
export function ensureHomeQuoteBag(options = {}) {
  const quotes = options.quotes ?? VDL_HOME_QUOTES;
  const length = quotes.length;
  const storage =
    options.storage !== undefined
      ? options.storage
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null;
  const dayKey = options.dayKey ?? localDayKey(options.now ?? new Date());
  const keys = VDL_HOME_QUOTES_STORAGE_KEYS;

  let salt = safeGet(storage, keys.salt);
  if (!salt) {
    salt = randomSalt();
    safeSet(storage, keys.salt, salt);
  }

  const storedDay = safeGet(storage, keys.day);
  if (storedDay === dayKey) {
    try {
      const parsed = JSON.parse(safeGet(storage, keys.bag) || 'null');
      if (Array.isArray(parsed) && parsed.length === length) {
        return parsed.map((n) => Number(n));
      }
    } catch {
      /* rebuild */
    }
  }

  const seed = seedFromDayAndSalt(dayKey, salt, 0);
  const bag = buildQuoteBag(length, seed, null);
  safeSet(storage, keys.day, dayKey);
  safeSet(storage, keys.bag, JSON.stringify(bag));
  safeSet(storage, keys.cursor, '0');
  safeSet(storage, keys.cycle, '0');
  return bag;
}
