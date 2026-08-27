/**
 * What the writer wrote on this same date in earlier years.
 *
 * A memory belongs to a date, not to today. The page for a date is the day's
 * own page, so the day page is where these are read — including on a day being
 * opened for the first time, where the years behind it are the nearest thing
 * the journal has to a prompt.
 *
 * The reduction to a snippet happens on the server. An anniversary is there to
 * be recognised, not re-read: what crosses the wire is the opening of the entry
 * and how long ago it was, and the way to the rest of it is the link.
 */

import { type JournalDate, parseJournalDate } from './journal-day.ts';
import type { AnniversaryEntry } from './schemas/anniversary-entry.ts';
import { archiveSnippet } from './snippet.ts';

/** One earlier year's entry for the same day of the month. */
export type Anniversary = {
  readonly date: JournalDate;
  readonly yearsAgo: number;
  readonly words: number;
  readonly snippet: string;
};

/**
 * How many years back a day offers at once. A day with a long journal behind it
 * would otherwise put a decade of openings under the evening's writing, and the
 * years nearest the writer are the ones they remember enough to want.
 */
export const anniversaryLimit = 4;

/** Where the month and day begin in an ISO date. */
export const isoMonthStart = 5;

/**
 * `on` is the day being read, not today: an anniversary of 24 August is four
 * years old when read on a page for 2026 and three when read on the page for
 * 2025, and the count has to say the same thing as the date beside it.
 */
export const anniversaryOf =
  (on: JournalDate) =>
  (entry: AnniversaryEntry): Anniversary => ({
    date: entry.date,
    yearsAgo: parseJournalDate(on).year - parseJournalDate(entry.date).year,
    words: entry.journalWordCount + entry.scriptureWordCount,
    snippet: archiveSnippet(entry),
  });
