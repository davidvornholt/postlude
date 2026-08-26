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

const isoYearEnd = 4;
const isoMonthEnd = 7;
const weekNumberStart = 6;
const daysPerWeek = 7;
const thursday = 4;
const weekDigits = 2;

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
  return `${midweek.slice(0, isoYearEnd)}-W${String(week).padStart(weekDigits, '0')}`;
};

const periodKeys: Record<ExportGrouping, (date: JournalDate) => string> = {
  day: (date) => date,
  week: isoWeekKey,
  month: (date) => date.slice(0, isoMonthEnd),
  year: (date) => date.slice(0, isoYearEnd),
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
export const periodPath = (grouping: ExportGrouping, key: string): string =>
  grouping === 'year' ? `${key}.md` : `${key.slice(0, isoYearEnd)}/${key}.md`;

const periodLabels: Record<ExportGrouping, (key: string) => string> = {
  day: (key) => key,
  week: (key) =>
    `Week ${key.slice(weekNumberStart)}, ${key.slice(0, isoYearEnd)}`,
  month: monthYearLabel,
  year: (key) => key,
};

/** What that file calls itself in its opening heading. */
export const periodLabel = (grouping: ExportGrouping, key: string): string =>
  periodLabels[grouping](key);

export type ExportPeriod<Day> = {
  readonly key: string;
  readonly days: ReadonlyArray<Day>;
};

/**
 * The days cut into periods, each in the order it arrived. Days are grouped as
 * they come rather than sorted here: the read that produced them already
 * decided the order the export is written in, and a second opinion about it
 * here would only be a place for the two to disagree.
 */
export const periodsOf = <Day extends { readonly date: JournalDate }>(
  days: ReadonlyArray<Day>,
  grouping: ExportGrouping,
): ReadonlyArray<ExportPeriod<Day>> => {
  const periods: Array<{ key: string; days: Array<Day> }> = [];
  for (const day of days) {
    const key = periodKeyOf(grouping, day.date);
    const open = periods.at(-1);
    if (open?.key === key) {
      open.days.push(day);
    } else {
      periods.push({ key, days: [day] });
    }
  }
  return periods;
};
