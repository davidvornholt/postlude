/**
 * The stretches of time an export can be cut into: a day, a week, a month, or a
 * year to a file.
 *
 * A day is the journal's own unit, so a file per day is what an export is
 * unless the writer asks for something else. The longer periods are for reading
 * rather than for keeping: a year of days is 365 documents to open one at a
 * time, where the same year by month is twelve that each read as a stretch of
 * life.
 *
 * A week here is the ISO 8601 week — Monday to Sunday, numbered by the week its
 * Thursday falls in, which is what makes a week across New Year belong whole to
 * one year instead of being split between two. The activity map draws its
 * columns Sunday-first because that is how a year of squares is read at a
 * glance; a file name has to mean the same thing outside this app as inside it,
 * and only the ISO week does.
 *
 * Nothing here reads a clock or builds an instant. A period is a property of
 * the date it is asked about.
 */

import { monthYearLabel } from './activity-labels.ts';
import {
  daysBetweenJournalDates,
  formatJournalDate,
  type JournalDate,
  journalDateWeekday,
  parseJournalDate,
  shiftJournalDate,
} from './journal-day.ts';

export const exportGroupings = ['day', 'week', 'month', 'year'] as const;

export type ExportGrouping = (typeof exportGroupings)[number];

const daysPerWeek = 7;
const thursday = 4;
const weekDigits = 2;
const monthDigits = 2;
const yearDigits = 4;
const firstYear = 1;
const lastYear = 9999;

const pad = (value: number, width: number): string =>
  String(value).padStart(width, '0');

const yearKey = (year: number): string => {
  if (year < firstYear || year > lastYear) {
    throw new RangeError(`Export year is outside 0001 through 9999: ${year}`);
  }
  return pad(year, yearDigits);
};

/** Monday 1 through Sunday 7, which is how ISO 8601 counts a week. */
const isoWeekday = (date: JournalDate): number =>
  ((journalDateWeekday(date) + daysPerWeek - 1) % daysPerWeek) + 1;

/**
 * The week a date belongs to, as `2026-W35`. Both the number and the year hang
 * on the week's Thursday, because that is the day ISO 8601 puts the week in the
 * year with: a week is week one of the year its Thursday lands in, so the last
 * days of December can read as `2026-W01` and the first days of January as
 * `2025-W53`, each week counted once.
 */
export const isoWeekKey = (date: JournalDate): string => {
  const midweek = shiftJournalDate(date, thursday - isoWeekday(date));
  const { year } = parseJournalDate(midweek);
  const yearStart = formatJournalDate({ year, month: 1, day: 1 });
  const week =
    Math.floor(daysBetweenJournalDates(yearStart, midweek) / daysPerWeek) + 1;
  return `${yearKey(year)}-W${pad(week, weekDigits)}`;
};

const periodKeys: Record<ExportGrouping, (date: JournalDate) => string> = {
  day: (date) => date,
  week: isoWeekKey,
  month: (date) => {
    const { year, month } = parseJournalDate(date);
    return `${yearKey(year)}-${pad(month, monthDigits)}`;
  },
  year: (date) => yearKey(parseJournalDate(date).year),
};

/** Which file of the export a day is written into. */
export const periodKeyOf = (
  grouping: ExportGrouping,
  date: JournalDate,
): string => periodKeys[grouping](date);

/**
 * Where that file sits. Everything is foldered by year, so a long journal opens
 * as a handful of folders rather than as one listing of thousands — except a
 * year to a file, where a folder would hold one document and be a click that
 * leads nowhere.
 */
const weekKeyPattern = /^(?<year>\d{4})-W(?<week>\d{2})$/u;
const monthKeyPattern = /^(?<year>\d{4})-(?<month>\d{2})$/u;
const yearKeyPattern = /^\d{4}$/u;
const firstPeriodNumber = 1;
const lastMonth = 12;

/** December 28 always belongs to the last ISO week of its calendar year. */
const lastIsoWeekOf = (year: number): number =>
  Number(
    isoWeekKey(formatJournalDate({ year, month: 12, day: 28 })).slice(
      -weekDigits,
    ),
  );

type PeriodKeyParts = {
  readonly year: string;
  readonly number?: number;
};

const parsePeriodKey = (
  grouping: ExportGrouping,
  key: string,
): PeriodKeyParts => {
  if (grouping === 'day') {
    const { year } = parseJournalDate(key);
    return { year: yearKey(year) };
  }
  if (grouping === 'year') {
    const year = Number(key);
    if (!yearKeyPattern.test(key) || year < firstYear || year > lastYear) {
      throw new TypeError(`Not a year export key: ${key}`);
    }
    return { year: key };
  }
  const parts = (grouping === 'week' ? weekKeyPattern : monthKeyPattern).exec(
    key,
  )?.groups;
  if (parts?.year === undefined) {
    throw new TypeError(`Not a ${grouping} export key: ${key}`);
  }
  const numberText = grouping === 'week' ? parts.week : parts.month;
  if (numberText === undefined) {
    throw new TypeError(`Not a ${grouping} export key: ${key}`);
  }
  const year = Number(parts.year);
  const number = Number(numberText);
  if (year < firstYear || year > lastYear || number < firstPeriodNumber) {
    throw new TypeError(`Not a ${grouping} export key: ${key}`);
  }
  const lastNumber = grouping === 'week' ? lastIsoWeekOf(year) : lastMonth;
  if (number > lastNumber) {
    throw new TypeError(`Not a ${grouping} export key: ${key}`);
  }
  return { year: parts.year, number };
};

export const periodPath = (grouping: ExportGrouping, key: string): string => {
  const { year } = parsePeriodKey(grouping, key);
  return grouping === 'year' ? `${year}.md` : `${year}/${key}.md`;
};

const periodLabels: Record<ExportGrouping, (key: string) => string> = {
  day: (key) => {
    parsePeriodKey('day', key);
    return key;
  },
  week: (key) => {
    const { year, number } = parsePeriodKey('week', key);
    return `Week ${number}, ${year}`;
  },
  month: (key) => {
    const { year, number } = parsePeriodKey('month', key);
    return monthYearLabel(
      formatJournalDate({ year: Number(year), month: number ?? 0, day: 1 }),
    );
  },
  year: (key) => parsePeriodKey('year', key).year,
};

/** What that file calls itself in its opening heading. */
export const periodLabel = (grouping: ExportGrouping, key: string): string =>
  periodLabels[grouping](key);
