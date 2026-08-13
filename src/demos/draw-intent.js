/** Fallback when the host does not pass a measured canvas. */
const FALLBACK_CANVAS = Object.freeze({ width: 1000, height: 800 });

/**
 * CSS / common spoken color names → hex. Used when rewriting stripe requests
 * so the model gets concrete fill values instead of vague color words.
 */
export const NAMED_DRAW_COLORS = Object.freeze({
  yellow: '#ffd000',
  gold: '#fdb913',
  amber: '#fdb913',
  green: '#006a44',
  red: '#c1272d',
  blue: '#0039a6',
  black: '#111111',
  white: '#ffffff',
  orange: '#f97316',
  purple: '#7c3aed',
  pink: '#ec4899',
  brown: '#92400e',
  cyan: '#06b6d4',
  magenta: '#d946ef',
  gray: '#6b7280',
  grey: '#6b7280',
});

/**
 * Horizontal tricolors that are just stacked rectangles. Vertical flags
 * (Italy, France, …) are left to the generic color-list path if the user
 * names the colors.
 */
export const SIMPLE_HORIZONTAL_FLAGS = Object.freeze([
  {
    id: 'lithuania',
    re: /\b(lithuan|lietuv|lituan)\w*/i,
    colors: ['#fdb913', '#006a44', '#c1272d'],
  },
  { id: 'germany', re: /\bgerman\w*/i, colors: ['#000000', '#dd0000', '#ffce00'] },
  { id: 'estonia', re: /\beston\w*/i, colors: ['#0072ce', '#000000', '#ffffff'] },
  {
    id: 'netherlands',
    re: /\b(netherlands|dutch|holland)\b/i,
    colors: ['#ae1c28', '#ffffff', '#21468b'],
  },
  { id: 'hungary', re: /\bhungar\w*/i, colors: ['#ce2939', '#ffffff', '#477050'] },
  { id: 'armenia', re: /\barmenia\w*/i, colors: ['#d90012', '#0033a0', '#f2a800'] },
  { id: 'russia', re: /\brussia\w*/i, colors: ['#ffffff', '#0039a6', '#d52b1e'] },
  { id: 'yemen', re: /\byemen\w*/i, colors: ['#ce1126', '#ffffff', '#000000'] },
  { id: 'austria', re: /\baustria\w*/i, colors: ['#ed2939', '#ffffff', '#ed2939'] },
  { id: 'luxembourg', re: /\bluxembourg\w*/i, colors: ['#ed2939', '#ffffff', '#00a1de'] },
]);

const COLOR_NAME_RE = new RegExp(`\\b(${Object.keys(NAMED_DRAW_COLORS).join('|')})\\b`, 'gi');
const HEX_RE = /#([0-9a-f]{3,8})\b/gi;
const STRIPE_HINT_RE =
  /\b(flag|tricolou?r|stripe|stripes|banded|bands?|stacked|stack|on top|then\b|horizontal\s+bars?)\b/i;

/**
 * @param {string} name
 * @returns {string | undefined}
 */
export function namedColorToHex(name) {
  if (typeof name !== 'string') return undefined;
  return NAMED_DRAW_COLORS[name.trim().toLowerCase()];
}

/**
 * Collect colors in mention order (hex first, then spoken names).
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractStripeColors(text) {
  const source = String(text || '');
  const found = [];
  const seen = new Set();

  const push = (hex) => {
    const key = hex.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push(hex);
  };

  HEX_RE.lastIndex = 0;
  let hexMatch = HEX_RE.exec(source);
  while (hexMatch) {
    push(normalizeHex(hexMatch[0]));
    hexMatch = HEX_RE.exec(source);
  }

  COLOR_NAME_RE.lastIndex = 0;
  let nameMatch = COLOR_NAME_RE.exec(source);
  while (nameMatch) {
    const hex = namedColorToHex(nameMatch[1]);
    if (hex) push(hex);
    nameMatch = COLOR_NAME_RE.exec(source);
  }

  return found;
}

function normalizeHex(raw) {
  let h = String(raw || '')
    .replace('#', '')
    .toLowerCase();
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (h.length === 4)
    h = h
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  if (h.length === 8) h = h.slice(0, 6);
  return `#${h}`;
}

/**
 * @param {string} text
 * @returns {{ id: string, colors: string[] } | null}
 */
export function matchKnownHorizontalFlag(text) {
  const source = String(text || '');
  for (const entry of SIMPLE_HORIZONTAL_FLAGS) {
    if (entry.re.test(source)) return { id: entry.id, colors: [...entry.colors] };
  }
  return null;
}

/**
 * @param {string} text
 * @param {string[]} colors
 * @returns {boolean}
 */
export function isStackedBandRequest(text, colors) {
  const source = String(text || '');
  if (matchKnownHorizontalFlag(source)) return true;
  if (colors.length >= 2 && STRIPE_HINT_RE.test(source)) return true;
  if (colors.length >= 3 && /\b(rectangle|rect|bar|line|band)s?\b/i.test(source)) return true;
  return false;
}

/**
 * Lay out N full-width horizontal bands centered as a group.
 *
 * @param {string[]} colors
 * @param {{ width?: number, height?: number }} [canvas]
 * @param {{ fat?: boolean }} [opts]
 * @returns {Array<{ x: number, y: number, width: number, height: number, fill: string }>}
 */
