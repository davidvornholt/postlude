import { expect, test } from '@playwright/test';

import { mountArchiveNavigation } from './archive-navigation-test-support.ts';

const alignmentTolerance = 1;
const placeCount = 6;

test('Archive shares the baseline of the places on its line', async ({
  page,
}) => {
  await mountArchiveNavigation(page);
  const navigation = page.getByRole('navigation', { name: 'Main' });
  const archiveBox = await navigation
    .getByRole('link', { name: 'Archive' })
    .boundingBox();
  const others = await navigation
    .getByRole('link')
    .filter({ hasNotText: 'Archive' })
    .all();
  const otherBoxes = await Promise.all(
    others.map((link) => link.boundingBox()),
  );
  expect(archiveBox).not.toBeNull();
  const archiveTop = archiveBox?.y ?? 0;
  const archiveBottom = archiveTop + (archiveBox?.height ?? 0);
  // The places wrap onto a second line on a phone, so Archive is held to the
  // places beside it, whichever line that is.
  const neighbours = otherBoxes.filter(
    (box) =>
      box !== null && box.y < archiveBottom && archiveTop < box.y + box.height,
  );
  expect(neighbours.length).toBeGreaterThan(0);
  for (const box of neighbours) {
    expect(Math.abs((box?.y ?? 0) - archiveTop)).toBeLessThanOrEqual(
      alignmentTolerance,
    );
  }
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
