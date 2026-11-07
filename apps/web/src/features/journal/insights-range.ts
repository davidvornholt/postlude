/**
 * The stretches Insights reads the journal over: a week, a month, a year, or
 * everything since the first written day.
 *
 * A week runs Monday to Sunday, as the calendar's rows do, and its address is
 * its Monday. Its number is the ISO week's, the one German calendars print.
 * The journal's range starts on a Monday and ends on a Friday, so every week
 * starts on its Monday and has its Thursday, and only the last one is short.
 * A year is the calendar year, January to December, because that is the year a
 * writer means when they look back on one.
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

export type InsightsRange =
  | { readonly kind: 'week'; readonly start: JournalDate }
  | { readonly kind: 'month'; readonly month: JournalMonth }
  | { readonly kind: 'year'; readonly year: number }
  /** From the first written day to today. */
  | {
      readonly kind: 'all';
      readonly from: JournalDate;
      readonly to: JournalDate;
    };

export type RangeKind = InsightsRange['kind'];

/** The ranges that step back and forth, unlike the one that holds them all. */
export type SteppedRangeKind = Exclude<RangeKind, 'all'>;

export const firstYear = 1;
export const lastYear = 9999;

const daysPerWeek = 7;
const thursdayIndex = 3;
const lastMonth = 12;
const lastDayOfDecember = 31;

export const weekStartOf = (date: JournalDate): JournalDate =>
  shiftJournalDate(date, -calendarWeekdayIndex(date));

const datesBetween = (
  from: JournalDate,
  to: JournalDate,
): ReadonlyArray<JournalDate> => {
  const dates: Array<JournalDate> = [];
  for (let date = from; date <= to; date = shiftJournalDate(date, 1)) {
    dates.push(date);
    if (date === latestJournalDate) {
      break;
    }
  }
  return dates;
};

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

const yearBounds = (
  year: number,
): { readonly from: JournalDate; readonly to: JournalDate } => ({
  from: formatJournalDate({ year, month: 1, day: 1 }),
  to: formatJournalDate({ year, month: lastMonth, day: lastDayOfDecember }),
});

/** Every day of the range in order, including any still to come. */
export const rangeDates = (
  range: InsightsRange,
): ReadonlyArray<JournalDate> => {
  switch (range.kind) {
    case 'week':
      return weekDates(range.start);
    case 'month':
      return datesInMonth(range.month);
    case 'year': {
      const { from, to } = yearBounds(range.year);
      return datesBetween(from, to);
    }
    default:
      return datesBetween(range.from, range.to);
  }
};

export const rangeHolding = (
  kind: SteppedRangeKind,
  date: JournalDate,
): InsightsRange => {
  switch (kind) {
    case 'week':
      return { kind, start: weekStartOf(date) };
    case 'month':
      return { kind, month: journalMonthOf(date) };
    default:
      return { kind, year: parseJournalDate(date).year };
  }
};

export const rangeIncludes = (
  range: InsightsRange,
  date: JournalDate,
): boolean => {
  const dates = rangeDates(range);
  const [first] = dates;
  const last = dates.at(-1);
  return (
    first !== undefined && last !== undefined && date >= first && date <= last
  );
};

const shiftWeek = (
  start: JournalDate,
  direction: -1 | 1,
): InsightsRange | undefined => {
  const dates = weekDates(start);
  const edge = direction === -1 ? dates[0] : dates.at(-1);
  if (
    edge === undefined ||
    edge === (direction === -1 ? earliestJournalDate : latestJournalDate)
  ) {
    return;
  }
  return {
    kind: 'week',
    start: weekStartOf(shiftJournalDate(edge, direction)),
  };
};

/** The range before or after, or undefined past the journal's range. */
export const shiftRange = (
  range: InsightsRange,
  direction: -1 | 1,
): InsightsRange | undefined => {
  switch (range.kind) {
    case 'week':
      return shiftWeek(range.start, direction);
    case 'month': {
      const month = shiftJournalMonth(range.month, direction);
      return month === undefined ? undefined : { kind: 'month', month };
    }
    case 'year': {
      const year = range.year + direction;
      return year < firstYear || year > lastYear
        ? undefined
        : { kind: 'year', year };
    }
    default:
      return;
  }
};

/**
 * The range a step leads to, if it holds a day between the first written day
 * and today. Stepping further would only open pages with nothing on them.
 */
export const reachableShift = (
  range: InsightsRange,
  direction: -1 | 1,
  bounds: { readonly earliest: JournalDate; readonly today: JournalDate },
): InsightsRange | undefined => {
  const shifted = shiftRange(range, direction);
  if (shifted === undefined) {
    return;
  }
  const dates = rangeDates(shifted);
  const [first] = dates;
  const last = dates.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }
  return last < bounds.earliest || first > bounds.today ? undefined : shifted;
};

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

const weekLabel = (start: JournalDate): string => {
  const dates = weekDates(start);
  const first = parseJournalDate(start);
  const last = parseJournalDate(dates.at(-1) ?? start);
  const opening = `${monthName(first.month)} ${first.day}`;
  if (first.year !== last.year) {
    return `${opening}, ${first.year} – ${monthName(last.month)} ${last.day}, ${last.year}`;
  }
  const end =
    first.month === last.month
      ? `${last.day}`
      : `${monthName(last.month)} ${last.day}`;
  return `${opening} – ${end}, ${last.year}`;
};

const yearDigits = 4;

export const yearLabel = (year: number): string =>
  String(year).padStart(yearDigits, '0');

/**
 * "October 26 – November 1, 2026", in the journal's American convention. The
 * month and year are said once when both ends share them. Everything is said
 * from where it starts, because where it ends is today.
 */
export const rangeLabel = (range: InsightsRange): string => {
  switch (range.kind) {
    case 'week':
      return weekLabel(range.start);
    case 'month':
      return journalMonthLabel(range.month);
    case 'year':
      return yearLabel(range.year);
    default:
      return `Since ${journalMonthLabel(journalMonthOf(range.from))}`;
  }
};

export const rangeNoun = (kind: RangeKind): string =>
  kind === 'all' ? 'stretch' : kind;
