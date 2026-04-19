import { test, expect } from '@playwright/test';

/**
 * Phase 9 smoke test #2 (brief-v3): /issue/[id] first HTML contains headline,
 * deck, hero <img>, Opinion Shift score — verified via raw HTML fetch, not
 * post-hydration DOM. This is the gating test for Phase 8a's correctness fix:
 * a JS-disabled / webview / slow-3G reader must see the full article.
 */
test.describe('SSG article raw-HTML content', () => {
  test('/issue/0146 raw HTML contains the full article', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/issue/0146`);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();

    // <article> landmark present
    expect(html).toMatch(/<article\b[^>]*class="ssg-article"/);
    // <h1> contains the real issue headline
    expect(html).toMatch(/<h1[^>]*id="ssg-headline"/);
    // Hero image src references the correct issue
    expect(html).toMatch(/og\/issue-0146-\d+w\.(avif|webp|jpg)/);
    // Opinion Shift numeric score baked in
    expect(html).toMatch(/data-score="\d+"/);
    // All 7 cards present as <section data-card-index="N">
    const cardMatches = [...html.matchAll(/data-card-index="\d+"/g)];
    expect(cardMatches.length).toBe(7);
    // <time datetime> present for the sourceDate
    expect(html).toMatch(/<time datetime="\d{4}-\d{2}-\d{2}"/);
  });

  test.skip('/issue/0146 contains the static article element after navigation', async ({ page }) => {
    // SKIPPED per decision recorded in follow-up PR — headless chromium
    // on GH Actions doesn't reliably parse /issue/0146 to the point where
    // toBeAttached sees the static <article> in the DOM. Even with
    // waitUntil: 'domcontentloaded' and --disable-dev-shm-usage the test
    // times out. The companion request-based test above already proves
    // the static HTML IS correct — this test duplicates that coverage
    // via a browser render that the CI runner can't handle for the
    // image-heavy /issue/0146 page. Re-enable once the smoke runner
    // migrates to full Chrome or Firefox (tracked as parity/phase-9-
    // browser-render-tests).
    await page.goto('/issue/0146', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('article.ssg-article')).toBeAttached();
    await expect(page.locator('#ssg-headline')).toBeAttached();
  });
});
