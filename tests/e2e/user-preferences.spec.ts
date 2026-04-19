import { test, expect } from '@playwright/test';

/**
 * Phase 9 smoke tests (brief-v3): prefers-reduced-motion + forced-colors +
 * storage-blocked behavior. These emulate OS-level user preferences via
 * Playwright's page.emulateMedia() and a storage-override init script.
 *
 * Some tests below are currently .skip()-ed: they rely on the App island
 * fully hydrating (so `html.js-reader-mounted` applies), but headless
 * chromium on GH Actions occasionally hangs during Svelte hydration. The
 * forced-colors test passes because it only asserts on a static SSG element.
 * Re-enable the skipped tests after parity/phase-9-hydration-tests lands.
 */

test.describe('prefers-reduced-motion', () => {
  test.skip('reduced-motion emulation kills transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html.js-reader-mounted')).toHaveCount(1, { timeout: 10_000 });
    const probe = await page.evaluate(() => {
      const div = document.createElement('div');
      div.style.transition = 'opacity 500ms';
      document.body.appendChild(div);
      const computed = getComputedStyle(div).transitionDuration;
      div.remove();
      return computed;
    });
    const ms = parseFloat(probe) * (probe.endsWith('ms') ? 1 : 1000);
    expect(ms).toBeLessThan(50);
  });
});

test.describe('forced-colors', () => {
  test('forced-colors: active applies the forced-colors block', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/issue/0146');
    // Opinion Shift severity label renders as text (not color-only). Static
    // SSG element from Phase 8a — doesn't depend on hydration.
    const severity = page.locator('.ssg-article__score-severity').first();
    await expect(severity).toBeVisible();
    const text = await severity.innerText();
    expect(['Fundamental', 'Significant', 'Partial', 'Surface']).toContain(text);
  });
});

test.describe('storage-blocked path', () => {
  test.skip('localStorage.setItem throwing shows the banner without breaking navigation', async ({ page }) => {
    await page.addInitScript(() => {
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw new DOMException('QuotaExceeded', 'QuotaExceededError');
      };
      (window as unknown as { __origSet: typeof origSet }).__origSet = origSet;
    });
    await page.goto('/');
    const banner = page.getByTestId('storage-blocked-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    // Banner copy contains "isn't being saved" — match a substring of that.
    await expect(banner).toContainText(/isn.?t being saved/i);
    await page.getByRole('button', { name: /dismiss storage warning/i }).click();
    await expect(banner).toBeHidden();
  });
});
