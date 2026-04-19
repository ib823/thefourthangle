import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 9 CI matrix per brief-v3. Three engines × three viewports.
 * Uses Astro's preview server for the built /dist output rather than the
 * dev server — we're asserting against production HTML, not hot-reload
 * artefacts. The stealth script runs before tests, so selectors must
 * target ARIA roles, text content, or repo-owned data-* attributes.
 * Never target class names or framework tag names.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'list',

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npx http-server dist -p 4321 --silent',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  projects: [
    // ── Chromium engine at 3 viewports ──
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
    {
      name: 'chromium-tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 820, height: 1180 },
        userAgent: devices['Desktop Chrome'].userAgent,
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: false,
      },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    // ── Firefox engine ──
    {
      name: 'firefox-mobile',
      use: {
        browserName: 'firefox',
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
      },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    // ── WebKit engine ──
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
