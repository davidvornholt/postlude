/**
 * How a journal day is named to the reader.
 *
 * The date is built as noon UTC from its own parts and formatted in UTC, so
 * the label is a rendering of the calendar date and never a rendering of an
 * instant. Formatting it in the reader's zone instead would show yesterday's
 * date to anyone west of the configured clock — the page would disagree with
 * the day it is the page for.
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
  parseJournalDate,
} from './journal-day.ts';

const noonHour = 12;

const asUtcNoon = (date: JournalDate): Date => {
  const { year, month, day } = parseJournalDate(date);
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(noonHour, 0, 0, 0);
  return instant;
};

const longFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** The heading a day's page carries: "Wednesday, August 26, 2026". */
export const journalDateLabel = (date: JournalDate): string =>
  longFormat.format(asUtcNoon(date));

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
