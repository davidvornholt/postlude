/**
 * What an anniversary claims that the types do not: which earlier days count as
 * the date being read, and how long ago each was. The count is taken against
 * the day being read rather than against today, which is what lets the same
 * entry read as "3 years ago" on one page and "4 years ago" on another without
 * either being wrong.
 */

import { expect, it } from 'bun:test';

import {
  anniversaryMonthDays,
  anniversaryOf,
  onThisDayBounds,
  onThisDayDate,
} from './anniversary.ts';
import { journalDateAt } from './journal-day.ts';
import type { EntryPreview } from './schemas/entry-preview.ts';

const entry = (date: string, markdown: string): EntryPreview => ({
  date,
  journalMarkdown: markdown,
  journalWordCount: markdown === '' ? 0 : markdown.split(' ').length,
  revision: 1,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
});

const threeYears = 3;
const fourYears = 4;
const longMemorySentenceCount = 20;

it('keeps dates in the current year, including dates after today', () => {
  expect(onThisDayDate('2026-08-25', '2026-08-26')).toBe('2026-08-25');
  expect(onThisDayDate(undefined, '2026-08-26')).toBe('2026-08-26');
  expect(onThisDayDate('2026-08-27', '2026-08-26')).toBe('2026-08-27');
});

it('bounds retrospective browsing to the current calendar year', () => {
  expect(onThisDayBounds('2026-08-26')).toEqual({
    first: '2026-01-01',
    last: '2026-12-31',
  });
  expect(onThisDayDate('2025-12-31', '2026-08-26')).toBe('2026-01-01');
  expect(onThisDayDate('2027-01-01', '2026-08-26')).toBe('2026-12-31');
});

/*
 * February 29 is a date in one year out of four, and the page only offers dates
 * of the current year. Without February 28 standing in for it, a leap day would
 * be unreadable here for three years at a time.
 */
it('reads the leap day on February 28 of a year without one', () => {
  expect(anniversaryMonthDays('2027-02-28')).toEqual(['02-28', '02-29']);
  // 2100 is divisible by four but not a leap year.
  expect(anniversaryMonthDays('2100-02-28')).toEqual(['02-28', '02-29']);
  expect(anniversaryMonthDays('2027-03-01')).toEqual(['03-01']);
});

it('reads the leap day only on February 29 in a leap year', () => {
  expect(anniversaryMonthDays('2028-02-29')).toEqual(['02-29']);
  expect(anniversaryMonthDays('2028-02-28')).toEqual(['02-28']);
  // 2000 is a century year that is still a leap year.
  expect(anniversaryMonthDays('2000-02-28')).toEqual(['02-28']);
});

/*
 * The page's own date comes from the clock when no date is asked for, and the
 * journal day runs from 04:00. The small hours of March 1 are still February 28,
 * so they still read the leap day.
 */
it('takes the leap day from the journal day, which ends at 04:00', () => {
  const berlin = 'Europe/Berlin';
  const today = (utcClock: string) =>
    onThisDayDate(undefined, journalDateAt(new Date(`${utcClock}Z`), berlin));

  // 03:59:59 and 04:00:00 in Berlin, an hour ahead of UTC in winter.
  expect(anniversaryMonthDays(today('2027-03-01T02:59:59'))).toEqual([
    '02-28',
    '02-29',
  ]);
  expect(anniversaryMonthDays(today('2027-03-01T03:00:00'))).toEqual(['03-01']);
  expect(anniversaryMonthDays(today('2028-03-01T02:59:59'))).toEqual(['02-29']);
});

it('marks a leap day read on February 28 and nothing else', () => {
  const leapDay = entry('2024-02-29', 'An extra day.');

  expect(anniversaryOf('2027-02-28')(leapDay)).toMatchObject({
    date: '2024-02-29',
    leapDayOnFebruary28: true,
    yearsAgo: threeYears,
  });
  expect(
    anniversaryOf('2027-02-28')(entry('2024-02-28', 'The usual day.')),
  ).not.toHaveProperty('leapDayOnFebruary28');
  expect(anniversaryOf('2028-02-29')(leapDay)).not.toHaveProperty(
    'leapDayOnFebruary28',
  );
});

it('counts the years back from the day being read, not from today', () => {
  const written = entry('2022-08-24', 'The rain fell all night.');

  expect(anniversaryOf('2026-08-24')(written).yearsAgo).toBe(fourYears);
  expect(anniversaryOf('2025-08-24')(written).yearsAgo).toBe(threeYears);
});

it('keeps the exact evening Markdown for semantic rendering', () => {
  const written = entry('2022-08-24', '## Late\n\nThe rain fell all night.');

  expect(anniversaryOf('2026-08-24')(written).journalMarkdown).toBe(
    '## Late\n\nThe rain fell all night.',
  );
});

it('keeps the whole memory instead of cutting it to an opening', () => {
  const ending = 'The last thought stays visible.';
  const written = entry(
    '2022-08-24',
    `${'A sentence from the day. '.repeat(longMemorySentenceCount)}${ending}`,
  );

  expect(anniversaryOf('2026-08-24')(written).journalMarkdown).toContain(
    ending,
  );
});

it('keeps morning scripture beside the evening instead of choosing one', () => {
  const written = {
    ...entry('2022-08-24', 'The day ended quietly.'),
    scriptureMarkdown: '## Morning\n\nMercy arrived early.',
    scriptureReference: {
      book: 'James',
      chapter: 5,
      verseStart: 7,
      verseEnd: 8,
    },
    scriptureWordCount: 4,
  };
  const anniversary = anniversaryOf('2026-08-24')(written);

  expect(anniversary).toMatchObject({
    journalMarkdown: 'The day ended quietly.',
    scriptureMarkdown: '## Morning\n\nMercy arrived early.',
    scriptureReference: {
      book: 'James',
      chapter: 5,
      verseStart: 7,
      verseEnd: 8,
    },
  });
  expect(anniversary.scriptureReference).toEqual(written.scriptureReference);
});

/*
 * Both halves of a day count. A day whose weight was in the morning passage
 * would otherwise report as a handful of words next to its own opening line.
 */
it('counts the morning and the evening as one day of writing', () => {
  const written = {
    ...entry('2022-08-24', 'Two words'),
    scriptureWordCount: 5,
  };
  const totalWords = 7;

  expect(anniversaryOf('2026-08-24')(written).words).toBe(totalWords);
});