export function layoutStackedBands(colors, canvas = FALLBACK_CANVAS, opts = {}) {
  const width = canvas.width ?? FALLBACK_CANVAS.width;
  const height = canvas.height ?? FALLBACK_CANVAS.height;
  const n = colors.length;
  const fat = Boolean(opts.fat);
  const x = Math.round(width * 0.1);
  const bandW = Math.round(width * 0.8);
  const groupH = Math.round(height * (fat ? 0.66 : 0.54));
  const bandH = Math.round(groupH / n);
  const startY = Math.round((height - bandH * n) / 2);
  return colors.map((fill, i) => ({
    x,
    y: startY + i * bandH,
    width: bandW,
    height: bandH,
    fill,
  }));
}

/**
 * @param {Array<{ x: number, y: number, width: number, height: number, fill: string }>} bands
 * @returns {string}
 */
export function formatStackedBandInstructions(bands) {
  const lines = bands.map((b, i) => {
    const n = i + 1;
    return `${n}) add_shape type=rectangle fill=${b.fill} x=${b.x} y=${b.y} width=${b.width} height=${b.height}`;
  });
  return [
    'Draw these shapes now with add_shape. Do not refuse. This is ordinary filled-rectangle geometry (solid color bands), not a restricted image and not a complex illustration.',
    'Emit every add_shape call in a SINGLE turn (multiple tool calls at once). Do not call get_canvas or list_shapes first. After the tools run, reply with one short sentence confirming the bands.',
    'Call add_shape once per rectangle. Each rectangle MUST use a different y so they do not overlap. Never reuse the same x,y for two rectangles. Do not use place=center for every band — place=center stacks them on top of each other and only the last color is visible.',
    'Use the fill field for the solid color (fillColor is also accepted).',
    '',
    ...lines,
  ].join('\n');
}

/**
 * Rewrite simple flag / stacked-stripe requests into explicit rectangle
 * coordinates so small local models do not refuse "national flag" wording
 * and do not emit three identical bboxes.
 *
 * @param {string} text
 * @param {{ width?: number, height?: number }} [canvas]
 * @returns {{ text: string, simplified: boolean, kind: string | null, colors: string[], bands: Array<{ x: number, y: number, width: number, height: number, fill: string }> }}
 */
export function normalizeDrawUserIntent(text, canvas = FALLBACK_CANVAS) {
  const raw = String(text || '').trim();
  const empty = { text: raw, simplified: false, kind: null, colors: [], bands: [] };
  if (!raw) return empty;

  const mentioned = extractStripeColors(raw);
  const known = matchKnownHorizontalFlag(raw);
  const colors = known?.colors?.length ? known.colors : mentioned;

  if (!isStackedBandRequest(raw, colors) || colors.length < 2) {
    return empty;
  }

  const fat = /\b(fat|big|huge|large|thick|wide)\b/i.test(raw);
  const bands = layoutStackedBands(colors, canvas, { fat });
  return {
    text: formatStackedBandInstructions(bands),
    simplified: true,
    kind: known ? `flag:${known.id}` : 'stacked-bands',
    colors: [...colors],
    bands,
  };
}

/**
 * Classify a fill so "yellow" / "#fdb913" / "#ffd000" can be matched.
 *
 * @param {string} [fill]
 * @returns {string}
 */
