import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:8790',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Chromium Desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'Chromium Mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `python3 -m http.server 8790 --directory "${projectRoot}" >/dev/null 2>&1`
      : `python3 -m http.server 8790 --directory "${projectRoot}"`,
    url: 'http://localhost:8790',
    reuseExistingServer: !process.env.CI,
    timeout: 20 * 1000,
  },
});
