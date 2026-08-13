import { test, expect } from '@playwright/test';

test.describe('AI Draw fullscreen chrome', () => {
  test('enter/exit fullscreen and canvas overlay chips show when empty', async ({ page }) => {
    await page.goto('/demo/ai-draw-demo.html');
    await expect(page.getByTestId('ai-draw-fullscreen-enter')).toBeVisible();
    await expect(page.getByTestId('ai-draw-canvas-prompt-overlay')).toHaveCount(0);

    await page.getByTestId('ai-draw-fullscreen-enter').click();
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'true');
    await expect(page.getByTestId('ai-draw-fullscreen-exit')).toBeVisible();

    const overlay = page.getByTestId('ai-draw-canvas-prompt-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText('Five-pointed star')).toBeVisible();
    await expect(overlay.getByText('😊 Smiley')).toBeVisible();
    await expect(overlay.getByText('Lithuanian flag')).toBeVisible();

    await page.getByTestId('ai-draw-fullscreen-exit').click();
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'false');
    await expect(page.getByTestId('ai-draw-fullscreen-exit')).toHaveCount(0);
    await expect(page.getByTestId('ai-draw-canvas-prompt-overlay')).toHaveCount(0);

    await page.getByTestId('ai-draw-fullscreen-enter').click();
    await expect(page.getByTestId('ai-draw-canvas-prompt-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'false');
  });
});
