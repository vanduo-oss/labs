/**
 * 2D sketch stencil catalog for AI Draw.
 *
 * Provides instant, deterministic geometric decompositions for common everyday objects
 * (vehicles, buildings, nature, animals, items) so that small in-browser models do not
 * need to invent multi-shape geometry from scratch or refuse requests.
 */

/** Fallback canvas if host does not provide dimensions. */
const DEFAULT_CANVAS = Object.freeze({ width: 1000, height: 800 });

/**
 * Helper to get centered bounding box for a stencil with customizable width/height ratios.
 *
 * @param {{ width?: number, height?: number }} canvas
 * @param {number} [widthRatio=0.6]
 * @param {number} [heightRatio=0.5]
 */
function getStencilBounds(canvas = DEFAULT_CANVAS, widthRatio = 0.6, heightRatio = 0.5) {
  const cw = canvas.width ?? DEFAULT_CANVAS.width;
  const ch = canvas.height ?? DEFAULT_CANVAS.height;
  const w = Math.round(cw * widthRatio);
  const h = Math.round(ch * heightRatio);
  const x = Math.round((cw - w) / 2);
  const y = Math.round((ch - h) / 2);
  const cx = Math.round(x + w / 2);
  const cy = Math.round(y + h / 2);
  return { x, y, w, h, cx, cy, cw, ch };
}

/**
 * Stencil definitions.
 * Each entry has:
 * - id: unique identifier
 * - name: human-readable name
 * - triggers: RegExp to match user prompt
 * - defaultColor: default primary color if user did not specify one
 * - build: (canvas, userColor) => array of { op: 'add_shape'|'add_curve', args: object }
 */
