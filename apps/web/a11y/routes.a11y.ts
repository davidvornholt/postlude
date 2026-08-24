import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';

/**
 * Only the unauthenticated surface is scannable: sign-in runs exclusively
 * through GitHub OAuth, so there is (yet) no way to reach the signed-in pages
 * in the test. "/" is listed anyway because the redirect to /login should be
 * covered too.
 *
 * Every route carries the status, the landing path, and the heading that
 * identify it, because a scan of the wrong page still passes. "/" lands on
 * /login, and only asserting that proves the redirect ran rather than quietly
 * scanning the sign-in page twice. The not-found path in particular has to
 * prove it reached the themed not-found page with an HTTP 404 rather than some
 * other page the server happened to answer with.
 *
 * The design-comparison pages under /heirloom and /warm-print are public on
 * purpose: they are the candidate designs for the writing and archive pages,
 * kept out of the signed-in tree so they can be looked at without an account.
 * They are scanned like anything else, because a design is not a candidate
 * until it passes.
 */
const routes = [
  {
    name: 'Sign in',
    path: '/login',
    landsOn: '/login',
    status: 200,
    heading: 'Postlude',
  },
  {
    name: 'Home (redirects to /login)',
    path: '/',
    landsOn: '/login',
    status: 200,
    heading: 'Postlude',
  },
  {
    name: 'Not found',
    path: '/this-page-does-not-exist',
    landsOn: '/this-page-does-not-exist',
    status: 404,
    heading: 'Page not found',
  },
  {
    name: 'Heirloom writing page',
    path: '/heirloom',
    landsOn: '/heirloom',
    status: 200,
    heading: 'Saturday evening 22 August 2026',
  },
  {
    name: 'Heirloom archive',
    path: '/heirloom/archive',
    landsOn: '/heirloom/archive',
    status: 200,
    heading: 'Archive',
  },
  {
    name: 'Warm print writing page',
    path: '/warm-print',
    landsOn: '/warm-print',
    status: 200,
    heading: 'Saturday evening 22 August 2026',
  },
  {
    name: 'Warm print archive',
    path: '/warm-print/archive',
    landsOn: '/warm-print/archive',
    status: 200,
    heading: 'Archive',
  },
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
      const response = await page.goto(route.path);

      expect(response?.status()).toBe(route.status);
      expect(new URL(page.url()).pathname).toBe(route.landsOn);
      await expect(
        page.getByRole('heading', { level: 1, name: route.heading }),
      ).toBeVisible();
      // A page gets exactly one main landmark. Duplicate-landmark rules are
      // axe best-practice rather than WCAG, so the scan below cannot see a
      // second one.
      await expect(page.locator('main')).toHaveCount(1);
      expect(await scanWcag22AaViolations(page)).toEqual([]);
    });
  }
}
