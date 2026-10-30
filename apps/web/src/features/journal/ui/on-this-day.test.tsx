import { expect, it } from 'bun:test';

import { renderInRouter } from '#/shared/testing/render-in-router.tsx';
import {
  attributeValue,
  openingTag,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { OnThisDay } from './on-this-day.tsx';

const today = '2027-02-28';
const leapDayNote =
  'Written on a leap day, and shown on February 28 because this year has no February 29.';

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
      today={today}
    />,
  );
  const text = plainText(html);
  const leapDay = openingTag(html, 'article');

  expect(text).toContain(
    `3 years ago · Thursday, February 29, 2024${leapDayNote}The extra day went to the garden.`,
  );
  expect(html).toContain('href="/day/2024-02-29"');
  expect(attributeValue(leapDay, 'aria-describedby')).toBe(
    'anniversary-2024-02-29-note',
  );
  expect(html).toContain('id="anniversary-2024-02-29-note"');
  expect(html.split('aria-describedby=')).toHaveLength(2);
  // The day's own memory carries no note, so the line belongs to one memory.
  expect(text.split(leapDayNote)).toHaveLength(2);
  expect(text).toContain(
    '3 years ago · Wednesday, February 28, 2024The usual last day of February.',
  );
});
