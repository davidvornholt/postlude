import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const writingDayUrl = /\/$/u;
const namedArchiveUrl = /\/archive\?year=2026$/u;

const expectWritingDay = async (
  page: Parameters<typeof mountArchiveNavigation>[0],
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
  await mountArchiveNavigation(page);
  await page
    .getByRole('textbox', { name: 'Evening journal' })
    .fill('Open this archive day.');
  await page.getByRole('link', { name: 'Archive' }).click();
  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
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

test('changing the activity year keeps the reader at the selector', async ({
  page,
}) => {
  await page.setViewportSize({ height: 640, width: 390 });
  await mountArchiveNavigation(page);
  await page
    .getByRole('textbox', { name: 'Evening journal' })
    .fill('Keep the archive in place.');
  await page.getByRole('link', { name: 'Archive' }).click();
  const year = page.getByRole('link', { name: '2026' });
  await year.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const before = await page.evaluate(() => globalThis.scrollY);
  expect(before).toBeGreaterThan(0);

  await year.click();

  await expect(page).toHaveURL(namedArchiveUrl);
  await expect(year).toHaveAttribute('aria-current', 'page');
  const after = await page.evaluate(() => globalThis.scrollY);
  const position = await year.evaluate((element) => {
    const { bottom, top } = element.getBoundingClientRect();
    return { bottom, top };
  });
  const viewportHeight = await page.evaluate(() => innerHeight);
  expect(after).toBeGreaterThan(0);
  expect(position.top).toBeGreaterThanOrEqual(0);
  expect(position.bottom).toBeLessThanOrEqual(viewportHeight);
});
