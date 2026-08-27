/**
 * The one thing an anniversary claims that the types do not: how long ago it
 * was. The count is taken against the day being read rather than against
 * today, which is what lets the same entry read as "3 years ago" on one page
 * and "4 years ago" on another without either being wrong.
 */

import { expect, it } from 'bun:test';

import { anniversaryOf } from './anniversary.ts';
import type { AnniversaryEntry } from './schemas/anniversary-entry.ts';

const entry = (date: string, markdown: string): AnniversaryEntry => ({
  date,
  journalMarkdown: markdown,
  journalWordCount: markdown === '' ? 0 : markdown.split(' ').length,
  scriptureMarkdown: '',
  scriptureWordCount: 0,
});

const threeYears = 3;
const fourYears = 4;

it('counts the years back from the day being read, not from today', () => {
  const written = entry('2022-08-24', 'The rain fell all night.');

  expect(anniversaryOf('2026-08-24')(written).yearsAgo).toBe(fourYears);
  expect(anniversaryOf('2025-08-24')(written).yearsAgo).toBe(threeYears);
});

/*
 * The snippet is the entry's own words rather than the markdown carrying them,
 * because it is shown as prose. A heading left as `## Morning` would put its
 * hashes in front of the sentence the writer is meant to recognise.
 */
it('opens with the words, not with the markdown around them', () => {
  const written = entry('2022-08-24', '## Late\n\nThe rain fell all night.');

  expect(anniversaryOf('2026-08-24')(written).snippet).toBe(
    'Late The rain fell all night.',
  );
});

it('falls back to scripture prose when the evening is empty', () => {
  const written = {
    ...entry('2022-08-24', ''),
    scriptureMarkdown: '## Morning\n\nMercy arrived early.',
    scriptureWordCount: 4,
  };

  expect(anniversaryOf('2026-08-24')(written).snippet).toBe(
    'Morning Mercy arrived early.',
  );
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
