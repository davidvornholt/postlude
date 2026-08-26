import { expect, it } from 'bun:test';

import { decodeArchiveQuery, lastArchiveYear } from './archive-query.ts';

it('accepts the last year whose whole-week window stays four-digit', () => {
  expect(decodeArchiveQuery({ year: lastArchiveYear })).toEqual({
    year: 9998,
  });
});

it('rejects a year whose closing week would enter year 10000', () => {
  expect(() => decodeArchiveQuery({ year: 9999 })).toThrow();
});
