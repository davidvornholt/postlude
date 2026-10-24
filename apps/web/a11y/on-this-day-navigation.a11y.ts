import { scanWcag22AaViolations } from '@davidvornholt/a11y-testing/axe';
import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const christmasEveUrl = /\/on-this-day\?date=2026-12-24$/u;
const lastStepUrl = /\/on-this-day\?date=2026-12-31$/u;
const onThisDayToday = /\/on-this-day$/u;
const previousDateUrl = /\/on-this-day\?date=2026-08-25$/u;
const yearEndEveUrl = /\/on-this-day\?date=2026-12-30$/u;

const openOnThisDay = async (page: playwright.Page): Promise<void> => {
  await mountArchiveNavigation(page);
  await page.getByRole('link', { name: 'On this day' }).click();
  await expect(page).toHaveURL(onThisDayToday);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Wednesday, August 26, 2026',
    }),
  ).toBeVisible();
};

const dateField = (page: playwright.Page, label: string) =>
  page.getByLabel(`${label}. Go to another date.`);

const isPickerOpen = (page: playwright.Page, label: string): Promise<boolean> =>
  dateField(page, label).evaluate((element) => element.matches(':open'));

const nearbyDates = (page: playwright.Page) =>
  page.getByRole('navigation', { name: 'Nearby retrospective dates' });

test('On this day opens a chosen date from its heading and keeps focus in the page', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openOnThisDay(page);
  const today = 'Wednesday, August 26, 2026';
  const field = dateField(page, today);
  await expect(field).toHaveAttribute('min', '2026-01-01');
  await expect(field).toHaveAttribute('max', '2026-12-31');

  await page.getByRole('heading', { level: 1, name: today }).click();
  await expect(field).toBeFocused();
  await expect.poll(() => isPickerOpen(page, today)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => isPickerOpen(page, today)).toBe(false);
  await expect(field).toBeFocused();

  await field.fill('2026-12-24');
  await field.press('Enter');
  await expect(page).toHaveURL(christmasEveUrl);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Thursday, December 24, 2026',
    }),
  ).toBeVisible();
  await expect(page.getByText('A memory from this date.')).toBeVisible();
  // The field the date was typed into re-keys on the new date, so focus has
  // to land somewhere on purpose rather than fall back to the document.
  await expect(page.locator('main')).toBeFocused();
  await expect(dateField(page, 'Thursday, December 24, 2026')).toHaveValue(
    '2026-12-24',
  );
  expect(await scanWcag22AaViolations(page)).toEqual([]);

  const back = nearbyDates(page).getByRole('link', { name: 'Today' });
  await expect(back).not.toHaveAttribute('aria-current');
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(onThisDayToday);
  await expect(
    page.getByRole('heading', { level: 1, name: today }),
  ).toBeVisible();
  await expect(page.locator('main')).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(christmasEveUrl);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Thursday, December 24, 2026',
    }),
  ).toBeVisible();
});

test('On this day steps in place and says which date it reached', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openOnThisDay(page);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveAttribute('aria-live', 'polite');

  const previous = nearbyDates(page).getByRole('link', {
    name: 'Previous date',
  });
  await previous.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(previousDateUrl);
  await expect(heading).toHaveText('Tuesday, August 25, 2026');
  await expect(previous).toBeFocused();
  await expect(
    nearbyDates(page).getByRole('link', { name: 'Next date' }),
  ).not.toHaveAttribute('aria-current');

  const field = dateField(page, 'Tuesday, August 25, 2026');
  await field.focus();
  await field.fill('2026-12-30');
  await field.press('Enter');
  await expect(page).toHaveURL(yearEndEveUrl);

  // The last step of the year takes its own link away with it.
  const next = nearbyDates(page).getByRole('link', { name: 'Next date' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(lastStepUrl);
  await expect(heading).toHaveText('Thursday, December 31, 2026');
  await expect(next).toHaveCount(0);
  await expect(page.locator('main')).toBeFocused();
});
