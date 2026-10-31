/**
 * The review's weeks and months. The cases worth pinning are the ones a date
 * library would usually settle: weeks that cross a month or a year, ISO week
 * numbers at New Year, and the two ends of the journal's range, where a week is
 * cut short rather than reaching past what a date can hold.
 */

import { describe, expect, it } from 'bun:test';

import { earliestJournalDate, latestJournalDate } from './journal-day.ts';
import {
  isoWeekNumber,
  periodDates,
  periodHolding,
  periodIncludes,
  periodLabel,
  shiftPeriod,
  weekStartOf,
} from './review-period.ts';

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

describe('periodDates', () => {
  it('lists a week from Monday to Sunday', () => {
    expect(periodDates({ kind: 'week', start: '2026-10-26' })).toEqual([
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
    const february = periodDates({ kind: 'month', month: '2028-02' });
    expect(february).toHaveLength(29);
    expect(february.at(0)).toBe('2028-02-01');
    expect(february.at(-1)).toBe('2028-02-29');
  });

  it('cuts the last week short at the last day the journal can hold', () => {
    expect(periodDates(periodHolding('week', latestJournalDate))).toEqual([
      '9999-12-27',
      '9999-12-28',
      '9999-12-29',
      '9999-12-30',
      latestJournalDate,
    ]);
  });
});

describe('shiftPeriod', () => {
  it('steps a week back and forward across a month', () => {
    const week = { kind: 'week', start: '2026-10-26' } as const;
    expect(shiftPeriod(week, -1)).toEqual({
      kind: 'week',
      start: '2026-10-19',
    });
    expect(shiftPeriod(week, 1)).toEqual({ kind: 'week', start: '2026-11-02' });
  });

  it('steps a month across New Year', () => {
    expect(shiftPeriod({ kind: 'month', month: '2026-12' }, 1)).toEqual({
      kind: 'month',
      month: '2027-01',
    });
    expect(shiftPeriod({ kind: 'month', month: '2027-01' }, -1)).toEqual({
      kind: 'month',
      month: '2026-12',
    });
  });

  it('has nothing past either end of the journal', () => {
    expect(shiftPeriod(periodHolding('week', earliestJournalDate), -1)).toBe(
      undefined,
    );
    expect(shiftPeriod(periodHolding('week', latestJournalDate), 1)).toBe(
      undefined,
    );
    expect(shiftPeriod({ kind: 'month', month: '0001-01' }, -1)).toBe(
      undefined,
    );
    expect(shiftPeriod({ kind: 'month', month: '9999-12' }, 1)).toBe(undefined);
  });
});

describe('periodIncludes', () => {
  it('holds exactly the days of the period', () => {
    const week = { kind: 'week', start: '2026-10-26' } as const;
    expect(periodIncludes(week, '2026-11-01')).toBe(true);
    expect(periodIncludes(week, '2026-11-02')).toBe(false);
    expect(
      periodIncludes({ kind: 'month', month: '2026-10' }, '2026-10-31'),
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

describe('periodLabel', () => {
  it('names the month once when the week stays inside it', () => {
    expect(periodLabel({ kind: 'week', start: '2026-10-05' })).toBe(
      'October 5 – 11, 2026',
    );
  });

  it('names both months when the week crosses one', () => {
    expect(periodLabel({ kind: 'week', start: '2026-10-26' })).toBe(
      'October 26 – November 1, 2026',
    );
  });

  it('names both years when the week crosses New Year', () => {
    expect(periodLabel({ kind: 'week', start: '2026-12-28' })).toBe(
      'December 28, 2026 – January 3, 2027',
    );
  });

  it('names a month', () => {
    expect(periodLabel({ kind: 'month', month: '2026-10' })).toBe(
      'October 2026',
    );
  });
});
