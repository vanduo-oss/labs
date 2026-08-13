import { test, expect, type Page } from '@playwright/test';
import os from 'node:os';

/**
 * Real Gemma tool-calling dogfood for simple drawing *requests*.
 *
 * Runs when:
 *   - `RUN_AI_DRAW_INFERENCE=1`, or
 *   - macOS arm64 (M-series) and not CI
 *
 *   pnpm test:local
 *   RUN_AI_DRAW_INFERENCE=1 pnpm test:local
 *   AI_DRAW_MODEL=gemma-4-E4B-it-web pnpm test:local
 *   AI_DRAW_HEADED=1 pnpm test:local
 *
 * Prefers the Vite `/models/<id>/` mirror from `pnpm models:fetch`.
 * Linux CI (`pnpm test`) ignores this folder.
 */

const HARNESS = '/tests/fixtures/ai-draw-harness.html';
const MODEL_ID = process.env.AI_DRAW_MODEL || 'gemma-4-E2B-it-web';

declare global {
  interface Window {
    __vdlAiDrawReady?: boolean;
    __vdlAiDrawLoad: (modelId?: string) => Promise<unknown>;
    __vdlAiDrawPrompt: (text: string) => Promise<{
      userText: string;
      modelText: string;
      simplified: boolean;
      kind: string | null;
      reply: string;
      modelReply?: string;
      toolError?: string | null;
      shapes: Array<{
        type?: string;
        y?: number;
        fill?: string;
        pointCount?: number;
        points?: Array<[number, number]>;
      }>;
      snapshot?: {
        looksLikeFlag?: boolean;
        looksLikeStar?: boolean;
        looksLikeFace?: boolean;
        hasAxes?: boolean;
        curveCount?: number;
        empty?: boolean;
      };
      svg: string;
    }>;
    __vdlAiDrawClear: () => Promise<unknown>;
    __vdlAiDraw?: { status: string };
  }
}

function shouldRunAiDrawInference(): boolean {
  if (process.env.CI && process.env.RUN_AI_DRAW_INFERENCE !== '1') return false;
  if (process.env.RUN_AI_DRAW_INFERENCE === '1') return true;
  return process.platform === 'darwin' && process.arch === 'arm64';
}

const RUN = shouldRunAiDrawInference();

/** Shared headed/headless page so Gemma is loaded once for the suite. */
let sharedPage: Page | undefined;

test.describe.configure({ mode: 'serial' });

