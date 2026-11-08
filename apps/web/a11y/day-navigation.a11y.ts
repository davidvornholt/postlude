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

// The widest date there is, measured in Fraunces across the years around now.
// The fixture's own date is a Wednesday too, the longest weekday.
const widestCalendarDate = 'September 20, 2028';

const dateLayout = (page: Page) =>
  page.evaluate((widest) => {
    const date = document.querySelector('h1 button');
    const [weekday, calendarDate] = date?.children ?? [];
    const arrow = document.querySelector('a[data-focus-key="previous-day"]');
    const text = calendarDate?.firstChild;
    if (
      date === null ||
      weekday === undefined ||
      calendarDate === undefined ||
      arrow === null ||
      text === null ||
      text === undefined
    ) {
      return;
    }
    text.textContent = widest;
    const line = Number.parseFloat(getComputedStyle(date).lineHeight);
    const dateBox = date.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    const heading = date.parentElement?.getBoundingClientRect();
    return {
      lines: Math.round(dateBox.height / line),
      weekdayAlone:
        weekday.getBoundingClientRect().bottom <=
        calendarDate.getBoundingClientRect().top + 1,
      // Inside its heading, and clear of the arrows when they share a row.
      fits:
        heading !== undefined &&
        dateBox.right <= heading.right + 0.5 &&
        (arrowBox.bottom <= dateBox.top || dateBox.right <= arrowBox.left),
      offset: arrowBox.top + arrowBox.height / 2 - (dateBox.top + line / 2),
    };
  }, widestCalendarDate);

test('the widest date keeps to one line beside the arrows from a tablet up', async ({
  page,
}) => {
  await mountDayPage(page, ['stored']);
  for (const width of [2000, 1280, 1024, 768]) {
    await page.setViewportSize({ width, height: 800 });
    const layout = await dateLayout(page);
    expect(layout, `at ${width}px`).toMatchObject({ lines: 1, fits: true });
    expect(Math.abs(layout?.offset ?? Number.NaN)).toBeLessThan(1);
  }
});

test('on a phone the date breaks after the weekday and nowhere else', async ({
  page,
}) => {
  await mountDayPage(page, ['stored']);
  for (const width of [767, 430, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await dateLayout(page), `at ${width}px`).toMatchObject({
      lines: 2,
      weekdayAlone: true,
      fits: true,
    });
  }
});
