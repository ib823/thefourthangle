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
  // Shorter per-test wall-clock — most of our tests are DOM assertions or
  // raw HTML fetches that should complete in seconds. A hang here is a bug
  // to surface, not something to retry around.
  timeout: 20_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No CI retries — retry-masked green hides real flakes. A flake gets a
  // specific fix in a follow-up PR, not a blanket retry.
  retries: 0,
  // GH Actions ubuntu-latest has 4 cores; 2 parallel browsers keeps headroom
  // for the Svelte hydration + http-server process. Locally, use defaults.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'list',

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // --disable-dev-shm-usage is the canonical Chromium-in-Docker fix.
    // GH Actions ubuntu-latest runs Chromium inside a container with a
    // tiny default /dev/shm; without this flag, pages that exceed the
    // default ~64 MB shared-memory budget crash silently mid-load. See
    // https://playwright.dev/docs/ci#docker
    launchOptions: {
      args: ['--disable-dev-shm-usage'],
    },
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
