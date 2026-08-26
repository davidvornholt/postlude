import { expect, test } from '@playwright/test';

import { journalWriteMessage } from '../src/features/journal/errors/journal-errors.ts';
import {
  archiveFixtureConfigs,
  mountArchiveNavigation,
  mountArchivePage,
  scanArchive,
} from './archive-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const colorSchemes = ['light', 'dark'] as const;
const everyDayWritten = /Every day written/u;
const quietPeriodMs = 1200;
const revision = /\d+/u;

test('the first archive render includes an edit made inside the autosave quiet period', async ({
  page,
}) => {
  await mountArchiveNavigation(page);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.fill('Quiet archive edit.');
  const editedAt = Date.now();
  await page.getByRole('link', { name: 'Open archive' }).click();
  expect(Date.now() - editedAt).toBeLessThan(quietPeriodMs);

  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
  await expect(page.getByText('1 days written, 3 words in all.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute(
    'data-stored-revision',
    revision,
  );
  await expect(page.locator('html')).toHaveAttribute('data-archive-reads', '1');
});

test('a rejected forced save keeps the writing page and skips the archive read', async ({
  page,
}) => {
  await mountArchiveNavigation(page, 'failed');
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.fill('Keep this failed draft visible.');
  await page.getByRole('link', { name: 'Open archive' }).click();

  await expect(evening).toContainText('Keep this failed draft visible.');
  await expect(
    page.getByText(journalWriteMessage, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Archive' })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-archive-reads', '0');
  await expect(page.locator('main')).toHaveAttribute('data-fixture-route', '/');
});

for (const colorScheme of colorSchemes) {
  test(`the empty archive passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.empty);
    await expect(page.getByText('Nothing has been written yet')).toBeVisible();
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
    const activityOverflows = await activityRegion.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    expect(activityOverflows).toBe(testInfo.project.name.includes('mobile'));

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
