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
      const { createDrawToolExecutor, buildDrawChatContext } = await import(
        '/src/demos/draw-tools.js'
      );
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
      const { createDrawToolExecutor, buildDrawChatContext } = await import(
        '/src/demos/draw-tools.js'
      );
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
        typeof editor.getShapes === 'function'
          ? editor.getShapes()
          : editor.toJSON()?.shapes || [];
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
        evalGeometryCode(`({ Math }) => { fetch('/x'); return { type:'line', points:[[0,0],[1,1]] }; }`);
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
});
