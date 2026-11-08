import { expect, test } from '@playwright/test';

import { mountInsightsNavigation } from './insights-navigation-test-support.ts';

const alignmentTolerance = 1;
const placeCount = 4;

test('Insights shares the baseline of the places on its line', async ({
  page,
}) => {
  await mountInsightsNavigation(page);
  const navigation = page.getByRole('navigation', { name: 'Main' });
  const insightsBox = await navigation
    .getByRole('link', { name: 'Insights' })
    .boundingBox();
  const others = await navigation
    .getByRole('link')
    .filter({ hasNotText: 'Insights' })
    .all();
  const otherBoxes = await Promise.all(
    others.map((link) => link.boundingBox()),
  );
  expect(insightsBox).not.toBeNull();
  const insightsTop = insightsBox?.y ?? 0;
  const insightsBottom = insightsTop + (insightsBox?.height ?? 0);
  // The places wrap onto a second line on a phone, so Insights is held to the
  // places beside it, whichever line that is.
  const neighbours = otherBoxes.filter(
    (box) =>
      box !== null &&
      box.y < insightsBottom &&
      insightsTop < box.y + box.height,
  );
  expect(neighbours.length).toBeGreaterThan(0);
  for (const box of neighbours) {
    expect(Math.abs((box?.y ?? 0) - insightsTop)).toBeLessThanOrEqual(
      alignmentTolerance,
    );
  }
});

test('every place in the main navigation is on screen without scrolling sideways', async ({
  page,
}) => {
  await mountInsightsNavigation(page);
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
