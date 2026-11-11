import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  globalTeardown: './e2e-teardown.ts',
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
      },
    },
  ],
  webServer: [
    {
      command: 'node node_modules/tsx/dist/cli.mjs scripts/e2e-server.ts',
      cwd: '../backend',
      url: 'http://127.0.0.1:4001/api/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host localhost --config vite.e2e.config.ts',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
