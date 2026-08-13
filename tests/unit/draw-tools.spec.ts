import { test, expect } from '@playwright/test';

const HARNESS = '/tests/fixtures/neptune-harness.html';

test.describe('AI Draw tool executor unit tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
  });

  test('createDrawToolExecutor executes add_shape, update_shape, remove_shape, list_shapes, clear_canvas, get_canvas with VdDrawCore', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, buildDrawChatContext } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });

      const execute = createDrawToolExecutor({ getEditor: () => editor });

      // 1. Add green rectangle
      const addRes = await execute('add_shape', {
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 150,
        height: 80,
        fill: '#00ff00',
        stroke: '#008000',
      });

      // 2. Add red circle (ellipse)
      const addCircleRes = await execute('add_shape', {
        type: 'ellipse',
        x: 250,
        y: 200,
        width: 100,
        height: 100,
        fill: '#ff0000',
      });

      // 3. List shapes
      const listRes = await execute('list_shapes', {});

      // 4. Update rectangle
      const updateRes = await execute('update_shape', {
        shapeId: addRes.shapeId,
        width: 200,
        fill: '#009900',
      });

      // 5. Context shape count
      const ctx = buildDrawChatContext({
        editor,
        canvasWidth: 1000,
        canvasHeight: 800,
        selectedTool: 'draw',
        selectedColor: '#000000',
      });

      // 6. Get canvas
      const canvasRes = await execute('get_canvas', {});

      // 7. Remove circle
      const removeRes = await execute('remove_shape', { shapeId: addCircleRes.shapeId });

      // 8. Clear canvas
      const clearRes = await execute('clear_canvas', {});

      editor.destroy();
      document.body.removeChild(container);

      return {
        addRes,
        addCircleRes,
        listRes,
        updateRes,
        ctxShapeCount: ctx.canvas.shapeCount,
        canvasRes,
        removeRes,
        clearRes,
        curveRecipes: ctx.productFacts.curveRecipes,
      };
    });

    expect(res.addRes.ok).toBe(true);
    expect(res.addRes.type).toBe('rectangle');
    expect(res.addCircleRes.ok).toBe(true);
    expect(res.addCircleRes.type).toBe('ellipse');
    expect(res.listRes).toHaveLength(2);
    expect(res.updateRes.ok).toBe(true);
    expect(res.ctxShapeCount).toBe(2);
    expect(res.canvasRes.shapeCount).toBe(2);
    expect(res.removeRes.ok).toBe(true);
    expect(res.clearRes.ok).toBe(true);
    expect(res.clearRes.removedCount).toBe(1);
    expect(res.curveRecipes).toContain('sine');
  });

  test('createDrawToolExecutor resolves editor via Vue ref wrapper (getInstance)', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, buildDrawChatContext } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const coreInstance = new VdDrawCore({ element: container });

      // Mock Vue component ref exposing getInstance()
      const vueRefWrapper = {
        getInstance: () => coreInstance,
        toSVG: () => coreInstance.toSVG(),
      };

      const execute = createDrawToolExecutor({ getEditor: () => vueRefWrapper });

      const addRes = await execute('add_shape', {
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        fill: 'blue',
      });

      const ctx = buildDrawChatContext({
        editor: vueRefWrapper,
        canvasWidth: 1000,
        canvasHeight: 800,
        selectedTool: 'draw',
        selectedColor: '#000000',
      });

      coreInstance.destroy();
      document.body.removeChild(container);

      return { addRes, shapeCount: ctx.canvas.shapeCount };
    });

    expect(res.addRes.ok).toBe(true);
    expect(res.shapeCount).toBe(1);
  });

  test('add_curve sine: dense samples, centered bbox, wave-like slopes', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, sampleCurve, hasSlopeSignChanges, pointsBBox } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({ getEditor: () => editor });

      const addRes = await execute('add_curve', {
        kind: 'sine',
        bounds: { x: 100, y: 320, w: 800, h: 160 },
        samples: 64,
        stroke: 'red',
        cycles: 2,
      });

      const shape =
        typeof editor.getShape === 'function'
          ? editor.getShape(addRes.shapeId)
          : (editor.toJSON()?.shapes || []).find((s) => s.id === addRes.shapeId);
      const pts =
        shape?.points ||
        sampleCurve('sine', { x: 100, y: 320, w: 800, h: 160 }, { samples: 64, cycles: 2 });

      editor.destroy();
      document.body.removeChild(container);

      return {
        addRes,
        pointCount: shape?.points?.length,
        arrowEnd: shape?.arrowEnd,
        smooth: shape?.smooth,
        bbox: pointsBBox(shape?.points || []),
        waveLike: hasSlopeSignChanges(pts),
      };
    });

    expect(res.addRes.ok).toBe(true);
    expect(res.pointCount).toBeGreaterThanOrEqual(48);
    expect(res.addRes.sampleCount).toBeGreaterThanOrEqual(48);
    expect(res.arrowEnd).toBe(false);
    // `smooth` lands once vd3-cbun ships the field; published 1.3.1 drops unknown keys.
    if (res.smooth != null) expect(res.smooth).toBe(true);
    expect(res.waveLike).toBe(true);
    // Center of bounds {100,320,800,160} ≈ (500, 400)
    expect(res.bbox.cx).toBeGreaterThan(450);
    expect(res.bbox.cx).toBeLessThan(550);
    expect(res.bbox.cy).toBeGreaterThan(350);
    expect(res.bbox.cy).toBeLessThan(450);
  });

  test('sparse line with sine user hint returns too_few_samples coaching', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        getUserHint: () => 'draw a smooth sine wave please',
      });

      const addRes = await execute('add_shape', {
        type: 'line',
        points: [
          [100, 400],
          [300, 200],
          [500, 400],
          [700, 200],
        ],
        stroke: 'red',
      });

      editor.destroy();
      document.body.removeChild(container);
      return addRes;
    });

    expect(res.ok).toBe(true);
    expect(res.warning).toBe('too_few_samples');
    expect(res.hint).toContain('add_curve');
    expect(res.sampleCount).toBe(4);
  });

  test('unknown add_shape type is rejected (no silent rectangle)', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({ getEditor: () => editor });

      const bad = await execute('add_shape', { type: 'bezier', x: 0, y: 0 });
      const shapes =
        typeof editor.getShapes === 'function' ? editor.getShapes() : editor.toJSON()?.shapes || [];
      const count = shapes.length;

      editor.destroy();
      document.body.removeChild(container);
      return { bad, count };
    });

    expect(res.bad.error).toBe('shape.unknown_type');
    expect(res.count).toBe(0);
  });

  test('update_shape can patch points', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({ getEditor: () => editor });

      const addRes = await execute('add_shape', {
        type: 'line',
        points: [
          [0, 0],
          [10, 10],
        ],
        stroke: '#000',
      });

      const denser = [];
      for (let i = 0; i <= 32; i += 1) denser.push([i * 10, Math.sin(i / 5) * 40 + 100]);

      const upd = await execute('update_shape', {
        shapeId: addRes.shapeId,
        points: denser,
        smooth: true,
      });

      const shape =
        typeof editor.getShape === 'function'
          ? editor.getShape(addRes.shapeId)
          : (editor.toJSON()?.shapes || []).find((s) => s.id === addRes.shapeId);
      editor.destroy();
      document.body.removeChild(container);
      return { upd, pointCount: shape?.points?.length, smooth: shape?.smooth };
    });

    expect(res.upd.ok).toBe(true);
    expect(res.pointCount).toBe(33);
    if (res.smooth != null) expect(res.smooth).toBe(true);
  });

  test('eval_geometry samples Math.sin and rejects forbidden identifiers', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, evalGeometryCode } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({ getEditor: () => editor });

      const ok = await execute('eval_geometry', {
        code: `({ Math, width, height }) => {
          const pts = [];
          for (let i = 0; i <= 64; i++) {
            const t = i / 64;
            pts.push([100 + t * 800, 400 + 80 * Math.sin(t * Math.PI * 2)]);
          }
          return { type: 'line', points: pts, color: '#e11d48' };
        }`,
      });

      let fetchBlocked = null;
      try {
        evalGeometryCode(
          `({ Math }) => { fetch('/x'); return { type:'line', points:[[0,0],[1,1]] }; }`,
        );
      } catch (e) {
        fetchBlocked = e.message;
      }

      let docBlocked = null;
      try {
        evalGeometryCode(
          `({ Math }) => { document.body; return { type:'line', points:[[0,0],[1,1]] }; }`,
        );
      } catch (e) {
        docBlocked = e.message;
      }

      let ctorBlocked = null;
      try {
        evalGeometryCode(
          `({ Math }) => { Math.sin.constructor('return 1')(); return { type:'line', points:[[0,0],[1,1]] }; }`,
        );
      } catch (e) {
        ctorBlocked = e.message;
      }

      const shape =
        typeof editor.getShape === 'function'
          ? editor.getShape(ok.shapeId)
          : (editor.toJSON()?.shapes || []).find((s) => s.id === ok.shapeId);
      editor.destroy();
      document.body.removeChild(container);
      return {
        ok,
        pointCount: shape?.points?.length,
        arrowEnd: shape?.arrowEnd,
        fetchBlocked,
        docBlocked,
        ctorBlocked,
      };
    });

    expect(res.ok.ok).toBe(true);
    expect(res.pointCount).toBe(65);
    expect(res.arrowEnd).toBe(false);
    expect(res.fetchBlocked).toMatch(/forbidden/i);
    expect(res.docBlocked).toMatch(/forbidden/i);
    expect(res.ctorBlocked).toMatch(/forbidden/i);
  });

  test('normalizeDrawUserIntent rewrites Lithuanian flag to three distinct-y rectangles', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { normalizeDrawUserIntent } = await import('/src/demos/draw-tools.js');
      return normalizeDrawUserIntent('paint big fat nice Lithuanian flag (yellow-green-red)', {
        width: 1000,
        height: 800,
      });
    });

    expect(res.simplified).toBe(true);
    expect(res.kind).toBe('flag:lithuania');
    expect(res.bands).toHaveLength(3);
    expect(res.bands[0].y).toBeLessThan(res.bands[1].y);
    expect(res.bands[1].y).toBeLessThan(res.bands[2].y);
    expect(res.bands[0].fill.toLowerCase()).toBe('#fdb913');
    expect(res.bands[1].fill.toLowerCase()).toBe('#006a44');
    expect(res.bands[2].fill.toLowerCase()).toBe('#c1272d');
    expect(res.text).toMatch(/add_shape/i);
    expect(res.text).toMatch(/do not refuse/i);
    expect(res.text).toMatch(/single turn/i);
    expect(res.text).not.toMatch(/lithuan/i);
  });

  test('normalizeDrawUserIntent rewrites stacked yellow/green/red rectangles', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { normalizeDrawUserIntent } = await import('/src/demos/draw-tools.js');
      return normalizeDrawUserIntent(
        'ok, three fat big rectangle lines stacked: yellow on top, then green then red',
        { width: 1000, height: 800 },
      );
    });

    expect(res.simplified).toBe(true);
    expect(res.bands).toHaveLength(3);
    expect(res.bands.map((b) => b.y)).toEqual([...res.bands.map((b) => b.y)].sort((a, b) => a - b));
    expect(new Set(res.bands.map((b) => b.y)).size).toBe(3);
  });

  test('normalizeDrawUserIntent leaves sine / single-shape requests alone', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { normalizeDrawUserIntent } = await import('/src/demos/draw-tools.js');
      return {
        sine: normalizeDrawUserIntent('red sine in the center of canvas'),
        rect: normalizeDrawUserIntent('Draw a green rectangle at (100, 100)'),
      };
    });

    expect(res.sine.simplified).toBe(false);
    expect(res.sine.text).toBe('red sine in the center of canvas');
    expect(res.rect.simplified).toBe(false);
  });

  test('three place=center rectangles stack with distinct y and fills (only-red bug)', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      const yellow = await execute('add_shape', {
        type: 'rectangle',
        place: 'center',
        fill: 'yellow',
      });
      const green = await execute('add_shape', {
        type: 'rectangle',
        place: 'center',
        fill: 'green',
      });
      const red = await execute('add_shape', {
        type: 'rectangle',
        place: 'center',
        fill: 'red',
      });

      const list = await execute('list_shapes', {});
      const svg = typeof editor.toSVG === 'function' ? editor.toSVG() : '';

      editor.destroy();
      document.body.removeChild(container);
      return { yellow, green, red, list, svg };
    });

    expect(res.list).toHaveLength(3);
    const ys = res.list.map((s: { y: number }) => s.y);
    expect(new Set(ys).size).toBe(3);
    expect(res.yellow.y).toBeLessThan(res.green.y);
    expect(res.green.y).toBeLessThan(res.red.y);
    expect(String(res.yellow.fill)).toMatch(/yellow|#ff|#fd/i);
    expect(String(res.green.fill)).toMatch(/green|#0|#00/i);
    expect(String(res.red.fill)).toMatch(/red|#c1|#f0|#ff0000/i);
    expect(res.green.adjusted).toBe('stacked_to_avoid_overlap');
    expect(res.red.adjusted).toBe('stacked_to_avoid_overlap');
    expect(res.svg.toLowerCase()).toMatch(/yellow|#ff|#fd/);
    expect(res.svg.toLowerCase()).toMatch(/green|#006|#00/);
    expect(res.svg.toLowerCase()).toMatch(/red|#c1|#f0|#ff0000/);
  });

  test('three identical explicit bboxes are unstacked instead of covering each other', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({ getEditor: () => editor });

      const same = { type: 'rectangle', x: 100, y: 200, width: 800, height: 160 };
      await execute('add_shape', { ...same, fill: '#fdb913' });
      await execute('add_shape', { ...same, fill: '#006a44' });
      await execute('add_shape', { ...same, fill: '#c1272d' });

      const list = await execute('list_shapes', {});
      editor.destroy();
      document.body.removeChild(container);
      return list;
    });

    expect(res).toHaveLength(3);
    expect(new Set(res.map((s: { y: number }) => s.y)).size).toBe(3);
    expect(res.map((s: { fill: string }) => String(s.fill).toLowerCase())).toEqual([
      '#fdb913',
      '#006a44',
      '#c1272d',
    ]);
  });

  test('place=center preserves explicit y (does not recenter a stack offset)', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      const a = await execute('add_shape', {
        type: 'rectangle',
        place: 'center',
        y: 120,
        height: 80,
        fill: 'yellow',
      });
      const b = await execute('add_shape', {
        type: 'rectangle',
        place: 'center',
        y: 200,
        height: 80,
        fill: 'green',
      });

      editor.destroy();
      document.body.removeChild(container);
      return { a, b };
    });

    expect(res.a.y).toBe(120);
    expect(res.b.y).toBe(200);
    expect(res.a.adjusted).toBeUndefined();
  });

  test('fillColor alias and color-without-fill still paint solid rectangles', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, resolveShapeFill } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({ getEditor: () => editor });

      const a = await execute('add_shape', {
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 40,
        height: 20,
        fillColor: 'gold',
      });
      const b = await execute('add_shape', {
        type: 'rectangle',
        x: 10,
        y: 40,
        width: 40,
        height: 20,
        color: 'red',
      });

      const list = await execute('list_shapes', {});
      editor.destroy();
      document.body.removeChild(container);
      return {
        a,
        b,
        list,
        fillColor: resolveShapeFill({ type: 'rectangle', fillColor: '#abc' }),
        colorAsFill: resolveShapeFill({ type: 'rectangle', color: 'yellow' }),
      };
    });

    expect(res.a.fill).toBe('gold');
    expect(res.b.fill).toBe('red');
    expect(res.list[0].fill).toBe('gold');
    expect(res.list[1].fill).toBe('red');
    expect(res.fillColor).toBe('#abc');
    expect(res.colorAsFill).toBe('yellow');
  });

  test('fulfillStackedBandIntent adds missing yellow/green when only red was drawn', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, normalizeDrawUserIntent, fulfillStackedBandIntent } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      await execute('add_shape', { type: 'rectangle', place: 'center', fill: 'red' });
      const intent = normalizeDrawUserIntent('Lithuanian flag', { width: 1000, height: 800 });
      const fulfilled = await fulfillStackedBandIntent(execute, intent.bands);
      const list = await execute('list_shapes', {});

      editor.destroy();
      document.body.removeChild(container);
      return { fulfilled, list, bandCount: intent.bands.length };
    });

    expect(res.bandCount).toBe(3);
    expect(res.fulfilled.added).toBe(2);
    expect(res.list).toHaveLength(3);
    expect(new Set(res.list.map((s: { y: number }) => s.y)).size).toBe(3);
  });

  test('composeDrawSystemExtra says simple flags and stacking are in scope', async ({ page }) => {
    const extra = await page.evaluate(async () => {
      const { composeDrawSystemExtra } = await import('/src/demos/draw-tools.js');
      return composeDrawSystemExtra({
        editor: null,
        canvasWidth: 1000,
        canvasHeight: 800,
        selectedTool: 'draw',
        selectedColor: '#000',
      });
    });

    expect(extra).toMatch(/simple geometric flags/i);
    expect(extra).toMatch(/distinct y/i);
    expect(extra).toMatch(/never refuse/i);
    expect(extra).toMatch(/clear_canvas/i);
    expect(extra).toMatch(/hyperbola/i);
  });

  test('parseDrawTurnIntent: math follow-up is not a sticky flag and clear wins', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { parseDrawTurnIntent, wantsClearCanvas } = await import('/src/demos/draw-tools.js');
      const canvas = { width: 1000, height: 800 };
      const flag = parseDrawTurnIntent(
        'paint big fat nice Lithuanian flag (yellow-green-red)',
        canvas,
      );
      const clearOnly = parseDrawTurnIntent('clear canvas', canvas);
      const math = parseDrawTurnIntent(
        'clear canvas - draw x y axis and sin, cosin, tan and hyperbola on them - as in maths',
        canvas,
      );
      const sineOnly = parseDrawTurnIntent('red sine in the center of canvas', canvas);
      return {
        flag,
        clearOnly,
        math,
        sineOnly,
        clearMath: wantsClearCanvas(
          'clear canvas - draw x y axis and sin, cosin, tan and hyperbola on them - as in maths',
        ),
      };
    });

    expect(res.flag.stacked.simplified).toBe(true);
    expect(res.flag.stacked.bands).toHaveLength(3);
    expect(res.flag.math.simplified).toBe(false);

    expect(res.clearOnly.wantsClear).toBe(true);
    expect(res.clearOnly.clearOnly).toBe(true);
    expect(res.clearOnly.stacked.simplified).toBe(false);
    expect(res.clearOnly.stacked.bands).toHaveLength(0);
    expect(res.clearOnly.math.simplified).toBe(false);

    expect(res.clearMath).toBe(true);
    expect(res.math.wantsClear).toBe(true);
    expect(res.math.clearOnly).toBe(false);
    expect(res.math.stacked.simplified).toBe(false);
    expect(res.math.stacked.bands).toHaveLength(0);
    expect(res.math.math.simplified).toBe(true);
    expect(res.math.kind).toBe('math-plot');
    expect(res.math.math.plots).toEqual(
      expect.arrayContaining(['sine', 'cosine', 'tangent', 'hyperbola']),
    );

    expect(res.sineOnly.math.simplified).toBe(false);
    expect(res.sineOnly.stacked.simplified).toBe(false);
  });

  test('assistantTextFromCanvas does not echo a math success claim when canvas is still a flag', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { assistantTextFromCanvas, assistantClaimConflictsWithCanvas, inspectDrawShapes } =
        await import('/src/demos/draw-tools.js');
      const flagShapes = [
        { type: 'rectangle', y: 100, fill: '#fdb913' },
        { type: 'rectangle', y: 220, fill: '#006a44' },
        { type: 'rectangle', y: 340, fill: '#c1272d' },
      ];
      const lie = 'I drew x and y axes and sine, cosine, wave, tangent and a parabola.';
      const snap = inspectDrawShapes(flagShapes);
      return {
        snap,
        conflict: assistantClaimConflictsWithCanvas(lie, snap),
        text: assistantTextFromCanvas(
          flagShapes,
          {
            wantsClear: true,
            math: { simplified: true, plots: ['sine', 'cosine', 'tangent', 'hyperbola'] },
          },
          lie,
        ),
      };
    });

    expect(res.snap.looksLikeFlag).toBe(true);
    expect(res.snap.hasAxes).toBe(false);
    expect(res.snap.curveCount).toBe(0);
    expect(res.conflict).toBe(true);
    expect(res.text).not.toMatch(/drew/i);
    expect(res.text).toMatch(/still on the canvas/i);
    expect(res.text).not.toMatch(/parabola/i);
  });

  test('after a flag, clear canvas leaves zero bands (fulfill is not sticky)', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, runDrawTurn } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      const flag = await runDrawTurn({
        userText: 'Lithuanian flag',
        execute,
        canvas: { width: 1000, height: 800 },
      });
      const cleared = await runDrawTurn({
        userText: 'clear canvas',
        execute,
        canvas: { width: 1000, height: 800 },
        generateWithTools: async () => 'I cleared the canvas.',
      });

      editor.destroy();
      document.body.removeChild(container);
      return { flag, cleared };
    });

    expect(res.flag.snapshot.looksLikeFlag).toBe(true);
    expect(res.flag.shapes).toHaveLength(3);
    expect(res.cleared.snapshot.empty).toBe(true);
    expect(res.cleared.snapshot.looksLikeFlag).toBe(false);
    expect(res.cleared.shapes).toHaveLength(0);
    expect(res.cleared.intent.stacked.bands).toHaveLength(0);
    expect(res.cleared.reply).toMatch(/cleared|empty/i);
  });

  test('screenshot class: flag then model claims axes with zero tools — canvas is not the flag', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, runDrawTurn, inspectDrawShapes } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      await runDrawTurn({
        userText: 'paint big fat nice Lithuanian flag (yellow-green-red)',
        execute,
        canvas: { width: 1000, height: 800 },
      });

      const lie = 'I drew x and y axes and sine, cosine, wave, tangent and a parabola.';
      const math = await runDrawTurn({
        userText:
          'clear canvas - draw x y axis and sin, cosin, tan and hyperbola on them - as in maths',
        execute,
        canvas: { width: 1000, height: 800 },
        generateWithTools: async () => lie,
      });

      const live =
        typeof editor.getShapes === 'function' ? editor.getShapes() : editor.toJSON()?.shapes || [];
      editor.destroy();
      document.body.removeChild(container);
      return { math, liveSnap: inspectDrawShapes(live) };
    });

    expect(res.math.modelReply).toMatch(/drew/i);
    expect(res.math.snapshot.looksLikeFlag).toBe(false);
    expect(res.liveSnap.looksLikeFlag).toBe(false);
    expect(res.math.shapes.filter((s: { type?: string }) => s.type === 'rectangle')).toHaveLength(
      0,
    );
    expect(res.math.snapshot.hasAxes).toBe(true);
    expect(res.math.snapshot.curveCount).toBeGreaterThanOrEqual(2);
    expect(res.math.reply).toMatch(/axes/i);
    expect(res.math.reply).not.toMatch(/still on the canvas/i);
    expect(
      res.math.snapshot.fills.some((k: string) => k === 'yellow' || k === 'green' || k === 'red'),
    ).toBe(false);
  });

  test('add_curve tangent and hyperbola produce dense samples', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({ getEditor: () => editor });

      const tan = await execute('add_curve', { kind: 'tangent', samples: 64, stroke: '#15803d' });
      const hyp = await execute('add_curve', { kind: 'hyperbola', samples: 48, stroke: '#7c3aed' });
      const par = await execute('add_curve', { kind: 'parabola', samples: 48, stroke: '#d97706' });

      editor.destroy();
      document.body.removeChild(container);
      return { tan, hyp, par };
    });

    expect(res.tan.ok).toBe(true);
    expect(res.tan.sampleCount).toBeGreaterThanOrEqual(32);
    expect(res.hyp.ok).toBe(true);
    expect(res.hyp.sampleCount).toBeGreaterThanOrEqual(32);
    expect(res.par.ok).toBe(true);
    expect(res.par.sampleCount).toBeGreaterThanOrEqual(32);
  });

  test('math turn drops flag bands the model re-applies from chat history', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, runDrawTurn, normalizeDrawUserIntent } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });
      const bands = normalizeDrawUserIntent('Lithuanian flag', { width: 1000, height: 800 }).bands;

      const math = await runDrawTurn({
        userText:
          'clear canvas - draw x y axis and sin, cosin, tan and hyperbola on them - as in maths',
        execute,
        canvas: { width: 1000, height: 800 },
        generateWithTools: async (_modelText, extras) => {
          for (const band of bands) {
            await extras.execute('add_shape', {
              type: 'rectangle',
              x: band.x,
              y: band.y,
              width: band.width,
              height: band.height,
              fill: band.fill,
            });
          }
          return 'I drew axes and sine, cosine, tangent and a hyperbola.';
        },
      });

      editor.destroy();
      document.body.removeChild(container);
      return math;
    });

    expect(res.snapshot.looksLikeFlag).toBe(false);
    expect(res.shapes.filter((s: { type?: string }) => s.type === 'rectangle')).toHaveLength(0);
    expect(res.snapshot.hasAxes).toBe(true);
    expect(res.snapshot.curveCount).toBeGreaterThanOrEqual(2);
  });

  test('clear then draw a star does not wipe the new drawing', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, runDrawTurn } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      await runDrawTurn({
        userText: 'Lithuanian flag',
        execute,
        canvas: { width: 1000, height: 800 },
      });

      const star = await runDrawTurn({
        userText: 'clear it — draw a 5-point star',
        execute,
        canvas: { width: 1000, height: 800 },
        generateWithTools: async (_modelText, extras) => {
          await extras.execute('add_curve', {
            kind: 'star',
            place: 'center',
            sides: 5,
            stroke: '#e11d48',
          });
          return 'I drew a star.';
        },
      });

      editor.destroy();
      document.body.removeChild(container);
      return star;
    });

    expect(res.intent.clearOnly).toBe(false);
    expect(res.snapshot.looksLikeFlag).toBe(false);
    expect(res.shapes.length).toBeGreaterThanOrEqual(1);
    expect(res.snapshot.curveCount).toBeGreaterThanOrEqual(1);
  });

  test('add_curve recipe=star draws a visible five-point star', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, starTipCount, inspectDrawShapes } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      const added = await execute('add_curve', { recipe: 'star' });
      const list = await execute('list_shapes', {});
      const snap = inspectDrawShapes(list);
      const shape =
        typeof editor.getShape === 'function'
          ? editor.getShape(added.shapeId)
          : (editor.toJSON()?.shapes || []).find((s) => s.id === added.shapeId);

      editor.destroy();
      document.body.removeChild(container);
      return {
        added,
        snap,
        tips: starTipCount(shape?.points || list[0]?.points),
        pointCount: shape?.points?.length || list[0]?.pointCount,
        bbox: added.bbox,
      };
    });

    expect(res.added.ok).toBe(true);
    expect(res.added.kind).toBe('star');
    expect(res.pointCount).toBeGreaterThanOrEqual(10);
    expect(res.tips).toBeGreaterThanOrEqual(5);
    expect(res.tips).toBeLessThanOrEqual(6);
    expect(res.snap.looksLikeStar).toBe(true);
    expect(res.bbox.maxX - res.bbox.minX).toBeGreaterThan(80);
    expect(res.bbox.maxY - res.bbox.minY).toBeGreaterThan(80);
  });

  test('empty canvas + star success sentence + zero tools still draws a star', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, runDrawTurn, starTipCount } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      const lie = 'I have drawn a five-pointed star on the canvas.';
      const turn = await runDrawTurn({
        userText: 'draw a five pointed star',
        execute,
        canvas: { width: 1000, height: 800 },
        generateWithTools: async () => lie,
      });

      const live =
        typeof editor.getShapes === 'function' ? editor.getShapes() : editor.toJSON()?.shapes || [];
      editor.destroy();
      document.body.removeChild(container);
      return {
        turn,
        liveCount: live.length,
        tips: starTipCount(live[0]?.points || turn.shapes[0]?.points),
      };
    });

    expect(res.turn.intent.recipe.simplified).toBe(true);
    expect(res.turn.intent.kind).toBe('star');
    expect(res.turn.modelReply).toMatch(/have drawn a five-pointed star/i);
    expect(res.liveCount).toBeGreaterThanOrEqual(1);
    expect(res.turn.snapshot.empty).toBe(false);
    expect(res.turn.snapshot.looksLikeStar).toBe(true);
    expect(res.turn.snapshot.curveCount).toBeGreaterThanOrEqual(1);
    expect(res.tips).toBeGreaterThanOrEqual(4);
    expect(res.turn.reply).not.toMatch(/have drawn a five-pointed star/i);
    expect(res.turn.reply).toMatch(/star/i);
    expect(res.turn.reply).not.toMatch(/nothing was drawn/i);
  });

  test('never echoes a success claim when the canvas stays empty', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, runDrawTurn, assistantTextFromCanvas } =
        await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      const lie = 'I have drawn a five-pointed star on the canvas.';
      const dragon = await runDrawTurn({
        userText: 'draw a dragon breathing fire',
        execute,
        canvas: { width: 1000, height: 800 },
        generateWithTools: async () => lie,
      });

      const emptyClaim = assistantTextFromCanvas([], {}, lie);

      editor.destroy();
      document.body.removeChild(container);
      return { dragon, emptyClaim };
    });

    expect(res.dragon.snapshot.empty).toBe(true);
    expect(res.dragon.shapes).toHaveLength(0);
    expect(res.dragon.reply).not.toMatch(/have drawn|i drew|i've drawn/i);
    expect(res.dragon.reply).toMatch(/nothing was drawn|empty/i);
    expect(res.emptyClaim).not.toMatch(/have drawn/i);
    expect(res.emptyClaim).toMatch(/nothing was drawn/i);
  });

  test('yellow smiley recipe adds a face even with zero tool calls', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { createDrawToolExecutor, runDrawTurn } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: { width: 1000, height: 800 },
      });

      const turn = await runDrawTurn({
        userText: 'draw a yellow smiley face',
        execute,
        canvas: { width: 1000, height: 800 },
        generateWithTools: async () => 'I have drawn a smiley face.',
      });

      editor.destroy();
      document.body.removeChild(container);
      return turn;
    });

    expect(res.intent.recipe.simplified).toBe(true);
    expect(res.intent.recipe.variant).toBe('smiley');
    expect(res.snapshot.looksLikeFace).toBe(true);
    expect(res.snapshot.ellipseCount).toBeGreaterThanOrEqual(3);
    expect(res.reply).toMatch(/smiley/i);
    expect(res.reply).not.toMatch(/have drawn a smiley/i);
  });

  test('example prompts and fullscreen chip layout stay honest', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const { DRAW_EXAMPLE_PROMPTS, drawPromptChipLayout, parseDrawTurnIntent } =
        await import('/src/demos/draw-tools.js');
      const canvas = { width: 1000, height: 800 };
      return {
        texts: DRAW_EXAMPLE_PROMPTS.map((p) => p.text),
        ids: DRAW_EXAMPLE_PROMPTS.map((p) => p.id),
        windowedEmpty: drawPromptChipLayout({
          isFullscreen: false,
          shapeCount: 0,
          messageCount: 0,
        }),
        fullscreenEmpty: drawPromptChipLayout({
          isFullscreen: true,
          shapeCount: 0,
          messageCount: 0,
        }),
        fullscreenDrawn: drawPromptChipLayout({
          isFullscreen: true,
          shapeCount: 3,
          messageCount: 2,
        }),
        intents: {
          flag: parseDrawTurnIntent(DRAW_EXAMPLE_PROMPTS[0].text, canvas).kind,
          math: parseDrawTurnIntent(DRAW_EXAMPLE_PROMPTS[1].text, canvas).kind,
          star: parseDrawTurnIntent(DRAW_EXAMPLE_PROMPTS[2].text, canvas).kind,
          smiley: parseDrawTurnIntent(DRAW_EXAMPLE_PROMPTS[3].text, canvas).kind,
          heart: parseDrawTurnIntent(DRAW_EXAMPLE_PROMPTS[4].text, canvas).kind,
        },
      };
    });

    expect(res.ids).toEqual(['lithuania', 'math', 'star', 'smiley', 'heart']);
    expect(res.texts).toEqual([
      'paint big fat nice Lithuanian flag (yellow-green-red)',
      'draw x y axis and sin, cosin, tan and hyperbola on them - as in maths',
      'draw a five pointed star',
      'draw a yellow smiley face',
      'draw a green heart',
    ]);
    expect(res.windowedEmpty).toEqual({
      canvasOverlay: false,
      chatEmptyChips: true,
      chatTryRow: false,
    });
    expect(res.fullscreenEmpty).toEqual({
      canvasOverlay: true,
      chatEmptyChips: false,
      chatTryRow: true,
    });
    expect(res.fullscreenDrawn).toEqual({
      canvasOverlay: false,
      chatEmptyChips: false,
      chatTryRow: true,
    });
    expect(res.intents.flag).toBe('flag:lithuania');
    expect(res.intents.math).toBe('math-plot');
    expect(res.intents.star).toBe('star');
    expect(res.intents.smiley).toBe('face:smiley');
    expect(res.intents.heart).toBe('heart');
  });

  test('DrawPlan validate/compress/merge and regex host plan skip the LLM planner', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const {
        validateDrawPlan,
        compressDrawPlan,
        mergeDrawPlans,
        parseDrawPlanFromModelText,
        intentToDrawPlan,
        parseDrawTurnIntent,
        summarizeDrawPlan,
        formatDrawPlanInstructions,
        runDrawTurn,
        createDrawToolExecutor,
      } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const canvas = { width: 1000, height: 800 };
      const bad = validateDrawPlan({ title: 'x', steps: [{ op: 'explode', args: {} }] });
      const good = validateDrawPlan({
        title: 'house',
        clear: false,
        steps: [
          { op: 'add_shape', args: { type: 'rectangle', x: 10, y: 10, width: 100, height: 80 } },
          { op: 'add_curve', args: { kind: 'star', place: 'center' } },
          { op: 'add_shape', args: { type: 'ellipse' } },
          { op: 'add_shape', args: {} },
        ],
      });
      const fromText = parseDrawPlanFromModelText(
        'Sure.\n```json\n{"title":"sun","clear":false,"steps":[{"op":"add_shape","args":{"type":"ellipse","x":50,"y":50,"width":80,"height":80,"fill":"#fbbf24"}}]}\n```',
      );
      const flagIntent = parseDrawTurnIntent('Lithuanian flag', canvas);
      const hostPlan = intentToDrawPlan(flagIntent, canvas);
      const merged = mergeDrawPlans(hostPlan, fromText.plan);

      const phases = [];
      let plannerCalls = 0;
      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: canvas,
      });
      const flagTurn = await runDrawTurn({
        userText: 'paint big fat nice Lithuanian flag (yellow-green-red)',
        execute,
        canvas,
        onPhase: (phase) => phases.push(phase),
        generatePlan: async () => {
          plannerCalls += 1;
          return '{"title":"should-not-run","steps":[]}';
        },
        generateWithTools: async () => 'ok',
      });
      const flagPlannerCalls = plannerCalls;

      const fallbackPhases = [];
      let drawText = '';
      const house = await runDrawTurn({
        userText: 'draw a small house with a sun',
        execute,
        canvas,
        lastPlan: null,
        onPhase: (phase) => fallbackPhases.push(phase),
        generatePlan: async () => {
          plannerCalls += 1;
          return 'not json at all';
        },
        generateWithTools: async (text) => {
          drawText = text;
          return 'I tried.';
        },
      });

      const planPhases = [];
      let planDrawText = '';
      const planned = await runDrawTurn({
        userText: 'draw a small house with a sun',
        execute,
        canvas,
        onPhase: (phase) => planPhases.push(phase),
        generatePlan: async () =>
          JSON.stringify({
            title: 'house with sun',
            clear: true,
            steps: [
              {
                op: 'add_shape',
                args: { type: 'rectangle', x: 200, y: 400, width: 300, height: 220, fill: '#c4a574' },
              },
              {
                op: 'add_shape',
                args: { type: 'ellipse', x: 700, y: 80, width: 100, height: 100, fill: '#fbbf24' },
              },
            ],
          }),
        generateWithTools: async (text) => {
          planDrawText = text;
          return 'done';
        },
      });

      editor.destroy();
      document.body.removeChild(container);

      return {
        badOk: bad.ok,
        goodOk: good.ok,
        goodSteps: good.plan.steps.length,
        fromTextOk: fromText.ok,
        hostSteps: hostPlan.steps.length,
        hostSummary: summarizeDrawPlan(hostPlan),
        mergedSteps: merged.steps.length,
        compressedTitle: compressDrawPlan(good.plan).title,
        flagSource: flagTurn.planSource,
        flagPhases: phases,
        flagPlannerCalls,
        houseSource: house.planSource,
        housePhases: fallbackPhases,
        houseDrawIsRaw: /small house with a sun/i.test(drawText),
        plannedSource: planned.planSource,
        plannedPhases: planPhases,
        plannedHasInstructions:
          /add_shape/.test(planDrawText) && /house with sun|ellipse/i.test(planDrawText),
        plannedSummary: planned.planSummary,
        formatSample: formatDrawPlanInstructions(hostPlan).includes('add_shape'),
      };
    });

    expect(res.badOk).toBe(false);
    expect(res.goodOk).toBe(true);
    expect(res.goodSteps).toBe(3);
    expect(res.fromTextOk).toBe(true);
    expect(res.hostSteps).toBe(3);
    expect(res.hostSummary).toMatch(/Plan:/);
    expect(res.mergedSteps).toBeGreaterThanOrEqual(3);
    expect(res.compressedTitle).toBe('house');
    expect(res.flagSource).toBe('host');
    expect(res.flagPhases).toEqual(['drawing']);
    expect(res.flagPlannerCalls).toBe(0);
    expect(res.houseSource).toBe('fallback');
    expect(res.housePhases).toEqual(['planning', 'fallback']);
    expect(res.houseDrawIsRaw).toBe(true);
    expect(res.plannedSource).toBe('llm');
    expect(res.plannedPhases).toEqual(['planning', 'drawing']);
    expect(res.plannedHasInstructions).toBe(true);
    expect(res.plannedSummary).toMatch(/house/i);
    expect(res.formatSample).toBe(true);
  });

  test('validateDrawPlan rejects unknown add_shape types and coerces polygon to add_curve', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const { validateDrawPlan, looksLikeDrawPlanDump, assistantTextFromCanvas } =
        await import('/src/demos/draw-tools.js');

      const leaked = {
        title: 'Hexagon Grid',
        clear: false,
        steps: [
          {
            op: 'add_shape',
            args: {
              type: 'polygon',
              points: [
                { x: 50, y: 50 },
                { x: 80, y: 30 },
                { x: 110, y: 50 },
                { x: 110, y: 90 },
                { x: 80, y: 110 },
                { x: 50, y: 90 },
              ],
              fill: '#333333',
              stroke: '#000000',
              'stroke-width': 1,
            },
          },
          {
            op: 'add_shape',
            args: { type: 'hexagon', place: 'center', 'stroke-width': 2 },
          },
        ],
      };
      const coerced = validateDrawPlan(leaked);
      const bezier = validateDrawPlan({
        title: 'x',
        steps: [{ op: 'add_shape', args: { type: 'bezier', x: 0, y: 0 } }],
      });
      const dump =
        '{"title":"Hexagon Grid","clear":false,"steps":[{"op":"add_shape","args":{"type":"polygon","points":[{"x":50,"y":50},...';
      const emptyReply = assistantTextFromCanvas([], {}, dump);
      return {
        coercedOk: coerced.ok,
        coercedOps: coerced.plan.steps.map((s) => ({
          op: s.op,
          kind: s.args.kind,
          sides: s.args.sides,
          type: s.args.type,
          strokeWidth: s.args.strokeWidth,
          hasBounds: Boolean(s.args.bounds),
        })),
        bezierOk: bezier.ok,
        bezierError: bezier.error,
        dumpLooksLikePlan: looksLikeDrawPlanDump(dump),
        emptyReply,
      };
    });

    expect(res.coercedOk).toBe(true);
    expect(res.coercedOps).toHaveLength(2);
    expect(res.coercedOps.every((s) => s.op === 'add_curve' && s.kind === 'polygon')).toBe(true);
    expect(res.coercedOps.every((s) => s.type == null)).toBe(true);
    expect(res.coercedOps[0].sides).toBe(6);
    expect(res.coercedOps[0].strokeWidth).toBe(1);
    expect(res.coercedOps[0].hasBounds).toBe(true);
    expect(res.coercedOps[1].sides).toBe(6);
    expect(res.bezierOk).toBe(false);
    expect(res.bezierError).toBe('empty-steps');
    expect(res.dumpLooksLikePlan).toBe(true);
    expect(res.emptyReply).not.toMatch(/"steps"|"op":/);
    expect(res.emptyReply).toMatch(/nothing was drawn|empty/i);
  });

  test('hexagon grid of 9 identical hex cells is a host plan and fulfills without the LLM planner', async ({
    page,
  }) => {
    const res = await page.evaluate(async () => {
      const {
        parseDrawTurnIntent,
        intentToDrawPlan,
        createDrawToolExecutor,
        runDrawTurn,
        inspectDrawShapes,
        layoutHexagonGrid,
      } = await import('/src/demos/draw-tools.js');
      const { VdDrawCore } = await import('/node_modules/@vanduo-oss/vd3-cbun/dist/draw/index.js');

      const canvas = { width: 1000, height: 800 };
      const prompt = 'pls draw a hexagon grid of 9 identical hex cells';
      const intent = parseDrawTurnIntent(prompt, canvas);
      const hostPlan = intentToDrawPlan(intent, canvas);
      const layout = layoutHexagonGrid(9, canvas);
      const layoutKeys = new Set(layout.map((c) => `${c.x}:${c.y}`));

      const leakedJson =
        '{"title":"Hexagon Grid","clear":false,"steps":[{"op":"add_shape","args":{"type":"polygon","points":[{"x":50,"y":50},...';

      let plannerCalls = 0;
      const container = document.createElement('div');
      document.body.appendChild(container);
      const editor = new VdDrawCore({ element: container });
      const execute = createDrawToolExecutor({
        getEditor: () => editor,
        canvasSize: canvas,
      });
      const turn = await runDrawTurn({
        userText: prompt,
        execute,
        canvas,
        generatePlan: async () => {
          plannerCalls += 1;
          return leakedJson;
        },
        generateWithTools: async () => leakedJson,
      });
      const snap = inspectDrawShapes(turn.shapes);
      const hexShapes = (turn.shapes || []).filter(
        (s) => (s.type === 'line' || s.type === 'freehand') && (s.pointCount || s.points?.length) >= 6,
      );
      const centers = hexShapes.map((s) => {
        const pts = s.points || [];
        if (pts.length) {
          const sx = pts.reduce((a, p) => a + Number(p[0]), 0) / pts.length;
          const sy = pts.reduce((a, p) => a + Number(p[1]), 0) / pts.length;
          return `${Math.round(sx / 16)}:${Math.round(sy / 16)}`;
        }
        return `${Math.round(Number(s.x) / 16)}:${Math.round(Number(s.y) / 16)}`;
      });

      editor.destroy();
      document.body.removeChild(container);

      return {
        simplified: intent.recipe.simplified,
        kind: intent.kind,
        family: intent.recipe.family,
        count: intent.recipe.count,
        planSource: turn.planSource,
        plannerCalls,
        hostSteps: hostPlan.steps.length,
        hostOps: hostPlan.steps.map((s) => ({ op: s.op, kind: s.args.kind, sides: s.args.sides })),
        layoutCount: layout.length,
        layoutDistinct: layoutKeys.size,
        hexCount: snap.hexCount,
        looksLikeHexGrid: snap.looksLikeHexGrid,
        distinctCenters: new Set(centers).size,
        reply: turn.reply,
        modelReply: turn.modelReply,
      };
    });

    expect(res.simplified).toBe(true);
    expect(res.kind).toBe('hex-grid');
    expect(res.family).toBe('hex-grid');
    expect(res.count).toBe(9);
    expect(res.planSource).toBe('host');
    expect(res.plannerCalls).toBe(0);
    expect(res.hostSteps).toBe(9);
    expect(res.hostOps.every((s) => s.op === 'add_curve' && s.kind === 'polygon' && s.sides === 6)).toBe(
      true,
    );
    expect(res.layoutCount).toBe(9);
    expect(res.layoutDistinct).toBe(9);
    expect(res.hexCount).toBeGreaterThanOrEqual(8);
    expect(res.looksLikeHexGrid).toBe(true);
    expect(res.distinctCenters).toBeGreaterThanOrEqual(8);
    expect(res.modelReply).toMatch(/"steps"/);
    expect(res.reply).not.toMatch(/"steps"|"op":|add_shape/);
    expect(res.reply).toMatch(/hexagon grid/i);
  });
});
