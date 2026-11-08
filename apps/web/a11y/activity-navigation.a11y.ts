import { expect, test } from '@playwright/test';

import { mountInsightsNavigation } from './insights-navigation-test-support.ts';

const writingDayUrl = /\/$/u;
const thisWeekUrl = /\/insights\?range=week$/u;
const previousWeekUrl = /\/insights\?range=week&week=2026-08-17$/u;

const expectWritingDay = async (
  page: Parameters<typeof mountInsightsNavigation>[0],
): Promise<void> => {
  await expect(page).toHaveURL(writingDayUrl);
  await expect(
    page.getByRole('heading', { name: 'Wednesday, August 26, 2026' }),
  ).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
};

test('activity squares open their day with a pointer or the keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mountInsightsNavigation(page);
  await page
    .getByRole('textbox', { name: 'Evening journal' })
    .fill('Open this day from Insights.');
  await page.getByRole('link', { name: 'Insights' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Insights: 2026' }),
  ).toBeVisible();

  const targets = page.locator('[data-activity-date]');
  const targetSizes = await targets.evaluateAll((elements) =>
    elements.map((element) => {
      const { height, width } = element.getBoundingClientRect();
      return { height, width };
    }),
  );
  expect(targetSizes.length).toBeGreaterThan(0);
  expect(
    targetSizes.every(({ height, width }) => height >= 24 && width >= 24),
  ).toBe(true);

  await page.locator('[data-activity-date="2026-08-26"]').click();
  await expectWritingDay(page);

  await page.goBack();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Insights: 2026' }),
  ).toBeVisible();
  const activity = page.getByRole('region', {
    name: 'Journal activity grid',
  });
  await activity.evaluate((element) => {
    element.blur();
    element.scrollLeft = 0;
  });
  await activity.focus();
  const selected = page.locator(
    '[data-activity-date][data-activity-selected="true"]',
  );
  await expect(selected).toHaveAttribute('data-activity-date', '2026-08-26');
  const isSelectedDayVisible = await activity.evaluate((region) => {
    const selectedTarget = region.querySelector<HTMLElement>(
      '[data-activity-date][data-activity-selected="true"]',
    );
    if (selectedTarget === null) {
      return false;
    }
    const targetRect = selectedTarget.getBoundingClientRect();
    const regionRect = region.getBoundingClientRect();
    return (
      targetRect.left < regionRect.right &&
      targetRect.right > regionRect.left &&
      targetRect.top < regionRect.bottom &&
      targetRect.bottom > regionRect.top
    );
  });
  expect(isSelectedDayVisible).toBe(true);
  await page.keyboard.press('Enter');
  await expectWritingDay(page);
});

/*
 * Changing the range is a change of the numbers, not of the page: the reader
 * stays on the control they used, and the controls stay where they were.
 */
test('switching and stepping the range keeps the reader on the control', async ({
  page,
}) => {
  await page.setViewportSize({ height: 640, width: 390 });
  await mountInsightsNavigation(page);
  await page
    .getByRole('textbox', { name: 'Evening journal' })
    .fill('Keep Insights in place.');
  await page.getByRole('link', { name: 'Insights' }).click();
  const ranges = page.getByRole('navigation', { name: 'Insights range' });
  await expect(ranges).toBeVisible();
  const rangesBefore = await ranges.boundingBox();

  const week = ranges.getByRole('link', { exact: true, name: 'Week' });
  await week.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(thisWeekUrl);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Insights: August 24 – 30, 2026',
    }),
  ).toBeVisible();
  await expect(week).toHaveAttribute('aria-current', 'page');
  await expect(week).toBeFocused();
  expect(await ranges.boundingBox()).toEqual(rangesBefore);

  const previous = page.getByRole('link', { name: 'Previous week' });
  const previousBefore = await previous.boundingBox();
  await previous.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(previousWeekUrl);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Insights: August 17 – 23, 2026',
    }),
  ).toBeVisible();
  await expect(previous).toBeFocused();
  expect(await previous.boundingBox()).toEqual(previousBefore);
});
