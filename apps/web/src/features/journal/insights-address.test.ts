/**
 * Where each range lives in the address. The range holding today carries no
 * date, so a bookmark of it keeps meaning "now"; any other range names itself.
 * Switching kinds stays near the days the reader was looking at.
 */

import { describe, expect, it } from 'bun:test';

import {
  insightsSearch,
  rangeOfSearch,
  searchedKind,
  switchedRange,
} from './insights-address.ts';
import { insightsSearchOf } from './schemas/insights-query.ts';

/* A Thursday. */
const today = '2026-10-29';
const bounds = { earliest: '2024-03-04', today } as const;

describe('insightsSearch', () => {
  it('leaves the date out of the range that holds today', () => {
    expect(insightsSearch({ kind: 'year', year: 2026 }, today)).toEqual({});
    expect(insightsSearch({ kind: 'month', month: '2026-10' }, today)).toEqual({
      range: 'month',
    });
    expect(
      insightsSearch({ kind: 'week', start: '2026-10-26' }, today),
    ).toEqual({ range: 'week' });
  });

  it('names any other range', () => {
    expect(insightsSearch({ kind: 'year', year: 2025 }, today)).toEqual({
      year: 2025,
    });
    expect(insightsSearch({ kind: 'month', month: '2026-09' }, today)).toEqual({
      range: 'month',
      month: '2026-09',
    });
    expect(
      insightsSearch({ kind: 'week', start: '2026-10-19' }, today),
    ).toEqual({ range: 'week', week: '2026-10-19' });
    expect(
      insightsSearch({ kind: 'all', from: bounds.earliest, to: today }, today),
    ).toEqual({ range: 'all' });
  });

  it('writes an address the route reads back as the same range kind', () => {
    const search = insightsSearch({ kind: 'month', month: '2025-03' }, today);
    expect(insightsSearchOf(search)).toEqual(search);
    expect(searchedKind(insightsSearchOf(search))).toBe('month');
  });
});

describe('switchedRange', () => {
  it('opens the range holding today while today is in view', () => {
    const thisMonth = { kind: 'month', month: '2026-10' } as const;
    expect(switchedRange(thisMonth, 'week', bounds)).toEqual({
      kind: 'week',
      start: '2026-10-26',
    });
    expect(
      switchedRange(
        { kind: 'all', from: bounds.earliest, to: today },
        'month',
        bounds,
      ),
    ).toEqual(thisMonth);
  });

  /* 1 March 2025 is a Saturday, so its week began on 24 February. */
  it('opens the range holding the first day of a past range', () => {
    const march = { kind: 'month', month: '2025-03' } as const;
    expect(switchedRange(march, 'week', bounds)).toEqual({
      kind: 'week',
      start: '2025-02-24',
    });
    expect(switchedRange(march, 'year', bounds)).toEqual({
      kind: 'year',
      year: 2025,
    });
  });

  it('spans the whole journal for all time', () => {
    expect(switchedRange({ kind: 'year', year: 2025 }, 'all', bounds)).toEqual({
      kind: 'all',
      from: bounds.earliest,
      to: today,
    });
  });
});

describe('searchedKind', () => {
  it('reads an address without a range as a year', () => {
    expect(searchedKind({})).toBe('year');
    expect(searchedKind({ year: 2025 })).toBe('year');
    expect(searchedKind({ range: 'all' })).toBe('all');
  });
});

describe('rangeOfSearch', () => {
  it('reads a search without a date as the range holding today', () => {
    expect(rangeOfSearch({}, today, bounds.earliest)).toEqual({
      kind: 'year',
      year: 2026,
    });
    expect(rangeOfSearch({ range: 'week' }, today, bounds.earliest)).toEqual({
      kind: 'week',
      start: '2026-10-26',
    });
    expect(rangeOfSearch({ range: 'month' }, today, bounds.earliest)).toEqual({
      kind: 'month',
      month: '2026-10',
    });
  });

  it('reads a week by any of its days', () => {
    expect(
      rangeOfSearch({ range: 'week', week: '2025-03-01' }, today, undefined),
    ).toEqual({ kind: 'week', start: '2025-02-24' });
  });

  it('runs all time from the first written day, or from today without one', () => {
    expect(rangeOfSearch({ range: 'all' }, today, bounds.earliest)).toEqual({
      kind: 'all',
      from: bounds.earliest,
      to: today,
    });
    expect(rangeOfSearch({ range: 'all' }, today, undefined)).toEqual({
      kind: 'all',
      from: today,
      to: today,
    });
  });

  it('reads back every range the address writes', () => {
    for (const range of [
      { kind: 'week', start: '2025-02-24' },
      { kind: 'month', month: '2025-03' },
      { kind: 'year', year: 2024 },
      { kind: 'year', year: 2026 },
    ] as const) {
      expect(
        rangeOfSearch(insightsSearch(range, today), today, bounds.earliest),
      ).toEqual(range);
    }
  });
});
