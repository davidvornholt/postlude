import {
  formatJournalDate,
  type JournalDate,
  journalDateWeekday,
  parseJournalDate,
  shiftJournalDate,
} from './journal-day.ts';
import { journalMonthLabel as monthName } from './journal-labels.ts';

export type JournalMonth = string;

const monthPattern = /^(?<year>\d{4})-(?<month>\d{2})$/u;
const firstMonth = 1;
const lastMonth = 12;
const firstDay = 1;
const lastYear = 9999;
const monthPrefixLength = 7;
const daysPerWeek = 7;
const mondayOffset = 6;

export const isJournalMonth = (value: string): boolean => {
  const parts = monthPattern.exec(value)?.groups;
  if (parts === undefined) {
    return false;
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  return (
    year >= 1 && year <= lastYear && month >= firstMonth && month <= lastMonth
  );
};

export const journalMonthOf = (date: JournalDate): JournalMonth =>
  date.slice(0, monthPrefixLength);

export const journalMonthLabel = (month: JournalMonth): string => {
  if (!isJournalMonth(month)) {
    throw new TypeError(`Not a journal month: ${month}`);
  }
  const [yearText, monthText] = month.split('-');
  return `${monthName(Number(monthText))} ${Number(yearText)}`;
};

export const firstDateOfMonth = (month: JournalMonth): JournalDate => {
  if (!isJournalMonth(month)) {
    throw new TypeError(`Not a journal month: ${month}`);
  }
  const [yearText, monthText] = month.split('-');
  return formatJournalDate({
    year: Number(yearText),
    month: Number(monthText),
    day: firstDay,
  });
};

export const shiftJournalMonth = (
  month: JournalMonth,
  distance: number,
): JournalMonth | undefined => {
  const first = firstDateOfMonth(month);
  const { year, month: number } = parseJournalDate(first);
  const offset = year * lastMonth + number - firstMonth + distance;
  const shiftedYear = Math.floor(offset / lastMonth);
  const shiftedMonth = (offset % lastMonth) + firstMonth;
  if (shiftedYear < 1 || shiftedYear > lastYear) {
    return undefined;
  }
  return journalMonthOf(
    formatJournalDate({
      year: shiftedYear,
      month: shiftedMonth,
      day: firstDay,
    }),
  );
};

export const datesInMonth = (
  month: JournalMonth,
): ReadonlyArray<JournalDate> => {
  const first = firstDateOfMonth(month);
  const dates: Array<JournalDate> = [];
  for (
    let date = first;
    journalMonthOf(date) === month;
    date = shiftJournalDate(date, 1)
  ) {
    dates.push(date);
  }
  return dates;
};

/** Monday is the first column, matching the calendar the writer uses. */
export const calendarWeekdayIndex = (date: JournalDate): number =>
  (journalDateWeekday(date) + mondayOffset) % daysPerWeek;
