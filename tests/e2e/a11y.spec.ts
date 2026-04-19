import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Phase 9 smoke test #3 (brief-v3): @axe-core/playwright on every project ×
 * viewport. Fails on serious + critical violations. Known-acknowledged
 * baseline entries (if any) would live in a `baseline.json` file here with
 * an ADR entry explaining why; none are currently tolerated.
 */
test.describe('Automated accessibility', () => {
  test('home page has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html.js-reader-mounted')).toHaveCount(1, { timeout: 10_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    if (blocking.length) {
      console.error('axe violations:', JSON.stringify(blocking, null, 2));
    }
    expect(blocking).toEqual([]);
  });

  test('/issue/0146 has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/issue/0146');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    if (blocking.length) {
      console.error('axe violations:', JSON.stringify(blocking, null, 2));
    }
    expect(blocking).toEqual([]);
  });
});
