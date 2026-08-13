import { test, expect } from '@playwright/test';

async function expectStageFillsViewport(page) {
  const metrics = await page.getByTestId('ai-draw-stage').evaluate((el) => {
    const stage = el.getBoundingClientRect();
    const main = el.querySelector('.ai-draw-main')?.getBoundingClientRect();
    return {
      parentTag: el.parentElement?.tagName || '',
      stageTop: stage.top,
      stageLeft: stage.left,
      stageHeight: stage.height,
      stageWidth: stage.width,
      mainHeight: main?.height || 0,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      position: getComputedStyle(el).position,
    };
  });

  expect(metrics.parentTag).toBe('BODY');
  expect(metrics.position).toBe('fixed');
  expect(metrics.stageTop).toBeLessThanOrEqual(1);
  expect(metrics.stageLeft).toBeLessThanOrEqual(1);
  expect(metrics.stageHeight).toBeGreaterThan(metrics.innerHeight * 0.9);
  expect(metrics.stageWidth).toBeGreaterThan(metrics.innerWidth * 0.9);
  expect(metrics.mainHeight).toBeGreaterThan(metrics.innerHeight * 0.75);
  expect(metrics.mainHeight).toBeGreaterThan(200);
}

async function expectChatPaneVisibleInOverlay(page) {
  const chat = page.getByTestId('ai-draw-chat-panel');
  await expect(chat).toBeVisible();
  await expect(chat.getByText('Ask AI Draw')).toBeVisible();

  const metrics = await chat.evaluate((el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const stage = el.closest('[data-testid="ai-draw-stage"]');
    return {
      display: style.display,
      visibility: style.visibility,
      hidden: el.hidden,
      width: box.width,
      height: box.height,
      inStage: Boolean(stage),
      stageParent: stage?.parentElement?.tagName || '',
    };
  });

  expect(metrics.display).not.toBe('none');
  expect(metrics.visibility).not.toBe('hidden');
  expect(metrics.hidden).toBe(false);
  expect(metrics.inStage).toBe(true);
  expect(metrics.stageParent).toBe('BODY');
  expect(metrics.width).toBeGreaterThan(120);
  expect(metrics.height).toBeGreaterThan(160);
}

test.describe('AI Draw fullscreen chrome', () => {
  test('enter/exit fullscreen and canvas overlay chips show when empty', async ({ page }) => {
    await page.goto('/demo/ai-draw-demo.html');
    await expect(page.getByTestId('ai-draw-fullscreen-enter')).toBeVisible();
    await expect(page.getByTestId('ai-draw-canvas-prompt-overlay')).toHaveCount(0);

    await page.getByTestId('ai-draw-fullscreen-enter').click();
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'true');
    await expect(page.getByTestId('ai-draw-fullscreen-exit')).toBeVisible();
    await expectStageFillsViewport(page);
    await expectChatPaneVisibleInOverlay(page);

    const overlay = page.getByTestId('ai-draw-canvas-prompt-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText('Five-pointed star')).toBeVisible();
    await expect(overlay.getByText('😊 Smiley')).toBeVisible();
    await expect(overlay.getByText('Lithuanian flag')).toBeVisible();

    await page.getByTestId('ai-draw-fullscreen-exit').click();
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'false');
    await expect(page.getByTestId('ai-draw-fullscreen-exit')).toHaveCount(0);
    await expect(page.getByTestId('ai-draw-canvas-prompt-overlay')).toHaveCount(0);
    await expect(page.getByTestId('ai-draw-chat-panel')).toBeVisible();

    const restoredParent = await page.getByTestId('ai-draw-stage').evaluate((el) => {
      return el.parentElement?.tagName || '';
    });
    expect(restoredParent).not.toBe('BODY');

    await page.getByTestId('ai-draw-fullscreen-enter').click();
    await expect(page.getByTestId('ai-draw-canvas-prompt-overlay')).toBeVisible();
    await expectStageFillsViewport(page);
    await expectChatPaneVisibleInOverlay(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'false');
  });

  test('labs glass card stack still fills the viewport', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'vanduo-labs-toc-accepted',
        JSON.stringify({ version: '1', acceptedAt: new Date().toISOString() }),
      );
    });
    await page.goto('/#demos/aidraw');
    await expect(page.getByTestId('ai-draw-fullscreen-enter')).toBeVisible();
    await page.getByTestId('ai-draw-fullscreen-enter').click();
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'true');
    await expectStageFillsViewport(page);
    await expectChatPaneVisibleInOverlay(page);
    await page.getByTestId('ai-draw-fullscreen-exit').click();
    await expect(page.getByTestId('ai-draw-stage')).toHaveAttribute('data-fullscreen', 'false');
    await expect(page.getByTestId('ai-draw-chat-panel')).toBeVisible();
  });
});

