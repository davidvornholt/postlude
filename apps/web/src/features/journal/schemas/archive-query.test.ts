import { expect, it } from 'bun:test';

import { decodeArchiveQuery, lastArchiveYear } from './archive-query.ts';

it('accepts every supported early Common Era year', () => {
  expect(decodeArchiveQuery({ year: 1 })).toEqual({ year: 1 });
  expect(decodeArchiveQuery({ year: 99 })).toEqual({ year: 99 });
  expect(decodeArchiveQuery({ year: 999 })).toEqual({ year: 999 });
});

it('rejects year zero and negative years', () => {
  expect(() => decodeArchiveQuery({ year: 0 })).toThrow();
  expect(() => decodeArchiveQuery({ year: -1 })).toThrow();
});

it('accepts the last year whose whole-week window stays four-digit', () => {
  expect(decodeArchiveQuery({ year: lastArchiveYear })).toEqual({
    year: 9998,
  });
});

it('rejects a year whose closing week would enter year 10000', () => {
  expect(() => decodeArchiveQuery({ year: 9999 })).toThrow();
});
