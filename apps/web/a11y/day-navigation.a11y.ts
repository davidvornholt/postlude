import { expect, test } from '@playwright/test';

import { mountDayNavigation } from './day-navigation-test-support.ts';
import { scan } from './day-page-test-support.ts';

const expectDay = async (
  page: Parameters<typeof mountDayNavigation>[0],
  path: string,
  title: string,
  heading: string,
): Promise<void> => {
  await expect(page).toHaveURL(
    new RegExp(`${path.replaceAll('/', '\\/')}$`, 'u'),
  );
  await expect(page).toHaveTitle(title);
  await expect(
    page.getByRole('heading', { level: 1, name: heading }),
  ).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
};

const followDayLink = async (
  page: Parameters<typeof mountDayNavigation>[0],
  name: 'Previous day' | 'Next day',
): Promise<void> => {
  const link = page.getByRole('link', { name });
  await link.focus();
  await page.keyboard.press('Enter');
};

test('Previous and Next move focus with the real client page', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await expect(page.locator('main')).not.toBeFocused();

  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, 24 August 2026 · Postlude',
    'Monday, 24 August 2026',
  );

  await followDayLink(page, 'Next day');
  await expectDay(
    page,
    '/day/2026-08-25',
    'Tuesday, 25 August 2026 · Postlude',
    'Tuesday, 25 August 2026',
  );

  await followDayLink(page, 'Next day');
  await expectDay(page, '/', 'Today · Postlude', 'Wednesday, 26 August 2026');
  await scan(page);
});