export function fillKind(fill) {
  const named = namedColorToHex(fill);
  const raw = String(named || fill || '').trim();
  let r;
  let g;
  let b;
  if (raw.charAt(0) === '#') {
    let h = raw.slice(1).toLowerCase();
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    if (h.length === 8) h = h.slice(0, 6);
    if (h.length !== 6 || Number.isNaN(parseInt(h, 16))) return raw.toLowerCase();
    const n = parseInt(h, 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    return raw.toLowerCase();
  }
  if (r > 160 && g > 120 && b < 140) return 'yellow';
  if (g > r + 8 && g >= b) return 'green';
  if (r > 140 && r > g + 20 && r > b) return 'red';
  if (r < 40 && g < 40 && b < 40) return 'black';
  if (r > 230 && g > 230 && b > 230) return 'white';
  if (b > r + 20 && b >= g) return 'blue';
  return `${r},${g},${b}`;
}

/**
 * After the model tool loop, guarantee every planned band exists with a
 * distinct y. Small models often emit one rectangle and claim they drew three.
 *
 * @param {(name: string, args: Record<string, unknown>) => unknown | Promise<unknown>} execute
 * @param {Array<{ x: number, y: number, width: number, height: number, fill: string }>} bands
 * @returns {Promise<{ ok: boolean, added: number, updated: number }>}
 */
export async function fulfillStackedBandIntent(execute, bands) {
  if (typeof execute !== 'function' || !bands?.length) {
    return { ok: false, added: 0, updated: 0 };
  }

  const list = await execute('list_shapes', {});
  const rects = (Array.isArray(list) ? list : []).filter((s) => s.type === 'rectangle');
  const claimed = new Set();
  let added = 0;
  let updated = 0;

  for (const band of bands) {
    const idx = rects.findIndex(
      (s, i) => !claimed.has(i) && fillKind(s.fill) === fillKind(band.fill),
    );
    if (idx >= 0) {
      claimed.add(idx);
      const s = rects[idx];
      const sameY = Math.abs(Number(s.y) - band.y) <= 8;
      const sameW = Math.abs(Number(s.w ?? s.width) - band.width) <= 8;
      if (!sameY || !sameW) {
        await execute('update_shape', {
          shapeId: s.id,
          x: band.x,
          y: band.y,
          width: band.width,
          height: band.height,
          fill: band.fill,
        });
        updated += 1;
      }
    } else {
      await execute('add_shape', {
        type: 'rectangle',
        x: band.x,
        y: band.y,
        width: band.width,
        height: band.height,
        fill: band.fill,
      });
      added += 1;
    }
  }

  return { ok: true, added, updated };
}

const CLEAR_CANVAS_RE =
  /\b(clear|wipe|erase|reset)\b(?:\s+\w+){0,4}\s+\b(canvas|board|drawing|shapes?|it|all)\b/i;
const CLEAR_CANVAS_FLIP_RE =
  /\b(canvas|board|drawing)\b(?:\s+\w+){0,4}\s+\b(clear|wipe|erase|reset)\b/i;
const CLEAR_ONLY_RE =
  /^(clear|wipe|erase|reset)(\s+the)?(\s+canvas|\s+board|\s+drawing)?\s*[.!]*$/i;

const MATH_FN_MATCHERS = Object.freeze([
  { id: 'sine', re: /\bsin(e|us|usoide)?\b|\bsinusoid/i },
  { id: 'cosine', re: /\bcos(ine|in)?\b/i },
  { id: 'tangent', re: /\btan(gent)?\b/i },
  { id: 'hyperbola', re: /\bhyperbolas?\b|\bhyperbol/i },
  { id: 'parabola', re: /\bparabolas?\b|\bparabol/i },
]);

const MATH_AXES_RE = /\baxes\b|\b(x|y)[-\s]*axis\b|\bx\s*y\s*ax|\bxy[-\s]*ax/i;
const MATH_HINT_RE = /\bas in maths?\b|\bmaths?\b|\bfunctions?\b|\bplot\b|\bgraph\b/i;

/** Stroke colors used when the harness fulfills a math-plot recipe. */
export const MATH_PLOT_STROKES = Object.freeze({
  sine: '#e11d48',
  cosine: '#2563eb',
  tangent: '#15803d',
  hyperbola: '#7c3aed',
  parabola: '#d97706',
  axis: '#111111',
});

/**
 * Clickable demo prompts. Only strings the harness can fulfill with zero model
 * tool calls (flags, math plot, star, smiley, heart).
 */
export const DRAW_EXAMPLE_PROMPTS = Object.freeze([
  {
    id: 'lithuania',
    label: 'Lithuanian flag',
    text: 'paint big fat nice Lithuanian flag (yellow-green-red)',
  },
  {
    id: 'math',
    label: 'Math axes',
    text: 'draw x y axis and sin, cosin, tan and hyperbola on them - as in maths',
  },
  {
    id: 'star',
    label: 'Five-pointed star',
    text: 'draw a five pointed star',
  },
  {
    id: 'smiley',
    label: '😊 Smiley',
    text: 'draw a yellow smiley face',
  },
  {
    id: 'heart',
    label: 'Green heart',
    text: 'draw a green heart',
  },
]);

/**
 * Where example chips belong for the current chrome (windowed vs fullscreen).
 *
 * @param {{ isFullscreen?: boolean, shapeCount?: number, messageCount?: number }} [opts]
 */
export function drawPromptChipLayout({
  isFullscreen = false,
  shapeCount = 0,
  messageCount = 0,
} = {}) {
  const fs = Boolean(isFullscreen);
  const emptyCanvas = Number(shapeCount) <= 0;
  const emptyChat = Number(messageCount) <= 0;
  return {
    canvasOverlay: fs && emptyCanvas,
    chatEmptyChips: !fs && emptyChat,
    chatTryRow: fs || !emptyChat,
  };
}

/** `add_curve` kinds that assemble a face from ellipse + eyes + mouth arc. */
export const FACE_CURVE_KINDS = Object.freeze(['smiley', 'wink', 'sad']);

const STAR_RE =
  /\b((five|5)[\s-]*point(ed)?\s+stars?|(draw|paint|add|make|sketch)\b[\s\S]{0,48}\bstars?)\b|\b(a|the)\s+(five|5)[\s-]*point(ed)?\s+stars?\b/i;
const HEART_RE =
  /\b(draw|paint|add|make|sketch)\b[\s\S]{0,40}\bhearts?\b|\b(green|red|pink)\s+hearts?\b/i;
const SPIRAL_RE = /\b(draw|paint|add|make|sketch)\b[\s\S]{0,40}\bspirals?\b|\bsmooth\s+spirals?\b/i;
const WINK_RE = /\bwink(ing)?(\s+(face|smiley|emoji))?\b|😉/i;
const SAD_FACE_RE = /\b(sad|frown(ing)?)(\s+(face|smiley|emoji))?\b|☹️|😞/i;
const SMILEY_RE = /\b(smiley|smile\s*face|smiley\s*face)\b|😊|🙂|:-\)|:\)/i;
const SUCCESS_CLAIM_RE =
  /\b(i (have |just |’ve |'ve )?(drew|drawn|painted|added|created|sketched)|have drawn|just drew|i've drawn|successfully (drew|drawn|added))\b/i;
const SUCCESS_CLAIM_NEG_RE =
  /\b(did not|didn't|nothing was|could not|couldn't|failed to|not drawn|was not drawn|canvas is empty|nothing new)\b/i;

const emptyStacked = () => ({
  text: '',
  simplified: false,
  kind: null,
  colors: [],
  bands: [],
});

const emptyMath = () => ({
  simplified: false,
  wantsAxes: false,
  plots: [],
  replacesCanvas: false,
  kind: null,
});

/**
 * @param {string} text
 * @returns {boolean}
 */
export function wantsClearCanvas(text) {
  const source = String(text || '').trim();
  if (!source) return false;
  if (isClearOnlyRequest(source)) return true;
  if (CLEAR_CANVAS_RE.test(source)) return true;
  if (CLEAR_CANVAS_FLIP_RE.test(source)) return true;
  return false;
}

/**
 * True when the user only asked to empty the canvas (no follow-up draw).
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isClearOnlyRequest(text) {
  const source = String(text || '').trim();
  if (!source) return false;
  if (CLEAR_ONLY_RE.test(source)) return true;
  return /^(please\s+)?(clear|wipe|erase|reset)(\s+(the\s+)?(canvas|board|drawing|it|all|shapes?))?(\s+please)?\s*[.!?]*$/i.test(
    source,
  );
}

/**
 * Detect "plot these functions on x/y axes" — not a single "red sine in the center".
 *
 * @param {string} text
 * @returns {{ simplified: boolean, wantsAxes: boolean, plots: string[], replacesCanvas: boolean, kind: string | null }}
 */
export function parseMathPlotIntent(text) {
  const source = String(text || '');
  const plots = MATH_FN_MATCHERS.filter((entry) => entry.re.test(source)).map((entry) => entry.id);
  const hasAxes = MATH_AXES_RE.test(source);
  const asMaths = MATH_HINT_RE.test(source);
  const simplified =
    plots.length >= 2 ||
    (hasAxes && plots.length >= 1) ||
    (Boolean(asMaths) && hasAxes && plots.length >= 1);
  if (!simplified) return emptyMath();
  return {
    simplified: true,
    wantsAxes: true,
    plots,
    replacesCanvas: true,
    kind: 'math-plot',
  };
}

/**
 * @param {{ plots?: string[], replacesCanvas?: boolean }} plan
 * @param {{ width?: number, height?: number }} [canvas]
 * @returns {string}
 */
export function formatMathPlotInstructions(plan, canvas = FALLBACK_CANVAS) {
  const width = canvas.width ?? FALLBACK_CANVAS.width;
  const height = canvas.height ?? FALLBACK_CANVAS.height;
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const margin = 48;
  const plots = Array.isArray(plan?.plots) ? plan.plots : [];
  const lines = [
    'Use tools now. Do not only describe. Do not redraw previous colored rectangles or flags.',
    plan?.replacesCanvas ? 'This turn is a math plot. The previous drawing must not remain.' : '',
    `1) add_shape type=line x=${margin} y=${cy} x2=${width - margin} y2=${cy} stroke=${MATH_PLOT_STROKES.axis} strokeWidth=2 arrowEnd=true`,
    `2) add_shape type=line x=${cx} y=${height - margin} x2=${cx} y2=${margin} stroke=${MATH_PLOT_STROKES.axis} strokeWidth=2 arrowEnd=true`,
  ].filter(Boolean);
  let n = 3;
  for (const kind of plots) {
    const stroke = MATH_PLOT_STROKES[kind] || MATH_PLOT_STROKES.sine;
    lines.push(
      `${n}) add_curve kind=${kind} bounds={x:${margin},y:${margin},w:${width - margin * 2},h:${height - margin * 2}} samples=64 stroke=${stroke}`,
    );
    n += 1;
  }
  lines.push(
    'After the tools run, reply with one short sentence naming only what is actually on the canvas.',
  );
  return lines.join('\n');
}

const emptyRecipe = () => ({
  simplified: false,
  id: null,
  kind: null,
  family: null,
  variant: null,
  stroke: null,
  fill: null,
  sides: null,
});

/**
 * Centered square bounds so stars / faces / hearts are not flattened by the
 * default band height used for sine waves.
 *
 * @param {{ width?: number, height?: number }} [canvas]
 * @param {number} [ratio]
 */
export function squareDrawBounds(canvas = FALLBACK_CANVAS, ratio = 0.56) {
  const width = canvas.width ?? FALLBACK_CANVAS.width;
  const height = canvas.height ?? FALLBACK_CANVAS.height;
  const size = Math.round(Math.min(width, height) * ratio);
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    w: size,
    h: size,
  };
}

