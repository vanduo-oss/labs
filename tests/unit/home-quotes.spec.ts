import { test, expect } from '@playwright/test';

test.describe('vdl home quotes shuffle bag', () => {
  test('daily seed is stable; picks avoid consecutive repeats', async ({ page }) => {
    await page.goto('/tests/fixtures/neptune-harness.html');

    const result = await page.evaluate(async () => {
      const mod = await import('/src/vdl-home-quotes.js');

      const store = new Map();
      const fakeStorage = {
        getItem(key) {
          return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
          store.set(key, String(value));
        },
        removeItem(key) {
          store.delete(key);
        },
      };

      const quotes = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
      const dayKey = '2026-08-08';
      fakeStorage.setItem(mod.VDL_HOME_QUOTES_STORAGE_KEYS.salt, 'fixed-session-salt');

      const bagA = mod.buildQuoteBag(
        quotes.length,
        mod.seedFromDayAndSalt(dayKey, 'fixed-session-salt', 0),
      );
      const bagB = mod.buildQuoteBag(
        quotes.length,
        mod.seedFromDayAndSalt(dayKey, 'fixed-session-salt', 0),
      );
      const bagOtherDay = mod.buildQuoteBag(
        quotes.length,
        mod.seedFromDayAndSalt('2026-08-09', 'fixed-session-salt', 0),
      );

      const picks = [];
      for (let i = 0; i < 20; i++) {
        picks.push(
          mod.pickNextHomeQuote({
            quotes,
            storage: fakeStorage,
            dayKey,
          }).index,
        );
      }

      let consecutiveRepeat = false;
      for (let i = 1; i < picks.length; i++) {
        if (picks[i] === picks[i - 1]) consecutiveRepeat = true;
      }

      // Bag boundary: force last of first bag to equal first of next by
      // using avoidFirst logic on a tiny list.
      const tiny = ['a', 'b'];
      const store2 = new Map();
      const storage2 = {
        getItem(key) {
          return store2.has(key) ? store2.get(key) : null;
        },
        setItem(key, value) {
          store2.set(key, String(value));
        },
        removeItem(key) {
          store2.delete(key);
        },
      };
      storage2.setItem(mod.VDL_HOME_QUOTES_STORAGE_KEYS.salt, 'tiny-salt');
      const tinyPicks = [];
      for (let i = 0; i < 8; i++) {
        tinyPicks.push(
          mod.pickNextHomeQuote({
            quotes: tiny,
            storage: storage2,
            dayKey,
          }).index,
        );
      }
      let tinyConsecutive = false;
      for (let i = 1; i < tinyPicks.length; i++) {
        if (tinyPicks[i] === tinyPicks[i - 1]) tinyConsecutive = true;
      }

      const catalogSize = mod.VDL_HOME_QUOTES.length;
      const glados = mod.VDL_HOME_QUOTES.find((q) => q.id === mod.VDL_HOME_QUOTE_GLADOS_ID);
      const intervalA = mod.nextHomeQuoteIntervalMs(3000, 5000, () => 0);
      const intervalB = mod.nextHomeQuoteIntervalMs(3000, 5000, () => 1);

      return {
        bagA,
        bagB,
        bagOtherDay,
        bagsEqual: JSON.stringify(bagA) === JSON.stringify(bagB),
        otherDayDiffers: JSON.stringify(bagA) !== JSON.stringify(bagOtherDay),
        bagIsPermutation:
          bagA.length === quotes.length &&
          new Set(bagA).size === quotes.length &&
          bagA.every((n) => n >= 0 && n < quotes.length),
        consecutiveRepeat,
        tinyConsecutive,
        tinyPicks,
        catalogSize,
        gladosText: glados?.text ?? null,
        isGlados: mod.isGladosHomeQuote(glados),
        intervalA,
        intervalB,
        storageKeys: mod.VDL_HOME_QUOTES_STORAGE_KEYS,
      };
    });

    expect(result.bagsEqual).toBe(true);
    expect(result.otherDayDiffers).toBe(true);
    expect(result.bagIsPermutation).toBe(true);
    expect(result.consecutiveRepeat).toBe(false);
    expect(result.tinyConsecutive).toBe(false);
    expect(result.catalogSize).toBe(43);
    expect(result.gladosText).toBe('We are not yet building GLaDOS, but we might soon…');
    expect(result.isGlados).toBe(true);
    expect(result.intervalA).toBe(3000);
    expect(result.intervalB).toBe(5000);
    expect(result.storageKeys.salt).toBe('vdl-home-quotes-salt');
    expect(result.storageKeys.last).toBe('vdl-home-quotes-last');
    expect(result.storageKeys.salt.startsWith('vdl-')).toBe(true);
  });
});
