import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import { plainText } from '#/shared/testing/rendered-html.ts';
import type { CalendarView } from '../services/calendar-fns.ts';
import { CalendarPage } from './calendar-page.tsx';

const today = '2026-08-26';
const augustPaddingCells = 11;
const view: CalendarView = {
  days: [
    {
      date: '2026-08-19',
      hasScriptureReference: false,
      revision: 2,
      snippet: 'A quiet kind of progress.',
      words: 120,
    },
    {
      date: '2026-08-20',
      hasScriptureReference: false,
      revision: 1,
      snippet: '',
      words: 0,
    },
    {
      date: '2026-08-25',
      hasScriptureReference: true,
      revision: 1,
      snippet: '',
      words: 0,
    },
  ],
  earliest: '2025-03-02',
  month: '2026-08',
  today,
};

it('selects a day in the URL-backed month and previews its writing', async () => {
  const html = await renderInRouter(
    <CalendarPage requestedDay="2026-08-19" view={view} />,
  );

  expect(plainText(html)).toContain('August 2026');
  expect(plainText(html)).toContain('Wednesday, August 19, 2026');
  expect(plainText(html)).toContain('A quiet kind of progress.');
  expect(html).toContain('aria-current="date"');
  expect(html).toContain('href="/day/2026-08-19"');
});

it('keeps future dates inert and gives reference-only days a readable preview', async () => {
  const html = await renderInRouter(
    <CalendarPage requestedDay="2026-08-25" view={view} />,
  );

  expect(plainText(html)).toContain('A scripture passage was noted.');
  expect(html).not.toContain('day=2026-08-27');
});

it('distinguishes stored Markdown from an unwritten day', async () => {
  const html = await renderInRouter(
    <CalendarPage requestedDay="2026-08-20" view={view} />,
  );

  expect(plainText(html)).toContain(
    'This day contains Markdown without readable prose.',
  );
});

it('shows the selected empty day and still offers its writing page', async () => {
  const html = await renderInRouter(
    <CalendarPage requestedDay="2026-08-24" view={view} />,
  );

  expect(plainText(html)).toContain('Nothing was written on this day.');
  expect(html).toContain('href="/day/2026-08-24"');
});

it('completes the first and last calendar weeks with inert ruled cells', async () => {
  const html = await renderInRouter(
    <CalendarPage requestedDay="2026-08-19" view={view} />,
  );

  expect(html.match(/data-calendar-padding="true"/gu)).toHaveLength(
    augustPaddingCells,
  );
});
