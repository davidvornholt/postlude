import { expect, test } from '@playwright/test';

import {
  mountDatedDayPage,
  mountDayPage,
  mountUnhydratedDayPage,
  scan,
} from './day-page-test-support.ts';

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
