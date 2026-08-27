import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import { activityWindow } from '../src/features/journal/activity.ts';
import { applyPrivateResponseHeaders } from '../src/shared/auth/private-response.ts';
import { runSessionRequired } from '../src/shared/auth/session-required.ts';
import {
  answerWithUnavailableExport,
  privateFailureDetail,
  productionStyleSheetHref,
  recoveryActionContrasts,
} from './archive-export-recovery-test-support.ts';
import type { ArchivePageFixtureConfig } from './archive-page-fixture-contract.ts';
import { mountArchivePage, scanArchive } from './archive-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const today = '2026-08-26';
const currentYear = 2026;
const exportRoute = '**/archive/export';
const loginUrl = /\/login$/u;
const exportFileName = 'postlude-2026-08-26.zip';
const colorSchemes = ['light', 'dark'] as const;
const unavailableStatus = 503;
const textContrastMinimum = 4.5;
const nonTextContrastMinimum = 3;
const referenceOnly: ArchivePageFixtureConfig = {
  exportSettlement: { delayMs: 0, outcome: 'stored' },
  selectedYear: undefined,
  view: {
    today,
    exportAvailable: true,
    window: activityWindow(today),
    days: [
      {
        date: today,
        journalWords: 0,
        scriptureWords: 0,
        hasScripture: true,
        journalWrittenOnTheDay: false,
        scriptureUsedOnTheDay: true,
      },
    ],
    years: [currentYear],
    journalStreak: { current: 0, longest: 0 },
    scriptureStreak: { current: 1, longest: 1 },
    totals: { daysWritten: 1, words: 0 },
    anniversaries: [],
  },
};

const answerWithoutSession = async (route: playwright.Route): Promise<void> => {
  const publishedHeaders = new Headers();
  const result = await runSessionRequired({
    request: new Request(route.request().url(), { method: 'POST' }),
    authorize: () => Promise.resolve(false),
    next: () => Promise.resolve('private export'),
    publishHeaders: () => applyPrivateResponseHeaders(publishedHeaders),
  }).catch((error: unknown) => error);
  if (!(result instanceof Response)) {
    throw new TypeError('The protected export did not return a response.');
  }
  await route.fulfill({
    body: await result.text(),
    headers: Object.fromEntries(
      new Headers([...publishedHeaders, ...result.headers]),
    ),
    status: result.status,
  });
};

test('an expired session opens the native sign-in recovery page', async ({
  page,
}) => {
  let method = '';
  await page.route(exportRoute, (route) => {
    method = route.request().method();
    return answerWithoutSession(route);
  });
  await mountArchivePage(page, referenceOnly);
  await page.getByRole('button', { name: 'Download the journal' }).click();

  await expect(page).toHaveURL(loginUrl);
  await expect(page.getByRole('heading', { name: 'Postlude' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign in with GitHub' }),
  ).toBeVisible();
  expect(method).toBe('POST');
  await scanArchive(page);
});

test('reference-only scripture activity can be downloaded', async ({
  page,
}) => {
  let method = '';
  await page.route(exportRoute, (route) => {
    method = route.request().method();
    return route.fulfill({
      body: 'reference-only export',
      headers: {
        'content-disposition': `attachment; filename="${exportFileName}"`,
        'content-type': 'application/zip',
      },
      status: 200,
    });
  });
  await mountArchivePage(page, referenceOnly);
  await expect(page.getByText('Nothing has been written yet')).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Download the journal' });
  await expect(button).toBeVisible();
  await scanArchive(page);

  const downloadStarted = page.waitForEvent('download');
  await button.click();
  const download = await downloadStarted;

  expect(method).toBe('POST');
  expect(download.suggestedFilename()).toBe(exportFileName);
});

for (const colorScheme of colorSchemes) {
  test(`a real private 503 offers focused export recovery in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    const styleSheetHref = await productionStyleSheetHref(page);
    await page.route(exportRoute, (route) =>
      answerWithUnavailableExport(route, styleSheetHref),
    );
    await mountArchivePage(page, referenceOnly);
    const responsePromise = page.waitForResponse(exportRoute);
    await page.getByRole('button', { name: 'Download the journal' }).click();
    const response = await responsePromise;

    expect(response.status()).toBe(unavailableStatus);
    expect(response.headers()['cache-control']).toBe(
      'private, no-store, max-age=0',
    );
    expect(response.headers().pragma).toBe('no-cache');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    await expect(page).toHaveTitle('Export unavailable | Postlude');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Export unavailable' }),
    ).toBeVisible();
    const recovery = page.getByRole('link', { name: 'Return to archive' });
    await expect(page.locator(`link[href="${styleSheetHref}"]`)).toHaveCount(1);
    await expect(recovery).toBeFocused();
    await expect(page.getByText('Your journal is unchanged.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(privateFailureDetail);
    const contrasts = await recoveryActionContrasts(page, recovery);
    expect(contrasts.hoverText).toBeGreaterThanOrEqual(textContrastMinimum);
    expect(contrasts.focusIndicator).toBeGreaterThanOrEqual(
      nonTextContrastMinimum,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await scanArchive(page);
  });
}
