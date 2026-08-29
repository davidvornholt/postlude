import { expect, test } from '@playwright/test';

import { journalDateLabel } from '../src/features/journal/day-label.ts';
import { journalCountLabel } from '../src/features/journal/journal-labels.ts';
import {
  archiveFixtureConfigs,
  archiveFixtureHistoryAverage,
  archiveFixtureHistoryStart,
  mountArchivePage,
  scanArchive,
} from './archive-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const colorSchemes = ['light', 'dark'] as const;
const everyDayWritten = /Every day written/u;

for (const colorScheme of colorSchemes) {
  test(`the empty archive passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.empty);
    await expect(
      page.getByRole('region', { name: 'Journal activity grid' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Download the journal' }),
    ).toHaveCount(0);
    await scanArchive(page);
  });

  test(`the filled archive and expanded day table pass WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.filled);

    const activityRegion = page.getByRole('region', {
      name: 'Journal activity grid',
    });
    await activityRegion.focus();
    await expect(activityRegion).toBeFocused();
    const previousWeek = page.locator('[data-activity-date="2026-08-19"]');
    const previousWeekDetails = await previousWeek.getAttribute('title');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText(previousWeekDetails ?? '')).toBeVisible();
    const hoveredDay = page.locator('[data-activity-date="2026-08-25"]');
    const hoveredDetails = await hoveredDay.getAttribute('title');
    await hoveredDay.hover();
    await expect(page.getByText(hoveredDetails ?? '')).toBeVisible();
    const activityOverflows = await activityRegion.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(activityOverflows).toBe(testInfo.project.name.includes('mobile'));

    const sizeChart = page.getByRole('region', { name: 'Entry size chart' });
    await sizeChart.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(sizeChart).toBeFocused();
    await expect(sizeChart).toHaveAttribute('aria-describedby');

    await page.getByRole('radio', { name: 'Since first entry' }).check();
    await expect(
      page.getByRole('radio', { name: 'Since first entry' }),
    ).toBeChecked();
    await expect(
      page.getByText(
        `${journalCountLabel(archiveFixtureHistoryAverage, 'word')} on an average written day`,
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole('region', { name: 'Entry size chart' }).focus();
    await page.keyboard.press('Home');
    if (archiveFixtureHistoryStart === undefined) {
      throw new Error('The filled archive fixture has no history.');
    }
    await expect(
      page.getByText(
        new RegExp(journalDateLabel(archiveFixtureHistoryStart), 'u'),
      ),
    ).toBeVisible();

    const summary = page.getByText(everyDayWritten);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('table')).toBeVisible();
    const dayRegion = page.getByRole('region', {
      name: 'Days written, scrollable',
    });
    await dayRegion.focus();
    await expect(dayRegion).toBeFocused();
    await scanArchive(page);
  });

  test(`a named archive year passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.namedYear);
    const selectedYear = page.getByRole('link', { name: '2024' });
    await expect(selectedYear).toHaveAttribute('aria-current', 'page');
    const destination = new URL(
      (await selectedYear.getAttribute('href')) ?? '',
      'https://fixture.invalid',
    );
    expect(destination.pathname).toBe('/archive');
    expect(destination.searchParams.get('year')).toBe('2024');
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(
      page.getByText('Nothing was written in this stretch of the journal.'),
    ).toBeVisible();
    await scanArchive(page);
  });
}
