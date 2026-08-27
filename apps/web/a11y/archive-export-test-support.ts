import type * as playwright from '@playwright/test';
import { zipSync } from 'fflate';

export const exportRoute = '**/archive/export';
export const exportButton = (page: playwright.Page): playwright.Locator =>
  page.locator('form[action="/archive/export"] button');

export const exportCases = {
  day: {
    fileName: 'postlude-2026-08-26-daily.zip',
    grouping: 'day',
    label: 'Day',
  },
  week: {
    fileName: 'postlude-2026-08-26-weekly.zip',
    grouping: 'week',
    label: 'Week',
  },
  month: {
    fileName: 'postlude-2026-08-26-monthly.zip',
    grouping: 'month',
    label: 'Month',
  },
  year: {
    fileName: 'postlude-2026-08-26-yearly.zip',
    grouping: 'year',
    label: 'Year',
  },
} as const;

const kibibyte = 1024;
const exportPayloadKibibytes = 192;
const byteCycle = 251;
export const exportBytes = zipSync(
  {
    'journal.bin': Uint8Array.from(
      { length: exportPayloadKibibytes * kibibyte },
      (_, index) => index % byteCycle,
    ),
  },
  { level: 0 },
);

export const postedGrouping = (route: playwright.Route): string =>
  new URLSearchParams(route.request().postData() ?? '').get('grouping') ?? '';

export const answerWithDownload = (route: playwright.Route, fileName: string) =>
  route.fulfill({
    body: Buffer.from(exportBytes),
    headers: {
      'content-disposition': `attachment; filename="${fileName}"`,
      'content-type': 'application/zip',
    },
    status: 200,
  });

export const submitHydratedForm = (
  button: playwright.Locator,
): Promise<unknown> =>
  button.evaluate((element) => {
    const form = element.closest('form');
    if (form === null) {
      throw new Error('The export button has no form.');
    }
    return form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });

export const downloadedBytes = async (
  download: playwright.Download,
): Promise<Buffer> => {
  const stream = await download.createReadStream();
  if (stream === null) {
    throw new Error('The browser did not expose the downloaded bytes.');
  }
  const chunks: Array<Buffer> = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};
