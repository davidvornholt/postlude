/**
 * Where each range lives in the address.
 *
 * The range that holds today carries no date, so `/insights` is this year and
 * `/insights?range=month` is this month on any day it is opened, and a
 * bookmark of either keeps meaning "now". Every other range names its own
 * week, month, or year.
 */

import { journalMonthOf } from './calendar.ts';
import {
  type InsightsRange,
  type RangeKind,
  rangeDates,
  rangeHolding,
  rangeIncludes,
  weekStartOf,
} from './insights-range.ts';
import { type JournalDate, parseJournalDate } from './journal-day.ts';
import type { InsightsQueryParams } from './schemas/insights-query.ts';

export const insightsSearch = (
  range: InsightsRange,
  today: JournalDate,
): InsightsQueryParams => {
  const current = rangeIncludes(range, today);
  switch (range.kind) {
    case 'week':
      return current ? { range: 'week' } : { range: 'week', week: range.start };
    case 'month':
      return current
        ? { range: 'month' }
        : { range: 'month', month: range.month };
    case 'year':
      return current ? {} : { year: range.year };
    default:
      return { range: 'all' };
  }
};

/**
 * The range a switch to another kind opens: the one holding today while today
 * is in view, otherwise the one holding the day the current range starts on,
 * so the reader stays near the days they were looking at.
 */
export const switchedRange = (
  from: InsightsRange,
  kind: RangeKind,
  bounds: { readonly earliest: JournalDate; readonly today: JournalDate },
): InsightsRange => {
  if (kind === 'all') {
    return { kind, from: bounds.earliest, to: bounds.today };
  }
  const anchor =
    from.kind === 'all' || rangeIncludes(from, bounds.today)
      ? bounds.today
      : (rangeDates(from)[0] ?? bounds.today);
  return rangeHolding(kind, anchor);
};

/** The range kind an address asks for, read the way the server reads it. */
export const searchedKind = (search: InsightsQueryParams): RangeKind =>
  'range' in search ? search.range : 'year';

/**
 * The range an address names, read the way the server reads it: what is left
 * out is the range holding today, and all time runs from the first written day,
 * or from today while nothing is written.
 */
export const rangeOfSearch = (
  search: InsightsQueryParams,
  today: JournalDate,
  earliest: JournalDate | undefined,
): InsightsRange => {
  if (!('range' in search)) {
    return { kind: 'year', year: search.year ?? parseJournalDate(today).year };
  }
  switch (search.range) {
    case 'week':
      return { kind: 'week', start: weekStartOf(search.week ?? today) };
    case 'month':
      return { kind: 'month', month: search.month ?? journalMonthOf(today) };
    default:
      return {
        kind: 'all',
        from: earliest === undefined || earliest > today ? today : earliest,
        to: today,
      };
  }
};
