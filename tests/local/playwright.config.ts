import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Local-only Gemma WebGPU drawing requests (macOS arm64 / RUN_AI_DRAW_INFERENCE=1).
 * Not part of `pnpm test` — Linux CI must not download models or require WebGPU.
 */
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: 45 * 60 * 1000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:8790',
    headless: process.env.AI_DRAW_HEADED !== '1',
    trace: 'off',
    video: 'off',
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu',
        '--enable-features=Vulkan,UseSkiaRenderer',
        '--ignore-gpu-blocklist',
        '--use-angle=metal',
      ],
    },
  },
  webServer: {
    command: process.env.CI
      ? `pnpm exec vite --host 127.0.0.1 --port 8790 --strictPort >/dev/null 2>&1`
      : `pnpm exec vite --host 127.0.0.1 --port 8790 --strictPort`,
    cwd: projectRoot,
    url: 'http://127.0.0.1:8790',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
