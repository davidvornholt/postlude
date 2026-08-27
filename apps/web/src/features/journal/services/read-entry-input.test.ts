import { describe, expect, it } from 'bun:test';

import { decodeReadDatedEntryInput } from './read-entry-input.ts';

describe('dated journal read input', () => {
  it('accepts a valid named journal date', () => {
    expect(decodeReadDatedEntryInput({ date: '2026-08-26' })).toEqual({
      date: '2026-08-26',
    });
  });

  it('refuses text that cannot identify a journal day', () => {
    const invalidDates = [
      'not-a-date',
      '2026-13-01',
      '2026-02-29',
      '2026-08-26T00:00:00Z',
    ];

    for (const date of invalidDates) {
      expect(() => decodeReadDatedEntryInput({ date })).toThrow();
    }
    expect(() => decodeReadDatedEntryInput({})).toThrow();
  });
});
