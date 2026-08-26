import { describe, expect, it } from 'bun:test';

import { decodeReadEntryInput } from './read-entry-input.ts';

describe('readEntryFn input', () => {
  it('accepts an omitted or valid journal date', () => {
    expect(decodeReadEntryInput({})).toEqual({});
    expect(decodeReadEntryInput({ date: '2026-08-26' })).toEqual({
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
      expect(() => decodeReadEntryInput({ date })).toThrow();
    }
  });
});
