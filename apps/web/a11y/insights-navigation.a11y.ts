import { expect, test } from '@playwright/test';

import { journalWriteMessage } from '../src/features/journal/errors/journal-errors.ts';
import {
  mountInsightsNavigation,
  releaseInsightsRead,
} from './insights-navigation-test-support.ts';
import { scanInsights } from './insights-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const insightsUrl = /\/insights$/u;
const insightsHeading = 'Insights: 2026';
const firstLead = 'So far you have written on 1 of 238 days, 3 words in all.';
const colorSchemes = ['light', 'dark'] as const;
const pageErrorTitle = 'Something went wrong · Postlude';
const previousDayUrl = /\/day\/2026-08-24$/u;
const quietPeriodMs = 1200;
const revision = /\d+/u;
const writingDayUrl = /\/day\/2026-08-25$/u;

const expectNoPageOverflow = async (
  page: Parameters<typeof mountInsightsNavigation>[0],
): Promise<void> => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  ).toBe(true);
};

test('the first Insights render includes an edit made inside the autosave quiet period', async ({
  page,
}) => {
  await mountInsightsNavigation(page);
  const evening = page.getByRole('textbox', { name: 'Evening journal' });
  await evening.fill('Quiet insights edit.');
  const editedAt = Date.now();
  await page.getByRole('link', { name: 'Insights' }).click();
  expect(Date.now() - editedAt).toBeLessThan(quietPeriodMs);

  await expect(
    page.getByRole('heading', { level: 1, name: insightsHeading }),
  ).toBeVisible();
  await expect(page.getByText(firstLead)).toBeVisible();
  await expect(page).toHaveURL(insightsUrl);
  await expect(page).toHaveTitle('Insights · Postlude');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute(
    'data-stored-revision',
    revision,
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-insights-reads',
    '1',
  );
});

for (const colorScheme of colorSchemes) {
  test(`a failed pre-navigation read reaches the route error boundary in ${colorScheme} mode`, async ({
    page,
  }) => {
    const pageErrors: Array<string> = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountInsightsNavigation(page, {
      insightsReadOutcome: 'failed',
      deferFirstInsightsRead: false,
      saveOutcome: 'stored',
    });

    const insights = page.getByRole('link', { name: 'Insights' });
    await insights.focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(insightsUrl);
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
      'data-insights-reads',
      '2',
    );
    expect(pageErrors).toEqual([]);
    await expectNoPageOverflow(page);
    await scanInsights(page);
  });

  test(`an edit stored during the Insights read reaches its first render in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountInsightsNavigation(page, {
      deferFirstInsightsRead: true,
      saveOutcome: 'stored',
    });
    const insights = page.getByRole('link', { name: 'Insights' });
    await insights.focus();
    await page.keyboard.press('Enter');
    await page
      .locator('html[data-insights-read-started="true"]')
      .waitFor({ timeout: 5000 });
    await expect(insights).toHaveAttribute('aria-busy', 'true');
    await expect(insights.locator('..')).toContainText('…');
    await page
      .getByRole('textbox', { name: 'Evening journal' })
      .fill('Late insights edit.');
    await releaseInsightsRead(page);

    await expect(page).toHaveURL(insightsUrl);
    await expect(page).toHaveTitle('Insights · Postlude');
    await expect(
      page.getByRole('heading', { level: 1, name: insightsHeading }),
    ).toBeVisible();
    await expect(page.getByText(firstLead)).toBeVisible();
    await expect(page.locator('main')).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute(
      'data-insights-reads',
      '2',
    );
    await expect(insights).not.toHaveAttribute('aria-busy');
    await expectNoPageOverflow(page);
    await scanInsights(page);
  });

  test(`a rejected edit made during the Insights read stays recoverable in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountInsightsNavigation(page, {
      insightsReadOutcome: 'failed',
      deferFirstInsightsRead: true,
      saveOutcome: 'failed',
    });
    const insights = page.getByRole('link', { name: 'Insights' });
    await insights.focus();
    await page.keyboard.press('Enter');
    await page
      .locator('html[data-insights-read-started="true"]')
      .waitFor({ timeout: 5000 });
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await evening.fill('Keep this late failed draft visible.');
    await releaseInsightsRead(page);

    await expect(page).toHaveURL(writingDayUrl);
    await expect(page).toHaveTitle('Tuesday, August 25, 2026 · Postlude');
    await expect(evening).toContainText('Keep this late failed draft visible.');
    await expect(evening).toBeFocused();
    await expect(
      page.getByText(journalWriteMessage, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Insights stayed closed');
    await expect(alert).toContainText('Tuesday, August 25, 2026');
    await expect(
      page.getByRole('heading', { level: 1, name: insightsHeading }),
    ).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute(
      'data-insights-reads',
      '1',
    );
    await expectNoPageOverflow(page);
    await scanInsights(page);

    const previous = page.getByRole('link', { name: 'Previous day' });
    await previous.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(previousDayUrl);
    // The arrow that stepped keeps focus on the day it opened.
    await expect(previous).toBeFocused();
    const recovery = page.getByRole('link', {
      exact: true,
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
    await scanInsights(page);
  });
}
