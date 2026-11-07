import { expect, test } from '@playwright/test';

import {
  mountDatedDayPage,
  mountDayPage,
  mountUnhydratedDayPage,
  scan,
} from './day-page-test-support.ts';

const dayName = 'Wednesday, August 26, 2026';
const colorSchemes = ['light', 'dark'] as const;

type Page = Parameters<typeof scan>[0];

const openCalendar = async (page: Page) => {
  const trigger = page
    .getByRole('heading', { level: 1 })
    .getByRole('button', { name: dayName, exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const calendar = page.getByRole('dialog', { name: 'Choose a day' });
  await expect(calendar).toBeVisible();
  return { calendar, trigger };
};

for (const colorScheme of colorSchemes) {
  test(`the date opens a calendar that chooses a day by keyboard in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountDayPage(page, ['stored']);
    const { calendar } = await openCalendar(page);

    // Focus starts on the day in view, and the days with writing say so.
    await expect(
      calendar.getByRole('button', { name: dayName, exact: true }),
    ).toBeFocused();
    await expect(calendar.getByRole('gridcell', { selected: true })).toHaveText(
      '26',
    );
    await expect(
      calendar.getByRole('button', {
        name: 'Thursday, August 20, 2026, written',
      }),
    ).toBeVisible();
    // Today's own page has nowhere for "Go to today" to go, and it keeps its
    // place rather than moving the link beside it.
    await expect(
      calendar.getByRole('button', { name: 'Go to today' }),
    ).toBeHidden();
    await scan(page);

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect(
      calendar.getByRole('button', { name: 'Tuesday, August 18, 2026' }),
    ).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect(calendar.getByRole('heading')).toHaveText('September 2026');
    await expect(
      calendar.getByRole('button', { name: 'Friday, September 18, 2026' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(calendar).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute(
      'data-route',
      '/day/2026-09-18',
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
    await expect(
      page.getByRole('link', { name: 'Go to today', exact: true }),
    ).toHaveAttribute('href', '/');
    await scan(page);
  });
}

test('Escape closes the calendar and gives focus back to the date', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountDayPage(page, ['stored']);
  const { calendar, trigger } = await openCalendar(page);

  // The month's own buttons leave focus where it was pressed, and the arrow
  // keys there belong to the calendar rather than stepping the page's day.
  await calendar.getByRole('button', { name: 'Next month' }).click();
  await expect(calendar.getByRole('heading')).toHaveText('September 2026');
  await expect(
    calendar.getByRole('button', { name: 'Next month' }),
  ).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('html')).toHaveAttribute('data-route', '/');

  await page.keyboard.press('Escape');
  await expect(calendar).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('a press outside the calendar closes it without moving the day', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountDayPage(page, ['stored']);
  const { calendar } = await openCalendar(page);

  // Pressing into the writing is the usual way out, and it keeps that press.
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.click();
  await expect(calendar).toBeHidden();
  await expect(evening).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-route', '/');
});

test('on another day the calendar offers the way back to today', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mountDatedDayPage(page);
  await page
    .getByRole('button', { name: 'Tuesday, August 25, 2026', exact: true })
    .click();
  const calendar = page.getByRole('dialog', { name: 'Choose a day' });

  await calendar.getByRole('button', { name: 'Go to today' }).click();
  await expect(calendar).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-route', '/');
});

test('before the page hydrates the date is a link to the calendar', async ({
  page,
}) => {
  await mountUnhydratedDayPage(page);

  await expect(
    page.getByRole('link', { name: dayName, exact: true }),
  ).toHaveAttribute('href', '/calendar?month=2026-08&day=2026-08-26');
  await scan(page);
});

const arrowAlignment = (page: Page) =>
  page.evaluate(() => {
    const date = document.querySelector('h1 button');
    const arrow = document.querySelector('a[data-focus-key="previous-day"]');
    if (date === null || arrow === null) {
      return;
    }
    const line = Number.parseFloat(getComputedStyle(date).lineHeight);
    const dateBox = date.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    return {
      lines: Math.round(dateBox.height / line),
      offset: arrowBox.top + arrowBox.height / 2 - (dateBox.top + line / 2),
    };
  });

test('the arrows sit on the first line of the date, however many it takes', async ({
  page,
}) => {
  await mountDayPage(page, ['stored']);
  // A wide window keeps the date on one line, a narrower one wraps it. Below
  // these widths the arrows move up to the line above the date.
  for (const [width, lines] of [
    [1280, 1],
    [700, 2],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(() => arrowAlignment(page)).toMatchObject({ lines });
    const { offset } = (await arrowAlignment(page)) ?? { offset: Number.NaN };
    expect(Math.abs(offset)).toBeLessThan(1);
  }
});
