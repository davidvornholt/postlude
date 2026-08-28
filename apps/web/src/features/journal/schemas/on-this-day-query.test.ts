import { expect, it } from 'bun:test';

import { decodeOnThisDayQuery } from './on-this-day-query.ts';

it('accepts a calendar date or the canonical empty query', () => {
  expect(decodeOnThisDayQuery({})).toEqual({});
  expect(decodeOnThisDayQuery({ date: '2026-08-25' })).toEqual({
    date: '2026-08-25',
  });
});

it('rejects malformed and impossible dates', () => {
  expect(() => decodeOnThisDayQuery({ date: 'tomorrow' })).toThrow();
  expect(() => decodeOnThisDayQuery({ date: '2026-02-30' })).toThrow();
});
