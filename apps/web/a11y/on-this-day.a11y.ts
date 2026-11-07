import { expect, test } from '@playwright/test';

import { buildDayPageFixture } from './day-page-fixture-build.ts';
import type { DayPageFixtureConfig } from './day-page-fixture-contract.ts';
import { fixtureConfig, mountFixture } from './day-page-mount.ts';
import { mountDayPage, scan } from './day-page-test-support.ts';

const colorSchemes = ['light', 'dark'] as const;
const lastYearToggle = /^1 year ago/u;

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
    const lastYear = region.getByRole('listitem').filter({
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
    await expect(lastYear.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(
      lastYear.getByRole('link', { name: 'Open this day' }),
    ).toHaveAttribute('href', '/day/2025-08-26');

    // The keyboard opens a year the same way, and a topic is read as one.
    const twoYears = region.getByRole('listitem').filter({
      hasText: '2 years ago',
    });
    await twoYears.getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(twoYears.getByText('Patience', { exact: true })).toBeVisible();
    // Open, the year's words are read in full rather than as a first line.
    await expect(
      twoYears.getByRole('paragraph').filter({
        hasText: 'Slow to anger, and quick to listen.',
      }),
    ).toBeVisible();
    await expect(
      twoYears.getByRole('button').getByText('Slow to anger'),
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
  await expect(region.getByRole('listitem')).toHaveCount(0);
});

test('a year opens and folds without the years below it jumping', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mountFixture(page, rememberedConfig, rememberedAssets);
  const region = rememberedRegion(page);
  await region
    .getByRole('button', { name: lastYearToggle })
    .scrollIntoViewIfNeeded();

  /**
   * Where the pressed year and the next one sit on every frame for a while
   * after the press. Folded words that vanish before the year grows would show
   * as the next year moving back up for a frame.
   */
  const pressAndTrack = (): Promise<
    ReadonlyArray<{ readonly pressed: number; readonly next: number }>
  > =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const [pressed, next] = Array.from(
            document.querySelectorAll('section ul > li h3'),
          );
          const tops: Array<{ pressed: number; next: number }> = [];
          const start = performance.now();
          const read = () => {
            tops.push({
              next: next?.getBoundingClientRect().top ?? 0,
              pressed: pressed?.getBoundingClientRect().top ?? 0,
            });
            if (performance.now() - start < 500) {
              requestAnimationFrame(read);
            } else {
              resolve(tops);
            }
          };
          read();
          pressed?.querySelector('button')?.click();
          requestAnimationFrame(read);
        }),
    );

  const steady = (
    tops: ReadonlyArray<{ readonly pressed: number; readonly next: number }>,
    direction: 1 | -1,
  ) => ({
    pressed: new Set(tops.map(({ pressed }) => pressed)).size,
    // Each frame moves the next year on in one direction only.
    backwards: tops.filter(
      ({ next }, index) =>
        index > 0 && (next - (tops[index - 1]?.next ?? next)) * direction < 0,
    ).length,
    // And no single frame carries it most of the way.
    largestStep: Math.max(
      ...tops.map(({ next }, index) =>
        Math.abs(next - (tops[index - 1]?.next ?? next)),
      ),
    ),
    travel: Math.abs((tops.at(-1)?.next ?? 0) - (tops[0]?.next ?? 0)),
  });

  const opening = steady(await pressAndTrack(), 1);
  expect(opening.pressed).toBe(1);
  expect(opening.backwards).toBe(0);
  expect(opening.travel).toBeGreaterThan(0);
  expect(opening.largestStep).toBeLessThan(opening.travel / 2);

  const folding = steady(await pressAndTrack(), -1);
  expect(folding.pressed).toBe(1);
  expect(folding.backwards).toBe(0);
  expect(folding.largestStep).toBeLessThan(folding.travel / 2);
});
