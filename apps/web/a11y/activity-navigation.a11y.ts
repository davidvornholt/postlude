import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const writingDayUrl = /\/$/u;

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
  await mountArchiveNavigation(page);
  await page
    .getByRole('textbox', { name: 'Evening journal' })
    .fill('Open this archive day.');
  await page.getByRole('link', { name: 'Archive' }).click();
  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();

  await page.locator('[data-activity-date="2026-08-26"]').click();
  await expectWritingDay(page);

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
  const activity = page.getByRole('region', {
    name: 'Journal activity grid',
  });
  await activity.focus();
  await page.keyboard.press('Enter');
  await expectWritingDay(page);
});
