import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';

/**
 * Only the unauthenticated surface is scannable: sign-in runs exclusively
 * through GitHub OAuth, so there is (yet) no way to reach the signed-in pages
 * in the test. "/" is listed anyway because the redirect to /login should be
 * covered too.
 */
const routes = [
  { name: 'Sign in', path: '/login' },
  { name: 'Home (redirects to /login)', path: '/' },
] as const;

for (const route of routes) {
  test(`${route.name} has no automated WCAG 2.2 AA violations`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route.path);

    await expect(page.locator('main')).toBeVisible();
    expect(await scanWcag22AaViolations(page)).toEqual([]);
  });
}
