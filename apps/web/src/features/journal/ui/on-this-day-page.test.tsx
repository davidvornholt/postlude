import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import { plainText } from '#/shared/testing/rendered-html.ts';
import { entryOn, renderDay } from './day-page-test-support.tsx';
import { OnThisDayPage } from './on-this-day-page.tsx';

const today = '2026-08-26';
const view = {
  anniversaries: [],
  date: today,
  today,
} as const;

it('reads back an earlier year and opens the day it came from', async () => {
  const html = await renderInRouter(
    <OnThisDayPage
      view={{
        ...view,
        anniversaries: [
          {
            date: '2025-08-26',
            yearsAgo: 1,
            words: 210,
            snippet: 'Moved the desk under the window.',
          },
        ],
      }}
    />,
  );

  expect(html).toContain('Moved the desk under the window.');
  expect(plainText(html)).toContain('1 year ago · Tuesday, August 26, 2025');
  expect(html).toContain('href="/day/2025-08-26"');
});

it('gives an unwritten anniversary date a quiet empty state', async () => {
  const html = await renderInRouter(<OnThisDayPage view={view} />);

  expect(plainText(html)).toContain(
    'Nothing was written on this date in an earlier year.',
  );
});

it('moves through retrospective dates and offers a direct return to today', async () => {
  const html = await renderInRouter(
    <OnThisDayPage view={{ ...view, date: '2026-08-25' }} />,
  );

  expect(html).toContain('aria-label="Previous date"');
  expect(html).toContain('date=2026-08-24');
  expect(html).toContain('aria-label="Next date"');
  expect(html).toContain('href="/on-this-day"');
  expect(plainText(html)).toContain('Today');
});

it("moves from today into tomorrow's earlier years", async () => {
  const html = await renderInRouter(<OnThisDayPage view={view} />);

  expect(html).toContain('aria-label="Next date"');
  expect(html).toContain('date=2026-08-27');
});

it('stops adjacent-date navigation at the current year boundaries', async () => {
  const [first, last] = await Promise.all([
    renderInRouter(<OnThisDayPage view={{ ...view, date: '2026-01-01' }} />),
    renderInRouter(<OnThisDayPage view={{ ...view, date: '2026-12-31' }} />),
  ]);

  expect(first).not.toContain('aria-label="Previous date"');
  expect(first).toContain('aria-label="Next date"');
  expect(last).toContain('aria-label="Previous date"');
  expect(last).not.toContain('aria-label="Next date"');
});

it('keeps retrospective entries off the writing page', async () => {
  expect(await renderDay(entryOn())).not.toContain('On this day');
});