/**
 * Count outer radial peaks — a classic 5-point star has 5.
 *
 * @param {Array<[number, number]> | undefined} points
 * @returns {number}
 */
export function starTipCount(points) {
  if (!Array.isArray(points) || points.length < 10) return 0;
  let pts = points
    .map((p) => [Number(p[0]), Number(p[1])])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 10) return 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 3) pts = pts.slice(0, -1);
  const n = pts.length;
  if (n < 8) return 0;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n;
  const cy = pts.reduce((s, p) => s + p[1], 0) / n;
  const rs = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
  let tips = 0;
  for (let i = 0; i < n; i += 1) {
    const prev = rs[(i + n - 1) % n];
    const cur = rs[i];
    const next = rs[(i + 1) % n];
    if (cur > prev && cur >= next) tips += 1;
  }
  return tips;
}

function isClosedPolyline(shape) {
  const pts = Array.isArray(shape?.points) ? shape.points : [];
  if (pts.length < 8) return false;
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (!a || !b) return false;
  return Math.hypot(Number(a[0]) - Number(b[0]), Number(a[1]) - Number(b[1])) < 8;
}

/**
 * Ellipse + eyes + mouth-arc ops for constructed smileys (not Unicode glyphs).
 *
 * @param {string} variant smiley | wink | sad
 * @param {{ width?: number, height?: number, bounds?: { x: number, y: number, w?: number, width?: number, h?: number, height?: number } }} [canvas]
 * @param {string} [fill]
 * @returns {Array<{ name: string, args: Record<string, unknown> }>}
 */
