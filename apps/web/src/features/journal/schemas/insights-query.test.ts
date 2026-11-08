import { expect, it } from 'bun:test';

import { decodeInsightsQuery, insightsSearchOf } from './insights-query.ts';

it('reads nothing as this year', () => {
  expect(decodeInsightsQuery({})).toEqual({});
});

it('names a year anywhere in the journal', () => {
  expect(decodeInsightsQuery({ year: 1 })).toEqual({ year: 1 });
  expect(decodeInsightsQuery({ year: 2025 })).toEqual({ year: 2025 });
  expect(decodeInsightsQuery({ year: 9999 })).toEqual({ year: 9999 });
});

it('rejects a year outside the journal', () => {
  expect(() => decodeInsightsQuery({ year: 0 })).toThrow();
  expect(() => decodeInsightsQuery({ year: 10_000 })).toThrow();
  expect(() => decodeInsightsQuery({ year: 2025.5 })).toThrow();
});

it('reads a week, a month and all time by their range', () => {
  expect(decodeInsightsQuery({ range: 'week', week: '2026-10-29' })).toEqual({
    range: 'week',
    week: '2026-10-29',
  });
  expect(decodeInsightsQuery({ range: 'month' })).toEqual({ range: 'month' });
  expect(decodeInsightsQuery({ range: 'all' })).toEqual({ range: 'all' });
});

it('rejects a week or a month that is not a date', () => {
  expect(() =>
    decodeInsightsQuery({ range: 'week', week: '2026-02-30' }),
  ).toThrow();
  expect(() =>
    decodeInsightsQuery({ range: 'month', month: '2026-13' }),
  ).toThrow();
});

/*
 * The route reads the address leniently: an address that names no view that
 * exists opens this year rather than an error page.
 */
it('reads an address that does not decode as this year', () => {
  expect(insightsSearchOf({ range: 'week', week: '2026-02-30' })).toEqual({});
  expect(insightsSearchOf({ year: 'last' })).toEqual({});
  expect(insightsSearchOf('nonsense')).toEqual({});
  expect(insightsSearchOf({ range: 'all' })).toEqual({ range: 'all' });
});
