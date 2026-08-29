import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import { plainText } from '#/shared/testing/rendered-html.ts';
import { entryOn, renderDay } from './day-page-test-support.tsx';
import { OnThisDayPage } from './on-this-day-page.tsx';

const today = '2026-08-26';
const longMemorySentenceCount = 20;
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
            journalMarkdown: 'Moved the desk under the window.',
            scriptureMarkdown: '',
            yearsAgo: 1,
            words: 210,
          },
        ],
      }}
    />,
  );

  expect(html).toContain('Moved the desk under the window.');
  expect(plainText(html)).toContain('1 year ago · Tuesday, August 26, 2025');
  expect(html).toContain('href="/day/2025-08-26"');
});

it('shows the complete memory rather than an excerpt', async () => {
  const ending = 'The final sentence is still here.';
  const html = await renderInRouter(
    <OnThisDayPage
      view={{
        ...view,
        anniversaries: [
          {
            date: '2025-08-26',
            journalMarkdown: `${'A sentence from the day. '.repeat(longMemorySentenceCount)}${ending}`,
            scriptureMarkdown: '',
            yearsAgo: 1,
            words: 240,
          },
        ],
      }}
    />,
  );

  expect(plainText(html)).toContain(ending);
  expect(html).not.toContain('…');
});

it('preserves paragraph spacing and shows both parts of the day', async () => {
  const html = await renderInRouter(
    <OnThisDayPage
      view={{
        ...view,
        anniversaries: [
          {
            date: '2025-08-26',
            journalMarkdown:
              'First evening paragraph.\n\nSecond evening paragraph.',
            scriptureMarkdown: 'Patience is not passive.',
            scriptureReference: {
              book: 'James',
              chapter: 5,
              verseStart: 7,
              verseEnd: 8,
            },
            yearsAgo: 1,
            words: 12,
          },
        ],
      }}
    />,
  );

  expect(html).toContain('journal-prose');
  expect(html).toContain('<p>First evening paragraph.</p>');
  expect(html).toContain('<p>Second evening paragraph.</p>');
  const text = plainText(html);
  expect(text.split('James 5:7-8')).toHaveLength(2);
  expect(text).toContain('Patience is not passive.');
  expect(text).toContain('Evening');
  expect(html).toContain('href="https://www.bibleserver.com/');
});

it('keeps a memory visible when its stored scripture book has no external link', async () => {
  const html = await renderInRouter(
    <OnThisDayPage
      view={{
        ...view,
        anniversaries: [
          {
            date: '2025-08-26',
            journalMarkdown: 'The evening memory remains available.',
            scriptureMarkdown: 'A note about the morning.',
            scriptureReference: {
              book: 'Hesiod',
              chapter: 1,
            },
            yearsAgo: 1,
            words: 10,
          },
        ],
      }}
    />,
  );

  expect(plainText(html)).toContain('Hesiod 1');
  expect(plainText(html)).toContain('The evening memory remains available.');
  expect(html).not.toContain('href="https://www.bibleserver.com/');
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
