/**
 * The highlights Insights picks out of a journal: the longest entry, the
 * fullest month, and the same stretch a year earlier.
 *
 * Each one is a plain reading of what is stored, worked out the same way on
 * the server and in the fixtures. None of them is a target: a record says
 * what the writer once did, not what they should do again.
 *
 * Every function answers undefined rather than a zero when there is nothing to
 * point at, so a sparse journal shows a highlight only once it has one.
 */

import { dayWords, type WordCounts } from './activity.ts';
import { shiftJournalMonth } from './calendar.ts';
import { type MonthSummary, monthGrid } from './insights-patterns.ts';
import {
  firstYear,
  type InsightsRange,
  isoWeekNumber,
  rangeDates,
  rangeHolding,
  rangeIncludes,
  rangeLabel,
} from './insights-range.ts';
import type {
  DayRecord,
  InsightsDay,
  InsightsView,
  YearAgo,
} from './insights-view.ts';
import {
  formatJournalDate,
  isJournalDate,
  type JournalDate,
  parseJournalDate,
  shiftJournalDate,
} from './journal-day.ts';
import {
  journalCountLabel,
  journalMonthLabel,
  journalNumberLabel,
} from './journal-labels.ts';

type DatedWords = WordCounts & { readonly date: JournalDate };

/**
 * The day with the most words up to today, the earlier one on a tie so that a
 * record stays where it was set until it is beaten.
 */
export const longestEntry = (
  days: ReadonlyArray<DatedWords>,
  today: JournalDate,
): DayRecord | undefined => {
  let longest: DayRecord | undefined;
  for (const day of days) {
    const words = dayWords(day);
    if (
      day.date <= today &&
      words > 0 &&
      (longest === undefined ||
        words > longest.words ||
        (words === longest.words && day.date < longest.date))
    ) {
      longest = { date: day.date, words };
    }
  }
  return longest;
};

/**
 * The month with the most written days, then the most words. It needs two
 * months with writing to compare, because a fullest month of one is no finding.
 */
export const fullestMonth = (
  days: ReadonlyArray<InsightsDay>,
  today: JournalDate,
): MonthSummary | undefined => {
  const written = monthGrid(days, today)
    .flatMap((year) => year.months)
    .flatMap((month) =>
      month !== undefined && month.written > 0 ? [month] : [],
    )
    .sort(
      (first, second) =>
        second.written - first.written ||
        second.words - first.words ||
        first.month.localeCompare(second.month),
    );
  return written.length < 2 ? undefined : written[0];
};

const thursdayIndex = 3;
const monthsPerYear = 12;

/** The same date one year earlier, with February 29 falling back to the 28th. */
const aYearEarlier = (date: JournalDate): JournalDate | undefined => {
  const { year, month, day } = parseJournalDate(date);
  if (year - 1 < firstYear) {
    return;
  }
  const same = formatJournalDate({ year: year - 1, month, day });
  return isJournalDate(same)
    ? same
    : formatJournalDate({ year: year - 1, month, day: day - 1 });
};

/**
 * The same week, month or year one year earlier. A week is the one holding
 * the date a year before its Thursday, which is the week of the same number in
 * every year but the few that have a 53rd. All time has no year before it.
 */
export const yearEarlierRange = (
  range: InsightsRange,
): InsightsRange | undefined => {
  switch (range.kind) {
    case 'week': {
      const thursday = aYearEarlier(
        shiftJournalDate(range.start, thursdayIndex),
      );
      return thursday === undefined
        ? undefined
        : rangeHolding('week', thursday);
    }
    case 'month': {
      const month = shiftJournalMonth(range.month, -monthsPerYear);
      return month === undefined ? undefined : { kind: 'month', month };
    }
    case 'year':
      return range.year - 1 < firstYear
        ? undefined
        : { kind: 'year', year: range.year - 1 };
    default:
      return;
  }
};

/**
 * What was written in the same stretch a year earlier, from the journal's
 * written days. Undefined when nothing was, which is every range of a journal
 * younger than a year.
 */
export const yearAgoOf = (
  range: InsightsRange,
  history: ReadonlyArray<DatedWords>,
  today: JournalDate,
): YearAgo | undefined => {
  const earlier = yearEarlierRange(range);
  if (earlier === undefined) {
    return;
  }
  const dates = rangeDates(earlier).filter((date) => date <= today);
  const [first] = dates;
  const last = dates.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }
  const written = history.filter(
    (day) => day.date >= first && day.date <= last && dayWords(day) > 0,
  );
  if (written.length === 0) {
    return;
  }
  return {
    range: earlier,
    elapsed: dates.length,
    written: written.length,
    words: written.reduce((total, day) => total + dayWords(day), 0),
  };
};

export type Records = {
  readonly longest: DayRecord;
  /** The whole journal's longest, shown when the range does not hold it. */
  readonly ofAll: DayRecord | undefined;
  /** The range holds the journal's longest, and the journal reaches outside it. */
  readonly isRecord: boolean;
  /** Only a year or all time has months to compare. */
  readonly fullest: MonthSummary | undefined;
  /** All time names years; every other range already says its own. */
  readonly withYear: boolean;
  readonly takeaway: string;
};

/** "March 14", or "March 14, 2025" where the range does not say the year. */
export const recordDayLabel = (
  date: JournalDate,
  withYear: boolean,
): string => {
  const { year, month, day } = parseJournalDate(date);
  const opening = `${journalMonthLabel(month)} ${day}`;
  return withYear ? `${opening}, ${year}` : opening;
};

/**
 * The range's records, or undefined before it holds a written day. "Yet" is
 * said only where the journal reaches outside the range, before it or after
 * it, so that a record is more than the range's one long day.
 */
export const recordsOf = (view: InsightsView): Records | undefined => {
  const { range, today, earliest } = view;
  const longest = longestEntry(view.days, today);
  if (longest === undefined) {
    return;
  }
  const [start] = rangeDates(range);
  const reachesOutside =
    range.kind !== 'all' &&
    ((earliest !== undefined && start !== undefined && earliest < start) ||
      !rangeIncludes(range, today));
  const holdsLongest = view.longestEntry?.date === longest.date;
  const isRecord = holdsLongest && reachesOutside;
  const withYear = range.kind === 'all';
  const said = `${journalCountLabel(longest.words, 'word')} on ${recordDayLabel(longest.date, withYear)}`;
  return {
    longest,
    ofAll: holdsLongest || range.kind === 'all' ? undefined : view.longestEntry,
    isRecord,
    fullest:
      range.kind === 'year' || range.kind === 'all'
        ? fullestMonth(view.days, today)
        : undefined,
    withYear,
    takeaway: isRecord
      ? `Your longest entry yet: ${said}`
      : `Longest entry: ${said}`,
  };
};

/** "in November 2025", "in 2025", or "in week 45 of 2025". */
const rangeIn = (range: InsightsRange): string => {
  if (range.kind !== 'week') {
    return `in ${rangeLabel(range)}`;
  }
  const thursday = shiftJournalDate(range.start, thursdayIndex);
  return `in week ${isoWeekNumber(range.start)} of ${parseJournalDate(thursday).year}`;
};

/** "Written on 12 of 30 days in November 2025". */
export const yearAgoTakeaway = (yearAgo: YearAgo): string =>
  `Written on ${journalNumberLabel(yearAgo.written)} of ${journalCountLabel(yearAgo.elapsed, 'day')} ${rangeIn(yearAgo.range)}`;
