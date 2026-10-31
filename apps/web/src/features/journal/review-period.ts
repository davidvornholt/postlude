/**
 * A week runs Monday to Sunday, as the calendar's rows do, and its address is
 * its Monday. Its number is the ISO week's, the one German calendars print.
 * The journal's range starts on a Monday and ends on a Friday, so every week
 * starts on its Monday and has its Thursday, and only the last one is short.
 */

import {
  calendarWeekdayIndex,
  datesInMonth,
  type JournalMonth,
  journalMonthLabel,
  journalMonthOf,
  shiftJournalMonth,
} from './calendar.ts';
import {
  daysBetweenJournalDates,
  earliestJournalDate,
  formatJournalDate,
  type JournalDate,
  latestJournalDate,
  parseJournalDate,
  shiftJournalDate,
} from './journal-day.ts';
import { journalMonthLabel as monthName } from './journal-labels.ts';

export type ReviewPeriod =
  | { readonly kind: 'week'; readonly start: JournalDate }
  | { readonly kind: 'month'; readonly month: JournalMonth };

const daysPerWeek = 7;
const thursdayIndex = 3;

export const weekStartOf = (date: JournalDate): JournalDate =>
  shiftJournalDate(date, -calendarWeekdayIndex(date));

const weekDates = (start: JournalDate): ReadonlyArray<JournalDate> => {
  const dates = [start];
  let date = start;
  while (dates.length < daysPerWeek && date !== latestJournalDate) {
    date = shiftJournalDate(date, 1);
    if (calendarWeekdayIndex(date) === 0) {
      break;
    }
    dates.push(date);
  }
  return dates;
};

export const periodDates = (
  period: ReviewPeriod,
): ReadonlyArray<JournalDate> =>
  period.kind === 'week' ? weekDates(period.start) : datesInMonth(period.month);

/** The period before or after, or undefined past the journal's range. */
export const shiftPeriod = (
  period: ReviewPeriod,
  direction: -1 | 1,
): ReviewPeriod | undefined => {
  if (period.kind === 'month') {
    const month = shiftJournalMonth(period.month, direction);
    return month === undefined ? undefined : { kind: 'month', month };
  }
  const dates = weekDates(period.start);
  const edge = direction === -1 ? dates[0] : dates.at(-1);
  if (
    edge === undefined ||
    edge === (direction === -1 ? earliestJournalDate : latestJournalDate)
  ) {
    return undefined;
  }
  return {
    kind: 'week',
    start: weekStartOf(shiftJournalDate(edge, direction)),
  };
};

export const periodHolding = (
  kind: ReviewPeriod['kind'],
  date: JournalDate,
): ReviewPeriod =>
  kind === 'week'
    ? { kind, start: weekStartOf(date) }
    : { kind, month: journalMonthOf(date) };

export const periodIncludes = (
  period: ReviewPeriod,
  date: JournalDate,
): boolean => periodDates(period).includes(date);

/**
 * The ISO week number, read from the week's Thursday the way ISO 8601 does: the
 * week belongs to the year its Thursday is in.
 */
export const isoWeekNumber = (start: JournalDate): number => {
  const thursday = shiftJournalDate(start, thursdayIndex);
  const { year } = parseJournalDate(thursday);
  const newYear = formatJournalDate({ year, month: 1, day: 1 });
  return (
    Math.floor(daysBetweenJournalDates(newYear, thursday) / daysPerWeek) + 1
  );
};

/**
 * "October 26 – November 1, 2026", in the journal's American convention. The
 * month and year are said once when both ends share them.
 */
export const periodLabel = (period: ReviewPeriod): string => {
  if (period.kind === 'month') {
    return journalMonthLabel(period.month);
  }
  const dates = weekDates(period.start);
  const first = parseJournalDate(period.start);
  const last = parseJournalDate(dates.at(-1) ?? period.start);
  const start = `${monthName(first.month)} ${first.day}`;
  if (first.year !== last.year) {
    return `${start}, ${first.year} – ${monthName(last.month)} ${last.day}, ${last.year}`;
  }
  const end =
    first.month === last.month
      ? `${last.day}`
      : `${monthName(last.month)} ${last.day}`;
  return `${start} – ${end}, ${last.year}`;
};
