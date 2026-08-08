import { test, expect } from '@playwright/test';

test.describe('vdl theme storage remap', () => {
  test('remaps vd3 vanduo-* theme keys to vdl-* without touching docs keys', async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/neptune-harness.html');

    const result = await page.evaluate(async () => {
      // Fresh Storage-like object so we don't pollute the real origin prefs.
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

      // Simulate existing Vanduo docs preferences on a shared origin.
      fakeStorage.setItem('vanduo-theme-preference', 'light');
      fakeStorage.setItem('vanduo-palette', 'open-color');

      const mod = await import('/src/vdl-theme-storage.js');
      const installed = mod.installVdlThemeStorage(fakeStorage);
      const installedAgain = mod.installVdlThemeStorage(fakeStorage);

      // vd3-style writes through the remapped API.
      fakeStorage.setItem('vanduo-theme-preference', 'dark');
      fakeStorage.setItem('vanduo-palette', 'fibonacci');
      fakeStorage.setItem('vanduo-primary-color', 'sky');
      fakeStorage.setItem('vanduo-neutral-color', 'neutral');
      fakeStorage.setItem('vanduo-radius', '0.5');
      fakeStorage.setItem('vanduo-font-preference', 'jetbrains-mono');

      const reads = {
        themeViaVd3Key: fakeStorage.getItem('vanduo-theme-preference'),
        paletteViaVd3Key: fakeStorage.getItem('vanduo-palette'),
        primaryViaVd3Key: fakeStorage.getItem('vanduo-primary-color'),
        neutralViaVd3Key: fakeStorage.getItem('vanduo-neutral-color'),
        radiusViaVd3Key: fakeStorage.getItem('vanduo-radius'),
        fontViaVd3Key: fakeStorage.getItem('vanduo-font-preference'),
      };

      // Direct underlying keys (bypass remap by reading the Map).
      const underlying = Object.fromEntries(store.entries());

      fakeStorage.removeItem('vanduo-primary-color');
      const afterRemove = {
        primaryViaVd3Key: fakeStorage.getItem('vanduo-primary-color'),
        underlyingHasVdlPrimary: store.has('vdl-primary-color'),
        underlyingHasVanduoPrimary: store.has('vanduo-primary-color'),
      };

      // Unrelated keys pass through unchanged.
      fakeStorage.setItem('other-key', 'ok');
      const other = fakeStorage.getItem('other-key');

      return {
        installed,
        installedAgain,
        keyMap: mod.VDL_THEME_STORAGE_KEYS,
        reads,
        underlying,
        afterRemove,
        other,
      };
    });

    expect(result.installed).toBe(true);
    expect(result.installedAgain).toBe(false);
    expect(result.keyMap['vanduo-theme-preference']).toBe('vdl-theme-preference');

    expect(result.reads.themeViaVd3Key).toBe('dark');
    expect(result.reads.paletteViaVd3Key).toBe('fibonacci');
    expect(result.reads.primaryViaVd3Key).toBe('sky');
    expect(result.reads.neutralViaVd3Key).toBe('neutral');
    expect(result.reads.radiusViaVd3Key).toBe('0.5');
    expect(result.reads.fontViaVd3Key).toBe('jetbrains-mono');

    // Labs wrote vdl-* keys; pre-existing vanduo-* docs values remain.
    expect(result.underlying['vdl-theme-preference']).toBe('dark');
    expect(result.underlying['vdl-palette']).toBe('fibonacci');
    expect(result.underlying['vdl-primary-color']).toBe('sky');
    expect(result.underlying['vanduo-theme-preference']).toBe('light');
    expect(result.underlying['vanduo-palette']).toBe('open-color');
    expect(result.underlying['vanduo-primary-color']).toBeUndefined();

    expect(result.afterRemove.primaryViaVd3Key).toBeNull();
    expect(result.afterRemove.underlyingHasVdlPrimary).toBe(false);
    expect(result.afterRemove.underlyingHasVanduoPrimary).toBe(false);
    expect(result.other).toBe('ok');
  });
});

test.describe('vdl theme defaults', () => {
  test('exports Labs global themeDefaults for unset vdl-* prefs', async ({ page }) => {
    await page.goto('/tests/fixtures/neptune-harness.html');

    const defaults = await page.evaluate(async () => {
      const mod = await import('/src/vdl-theme-defaults.js');
      return mod.VDL_THEME_DEFAULTS;
    });

    expect(defaults.FONT).toBe('open-sans');
    expect(defaults.NEUTRAL).toBe('neutral');
    expect(defaults.RADIUS).toBe('0.25');
    expect(defaults.PALETTE).toBe('open-color');
  });
});