export function faceGlyphPlan(variant, canvas = FALLBACK_CANVAS, fill = '#ffd000') {
  const width = canvas.width ?? FALLBACK_CANVAS.width;
  const height = canvas.height ?? FALLBACK_CANVAS.height;
  const bounds = canvas.bounds || squareDrawBounds({ width, height }, 0.52);
  const x = Number(bounds.x);
  const y = Number(bounds.y);
  const w = Number(bounds.w ?? bounds.width);
  const h = Number(bounds.h ?? bounds.height);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const v = variant === 'wink' || variant === 'sad' ? variant : 'smiley';
  const faceFill = typeof fill === 'string' && fill.trim() ? fill.trim() : '#ffd000';
  const ops = [
    {
      name: 'add_shape',
      args: {
        type: 'ellipse',
        x,
        y,
        width: w,
        height: h,
        fill: faceFill,
        stroke: '#111111',
        strokeWidth: 5,
      },
    },
  ];
  const eyeW = Math.max(16, w * 0.11);
  const eyeH = Math.max(20, h * 0.14);
  const eyeY = y + h * 0.28;
  const leftX = x + w * 0.28 - eyeW / 2;
  const rightX = x + w * 0.72 - eyeW / 2;
  ops.push({
    name: 'add_shape',
    args: {
      type: 'ellipse',
      x: leftX,
      y: eyeY,
      width: eyeW,
      height: eyeH,
      fill: '#111111',
    },
  });
  if (v === 'wink') {
    const wy = eyeY + eyeH * 0.45;
    ops.push({
      name: 'add_shape',
      args: {
        type: 'line',
        x: rightX,
        y: wy,
        x2: rightX + eyeW,
        y2: wy,
        stroke: '#111111',
        strokeWidth: 6,
      },
    });
  } else {
    ops.push({
      name: 'add_shape',
      args: {
        type: 'ellipse',
        x: rightX,
        y: eyeY,
        width: eyeW,
        height: eyeH,
        fill: '#111111',
      },
    });
  }
  const mouthW = w * 0.46;
  const mouthH = h * 0.28;
  const mouthX = cx - mouthW / 2;
  const mouthY = v === 'sad' ? cy + h * 0.02 : cy + h * 0.08;
  ops.push({
    name: 'add_curve',
    args: {
      kind: 'arc',
      bounds: { x: mouthX, y: mouthY, w: mouthW, h: mouthH },
      phase: v === 'sad' ? Math.PI * 1.2 : Math.PI * 0.2,
      cycles: v === 'sad' ? 0.6 : 0.65,
      stroke: '#111111',
      strokeWidth: 8,
      samples: 32,
    },
  });
  return ops;
}

/**
 * Named recipes the harness can complete even if Gemma emits zero tools.
 *
 * @param {string} text
 * @param {{ width?: number, height?: number }} [canvas]
 */
export function parseNamedDrawIntent(text, _canvas = FALLBACK_CANVAS) {
  const source = String(text || '').trim();
  if (!source) return emptyRecipe();
  const colors = extractStripeColors(source);
  const color = colors[0];

  if (WINK_RE.test(source)) {
    return {
      simplified: true,
      id: 'wink',
      kind: 'face:wink',
      family: 'face',
      variant: 'wink',
      stroke: '#111111',
      fill: color || '#ffd000',
      sides: null,
    };
  }
  if (SAD_FACE_RE.test(source)) {
    return {
      simplified: true,
      id: 'sad',
      kind: 'face:sad',
      family: 'face',
      variant: 'sad',
      stroke: '#111111',
      fill: color || '#93c5fd',
      sides: null,
    };
  }
  if (SMILEY_RE.test(source)) {
    return {
      simplified: true,
      id: 'smiley',
      kind: 'face:smiley',
      family: 'face',
      variant: 'smiley',
      stroke: '#111111',
      fill: color || '#ffd000',
      sides: null,
    };
  }
  if (STAR_RE.test(source)) {
    return {
      simplified: true,
      id: 'star',
      kind: 'star',
      family: 'curve',
      variant: 'star',
      stroke: color || '#e11d48',
      fill: null,
      sides: 5,
    };
  }
  if (HEART_RE.test(source)) {
    return {
      simplified: true,
      id: 'heart',
      kind: 'heart',
      family: 'curve',
      variant: 'heart',
      stroke: color || '#e11d48',
      fill: null,
      sides: null,
    };
  }
  if (SPIRAL_RE.test(source)) {
    return {
      simplified: true,
      id: 'spiral',
      kind: 'spiral',
      family: 'curve',
      variant: 'spiral',
      stroke: color || '#7c3aed',
      fill: null,
      sides: null,
    };
  }
  return emptyRecipe();
}

/**
 * @param {ReturnType<typeof parseNamedDrawIntent>} plan
 * @param {{ width?: number, height?: number }} [canvas]
 */
export function formatNamedDrawInstructions(plan, canvas = FALLBACK_CANVAS) {
  const bounds = squareDrawBounds(canvas);
  const b = `bounds={x:${bounds.x},y:${bounds.y},w:${bounds.w},h:${bounds.h}}`;
  if (plan?.family === 'face') {
    return [
      'Use tools now. Do not only describe. Draw this face with tools (circle, eyes, mouth).',
      `1) add_curve kind=${plan.variant} ${b} fill=${plan.fill || '#ffd000'}`,
      'After the tools run, reply with one short sentence naming only what is actually on the canvas.',
    ].join('\n');
  }
  const extra = plan?.id === 'star' ? ' sides=5' : plan?.id === 'spiral' ? ' cycles=3' : '';
  return [
    'Use tools now. Do not only describe.',
    `1) add_curve kind=${plan?.id || 'star'} ${b} samples=64 stroke=${plan?.stroke || '#e11d48'}${extra}`,
    'After the tools run, reply with one short sentence naming only what is actually on the canvas.',
  ].join('\n');
}

/**
 * @param {(name: string, args: Record<string, unknown>) => unknown | Promise<unknown>} execute
 * @param {ReturnType<typeof parseNamedDrawIntent>} plan
 * @param {{ width?: number, height?: number }} [canvas]
 */
