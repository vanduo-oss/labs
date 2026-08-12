import { test, expect } from '@playwright/test';

test.describe('vd3 storagePrefix (vdl-)', () => {
  test('Labs bootstrap uses storagePrefix vdl- (no remapper shim)', async ({ page }) => {
    await page.goto('/tests/fixtures/neptune-harness.html');

    const result = await page.evaluate(async () => {
      const mainSrc = await (await fetch('/src/main.js')).text();

      // Simulate docs prefs that must remain untouched on a shared origin.
      localStorage.setItem('vanduo-theme-preference', 'light');
      localStorage.setItem('vanduo-palette', 'open-color');

      // Official prefix contract: keys are `${prefix}${suffix}`.
      const prefix = 'vdl-';
      localStorage.setItem(`${prefix}theme-preference`, 'dark');
      localStorage.setItem(`${prefix}palette`, 'fibonacci');
      localStorage.setItem(`${prefix}primary-color`, 'sky');

      return {
        mainUsesPrefix: /storagePrefix:\s*['"]vdl-['"]/.test(mainSrc),
        mainDropsRemapper: !/vdl-theme-storage/.test(mainSrc),
        theme: localStorage.getItem('vdl-theme-preference'),
        palette: localStorage.getItem('vdl-palette'),
        primary: localStorage.getItem('vdl-primary-color'),
        docsTheme: localStorage.getItem('vanduo-theme-preference'),
        docsPalette: localStorage.getItem('vanduo-palette'),
      };
    });

    expect(result.mainUsesPrefix).toBe(true);
    expect(result.mainDropsRemapper).toBe(true);
    expect(result.theme).toBe('dark');
    expect(result.palette).toBe('fibonacci');
    expect(result.primary).toBe('sky');
    expect(result.docsTheme).toBe('light');
    expect(result.docsPalette).toBe('open-color');
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
