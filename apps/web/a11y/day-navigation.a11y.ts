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

type Page = Parameters<typeof scan>[0];

// On desktop the arrow keys step the focused segment of a native date field.
// Under mobile emulation Chromium draws the field as one control that opens the
// system picker, with no segments to step, so there the reader's pick in that
// picker is stood in for by filling the value.
const changeDay = async (
  page: Page,
  {
    isMobile,
    keys,
    to,
  }: {
    readonly isMobile: boolean;
    readonly keys: ReadonlyArray<string>;
    readonly to: string;
  },
): Promise<void> => {
  const field = page.getByLabel(dayFieldName);
  if (isMobile) {
    await field.fill(to);
  } else {
    for (const key of keys) {
      await page.keyboard.press(key);
    }
  }
  await expect(field).toHaveValue(to);
};

const editDaySegmentBack = async (page: Page, isMobile: boolean) => {
  await expect(page.getByLabel(dayFieldName)).toHaveValue('2026-08-26');
  await changeDay(page, {
    isMobile,
    keys: ['ArrowRight', 'ArrowDown'],
    to: '2026-08-25',
  });
};

for (const colorScheme of colorSchemes) {
  test(`the hydrated date field moves only after keyboard submit in ${colorScheme} mode`, async ({
    isMobile,
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

    await changeDay(page, {
      isMobile,
      keys: ['ArrowRight', 'ArrowUp'],
      to: '2026-08-27',
    });
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-route',
      '/day/2026-08-27',
    );
    await field.focus();
    await changeDay(page, {
      isMobile,
      keys: ['ArrowRight', 'ArrowDown', 'ArrowDown'],
      to: '2026-08-25',
    });
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
    isMobile,
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
    await editDaySegmentBack(page, isMobile);
    await scan(page);
    await page.getByRole('button', { name: 'Open' }).click();

    await expect(page).toHaveURL(nativeDayUrl);
    await expect(page.getByText('Native day opened')).toBeVisible();
  });
}

test('pressing the date heading opens the browser date picker', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountDayPage(page, ['stored']);
  const field = page.getByLabel(dayFieldName);
  const pickerOpen = () =>
    field.evaluate((element) => element.matches(':open'));

  await page
    .getByRole('heading', { name: 'Wednesday, August 26, 2026' })
    .click();
  await expect(field).toBeFocused();
  await expect.poll(pickerOpen).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(pickerOpen).toBe(false);
  await expect(field).toBeFocused();
  await scan(page);
});
