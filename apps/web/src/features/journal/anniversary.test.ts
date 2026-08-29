/**
 * The one thing an anniversary claims that the types do not: how long ago it
 * was. The count is taken against the day being read rather than against
 * today, which is what lets the same entry read as "3 years ago" on one page
 * and "4 years ago" on another without either being wrong.
 */

import { expect, it } from 'bun:test';

import {
  anniversaryOf,
  onThisDayBounds,
  onThisDayDate,
} from './anniversary.ts';
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
