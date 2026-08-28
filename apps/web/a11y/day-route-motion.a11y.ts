import { expect, test } from '@playwright/test';

import { mountDayNavigation } from './day-navigation-test-support.ts';
import { scan } from './day-page-test-support.ts';

const writingSurface = (page: Parameters<typeof mountDayNavigation>[0]) =>
  page.locator('.route-entry');

const markWritingSurface = async (
  page: Parameters<typeof mountDayNavigation>[0],
): Promise<void> => {
  await writingSurface(page).evaluate((element) =>
    element.setAttribute('data-writing-surface', 'same'),
  );
};

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
  await expect(writingSurface(page)).toHaveAttribute(
    'data-writing-surface',
    'same',
  );
};

const followDayLink = async (
  page: Parameters<typeof mountDayNavigation>[0],
  name: 'Previous day' | 'Next day',
): Promise<void> => {
  const link = page.getByRole('link', { name });
  await link.focus();
  await page.keyboard.press('Enter');
};

test('Previous and Next preserve the writing surface and move focus', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await expect(page.locator('main')).not.toBeFocused();
  await markWritingSurface(page);

  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );
  await followDayLink(page, 'Next day');
  await expectDay(
    page,
    '/day/2026-08-25',
    'Tuesday, August 25, 2026 · Postlude',
    'Tuesday, August 25, 2026',
  );
  await followDayLink(page, 'Next day');
  await expectDay(page, '/', 'Today · Postlude', 'Wednesday, August 26, 2026');
  await scan(page);
});

test('browser Back and Forward preserve the settled writing surface', async ({
  page,
}) => {
  await mountDayNavigation(page);
  await markWritingSurface(page);
  await followDayLink(page, 'Previous day');
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );

  await page.goBack();
  await expectDay(
    page,
    '/day/2026-08-25',
    'Tuesday, August 25, 2026 · Postlude',
    'Tuesday, August 25, 2026',
  );

  await page.goForward();
  await expectDay(
    page,
    '/day/2026-08-24',
    'Monday, August 24, 2026 · Postlude',
    'Monday, August 24, 2026',
  );
  await expect(writingSurface(page)).toHaveAttribute(
    'data-writing-surface',
    'same',
  );
});
