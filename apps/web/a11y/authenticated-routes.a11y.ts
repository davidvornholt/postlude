import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import { expect, test } from '@playwright/test';
import { signInToRealJournal } from './authenticated-fixture';

const insightsPath = /\/insights$/u;
const loginPath = /\/login$/u;

for (const colorScheme of ['light', 'dark'] as const) {
  test(`real authenticated journal routes and sign-out preserve accessible navigation in ${colorScheme}`, async ({
    page,
  }) => {
    const cleanup = await signInToRealJournal(page);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(
        page.getByRole('button', { name: 'Sign out', exact: true }),
      ).toBeVisible();
      expect(await scanWcag22AaViolations(page)).toEqual([]);
      // The real root sets the icons' size and stroke, and they stay decorative.
      const icon = page
        .getByRole('link', { name: 'Previous day', exact: true })
        .locator('svg');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon).toHaveAttribute('stroke-width', '1.7');
      expect(await icon.boundingBox()).toMatchObject({ height: 20, width: 20 });
      const insights = page.getByRole('link', {
        name: 'Insights',
        exact: true,
      });
      await insights.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(insightsPath);
      await expect(page.getByRole('main')).toBeFocused();
      expect(await scanWcag22AaViolations(page)).toEqual([]);
      await expect(
        page.getByRole('navigation', { name: 'Insights range' }),
      ).toBeVisible();
      const today = page.getByRole('link', { name: 'Today', exact: true });
      await today.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('main')).toBeFocused();
      await page.getByRole('button', { name: 'Sign out', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(loginPath);
      await expect(page.getByRole('main')).toBeFocused();
      await expect(
        page.getByRole('button', { name: 'Sign in with GitHub', exact: true }),
      ).toBeVisible();
      expect(await scanWcag22AaViolations(page)).toEqual([]);
    } finally {
      await cleanup();
    }
  });
}
