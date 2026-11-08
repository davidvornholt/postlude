import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const calendarUrl = /\/calendar(?:\?.*)?$/u;
const currentCalendarDay = /day=2026-08-19/u;
const currentCalendarMonth = /month=2026-08/u;
const nextCalendarMonth = /\/calendar\?month=2026-09$/u;
const selectedCalendarDay = /Wednesday, August 19, 2026, entry available/u;

test('Calendar keeps selected days and months in browser history', async ({
  page,
}) => {
  await mountArchiveNavigation(page);
  await page.getByRole('link', { name: 'Calendar' }).click();

  await expect(page).toHaveURL(calendarUrl);
  await expect(
    page.getByRole('heading', { name: 'August 2026' }),
  ).toBeVisible();
  await expect(page.locator('main')).toBeFocused();

  await page.getByRole('link', { name: selectedCalendarDay }).click();
  await expect(page).toHaveURL(currentCalendarDay);
  await expect(page).toHaveURL(currentCalendarMonth);
  await expect(
    page.getByRole('heading', { name: 'Wednesday, August 19, 2026' }),
  ).toBeVisible();
  await expect(page.getByText('A selected calendar memory.')).toBeVisible();

  await page.getByRole('link', { name: 'Next month' }).click();
  await expect(page).toHaveURL(nextCalendarMonth);
  await expect(
    page.getByRole('heading', { name: 'September 2026' }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(currentCalendarDay);
  await expect(
    page.getByRole('heading', { name: 'Wednesday, August 19, 2026' }),
  ).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(nextCalendarMonth);
  await expect(
    page.getByRole('heading', { name: 'September 2026' }),
  ).toBeVisible();
});

/*
 * "August 2026" and "September 2026" are names of different widths, and the
 * steps must not move with them: a reader stepping through the months keeps
 * the pointer where it is. Both widths are checked, because the heading wraps
 * differently on a phone.
 */
for (const width of [1280, 390]) {
  test(`Calendar month steps stay put across month names at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width });
    await mountArchiveNavigation(page);
    await page.getByRole('link', { name: 'Calendar' }).click();
    await expect(
      page.getByRole('heading', { name: 'August 2026' }),
    ).toBeVisible();

    const previous = page.getByRole('link', { name: 'Previous month' });
    const next = page.getByRole('link', { name: 'Next month' });
    const before = [await previous.boundingBox(), await next.boundingBox()];
    await next.click();
    await expect(page).toHaveURL(nextCalendarMonth);
    await expect(
      page.getByRole('heading', { name: 'September 2026' }),
    ).toBeVisible();

    expect([await previous.boundingBox(), await next.boundingBox()]).toEqual(
      before,
    );
  });
}
