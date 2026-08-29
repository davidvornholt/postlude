/**
 * What the writer wrote on this same date in earlier years.
 *
 * These memories live on their own reading page, away from the surface where
 * today's entry is written. The page asks about one date at a time, so the
 * years line up as one quiet sequence rather than interrupting a draft.
 *
 * The server sends both complete sections. Their Markdown stays intact so the
 * retrospective preserves the paragraph rhythm and structure of the day page.
 */

import {
  formatJournalDate,
  type JournalDate,
  parseJournalDate,
} from './journal-day.ts';
import type { EntryPreview } from './schemas/entry-preview.ts';
import type { ScriptureReference } from './scripture-reference.ts';

/** One earlier year's entry for the same day of the month. */
export type Anniversary = {
  readonly date: JournalDate;
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  readonly scriptureReference?: ScriptureReference;
  readonly yearsAgo: number;
  readonly words: number;
};

/**
 * How many years back the page offers at once. A long journal would otherwise
 * put a decade of memories into one visit, and the nearest years are the ones
 * the writer is most likely to read.
 */
export const anniversaryLimit = 4;

/** Where the month and day begin in an ISO date. */
export const isoMonthStart = 5;

export const onThisDayBounds = (
  today: JournalDate,
): { readonly first: JournalDate; readonly last: JournalDate } => {
  const { year } = parseJournalDate(today);
  return {
    first: formatJournalDate({ year, month: 1, day: 1 }),
    last: formatJournalDate({ year, month: 12, day: 31 }),
  };
};

/** A retrospective can inspect every month and day in the current year. */
export const onThisDayDate = (
  requested: JournalDate | undefined,
  today: JournalDate,
): JournalDate => {
  if (requested === undefined) {
    return today;
  }
  const { first, last } = onThisDayBounds(today);
  if (requested < first) {
    return first;
  }
  return requested > last ? last : requested;
};

/**
 * `on` is the date whose history the page is reading. Keeping it explicit makes
 * the count agree with the date beside it without consulting a device clock.
 */
export const anniversaryOf =
  (on: JournalDate) =>
  (entry: EntryPreview): Anniversary => ({
    date: entry.date,
    journalMarkdown: entry.journalMarkdown,
    scriptureMarkdown: entry.scriptureMarkdown,
    ...(entry.scriptureReference === undefined
      ? {}
      : { scriptureReference: entry.scriptureReference }),
    yearsAgo: parseJournalDate(on).year - parseJournalDate(entry.date).year,
    words: entry.journalWordCount + entry.scriptureWordCount,
  });
