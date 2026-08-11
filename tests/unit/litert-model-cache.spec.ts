import { expect, test } from '@playwright/test';

const HARNESS = '/tests/fixtures/neptune-harness.html';

/**
 * LiteRT Cache Storage helpers — miss fetches once and puts; hit skips network.
 */
test.describe('LiteRT model Cache Storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
  });

  test('loadLiteRTModelBytes caches on miss and reuses on hit', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const mod = await import('/node_modules/@vanduo-oss/vdl-ai-chat/dist/index.js');
      const url = 'https://example.test/models/demo.litertlm';
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      let fetchCount = 0;

      const store = new Map();
      const cache = {
        async match(key) {
          const hit = store.get(String(key));
          return hit ? hit.clone() : undefined;
        },
        async put(key, response) {
          store.set(String(key), response.clone());
        },
      };
      globalThis.caches = {
        async open() {
          return cache;
        },
        async delete() {
          store.clear();
          return true;
        },
        async keys() {
          return [mod.LITERT_MODEL_CACHE_NAME];
        },
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input) => {
        fetchCount += 1;
        if (String(input) !== url) {
          throw new Error(`unexpected fetch: ${String(input)}`);
        }
        return new Response(bytes, {
          status: 200,
          headers: { 'Content-Length': String(bytes.length) },
        });
      };

      try {
        const first = await mod.loadLiteRTModelBytes(url, { asStream: false });
        const second = await mod.loadLiteRTModelBytes(url, { asStream: false });
        const cacheDescribed = mod.describeLoadProgress(
          {
            stage: 'downloading',
            message: 'Reading cached model weights…',
            loaded: 1,
            source: 'cache',
          },
          { likelyCached: true },
        );
        mod.markModelCached('gemma-4-E2B-it-web');
        return {
          firstSource: first.source,
          secondSource: second.source,
          fetchCount,
          firstSize: first.modelSource instanceof Blob ? first.modelSource.size : -1,
          secondSize: second.modelSource instanceof Blob ? second.modelSource.size : -1,
          describedSource: cacheDescribed.source,
          marked: mod.isModelMarkedCached('gemma-4-E2B-it-web'),
          cacheName: mod.LITERT_MODEL_CACHE_NAME,
        };
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    expect(result.cacheName).toBe('vdl-litert-models');
    expect(result.firstSource).toBe('network');
    expect(result.secondSource).toBe('cache');
    expect(result.fetchCount).toBe(1);
    expect(result.firstSize).toBe(5);
    expect(result.secondSize).toBe(5);
    expect(result.describedSource).toBe('cache');
    expect(result.marked).toBe(true);
  });
});
