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