export const SKETCH_STENCILS = Object.freeze([
  // ── VEHICLES ─────────────────────────────────────────────────────────────
  {
    id: 'car',
    name: 'car',
    triggers: /\b(?:car|sedan|automobile|auto|coupe)\b/i,
    defaultColor: '#2563eb',
    build(canvas, userColor) {
      const { x, y, w, h } = getStencilBounds(canvas, 0.55, 0.35);
      const color = userColor || '#2563eb';
      const bodyH = Math.round(h * 0.45);
      const cabinH = Math.round(h * 0.45);
      const wheelR = Math.round(h * 0.28);
      const bodyY = y + cabinH;
      const cabinW = Math.round(w * 0.58);
      const cabinX = x + Math.round(w * 0.22);
      const cabinY = y + Math.round(h * 0.05);

      return [
        // Roof / Cabin
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cabinX,
            y: cabinY,
            width: cabinW,
            height: cabinH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Windshield (front window)
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cabinX + Math.round(cabinW * 0.55),
            y: cabinY + Math.round(cabinH * 0.15),
            width: Math.round(cabinW * 0.38),
            height: Math.round(cabinH * 0.7),
            fill: '#bae6fd',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Rear window
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cabinX + Math.round(cabinW * 0.08),
            y: cabinY + Math.round(cabinH * 0.15),
            width: Math.round(cabinW * 0.38),
            height: Math.round(cabinH * 0.7),
            fill: '#bae6fd',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Main lower body
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x,
            y: bodyY,
            width: w,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Headlight
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + w - Math.round(w * 0.04),
            y: bodyY + Math.round(bodyH * 0.2),
            width: Math.round(w * 0.06),
            height: Math.round(bodyH * 0.35),
            fill: '#fef08a',
            stroke: '#ca8a04',
            strokeWidth: 2,
          },
        },
        // Tail light
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x,
            y: bodyY + Math.round(bodyH * 0.2),
            width: Math.round(w * 0.03),
            height: Math.round(bodyH * 0.35),
            fill: '#ef4444',
            stroke: '#b91c1c',
            strokeWidth: 1,
          },
        },
        // Left wheel (rear)
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.14),
            y: bodyY + bodyH - Math.round(wheelR * 0.5),
            width: wheelR,
            height: wheelR,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Left hubcap
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.14) + Math.round(wheelR * 0.25),
            y: bodyY + bodyH - Math.round(wheelR * 0.5) + Math.round(wheelR * 0.25),
            width: Math.round(wheelR * 0.5),
            height: Math.round(wheelR * 0.5),
            fill: '#9ca3af',
            stroke: '#4b5563',
            strokeWidth: 2,
          },
        },
        // Right wheel (front)
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + w - Math.round(w * 0.14) - wheelR,
            y: bodyY + bodyH - Math.round(wheelR * 0.5),
            width: wheelR,
            height: wheelR,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Right hubcap
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + w - Math.round(w * 0.14) - wheelR + Math.round(wheelR * 0.25),
            y: bodyY + bodyH - Math.round(wheelR * 0.5) + Math.round(wheelR * 0.25),
            width: Math.round(wheelR * 0.5),
            height: Math.round(wheelR * 0.5),
            fill: '#9ca3af',
            stroke: '#4b5563',
            strokeWidth: 2,
          },
        },
      ];
    },
  },

  {
    id: 'truck',
    name: 'truck',
    triggers: /\b(?:truck|pickup|lorry)\b/i,
    defaultColor: '#dc2626',
    build(canvas, userColor) {
      const { x, y, w, h } = getStencilBounds(canvas, 0.6, 0.38);
      const color = userColor || '#dc2626';
      const cargoW = Math.round(w * 0.58);
      const cabW = Math.round(w * 0.38);
      const cargoH = Math.round(h * 0.65);
      const cabH = Math.round(h * 0.75);
      const wheelR = Math.round(h * 0.26);

      return [
        // Cargo bed / Container
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x,
            y: y + (h - cargoH - Math.round(wheelR * 0.3)),
            width: cargoW,
            height: cargoH,
            fill: '#64748b',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Cab
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + cargoW + Math.round(w * 0.04),
            y: y + (h - cabH - Math.round(wheelR * 0.3)),
            width: cabW,
            height: cabH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Cab Window
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + cargoW + Math.round(cabW * 0.3),
            y: y + (h - cabH - Math.round(wheelR * 0.3)) + Math.round(cabH * 0.12),
            width: Math.round(cabW * 0.6),
            height: Math.round(cabH * 0.4),
            fill: '#bae6fd',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Rear wheel 1
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.08),
            y: y + h - wheelR,
            width: wheelR,
            height: wheelR,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Rear wheel 2
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.26),
            y: y + h - wheelR,
            width: wheelR,
            height: wheelR,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Front wheel
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + w - Math.round(w * 0.12) - wheelR,
            y: y + h - wheelR,
            width: wheelR,
            height: wheelR,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
      ];
    },
  },

  {
    id: 'bus',
    name: 'bus',
    triggers: /\b(?:bus|coach)\b/i,
    defaultColor: '#eab308',
    build(canvas, userColor) {
      const { x, y, w, h } = getStencilBounds(canvas, 0.65, 0.35);
      const color = userColor || '#eab308';
      const bodyH = Math.round(h * 0.75);
      const wheelR = Math.round(h * 0.28);
      const winW = Math.round(w * 0.12);
      const winH = Math.round(bodyH * 0.38);
      const winY = y + Math.round(bodyH * 0.15);

      const steps = [
        // Main body
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x,
            y,
            width: w,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
      ];

      // 4 side windows
      for (let i = 0; i < 4; i += 1) {
        steps.push({
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + Math.round(w * 0.08) + i * Math.round(w * 0.18),
            y: winY,
            width: winW,
            height: winH,
            fill: '#bae6fd',
            stroke: '#111111',
            strokeWidth: 2,
          },
        });
      }

      // Windshield (front)
      steps.push({
        op: 'add_shape',
        args: {
          type: 'rectangle',
          x: x + Math.round(w * 0.82),
          y: winY,
          width: Math.round(w * 0.14),
          height: Math.round(bodyH * 0.55),
          fill: '#bae6fd',
          stroke: '#111111',
          strokeWidth: 2,
        },
      });

      // Wheels
      steps.push(
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.14),
            y: y + bodyH - Math.round(wheelR * 0.4),
            width: wheelR,
            height: wheelR,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + w - Math.round(w * 0.18) - wheelR,
            y: y + bodyH - Math.round(wheelR * 0.4),
            width: wheelR,
            height: wheelR,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
      );

      return steps;
    },
  },

  {
    id: 'boat',
    name: 'boat',
    triggers: /\b(?:boat|sailboat|yacht|canoe|kayak|rowboat)\b|(?<!(?:rocket|space)\s*)\bship\b/i,
    defaultColor: '#0284c7',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.55, 0.5);
      const color = userColor || '#b45309';
      const hullY = y + Math.round(h * 0.65);
      const hullH = Math.round(h * 0.3);
      const mastX = cx - 10;
      const mastTopY = y + Math.round(h * 0.05);

      return [
        // Water wave line
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: x - Math.round(w * 0.1),
            y: y + h,
            x2: x + w + Math.round(w * 0.1),
            y2: y + h,
            stroke: '#0284c7',
            strokeWidth: 4,
          },
        },
        // Boat Hull (Trapezoid / Polygon)
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(w * 0.1), hullY],
              [x + Math.round(w * 0.9), hullY],
              [x + Math.round(w * 0.75), hullY + hullH],
              [x + Math.round(w * 0.25), hullY + hullH],
              [x + Math.round(w * 0.1), hullY],
            ],
            fill: color,
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Mast
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: mastX,
            y: mastTopY,
            x2: mastX,
            y2: hullY,
            stroke: '#4b5563',
            strokeWidth: 5,
          },
        },
        // Main Sail (Triangle)
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [mastX + 4, mastTopY + Math.round(h * 0.05)],
              [x + Math.round(w * 0.8), hullY - Math.round(h * 0.05)],
              [mastX + 4, hullY - Math.round(h * 0.05)],
              [mastX + 4, mastTopY + Math.round(h * 0.05)],
            ],
            fill: '#f8fafc',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Front Jib Sail (Triangle)
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [mastX - 4, mastTopY + Math.round(h * 0.12)],
              [x + Math.round(w * 0.15), hullY - Math.round(h * 0.05)],
              [mastX - 4, hullY - Math.round(h * 0.05)],
              [mastX - 4, mastTopY + Math.round(h * 0.12)],
            ],
            fill: '#f1f5f9',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
      ];
    },
  },

  // ── BUILDINGS ────────────────────────────────────────────────────────────
  {
    id: 'house',
    name: 'house',
    triggers: /\b(?:house|home|cottage|cabin)\b/i,
    defaultColor: '#f97316',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.45, 0.55);
      const color = userColor || '#fde047';
      const roofH = Math.round(h * 0.38);
      const bodyH = Math.round(h * 0.62);
      const bodyY = y + roofH;
      const doorW = Math.round(w * 0.22);
      const doorH = Math.round(bodyH * 0.55);
      const winSize = Math.round(w * 0.22);

      return [
        // Chimney
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + Math.round(w * 0.72),
            y: y + Math.round(roofH * 0.1),
            width: Math.round(w * 0.12),
            height: Math.round(roofH * 0.7),
            fill: '#b91c1c',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // House Base Body
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x,
            y: bodyY,
            width: w,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 4,
          },
        },
        // Triangle Roof
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx, y],
              [x + w + Math.round(w * 0.06), bodyY],
              [x - Math.round(w * 0.06), bodyY],
              [cx, y],
            ],
            fill: '#dc2626',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 4,
          },
        },
        // Door
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cx - Math.round(doorW / 2),
            y: bodyY + bodyH - doorH,
            width: doorW,
            height: doorH,
            fill: '#78350f',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Door Knob
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + Math.round(doorW * 0.2),
            y: bodyY + bodyH - Math.round(doorH * 0.5),
            width: 10,
            height: 10,
            fill: '#fbbf24',
            stroke: '#111111',
            strokeWidth: 1,
          },
        },
        // Window Left
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + Math.round(w * 0.12),
            y: bodyY + Math.round(bodyH * 0.2),
            width: winSize,
            height: winSize,
            fill: '#bae6fd',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Window Left Pane divider
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: x + Math.round(w * 0.12) + Math.round(winSize / 2),
            y: bodyY + Math.round(bodyH * 0.2),
            x2: x + Math.round(w * 0.12) + Math.round(winSize / 2),
            y2: bodyY + Math.round(bodyH * 0.2) + winSize,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Window Right
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + w - Math.round(w * 0.12) - winSize,
            y: bodyY + Math.round(bodyH * 0.2),
            width: winSize,
            height: winSize,
            fill: '#bae6fd',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Window Right Pane divider
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: x + w - Math.round(w * 0.12) - Math.round(winSize / 2),
            y: bodyY + Math.round(bodyH * 0.2),
            x2: x + w - Math.round(w * 0.12) - Math.round(winSize / 2),
            y2: bodyY + Math.round(bodyH * 0.2) + winSize,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
      ];
    },
  },

  {
    id: 'castle',
    name: 'castle',
    triggers: /\b(?:castle|fortress|tower)\b/i,
    defaultColor: '#64748b',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.55, 0.55);
      const color = userColor || '#94a3b8';
      const towerW = Math.round(w * 0.22);
      const centerW = Math.round(w * 0.56);
      const centerH = Math.round(h * 0.65);
      const towerH = Math.round(h * 0.85);

      return [
        // Center Wall
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + towerW,
            y: y + h - centerH,
            width: centerW,
            height: centerH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Left Tower
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x,
            y: y + h - towerH,
            width: towerW,
            height: towerH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Left Cone Roof
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(towerW / 2), y],
              [x + towerW + 6, y + h - towerH],
              [x - 6, y + h - towerH],
              [x + Math.round(towerW / 2), y],
            ],
            fill: '#dc2626',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Right Tower
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x + w - towerW,
            y: y + h - towerH,
            width: towerW,
            height: towerH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Right Cone Roof
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + w - Math.round(towerW / 2), y],
              [x + w + 6, y + h - towerH],
              [x + w - towerW - 6, y + h - towerH],
              [x + w - Math.round(towerW / 2), y],
            ],
            fill: '#dc2626',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Arch Gate
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(centerW * 0.18),
            y: y + h - Math.round(centerH * 0.6),
            width: Math.round(centerW * 0.36),
            height: Math.round(centerH * 0.6),
            fill: '#334155',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
      ];
    },
  },

  // ── NATURE ───────────────────────────────────────────────────────────────
  {
    id: 'tree',
    name: 'tree',
    triggers: /\b(?:tree|trees|oak\s+tree|palm\s+tree)\b/i,
    defaultColor: '#16a34a',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.45, 0.65);
      const color = userColor || '#16a34a';
      const trunkW = Math.round(w * 0.2);
      const trunkH = Math.round(h * 0.45);
      const folW = Math.round(w * 0.85);
      const folH = Math.round(h * 0.65);

      return [
        // Trunk
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cx - Math.round(trunkW / 2),
            y: y + h - trunkH,
            width: trunkW,
            height: trunkH,
            fill: '#78350f',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Lower foliage
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(folW / 2),
            y: y + Math.round(h * 0.2),
            width: folW,
            height: Math.round(folH * 0.65),
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Upper foliage
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(folW * 0.4),
            y,
            width: Math.round(folW * 0.8),
            height: Math.round(folH * 0.6),
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
      ];
    },
  },

  {
    id: 'flower',
    name: 'flower',
    triggers: /\b(?:flower|tulip|daisy|rose|blossom)\b/i,
    defaultColor: '#ec4899',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.45, 0.6);
      const petalColor = userColor || '#ec4899';
      const stemH = Math.round(h * 0.55);
      const headCy = y + Math.round(h * 0.24);
      const centerR = Math.round(w * 0.2);
      const petalR = Math.round(w * 0.24);

      return [
        // Stem
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx,
            y: headCy,
            x2: cx,
            y2: y + h,
            stroke: '#16a34a',
            strokeWidth: 6,
          },
        },
        // Leaf Left
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(w * 0.35),
            y: y + h - Math.round(stemH * 0.45),
            width: Math.round(w * 0.32),
            height: Math.round(stemH * 0.2),
            fill: '#22c55e',
            stroke: '#15803d',
            strokeWidth: 2,
          },
        },
        // Leaf Right
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + Math.round(w * 0.05),
            y: y + h - Math.round(stemH * 0.35),
            width: Math.round(w * 0.32),
            height: Math.round(stemH * 0.2),
            fill: '#22c55e',
            stroke: '#15803d',
            strokeWidth: 2,
          },
        },
        // Top Petal
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(petalR / 2),
            y: headCy - petalR - Math.round(centerR * 0.3),
            width: petalR,
            height: petalR,
            fill: petalColor,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Bottom Petal
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(petalR / 2),
            y: headCy + Math.round(centerR * 0.3),
            width: petalR,
            height: petalR,
            fill: petalColor,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Left Petal
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - petalR - Math.round(centerR * 0.3),
            y: headCy - Math.round(petalR / 2),
            width: petalR,
            height: petalR,
            fill: petalColor,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Right Petal
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + Math.round(centerR * 0.3),
            y: headCy - Math.round(petalR / 2),
            width: petalR,
            height: petalR,
            fill: petalColor,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Center Disc
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(centerR / 2),
            y: headCy - Math.round(centerR / 2),
            width: centerR,
            height: centerR,
            fill: '#fbbf24',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
      ];
    },
  },

  {
    id: 'sun',
    name: 'sun',
    triggers: /\b(?:sun|sunshine|sunny)\b/i,
    defaultColor: '#eab308',
    build(canvas, userColor) {
      const { cx, cy, w, h } = getStencilBounds(canvas, 0.45, 0.45);
      const color = userColor || '#facc15';
      const radius = Math.round(Math.min(w, h) * 0.35);
      const rayLen = Math.round(radius * 1.6);

      const steps = [];
      // 8 radiating rays
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      for (const ang of angles) {
        const rad = (ang * Math.PI) / 180;
        const x1 = Math.round(cx + Math.cos(rad) * (radius * 1.15));
        const y1 = Math.round(cy + Math.sin(rad) * (radius * 1.15));
        const x2 = Math.round(cx + Math.cos(rad) * rayLen);
        const y2 = Math.round(cy + Math.sin(rad) * rayLen);
        steps.push({
          op: 'add_shape',
          args: {
            type: 'line',
            x: x1,
            y: y1,
            x2,
            y2,
            stroke: '#f59e0b',
            strokeWidth: 5,
          },
        });
      }

      // Central Sun circle
      steps.push({
        op: 'add_shape',
        args: {
          type: 'ellipse',
          x: cx - radius,
          y: cy - radius,
          width: radius * 2,
          height: radius * 2,
          fill: color,
          stroke: '#ca8a04',
          strokeWidth: 4,
        },
      });

      return steps;
    },
  },

  {
    id: 'moon',
    name: 'moon',
    triggers: /\b(?:moon|crescent|crescent moon)\b/i,
    defaultColor: '#fef08a',
    build(canvas, userColor) {
      const { x, y, w, h } = getStencilBounds(canvas, 0.4, 0.45);
      const color = userColor || '#fde047';
      const size = Math.min(w, h);

      return [
        // Main moon circle
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x,
            y,
            width: size,
            height: size,
            fill: color,
            stroke: '#ca8a04',
            strokeWidth: 3,
          },
        },
        // Inner shadow cutout ellipse to create crescent effect
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(size * 0.28),
            y: y - Math.round(size * 0.05),
            width: Math.round(size * 0.85),
            height: Math.round(size * 0.95),
            fill: '#ffffff',
            stroke: '#ca8a04',
            strokeWidth: 2,
          },
        },
      ];
    },
  },

  {
    id: 'cloud',
    name: 'cloud',
    triggers: /\b(?:cloud|clouds|cloudy)\b/i,
    defaultColor: '#e0f2fe',
    build(canvas, userColor) {
      const { x, y, w, h } = getStencilBounds(canvas, 0.55, 0.35);
      const color = userColor || '#e2e8f0';

      return [
        // Base wide ellipse
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x,
            y: y + Math.round(h * 0.3),
            width: w,
            height: Math.round(h * 0.65),
            fill: color,
            stroke: '#94a3b8',
            strokeWidth: 3,
          },
        },
        // Center high puff
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.3),
            y,
            width: Math.round(w * 0.45),
            height: Math.round(h * 0.75),
            fill: color,
            stroke: '#94a3b8',
            strokeWidth: 3,
          },
        },
        // Left puff
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.1),
            y: y + Math.round(h * 0.15),
            width: Math.round(w * 0.35),
            height: Math.round(h * 0.65),
            fill: color,
            stroke: '#94a3b8',
            strokeWidth: 3,
          },
        },
      ];
    },
  },

  {
    id: 'mountain',
    name: 'mountain',
    triggers: /\b(?:mountain|mountains|peak|peaks|volcano)\b/i,
    defaultColor: '#475569',
    build(canvas, userColor) {
      const { x, y, w, h } = getStencilBounds(canvas, 0.65, 0.45);
      const color = userColor || '#64748b';

      return [
        // Left larger mountain
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(w * 0.35), y],
              [x + Math.round(w * 0.75), y + h],
              [x, y + h],
              [x + Math.round(w * 0.35), y],
            ],
            fill: color,
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Snow cap on left mountain
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(w * 0.35), y],
              [x + Math.round(w * 0.48), y + Math.round(h * 0.3)],
              [x + Math.round(w * 0.22), y + Math.round(h * 0.3)],
              [x + Math.round(w * 0.35), y],
            ],
            fill: '#ffffff',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Right smaller mountain
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(w * 0.72), y + Math.round(h * 0.2)],
              [x + w, y + h],
              [x + Math.round(w * 0.45), y + h],
              [x + Math.round(w * 0.72), y + Math.round(h * 0.2)],
            ],
            fill: '#475569',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
      ];
    },
  },

  // ── ANIMALS ──────────────────────────────────────────────────────────────
  {
    id: 'cat',
    name: 'cat',
    triggers: /\b(?:cat|kitten|kitty|feline)\b/i,
    defaultColor: '#f97316',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.45, 0.55);
      const color = userColor || '#ea580c';
      const headR = Math.round(w * 0.48);
      const headY = y + Math.round(h * 0.12);
      const bodyW = Math.round(w * 0.65);
      const bodyH = Math.round(h * 0.5);

      return [
        // Body
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(bodyW / 2),
            y: y + Math.round(h * 0.45),
            width: bodyW,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Tail
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx + Math.round(bodyW * 0.35), y + Math.round(h * 0.75)],
              [x + w, y + Math.round(h * 0.6)],
              [x + w + 10, y + Math.round(h * 0.4)],
            ],
            color,
            strokeWidth: 8,
            smooth: true,
          },
        },
        // Left Ear
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx - Math.round(headR * 0.45), headY + Math.round(headR * 0.25)],
              [cx - Math.round(headR * 0.35), y],
              [cx - Math.round(headR * 0.05), headY + Math.round(headR * 0.05)],
            ],
            fill: color,
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Right Ear
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx + Math.round(headR * 0.05), headY + Math.round(headR * 0.05)],
              [cx + Math.round(headR * 0.35), y],
              [cx + Math.round(headR * 0.45), headY + Math.round(headR * 0.25)],
            ],
            fill: color,
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Head
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(headR / 2),
            y: headY,
            width: headR,
            height: Math.round(headR * 0.85),
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Left Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(headR * 0.25),
            y: headY + Math.round(headR * 0.3),
            width: 14,
            height: 18,
            fill: '#111111',
          },
        },
        // Right Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + Math.round(headR * 0.15),
            y: headY + Math.round(headR * 0.3),
            width: 14,
            height: 18,
            fill: '#111111',
          },
        },
        // Nose
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - 6,
            y: headY + Math.round(headR * 0.55),
            width: 12,
            height: 8,
            fill: '#fda4af',
          },
        },
        // Left Whiskers
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx - Math.round(headR * 0.1),
            y: headY + Math.round(headR * 0.55),
            x2: cx - Math.round(headR * 0.55),
            y2: headY + Math.round(headR * 0.5),
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx - Math.round(headR * 0.1),
            y: headY + Math.round(headR * 0.6),
            x2: cx - Math.round(headR * 0.55),
            y2: headY + Math.round(headR * 0.65),
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Right Whiskers
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx + Math.round(headR * 0.1),
            y: headY + Math.round(headR * 0.55),
            x2: cx + Math.round(headR * 0.55),
            y2: headY + Math.round(headR * 0.5),
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx + Math.round(headR * 0.1),
            y: headY + Math.round(headR * 0.6),
            x2: cx + Math.round(headR * 0.55),
            y2: headY + Math.round(headR * 0.65),
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
      ];
    },
  },

  {
    id: 'dog',
    name: 'dog',
    triggers: /\b(?:dog|puppy|doggy|canine|hound)\b/i,
    defaultColor: '#92400e',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.5, 0.5);
      const color = userColor || '#b45309';
      const bodyW = Math.round(w * 0.65);
      const bodyH = Math.round(h * 0.5);
      const headR = Math.round(w * 0.4);

      return [
        // Body
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.25),
            y: y + Math.round(h * 0.4),
            width: bodyW,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Tail
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: x + w - 10,
            y: y + Math.round(h * 0.55),
            x2: x + w + 20,
            y2: y + Math.round(h * 0.35),
            stroke: color,
            strokeWidth: 8,
          },
        },
        // Head
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.05),
            y: y + Math.round(h * 0.15),
            width: headR,
            height: headR,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Floppy Ear
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.25),
            y: y + Math.round(h * 0.12),
            width: Math.round(headR * 0.45),
            height: Math.round(headR * 0.8),
            fill: '#78350f',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Snout
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x,
            y: y + Math.round(h * 0.32),
            width: Math.round(headR * 0.55),
            height: Math.round(headR * 0.45),
            fill: '#d97706',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Nose
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + 4,
            y: y + Math.round(h * 0.35),
            width: 14,
            height: 12,
            fill: '#111111',
          },
        },
        // Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(headR * 0.45),
            y: y + Math.round(h * 0.24),
            width: 12,
            height: 14,
            fill: '#111111',
          },
        },
      ];
    },
  },

  {
    id: 'fish',
    name: 'fish',
    triggers: /\b(?:fish|goldfish|shark)\b/i,
    defaultColor: '#f97316',
    build(canvas, userColor) {
      const { x, y, w, h, cx, cy } = getStencilBounds(canvas, 0.55, 0.38);
      const color = userColor || '#f97316';
      const bodyW = Math.round(w * 0.7);
      const bodyH = h;

      return [
        // Body (Ellipse)
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.15),
            y,
            width: bodyW,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Tail Fin (Triangle)
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(w * 0.25), cy],
              [x, y + Math.round(h * 0.15)],
              [x, y + Math.round(h * 0.85)],
              [x + Math.round(w * 0.25), cy],
            ],
            fill: '#fb923c',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Top Fin
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx, y + 5],
              [cx + Math.round(w * 0.15), y - Math.round(h * 0.2)],
              [cx + Math.round(w * 0.25), y + 10],
            ],
            fill: '#fb923c',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Eye (White)
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.65),
            y: cy - Math.round(h * 0.2),
            width: 22,
            height: 22,
            fill: '#ffffff',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Pupil
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.68),
            y: cy - Math.round(h * 0.17),
            width: 10,
            height: 10,
            fill: '#111111',
          },
        },
      ];
    },
  },

  {
    id: 'bird',
    name: 'bird',
    triggers: /\b(?:bird|sparrow|robin|seagull)\b/i,
    defaultColor: '#0284c7',
    build(canvas, userColor) {
      const { x, y, w, h, cx, cy } = getStencilBounds(canvas, 0.45, 0.45);
      const color = userColor || '#0284c7';
      const bodyW = Math.round(w * 0.65);
      const bodyH = Math.round(h * 0.55);

      return [
        // Body
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.15),
            y: y + Math.round(h * 0.25),
            width: bodyW,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Wing
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.25),
            y: y + Math.round(h * 0.35),
            width: Math.round(bodyW * 0.6),
            height: Math.round(bodyH * 0.55),
            fill: '#0369a1',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Head
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.55),
            y: y + Math.round(h * 0.12),
            width: Math.round(w * 0.35),
            height: Math.round(w * 0.35),
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Beak (Triangle)
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(w * 0.88), y + Math.round(h * 0.22)],
              [x + w + 10, y + Math.round(h * 0.28)],
              [x + Math.round(w * 0.88), y + Math.round(h * 0.34)],
            ],
            fill: '#f59e0b',
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + Math.round(w * 0.72),
            y: y + Math.round(h * 0.22),
            width: 10,
            height: 10,
            fill: '#111111',
          },
        },
        // Tail
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: x + Math.round(w * 0.15),
            y: y + Math.round(h * 0.55),
            x2: x - 10,
            y2: y + Math.round(h * 0.7),
            stroke: color,
            strokeWidth: 6,
          },
        },
      ];
    },
  },

  {
    id: 'butterfly',
    name: 'butterfly',
    triggers: /\b(?:butterfly|moth)\b/i,
    defaultColor: '#8b5cf6',
    build(canvas, userColor) {
      const { x, y, w, h, cx, cy } = getStencilBounds(canvas, 0.55, 0.45);
      const color = userColor || '#8b5cf6';
      const wingW = Math.round(w * 0.4);
      const wingH = Math.round(h * 0.48);

      return [
        // Top Left Wing
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - wingW - 4,
            y,
            width: wingW,
            height: wingH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Top Right Wing
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + 4,
            y,
            width: wingW,
            height: wingH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Bottom Left Wing
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(wingW * 0.85) - 4,
            y: y + Math.round(h * 0.42),
            width: Math.round(wingW * 0.85),
            height: Math.round(wingH * 0.85),
            fill: '#c084fc',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Bottom Right Wing
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + 4,
            y: y + Math.round(h * 0.42),
            width: Math.round(wingW * 0.85),
            height: Math.round(wingH * 0.85),
            fill: '#c084fc',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Body
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - 10,
            y: y + Math.round(h * 0.15),
            width: 20,
            height: Math.round(h * 0.7),
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Left Antenna
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx - 4,
            y: y + Math.round(h * 0.15),
            x2: cx - 20,
            y2: y - 5,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Right Antenna
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx + 4,
            y: y + Math.round(h * 0.15),
            x2: cx + 20,
            y2: y - 5,
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
      ];
    },
  },

  // ── OBJECTS ──────────────────────────────────────────────────────────────
  {
    id: 'cup',
    name: 'cup',
    triggers: /\b(?:cup|mug|coffee cup|tea cup|coffee mug)\b/i,
    defaultColor: '#ef4444',
    build(canvas, userColor) {
      const { x, y, w, h } = getStencilBounds(canvas, 0.4, 0.45);
      const color = userColor || '#ef4444';
      const mugW = Math.round(w * 0.72);
      const mugH = Math.round(h * 0.8);
      const mugY = y + Math.round(h * 0.2);

      return [
        // Steam Line 1
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(mugW * 0.3), mugY - 5],
              [x + Math.round(mugW * 0.35), mugY - Math.round(h * 0.12)],
              [x + Math.round(mugW * 0.3), mugY - Math.round(h * 0.2)],
            ],
            color: '#94a3b8',
            strokeWidth: 3,
            smooth: true,
          },
        },
        // Steam Line 2
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [x + Math.round(mugW * 0.65), mugY - 5],
              [x + Math.round(mugW * 0.7), mugY - Math.round(h * 0.12)],
              [x + Math.round(mugW * 0.65), mugY - Math.round(h * 0.2)],
            ],
            color: '#94a3b8',
            strokeWidth: 3,
            smooth: true,
          },
        },
        // Mug Body
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x,
            y: mugY,
            width: mugW,
            height: mugH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 4,
          },
        },
        // Handle
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: x + mugW - 10,
            y: mugY + Math.round(mugH * 0.18),
            width: Math.round(w * 0.3),
            height: Math.round(mugH * 0.6),
            fill: '#ffffff',
            stroke: color,
            strokeWidth: 10,
          },
        },
      ];
    },
  },

  {
    id: 'umbrella',
    name: 'umbrella',
    triggers: /\b(?:umbrella|parasol)\b/i,
    defaultColor: '#06b6d4',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.45, 0.55);
      const color = userColor || '#06b6d4';
      const canopyH = Math.round(h * 0.45);

      return [
        // Canopy (Semicircle / Arc polygon)
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x,
            y,
            width: w,
            height: canopyH * 2,
            fill: color,
            stroke: '#111111',
            strokeWidth: 4,
          },
        },
        // Bottom mask to create dome
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: x - 10,
            y: y + canopyH,
            width: w + 20,
            height: canopyH + 10,
            fill: '#ffffff',
          },
        },
        // Canopy bottom rim line
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x,
            y: y + canopyH,
            x2: x + w,
            y2: y + canopyH,
            stroke: '#111111',
            strokeWidth: 4,
          },
        },
        // Center Shaft
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx,
            y: y + canopyH,
            x2: cx,
            y2: y + h - 20,
            stroke: '#4b5563',
            strokeWidth: 6,
          },
        },
        // Hook Handle
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx, y + h - 20],
              [cx + 15, y + h - 5],
              [cx + 30, y + h - 20],
            ],
            color: '#4b5563',
            strokeWidth: 6,
            smooth: true,
          },
        },
      ];
    },
  },

  {
    id: 'rocket',
    name: 'rocket',
    triggers: /\b(?:rocket|spaceship|shuttle)\b/i,
    defaultColor: '#e11d48',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.35, 0.65);
      const color = userColor || '#e11d48';
      const bodyW = Math.round(w * 0.55);
      const bodyH = Math.round(h * 0.55);
      const bodyX = cx - Math.round(bodyW / 2);
      const bodyY = y + Math.round(h * 0.22);

      return [
        // Left Fin
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [bodyX, bodyY + Math.round(bodyH * 0.6)],
              [x, bodyY + bodyH + 10],
              [bodyX, bodyY + bodyH],
            ],
            fill: color,
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Right Fin
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [bodyX + bodyW, bodyY + Math.round(bodyH * 0.6)],
              [x + w, bodyY + bodyH + 10],
              [bodyX + bodyW, bodyY + bodyH],
            ],
            fill: color,
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Rocket Body
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: bodyX,
            y: bodyY,
            width: bodyW,
            height: bodyH,
            fill: '#f8fafc',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Nose Cone (Triangle)
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx, y],
              [bodyX + bodyW, bodyY],
              [bodyX, bodyY],
              [cx, y],
            ],
            fill: color,
            color: '#111111',
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Porthole Window
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(bodyW * 0.25),
            y: bodyY + Math.round(bodyH * 0.22),
            width: Math.round(bodyW * 0.5),
            height: Math.round(bodyW * 0.5),
            fill: '#38bdf8',
            stroke: '#475569',
            strokeWidth: 4,
          },
        },
        // Flame Exhaust
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx - Math.round(bodyW * 0.35), bodyY + bodyH],
              [cx, y + h],
              [cx + Math.round(bodyW * 0.35), bodyY + bodyH],
            ],
            fill: '#f97316',
            color: '#eab308',
            stroke: '#eab308',
            strokeWidth: 3,
          },
        },
      ];
    },
  },

  {
    id: 'robot',
    name: 'robot',
    triggers: /\b(?:robot|bot|android)\b/i,
    defaultColor: '#64748b',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.45, 0.65);
      const color = userColor || '#94a3b8';
      const headW = Math.round(w * 0.6);
      const headH = Math.round(h * 0.28);
      const bodyW = Math.round(w * 0.85);
      const bodyH = Math.round(h * 0.42);
      const headY = y + Math.round(h * 0.1);
      const bodyY = headY + headH + Math.round(h * 0.04);

      return [
        // Antenna
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx,
            y: y,
            x2: cx,
            y2: headY,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Antenna tip
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - 8,
            y: y - 8,
            width: 16,
            height: 16,
            fill: '#ef4444',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Head
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cx - Math.round(headW / 2),
            y: headY,
            width: headW,
            height: headH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Left Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(headW * 0.32),
            y: headY + Math.round(headH * 0.25),
            width: 20,
            height: 20,
            fill: '#38bdf8',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Right Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + Math.round(headW * 0.15),
            y: headY + Math.round(headH * 0.25),
            width: 20,
            height: 20,
            fill: '#38bdf8',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Mouth
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cx - Math.round(headW * 0.28),
            y: headY + Math.round(headH * 0.65),
            width: Math.round(headW * 0.56),
            height: 12,
            fill: '#fef08a',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Body
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cx - Math.round(bodyW / 2),
            y: bodyY,
            width: bodyW,
            height: bodyH,
            fill: color,
            stroke: '#111111',
            strokeWidth: 3,
          },
        },
        // Chest Light 1
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(bodyW * 0.3),
            y: bodyY + Math.round(bodyH * 0.25),
            width: 18,
            height: 18,
            fill: '#ef4444',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Chest Light 2
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - 9,
            y: bodyY + Math.round(bodyH * 0.25),
            width: 18,
            height: 18,
            fill: '#22c55e',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Chest Light 3
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + Math.round(bodyW * 0.18),
            y: bodyY + Math.round(bodyH * 0.25),
            width: 18,
            height: 18,
            fill: '#3b82f6',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
      ];
    },
  },

  {
    id: 'snowman',
    name: 'snowman',
    triggers: /\b(?:snowman|snow man)\b/i,
    defaultColor: '#ffffff',
    build(canvas, userColor) {
      const { x, y, w, h, cx } = getStencilBounds(canvas, 0.4, 0.65);
      const color = userColor || '#ffffff';
      const b3R = Math.round(w * 0.85); // bottom
      const b2R = Math.round(w * 0.65); // middle
      const b1R = Math.round(w * 0.48); // head

      return [
        // Bottom ball
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(b3R / 2),
            y: y + h - b3R,
            width: b3R,
            height: b3R,
            fill: color,
            stroke: '#94a3b8',
            strokeWidth: 3,
          },
        },
        // Middle ball
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(b2R / 2),
            y: y + h - b3R - Math.round(b2R * 0.75),
            width: b2R,
            height: b2R,
            fill: color,
            stroke: '#94a3b8',
            strokeWidth: 3,
          },
        },
        // Head ball
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - Math.round(b1R / 2),
            y: y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.8),
            width: b1R,
            height: b1R,
            fill: color,
            stroke: '#94a3b8',
            strokeWidth: 3,
          },
        },
        // Top Hat
        {
          op: 'add_shape',
          args: {
            type: 'rectangle',
            x: cx - Math.round(b1R * 0.35),
            y: y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.8) - 35,
            width: Math.round(b1R * 0.7),
            height: 40,
            fill: '#1f2937',
            stroke: '#111111',
            strokeWidth: 2,
          },
        },
        // Hat brim
        {
          op: 'add_shape',
          args: {
            type: 'line',
            x: cx - Math.round(b1R * 0.55),
            y: y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.8) + 5,
            x2: cx + Math.round(b1R * 0.55),
            y2: y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.8) + 5,
            stroke: '#111111',
            strokeWidth: 5,
          },
        },
        // Carrot Nose (Orange Triangle)
        {
          op: 'add_shape',
          args: {
            type: 'line',
            points: [
              [cx, y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.35)],
              [cx + 26, y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.3)],
              [cx, y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.25)],
            ],
            fill: '#f97316',
            color: '#ea580c',
            stroke: '#ea580c',
            strokeWidth: 2,
          },
        },
        // Left Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx - 14,
            y: y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.5),
            width: 8,
            height: 8,
            fill: '#111111',
          },
        },
        // Right Eye
        {
          op: 'add_shape',
          args: {
            type: 'ellipse',
            x: cx + 6,
            y: y + h - b3R - Math.round(b2R * 0.75) - Math.round(b1R * 0.5),
            width: 8,
            height: 8,
            fill: '#111111',
          },
        },
      ];
    },
  },
]);

const SCENE_OR_COMPLEX_PROMPT_RE =
  /\b(?:forest|woods|grove|jungle|landscape|scenery|scene|garden|city|skyline|beach|sea|ocean|space|galaxy|battle|field|meadow|park|village|town|underwater|sunset|sunrise|night\s+sky)\b/i;

/**
 * Match user text to a stencil in the catalog.
 * If the user requests a compound multi-object scene (e.g. "house with a sun", "pine forest"),
 * this returns null so the turn is routed to the LLM planner / composer.
 *
 * @param {string} text
 * @returns {{ stencil: (typeof SKETCH_STENCILS)[number], color?: string } | null}
 */
export function matchSketchStencil(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (SCENE_OR_COMPLEX_PROMPT_RE.test(raw)) return null;

  const matches = [];
  for (const stencil of SKETCH_STENCILS) {
    if (stencil.triggers.test(raw)) {
      matches.push(stencil);
    }
  }

  // If exactly 1 stencil is mentioned, use the deterministic stencil decomposition.
  // If multiple distinct objects are mentioned, route to LLM planner.
  if (matches.length === 1) {
    return { stencil: matches[0] };
  }
  return null;
}
