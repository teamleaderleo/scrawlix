import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'pnpm --filter scrawlix-demo exec vite preview --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node tests/browser/fixture-server.mjs',
      url: 'http://127.0.0.1:4174/fixture.html',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
