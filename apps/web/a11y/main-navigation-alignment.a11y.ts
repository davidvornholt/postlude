import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const alignmentTolerance = 1;

test('Archive shares the navigation baseline', async ({ page }) => {
  await mountArchiveNavigation(page);
  const [todayBox, archiveBox] = await Promise.all([
    page.getByRole('link', { name: 'Today' }).boundingBox(),
    page.getByRole('link', { name: 'Archive' }).boundingBox(),
  ]);

  expect(todayBox).not.toBeNull();
  expect(archiveBox).not.toBeNull();
  expect(
    Math.abs((todayBox?.y ?? 0) - (archiveBox?.y ?? 0)),
  ).toBeLessThanOrEqual(alignmentTolerance);
});
