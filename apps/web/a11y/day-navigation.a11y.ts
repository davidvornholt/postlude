import { expect, test } from '@playwright/test';

import { mountDayNavigation } from './day-navigation-test-support.ts';
import {
  mountDatedDayPage,
  mountDayPage,
  mountUnhydratedDayPage,
  scan,
} from './day-page-test-support.ts';

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

const dayFieldName = 'Wednesday, August 26, 2026. Go to another day.';
const nativeDayUrl = /\/day\?date=2026-08-25$/u;
const colorSchemes = ['light', 'dark'] as const;

const editDaySegmentBack = async (page: Parameters<typeof scan>[0]) => {
  const field = page.getByLabel(dayFieldName);
  await expect(field).toHaveValue('2026-08-26');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(field).toHaveValue('2026-08-25');
};

for (const colorScheme of colorSchemes) {
  test(`the hydrated date field moves only after keyboard submit in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['stored']);
    const field = page.getByLabel(dayFieldName);
    const heading = page.getByRole('heading', {
      name: 'Wednesday, August 26, 2026',
    });

    await expect(heading).toBeVisible();
    expect(
      await field.evaluate((element) => element.getBoundingClientRect().width),
    ).toBeLessThanOrEqual(1);
    await page.keyboard.press('Tab');
    await expect(field).toBeFocused();
    expect(
      await heading.evaluate(
        (element) => element.getBoundingClientRect().width,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      await field.evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThan(1);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');
    await expect(field).toHaveValue('2026-08-27');
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-route', '/');
    await field.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveValue('2026-08-25');
    await scan(page);
    await field.press('Enter');
    await expect(page.locator('html')).toHaveAttribute(
      'data-route',
      '/day/2026-08-25',
    );
  });

  test(`nearby day links keep their exact destinations in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDatedDayPage(page);

    await expect(
      page.getByRole('link', { name: 'Previous day' }),
    ).toHaveAttribute('href', '/day/2026-08-24');
    await expect(page.getByRole('link', { name: 'Next day' })).toHaveAttribute(
      'href',
      '/',
    );
    await scan(page);
  });

  test(`the visible heading opens the native no-script form in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.route('**/day?date=2026-08-25', (route) =>
      route.fulfill({
        body: '<!doctype html><title>Opened day</title><p>Native day opened</p>',
        contentType: 'text/html',
      }),
    );
    await mountUnhydratedDayPage(page);
    const field = page.getByLabel(dayFieldName);
    const heading = page.getByRole('heading', {
      name: 'Wednesday, August 26, 2026',
    });

    await expect(heading).toBeVisible();
    await heading.click();
    await expect(field).toBeFocused();
    await expect(field).toBeVisible();
    await editDaySegmentBack(page);
    await scan(page);
    await page.getByRole('button', { name: 'Open' }).click();

    await expect(page).toHaveURL(nativeDayUrl);
    await expect(page.getByText('Native day opened')).toBeVisible();
  });
}
