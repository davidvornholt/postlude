import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';

import {
  blankDay,
  sampleInsightsView,
} from '../src/features/journal/testing/insights-view.ts';
import { applyPrivateResponseHeaders } from '../src/shared/auth/private-response.ts';
import { runSessionRequired } from '../src/shared/auth/session-required.ts';
import type { InsightsPageFixtureConfig } from './insights-page-fixture-contract.ts';
import {
  mountInsightsPage,
  scanInsights,
} from './insights-page-test-support.ts';
import {
  answerWithUnavailableExport,
  privateFailureDetail,
  productionStyleSheetHrefs,
  recoveryActionContrasts,
  recoveryFonts,
} from './journal-export-recovery-test-support.ts';
import {
  expectPageFrameGeometry,
  expectReadingMeasureGeometry,
} from './reading-comfort-test-support.ts';

test.describe.configure({ mode: 'serial' });

const today = '2026-08-26';
const currentYear = 2026;
const exportRoute = '**/insights/export';
const loginUrl = /\/login$/u;
const exportFileName = 'postlude-2026-08-26-daily.zip';
const colorSchemes = ['light', 'dark'] as const;
const unavailableStatus = 503;
const textContrastMinimum = 4.5;
const nonTextContrastMinimum = 3;
/** A morning with only a passage named: no words, but source to export. */
const referenceOnly: InsightsPageFixtureConfig = {
  exportSettlement: { delayMs: 0, outcome: 'stored' },
  view: sampleInsightsView(
    [{ ...blankDay(today), hasScripture: true, scriptureBook: 'Psalms' }],
    { kind: 'year', year: currentYear },
    today,
  ),
};

const answerWithoutSession = async (route: playwright.Route): Promise<void> => {
  const publishedHeaders = new Headers();
  const result = await runSessionRequired({
    transport: 'route',
    authorize: () => Promise.resolve(false),
    next: () => Promise.resolve('private export'),
    publishHeaders: () => applyPrivateResponseHeaders(publishedHeaders),
    publishStatus: () => undefined,
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
  await mountInsightsPage(page, referenceOnly);
  await page.getByRole('button', { name: 'Download the journal' }).click();

  await expect(page).toHaveURL(loginUrl);
  await expect(page.getByRole('heading', { name: 'Postlude' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign in with GitHub' }),
  ).toBeVisible();
  expect(method).toBe('POST');
  await scanInsights(page);
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
  await mountInsightsPage(page, referenceOnly);
  await expect(
    page.getByText('Nothing written yet. Insights fill in as the days do.'),
  ).toHaveCount(0);
  const button = page.getByRole('button', { name: 'Download the journal' });
  await expect(button).toBeVisible();
  await scanInsights(page);

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
    const styleSheetHrefs = await productionStyleSheetHrefs(page);
    await page.route(exportRoute, (route) =>
      answerWithUnavailableExport(route, styleSheetHrefs),
    );
    await mountInsightsPage(page, referenceOnly);
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
    const recovery = page.getByRole('link', { name: 'Return to Insights' });
    await Promise.all(
      styleSheetHrefs.map((href) =>
        expect(page.locator(`link[href="${href}"]`)).toHaveCount(1),
      ),
    );
    await expect(recovery).toBeFocused();
    const message = page.getByText('Your journal is unchanged.');
    await expect(message).toBeVisible();
    await expectPageFrameGeometry(message.locator('xpath=../..'));
    await expectReadingMeasureGeometry(page, message);
    await expect(page.locator('body')).not.toContainText(privateFailureDetail);
    const fonts = await recoveryFonts(page);
    expect(fonts.bodyFamily).toContain('Inter Variable');
    expect(fonts.displayFamily).toContain('Fraunces Variable');
    expect(fonts.interLoaded).toBe(true);
    expect(fonts.frauncesLoaded).toBe(true);
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
    await scanInsights(page);
  });
}
