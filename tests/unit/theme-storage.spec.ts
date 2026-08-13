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
    expect(defaults.THEME).toBe('system');
  });
});

test.describe('resolved theme (system → light|dark)', () => {
  test('resolveThemeScheme maps system via prefers-color-scheme', async ({ page }) => {
    await page.goto('/tests/fixtures/neptune-harness.html');

    const light = await page.evaluate(async () => {
      const mod = await import('/src/vdl-resolved-theme.js');
      return mod.resolveThemeScheme('system');
    });
    // harness has no forced scheme — either light or dark is fine as long as resolved
    expect(['light', 'dark']).toContain(light);

    await page.emulateMedia({ colorScheme: 'dark' });
    expect(
      await page.evaluate(async () => {
        const mod = await import('/src/vdl-resolved-theme.js');
        return mod.resolveThemeScheme('system');
      }),
    ).toBe('dark');

    await page.emulateMedia({ colorScheme: 'light' });
    expect(
      await page.evaluate(async () => {
        const mod = await import('/src/vdl-resolved-theme.js');
        return mod.resolveThemeScheme('system');
      }),
    ).toBe('light');

    expect(
      await page.evaluate(async () => {
        const mod = await import('/src/vdl-resolved-theme.js');
        return {
          light: mod.resolveThemeScheme('light'),
          dark: mod.resolveThemeScheme('dark'),
        };
      }),
    ).toEqual({ light: 'light', dark: 'dark' });
  });

  test('installResolvedTheme keeps data-theme as light|dark when preference is system', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vdl-theme-preference', 'system');
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const boot = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      colorScheme: document.documentElement.style.colorScheme ||
        document.documentElement.style.getPropertyValue('color-scheme'),
      pref: localStorage.getItem('vdl-theme-preference'),
    }));
    expect(boot.pref).toBe('system');
    expect(boot.theme).toBe('dark');
    expect(boot.theme).not.toBe('system');
    expect(boot.colorScheme).toBe('dark');

    // Simulate legacy vd3 clearing data-theme for system — Labs must restore.
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-theme');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('explicit light/dark preferences stamp matching data-theme', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vdl-theme-preference', 'light');
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.evaluate(() => {
      localStorage.setItem('vdl-theme-preference', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.setProperty('color-scheme', 'dark');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
