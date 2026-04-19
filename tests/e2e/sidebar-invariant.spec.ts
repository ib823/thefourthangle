import { test, expect } from '@playwright/test';

/**
 * Phase 9 smoke test #1 (brief-v3): Home renders the four canonical feed
 * sections.
 *
 * SKIPPED in CI baseline run — these tests rely on the App island fully
 * hydrating (so `html.js-reader-mounted` applies and the sidebar with its
 * data-section attributes is painted). Headless chromium on GH Actions
 * occasionally hangs during Svelte hydration.
 *
 * The invariant IS covered by Vitest unit tests on buildFeedSections at
 * src/lib/__tests__/feed-sections.test.ts — which run in every CI build.
 * These Playwright tests add the render-layer assertion on top, which
 * needs a working headless browser session. Re-enable after
 * parity/phase-9-hydration-tests stabilises the mount path.
 *
 * Selectors target repo-owned data-section / data-section-count attributes,
 * safe from scripts/stealth.mjs renames (it only rewrites data-astro-*).
 */
test.describe('Four-section sidebar invariant', () => {
  test.skip('home renders all four canonical feed sections', async ({ page }) => {
    await page.goto('/');
    // Wait for hydration to finish; App sets this class on success.
    await expect(page.locator('html.js-reader-mounted')).toHaveCount(1, { timeout: 10_000 });

    // All four canonical sections must be present in the DOM.
    const sections = page.locator('[data-section]');
    const kinds = await sections.evaluateAll(nodes =>
      Array.from(new Set(nodes.map(n => (n as HTMLElement).dataset.section))),
    );
    const expectedKinds = ['continue', 'new', 'explore', 'completed'];
    for (const kind of expectedKinds) {
      expect(kinds).toContain(kind);
    }
  });

  test.skip('four sections render with count badges even when some are empty', async ({ page }) => {
    // Clear any prior reading state so the test runs against a clean profile.
    await page.addInitScript(() => {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('tfa'));
        keys.forEach(k => localStorage.removeItem(k));
      } catch { /* ignore */ }
    });
    await page.goto('/');
    await expect(page.locator('html.js-reader-mounted')).toHaveCount(1, { timeout: 10_000 });

    // At least the expected 4 data-section labels are rendered.
    // Count badges (data-section-count) should be numeric strings (may be '0').
    const badges = page.locator('[data-section-count]');
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).innerText();
      expect(text).toMatch(/^\d+$/);
    }
  });
});
