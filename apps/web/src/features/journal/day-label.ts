/**
 * How a journal day is named to the reader.
 *
 * The label is assembled from the calendar date's own parts, so it never
 * becomes an instant that a time zone can shift to yesterday. Its weekday is
 * calculated through the same year-safe calendar helper used by the archive.
 *
 * The locale is fixed rather than taken from the browser. Postlude has one
 * reader and the interface is English, and a date that switched between
 * `August 26` and `26 August` depending on which device it was opened on would
 * read as two different conventions inside one journal. The convention is the
 * American one, which is the one this journal's reader reads dates in.
 */

import {
  daysBetweenJournalDates,
  type JournalDate,
  journalDateWeekday,
  parseJournalDate,
} from './journal-day.ts';
import { journalMonthLabel, journalWeekdayLabel } from './journal-labels.ts';

/** The heading a day's page carries: "Wednesday, August 26, 2026". */
export const journalDateLabel = (date: JournalDate): string => {
  const { year, month, day } = parseJournalDate(date);
  return `${journalWeekdayLabel(journalDateWeekday(date))}, ${journalMonthLabel(month)} ${day}, ${year}`;
};

const yesterday = 1;

/**
 * Where the day sits relative to now, as the eyebrow above the date. Counting
 * days rather than naming a week or a month keeps one rule for every distance,
 * and in a journal the count is the useful part: "412 days ago" says something
 * "August 2025" does not.
 *
 * A day after today has no page to be the eyebrow of — the routes refuse one —
 * so the count is only ever backwards.
 */
export const journalDayRelation = (
  date: JournalDate,
  today: JournalDate,
): string => {
  const elapsed = daysBetweenJournalDates(date, today);
  if (elapsed <= 0) {
    return 'Today';
  }
  return elapsed === yesterday ? 'Yesterday' : `${elapsed} days ago`;
};