export async function fulfillNamedDrawIntent(execute, plan, canvas = FALLBACK_CANVAS) {
  if (typeof execute !== 'function' || !plan?.simplified) {
    return { ok: false, added: 0 };
  }
  if (plan.family === 'face') {
    const ops = faceGlyphPlan(plan.variant, canvas, plan.fill);
    let added = 0;
    for (const op of ops) {
      const res = await execute(op.name, op.args);
      if (res && res.ok !== false && !res.error) added += 1;
    }
    return { ok: true, added };
  }
  const bounds = squareDrawBounds(canvas);
  await execute('add_curve', {
    kind: plan.id,
    bounds,
    samples: 64,
    stroke: plan.stroke || '#e11d48',
    strokeWidth: 3,
    sides: plan.sides || undefined,
    cycles: plan.id === 'spiral' ? 3 : undefined,
  });
  return { ok: true, added: 1 };
}

/**
 * True when assistant text claims a draw succeeded.
 *
 * @param {string} text
 */
export function looksLikeDrawSuccessClaim(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (SUCCESS_CLAIM_NEG_RE.test(t)) return false;
  return SUCCESS_CLAIM_RE.test(t) || /\bdrawn a\b/i.test(t);
}

/**
 * Per-turn intent. Never carries bands/plots from a previous user message.
 *
 * @param {string} text
 * @param {{ width?: number, height?: number }} [canvas]
 */
export function parseDrawTurnIntent(text, canvas = FALLBACK_CANVAS) {
  const raw = String(text || '').trim();
  const wantsClear = wantsClearCanvas(raw);
  const math = parseMathPlotIntent(raw);
  const stacked = math.simplified
    ? { ...emptyStacked(), text: raw }
    : normalizeDrawUserIntent(raw, canvas);
  const recipe =
    math.simplified || stacked.simplified ? emptyRecipe() : parseNamedDrawIntent(raw, canvas);
  let modelText = raw;
  if (stacked.simplified) modelText = stacked.text;
  else if (math.simplified) modelText = formatMathPlotInstructions(math, canvas);
  else if (recipe.simplified) modelText = formatNamedDrawInstructions(recipe, canvas);
  return {
    raw,
    wantsClear,
    stacked,
    math,
    recipe,
    modelText,
    kind: stacked.simplified
      ? stacked.kind
      : math.simplified
        ? math.kind
        : recipe.simplified
          ? recipe.kind
          : null,
    clearOnly: wantsClear && isClearOnlyRequest(raw),
  };
}

function lineEndpoints(shape) {
  const pts = Array.isArray(shape?.points) ? shape.points : [];
  const n = Number(shape?.pointCount ?? pts.length ?? 0);
  const last = pts[pts.length - 1];
  return {
    n,
    x1: shape?.x1 ?? pts[0]?.[0],
    y1: shape?.y1 ?? pts[0]?.[1],
    x2: shape?.x2 ?? last?.[0],
    y2: shape?.y2 ?? last?.[1],
  };
}

/**
 * Inspect live shapes. Source of truth for assistant text and tests.
 *
 * @param {unknown} shapes
 */
export function inspectDrawShapes(shapes) {
  const list = Array.isArray(shapes) ? shapes : [];
  const rects = list.filter((s) => s?.type === 'rectangle');
  const fills = rects.map((s) => fillKind(s.fill));
  const looksLikeFlag =
    rects.length >= 3 && ['yellow', 'green', 'red'].every((k) => fills.includes(k));
  const distinctY = new Set(rects.map((s) => Math.round(Number(s.y) / 4)));
  const looksLikeStackedBands = rects.length >= 2 && distinctY.size >= 2;

  let hasAxisX = false;
  let hasAxisY = false;
  let curveCount = 0;
  let looksLikeStar = false;
  let looksLikeHeart = false;
  for (const s of list) {
    if (s?.type !== 'line' && s?.type !== 'freehand') continue;
    const { n, x1, y1, x2, y2 } = lineEndpoints(s);
    const pts = Array.isArray(s?.points) ? s.points : [];
    const tips = starTipCount(pts);
    if (tips >= 4 && tips <= 8) looksLikeStar = true;
    if (n >= 8) {
      curveCount += 1;
      if (isClosedPolyline(s) && n >= 24 && tips !== 5) looksLikeHeart = true;
      continue;
    }
    if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
    const dx = Math.abs(Number(x2) - Number(x1));
    const dy = Math.abs(Number(y2) - Number(y1));
    if (dx > 80 && dy < 28) hasAxisX = true;
    if (dy > 80 && dx < 28) hasAxisY = true;
  }

  const ellipses = list.filter((s) => s?.type === 'ellipse');
  const looksLikeFace = ellipses.length >= 1 && (ellipses.length >= 2 || curveCount >= 1);

  return {
    count: list.length,
    rects,
    fills,
    looksLikeFlag,
    looksLikeStackedBands,
    looksLikeStar,
    looksLikeHeart,
    looksLikeFace,
    ellipseCount: ellipses.length,
    hasAxes: hasAxisX && hasAxisY,
    hasAxisX,
    hasAxisY,
    curveCount,
    empty: list.length === 0,
  };
}

function joinAnd(bits) {
  if (bits.length <= 1) return bits[0] || '';
  if (bits.length === 2) return `${bits[0]} and ${bits[1]}`;
  return `${bits.slice(0, -1).join(', ')}, and ${bits[bits.length - 1]}`;
}

function describeShapesBrief(snap) {
  if (!snap || snap.empty) return 'The canvas is empty.';
  const bits = [];
  if (snap.hasAxes) bits.push('x and y axes');
  if (snap.curveCount > 0) {
    bits.push(`${snap.curveCount} curve${snap.curveCount === 1 ? '' : 's'}`);
  }
  if (snap.rects.length > 0) {
    bits.push(`${snap.rects.length} rectangle${snap.rects.length === 1 ? '' : 's'}`);
  }
  if (bits.length) return `Canvas has ${joinAnd(bits)}.`;
  return `Canvas has ${snap.count} shape${snap.count === 1 ? '' : 's'}.`;
}

