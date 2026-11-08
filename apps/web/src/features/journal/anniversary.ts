/**
 * What the writer wrote on the same date in the years before the day being
 * read, which the day page ends on.
 *
 * The server sends both complete sections. Their Markdown stays intact so a
 * memory keeps the paragraph rhythm and structure it was written with.
 *
 * February 29 has no date of its own in three years out of four. A leap day
 * written in an earlier year is therefore read on February 28 when the year
 * being read has no February 29, beside that day's own memories and marked as
 * the leap day it was. In a leap year it is read on February 29 alone, so no
 * memory appears on two dates of one year.
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
  readonly scriptureTopic?: string;
  readonly leapDayOnFebruary28?: true;
  readonly yearsAgo: number;
  readonly words: number;
};

/**
 * How many years back a day offers at once. A long journal would otherwise
 * put a decade of memories under one day, and the nearest years are the ones
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

export const anniversaryMonthDays = (
  on: JournalDate,
): ReadonlyArray<string> => {
  const monthDay = on.slice(isoMonthStart);
  return monthDay === februaryLastCommonDay &&
    !hasLeapDay(parseJournalDate(on).year)
    ? [februaryLastCommonDay, leapDay]
    : [monthDay];
};

/**
 * `on` is the day being read. Keeping it explicit makes the count of years
 * agree with that day rather than with today or a device clock.
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
    ...(entry.scriptureTopic === undefined
      ? {}
      : { scriptureTopic: entry.scriptureTopic }),
    ...(entry.date.slice(isoMonthStart) === leapDay &&
    on.slice(isoMonthStart) === februaryLastCommonDay
      ? { leapDayOnFebruary28: true }
      : {}),
    yearsAgo: parseJournalDate(on).year - parseJournalDate(entry.date).year,
    words: entry.journalWordCount + entry.scriptureWordCount,
  });
