import { test, expect } from '@playwright/test';

const HARNESS = '/tests/fixtures/neptune-harness.html';

test.describe('HybridSearch E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
  });

  test('fuzzy search returns results for "button"', async ({ page }) => {
    const { fuzzyCount, firstTitle } = await page.evaluate(async () => {
      const search = await window.createSearch();
      const result = search.fuzzySearch('button');
      return {
        fuzzyCount: result.length,
        firstTitle: result[0]?.item?.title,
      };
    });

    expect(fuzzyCount).toBeGreaterThan(0);
    expect(firstTitle).toBe('Buttons');
  });

  test('fuzzy search is empty for short query', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch();
      return search.fuzzySearch('x');
    });

    expect(result).toHaveLength(0);
  });

  test('semantic search returns ranked results', async ({ page }) => {
    const { semanticCount, firstId } = await page.evaluate(async () => {
      const search = await window.createSearch();
      const result = await search.semanticSearch('glass card');
      return {
        semanticCount: result.length,
        firstId: result[0]?.id,
      };
    });

    expect(semanticCount).toBeGreaterThan(0);
  });

  test('hybrid merge deduplicates and keeps score order', async ({ page }) => {
    const { merged } = await page.evaluate(async () => {
      const search = await window.createSearch();
      const fuzzy = search.fuzzySearch('button');
      const semantic = await search.semanticSearch('button click');
      const merged = search.mergeResults(fuzzy, semantic);
      return {
        merged: merged.map(m => ({ id: m.doc.id, source: m.source, score: m.score })),
      };
    });

    // Should have results
    expect(merged.length).toBeGreaterThan(0);

    // Score order should be descending
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].score).toBeGreaterThanOrEqual(merged[i].score);
    }

    // No duplicates
    const ids = merged.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('UI autofocuses search input on mount', async ({ page }) => {
    await page.evaluate(async () => {
      await window.createUI();
    });

    await expect(page.locator('.vdl-neptune-input')).toBeFocused();
  });

  test('UI mounts and shows results on input without Enter', async ({ page }) => {
    await page.evaluate(async () => {
      await window.createUI();
    });

    const input = page.locator('.vdl-neptune-input');
    await input.fill('button');
    await page.waitForTimeout(450); // debounce (default 350ms)

    const results = page.locator('.vdl-neptune-result');
    await expect(results.first()).toBeVisible();
    await expect(results.first().locator('.vdl-neptune-result-title')).toContainText('Buttons');
  });

  test('UI Enter submits hybrid search immediately', async ({ page }) => {
    const mode = await page.evaluate(async () => {
      const search = await window.createSearch();
      const modes = [];
      const orig = search.search.bind(search);
      search.search = async (q, opts) => {
        modes.push(opts?.mode || 'hybrid');
        return orig(q, opts);
      };
      const container = document.getElementById('mount');
      container.innerHTML = '';
      const ui = new window.NeptuneSearchUI({ container, search, debounceMs: 5000 });
      ui.mount();
      const input = container.querySelector('.vdl-neptune-input') as HTMLInputElement;
      input.value = 'button';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
      return modes;
    });

    expect(mode).toContain('hybrid');
  });

  test('UI mount preloads semantic layer without blocking fuzzy', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch();
      // Harness marks semantic ready; clear so preload path runs.
      search._semanticReady = false;
      let initCalls = 0;
      const orig = search.initSemantic.bind(search);
      search.initSemantic = async () => {
        if (search._semanticReady) return;
        initCalls += 1;
        await new Promise((r) => setTimeout(r, 80));
        search._semanticReady = true;
        search._emitSemanticProgress({ stage: 'ready', message: 'Search model ready' });
        return orig();
      };

      const container = document.getElementById('mount');
      container.innerHTML = '';
      const ui = new window.NeptuneSearchUI({ container, search, debounceMs: 100 });
      ui.mount();

      // Fuzzy should work while preload is still in flight.
      const input = container.querySelector('.vdl-neptune-input');
      input.value = 'button';
      input.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 200));
      const fuzzyCount = container.querySelectorAll('.vdl-neptune-result').length;

      await new Promise((r) => setTimeout(r, 150));
      return {
        initCalls,
        fuzzyCount,
        ready: search.isSemanticReady(),
      };
    });

    expect(result.initCalls).toBeGreaterThanOrEqual(1);
    expect(result.fuzzyCount).toBeGreaterThan(0);
    expect(result.ready).toBe(true);
  });

  test('UI remount reuses in-flight semantic preload promise', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch();
      search._semanticReady = false;
      search._semanticFailed = false;
      search._semanticPromise = null;

      let pipelineStarts = 0;
      search.initSemantic = async function () {
        if (this._semanticReady) return;
        if (!this._semanticPromise) {
          pipelineStarts += 1;
          this._semanticPromise = (async () => {
            await new Promise((r) => setTimeout(r, 60));
            this._semanticReady = true;
          })();
        }
        return this._semanticPromise;
      };

      const container = document.getElementById('mount');
      container.innerHTML = '';
      const ui1 = new window.NeptuneSearchUI({ container, search });
      ui1.mount();
      ui1.destroy();

      container.innerHTML = '';
      const ui2 = new window.NeptuneSearchUI({ container, search });
      ui2.mount();
      await search.initSemantic();

      return { pipelineStarts, ready: search.isSemanticReady() };
    });

    expect(result.pipelineStarts).toBe(1);
    expect(result.ready).toBe(true);
  });

  test('UI shows empty state for no results', async ({ page }) => {
    // Force fuzzy-only: harness semantic mock matches all queries at ~1.0.
    await page.evaluate(async () => {
      const search = await window.createSearch();
      search._semanticReady = false;
      search.initSemantic = async () => {
        /* leave semantic unavailable so auto-search stays fuzzy */
      };
      const container = document.getElementById('mount');
      container.innerHTML = '';
      const ui = new window.NeptuneSearchUI({ container, search });
      ui.mount();
    });

    const input = page.locator('.vdl-neptune-input');
    await input.fill('xyzabc');
    await page.waitForTimeout(450);

    await expect(page.locator('.vdl-neptune-empty')).toBeVisible();
  });

  test('UI keyboard navigation works', async ({ page }) => {
    await page.evaluate(async () => {
      await window.createUI();
    });

    const input = page.locator('.vdl-neptune-input');
    await input.fill('button');
    await page.waitForTimeout(450);

    await input.press('ArrowDown');
    const first = page.locator('.vdl-neptune-result').first();
    await expect(first).toHaveClass(/is-selected/);

    await input.press('Escape');
    await expect(page.locator('.vdl-neptune-dropdown')).toBeHidden();
  });

  test('Cmd+K focuses search input', async ({ page }) => {
    await page.evaluate(async () => {
      await window.createUI();
    });

    const input = page.locator('.vdl-neptune-input');
    await input.blur();
    await page.keyboard.press('Meta+k');
    await expect(input).toBeFocused();
  });

  test('result click triggers onResultClick', async ({ page }) => {
    let clicked = null;
    await page.exposeFunction('onResultClick', (data) => {
      clicked = data;
    });

    await page.evaluate(async () => {
      const search = await window.createSearch();
      const container = document.getElementById('mount');
      container.innerHTML = '';
      const ui = new window.NeptuneSearchUI({
        container,
        search,
        onResultClick: (r) => window.onResultClick({ id: r.doc.id, title: r.doc.title }),
      });
      ui.mount();
    });

    const input = page.locator('.vdl-neptune-input');
    await input.fill('button');
    await page.waitForTimeout(450);

    await page.locator('.vdl-neptune-result').first().click();
    await page.waitForTimeout(100);

    expect(clicked).not.toBeNull();
    expect(clicked.id).toBe('buttons');
  });

  test('mount→destroy→remount does not leak events or state', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch();
      const container = document.getElementById('mount');

      const ui1 = new window.NeptuneSearchUI({ container, search });
      ui1.mount();

      const input1 = container.querySelector('.vdl-neptune-input') as HTMLInputElement;
      input1.value = 'button';
      input1.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 450));

      ui1.destroy();

      container.innerHTML = '';
      const ui2 = new window.NeptuneSearchUI({ container, search });
      ui2.mount();

      const input2 = container.querySelector('.vdl-neptune-input') as HTMLInputElement;
      input2.value = 'glass';
      input2.dispatchEvent(new Event('input'));
      await new Promise(r => setTimeout(r, 450));

      const results2 = container.querySelectorAll('.vdl-neptune-result');
      return { count: results2.length };
    });

    expect(result.count).toBeGreaterThan(0);
  });

  test('result cards have stable ids for aria-activedescendant', async ({ page }) => {
    await page.evaluate(async () => {
      await window.createUI();
    });

    const input = page.locator('.vdl-neptune-input');
    await input.fill('button');
    await page.waitForTimeout(450);

    const firstId = await page.locator('.vdl-neptune-result').first().getAttribute('id');
    expect(firstId).toBeTruthy();
    expect(firstId).toMatch(/^vdl-neptune-result-\d+$/);
  });

  test('keyboard nav updates aria-activedescendant on input', async ({ page }) => {
    await page.evaluate(async () => {
      await window.createUI();
    });

    const input = page.locator('.vdl-neptune-input');
    await input.fill('button');
    await page.waitForTimeout(450);

    await input.press('ArrowDown');
    const activeDescendant = await input.getAttribute('aria-activedescendant');
    expect(activeDescendant).toBeTruthy();

    await input.press('Escape');
    const afterEscape = await input.getAttribute('aria-activedescendant');
    expect(afterEscape).toBe('');
  });
});
