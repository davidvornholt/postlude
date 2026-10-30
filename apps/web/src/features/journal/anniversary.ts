/**
 * What the writer wrote on this same date in earlier years.
 *
 * These memories live on their own reading page, away from the surface where
 * today's entry is written. The page asks about one date at a time, so the
 * years line up as one quiet sequence rather than interrupting a draft.
 *
 * The server sends both complete sections. Their Markdown stays intact so the
 * retrospective preserves the paragraph rhythm and structure of the day page.
 *
 * February 29 has no date of its own in three years out of four, and the page
 * only reads dates of the current year. A leap day written in an earlier year
 * is therefore read on February 28 when the current year has no February 29,
 * beside that day's own memories and marked as the leap day it was. In a leap
 * year it is read on February 29 alone, so no memory appears on two dates.
 */

import {
  formatJournalDate,
  isJournalDate,
  type JournalDate,
  parseJournalDate,
} from './journal-day.ts';
import type { EntryPreview } from './schemas/entry-preview.ts';
import type { ScriptureReference } from './scripture-reference.ts';

/** One earlier year's entry for the date being read. */
export type Anniversary = {
  readonly date: JournalDate;
  readonly journalMarkdown: string;
  readonly scriptureMarkdown: string;
  readonly scriptureReference?: ScriptureReference;
  /**
   * Set on a leap day read on February 28 because the year being read has no
   * February 29. Its date then differs from the page's, so the page says why.
   */
  readonly leapDayOnFebruary28?: true;
  readonly yearsAgo: number;
  readonly words: number;
};

/**
 * How many years back the page offers at once. A long journal would otherwise
 * put a decade of memories into one visit, and the nearest years are the ones
 * the writer is most likely to read. A leap day read on February 28 shares its
 * year's place with that year's February 28 rather than costing an older year.
 */
export const anniversaryLimit = 4;

/** Where the month and day begin in an ISO date. */
export const isoMonthStart = 5;

const februaryLastCommonDay = '02-28';
const leapDay = '02-29';

const hasLeapDay = (year: number): boolean =>
  isJournalDate(formatJournalDate({ year, month: 2, day: 29 }));

/**
 * The `MM-DD` days whose earlier entries are memories of `on`. Only February 28
 * of a year without a February 29 reads two, its own and the missing leap day.
 */
export const anniversaryMonthDays = (
  on: JournalDate,
): ReadonlyArray<string> => {
  const monthDay = on.slice(isoMonthStart);
  return monthDay === februaryLastCommonDay &&
    !hasLeapDay(parseJournalDate(on).year)
    ? [februaryLastCommonDay, leapDay]
    : [monthDay];
};

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
    ...(entry.date.slice(isoMonthStart) === leapDay &&
    on.slice(isoMonthStart) === februaryLastCommonDay
      ? { leapDayOnFebruary28: true }
      : {}),
    yearsAgo: parseJournalDate(on).year - parseJournalDate(entry.date).year,
    words: entry.journalWordCount + entry.scriptureWordCount,
  });