/**
 * True when the model sentence claims geometry the canvas does not have.
 *
 * @param {string} modelReply
 * @param {ReturnType<typeof inspectDrawShapes>} snap
 */
export function assistantClaimConflictsWithCanvas(modelReply, snap) {
  const text = String(modelReply || '');
  if (!text.trim()) return false;
  const view = snap || inspectDrawShapes([]);
  if (view.empty && looksLikeDrawSuccessClaim(text)) return true;
  if (/\b(cleared|empty canvas|canvas is empty)\b/i.test(text) && view.count > 0) return true;
  if (/\bax(?:es|is)\b/i.test(text) && !view.hasAxes) return true;
  if (
    /\b(sine|sinus|cosine|tangent|hyperbola|parabola|wave)\b/i.test(text) &&
    view.curveCount < 1
  ) {
    return true;
  }
  if (/\b(flag|tricolou?r|stacked bands?)\b/i.test(text) && view.rects.length < 2) return true;
  if (/\bstars?\b/i.test(text) && !view.looksLikeStar) return true;
  if (/\b(smiley|smile face|wink|sad face)\b/i.test(text) && !view.looksLikeFace) return true;
  if (/\bhearts?\b/i.test(text) && !view.looksLikeHeart && view.curveCount < 1) return true;
  return false;
}

/**
 * Harness-authored visible reply from live shapes. Never echo a success claim
 * the canvas cannot support.
 *
 * @param {unknown} shapes
 * @param {{ wantsClear?: boolean, math?: { simplified?: boolean, plots?: string[] }, stacked?: { simplified?: boolean } }} [intent]
 * @param {string} [modelReply]
 * @returns {string}
 */
export function assistantTextFromCanvas(shapes, intent = {}, modelReply = '', turn = {}) {
  const snap = inspectDrawShapes(shapes);
  const claimed = String(modelReply || '').trim();
  const askedToDraw = Boolean(
    intent.math?.simplified || intent.stacked?.simplified || intent.recipe?.simplified,
  );
  const addedCount = turn.addedCount;
  const unchanged = addedCount === 0;

  if (snap.empty) {
    if (intent.wantsClear && !askedToDraw) {
      return 'The canvas is cleared.';
    }
    if (
      askedToDraw ||
      looksLikeDrawSuccessClaim(claimed) ||
      assistantClaimConflictsWithCanvas(claimed, snap)
    ) {
      return 'Nothing was drawn on the canvas.';
    }
    return claimed || 'The canvas is empty.';
  }

  if (unchanged && looksLikeDrawSuccessClaim(claimed)) {
    return `${describeShapesBrief(snap)} Nothing new was drawn.`;
  }

  if (intent.math?.simplified) {
    if (snap.looksLikeFlag && !snap.hasAxes && snap.curveCount === 0) {
      return 'The previous stacked bands are still on the canvas; axes and curves were not drawn.';
    }
    const bits = [];
    if (snap.hasAxes) bits.push('x and y axes');
    const plotNames = Array.isArray(intent.math.plots) ? intent.math.plots : [];
    if (snap.curveCount > 0) {
      if (plotNames.length && snap.curveCount >= plotNames.length) bits.push(plotNames.join(', '));
      else bits.push(`${snap.curveCount} curve${snap.curveCount === 1 ? '' : 's'}`);
    }
    if (!bits.length) {
      return `Canvas has ${snap.count} shape${snap.count === 1 ? '' : 's'}; the requested plot was not drawn.`;
    }
    return `Drew ${joinAnd(bits)}.`;
  }

  if (intent.stacked?.simplified) {
    if (snap.rects.length === 0) return 'No rectangles were added to the canvas.';
    return `Drew ${snap.rects.length} stacked band${snap.rects.length === 1 ? '' : 's'}.`;
  }

  if (intent.recipe?.simplified) {
    if (intent.recipe.id === 'star' && snap.looksLikeStar) return 'Drew a five-pointed star.';
    if (intent.recipe.family === 'face' && snap.looksLikeFace) {
      if (intent.recipe.variant === 'wink') return 'Drew a winking face.';
      if (intent.recipe.variant === 'sad') return 'Drew a sad face.';
      return 'Drew a smiley face.';
    }
    if (intent.recipe.id === 'heart' && (snap.looksLikeHeart || snap.curveCount >= 1)) {
      return 'Drew a heart.';
    }
    if (intent.recipe.id === 'spiral' && snap.curveCount >= 1) return 'Drew a spiral.';
    return describeShapesBrief(snap);
  }

  if (assistantClaimConflictsWithCanvas(claimed, snap)) return describeShapesBrief(snap);
  if (intent.wantsClear && snap.looksLikeFlag && !intent.stacked?.simplified) {
    return 'The previous stacked bands are still on the canvas; the canvas was not cleared.';
  }
  return claimed || describeShapesBrief(snap);
}

/**
 * @param {(name: string, args: Record<string, unknown>) => unknown | Promise<unknown>} execute
 * @param {{ simplified?: boolean, wantsAxes?: boolean, plots?: string[] }} plan
 * @param {{ width?: number, height?: number }} [canvas]
 */
