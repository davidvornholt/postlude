import { expect, test } from '@playwright/test';

import { journalWriteMessage } from '../src/features/journal/errors/journal-errors.ts';
import {
  mountArchiveNavigation,
  releaseArchiveRead,
} from './archive-navigation-test-support.ts';
import { scanArchive } from './archive-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const archiveUrl = /\/archive$/u;
const colorSchemes = ['light', 'dark'] as const;
const pageErrorTitle = 'Something went wrong · Postlude';
const previousDayUrl = /\/day\/2026-08-24$/u;
const quietPeriodMs = 1200;
const revision = /\d+/u;
const writingDayUrl = /\/day\/2026-08-25$/u;

const expectNoPageOverflow = async (
  page: Parameters<typeof mountArchiveNavigation>[0],
): Promise<void> => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  ).toBe(true);
};

test('the first archive render includes an edit made inside the autosave quiet period', async ({
  page,
}) => {
  await mountArchiveNavigation(page);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.fill('Quiet archive edit.');
  const editedAt = Date.now();
  await page.getByRole('link', { name: 'Archive' }).click();
  expect(Date.now() - editedAt).toBeLessThan(quietPeriodMs);

  await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
  await expect(page.getByText('1 day written, 3 words in all.')).toBeVisible();
  await expect(page).toHaveURL(archiveUrl);
  await expect(page).toHaveTitle('Archive · Postlude');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute(
    'data-stored-revision',
    revision,
  );
  await expect(page.locator('html')).toHaveAttribute('data-archive-reads', '1');
});

for (const colorScheme of colorSchemes) {
  test(`a failed pre-navigation read reaches the route error boundary in ${colorScheme} mode`, async ({
    page,
  }) => {
    const pageErrors: Array<string> = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchiveNavigation(page, {
      archiveReadOutcome: 'failed',
      deferFirstArchiveRead: false,
      saveOutcome: 'stored',
    });

    const archive = page.getByRole('link', { name: 'Archive' });
    await archive.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(archiveUrl);
    await expect(page).toHaveTitle(pageErrorTitle);
    await expect(
      page.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'This page could not be loaded, and trying again is usually enough.',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Back to Postlude' }),
    ).toBeVisible();
    await expect(page.locator('main')).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute(
      'data-archive-reads',
      '2',
    );
    expect(pageErrors).toEqual([]);
    await expectNoPageOverflow(page);
    await scanArchive(page);
  });

  test(`an edit stored during the archive read reaches its first render in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchiveNavigation(page, {
      deferFirstArchiveRead: true,
      saveOutcome: 'stored',
    });
    const archive = page.getByRole('link', { name: 'Archive' });
    await archive.focus();
    await page.keyboard.press('Enter');
    await page
      .locator('html[data-archive-read-started="true"]')
      .waitFor({ timeout: 5000 });
    await expect(archive).toHaveAttribute('aria-busy', 'true');
    await expect(archive.locator('..')).toContainText('…');
    await page
      .getByRole('textbox', { name: 'Evening journal' })
      .fill('Late archive edit.');
    await releaseArchiveRead(page);

    await expect(page).toHaveURL(archiveUrl);
    await expect(page).toHaveTitle('Archive · Postlude');
    await expect(page.getByRole('heading', { name: 'Archive' })).toBeVisible();
    await expect(
      page.getByText('1 day written, 3 words in all.'),
    ).toBeVisible();
    await expect(page.locator('main')).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute(
      'data-archive-reads',
      '2',
    );
    await expect(archive).not.toHaveAttribute('aria-busy');
    await expectNoPageOverflow(page);
    await scanArchive(page);
  });

  test(`a rejected edit made during the archive read stays recoverable in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchiveNavigation(page, {
      archiveReadOutcome: 'failed',
      deferFirstArchiveRead: true,
      saveOutcome: 'failed',
    });
    const archive = page.getByRole('link', { name: 'Archive' });
    await archive.focus();
    await page.keyboard.press('Enter');
    await page
      .locator('html[data-archive-read-started="true"]')
      .waitFor({ timeout: 5000 });
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await evening.fill('Keep this late failed draft visible.');
    await releaseArchiveRead(page);

    await expect(page).toHaveURL(writingDayUrl);
    await expect(page).toHaveTitle('Tuesday, August 25, 2026 · Postlude');
    await expect(evening).toContainText('Keep this late failed draft visible.');
    await expect(evening).toBeFocused();
    await expect(
      page.getByText(journalWriteMessage, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Archive stayed closed');
    await expect(alert).toContainText('Tuesday, August 25, 2026');
    await expect(page.getByRole('heading', { name: 'Archive' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute(
      'data-archive-reads',
      '1',
    );
    await expectNoPageOverflow(page);
    await scanArchive(page);

    const previous = page.getByRole('link', { name: 'Previous day' });
    await previous.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(previousDayUrl);
    await expect(page.locator('main')).toBeFocused();
    const recovery = page.getByRole('link', {
      name: 'Tuesday, August 25, 2026',
    });
    await recovery.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(writingDayUrl);
    await expect(page).toHaveTitle('Tuesday, August 25, 2026 · Postlude');
    await expect(
      page.getByRole('heading', { name: 'Tuesday, August 25, 2026' }),
    ).toBeVisible();
    await expect(page.locator('main')).toBeFocused();
    await expect(
      page.getByRole('textbox', { name: 'Evening journal' }),
    ).toContainText('Keep this late failed draft visible.');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expectNoPageOverflow(page);
    await scanArchive(page);
  });
}
