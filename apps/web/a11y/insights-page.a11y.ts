import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  insightsFixtureConfigs,
  mountInsightsPage,
  openEveryFold,
  scanInsights,
} from './insights-page-test-support.ts';

// Each fixture bundles the page's dependency graph on a cold worker.
const fixtureBuildTimeout = 60_000;
test.setTimeout(fixtureBuildTimeout);

const colorSchemes = ['light', 'dark'] as const;
const phone = { width: 390, height: 844 } as const;
const everyDayWritten = /Every day written/u;
const monthDetails = /^[A-Z][a-z]+ \d{4} · written on/u;
const august2026 = /^August 2026 · /u;
const july2026 = /^July 2026 · /u;
const july2025 = /^July 2025 · /u;

const openFold = async (
  page: playwright.Page,
  title: string,
): Promise<void> => {
  const summary = page.locator('summary').filter({ hasText: title });
  await summary.click();
  await expect(summary.locator('xpath=..')).toHaveAttribute('open', '');
};

for (const colorScheme of colorSchemes) {
  test(`an empty journal says so and passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountInsightsPage(page, insightsFixtureConfigs.empty);
    await expect(
      page.getByText('Nothing written yet. Insights fill in as the days do.'),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Journal activity grid' }),
    ).toHaveCount(0);
    await expect(page.locator('details')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Download the journal' }),
    ).toHaveCount(0);
    await scanInsights(page);
  });

  test(`a year reads out from the keyboard and passes WCAG 2.2 AA with every fold open in ${colorScheme} mode`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountInsightsPage(page, insightsFixtureConfigs.year);

    const activityRegion = page.getByRole('region', {
      name: 'Journal activity grid',
    });
    await activityRegion.focus();
    await expect(activityRegion).toBeFocused();
    const previousWeek = page.locator('[data-activity-date="2026-08-19"]');
    const previousWeekDetails = await previousWeek.getAttribute('title');
    await page.keyboard.press('ArrowLeft');
    await expect(
      page.getByText(previousWeekDetails ?? '', { exact: true }),
    ).toBeVisible();
    const hoveredDay = page.locator('[data-activity-date="2026-08-25"]');
    const hoveredDetails = await hoveredDay.getAttribute('title');
    await hoveredDay.hover();
    await expect(
      page.getByText(hoveredDetails ?? '', { exact: true }),
    ).toBeVisible();
    const activityOverflows = await activityRegion.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(activityOverflows).toBe(testInfo.project.name.includes('mobile'));

    const legend = page.locator('figcaption').filter({ hasText: 'No writing' });
    await expect(legend).toBeVisible();
    await page.getByRole('radio', { name: 'Writing' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Energy' })).toBeChecked();
    await expect(legend).toHaveCount(0);
    await expect(
      page.locator('figcaption').filter({ hasText: 'Not rated' }),
    ).toContainText('Drained');

    await page.getByText(everyDayWritten).click();
    const dayRegion = page.getByRole('region', {
      name: 'Days written, scrollable',
    });
    await dayRegion.focus();
    await expect(dayRegion).toBeFocused();

    await openFold(page, 'Entry length');
    const sizeChart = page.getByRole('region', { name: 'Entry size chart' });
    await sizeChart.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(sizeChart).toBeFocused();
    await expect(sizeChart).toHaveAttribute('aria-describedby');

    await openEveryFold(page);
    await scanInsights(page);
  });

  test(`all time is a grid of months the arrow keys walk, and passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountInsightsPage(page, insightsFixtureConfigs.allTime);
    const months = page.getByRole('link', { name: monthDetails });
    const stop = months.and(page.locator('[tabindex="0"]'));
    await expect(stop).toHaveCount(1);
    await expect(stop).toHaveAccessibleName(august2026);

    await stop.focus();
    await page.keyboard.press('ArrowLeft');
    const july = page.getByRole('link', { name: july2026 });
    await expect(july).toBeFocused();
    await expect(july).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('link', { name: july2025 })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(months.and(page.locator(':focus'))).toHaveCount(0);

    await openEveryFold(page);
    await scanInsights(page);
  });

  for (const name of ['week', 'month'] as const) {
    test(`a ${name} passes WCAG 2.2 AA with every fold open in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await mountInsightsPage(page, insightsFixtureConfigs[name]);
      await expect(
        page.getByRole('region', { name: 'Ratings chart' }),
      ).toBeVisible();
      await openEveryFold(page);
      await scanInsights(page);
    });
  }
}

test('the week charts read each day out from the keyboard', async ({
  page,
}) => {
  await mountInsightsPage(page, insightsFixtureConfigs.week);
  const ratings = page.getByRole('region', { name: 'Ratings chart' });
  await ratings.focus();
  await ratings.press('Home');
  await expect(
    page.getByText(
      'Monday, October 26, 2026 · Energy: Fresh · Progress: A lot · Would repeat: Yes · Closed',
    ),
  ).toBeVisible();

  await openFold(page, 'Screen time');
  const screenTime = page.getByRole('region', { name: 'Screen time chart' });
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
  await mountInsightsPage(page, insightsFixtureConfigs.week);
  await openFold(page, 'Screen time');
  await expect(
    page.getByText(
      'The metrics were measured differently on 1 day of this week',
      { exact: false },
    ),
  ).toBeVisible();
  const totals = page
    .getByRole('definition')
    .filter({ hasText: '15 h 17 min' });
  await expect(totals).toContainText('over 2 days, not measured on 1 day');

  await openFold(page, 'Day by day');
  await expect(
    page
      .getByRole('region', { name: 'Day by day' })
      .getByText('Measured differently from here, under metrics version 2'),
  ).toBeVisible();
});

/*
 * A step past today keeps its place beside the one that can be taken, dimmed
 * and marked unavailable, and the keyboard passes over it.
 */
test('a step that cannot be taken stays in place, dimmed and out of the tab order', async ({
  page,
}) => {
  await mountInsightsPage(page, insightsFixtureConfigs.year);
  const previous = page.getByRole('link', { name: 'Previous year' });
  const next = page.getByRole('link', { name: 'Next year' });
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect(next).not.toHaveAttribute('href');
  await expect(previous).not.toHaveAttribute('aria-disabled');
  const colour = (link: playwright.Locator) =>
    link.evaluate((element) => getComputedStyle(element).color);
  expect(await colour(next)).not.toBe(await colour(previous));
  await previous.focus();
  await page.keyboard.press('Tab');
  await expect(next).not.toBeFocused();
});

const sidewaysOverflow = (page: playwright.Page): Promise<number> =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

for (const name of ['year', 'allTime'] as const) {
  test(`the ${name} picture fits a phone`, async ({ page }) => {
    await page.setViewportSize(phone);
    await mountInsightsPage(page, insightsFixtureConfigs[name]);
    await openEveryFold(page);
    expect(await sidewaysOverflow(page)).toBe(0);
  });
}

for (const name of ['week', 'month'] as const) {
  test(`the ${name} fits a phone, with only the day table scrolling sideways`, async ({
    page,
  }) => {
    await page.setViewportSize(phone);
    await mountInsightsPage(page, insightsFixtureConfigs[name]);
    await openEveryFold(page);
    expect(await sidewaysOverflow(page)).toBe(0);
    const table = page.getByRole('region', { name: 'Day by day' });
    await table.focus();
    await table.press('ArrowRight');
    await expect
      .poll(() => table.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
  });
}

const controlPositions = async (page: playwright.Page) => {
  const box = async (locator: playwright.Locator) => {
    const bounds = await locator.boundingBox();
    if (bounds === null) {
      throw new Error('A range control is not on the page.');
    }
    return bounds;
  };
  const heading = page.getByRole('heading', { level: 1 });
  const switcher = await box(
    page.getByRole('navigation', { name: 'Insights range' }),
  );
  // The pair of arrows, or the empty places of an arrow that cannot step.
  const steps = await box(heading.locator('xpath=preceding-sibling::div[1]'));
  const title = await box(heading);
  return {
    switcher: { x: switcher.x, y: switcher.y, width: switcher.width },
    steps,
    title: { x: title.x, y: title.y },
  };
};

/*
 * The controls stay where the hand left them: changing the range must not
 * move the switcher or the step arrows, whatever the length of the range's
 * name — the shifting buttons were what made the old Review tab tiring.
 */
test('the switcher and the step arrows hold their place from one range to another', async ({
  page,
}) => {
  await mountInsightsPage(page, insightsFixtureConfigs.week);
  const week = await controlPositions(page);
  for (const name of ['month', 'year', 'pastYear'] as const) {
    await mountInsightsPage(page, insightsFixtureConfigs[name]);
    expect(await controlPositions(page)).toEqual(week);
  }
});