async function injectChatBubbles(page) {
  await page.getByTestId('ai-draw-chat-panel').evaluate((panel) => {
    const feed = panel.querySelector('.ts-ai-messages');
    if (!feed) throw new Error('missing .ts-ai-messages');
    feed.innerHTML = '';
    for (const [role, text] of [
      ['user', 'draw a yellow smiley face'],
      ['assistant', 'Drew a smiley face.'],
    ] as const) {
      const bubble = document.createElement('div');
      bubble.className = `ts-ai-bubble is-${role}`;
      bubble.dataset.testid = `ai-draw-bubble-${role}`;
      bubble.textContent = text;
      feed.appendChild(bubble);
    }
  });
}

/** Resolve computed colors to sRGB luminance inside the page (handles color-mix / color()). */
async function readBubbleLuminance(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');

    const luminanceOf = (cssColor: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const read = (role: string) => {
      const el = document.querySelector(`.ts-ai-bubble.is-${role}`) as HTMLElement | null;
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        fg: luminanceOf(s.color),
        bg: luminanceOf(s.backgroundColor),
        overflow: s.overflow,
        backgroundColor: s.backgroundColor,
        color: s.color,
      };
    };

    return {
      themeAttr: document.documentElement.getAttribute('data-theme'),
      user: read('user'),
      assistant: read('assistant'),
    };
  });
}

test.describe('AI Draw chat balloon theming', () => {
  test('bubble CSS uses resolved theme tokens (not data-theme-only dark forks)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const cssPath = path.resolve('src/styles/ai-draw-demo.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const bubbleBlock = css.slice(css.indexOf('.ts-ai-bubble'));
    expect(bubbleBlock).not.toMatch(/html\[data-theme=['"]dark['"]\]\s*\.ts-ai-bubble/);
    expect(bubbleBlock).not.toMatch(/color-mix\([^;{]*#ffffff/i);
    expect(css).toMatch(/prefers-color-scheme:\s*dark/);
    expect(bubbleBlock).toMatch(/--bg-secondary/);
    expect(bubbleBlock).toMatch(/overflow:\s*hidden/);
  });

  test('light, dark, and system→dark bubbles stay readable without white boxes', async ({
    page,
  }) => {
    await page.goto('/demo/ai-draw-demo.html');
    await expect(page.getByTestId('ai-draw-chat-panel')).toBeVisible();
    await injectChatBubbles(page);

    const assertReadable = async (label: string) => {
      const styles = await readBubbleLuminance(page);
      expect(styles.user, label).toBeTruthy();
      expect(styles.assistant, label).toBeTruthy();
      for (const role of ['user', 'assistant'] as const) {
        const bubble = styles[role]!;
        expect(Math.abs(bubble.fg - bubble.bg), `${label} ${role} contrast`).toBeGreaterThan(0.25);
        expect(bubble.overflow, `${label} ${role} overflow`).toBe('hidden');
      }
    };

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await assertReadable('light');
    const light = await readBubbleLuminance(page);
    expect(light.user!.bg).toBeGreaterThan(0.55);
    expect(light.user!.fg).toBeLessThan(0.45);

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await assertReadable('dark');
    const dark = await readBubbleLuminance(page);
    expect(dark.user!.bg).toBeLessThan(0.45);
    expect(dark.user!.fg).toBeGreaterThan(0.55);
    expect(dark.assistant!.bg).toBeLessThan(0.45);

    // System preference: DOM must still expose resolved light|dark (not absent).
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => {
      localStorage.setItem('vanduo-theme-preference', 'system');
      document.documentElement.removeAttribute('data-theme');
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await assertReadable('system-dark');
    const systemDark = await readBubbleLuminance(page);
    expect(systemDark.themeAttr).toBe('dark');
    expect(systemDark.themeAttr).not.toBe('system');
    expect(systemDark.user!.bg).toBeLessThan(0.45);
    expect(systemDark.user!.fg).toBeGreaterThan(0.55);
    expect(systemDark.assistant!.bg).toBeLessThan(0.45);
  });
});
