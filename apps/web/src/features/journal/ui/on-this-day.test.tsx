import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  openingTag,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { OnThisDay } from './on-this-day.tsx';

const today = '2027-03-04';
const leapDayNote =
  'Written on a leap day, and shown on February 28 because this year has no February 29.';
const button = /<button\b[^>]*>(?<text>.*?)<\/button>/gsu;
const tag = /<[^>]+>/gu;

/** What each button reads as, which is what opening a year is named by. */
const buttonTexts = (html: string): ReadonlyArray<string> =>
  Array.from(html.matchAll(button), (match) =>
    plainText(match.groups?.text ?? ''),
  );

it('names a leap day read on February 28 by its own date and says why it is there', async () => {
  const html = await renderInRouter(
    <OnThisDay
      anniversaries={[
        {
          date: '2024-02-29',
          journalMarkdown: 'The extra day went to the garden.',
          leapDayOnFebruary28: true,
          scriptureMarkdown: '',
          yearsAgo: 3,
          words: 6,
        },
        {
          date: '2024-02-28',
          journalMarkdown: 'The usual last day of February.',
          scriptureMarkdown: '',
          yearsAgo: 3,
          words: 6,
        },
      ]}
      date="2027-02-28"
      today={today}
    />,
  );
  const text = plainText(html);

  // The note is part of what opens the year, so it is heard with its date.
  expect(
    buttonTexts(html).filter((name) => name.includes(leapDayNote)),
  ).toEqual([
    `3 years ago · Thursday, February 29, 2024${leapDayNote}The extra day went to the garden.`,
  ]);
  expect(html).toContain('href="/day/2024-02-29"');
  // The day's own memory carries no note, so the line belongs to one memory.
  expect(text.split(leapDayNote)).toHaveLength(2);
  expect(text).toContain(
    '3 years ago · Wednesday, February 28, 2024The usual last day of February.',
  );
});

it('folds each year to its opening and keeps a studied topic', async () => {
  const html = await renderInRouter(
    <OnThisDay
      anniversaries={[
        {
          date: '2025-11-07',
          journalMarkdown: '',
          scriptureMarkdown: '',
          scriptureTopic: 'Patience',
          yearsAgo: 1,
          words: 0,
        },
      ]}
      date="2026-11-07"
      today="2026-11-07"
    />,
  );
  const text = plainText(html);

  const toggle = openingTag(html, 'button');
  const bodyId = attributeValue(toggle, 'aria-controls');
  const body = html
    .match(tag)
    ?.find((opening) => opening.includes(`id="${bodyId}"`));

  // Folded, the year's words are on the page but out of reach until opened.
  expect(attributeValue(toggle, 'aria-expanded')).toBe('false');
  expect(bodyId).not.toBe('');
  expect(body).toContain(' inert=""');
  // The folded year shows the topic as its opening, and the open year shows
  // it as the morning's study.
  expect(text.split('Patience')).toHaveLength(3);
  expect(text).toContain('Open this day');
});

it('says when no earlier year has this date', async () => {
  const html = await renderInRouter(
    <OnThisDay anniversaries={[]} date="2026-11-07" today="2026-11-07" />,
  );

  expect(plainText(html)).toContain(
    'On this dayNothing was written on this date in an earlier year.',
  );
  expect(html).not.toContain('aria-expanded');
});
