/**
 * The ranges Insights reads over. The cases worth pinning are the ones a date
 * library would usually settle: weeks that cross a month or a year, ISO week
 * numbers at New Year, and the two ends of the journal's range, where a week is
 * cut short rather than reaching past what a date can hold.
 */

import { describe, expect, it } from 'bun:test';
import {
  isoWeekNumber,
  rangeDates,
  rangeHolding,
  rangeIncludes,
  rangeLabel,
  reachableShift,
  shiftRange,
  weekStartOf,
} from './insights-range.ts';
import { earliestJournalDate, latestJournalDate } from './journal-day.ts';

describe('weekStartOf', () => {
  it('reads any day of a week as its Monday', () => {
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26');
    expect(weekStartOf('2026-10-29')).toBe('2026-10-26');
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26');
  });

  it('starts the first week on the first day the journal can hold', () => {
    expect(weekStartOf(earliestJournalDate)).toBe(earliestJournalDate);
    expect(weekStartOf('0001-01-03')).toBe(earliestJournalDate);
  });
});

describe('rangeDates', () => {
  it('lists a week from Monday to Sunday', () => {
    expect(rangeDates({ kind: 'week', start: '2026-10-26' })).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('lists every day of a month', () => {
    const february = rangeDates({ kind: 'month', month: '2028-02' });
    expect(february).toHaveLength(29);
    expect(february.at(0)).toBe('2028-02-01');
    expect(february.at(-1)).toBe('2028-02-29');
  });

  it('cuts the last week short at the last day the journal can hold', () => {
    expect(rangeDates(rangeHolding('week', latestJournalDate))).toEqual([
      '9999-12-27',
      '9999-12-28',
      '9999-12-29',
      '9999-12-30',
      latestJournalDate,
    ]);
  });
});

describe('shiftRange', () => {
  it('steps a week back and forward across a month', () => {
    const week = { kind: 'week', start: '2026-10-26' } as const;
    expect(shiftRange(week, -1)).toEqual({
      kind: 'week',
      start: '2026-10-19',
    });
    expect(shiftRange(week, 1)).toEqual({ kind: 'week', start: '2026-11-02' });
  });

  it('steps a month across New Year', () => {
    expect(shiftRange({ kind: 'month', month: '2026-12' }, 1)).toEqual({
      kind: 'month',
      month: '2027-01',
    });
    expect(shiftRange({ kind: 'month', month: '2027-01' }, -1)).toEqual({
      kind: 'month',
      month: '2026-12',
    });
  });

  it('has nothing past either end of the journal', () => {
    expect(shiftRange(rangeHolding('week', earliestJournalDate), -1)).toBe(
      undefined,
    );
    expect(shiftRange(rangeHolding('week', latestJournalDate), 1)).toBe(
      undefined,
    );
    expect(shiftRange({ kind: 'month', month: '0001-01' }, -1)).toBe(undefined);
    expect(shiftRange({ kind: 'month', month: '9999-12' }, 1)).toBe(undefined);
  });
});

describe('years and all time', () => {
  it('lists a calendar year from January to December', () => {
    const leap = rangeDates({ kind: 'year', year: 2028 });
    expect(leap).toHaveLength(366);
    expect(leap.at(0)).toBe('2028-01-01');
    expect(leap.at(-1)).toBe('2028-12-31');
  });

  it('steps a year and stops at the ends of the journal', () => {
    expect(shiftRange({ kind: 'year', year: 2026 }, -1)).toEqual({
      kind: 'year',
      year: 2025,
    });
    expect(shiftRange({ kind: 'year', year: 1 }, -1)).toBe(undefined);
    expect(shiftRange({ kind: 'year', year: 9999 }, 1)).toBe(undefined);
  });

  it('runs all time from the first written day to today and never steps', () => {
    const all = { kind: 'all', from: '2024-03-30', to: '2024-04-02' } as const;
    expect(rangeDates(all)).toEqual([
      '2024-03-30',
      '2024-03-31',
      '2024-04-01',
      '2024-04-02',
    ]);
    expect(shiftRange(all, -1)).toBe(undefined);
    expect(rangeLabel(all)).toBe('Since March 2024');
  });

  it('holds the year a date is in', () => {
    expect(rangeHolding('year', '2026-11-07')).toEqual({
      kind: 'year',
      year: 2026,
    });
  });

  it('names a year with four digits', () => {
    expect(rangeLabel({ kind: 'year', year: 2026 })).toBe('2026');
    expect(rangeLabel({ kind: 'year', year: 812 })).toBe('0812');
  });
});

describe('reachableShift', () => {
  const bounds = { earliest: '2025-03-12', today: '2026-11-07' } as const;

  it('steps while the next range still holds a day up to today', () => {
    expect(
      reachableShift({ kind: 'month', month: '2026-10' }, 1, bounds),
    ).toEqual({ kind: 'month', month: '2026-11' });
    expect(reachableShift({ kind: 'month', month: '2026-11' }, 1, bounds)).toBe(
      undefined,
    );
  });

  it('steps back while the range still holds the first written day', () => {
    expect(reachableShift({ kind: 'year', year: 2026 }, -1, bounds)).toEqual({
      kind: 'year',
      year: 2025,
    });
    expect(reachableShift({ kind: 'year', year: 2025 }, -1, bounds)).toBe(
      undefined,
    );
  });
});

describe('rangeIncludes', () => {
  it('holds exactly the days of the period', () => {
    const week = { kind: 'week', start: '2026-10-26' } as const;
    expect(rangeIncludes(week, '2026-11-01')).toBe(true);
    expect(rangeIncludes(week, '2026-11-02')).toBe(false);
    expect(
      rangeIncludes({ kind: 'month', month: '2026-10' }, '2026-10-31'),
    ).toBe(true);
  });
});

describe('isoWeekNumber', () => {
  it('numbers a week by the year its Thursday falls in', () => {
    expect(isoWeekNumber('2026-10-26')).toBe(44);
    expect(isoWeekNumber('2025-12-29')).toBe(1);
    expect(isoWeekNumber('2026-12-28')).toBe(53);
    expect(isoWeekNumber('2022-12-26')).toBe(52);
  });

  it('numbers the short last week of the journal by its Thursday', () => {
    expect(isoWeekNumber('9999-12-27')).toBe(52);
  });
});

describe('rangeLabel', () => {
  it('names the month once when the week stays inside it', () => {
    expect(rangeLabel({ kind: 'week', start: '2026-10-05' })).toBe(
      'October 5 – 11, 2026',
    );
  });

  it('names both months when the week crosses one', () => {
    expect(rangeLabel({ kind: 'week', start: '2026-10-26' })).toBe(
      'October 26 – November 1, 2026',
    );
  });

  it('names both years when the week crosses New Year', () => {
    expect(rangeLabel({ kind: 'week', start: '2026-12-28' })).toBe(
      'December 28, 2026 – January 3, 2027',
    );
  });

  it('names a month', () => {
    expect(rangeLabel({ kind: 'month', month: '2026-10' })).toBe(
      'October 2026',
    );
  });
});
