import { test, expect } from '@playwright/test';

async function acceptDisclaimer(page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('vanduo-labs-toc-accepted');
      sessionStorage.removeItem('vanduo-labs-toc-declined');
      localStorage.removeItem('vanduo-labs-demos-disclaimer-v1');
    } catch {
      /* ignore */
    }
  });
  await page.goto('/#home');
  const gate = page.getByTestId('disclaimer-gate');
  if (await gate.count()) {
    await page.getByTestId('disclaimer-accept').click();
  }
  await expect(page.locator('nav.vd-site-dock')).toBeVisible();
}

test.describe('Labs site dock', () => {
  // Narrow viewports force the dock to top/bottom (horizontal), so vertical-edge
  // wordmark hiding only applies on desktop-width projects.
  test('vertical edges hide brand wordmark (logo only)', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name.toLowerCase().includes('mobile') ||
        (page.viewportSize()?.width ?? 0) < 768,
      'Vertical dock edges are desktop-only; mobile forces horizontal edges',
    );

    await acceptDisclaimer(page);

    const dock = page.locator('nav.vd-site-dock.vd-dock-fixed').first();
    await expect(dock).toBeVisible();

    // Force left edge via storage + reload so persist restores vertical.
    await page.evaluate(() => {
      localStorage.setItem('vdl-site-dock', 'left');
    });
    await page.reload();
    await acceptDisclaimer(page);

    const dockLeft = page.locator('nav.vd-site-dock.vd-dock-fixed').first();
    await expect(dockLeft).toHaveClass(/vd-dock-edge-left|is-vertical/);

    const wordmark = dockLeft.locator('.labs-dock-brand-title');
    await expect(wordmark).toBeHidden();

    // Horizontal restores wordmark.
    await page.evaluate(() => {
      localStorage.setItem('vdl-site-dock', 'top');
    });
    await page.reload();
    await acceptDisclaimer(page);
    const dockTop = page.locator('nav.vd-site-dock.vd-dock-fixed').first();
    await expect(dockTop.locator('.labs-dock-brand-title')).toBeVisible();
  });

  test('dock lists Widgets and navigates to #widgets', async ({ page }) => {
    await acceptDisclaimer(page);
    const widgets = page.locator('nav.vd-site-dock .vd-dock-item[aria-label="Widgets"]');
    await expect(widgets).toBeVisible();
    await widgets.click();
    await expect(page).toHaveURL(/#widgets/);
    await expect(page.locator('#labs-widgets')).toBeVisible();
  });

  test('theme customizer opens primary-only swatches fan', async ({ page }) => {
    await acceptDisclaimer(page);

    const trigger = page.locator('nav.vd-site-dock [data-theme-customizer-trigger]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-label', 'Choose theme color');

    await trigger.click();

    const fan = page.locator('.vd-theme-customizer-fan');
    await expect(fan).toHaveClass(/is-open/);
    await expect(fan.locator('.tc-fan-item')).toHaveCount(13);

    // Panel editor (palette / neutral / radius / font) must not appear.
    await expect(page.locator('.vd-theme-customizer-panel')).toHaveCount(0);
    await expect(page.locator('.tc-radius-group, .tc-font-select')).toHaveCount(0);

    // Fan blades overlap in hit-testing; drive the pick through the DOM like
    // the vd3-docs unit tests do.
    await fan.locator('[data-color="yellow"]').evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(fan).not.toHaveClass(/is-open/);
    await expect(page.locator('html')).toHaveAttribute('data-primary', 'yellow');
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('vdl-primary-color')))
      .toBe('yellow');
    expect(await page.evaluate(() => localStorage.getItem('vanduo-primary-color'))).toBeNull();
  });
});

test.describe('Labs widget hash routes', () => {
  test.beforeEach(async ({ page }) => {
    await acceptDisclaimer(page);
  });

  test('#widgets/draw mounts VdDraw', async ({ page }) => {
    await page.goto('/#widgets/draw');
    await expect(page.locator('section#vd-draw')).toBeVisible();
    await expect(page.locator('[data-testid="labs-widget-draw"], .vd-draw').first()).toBeVisible();
  });

  test('#widgets/hex mounts VdHexGrid', async ({ page }) => {
    await page.goto('/#widgets/hex');
    await expect(page.locator('section#vd-hex')).toBeVisible();
    await expect(page.locator('section#vd-hex .vd-hex-grid')).toBeVisible();
  });

  test('#widgets/code-editor mounts VdCodeEditor', async ({ page }) => {
    await page.goto('/#widgets/code-editor');
    await expect(page.locator('section#code-editor')).toBeVisible();
    await expect(
      page.locator('[data-testid="labs-widget-code-editor"], .vd-code-editor').first(),
    ).toBeVisible();
  });

  test('#widgets/music-player mounts VdMusicPlayer', async ({ page }) => {
    await page.goto('/#widgets/music-player');
    await expect(page.locator('section#music-player')).toBeVisible();
    await expect(
      page.locator('[data-testid="labs-widget-music-player"], .vd-music-player').first(),
    ).toBeVisible();
  });
});
