import { expect, test } from '@playwright/test';

import {
  mountReadingPage,
  readingPageFixtureConfigs,
} from './reading-page-test-support.ts';

// Each fixture bundles the review page's dependency graph on a cold worker.
const fixtureBuildTimeout = 60_000;
test.setTimeout(fixtureBuildTimeout);

const phone = { width: 390, height: 844 } as const;

test('the review charts read each day out from the keyboard', async ({
  page,
}) => {
  await mountReadingPage(page, readingPageFixtureConfigs.reviewWeek);
  const ratings = page.getByRole('region', { name: 'Ratings chart' });
  const screenTime = page.getByRole('region', { name: 'Screen time chart' });

  await ratings.focus();
  await ratings.press('Home');
  await expect(
    page.getByText(
      'Monday, October 26, 2026 · Energy: Fresh · Progress: A lot · Would repeat: Yes · Closed',
    ),
  ).toBeVisible();

  await screenTime.focus();
  await screenTime.press('ArrowLeft');
  await expect(
    page.getByText(
      'Thursday, October 29, 2026 · 8 h 25 min at the screen · focus not measured',
    ),
  ).toBeVisible();
  await screenTime.press('ArrowLeft');
  await expect(
    page.getByText('Wednesday, October 28, 2026 · No report'),
  ).toBeVisible();
});

test('a change of metrics version is said, and the totals leave the old days out', async ({
  page,
}) => {
  await mountReadingPage(page, readingPageFixtureConfigs.reviewWeek);
  await expect(
    page.getByText(
      'The metrics were measured differently on 1 day of this period',
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Day by day' })
      .getByText('Measured differently from here, under metrics version 2'),
  ).toBeVisible();
  const totals = page
    .getByRole('definition')
    .filter({ hasText: '15 h 17 min' });
  await expect(totals).toContainText('over 2 days, not measured on 1 day');
});

for (const [name, config] of [
  ['week', readingPageFixtureConfigs.reviewWeek],
  ['month', readingPageFixtureConfigs.reviewMonth],
] as const) {
  test(`the ${name} review fits a phone, with only the table scrolling sideways`, async ({
    page,
  }) => {
    await page.setViewportSize(phone);
    await mountReadingPage(page, config);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const table = page.getByRole('region', { name: 'Day by day' });
    await table.focus();
    await table.press('ArrowRight');
    await expect
      .poll(() => table.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
  });
}
