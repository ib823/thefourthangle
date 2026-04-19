import { test, expect } from '@playwright/test';

/**
 * Phase 9 smoke tests (brief-v3): prefers-reduced-motion + forced-colors +
 * storage-blocked behavior. These emulate OS-level user preferences via
 * Playwright's page.emulateMedia() and a storage-override init script.
 */

test.describe('prefers-reduced-motion', () => {
  test('reduced-motion emulation kills transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html.js-reader-mounted')).toHaveCount(1, { timeout: 10_000 });
    // CSS global rule drops every animation-duration + transition-duration
    // to ~0ms. We can't assert computed duration="0s" directly (browser may
    // still report the original value), so instead verify that at least
    // one marked-animated element exists in the DOM and that reduced-motion
    // CSS is applied via a synthetic probe.
    const probe = await page.evaluate(() => {
      const div = document.createElement('div');
      div.style.transition = 'opacity 500ms';
      document.body.appendChild(div);
      const computed = getComputedStyle(div).transitionDuration;
      div.remove();
      return computed;
    });
    // When the reduced-motion CSS rule (!important) matches, it overrides
    // to 0.01ms — anything under 50ms signals the rule is active.
    const ms = parseFloat(probe) * (probe.endsWith('ms') ? 1 : 1000);
    expect(ms).toBeLessThan(50);
  });
});

test.describe('forced-colors', () => {
  test('forced-colors: active applies the forced-colors block', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/issue/0146');
    // Opinion Shift severity label renders as text (not color-only).
    const severity = page.locator('.ssg-article__score-severity').first();
    await expect(severity).toBeVisible();
    const text = await severity.innerText();
    expect(['Fundamental', 'Significant', 'Partial', 'Surface']).toContain(text);
  });
});

test.describe('storage-blocked path', () => {
  test('localStorage.setItem throwing shows the banner without breaking navigation', async ({ page }) => {
    await page.addInitScript(() => {
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw new DOMException('QuotaExceeded', 'QuotaExceededError');
      };
      // Leave getItem/removeItem intact so existing keys can still be read.
      (window as unknown as { __origSet: typeof origSet }).__origSet = origSet;
    });
    await page.goto('/');
    // The banner mounts after hydration.
    const banner = page.getByTestId('storage-blocked-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(/not being saved/i);

    // Dismiss button still works.
    await page.getByRole('button', { name: /dismiss storage warning/i }).click();
    await expect(banner).toBeHidden();
  });
});