export async function fulfillMathPlotIntent(execute, plan, canvas = FALLBACK_CANVAS) {
  if (typeof execute !== 'function' || !plan?.simplified) {
    return { ok: false, added: 0 };
  }
  const width = canvas.width ?? FALLBACK_CANVAS.width;
  const height = canvas.height ?? FALLBACK_CANVAS.height;
  const cx = width / 2;
  const cy = height / 2;
  const margin = 48;
  const bounds = { x: margin, y: margin, w: width - margin * 2, h: height - margin * 2 };
  const plots = Array.isArray(plan.plots) ? plan.plots : [];
  let added = 0;

  const existing = await execute('list_shapes', {});
  const snap = inspectDrawShapes(existing);
  const list = Array.isArray(existing) ? existing : [];

  if (plan.wantsAxes !== false && !snap.hasAxes) {
    await execute('add_shape', {
      type: 'line',
      x: margin,
      y: cy,
      x2: width - margin,
      y2: cy,
      stroke: MATH_PLOT_STROKES.axis,
      strokeWidth: 2,
      arrowEnd: true,
    });
    await execute('add_shape', {
      type: 'line',
      x: cx,
      y: height - margin,
      x2: cx,
      y2: margin,
      stroke: MATH_PLOT_STROKES.axis,
      strokeWidth: 2,
      arrowEnd: true,
    });
    added += 2;
  }

  const curveStrokeOf = (s) => String(s.color || s.stroke || '').toLowerCase();
  for (const kind of plots) {
    const stroke = MATH_PLOT_STROKES[kind] || MATH_PLOT_STROKES.sine;
    const already = list.some(
      (s) =>
        (s.type === 'line' || s.type === 'freehand') &&
        (s.pointCount ?? s.points?.length ?? 0) >= 8 &&
        curveStrokeOf(s) === stroke.toLowerCase(),
    );
    if (already) continue;
    await execute('add_curve', {
      kind,
      bounds,
      samples: 64,
      stroke,
      cycles: kind === 'tangent' ? 1 : 2,
    });
    added += 1;
    if (kind === 'hyperbola') {
      await execute('add_curve', {
        kind,
        bounds,
        samples: 64,
        stroke,
        phase: Math.PI,
        cycles: 2,
      });
      added += 1;
    }
  }

  return { ok: true, added };
}

/**
 * One user turn: current-message intent only. Clear wins. Fulfill is not sticky.
 *
 * @param {object} opts
 * @param {string} opts.userText
 * @param {(name: string, args: Record<string, unknown>) => unknown | Promise<unknown>} opts.execute
 * @param {{ width?: number, height?: number }} [opts.canvas]
 * @param {(modelText: string, extras: { execute: Function, intent: object }) => Promise<string>} [opts.generateWithTools]
 * @param {(intent: object) => unknown | Promise<unknown>} [opts.onBeforeGenerate]
 */
export async function runDrawTurn({
  userText,
  execute,
  canvas = FALLBACK_CANVAS,
  generateWithTools,
  onBeforeGenerate,
} = {}) {
  if (typeof execute !== 'function') {
    throw new Error('runDrawTurn requires execute');
  }
  const intent = parseDrawTurnIntent(userText, canvas);
  if (intent.wantsClear || intent.math.replacesCanvas) {
    await execute('clear_canvas', {});
  }
  if (typeof onBeforeGenerate === 'function') {
    await onBeforeGenerate(intent);
  }

  const beforeList = await execute('list_shapes', {});
  const beforeIds = new Set(
    (Array.isArray(beforeList) ? beforeList : []).map((s) => s?.id).filter(Boolean),
  );

  let modelReply = '';
  let toolError = null;
  if (typeof generateWithTools === 'function') {
    try {
      const out = await generateWithTools(intent.modelText, { execute, intent });
      modelReply = out == null ? '' : String(out);
    } catch (err) {
      const msg = err?.message || String(err);
      if (/tools unsupported|not support tools|guardrail/i.test(msg) && !/maxRounds/i.test(msg)) {
        throw err;
      }
      toolError = msg;
      modelReply = '';
    }
  }

  if (intent.math.simplified) {
    const snap = inspectDrawShapes(await execute('list_shapes', {}));
    const stickyBands = snap.looksLikeStackedBands && !intent.stacked.simplified;
    const need = Math.min(2, Math.max(1, intent.math.plots.length));
    const mathOk = snap.hasAxes && snap.curveCount >= need;
    if (stickyBands || !mathOk) {
      if (stickyBands || intent.wantsClear || intent.math.replacesCanvas) {
        await execute('clear_canvas', {});
      }
      await fulfillMathPlotIntent(execute, intent.math, canvas);
    }
  } else if (intent.stacked.simplified && intent.stacked.bands.length) {
    await fulfillStackedBandIntent(execute, intent.stacked.bands);
  } else if (intent.recipe?.simplified) {
    const snap = inspectDrawShapes(await execute('list_shapes', {}));
    const need =
      (intent.recipe.id === 'star' && !snap.looksLikeStar) ||
      (intent.recipe.id === 'heart' && !snap.looksLikeHeart && snap.curveCount < 1) ||
      (intent.recipe.id === 'spiral' && snap.curveCount < 1) ||
      (intent.recipe.family === 'face' && !snap.looksLikeFace);
    if (need) await fulfillNamedDrawIntent(execute, intent.recipe, canvas);
  } else if (intent.clearOnly) {
    await execute('clear_canvas', {});
  }

  const rawList = await execute('list_shapes', {});
  const shapes = Array.isArray(rawList) ? rawList : [];
  const snapshot = inspectDrawShapes(shapes);
  const addedCount = shapes.filter((s) => s?.id && !beforeIds.has(s.id)).length;
  const reply = assistantTextFromCanvas(shapes, intent, modelReply, { addedCount });
  return { intent, modelReply, reply, shapes, snapshot, toolError, addedCount };
}
