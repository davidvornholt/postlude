import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const calendarUrl = /\/calendar(?:\?.*)?$/u;
const currentCalendarDay = /day=2026-08-19/u;
const currentCalendarMonth = /month=2026-08/u;
const nextCalendarMonth = /\/calendar\?month=2026-09$/u;
const onThisDayUrl = /\/on-this-day(?:\?.*)?$/u;
const selectedCalendarDay = /2026-08-19, entry available/u;
const previousOnThisDay = /date=2026-08-25/u;
const onThisDayToday = /\/on-this-day$/u;

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

test('On this day keeps adjacent dates and browser history in sync', async ({
  page,
}) => {
  await mountArchiveNavigation(page);
  await page.getByRole('link', { name: 'On this day' }).click();

  await expect(page).toHaveURL(onThisDayUrl);
  await expect(
    page.getByRole('heading', { name: 'Wednesday, August 26, 2026' }),
  ).toBeVisible();
  await expect(page.locator('main')).toBeFocused();

  await page.getByRole('link', { name: 'Previous date' }).click();
  await expect(page).toHaveURL(previousOnThisDay);
  await expect(
    page.getByRole('heading', { name: 'Tuesday, August 25, 2026' }),
  ).toBeVisible();
  await expect(page.getByText('A memory from this date.')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(onThisDayToday);
  await expect(
    page.getByRole('heading', { name: 'Wednesday, August 26, 2026' }),
  ).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(previousOnThisDay);
  await expect(
    page.getByRole('heading', { name: 'Tuesday, August 25, 2026' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Next date' }).click();
  await expect(page).toHaveURL(onThisDayToday);
  await expect(
    page.getByRole('heading', { name: 'Wednesday, August 26, 2026' }),
  ).toBeVisible();
});
