import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';

import { heatmapDayCount } from '#/features/design-comparison/archive-data.ts';

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
const activityName = /Journal activity from August 2025 to August 2026/u;
const monthlyDescription =
  /Monthly breakdown\. August 2025: \d+ of 15 days written, [\d,]+ words\..*August 2026: \d+ of 22 days written, [\d,]+ words\./u;
const activityLevelNames = [
  'No entry',
  'Lowest quarter',
  'Lower-middle quarter',
  'Upper-middle quarter',
  'Highest quarter',
] as const;

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

const archiveRoutes = [
  { name: 'Heirloom archive', path: '/heirloom/archive' },
  { name: 'Warm print archive', path: '/warm-print/archive' },
] as const;

for (const archive of archiveRoutes) {
  for (const colorScheme of colorSchemes) {
    test(`${archive.name} exposes daily activity in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(archive.path);
      const activity = page.getByRole('img', { name: activityName });
      const disclosure = page.getByText('Daily activity details', {
        exact: true,
      });
      const table = page.getByRole('table', {
        name: 'Daily journal activity',
      });

      await expect(activity).toHaveAccessibleDescription(monthlyDescription);
      await expect(table).not.toBeVisible();
      await disclosure.press('Enter');
      await expect(table).toBeVisible();
      const bodyRows = table.locator('tbody tr');
      await expect(bodyRows).toHaveCount(heatmapDayCount);
      await expect(bodyRows.first()).toHaveAccessibleName(
        '2025-08-17 Lowest quarter 140',
      );
      await expect(bodyRows.last()).toHaveAccessibleName(
        '2026-08-22 Lowest quarter 254',
      );
      await expect(
        table.getByRole('row', {
          name: '2025-08-22 No entry 0',
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(
        table.getByRole('row', {
          name: '2025-08-23 Upper-middle quarter 672',
          exact: true,
        }),
      ).toHaveCount(1);
      const levelCounts = await Promise.all(
        activityLevelNames.map((level) =>
          table.getByRole('row', { name: new RegExp(level, 'u') }).count(),
        ),
      );
      for (const count of levelCounts) {
        expect(count).toBeGreaterThan(0);
      }
      expect(await scanWcag22AaViolations(page)).toEqual([]);
    });
  }
}
