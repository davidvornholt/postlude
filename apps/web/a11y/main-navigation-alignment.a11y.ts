import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const alignmentTolerance = 1;
const placeCount = 5;

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

test('every place in the main navigation is on screen without scrolling sideways', async ({
  page,
}) => {
  await mountArchiveNavigation(page);
  const navigation = page.getByRole('navigation', { name: 'Main' });
  const links = await navigation.getByRole('link').all();
  expect(links).toHaveLength(placeCount);
  for (const link of links) {
    // Clipping by a scrolling ancestor counts against the ratio, so a place
    // scrolled out of a sideways strip is not in view.
    await expect(link).toBeInViewport({ ratio: 1 });
  }
  expect(
    await navigation.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});