test.describe('AI Draw local inference (simple requests)', () => {
  test.skip(
    !RUN,
    `Skipped (platform=${process.platform} arch=${process.arch} cpus=${os.cpus()[0]?.model || '?'}). Set RUN_AI_DRAW_INFERENCE=1 on a WebGPU Mac, or run pnpm test:local on darwin/arm64.`,
  );

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(45 * 60 * 1000);
    const page = await browser.newPage();
    page.on('console', (msg) => console.log(`[browser:${msg.type()}]`, msg.text()));
    page.on('pageerror', (err) => console.error('[browser:error]', err));
    await page.goto(HARNESS, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__vdlAiDrawReady === true, null, { timeout: 30_000 });
    const webgpu = await page.evaluate(() => Boolean(navigator.gpu));
    if (!webgpu) {
      await page.close();
      throw new Error('WebGPU required for LiteRT Gemma');
    }
    await page.evaluate(async (modelId) => {
      await window.__vdlAiDrawLoad(modelId);
    }, MODEL_ID);
    sharedPage = page;
  });

  test.afterAll(async () => {
    if (sharedPage) await sharedPage.close();
  });

  test('Gemma draws a Lithuanian flag as three stacked rectangles (no refusal)', async () => {
    const page = sharedPage;
    if (!page) throw new Error('inference page not initialized');

    const flag = await page.evaluate(async () => {
      await window.__vdlAiDrawClear();
      return window.__vdlAiDrawPrompt('paint big fat nice Lithuanian flag (yellow-green-red)');
    });

    expect(flag.simplified).toBe(true);
    expect(String(flag.reply || '')).not.toMatch(/cannot draw specific national flags/i);
    expect(String(flag.reply || '')).not.toMatch(/i can help you draw shapes, but i cannot/i);
    expect(
      flag.shapes.length,
      `expected stacked bands; reply=${flag.reply} toolError=${flag.toolError}`,
    ).toBeGreaterThanOrEqual(3);

    const kinds = await classifyRectBands(page, flag.shapes);
    const rects = kinds.sort((a, b) => a.y - b.y);
    expect(rects.length).toBeGreaterThanOrEqual(3);
    expect(new Set(rects.map((s) => s.y)).size).toBeGreaterThanOrEqual(3);
    expect(rects.map((s) => s.kind).slice(0, 3)).toEqual(['yellow', 'green', 'red']);
  });

  test('Gemma draws three stacked yellow/green/red rectangles that all stay visible', async () => {
    const page = sharedPage;
    if (!page) throw new Error('inference page not initialized');

    const stacked = await page.evaluate(async () => {
      await window.__vdlAiDrawClear();
      return window.__vdlAiDrawPrompt(
        'ok, three fat big rectangle lines stacked: yellow on top, then green then red',
      );
    });

    expect(String(stacked.reply || '')).not.toMatch(/cannot draw/i);
    expect(stacked.shapes.length).toBeGreaterThanOrEqual(3);
    const ys = stacked.shapes.map((s: { y: number }) => s.y);
    expect(new Set(ys).size).toBeGreaterThanOrEqual(3);

    const kinds = await classifyRectBands(page, stacked.shapes);
    const rects = kinds.sort((a, b) => a.y - b.y);
    expect(rects.map((s) => s.kind).slice(0, 3)).toEqual(['yellow', 'green', 'red']);
  });

  test('multi-turn: Lithuanian flag then clear+math is not still the flag', async () => {
    const page = sharedPage;
    if (!page) throw new Error('inference page not initialized');

    const out = await page.evaluate(async () => {
      await window.__vdlAiDrawClear();
      const flag = await window.__vdlAiDrawPrompt(
        'paint big fat nice Lithuanian flag (yellow-green-red)',
      );
      const math = await window.__vdlAiDrawPrompt(
        'clear canvas - draw x y axis and sin, cosin, tan and hyperbola on them - as in maths',
      );
      return { flag, math };
    });

    const flagKinds = await classifyRectBands(page, out.flag.shapes);
    const flagRects = flagKinds.sort((a, b) => a.y - b.y);
    expect(flagRects.map((s) => s.kind).slice(0, 3)).toEqual(['yellow', 'green', 'red']);

    expect(out.math.snapshot?.looksLikeFlag, `still a flag; reply=${out.math.reply}`).toBe(false);
    expect(
      out.math.shapes.filter((s) => s.type === 'rectangle').length,
      'flag rectangles must be gone',
    ).toBe(0);
    expect(out.math.snapshot?.hasAxes, `missing axes; reply=${out.math.reply}`).toBe(true);
    expect(out.math.snapshot?.curveCount ?? 0).toBeGreaterThanOrEqual(2);
    expect(String(out.math.reply || '')).not.toMatch(/still on the canvas/i);
  });

  test('Gemma or harness draws a five-pointed star and chat matches the canvas', async () => {
    const page = sharedPage;
    if (!page) throw new Error('inference page not initialized');

    const star = await page.evaluate(async () => {
      await window.__vdlAiDrawClear();
      return window.__vdlAiDrawPrompt('draw a five pointed star');
    });

    expect(star.kind).toBe('star');
    expect(star.snapshot?.empty, `empty canvas; reply=${star.reply}`).toBe(false);
    expect(star.snapshot?.looksLikeStar || (star.snapshot?.curveCount ?? 0) >= 1).toBe(true);
    expect(
      star.shapes.some((s) => {
        const n = Number(s.pointCount || s.points?.length || 0);
        return (s.type === 'line' || s.type === 'freehand') && n >= 10;
      }),
      `expected a star polyline; reply=${star.reply} shapes=${JSON.stringify(star.shapes)}`,
    ).toBe(true);
    expect(String(star.reply || '')).toMatch(/star/i);
    expect(String(star.reply || '')).not.toMatch(/have drawn a five-pointed star/i);
    if (star.snapshot?.empty) {
      expect(String(star.reply || '')).not.toMatch(/i (have )?drew|have drawn/i);
    }
  });
});

async function classifyRectBands(
  page: import('@playwright/test').Page,
  shapes: Array<{ type?: string; y?: number; fill?: string }>,
) {
  return page.evaluate((list) => {
    const ctx = document.createElement('canvas').getContext('2d');
    const classify = (fill: string | undefined) => {
      if (!fill || !ctx) return 'other';
      ctx.fillStyle = '#000';
      ctx.fillStyle = String(fill);
      const css = ctx.fillStyle;
      let r = 0;
      let g = 0;
      let b = 0;
      if (css.startsWith('#')) {
        let h = css.slice(1);
        if (h.length === 3)
          h = h
            .split('')
            .map((c) => c + c)
            .join('');
        const n = parseInt(h, 16);
        r = (n >> 16) & 255;
        g = (n >> 8) & 255;
        b = n & 255;
      } else {
        const m = css.match(/\d+/g) || [];
        r = Number(m[0] || 0);
        g = Number(m[1] || 0);
        b = Number(m[2] || 0);
      }
      if (r > 160 && g > 120 && b < 140) return 'yellow';
      if (g > r + 8 && g >= b) return 'green';
      if (r > 140 && r > g + 20 && r > b) return 'red';
      return 'other';
    };
    return list
      .filter((s) => s.type === 'rectangle')
      .map((s) => ({ y: s.y, fill: s.fill, kind: classify(s.fill) }));
  }, shapes);
}
