import { test, expect } from '@playwright/test';

const HARNESS = '/tests/fixtures/neptune-harness.html';

test.describe('NeptuneSearch Unit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
  });

  test('cosineSimilarity of identical vectors is 1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const vec = [0.5, 0.5, 0.5, 0.5];
      return window.neptuneMath.cosineSimilarity(vec, vec);
    });
    expect(result).toBeCloseTo(1, 5);
  });

  test('cosineSimilarity of orthogonal vectors is 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      return window.neptuneMath.cosineSimilarity(a, b);
    });
    expect(result).toBeCloseTo(0, 5);
  });

  test('cosineSimilarity of opposite vectors is -1', async ({ page }) => {
    const result = await page.evaluate(() => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      return window.neptuneMath.cosineSimilarity(a, b);
    });
    expect(result).toBeCloseTo(-1, 5);
  });

  test('rankBySimilarity returns sorted results above threshold', async ({ page }) => {
    const result = await page.evaluate(() => {
      const query = [1, 0, 0];
      const vectors = [
        { id: 'a', embedding: [0.9, 0.1, 0] },
        { id: 'b', embedding: [0.1, 0.9, 0] },
        { id: 'c', embedding: [0.5, 0.5, 0] },
      ];
      return window.neptuneMath.rankBySimilarity(query, vectors, 0.3);
    });

    expect(result.length).toBe(2);
    expect(result[0].id).toBe('a');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  test('rankBySimilarity filters below threshold', async ({ page }) => {
    const result = await page.evaluate(() => {
      const query = [1, 0, 0];
      const vectors = [
        { id: 'a', embedding: [0.2, 0.9, 0] },
        { id: 'b', embedding: [0.1, 0.95, 0] },
      ];
      return window.neptuneMath.rankBySimilarity(query, vectors, 0.5);
    });

    expect(result.length).toBe(0);
  });

  test('mergeResults caps at maxResults', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch({ maxResults: 2 });
      const fuzzy = [
        { item: window.mockDocs[0], score: 0.1 },
        { item: window.mockDocs[1], score: 0.2 },
        { item: window.mockDocs[2], score: 0.3 },
      ];
      const semantic = [
        { id: 'buttons', score: 0.9 },
        { id: 'glass', score: 0.8 },
        { id: 'getting-started', score: 0.7 },
      ];
      return search.mergeResults(fuzzy, semantic);
    });

    expect(result.length).toBe(2);
  });

  test('mergeResults deduplicates by id', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch();
      const fuzzy = [{ item: window.mockDocs[0], score: 0.1 }];
      const semantic = [{ id: 'buttons', score: 0.9 }];
      return search.mergeResults(fuzzy, semantic);
    });

    expect(result.length).toBe(1);
    expect(result[0].source).toBe('semantic');
  });

  test('mergeResults is deterministic at equal scores (sorts by id)', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const search = await window.createSearch({ maxResults: 10 });
      const fuzzy = [
        { item: { ...window.mockDocs[0], id: 'aaa' }, score: 0.5 },
        { item: { ...window.mockDocs[1], id: 'bbb' }, score: 0.5 },
      ];
      const semantic = [
        { id: 'aaa', score: 0.5 },
        { id: 'bbb', score: 0.5 },
      ];
      return search.mergeResults(fuzzy, semantic);
    });

    expect(results[0].doc.id).toBe('aaa');
    expect(results[1].doc.id).toBe('bbb');
  });

  test('mergeResults ranks by score across semantic and fuzzy', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch({ maxResults: 10 });
      const fuzzy = [
        { item: { ...window.mockDocs[0], id: 'fuzzy-only' }, score: 0.05 },
      ];
      const semantic = [
        { id: 'buttons', score: 0.3 },
      ];
      return search.mergeResults(fuzzy, semantic);
    });

    expect(result[0].source).toBe('fuzzy');
    expect(result[1].source).toBe('semantic');
  });

  test('mergeResults respects semanticBoost multiplier', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const search = await window.createSearch({ maxResults: 10, semanticBoost: 2.0 });
      const fuzzy = [{ item: { ...window.mockDocs[0], id: 'fuzzy-only' }, score: 0.5 }];
      const semantic = [{ id: 'buttons', score: 0.3 }];
      return search.mergeResults(fuzzy, semantic);
    });

    expect(result[0].source).toBe('semantic');
    expect(result[0].score).toBeCloseTo(0.6, 5);
    expect(result[1].source).toBe('fuzzy');
  });

  test('initFuzzy rejects malformed index payload', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const badPayload = { documents: [{ id: 'x', title: 'Only title' }] };
      const toBase64 = (str: string) => btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode('0x' + p1)));
      const search = new (await import('/neptune-search.js')).NeptuneSearch({
        indexUrl: 'data:application/json;base64,' + toBase64(JSON.stringify(badPayload)),
      });
      try {
        await search.initFuzzy();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: String(err?.message || '') };
      }
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('invalid');
  });

  test('UI result links are safely constructed', async ({ page }) => {
    const href = await page.evaluate(async () => {
      const { ui } = await window.createUI({ baseUrl: 'javascript:alert(1)' });
      ui._results = [{
        doc: {
          id: 'bad-doc',
          title: 'Unsafe',
          category: 'Security',
          icon: 'ph-file-text" onclick="alert(1)',
          bodyText: 'Unsafe payload test',
          route: 'javascript:alert(1)',
          keywords: ['unsafe'],
        },
        score: 0.9,
        source: 'fuzzy',
      }];
      ui._renderResults();
      return document.querySelector('.vd-neptune-result-link')?.getAttribute('href');
    });

    expect(href).toBe('#');
  });
});
