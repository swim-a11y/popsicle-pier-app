import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'npm run build && npm run start', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
});
