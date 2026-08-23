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
  { name: 'Not found', path: '/this-page-does-not-exist' },
] as const;

/**
 * The theme ships a full `prefers-color-scheme: dark` palette, and Playwright
 * would otherwise only ever render the light one, leaving half the tokens
 * unscanned.
 */
const colorSchemes = ['light', 'dark'] as const;

for (const route of routes) {
  for (const colorScheme of colorSchemes) {
    test(`${route.name} has no automated WCAG 2.2 AA violations in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(route.path);

      await expect(page.locator('main')).toBeVisible();
      expect(await scanWcag22AaViolations(page)).toEqual([]);
    });
  }
}
