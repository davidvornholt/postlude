import { expect, test } from '@playwright/test';

import { buildDayPageFixture } from './day-page-fixture-build.ts';
import type { DayPageFixtureConfig } from './day-page-fixture-contract.ts';
import { fixtureConfig, mountFixture } from './day-page-mount.ts';
import { mountDayPage, scan } from './day-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;

const rememberedConfig: DayPageFixtureConfig = {
  ...fixtureConfig(['stored'], ''),
  anniversaries: [
    {
      date: '2025-08-26',
      journalMarkdown: 'A long walk by the river after the rain.',
      scriptureMarkdown: '',
      yearsAgo: 1,
      words: 9,
    },
    {
      date: '2024-08-26',
      journalMarkdown: '',
      scriptureMarkdown: 'Slow to anger, and quick to listen.',
      scriptureTopic: 'Patience',
      yearsAgo: 2,
      words: 7,
    },
  ],
};
const rememberedAssets = await buildDayPageFixture(rememberedConfig);

const rememberedRegion = (page: Parameters<typeof scan>[0]) =>
  page.getByRole('region', { name: 'On this day' });

for (const colorScheme of colorSchemes) {
  test(`the same date in earlier years waits folded below the day in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountFixture(page, rememberedConfig, rememberedAssets);
    const region = rememberedRegion(page);
    const lastYear = region.getByRole('group').filter({
      hasText: '1 year ago',
    });

    // Folded, each year shows its date and its first words.
    await expect(lastYear).toContainText('Tuesday, August 26, 2025');
    await expect(lastYear).toContainText('A long walk by the river');
    await expect(
      region.getByRole('link', { name: 'Open this day' }),
    ).toHaveCount(0);
    await scan(page);

    await lastYear.getByText('1 year ago').click();
    await expect(
      lastYear.getByRole('link', { name: 'Open this day' }),
    ).toHaveAttribute('href', '/day/2025-08-26');

    // The keyboard opens a year the same way, and a topic is read as one.
    const twoYears = region.getByRole('group').filter({
      hasText: '2 years ago',
    });
    await twoYears.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(twoYears.getByText('Patience', { exact: true })).toBeVisible();
    // Open, the year's words are read in full rather than as a first line.
    await expect(
      twoYears.getByRole('paragraph').filter({
        hasText: 'Slow to anger, and quick to listen.',
      }),
    ).toBeVisible();
    await expect(
      twoYears.locator('summary').getByText('Slow to anger'),
    ).toBeHidden();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await scan(page);
  });
}

test('a date with nothing from earlier years says so in a line', async ({
  page,
}) => {
  await mountDayPage(page, ['stored']);
  const region = rememberedRegion(page);

  await expect(region).toContainText(
    'Nothing was written on this date in an earlier year.',
  );
  await expect(region.getByRole('group')).toHaveCount(0);
});
