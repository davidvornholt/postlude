import { describe, expect, it } from 'bun:test';

import {
  berlinClock,
  isClock,
  isClockRange,
  journalClockInstant,
  journalClockSpan,
} from './legacy-clock.ts';

describe('journalClockInstant', () => {
  it('reads a clock time onto the journal day, which runs from 04:00 to 04:00', () => {
    expect(journalClockInstant('2026-10-29', '09:30')).toBe(
      '2026-10-29T09:30:00+01:00',
    );
    expect(journalClockInstant('2026-10-29', '04:00')).toBe(
      '2026-10-29T04:00:00+01:00',
    );
    expect(journalClockInstant('2026-10-29', '03:59')).toBe(
      '2026-10-30T03:59:00+01:00',
    );
    expect(journalClockInstant('2026-10-29', '0:15')).toBe(
      '2026-10-30T00:15:00+01:00',
    );
  });

  it('uses the offset Berlin had at that moment, across a change of clocks', () => {
    // Summer time ends at 03:00 on 25 October 2026, inside the journal day
    // that starts on the 24th.
    expect(journalClockInstant('2026-10-24', '09:00')).toBe(
      '2026-10-24T09:00:00+02:00',
    );
    expect(journalClockInstant('2026-10-24', '03:30')).toBe(
      '2026-10-25T03:30:00+01:00',
    );
    // It starts at 02:00 on 29 March 2026.
    expect(journalClockInstant('2026-03-28', '23:00')).toBe(
      '2026-03-28T23:00:00+01:00',
    );
    expect(journalClockInstant('2026-03-28', '03:30')).toBe(
      '2026-03-29T03:30:00+02:00',
    );
  });

  it('reads nothing from words that are no clock time', () => {
    expect(journalClockInstant('2026-10-29', '24:00')).toBeUndefined();
    expect(journalClockInstant('2026-10-29', '9:75')).toBeUndefined();
    expect(journalClockInstant('2026-10-29', 'noon')).toBeUndefined();
    expect(isClock('All day')).toBe(false);
    expect(isClock(' 07:05 ')).toBe(true);
  });
});

describe('journalClockSpan', () => {
  it('reads a range, an end before its start being the next day', () => {
    expect(journalClockSpan('2026-10-29', '10:00–11:30')).toEqual({
      start: '2026-10-29T10:00:00+01:00',
      end: '2026-10-29T11:30:00+01:00',
    });
    expect(journalClockSpan('2026-10-29', '23:00 - 01:00')).toEqual({
      start: '2026-10-29T23:00:00+01:00',
      end: '2026-10-30T01:00:00+01:00',
    });
    expect(journalClockSpan('2026-10-29', '13:00–04:00')).toEqual({
      start: '2026-10-29T13:00:00+01:00',
      end: '2026-10-30T04:00:00+01:00',
    });
    expect(journalClockSpan('2026-10-29', '03:30–05:00')).toEqual({
      start: '2026-10-30T03:30:00+01:00',
      end: '2026-10-30T05:00:00+01:00',
    });
  });

  it('reads nothing from a range it cannot read', () => {
    expect(journalClockSpan('2026-10-29', '10:00')).toBeUndefined();
    expect(journalClockSpan('2026-10-29', '10:00–25:00')).toBeUndefined();
    expect(isClockRange('10:00–11:00')).toBe(true);
    expect(isClockRange('2 h 10 min')).toBe(false);
  });
});

it('shows an instant as the Berlin clock time the old pages showed', () => {
  expect(berlinClock('2026-10-29T07:12:00Z')).toBe('08:12');
  expect(berlinClock('2026-07-01T07:12:00Z')).toBe('09:12');
});
