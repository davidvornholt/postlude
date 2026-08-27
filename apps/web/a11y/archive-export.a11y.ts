import type * as playwright from '@playwright/test';
import { expect, test } from '@playwright/test';
import { zipSync } from 'fflate';

import {
  archiveFixtureConfigs,
  mountArchivePage,
  mountArchivePageWithoutJavaScript,
  scanArchive,
} from './archive-page-test-support.ts';

test.describe.configure({ mode: 'serial' });

const colorSchemes = ['light', 'dark'] as const;
const exportRoute = '**/archive/export';
const exportFileName = 'postlude-2026-08-26.zip';
const kibibyte = 1024;
const exportPayloadKibibytes = 192;
const byteCycle = 251;
const exportPayload = Uint8Array.from(
  { length: exportPayloadKibibytes * kibibyte },
  (_, index) => index % byteCycle,
);
const exportBytes = zipSync({ 'journal.bin': exportPayload }, { level: 0 });

const answerWithDownload = (route: playwright.Route) =>
  route.fulfill({
    body: Buffer.from(exportBytes),
    headers: {
      'content-disposition': `attachment; filename="${exportFileName}"`,
      'content-type': 'application/zip',
    },
    status: 200,
  });

const submitHydratedForm = (button: playwright.Locator): Promise<unknown> =>
  button.evaluate((element) => {
    const form = element.closest('form');
    if (form === null) {
      throw new Error('The export button has no form.');
    }
    return form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });

test('a hydrated download settles once, submits once, and keeps focus', async ({
  page,
}) => {
  let posts = 0;
  await page.route(exportRoute, (route) => {
    posts += 1;
    return answerWithDownload(route);
  });
  await mountArchivePage(page, archiveFixtureConfigs.exportDelayed);
  const button = page.locator('form[action="/archive/export"] button');
  await button.focus();
  const downloadStarted = page.waitForEvent('download');
  await submitHydratedForm(button);
  await expect(button).toHaveText('Saving before download …');
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await submitHydratedForm(button);

  const download = await downloadStarted;
  expect(download.suggestedFilename()).toBe(exportFileName);
  const stream = await download.createReadStream();
  if (stream === null) {
    throw new Error('The browser did not expose the downloaded bytes.');
  }
  const chunks: Array<Buffer> = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  expect(chunks.length).toBeGreaterThan(0);
  expect(Buffer.concat(chunks)).toEqual(Buffer.from(exportBytes));
  expect(posts).toBe(1);
  await expect(page.locator('html')).toHaveAttribute(
    'data-export-settle-calls',
    '1',
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-export-settle-status',
    'stored',
  );
  await expect(button).toBeFocused();
  await expect(button).toHaveText('Download the journal');
});

test('the server-rendered form downloads without hydrated JavaScript', async ({
  page,
}) => {
  let method = '';
  await page.route(exportRoute, (route) => {
    method = route.request().method();
    return answerWithDownload(route);
  });
  await mountArchivePageWithoutJavaScript(page, archiveFixtureConfigs.filled);
  const downloadStarted = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download the journal' }).click();
  const download = await downloadStarted;

  expect(method).toBe('POST');
  expect(download.suggestedFilename()).toBe(exportFileName);
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-export-settle-calls',
  );
});

for (const colorScheme of colorSchemes) {
  test(`a pending export stays single and passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    let posts = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/archive/export')) {
        posts += 1;
      }
    });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.exportPending);
    const button = page.locator('form[action="/archive/export"] button');
    await button.focus();
    await submitHydratedForm(button);
    await submitHydratedForm(button);

    await expect(button).toHaveText('Saving before download …');
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute(
      'data-export-settle-calls',
      '1',
    );
    expect(posts).toBe(0);
    await scanArchive(page);
  });

  test(`a failed autosave blocks the export and passes WCAG 2.2 AA in ${colorScheme} mode`, async ({
    page,
  }) => {
    let posts = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/archive/export')) {
        posts += 1;
      }
    });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mountArchivePage(page, archiveFixtureConfigs.exportFailed);
    const button = page.locator('form[action="/archive/export"] button');
    await button.focus();
    await submitHydratedForm(button);

    await expect(page.getByRole('alert')).toContainText(
      'the download did not start',
    );
    await expect(button).toHaveAttribute(
      'aria-describedby',
      'journal-export-failure',
    );
    await expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await expect(button).toBeFocused();
    expect(posts).toBe(0);
    await scanArchive(page);
  });
}
